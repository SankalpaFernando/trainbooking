import React, { useState, useEffect } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { SeatGapSummary, Station, Booking } from '../types';
import { ApiService } from '../services/api';
import { isValidSriLankanNic, isValidSriLankanPhone } from '../utils/validation';
import { Clock, CreditCard, User, CreditCard as CardIcon, Phone, ShieldCheck, X, AlertCircle } from 'lucide-react';

interface CheckoutModalProps {
  seats: SeatGapSummary[];
  originStation: Station;
  destinationStation: Station;
  date: string;
  onClose: () => void;
  onSuccess: (bookings: Booking[]) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  seats,
  originStation,
  destinationStation,
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

  // Hold reservation state & 300-second (5 min) timer
  const [holdBookings, setHoldBookings] = useState<Booking[] | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300);

  const getLegFare = (seat: SeatGapSummary) => {
    const baseFare = 100;
    const ratePerStation = 50;
    const stationsTraversed = Math.abs(destinationStation.sequenceNumber - originStation.sequenceNumber);
    const multiplier = seat.classType === 'FIRST_CLASS' ? 1.5 : seat.classType === 'SECOND_CLASS' ? 1.2 : 1;
    return Math.round((baseFare + stationsTraversed * ratePerStation * multiplier) * 100) / 100;
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (holdBookings) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setError('Reservation hold expired! Seat released back to pool.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [holdBookings]);

  const handleInitiateHold = async (e: React.FormEvent) => {
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
      const bookings = await ApiService.createHoldMultiBooking({
        date,
        legs: seats.map((seat) => ({
          seatId: seat.seatId,
          startStationId: originStation.id,
          endStationId: destinationStation.id,
        })),
        guestName,
        guestNic,
        guestMobile,
        captchaToken,
      });

      setHoldBookings(bookings);
    } catch (err: any) {
      setError(err.message || 'Failed to place seat hold reservation');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!holdBookings || holdBookings.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const confirmed = await ApiService.confirmMultiBooking(holdBookings.map((booking) => booking.pnr));
      onSuccess(confirmed);
    } catch (err: any) {
      setError(err.message || 'Payment confirmation failed');
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
      background: 'rgba(4, 16, 30, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '28px', position: 'relative' }}>
        
        {/* Close button */}
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

        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={24} />
          Express Guest Checkout
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Sri Lanka Railways Segment Booking Engine
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

        {/* Step 1: Passenger Form */}
{!holdBookings ? (
          <form onSubmit={handleInitiateHold}>
            
            {/* Ticket Summary Box */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>ROUTE:</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {originStation.name} → {destinationStation.name}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>SEATS:</span>
                <span style={{ fontWeight: 700 }}>
                  {seats.map((seat) => seat.seatNumber).join(', ')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>TRAVEL DATE:</span>
                <span style={{ fontWeight: 700 }}>{date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>TOTAL FARE:</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>
                  LKR {seats.reduce((sum, seat) => sum + getLegFare(seat), 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Passenger Input Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  <User size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Full Passenger Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kasun Fernando"
                  className="input-field"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  <ShieldCheck size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  NIC Number or Passport ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 921840291V"
                  className="input-field"
                  value={guestNic}
                  onChange={(e) => setGuestNic(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  <Phone size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  Mobile Number (SMS Receipt)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +94771234567"
                  className="input-field"
                  value={guestMobile}
                  onChange={(e) => setGuestMobile(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <ReCAPTCHA
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                onChange={(value) => setCaptchaToken(value || '')}
                onExpired={() => setCaptchaToken('')}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              disabled={loading}
            >
              {loading ? 'Reserving Seat Hold...' : 'Lock Seat & Proceed to Payment'}
            </button>
          </form>
        ) : (
          /* Step 2: Payment & Hold Countdown */
          <div>
            {/* Hold Expiry Countdown Bar */}
            <div style={{
              background: timeLeft < 60 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${timeLeft < 60 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '20px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Clock size={16} />
                Seat Reserved Temporarily! Complete Payment Within:
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: timeLeft < 60 ? '#f87171' : 'var(--accent-emerald)', marginTop: '4px' }}>
                {formatTimer(timeLeft)}
              </div>
            </div>

            {/* PNR Hold Summary */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              marginBottom: '20px',
              fontSize: '0.88rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Held Bookings:</span>
                <span style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>{holdBookings.length} PNR{holdBookings.length > 1 ? 's' : ''}</span>
              </div>
              <div style={{ marginBottom: '12px' }}>
                {holdBookings.map((booking, idx) => (
                  <div key={booking.pnr} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>PNR {idx + 1}:</span>
                    <span style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>{booking.pnr}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Passenger:</span>
                <span style={{ fontWeight: 600 }}>{holdBookings[0]?.guestName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Payable:</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-emerald)' }}>
                  LKR {holdBookings.reduce((sum, booking) => sum + booking.totalFare, 0).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handleConfirmPayment}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem' }}
              disabled={loading || timeLeft === 0}
            >
              <CreditCard size={20} />
              {loading ? 'Processing Payment...' : 'Pay Now & Issue E-Ticket'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
