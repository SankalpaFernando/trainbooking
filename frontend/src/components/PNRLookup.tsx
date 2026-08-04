import React, { useState } from 'react';
import { Booking } from '../types';
import { ApiService } from '../services/api';
import { Search, ShieldCheck, Ticket, AlertCircle } from 'lucide-react';
import { EReceiptModal } from './EReceiptModal';

export const PNRLookup: React.FC = () => {
  const [pnrInput, setPnrInput] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnrInput.trim()) return;

    setLoading(true);
    setError(null);
    setBooking(null);

    try {
      const res = await ApiService.lookupPNR(pnrInput.trim().toUpperCase());
      setBooking(res);
    } catch (err: any) {
      setError(err.message || 'PNR not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '32px', maxWidth: '640px', margin: '0 auto',marginTop:'20px'  }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <ShieldCheck size={24} />
        PNR Ticket Verification & Lookup
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
        Enter your 8-character booking reference number (e.g. <strong>SLR-DEMO-01</strong> or <strong>SLR-DEMO-02</strong>) to verify your segment reservation and download your E-Receipt.
      </p>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input
          type="text"
          required
          placeholder="Enter PNR (e.g. SLR-DEMO-01)"
          className="input-field"
          value={pnrInput}
          onChange={(e) => setPnrInput(e.target.value)}
          style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}
        />
        <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0 24px', flexShrink: 0 }}>
          <Search size={18} />
          {loading ? 'Searching...' : 'Find Ticket'}
        </button>
      </form>

      {error && (
        <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', color: '#f87171', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {booking && (
        <div style={{ background: 'rgba(0, 0, 0, 0.05)', borderRadius: '14px', padding: '20px', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
            <span className="badge badge-available">VALID RESERVATION</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PNR: <strong style={{ color: 'var(--accent-cyan)' }}>{booking.pnr}</strong></span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem', marginBottom: '16px' }}>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>PASSENGER</span>
              <div style={{ fontWeight: 700 }}>{booking.guestName}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>STATUS</span>
              <div style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{booking.status}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>ROUTE</span>
              <div style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>{booking.startStation?.name} → {booking.endStation?.name}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>SEAT</span>
              <div style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>Seat {booking.seat?.seatNumber} ({booking.seat?.coach?.name})</div>
            </div>
          </div>

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowReceiptModal(true)}>
            <Ticket size={16} />
            View & Download E-Receipt
          </button>
        </div>
      )}

      {showReceiptModal && booking && (
        <EReceiptModal booking={booking} onClose={() => setShowReceiptModal(false)} />
      )}
    </div>
  );
};
