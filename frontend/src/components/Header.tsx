import React from 'react';
import { Train, ShieldCheck, BarChart3, Ticket } from 'lucide-react';

interface HeaderProps {
  activeTab: 'booking' | 'admin' | 'my-tickets';
  setActiveTab: (tab: 'booking' | 'admin' | 'my-tickets') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="glass-card mb-6" style={{ borderRadius: '0 0 20px 20px', padding: '16px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand & Route Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)'
          }}>
            <Train size={26} color="#04101e" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(90deg, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Sri Lanka Railways
              </h1>
              <span className="badge badge-available">Segment Engine v1.0</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
              Colombo Fort ↔ Kandy ↔ Nuwara Eliya (Nanu Oya) ↔ Ella ↔ Badulla Scenic Line
            </p>
          </div>
        </div>

        {/* Navigation Mode Switcher */}
        <div style={{ display: 'flex', gap: '10px', background: 'rgba(15, 23, 42, 0.7)', padding: '6px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <button
            onClick={() => setActiveTab('booking')}
            className={activeTab === 'booking' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            <Ticket size={16} />
            Book Seats
          </button>

          <button
            onClick={() => setActiveTab('my-tickets')}
            className={activeTab === 'my-tickets' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            <ShieldCheck size={16} />
            PNR Lookup
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={activeTab === 'admin' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            <BarChart3 size={16} />
            Department Admin
          </button>
        </div>

      </div>
    </header>
  );
};
