import React, { useState, useEffect } from 'react';
import { QrCode, Scan, ShieldCheck, XCircle, ChevronLeft } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ApiService } from '../services/api';

interface TicketCheckerPortalProps {
  username: string;
}

export const TicketCheckerPortal: React.FC<TicketCheckerPortalProps> = ({ username }) => {
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualPnr, setManualPnr] = useState('');

  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        handleValidatePnr(decodedText);
      },
      (error) => {
        // parse errors are normal while scanning
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, []);



  const handleValidatePnr = async (pnrToValidate: string) => {
    try {
      setScanError(null);
      const res = await ApiService.validateTicket(pnrToValidate);
      setScanResult(res);
      setManualPnr('');
    } catch (err: any) {
      setScanResult(null);
      setScanError(err.message || 'Invalid Ticket');
    }
  };

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPnr.trim()) {
      handleValidatePnr(manualPnr.trim());
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode color="var(--accent-cyan)" /> Ticket Scanner Portal
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Logged in as: <strong>{username}</strong></p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Scanner Section */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scan size={18} /> Scan QR Code
          </h3>
          <div id="reader" style={{ width: '100%', marginBottom: '20px', background: 'var(--overlay-bg)', borderRadius: '12px' }}></div>
          
          <div style={{ textAlign: 'center', margin: '16px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>OR</div>
          
          <form onSubmit={onManualSubmit} style={{ display: 'flex', gap: '10px' }}>
            <input
              aria-label="Enter PNR manually"
              type="text"
              placeholder="Enter PNR manually"
              className="input-field"
              value={manualPnr}
              onChange={(e) => setManualPnr(e.target.value)}
            />
            <button type="submit" className="btn-primary">Verify</button>
          </form>
        </div>

        {/* Result Section */}
        <div aria-live="polite" className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Validation Result</h3>
          
          {scanError && (
            <div style={{ padding: '20px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid var(--accent-rose)', borderRadius: '12px', textAlign: 'center' }}>
              <XCircle size={48} color="var(--accent-rose)" style={{ margin: '0 auto 12px auto' }} />
              <div style={{ color: 'var(--accent-rose)', fontWeight: 700, fontSize: '1.2rem' }}>Invalid Ticket</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>{scanError}</div>
            </div>
          )}

          {scanResult && (
            <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-emerald)', borderRadius: '12px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <ShieldCheck size={48} color="var(--accent-emerald)" style={{ margin: '0 auto 12px auto' }} />
                <div style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '1.2rem' }}>Valid Ticket</div>
                <div style={{ color: 'var(--text-main)', fontSize: '1.1rem', marginTop: '4px', fontWeight: 800 }}>{scanResult.pnr}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                  Status: <strong style={{ color: 'var(--accent-emerald)' }}>{scanResult.status}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Passenger</div>
                  <div style={{ fontWeight: 600 }}>{scanResult.guestName}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>NIC / ID</div>
                  <div style={{ fontWeight: 600 }}>{scanResult.guestNic}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>From</div>
                  <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{scanResult.startStation?.name}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>To</div>
                  <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{scanResult.endStation?.name}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Date</div>
                  <div style={{ fontWeight: 600 }}>{scanResult.date}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Seat</div>
                  <div style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>{scanResult.seat?.seatNumber} ({scanResult.seat?.coach?.name})</div>
                </div>
              </div>
            </div>
          )}

          {!scanResult && !scanError && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', border: '1px dashed var(--glass-border)', borderRadius: '12px', padding: '20px' }}>
              Scan a QR code or enter a PNR to see validation results here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
