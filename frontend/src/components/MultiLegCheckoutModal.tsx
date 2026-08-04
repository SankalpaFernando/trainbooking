import React, { useState, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { MixedTicketRecommendation, Station, Booking } from '../types';
import { ApiService } from '../services/api';
import { isValidSriLankanNic, isValidSriLankanPhone } from '../utils/validation';
import { ShieldCheck, Clock, User, Phone, X, AlertCircle } from 'lucide-react';

interface MultiLegCheckoutModalProps {
  recommendation: MixedTicketRecommendation;
  stations: Station[];
  date: string;
  onClose: () => void;
  onSuccess: (bookings: Booking[]) => void;
}

const getStationName = (stations: Station[], seq: number) => {
  const st = stations.find((s) => s.sequenceNumber === seq);
  return st ? st.name : `Seq ${seq}`;
};

export const MultiLegCheckoutModal: React.FC<MultiLegCheckoutModalProps> = ({
  recommendation,
  stations,
  date,
  onClose,
  onSuccess,
}) => {
  const [guestName, setGuestName] = useState('');
  const [guestNic, setGuestNic] = useState('');
  const [guestMobile, setGuestMobile] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdBookings, setHoldBookings] = useState<Booking[] | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300);

  const totalFare = recommendation.totalFare;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (holdBookings) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [holdBookings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!isValidSriLankanNic(guestNic)) {
      setError('Please enter a valid NIC number or passport ID.');
      setLoading(false);
      return;
    }

    if (!isValidSriLankanPhone(guestMobile)) {
      setError('Please enter a valid Sri Lankan mobile number, e.g. +94771234567 or 0771234567.');
      setLoading(false);
      return;
    }

    if (!captchaToken) {
      setError('Please complete the reCAPTCHA before booking.');
      setLoading(false);
      return;
    }

    try {
      const legs = recommendation.legs.map((leg) => ({
        seatId: leg.seatId,
        startStationId: stations.find((s) => s.sequenceNumber === leg.startStationSeq)?.id,
        endStationId: stations.find((s) => s.sequenceNumber === leg.endStationSeq)?.id,
      }));

      if (legs.some((leg) => !leg.startStationId || !leg.endStationId)) {
        throw new Error('Unable to resolve station IDs for one or more legs.');
      }

      const bookings = await ApiService.createHoldMultiBooking({
        date,
        legs: legs as Array<{ seatId: number; startStationId: number; endStationId: number }> ,
        guestName,
        guestNic,
        guestMobile,
        captchaToken,
      });

      setHoldBookings(bookings);
      setTimeLeft(300);
    } catch (err: any) {
      setError(err.message || 'Failed to place multi-leg hold');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!holdBookings || holdBookings.length === 0) return;
    setError(null);
    setLoading(true);

    try {
      const confirmed = await ApiService.confirmMultiBooking(holdBookings.map((booking) => booking.pnr));
      onSuccess(confirmed);
    } catch (err: any) {
      setError(err.message || 'Failed to confirm multi-leg booking');
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'var(--overlay-dark)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div className="glass-card" role="dialog" aria-modal="true" aria-labelledby="multileg-modal-title" style={{ maxWidth: '580px', width: '100%', padding: '28px', position: 'relative' }}>
        <button
          onClick={onClose}
          aria-label="Close checkout modal"
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

        <h2 id="multileg-modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={24} /> Multi-Leg Ticket Checkout
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Book all legs in one flow. Each leg will be placed on hold, and the booking will complete together.
        </p>

        {error && (
          <div style={{
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div style={{
          background: 'var(--overlay-bg)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid var(--glass-border)',
          marginBottom: '20px',
        }}>
          <div style={{ marginBottom: '12px', fontWeight: 700 }}>Booking Summary</div>
          {recommendation.legs.map((leg, index) => (
            <div key={index} style={{ marginBottom: '10px', fontSize: '0.9rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>Leg {index + 1}</div>
              <div>{getStationName(stations, leg.startStationSeq)} → {getStationName(stations, leg.endStationSeq)}</div>
              <div>{leg.coachName} Seat {leg.seatNumber}</div>
              <div>LKR {leg.fare.toFixed(2)}</div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--overlay-border)', paddingTop: '12px', marginTop: '12px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
            Total: LKR {totalFare.toFixed(2)}
          </div>
        </div>

        {!holdBookings ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label htmlFor="guestName" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                <User size={14} style={{ display: 'inline', marginRight: '4px' }} /> Full Passenger Name
              </label>
              <input
                id="guestName"
                type="text"
                required
                placeholder="e.g. Kasun Fernando"
                className="input-field"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="guestNic" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px' }} /> NIC Number or Passport ID
              </label>
              <input
                id="guestNic"
                type="text"
                required
                placeholder="e.g. 921840291V"
                className="input-field"
                value={guestNic}
                onChange={(e) => setGuestNic(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="guestMobile" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                <Phone size={14} style={{ display: 'inline', marginRight: '4px' }} /> Mobile Number
              </label>
              <input
                id="guestMobile"
                type="tel"
                required
                placeholder="e.g. +94771234567"
                className="input-field"
                value={guestMobile}
                onChange={(e) => setGuestMobile(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <ReCAPTCHA
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                onChange={(value) => setCaptchaToken(value || '')}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
              disabled={loading}
            >
              {loading ? 'Booking Multi-Leg Hold...' : 'Book Multi-Leg Ticket'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{
              background: 'rgba(22, 163, 74, 0.08)',
              border: '1px solid rgba(22, 163, 74, 0.25)',
              borderRadius: '12px',
              padding: '16px',
            }}>
              <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--accent-emerald)' }}>Hold Placed Successfully</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Your multi-leg journey hold is active for <strong>{formatTimer(timeLeft)}</strong>.
              </div>
            </div>

            <div style={{
              background: 'var(--overlay-bg)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid var(--glass-border)',
            }}>
              <div style={{ marginBottom: '12px', fontWeight: 700 }}>Held Legs</div>
              {holdBookings.map((booking, index) => (
                <div key={booking.pnr} style={{ marginBottom: '12px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700 }}>PNR {index + 1}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{booking.pnr}</span>
                  </div>
                  <div>{booking.startStation.name} → {booking.endStation.name}</div>
                  <div>{booking.seat.seatNumber} ({booking.seat.coach.name})</div>
                  <div style={{ fontWeight: 700, marginTop: '4px' }}>Fare: LKR {booking.totalFare.toFixed(2)}</div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
              onClick={handleConfirmPayment}
              disabled={loading || timeLeft === 0}
            >
              {loading ? 'Confirming Multi-Leg Booking...' : 'Confirm Payment for All Legs'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
