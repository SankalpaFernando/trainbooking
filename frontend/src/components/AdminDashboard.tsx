import React, { useState, useEffect } from 'react';
import { DepartmentAnalytics } from '../types';
import { ApiService } from '../services/api';
import { BarChart3, DollarSign, Users, Activity, PlusCircle, Train, RefreshCw, Settings } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [analytics, setAnalytics] = useState<DepartmentAnalytics | null>(null);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pricing configuration state
  const [editingCoachId, setEditingCoachId] = useState<number | null>(null);
  const [editPricing, setEditPricing] = useState({ baseFare: 100, ratePerStation: 50, windowSurcharge: 100 });

  // Coach configuration modal state
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [coachName, setCoachName] = useState('');
  const [coachType, setCoachType] = useState<'RESERVED' | 'UNRESERVED'>('RESERVED');
  const [classType, setClassType] = useState<'FIRST_CLASS' | 'SECOND_CLASS' | 'THIRD_CLASS'>('FIRST_CLASS');
  const [rows, setRows] = useState(6);
  const [seatsPerRow, setSeatsPerRow] = useState(4);
  const [prefix, setPrefix] = useState('X');

  const [checkerUser, setCheckerUser] = useState('');
  const [checkerPass, setCheckerPass] = useState('');
  const [checkerMsg, setCheckerMsg] = useState('');
  
  const [checkers, setCheckers] = useState<any[]>([]);
  const [editingCheckerId, setEditingCheckerId] = useState<number | null>(null);
  const [editingCheckerPass, setEditingCheckerPass] = useState('');

  // System Settings state
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [bookingWindowDays, setBookingWindowDays] = useState<number>(30); // Default to 30 days
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchCheckers = async () => {
    try {
      const data = await ApiService.getCheckers();
      setCheckers(data);
    } catch (e) {
      console.error('Failed to load checkers', e);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, coachesData, settingsData] = await Promise.all([
        ApiService.getAdminAnalytics(date),
        ApiService.getCoaches(),
        ApiService.getSettings(),
      ]);
      setAnalytics(data);
      setCoaches(coachesData);
      setSettings(settingsData);
      if (settingsData['bookingWindowDays']) {
        setBookingWindowDays(parseInt(settingsData['bookingWindowDays'], 10));
      }
      fetchCheckers();
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
        rows,
        seatsPerRow,
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input 
              aria-label="Analytics Date"
              type="date" 
              className="input-field" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              style={{ padding: '6px 10px', fontSize: '0.85rem', width: 'auto' }}
            />
            <button className="btn-secondary" onClick={fetchAnalytics} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> Refresh Metrics
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {analytics.segmentMetrics.map((seg, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem' }}>
              <div style={{ width: '220px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {seg.startStationName} → {seg.endStationName}
              </div>

              <div style={{ flex: 1, background: 'var(--overlay-bg)', borderRadius: '6px', height: '22px', overflow: 'hidden', position: 'relative' }}>
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
          <form onSubmit={handleAddCoachSubmit} style={{ marginTop: '20px', padding: '20px', background: 'var(--overlay-bg)', borderRadius: '14px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px', color: 'var(--accent-cyan)' }}>Configure New Coach</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label htmlFor="coachName" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Coach Name</label>
                <input id="coachName" type="text" required placeholder="e.g. Coach I - Observation" className="input-field" value={coachName} onChange={(e) => setCoachName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="coachType" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Type</label>
                <select id="coachType" className="input-field" value={coachType} onChange={(e: any) => setCoachType(e.target.value)}>
                  <option value="RESERVED">RESERVED</option>
                  <option value="UNRESERVED">UNRESERVED</option>
                </select>
              </div>
              <div>
                <label htmlFor="classType" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Class</label>
                <select id="classType" className="input-field" value={classType} onChange={(e: any) => setClassType(e.target.value)}>
                  <option value="FIRST_CLASS">FIRST CLASS</option>
                  <option value="SECOND_CLASS">SECOND CLASS</option>
                  <option value="THIRD_CLASS">THIRD CLASS</option>
                </select>
              </div>
              {coachType === 'RESERVED' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="input-group">
                    <label htmlFor="rows" className="input-label">Number of Rows</label>
                    <input id="rows" type="number" required min={1} max={20} className="input-field" value={rows} onChange={(e) => setRows(parseInt(e.target.value, 10) || 1)} />
                  </div>
                  <div className="input-group">
                    <label htmlFor="seatsPerRow" className="input-label">Seats Per Row</label>
                    <input id="seatsPerRow" type="number" required min={1} max={10} className="input-field" value={seatsPerRow} onChange={(e) => setSeatsPerRow(parseInt(e.target.value, 10) || 1)} />
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="seatPrefix" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Seat Prefix</label>
                <input id="seatPrefix" type="text" required placeholder="e.g. I" className="input-field" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddCoach(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Coach</button>
            </div>
          </form>
        )}
      </div>

      {/* Pricing Configuration Banner */}
      <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={20} color="var(--accent-emerald)" />
              Dynamic Coach Pricing Configuration
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Override standard fares per coach and set custom window surcharges.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px' }}>Coach Name</th>
                <th style={{ padding: '12px 8px' }}>Class</th>
                <th style={{ padding: '12px 8px' }}>Base Fare (LKR)</th>
                <th style={{ padding: '12px 8px' }}>Rate/Station (LKR)</th>
                <th style={{ padding: '12px 8px' }}>Window Surcharge (LKR)</th>
                <th style={{ padding: '12px 8px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {coaches.map((coach) => (
                <tr key={coach.id} style={{ borderBottom: '1px solid var(--overlay-border)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>{coach.name}</td>
                  <td style={{ padding: '12px 8px' }}>{coach.classType.replace('_', ' ')}</td>
                  
                  {editingCoachId === coach.id ? (
                    <>
                      <td style={{ padding: '8px' }}>
                        <input aria-label="Base Fare" type="number" className="input-field" style={{ width: '90px', padding: '6px' }} value={editPricing.baseFare} onChange={(e) => setEditPricing({ ...editPricing, baseFare: parseFloat(e.target.value) })} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input aria-label="Rate Per Station" type="number" className="input-field" style={{ width: '90px', padding: '6px' }} value={editPricing.ratePerStation} onChange={(e) => setEditPricing({ ...editPricing, ratePerStation: parseFloat(e.target.value) })} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input aria-label="Window Surcharge" type="number" className="input-field" style={{ width: '90px', padding: '6px' }} value={editPricing.windowSurcharge} onChange={(e) => setEditPricing({ ...editPricing, windowSurcharge: parseFloat(e.target.value) })} />
                      </td>
                      <td style={{ padding: '8px', display: 'flex', gap: '8px' }}>
                        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={async () => {
                          try {
                            await ApiService.updateCoachPricing(coach.id, editPricing);
                            setEditingCoachId(null);
                            fetchAnalytics();
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }}>Save</button>
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setEditingCoachId(null)}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '12px 8px' }}>{coach.baseFare ?? 100}</td>
                      <td style={{ padding: '12px 8px' }}>{coach.ratePerStation ?? 50}</td>
                      <td style={{ padding: '12px 8px' }}>{coach.windowSurcharge ?? 100}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => {
                            setEditingCoachId(coach.id);
                            setEditPricing({
                              baseFare: coach.baseFare ?? 100,
                              ratePerStation: coach.ratePerStation ?? 50,
                              windowSurcharge: coach.windowSurcharge ?? 100,
                            });
                          }}>Edit</button>
                          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'var(--accent-rose)', color: 'var(--accent-rose)' }} onClick={async () => {
                            if (confirm(`Are you sure you want to delete coach ${coach.name}?`)) {
                              try {
                                await ApiService.deleteCoach(coach.id);
                                fetchAnalytics(); // Refresh
                              } catch (e: any) {
                                alert(e.message || 'Delete failed');
                              }
                            }
                          }}>Delete</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Checkers Configuration */}
      <div className="glass-card" style={{ padding: '24px', marginTop: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Manage Ticket Checkers</h3>
        
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            setCheckerMsg('');
            await ApiService.createChecker(checkerUser, checkerPass);
            setCheckerMsg('Ticket Checker created successfully!');
            setCheckerUser('');
            setCheckerPass('');
            fetchCheckers();
          } catch (err: any) {
            setCheckerMsg(err.message || 'Failed to create ticket checker');
          }
        }} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div>
            <label htmlFor="checkerUser" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Username</label>
            <input id="checkerUser" type="text" required className="input-field" value={checkerUser} onChange={e => setCheckerUser(e.target.value)} />
          </div>
          <div>
            <label htmlFor="checkerPass" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Password</label>
            <input id="checkerPass" type="password" required className="input-field" value={checkerPass} onChange={e => setCheckerPass(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">Create Account</button>
        </form>
        {checkerMsg && <div style={{ marginBottom: '24px', fontSize: '0.85rem', color: checkerMsg.includes('success') ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{checkerMsg}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>ID</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Username</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Created At</th>
                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {checkers.map((checker) => (
                <tr key={checker.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '12px 8px' }}>#{checker.id}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>{checker.username}</td>
                  <td style={{ padding: '12px 8px' }}>{new Date(checker.createdAt).toLocaleString()}</td>
                  <td style={{ padding: '12px 8px' }}>
                    {editingCheckerId === checker.id ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="password"
                          className="input-field"
                          placeholder="New Password"
                          style={{ padding: '6px 10px', fontSize: '0.8rem', width: '150px' }}
                          value={editingCheckerPass}
                          onChange={(e) => setEditingCheckerPass(e.target.value)}
                        />
                        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={async () => {
                          try {
                            if (!editingCheckerPass) return;
                            await ApiService.updateChecker(checker.id, editingCheckerPass);
                            setEditingCheckerId(null);
                            setEditingCheckerPass('');
                            alert('Password updated successfully');
                          } catch (e: any) {
                            alert(e.message || 'Update failed');
                          }
                        }}>Save</button>
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setEditingCheckerId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => {
                          setEditingCheckerId(checker.id);
                          setEditingCheckerPass('');
                        }}>Change Password</button>
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'var(--accent-rose)', color: 'var(--accent-rose)' }} onClick={async () => {
                          if (confirm(`Are you sure you want to delete checker ${checker.username}?`)) {
                            try {
                              await ApiService.deleteChecker(checker.id);
                              fetchCheckers();
                            } catch (e: any) {
                              alert(e.message || 'Delete failed');
                            }
                          }
                        }}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Settings Configuration */}
      <div className="glass-card" style={{ padding: '32px', marginBottom: '32px',marginTop:'20px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)' }}>
          <Settings size={20} />
          System Settings
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Configure how many days in advance passengers are allowed to book seats.
        </p>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label htmlFor="bookingWindowDays" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Booking Window (Days)
            </label>
            <input
              id="bookingWindowDays"
              type="number"
              min="1"
              max="365"
              className="input-field"
              value={bookingWindowDays}
              onChange={(e) => setBookingWindowDays(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div>
            <button
              className="btn-primary"
              disabled={savingSettings}
              style={{ height: '42px', padding: '0 24px' }}
              onClick={async () => {
                setSavingSettings(true);
                try {
                  await ApiService.updateSettings({
                    bookingWindowDays: String(bookingWindowDays),
                  });
                  alert('Settings updated successfully');
                } catch (e: any) {
                  alert(e.message || 'Failed to update settings');
                } finally {
                  setSavingSettings(false);
                }
              }}
            >
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
