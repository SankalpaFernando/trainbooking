import React, { useState, useEffect } from 'react';
import { Station, Coach, SeatGapSummary, AvailabilityResponseData, MixedTicketRecommendation, Booking } from './types';
import { ApiService } from './services/api';
import { Header } from './components/Header';
import { SearchPanel } from './components/SearchPanel';
import { InteractiveSeatMap } from './components/InteractiveSeatMap';
import { MixedTicketCard } from './components/MixedTicketCard';
import { CheckoutModal } from './components/CheckoutModal';
import { MultiLegCheckoutModal } from './components/MultiLegCheckoutModal';
import { EReceiptModal } from './components/EReceiptModal';
import { WaitlistModal } from './components/WaitlistModal';
import { AdminDashboard } from './components/AdminDashboard';
import { PNRLookup } from './components/PNRLookup';
import { Train, ArrowRight, Lock } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'booking' | 'admin' | 'my-tickets'>('booking');

  // Master data state
  const [stations, setStations] = useState<Station[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);

  // Search parameters
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState<string>(todayStr);
  const [originId, setOriginId] = useState<number>(1);
  const [destinationId, setDestinationId] = useState<number>(8);

  // Search results state
  const [availability, setAvailability] = useState<AvailabilityResponseData | null>(null);
  const [mixedTickets, setMixedTickets] = useState<MixedTicketRecommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Selection & Modal states
  const [selectedSeats, setSelectedSeats] = useState<SeatGapSummary[]>([]);
  const [selectedMixedTicket, setSelectedMixedTicket] = useState<MixedTicketRecommendation | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [showMixedCheckoutModal, setShowMixedCheckoutModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    const storedAuth = localStorage.getItem('adminAuth');
    if (storedAuth) {
      setAdminLoggedIn(true);
    }
  }, []);

  // 1. Initial Load: Fetch stations and coaches
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [stList, chList] = await Promise.all([
          ApiService.getStations(),
          ApiService.getCoaches(),
        ]);
        setStations(stList);
        setCoaches(chList);
        if (stList.length >= 8) {
          setOriginId(stList[0].id); // Colombo Fort
          setDestinationId(stList[7].id); // Kandy
        }
      } catch (e) {
        console.error('Error loading master data:', e);
      }
    }
    loadMasterData();
  }, []);

  // 2. Perform Seat Search
  const handleSearch = async () => {
    if (!originId || !destinationId || originId === destinationId) {
      alert('Please select distinct Origin and Destination stations');
      return;
    }
    setLoading(true);
    setSelectedSeats([]);
    try {
      const [availData, mixedData] = await Promise.all([
        ApiService.getSeatsAvailability(date, originId, destinationId),
        ApiService.getMixedTickets(date, originId, destinationId),
      ]);
      setAvailability(availData);
      setMixedTickets(mixedData);
    } catch (e: any) {
      console.error('Error fetching seat availability:', e);
    } finally {
      setLoading(false);
    }
  };

  // Trigger search when master stations load
  useEffect(() => {
    if (stations.length > 0) {
      handleSearch();
    }
  }, [stations]);

  // Handle direct seat selection toggles multi-seat selection
  const handleSelectSeat = (seat: SeatGapSummary) => {
    setSelectedSeats((current) => {
      const exists = current.some((s) => s.seatId === seat.seatId);
      if (exists) {
        return current.filter((s) => s.seatId !== seat.seatId);
      }
      return [...current, seat];
    });
  };

  // Handle multi-leg ticket selection
  const handleSelectMixedTicket = (rec: MixedTicketRecommendation) => {
    setSelectedMixedTicket(rec);
    setShowMixedCheckoutModal(true);
  };

  const handleBookingSuccess = (bookings: Booking[]) => {
    setShowCheckoutModal(false);
    setSelectedSeats([]);
    if (bookings.length > 0) {
      setConfirmedBooking(bookings[0]);
      setShowReceiptModal(true);
    }
    handleSearch(); // Refresh availability grid
  };

  const originStation = stations.find((s) => s.id === originId) || stations[0];
  const destStation = stations.find((s) => s.id === destinationId) || stations[7];

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = adminUsername.trim();
    const password = adminPassword;

    try {
      await ApiService.adminLogin(username, password);
      setAdminLoggedIn(true);
      setAdminError('');
      setAdminPassword('');
      setAdminUsername('');
    } catch (err: any) {
      setAdminError(err.message || 'Login failed');
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminAuth');
    setAdminLoggedIn(false);
    setAdminError('');
    setActiveTab('booking');
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 20px 60px 20px' }}>
      
      {/* Top Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Areas */}
      {activeTab === 'booking' && (
        <main>
          {/* Search Panel */}
          <SearchPanel
            stations={stations}
            originId={originId}
            setOriginId={setOriginId}
            destinationId={destinationId}
            setDestinationId={setDestinationId}
            date={date}
            setDate={setDate}
            fareEstimate={availability?.fareEstimate}
            onSearch={handleSearch}
            loading={loading}
          />

          {/* Interactive Seat Map */}
          {availability && (
            <InteractiveSeatMap
              coaches={coaches}
              seats={availability.seats}
              fareEstimate={availability.fareEstimate}
              selectedSeats={selectedSeats}
              onSelectSeat={handleSelectSeat}
              stations={stations}
              originId={originId}
              destinationId={destinationId}
              onOpenWaitlist={() => setShowWaitlistModal(true)}
            />
          )}

          {/* Booking Action Bar */}
          {selectedSeats.length > 0 && (
            <div className="glass-card" style={{ padding: '20px', marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 auto' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>{selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''} selected</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Review your selection then proceed to checkout. You can select multiple available seats and book them together.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn-primary" type="button" onClick={() => setShowCheckoutModal(true)}>
                  Checkout Selected Seat{selectedSeats.length > 1 ? 's' : ''}
                </button>
                <button className="btn-secondary" type="button" onClick={() => setSelectedSeats([])}>
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Mixed Ticket Recommendations */}
          <MixedTicketCard
            recommendations={mixedTickets}
            stations={stations}
            onSelectMixedTicket={handleSelectMixedTicket}
          />
        </main>
      )}

      {/* PNR Lookup Tab */}
      {activeTab === 'my-tickets' && <PNRLookup />}

      {/* Department Admin Analytics Tab */}
      {activeTab === 'admin' && !adminLoggedIn ? (
        <div className="glass-card" style={{ padding: '32px', maxWidth: '420px', margin: '24px auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Lock size={20} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Admin Login</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Enter your admin credentials to access the dashboard.
          </p>
          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              className="input-field"
              placeholder="Username"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
            />
            <input
              className="input-field"
              type="password"
              placeholder="Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
            {adminError && <div style={{ color: '#f87171', fontSize: '0.8rem' }}>{adminError}</div>}
            <button className="btn-primary" type="submit">Login</button>
          </form>
        </div>
      ) : activeTab === 'admin' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px',marginTop:'16px' }}>
            <button className="btn-secondary " onClick={handleAdminLogout}>Logout</button>
          </div>
          <AdminDashboard date={date} />
        </div>
      ) : null}

      {/* Checkout Modal */}
      {showCheckoutModal && selectedSeats.length > 0 && originStation && destStation && (
        <CheckoutModal
          seats={selectedSeats}
          originStation={originStation}
          destinationStation={destStation}
          date={date}
          onClose={() => setShowCheckoutModal(false)}
          onSuccess={handleBookingSuccess}
        />
      )}

      {showMixedCheckoutModal && selectedMixedTicket && originStation && destStation && (
        <MultiLegCheckoutModal
          recommendation={selectedMixedTicket}
          stations={stations}
          date={date}
          onClose={() => {
            setSelectedMixedTicket(null);
            setShowMixedCheckoutModal(false);
          }}
          onSuccess={(confirmedBookings) => {
            setShowMixedCheckoutModal(false);
            setSelectedMixedTicket(null);
            if (confirmedBookings.length > 0) {
              setConfirmedBooking(confirmedBookings[0]);
              setShowReceiptModal(true);
            }
            handleSearch();
          }}
        />
      )}

      {/* E-Receipt Modal */}
      {showReceiptModal && confirmedBooking && (
        <EReceiptModal
          booking={confirmedBooking}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {/* Waitlist Modal */}
      {showWaitlistModal && originStation && destStation && (
        <WaitlistModal
          originStation={originStation}
          destinationStation={destStation}
          date={date}
          onClose={() => setShowWaitlistModal(false)}
        />
      )}

    </div>
  );
};
