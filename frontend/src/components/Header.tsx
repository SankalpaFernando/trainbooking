import React from 'react';
import { Train, ShieldCheck, BarChart3, Ticket, ScanLine, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  activeTab: 'booking' | 'admin' | 'my-tickets' | 'checker';
  setActiveTab: (tab: 'booking' | 'admin' | 'my-tickets' | 'checker') => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, theme, toggleTheme }) => {
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
            <Train size={26} color="var(--bg-secondary)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'none', color: 'var(--accent-cyan)' }}>
                Sri Lanka Railway
              </h1>
              <span className="badge badge-available">Segment Engine v1.0</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Colombo Fort ↔ Kandy ↔ Nuwara Eliya (Nanu Oya) ↔ Ella ↔ Badulla Scenic Line
            </p>
          </div>
        </div>

        {/* Navigation Mode Switcher */}
        <div className="nav-buttons" style={{ display: 'flex', gap: '10px', background: 'var(--overlay-bg)', padding: '6px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
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
            onClick={() => setActiveTab('checker')}
            className={activeTab === 'checker' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            <ScanLine size={16} />
            Scan QR
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={activeTab === 'admin' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
          >
            <BarChart3 size={16} />
            Department Admin
          </button>
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="btn-secondary"
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>

      </div>
    </header>
  );
};
