import React, { useState } from 'react';
import { Booking } from '../types';
import { Download, Printer, CheckCircle, Train, ShieldCheck, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface EReceiptModalProps {
  bookings: Booking[];
  onClose: () => void;
}

export const EReceiptModal: React.FC<EReceiptModalProps> = ({ bookings, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrint = () => {
    window.print();
  };

  const booking = bookings[currentIndex];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(4, 16, 30, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 110,
      padding: '20px',
    }}>
      <div className="glass-card" style={{ maxWidth: '580px', width: '100%', padding: '32px', position: 'relative', background: '#0f172a' }}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={22} />
        </button>

        {/* Printable Ticket Container */}
        <div id="printable-ticket" style={{ border: '2px dashed var(--glass-border)', padding: '24px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
          
          {/* Header Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Train size={28} color="var(--accent-cyan)" />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  SRI LANKA RAILWAYS
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Official Reserved Segment Seat E-Ticket</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-available" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={12} /> CONFIRMED
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                PNR: <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{booking.pnr}</strong>
              </div>
            </div>
          </div>

          {/* Passenger & Journey Specs */}
          <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>PASSENGER NAME</span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{booking.guestName}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>NIC / PASSPORT ID</span>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{booking.guestNic}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>ORIGIN STATION</span>
              <div style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>{booking.startStation?.name}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>DESTINATION STATION</span>
              <div style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>{booking.endStation?.name}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>TRAVEL DATE</span>
              <div style={{ fontWeight: 700 }}>{booking.date}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>RESERVED SEAT & COACH</span>
              <div style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '1rem' }}>
                Seat {booking.seat?.seatNumber} ({booking.seat?.coach?.name})
              </div>
            </div>
          </div>

          {/* QR Code & Total Barcode */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '16px',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid var(--glass-border)',
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>TOTAL PAID FARE</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                LKR {booking.totalFare.toFixed(2)}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Includes platform base + distance fee</span>
            </div>

            {/* Real QR Code */}
            <div style={{
              background: '#fff',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <QRCodeSVG value={booking.pnr} size={70} />
            </div>
          </div>

        </div>

        {/* Multi-Ticket Navigation */}
        {bookings.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '12px' }}>
            <button
              className="btn-secondary"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft size={16} /> Prev Ticket
            </button>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Ticket {currentIndex + 1} of {bookings.length}
            </div>
            <button
              className="btn-secondary"
              onClick={() => setCurrentIndex((i) => Math.min(bookings.length - 1, i + 1))}
              disabled={currentIndex === bookings.length - 1}
            >
              Next Ticket <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={handlePrint}>
            <Printer size={16} />
            Print / Save PDF
          </button>
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
