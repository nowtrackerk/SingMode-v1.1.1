import React, { useState, useEffect } from 'react';
import { ViewRole } from './types';
import DJView from './components/DJView';
import ParticipantView from './components/ParticipantView';
import { getSession, initializeSync, cleanupExpiredGuestAccounts } from './services/sessionManager';
import { syncService } from './services/syncService';
import { SingModeLogo } from './components/common/SingModeLogo';
import { SyncBadge } from './components/common/SyncBadge';

import FeaturesView from './components/FeaturesView';
import { getNetworkUrl, getStoredNetworkIp, setNetworkIp } from './services/networkUtils';

const App: React.FC = () => {
  const [role, setRole] = useState<ViewRole>('SELECT');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQRCodeUser, setIsQRCodeUser] = useState(false);

  const [showNetworkConfig, setShowNetworkConfig] = useState(false);
  const [networkIpInput, setNetworkIpInput] = useState('');

  useEffect(() => {
    const init = async () => {
      // Auto-detect view from URL
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view')?.toUpperCase();
      const room = params.get('room');

      // Track if user joined via QR code (has room parameter)
      if (room) {
        setIsQRCodeUser(true);
      }

      try {
        if (view === 'DJ') {
          setRole('DJ');
          await initializeSync('DJ', room || undefined);
        } else if (view === 'PARTICIPANT' || room) {
          setRole('PARTICIPANT');
          await initializeSync('PARTICIPANT', room || undefined);
        } else {
          setRole('SELECT');
        }
      } catch (err: any) {
        console.error('[App] Init Error:', err);
        setError(err.message);
        setRole('SELECT'); // Revert to select role on error
      }

      // Pre-load session to avoid flickering
      await getSession();
      await cleanupExpiredGuestAccounts();
      setLoading(false);
    };
    init();
  }, []);

  const handleManualRoleSelect = async (newRole: ViewRole) => {
    setLoading(true);
    setError(null);
    try {
      setRole(newRole);
      if (newRole === 'DJ' || newRole === 'PARTICIPANT') {
        await initializeSync(newRole);
      }
    } catch (err: any) {
      setError(err.message);
      setRole('SELECT');
    } finally {
      setLoading(false);
    }
  };



  const handleSaveNetworkIp = () => {
    if (networkIpInput.trim()) {
      setNetworkIp(networkIpInput.trim());
      setShowNetworkConfig(false);
      setNetworkIpInput('');
    }
  };

  const currentUrl = getNetworkUrl();
  const roomId = syncService.getRoomId();
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(currentUrl + (roomId ? `?room=${roomId}` : ''))}&bgcolor=ffffff`;

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin neon-border-pink" style={{ borderColor: 'var(--neon-pink)', borderTopColor: 'transparent' }}></div>
    </div>
  );

  if (role === 'FEATURES') {
    return <FeaturesView onBack={() => setRole('SELECT')} />;
  }

  if (role === 'SELECT') {
    const storedIp = getStoredNetworkIp();
    const isUsingLocalhost = currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1');

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex justify-center mb-8">
              <img src="IGK.jpeg" alt="Island Groove" className="w-40 h-40 rounded-full neon-border-pink shadow-[0_0_30px_rgba(255,20,147,0.5)]" />
            </div>
            <h1 className="text-8xl font-black font-bungee mb-4 rainbow-text tracking-tighter neon-pulse">
              SINGMODE
            </h1>
            <p className="text-[#FFD700] text-xl font-bold tracking-wide uppercase neon-glow-yellow">KARAOKE LOUNGE</p>
          </div>

          {error && (
            <div className="mb-8 p-6 bg-rose-500/10 border-2 border-rose-500 rounded-[2rem] text-center animate-in zoom-in duration-300">
              <div className="text-3xl mb-2">🚫</div>
              <h3 className="text-rose-500 font-black uppercase tracking-widest text-lg mb-2">Session Conflict</h3>
              <p className="text-white font-medium">{error}</p>
              <p className="text-slate-400 text-xs mt-4 uppercase font-bold">Only one DJ is allowed per local network.</p>
            </div>
          )}

          <div className={`grid gap-8 ${isQRCodeUser ? 'grid-cols-1 max-w-md mx-auto' : 'md:grid-cols-2'}`}>
            {!isQRCodeUser && (
              <button
                onClick={() => handleManualRoleSelect('DJ')}
                className="group p-10 bg-black/80 border-2 rounded-[2.5rem] text-left hover:bg-black transition-all shadow-2xl neon-border-pink hover:neon-border-cyan"
              >
                <div className="w-16 h-16 bg-black border-2 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-all neon-border-yellow group-hover:neon-border-green">🎧</div>
                <h2 className="text-3xl font-black mb-2 font-righteous uppercase tracking-tight neon-glow-pink" style={{ color: 'var(--neon-pink)' }}>DJ CONSOLE</h2>
                <p className="font-medium" style={{ color: 'var(--neon-cyan)' }}>Coordinate the room. Approve tracks and manage the rotation.</p>
              </button>
            )}

            <button
              onClick={() => handleManualRoleSelect('PARTICIPANT')}
              className="group p-10 bg-black/80 border-2 rounded-[2.5rem] text-left hover:bg-black transition-all shadow-2xl neon-border-cyan hover:neon-border-yellow"
            >
              <div className="w-16 h-16 bg-black border-2 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-all neon-border-purple group-hover:neon-border-green">🎤</div>
              <h2 className="text-3xl font-black mb-2 font-righteous uppercase tracking-tight neon-glow-cyan" style={{ color: 'var(--neon-cyan)' }}>SINGER UI</h2>
              <p className="font-medium" style={{ color: 'var(--neon-yellow)' }}>Request songs, star your favorites, and prepare to perform.</p>
            </button>
          </div>

          <div className="mt-16 p-8 bg-black/60 border-2 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 backdrop-blur-sm neon-border-pink">
            <div className="bg-white p-3 rounded-2xl shrink-0 shadow-2xl border-4 neon-border-yellow" style={{ borderColor: 'var(--neon-yellow)' }}>
              <img
                src={qrCodeUrl}
                alt="Join QR Code"
                width="120"
                height="120"
                className="block"
              />
            </div>
            <div className="text-center md:text-left flex-1">
              <strong className="text-[#FFD700] block mb-2 uppercase tracking-[0.3em] text-[10px] font-black neon-glow-yellow">SCAN TO JOIN</strong>
              <div className="text-[#00FFFF] text-lg font-mono break-all">{currentUrl}</div>
              {isUsingLocalhost && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-amber-400 text-xs font-bold mb-2">⚠️ Using localhost - phones cannot connect</p>
                  <button
                    onClick={() => { setShowNetworkConfig(true); setNetworkIpInput(storedIp || ''); }}
                    className="text-[10px] font-black text-teal-400 hover:text-teal-300 uppercase tracking-widest underline"
                  >
                    Configure Network IP
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Network IP Configuration Modal */}
        {showNetworkConfig && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50 backdrop-blur-2xl">
            <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Network Configuration</h2>
                <p className="text-slate-500 text-sm">Enter your PC's local IP or a public URL (e.g., ngrok) for remote access.</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Network IP Address</label>
                <input
                  type="text"
                  value={networkIpInput}
                  onChange={(e) => setNetworkIpInput(e.target.value)}
                  placeholder="e.g. 192.168.0.x OR https://....ngrok.io"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-6 py-4 text-white font-mono focus:border-teal-400 outline-none"
                />
                <p className="text-slate-600 text-xs mt-2">
                  <span className="text-teal-400 font-bold">Tip:</span> Use <span className="text-white">ngrok</span> or similar tunnels if devices are on different WiFi networks (Public/Private).
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveNetworkIp}
                  className="flex-1 py-3 bg-teal-400 text-slate-950 rounded-xl font-black text-sm uppercase"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowNetworkConfig(false)}
                  className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-black text-sm uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-black text-white">
      <SyncBadge role={role} />
      <nav className="border-b-2 border-[#FF1493] bg-black/95 sticky top-0 z-40 backdrop-blur-xl neon-border-pink">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div onClick={() => setRole('SELECT')} className="cursor-pointer">
            <div className="flex items-center gap-3">
              <img src="IGK.jpeg" alt="Logo" className="w-12 h-12 rounded-full neon-border-pink" />
              <span className="font-bungee text-xl rainbow-text">SINGMODE</span>
            </div>
          </div>
          <div className="flex items-center gap-6">

            <button
              onClick={() => { setRole('SELECT'); setError(null); }}
              className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border-2 rounded-xl transition-all neon-border-cyan neon-glow-cyan"
              style={{ color: 'var(--neon-cyan)', borderColor: 'var(--neon-cyan)' }}
            >
              EXIT {role}
            </button>
          </div>
        </div>
      </nav>

      <main className="pb-20">
        {role === 'DJ' ? (
          <DJView />
        ) : (
          <ParticipantView />
        )}
      </main>


    </div>
  );
};

export default App;
