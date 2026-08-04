import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Station } from '../types';
import { ScenicAttraction } from '../utils/scenicRoutes';
import { Camera } from 'lucide-react';

interface RouteTimelineProps {
  stations: Station[];
  originId: number;
  destinationId: number;
  attractions: ScenicAttraction[];
  isGoingUp: boolean;
}

export const RouteTimeline: React.FC<RouteTimelineProps> = ({ stations, originId, destinationId, attractions, isGoingUp }) => {
  const originStation = stations.find(s => s.id === originId);
  const destStation = stations.find(s => s.id === destinationId);

  if (!originStation || !destStation) return null;

  const lowerSeq = Math.min(originStation.sequenceNumber, destStation.sequenceNumber);
  const upperSeq = Math.max(originStation.sequenceNumber, destStation.sequenceNumber);

  // Filter and sort the stations for the current leg
  const allLegStations = stations
    .filter(s => s.sequenceNumber >= lowerSeq && s.sequenceNumber <= upperSeq)
    .sort((a, b) => isGoingUp ? a.sequenceNumber - b.sequenceNumber : b.sequenceNumber - a.sequenceNumber);

  // Keep only origin, destination, and stations that are boundaries of visible attractions
  const visibleAttractions = attractions.filter(a => a.startSeq < upperSeq && a.endSeq > lowerSeq);
  const boundarySeqs = new Set<number>();
  visibleAttractions.forEach(a => {
    boundarySeqs.add(a.startSeq);
    boundarySeqs.add(a.endSeq);
  });

  const legStations = allLegStations.filter((station, idx) => {
    if (idx === 0 || idx === allLegStations.length - 1) return true;
    return boundarySeqs.has(station.sequenceNumber);
  });

  const [hoverInfo, setHoverInfo] = useState<{ attr: ScenicAttraction; rect: DOMRect } | null>(null);

  return (
    <div style={{ marginTop: '20px', marginBottom: '24px', padding: '16px 0', overflowX: 'auto' }}>
      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '32px', paddingLeft: '8px' }}>Journey Timeline</h4>
      
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 'max-content', padding: '0 24px' }}>
        
        {/* Continuous Line Background */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '24px',
          right: '24px',
          height: '4px',
          background: 'var(--overlay-border)',
          borderRadius: '2px',
          zIndex: 0
        }} />

        {legStations.map((station, idx) => {
          // Check if there's an attraction immediately after this station (in the direction of travel)
          let nextAttraction: ScenicAttraction | undefined;
          if (idx < legStations.length - 1) {
            const nextStation = legStations[idx + 1];
            const segStart = Math.min(station.sequenceNumber, nextStation.sequenceNumber);
            const segEnd = Math.max(station.sequenceNumber, nextStation.sequenceNumber);
            
            // Find attraction that overlaps this exact segment
            nextAttraction = attractions.find(a => a.startSeq <= segStart && a.endSeq >= segEnd);
          }

          return (
            <React.Fragment key={station.id}>
              {/* Station Node */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--bg-secondary)',
                  border: '4px solid var(--accent-cyan)',
                  boxShadow: '0 0 0 4px var(--bg-primary)',
                  zIndex: 2
                }} />
                <div style={{
                  position: 'absolute',
                  top: '32px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}>
                  {station.code}
                </div>
                <div style={{
                  position: 'absolute',
                  top: '48px',
                  fontSize: '0.65rem',
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}>
                  {station.name.length > 12 ? station.name.substring(0, 12) + '...' : station.name}
                </div>
              </div>

              {/* Connecting Line + Scenic Node */}
              {idx < legStations.length - 1 && (
                <div style={{
                  flex: 1,
                  minWidth: '60px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1
                }}>
                  {nextAttraction && (
                    <div 
                      role="button"
                      tabIndex={0}
                      aria-label={`View photo of ${nextAttraction.name}`}
                      onMouseEnter={(e) => setHoverInfo({ attr: nextAttraction!, rect: e.currentTarget.getBoundingClientRect() })}
                      onMouseLeave={() => setHoverInfo(null)}
                      onFocus={(e) => setHoverInfo({ attr: nextAttraction!, rect: e.currentTarget.getBoundingClientRect() })}
                      onBlur={() => setHoverInfo(null)}
                      style={{
                        position: 'relative',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-amber), var(--accent-rose))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 0 10px rgba(244, 63, 94, 0.4)',
                        border: '2px solid var(--bg-secondary)',
                        transition: 'transform 0.2s ease',
                        transform: hoverInfo?.attr.name === nextAttraction.name ? 'scale(1.2)' : 'scale(1)'
                      }}
                    >
                      <Camera size={14} color="#fff" />
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      
      <div style={{ height: '40px' }} /> {/* Spacer for labels */}
      
      {/* Portal for Hover Card to escape overflow container */}
      {hoverInfo && createPortal(
        <div style={{
          position: 'fixed',
          top: hoverInfo.rect.top - 210, // positioned above the icon
          left: hoverInfo.rect.left + hoverInfo.rect.width / 2,
          transform: 'translateX(-50%)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '12px',
          padding: '12px',
          width: '220px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          zIndex: 9999,
          pointerEvents: 'none'
        }}>
          <img 
            src={hoverInfo.attr.imageUrl} 
            alt={hoverInfo.attr.name}
            style={{
              width: '100%',
              height: '120px',
              objectFit: 'cover',
              borderRadius: '8px',
              marginBottom: '8px'
            }}
          />
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
            {hoverInfo.attr.name}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {hoverInfo.attr.description}
          </div>
        </div>,
        document.body
      )}

      <div style={{textAlign:'right'}}>
      <small style={{fontSize:'0.52rem',textAlign:'center'}}><i>** These station markers only show where the scenic views are located so passengers know when to look outside. <br/> The train still stops at all other regular stations along the way.</i></small>

      </div>

    </div>
  );
};
