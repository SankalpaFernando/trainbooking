import React, { useState, useEffect } from 'react';
import { useTheme } from './hooks/useTheme';
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
import { TicketCheckerPortal } from './components/TicketCheckerPortal';
import { Train, ArrowRight, Lock, ScanLine } from 'lucide-react';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'booking' | 'admin' | 'my-tickets' | 'checker' | 'login'>('booking');

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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bookingLimits, setBookingLimits] = useState<{ start?: string; end?: string }>({});

  // Selection & Modal states
  const [selectedSeats, setSelectedSeats] = useState<SeatGapSummary[]>([]);
  const [selectedMixedTicket, setSelectedMixedTicket] = useState<MixedTicketRecommendation | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [showMixedCheckoutModal, setShowMixedCheckoutModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState<boolean>(false);
  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean>(false);
  const [checkerLoggedIn, setCheckerLoggedIn] = useState<boolean>(false);
  const [checkerUsername, setCheckerUsername] = useState<string>('');
  
  const [loginRole, setLoginRole] = useState<'admin' | 'checker'>('admin');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const storedAuth = localStorage.getItem('adminAuth');
    if (storedAuth) {
      setAdminLoggedIn(true);
      setActiveTab('admin');
    }
    const storedCheckerToken = localStorage.getItem('checkerToken');
    const storedCheckerUser = localStorage.getItem('checkerUsername');
    if (storedCheckerToken && storedCheckerUser) {
      setCheckerLoggedIn(true);
      setCheckerUsername(storedCheckerUser);
      setActiveTab('checker');
    }
  }, []);

  // 1. Initial Load: Fetch stations and coaches
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [stList, chList, settingsData] = await Promise.all([
          ApiService.getStations(),
          ApiService.getCoaches(),
          ApiService.getSettings().catch(() => ({})), // Non-fatal if fails
        ]);
        setStations(stList);
        setCoaches(chList);
        const bookingWindowDays = parseInt(settingsData['bookingWindowDays'], 10) || 30; // default to 30
        const today = new Date();
        const maxDateObj = new Date(today.setDate(today.getDate() + bookingWindowDays));
        const start = new Date().toISOString().split('T')[0];
        const end = maxDateObj.toISOString().split('T')[0];
        
        setBookingLimits({ start, end });
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
    setSearchError(null);
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
      setSearchError(e.message || 'Failed to fetch seats');
    } finally {
      setLoading(false);
    }
  };

  // Hide map when search parameters change
  const handleSetOriginId = (id: number) => {
    setOriginId(id);
    setAvailability(null);
    setMixedTickets([]);
    setSelectedSeats([]);
    setSearchError(null);
  };

  const handleSetDestinationId = (id: number) => {
    setDestinationId(id);
    setAvailability(null);
    setMixedTickets([]);
    setSelectedSeats([]);
    setSearchError(null);
  };

  const handleSetDate = (d: string) => {
    setDate(d);
    setAvailability(null);
    setMixedTickets([]);
    setSelectedSeats([]);
    setSearchError(null);
  };

  // Swap origin and destination
  const handleSwapStations = () => {
    const tmpOrigin = originId;
    setOriginId(destinationId);
    setDestinationId(tmpOrigin);
    setAvailability(null);
    setMixedTickets([]);
    setSelectedSeats([]);
    setSearchError(null);
  };



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
      setConfirmedBookings(bookings);
      setShowReceiptModal(true);
    }
    handleSearch(); // Refresh availability grid
  };

  const originStation = stations.find((s) => s.id === originId) || stations[0];
  const destStation = stations.find((s) => s.id === destinationId) || stations[7];

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      if (loginRole === 'admin') {
        await ApiService.adminLogin(loginUser.trim(), loginPass);
        setAdminLoggedIn(true);
        setActiveTab('admin');
      } else {
        const res = await ApiService.checkerLogin(loginUser.trim(), loginPass);
        localStorage.setItem('checkerToken', res.token);
        localStorage.setItem('checkerUsername', res.username);
        setCheckerLoggedIn(true);
        setCheckerUsername(res.username);
        setActiveTab('checker');
      }
      setLoginUser('');
      setLoginPass('');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('checkerToken');
    localStorage.removeItem('checkerUsername');
    setAdminLoggedIn(false);
    setCheckerLoggedIn(false);
    setCheckerUsername('');
    setActiveTab('booking');
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 20px 60px 20px' }}>
      
      {/* Top Header */}
      <Header 
        activeTab={activeTab as any} 
        setActiveTab={setActiveTab as any} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        adminLoggedIn={adminLoggedIn}
        checkerLoggedIn={checkerLoggedIn}
        onLogout={handleLogout}
      />

      {/* Main Content Areas */}
      {activeTab === 'booking' && (
        <main>
          {/* Search Panel */}
          <SearchPanel
            stations={stations}
            originId={originId}
            setOriginId={handleSetOriginId}
            destinationId={destinationId}
            setDestinationId={handleSetDestinationId}
            date={date}
            setDate={handleSetDate}
            fareEstimate={availability?.fareEstimate}
            onSearch={handleSearch}
            onSwapStations={handleSwapStations}
            loading={loading}
            minDate={bookingLimits.start}
            maxDate={bookingLimits.end}
          />

          {searchError && (
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px', border: '1px solid rgba(244, 63, 94, 0.4)' }}>
              <div style={{ color: 'var(--accent-rose)', fontSize: '1.2rem', fontWeight: 600, marginBottom: '8px' }}>
                Oops! Something went wrong
              </div>
              <p style={{ color: 'var(--text-muted)' }}>{searchError}</p>
            </div>
          )}

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

      {/* Staff Login Tab */}
      {activeTab === 'login' && !adminLoggedIn && !checkerLoggedIn && (
        <div className="glass-card" style={{ padding: '32px', maxWidth: '420px', margin: '24px auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Lock size={20} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Staff Login</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Enter your credentials to access the staff portal.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button 
              className={loginRole === 'admin' ? 'btn-primary' : 'btn-secondary'} 
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setLoginRole('admin')}
            >
              Admin
            </button>
            <button 
              className={loginRole === 'checker' ? 'btn-primary' : 'btn-secondary'} 
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setLoginRole('checker')}
            >
              Ticket Checker
            </button>
          </div>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              aria-label="Username"
              className="input-field"
              placeholder="Username"
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              required
            />
            <input
              aria-label="Password"
              className="input-field"
              type="password"
              placeholder="Password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              required
            />
            {loginError && <div aria-live="polite" style={{ color: '#f87171', fontSize: '0.85rem' }}>{loginError}</div>}
            <button className="btn-primary" type="submit" style={{ justifyContent: 'center' }}>Login</button>
          </form>
        </div>
      )}

      {/* Department Admin Analytics Tab */}
      {activeTab === 'admin' && adminLoggedIn && (
        <div>
          <AdminDashboard />
        </div>
      )}

      {/* Ticket Checker Portal */}
      {activeTab === 'checker' && checkerLoggedIn && (
        <TicketCheckerPortal username={checkerUsername} />
      )}

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
          onSuccess={(confirmed) => {
            setShowMixedCheckoutModal(false);
            setSelectedMixedTicket(null);
            if (confirmed.length > 0) {
              setConfirmedBookings(confirmed);
              setShowReceiptModal(true);
            }
            handleSearch();
          }}
        />
      )}

      {/* E-Receipt Modal */}
      {showReceiptModal && confirmedBookings.length > 0 && (
        <EReceiptModal
          bookings={confirmedBookings}
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
