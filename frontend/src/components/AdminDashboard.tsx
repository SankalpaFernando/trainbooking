import React, { useState, useEffect } from 'react';
import { DepartmentAnalytics } from '../types';
import { ApiService } from '../services/api';
import { BarChart3, DollarSign, Users, Activity, PlusCircle, Train, RefreshCw } from 'lucide-react';

interface AdminDashboardProps {
  date: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ date }) => {
  const [analytics, setAnalytics] = useState<DepartmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Coach configuration modal state
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [coachName, setCoachName] = useState('');
  const [coachType, setCoachType] = useState<'RESERVED' | 'UNRESERVED'>('RESERVED');
  const [classType, setClassType] = useState<'FIRST_CLASS' | 'SECOND_CLASS' | 'THIRD_CLASS'>('FIRST_CLASS');
  const [totalSeats, setTotalSeats] = useState(24);
  const [prefix, setPrefix] = useState('X');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.getAdminAnalytics(date);
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load department analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [date]);

  const handleAddCoachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiService.createCoach({
        name: coachName,
        type: coachType,
        classType,
        totalSeats,
        prefix,
      });
      setShowAddCoach(false);
      fetchAnalytics();
    } catch (err: any) {
      alert(`Error creating coach: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={32} className="spin" style={{ margin: '0 auto 12px auto' }} />
        <p>Loading Departmental Analytics for {date}...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="glass-card" style={{ padding: '24px', color: '#f87171' }}>
        Failed to load analytics: {error}
      </div>
    );
  }

  return (
    <div>
      {/* KPI Cards Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TOTAL REVENUE</span>
            <DollarSign size={20} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
            LKR {analytics.totalRevenue.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            From confirmed segment bookings
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AVG LINE OCCUPANCY</span>
            <Activity size={20} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
            {analytics.averageOccupancyPercentage}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Across 17 station intervals
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ACTIVE BOOKINGS</span>
            <Users size={20} color="var(--accent-amber)" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
            {analytics.totalBookings}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {analytics.confirmedBookings} Confirmed | {analytics.pendingHoldBookings} Pending Holds
          </div>
        </div>

      </div>

      {/* Segment Bottleneck Visualizer */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
              <BarChart3 size={20} />
              Segment Occupancy Breakdown (Colombo Fort → Badulla Mainline)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Identifies under-utilized vs overcrowded route legs along the railway line
            </p>
          </div>

          <button className="btn-secondary" onClick={fetchAnalytics} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <RefreshCw size={14} /> Refresh Metrics
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {analytics.segmentMetrics.map((seg, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem' }}>
              <div style={{ width: '220px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {seg.startStationName} → {seg.endStationName}
              </div>

              <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', height: '22px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${Math.min(seg.occupancyPercentage, 100)}%`,
                  height: '100%',
                  background: seg.occupancyPercentage > 75
                    ? 'linear-gradient(90deg, #f59e0b, #f43f5e)'
                    : 'linear-gradient(90deg, #00f2fe, #10b981)',
                  borderRadius: '6px',
                  transition: 'width 0.4s ease',
                }}></div>
              </div>

              <div style={{ width: '80px', textAlign: 'right', fontWeight: 700, color: seg.occupancyPercentage > 75 ? 'var(--accent-rose)' : 'var(--accent-cyan)' }}>
                {seg.occupancyPercentage}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Infrastructure Configurer Banner */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Train size={20} color="var(--accent-teal)" />
              Railway Infrastructure Management
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Dynamically add new coaches or extend seats per coach without code changes
            </p>
          </div>

          <button className="btn-primary" onClick={() => setShowAddCoach(true)}>
            <PlusCircle size={16} />
            Add New Coach
          </button>
        </div>

        {showAddCoach && (
          <form onSubmit={handleAddCoachSubmit} style={{ marginTop: '20px', padding: '20px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-cyan)' }}>Configure New Coach</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Coach Name</label>
                <input type="text" required placeholder="e.g. Coach I - Observation" className="input-field" value={coachName} onChange={(e) => setCoachName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Type</label>
                <select className="input-field" value={coachType} onChange={(e: any) => setCoachType(e.target.value)}>
                  <option value="RESERVED">RESERVED</option>
                  <option value="UNRESERVED">UNRESERVED</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Class</label>
                <select className="input-field" value={classType} onChange={(e: any) => setClassType(e.target.value)}>
                  <option value="FIRST_CLASS">FIRST CLASS</option>
                  <option value="SECOND_CLASS">SECOND CLASS</option>
                  <option value="THIRD_CLASS">THIRD CLASS</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Seats</label>
                <input type="number" required min={1} max={60} className="input-field" value={totalSeats} onChange={(e) => setTotalSeats(parseInt(e.target.value, 10))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Seat Prefix</label>
                <input type="text" required placeholder="e.g. I" className="input-field" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddCoach(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Coach</button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
};
