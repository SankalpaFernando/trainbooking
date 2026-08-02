import React, { useState, useEffect } from 'react';
import { Station, Coach, SeatGapSummary, AvailabilityResponseData, MixedTicketRecommendation, Booking } from './types';
import { ApiService } from './services/api';
import { Header } from './components/Header';
import { SearchPanel } from './components/SearchPanel';
import { InteractiveSeatMap } from './components/InteractiveSeatMap';
import { MixedTicketCard } from './components/MixedTicketCard';
import { CheckoutModal } from './components/CheckoutModal';
import { EReceiptModal } from './components/EReceiptModal';
import { WaitlistModal } from './components/WaitlistModal';
import { AdminDashboard } from './components/AdminDashboard';
import { PNRLookup } from './components/PNRLookup';
import { Train, ArrowRight } from 'lucide-react';

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
  const [selectedSeat, setSelectedSeat] = useState<SeatGapSummary | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

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
    setSelectedSeat(null);
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

  // Handle direct seat selection
  const handleSelectSeat = (seat: SeatGapSummary) => {
    setSelectedSeat(seat);
    setShowCheckoutModal(true);
  };

  // Handle multi-leg ticket selection
  const handleSelectMixedTicket = (rec: MixedTicketRecommendation) => {
    if (rec.legs.length > 0) {
      const firstLeg = rec.legs[0];
      const matchingSeatSummary = availability?.seats.find((s) => s.seatId === firstLeg.seatId);
      if (matchingSeatSummary) {
        setSelectedSeat(matchingSeatSummary);
        setShowCheckoutModal(true);
      }
    }
  };

  const handleBookingSuccess = (booking: Booking) => {
    setShowCheckoutModal(false);
    setConfirmedBooking(booking);
    setShowReceiptModal(true);
    handleSearch(); // Refresh availability grid
  };

  const originStation = stations.find((s) => s.id === originId) || stations[0];
  const destStation = stations.find((s) => s.id === destinationId) || stations[7];

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
              selectedSeat={selectedSeat}
              onSelectSeat={handleSelectSeat}
              stations={stations}
              originId={originId}
              destinationId={destinationId}
              onOpenWaitlist={() => setShowWaitlistModal(true)}
            />
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
      {activeTab === 'admin' && <AdminDashboard date={date} />}

      {/* Checkout Modal */}
      {showCheckoutModal && selectedSeat && originStation && destStation && (
        <CheckoutModal
          seat={selectedSeat}
          originStation={originStation}
          destinationStation={destStation}
          date={date}
          onClose={() => setShowCheckoutModal(false)}
          onSuccess={handleBookingSuccess}
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
