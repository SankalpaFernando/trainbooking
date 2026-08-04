import React from 'react';
import { Station, FareEstimate } from '../types';
import { MapPin, Calendar, ArrowLeftRight, DollarSign, Navigation } from 'lucide-react';

interface SearchPanelProps {
  stations: Station[];
  originId: number;
  setOriginId: (id: number) => void;
  destinationId: number;
  setDestinationId: (id: number) => void;
  date: string;
  setDate: (d: string) => void;
  fareEstimate?: FareEstimate;
  onSearch: () => void;
  onSwapStations: () => void;
  loading: boolean;
  minDate?: string;
  maxDate?: string;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  stations,
  originId,
  setOriginId,
  destinationId,
  setDestinationId,
  date,
  setDate,
  fareEstimate,
  onSearch,
  onSwapStations,
  loading,
  minDate,
  maxDate,
}) => {
  const originStation = stations.find((s) => s.id === originId);
  const destStation = stations.find((s) => s.id === destinationId);
  const distance = originStation && destStation ? Math.abs(destStation.distanceKm - originStation.distanceKm) : 0;
  
  const defaultMinDate = new Date().toISOString().split('T')[0];
  const effectiveMinDate = minDate && minDate > defaultMinDate ? minDate : defaultMinDate;

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px',marginTop: '24px' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
        <Navigation size={20} />
        Route & Segment Search
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
        
        {/* Origin Station Dropdown */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Origin Station
          </label>
          <select
            className="input-field"
            value={originId}
            onChange={(e) => setOriginId(parseInt(e.target.value, 10))}
          >
            {stations.map((st) => (
              <option key={st.id} value={st.id} style={{ background: '#131c31', color: '#fff' }}>
                {st.sequenceNumber}. {st.name} ({st.code})
              </option>
            ))}
          </select>
        </div>

        {/* Swap stations button */}
        <div className="mobile-hide" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingBottom: '10px' }}>
          <button
            type="button"
            onClick={onSwapStations}
            title="Swap origin and destination"
            style={{
              background: 'rgba(0, 242, 254, 0.1)',
              border: '1px solid rgba(0, 242, 254, 0.3)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              color: 'var(--accent-cyan)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 242, 254, 0.25)'; e.currentTarget.style.transform = 'rotate(180deg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 242, 254, 0.1)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
          >
            <ArrowLeftRight size={18} />
          </button>
        </div>

        {/* Destination Station Dropdown */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Destination Station
          </label>
          <select
            className="input-field"
            value={destinationId}
            onChange={(e) => setDestinationId(parseInt(e.target.value, 10))}
          >
            {stations.map((st) => (
              <option key={st.id} value={st.id} style={{ background: '#131c31', color: '#fff' }}>
                {st.sequenceNumber}. {st.name} ({st.code})
              </option>
            ))}
          </select>
        </div>

        {/* Travel Date Selector */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Travel Date
          </label>
          <input
            type="date"
            className="input-field"
            value={date}
            min={effectiveMinDate}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Search Action Button */}
        <div>
          <button className="btn-primary" style={{ width: '100%', height: '42px', justifyContent: 'center' }} onClick={onSearch} disabled={loading}>
            {loading ? 'Scanning Seats...' : 'Check Availability'}
          </button>
        </div>

      </div>

      {/* Journey Stats & Estimated Fare */}
      {fareEstimate && (
        <div style={{
          marginTop: '20px',
          padding: '14px 18px',
          background: 'rgba(0, 242, 254, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>STATIONS TRAVERSED</span>
              <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{fareEstimate.stationsTraversed} Stations ({distance.toFixed(1)} km)</p>
            </div>
            <div style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '20px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>BASE RATE</span>
              <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>LKR {fareEstimate.baseFare} + LKR {fareEstimate.ratePerStation}/station</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={20} color="var(--accent-emerald)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Minimum Estimated Fare:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
              LKR {fareEstimate.totalFare.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
