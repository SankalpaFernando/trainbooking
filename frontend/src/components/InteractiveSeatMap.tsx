import React, { useState } from 'react';
import { Coach, SeatGapSummary, Station, FareEstimate } from '../types';
import { Armchair, Info, CheckCircle2, AlertTriangle, XCircle, Sparkles } from 'lucide-react';

interface InteractiveSeatMapProps {
  coaches: Coach[];
  seats: SeatGapSummary[];
  fareEstimate?: FareEstimate;
  selectedSeats: SeatGapSummary[];
  onSelectSeat: (seat: SeatGapSummary) => void;
  stations: Station[];
  originId: number;
  destinationId: number;
  onOpenWaitlist: () => void;
}

export const InteractiveSeatMap: React.FC<InteractiveSeatMapProps> = ({
  coaches,
  seats,
  fareEstimate,
  selectedSeats,
  onSelectSeat,
  stations,
  originId,
  destinationId,
  onOpenWaitlist,
}) => {
  const reservedCoaches = coaches.filter((c) => c.type === 'RESERVED');
  const [activeCoachId, setActiveCoachId] = useState<number>(
    reservedCoaches.length > 0 ? reservedCoaches[0].id : 1
  );
  const [hoveredSeatId, setHoveredSeatId] = useState<number | null>(null);

  const activeCoach = coaches.find((c) => c.id === activeCoachId);
  const coachSeats = seats.filter((s) => s.coachId === activeCoachId);

  const originStation = stations.find((s) => s.id === originId);
  const destStation = stations.find((s) => s.id === destinationId);

  const getClassMultiplier = (classType: Coach['classType']) => {
    switch (classType) {
      case 'FIRST_CLASS':
        return 1.5;
      case 'SECOND_CLASS':
        return 1.2;
      case 'THIRD_CLASS':
      default:
        return 1.0;
    }
  };

  const getCoachFare = (classType: Coach['classType']) => {
    if (!fareEstimate) return null;
    const firstSeat = coachSeats[0];
    const baseFare = firstSeat?.baseFare ?? fareEstimate.baseFare;
    const ratePerStation = firstSeat?.ratePerStation ?? fareEstimate.ratePerStation;
    const stationsTraversed = fareEstimate.stationsTraversed;
    const multiplier = getClassMultiplier(classType);
    return Math.round((baseFare + stationsTraversed * ratePerStation * multiplier) * 100) / 100;
  };

  const getStationName = (seq: number) => {
    const st = stations.find((s) => s.sequenceNumber === seq);
    return st ? st.name : `Seq ${seq}`;
  };

  const hasAnyAvailableSeat = seats.some((s) => s.isAvailableForRequestedLeg);

  // Group seats by row based on coach class type for proper grid rendering
  let seatsPerRow = 6;
  let aisleAfter = 3;
  if (activeCoach?.classType === 'FIRST_CLASS') {
    seatsPerRow = 4;
    aisleAfter = 2;
  } else if (activeCoach?.classType === 'SECOND_CLASS') {
    seatsPerRow = 5;
    aisleAfter = 2;
  }

  const seatRows: SeatGapSummary[][] = [];
  for (let i = 0; i < coachSeats.length; i += seatsPerRow) {
    seatRows.push(coachSeats.slice(i, i + seatsPerRow));
  }

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      
      {/* Title & Legend Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Armchair size={22} color="var(--accent-cyan)" />
            Interactive Coach Seat Map
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Selecting leg: <strong style={{ color: 'var(--accent-cyan)' }}>{originStation?.name} → {destStation?.name}</strong>
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#34d399', boxShadow: '0 0 6px rgba(52, 211, 153, 0.5)' }}></span>
            <span>Available</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#fbbf24', boxShadow: '0 0 6px rgba(251, 191, 36, 0.5)' }}></span>
            <span>Segment Reused (Free for leg)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f87171' }}></span>
            <span>Leg Occupied</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-cyan))' }}></span>
            <span>Selected</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ position: 'relative', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
              <Sparkles size={12} />
            </div>
            <span>Window Seat (+{coachSeats[0]?.windowSurcharge ?? 100} LKR)</span>
          </div>
        </div>
      </div>

      {/* Coach Selection Selector */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '20px' }}>
        {reservedCoaches.map((c) => {
          const coachSeatCount = seats.filter((s) => s.coachId === c.id);
          const availCount = coachSeatCount.filter((s) => s.isAvailableForRequestedLeg).length;
          const isSelected = c.id === activeCoachId;

          return (
            <button
              key={c.id}
              onClick={() => setActiveCoachId(c.id)}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid var(--glass-border)',
                background: isSelected ? 'rgba(0, 242, 254, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                color: isSelected ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                textAlign: 'left',
                minWidth: '160px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-main)' }}>
                {c.name}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '2px', display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <span>{c.classType.replace('_', ' ')}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {getCoachFare(c.classType) !== null ? `LKR ${getCoachFare(c.classType)?.toFixed(2)}` : 'Loading price...'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span />
                <span style={{ color: availCount > 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600 }}>
                  {availCount} free
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sold Out & Waitlist Banner */}
      {!hasAnyAvailableSeat && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle color="var(--accent-rose)" size={24} />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>Direct Reserved Seats Sold Out</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                All direct reserved seats are booked for this leg. Check mixed-ticket suggestions below or join the waitlist.
              </div>
            </div>
          </div>
          <button className="btn-secondary" onClick={onOpenWaitlist}>
            Join Waitlist
          </button>
        </div>
      )}

      {/* Physical Coach Layout Simulation */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--glass-border)',
        position: 'relative',
      }}>
        {/* Locomotive Direction Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '10px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            🚂 Locomotive Front (Facing Badulla Direction)
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-teal)' }}>
            {activeCoach?.name} ({activeCoach?.classType})
          </span>
        </div>

        {/* Seat Grid */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxWidth: '540px',
          margin: '0 auto',
        }}>
          {seatRows.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
              {row.map((seat, seatIndex) => {
                const isSelected = selectedSeats.some((selected) => selected.seatId === seat.seatId);
                const isOccupiedOnLeg = !seat.isAvailableForRequestedLeg;
                const isPartialUsedOtherLeg = seat.occupiedIntervals.length > 0 && !isOccupiedOnLeg;

                let buttonClass = 'seat-button seat-available';
                if (isSelected) buttonClass = 'seat-button seat-selected';
                else if (isOccupiedOnLeg) buttonClass = 'seat-button seat-occupied';
                else if (isPartialUsedOtherLeg) buttonClass = 'seat-button seat-partial';

                return (
                  <React.Fragment key={seat.seatId}>
                    {seatIndex === aisleAfter && (
                      <div style={{ width: '40px' }} />
                    )}
                    <div style={{ position: 'relative', flex: 1, maxWidth: '64px' }}>
                      <button
                        className={buttonClass}
                        onClick={() => !isOccupiedOnLeg && onSelectSeat(seat)}
                        onMouseEnter={() => setHoveredSeatId(seat.seatId)}
                        onMouseLeave={() => setHoveredSeatId(null)}
                        disabled={isOccupiedOnLeg}
                        style={{
                          width: '100%',
                          ...(seat.isWindowSeat ? { borderColor: 'var(--accent-cyan)', borderWidth: '2px' } : {})
                        }}
                      >
                        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <Armchair size={16} />
                          {seat.isWindowSeat && (
                            <div style={{ position: 'absolute', top: '-6px', right: '-8px', color: 'var(--accent-cyan)' }}>
                              <Sparkles size={10} />
                            </div>
                          )}
                        </div>
                        <span style={{ display: 'block', textAlign: 'center', marginTop: '4px' }}>
                          {seat.seatNumber.split('-')[1]}
                        </span>
                      </button>

                      {/* Segment Occupancy Hover Tooltip */}
                      {hoveredSeatId === seat.seatId && (
                        <div className="tooltip-box" style={{ width: '220px', left: '50%', transform: 'translateX(-50%)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                            Seat {seat.seatNumber} ({seat.coachName}) {seat.isWindowSeat && '🌟 Window'}
                          </div>
                          {seat.isWindowSeat && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-teal)', marginBottom: '4px' }}>
                              +{seat.windowSurcharge ?? 100} LKR Surcharge
                            </div>
                          )}
                          {seat.occupiedIntervals.length === 0 ? (
                            <div style={{ color: 'var(--accent-emerald)' }}>✨ Completely Unbooked across entire line</div>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Occupied Legs:</div>
                              {seat.occupiedIntervals.map((occ, idx) => (
                                <div key={idx} style={{ color: 'var(--accent-amber)', fontSize: '0.72rem' }}>
                                  • {getStationName(occ.startSeq)} → {getStationName(occ.endSeq)}
                                </div>
                              ))}
                              {isPartialUsedOtherLeg && (
                                <div style={{ color: 'var(--accent-emerald)', marginTop: '4px', fontWeight: 600 }}>
                                  ✅ Available for your leg!
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ))}
        </div>

        {/* Coach Corridor Aisle indicator */}
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          ── Central Passenger Aisle ──
        </div>
      </div>
    </div>
  );
};
