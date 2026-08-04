import React from 'react';
import { MixedTicketRecommendation, Station } from '../types';
import { Sparkles, ArrowRight, Shuffle, CheckCircle } from 'lucide-react';

interface MixedTicketCardProps {
  recommendations: MixedTicketRecommendation[];
  stations: Station[];
  onSelectMixedTicket: (rec: MixedTicketRecommendation) => void;
}

export const MixedTicketCard: React.FC<MixedTicketCardProps> = ({
  recommendations,
  stations,
  onSelectMixedTicket,
}) => {
  if (recommendations.length === 0) return null;

  const getStationName = (seq: number) => {
    const st = stations.find((s) => s.sequenceNumber === seq);
    return st ? st.name : `Seq ${seq}`;
  };

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #a855f7, #ec4899)',
          padding: '8px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Sparkles size={20} color="#fff" />
        </div>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Smart Multi-Leg Seat Hop Recommendations
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            No single physical seat available for your entire trip? Travel seamlessly by transferring seats at intermediate stations!
          </p>
        </div>
      </div>

      <div style={{ display: 'grid',gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '14px',
              padding: '18px',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="badge badge-partial" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Shuffle size={12} />
                  {rec.totalLegs}-Seat Hop Transfer
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                  LKR {rec.totalFare.toFixed(2)}
                </span>
              </div>

              {/* Legs list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {rec.legs.map((leg, legIdx) => (
                  <div
                    key={legIdx}
                    style={{
                      background: 'rgba(0, 0, 0, 0.04)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        Leg {legIdx + 1}: Seat {leg.seatNumber} ({leg.coachName})
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                        {getStationName(leg.startStationSeq)} → {getStationName(leg.endStationSeq)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      LKR {leg.fare.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              onClick={() => onSelectMixedTicket(rec)}
            >
              <CheckCircle size={16} />
              Book Multi-Leg Ticket
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
