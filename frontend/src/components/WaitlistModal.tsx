import React, { useState } from 'react';
import { Station } from '../types';
import { ApiService } from '../services/api';
import { Clock, User, Phone, ShieldCheck, X, CheckCircle } from 'lucide-react';

interface WaitlistModalProps {
  originStation: Station;
  destinationStation: Station;
  date: string;
  onClose: () => void;
}

export const WaitlistModal: React.FC<WaitlistModalProps> = ({
  originStation,
  destinationStation,
  date,
  onClose,
}) => {
  const [guestName, setGuestName] = useState('');
  const [guestNic, setGuestNic] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await ApiService.addToWaitlist({
        date,
        startStationId: originStation.id,
        endStationId: destinationStation.id,
        guestName,
        guestNic,
        guestMobile,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to join waitlist');
    } finally {
      setLoading(false);
    }
  };

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
      zIndex: 100,
      padding: '20px',
    }}>
      <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '28px', position: 'relative' }}>
        
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

        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Clock size={22} />
          Segment Waitlist Registration
        </h2>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Get instantly notified via SMS if a passenger cancels or disembarks early on <strong>{originStation.name} → {destinationStation.name}</strong>.
        </p>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle size={48} color="var(--accent-emerald)" style={{ margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
              Added to Priority Waitlist!
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              We will send an SMS to <strong>{guestMobile}</strong> as soon as a segment seat opens up.
            </p>
            <button className="btn-primary" style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }} onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ color: '#f87171', fontSize: '0.84rem', marginBottom: '14px' }}>{error}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ruwan Silva"
                  className="input-field"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  NIC Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 910284910V"
                  className="input-field"
                  value={guestNic}
                  onChange={(e) => setGuestNic(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Mobile Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +94771122334"
                  className="input-field"
                  value={guestMobile}
                  onChange={(e) => setGuestMobile(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Registering...' : 'Join Priority Waitlist'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
