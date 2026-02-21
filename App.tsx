import React, { useState, useEffect } from 'react';
import { ViewRole } from './types';
import DJView from './components/DJView';
import ParticipantView from './components/ParticipantView';
import { getSession, initializeSync, cleanupExpiredGuestAccounts } from './services/sessionManager';
import { syncService } from './services/syncService';
import { SingModeLogo } from './components/common/SingModeLogo';

import FeaturesView from './components/FeaturesView';
import AdminPortal from './components/AdminPortal';
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
      const sincUserId = params.get('userId');
      const room = params.get('room');

      // Track if user joined via QR code (has room or userId parameter)
      if (room || sincUserId) {
        setIsQRCodeUser(true);
      }

      try {
        if (view === 'DJ') {
          setRole('DJ');
          // DJs now explicitly open sessions in the DJView
        } else if (view === 'PARTICIPANT' || view === 'STAGE' || room || sincUserId) {
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
      const s = await getSession();
      if (s.customTheme) {
        document.documentElement.style.setProperty('--neon-pink', s.customTheme.primaryNeon);
        document.documentElement.style.setProperty('--neon-cyan', s.customTheme.secondaryNeon);
        document.documentElement.style.setProperty('--neon-yellow', s.customTheme.accentNeon);
      }
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
      if (newRole === 'PARTICIPANT') {
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
    <div className="min-h-screen bg-[#050510] flex flex-col items-center justify-center space-y-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-[#10002B] to-black"></div>
      <div className="w-24 h-24 relative">
        <div className="absolute inset-0 border-4 border-[var(--neon-pink)]/30 rounded-full animate-ping"></div>
        <div className="absolute inset-0 border-4 border-[var(--neon-cyan)]/30 rounded-full animate-ping delay-75"></div>
        <div className="relative z-10 w-full h-full border-4 border-t-[var(--neon-pink)] border-r-[var(--neon-purple)] border-b-[var(--neon-cyan)] border-l-[var(--neon-yellow)] rounded-full animate-spin"></div>
      </div>
      <h2 className="text-2xl font-black font-bungee text-white uppercase tracking-widest animate-pulse z-10">INITIALIZING</h2>
    </div>
  );

  if (role === 'FEATURES') {
    return <FeaturesView onBack={() => setRole('SELECT')} onAdminLogin={() => setRole('ADMIN')} />;
  }

  if (role === 'ADMIN') {
    return <AdminPortal onBack={() => setRole('SELECT')} />;
  }

  if (role === 'SELECT') {
    const storedIp = getStoredNetworkIp();
    const isUsingLocalhost = currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1');

    return (

      <div className="min-h-screen flex items-center justify-center p-6 bg-[#050510] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-[#10002B] to-black -z-10"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-10"></div>

        <div className="max-w-7xl w-full z-10">
          <div className="text-center mb-20 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="flex justify-center mb-10 relative">
              <div className="absolute inset-0 bg-[var(--neon-pink)]/20 blur-[100px] rounded-full"></div>
              <div className="p-3 rounded-full border-4 border-white/10 bg-black shadow-2xl relative z-10">
                <div className="rounded-full overflow-hidden border-4 border-[var(--neon-pink)] shadow-[0_0_50px_rgba(255,0,127,0.5)] w-48 h-48">
                  <img src="IGK.jpeg" alt="Island Groove" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
            <h1 className="text-6xl md:text-9xl font-bold font-bungee text-white mb-6 uppercase tracking-tight neon-text-glow-purple leading-none drop-shadow-2xl">
              Singmode v.2
            </h1>
            <p className="text-[var(--neon-yellow)] text-xl md:text-2xl font-bold tracking-widest uppercase neon-glow-yellow font-righteous">KARAOKE_LOUNGE_SYSTEM</p>
          </div>

          {error && (
            <div className="mb-12 p-10 bg-[#150005] border-4 border-rose-500 rounded-[3rem] text-center animate-in zoom-in duration-500 max-w-3xl mx-auto shadow-[0_0_60px_rgba(244,63,94,0.4)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-rose-500 animate-pulse"></div>
              <div className="text-6xl mb-6">🚫</div>
              <h3 className="text-rose-500 font-bold uppercase tracking-widest text-3xl mb-4 font-bungee">SYSTEM_CONFLICT</h3>
              <p className="text-white text-xl font-bold leading-relaxed font-righteous">{error}</p>
              <p className="text-rose-500/50 text-xs mt-8 uppercase font-bold tracking-widest font-righteous">SINGLE_DJ_PROTOCOL_ACTIVE</p>
            </div>
          )}



          <div className={`grid gap-8 ${isQRCodeUser ? 'grid-cols-1 max-w-2xl mx-auto' : 'md:grid-cols-2'}`}>
            {!isQRCodeUser && (
              <button
                onClick={() => handleManualRoleSelect('DJ')}
                className="group relative p-12 bg-[#101015] border-4 border-white/5 rounded-[4rem] text-left transition-all hover:border-[var(--neon-pink)] hover:-translate-y-2 hover:shadow-[0_0_80px_rgba(255,0,127,0.2)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--neon-pink)]/0 to-[var(--neon-pink)]/5 group-hover:to-[var(--neon-pink)]/10 transition-all"></div>
                <div className="relative z-10">
                  <div className="w-24 h-24 bg-black border-2 border-white/10 rounded-3xl flex items-center justify-center text-5xl mb-8 group-hover:scale-110 transition-all group-hover:border-[var(--neon-pink)] shadow-2xl">🎧</div>
                  <h2 className="text-5xl font-bold mb-4 font-bungee uppercase tracking-tight text-white group-hover:text-[var(--neon-pink)] transition-colors">DJ_CONSOLE</h2>
                  <p className="text-sm font-medium font-righteous uppercase tracking-widest text-[var(--neon-cyan)] opacity-90 leading-relaxed">COORDINATE ROTATION. APPROVE REQUESTS. COMMAND ATMOSPHERE.</p>
                </div>
              </button>
            )}

            <button
              onClick={() => handleManualRoleSelect('PARTICIPANT')}
              className="group relative p-12 bg-[#101015] border-4 border-white/5 rounded-[4rem] text-left transition-all hover:border-[var(--neon-cyan)] hover:-translate-y-2 hover:shadow-[0_0_80px_rgba(0,229,255,0.2)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--neon-cyan)]/0 to-[var(--neon-cyan)]/5 group-hover:to-[var(--neon-cyan)]/10 transition-all"></div>
              <div className="relative z-10">
                <div className="w-24 h-24 bg-black border-2 border-white/10 rounded-3xl flex items-center justify-center text-5xl mb-8 group-hover:scale-110 transition-all group-hover:border-[var(--neon-cyan)] shadow-2xl">🎤</div>
                <h2 className="text-5xl font-bold mb-4 font-bungee uppercase tracking-tight text-white group-hover:text-[var(--neon-cyan)] transition-colors">SINGER_UI</h2>
                <p className="text-sm font-medium font-righteous uppercase tracking-widest text-[var(--neon-yellow)] opacity-90 leading-relaxed">REQUEST SONGS. FAVORITE VIBES. ACCESS SONGBOOK.</p>
              </div>
            </button>
          </div>

          <div className="mt-16 p-10 bg-[#080808] border-2 border-white/5 rounded-[3rem] flex flex-col md:flex-row items-center gap-10 relative overflow-hidden group hover:border-[var(--neon-green)] transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--neon-green)]/5 blur-[80px] rounded-full -mr-32 -mt-32 pointer-events-none"></div>
            <div className="bg-white p-4 rounded-3xl shrink-0 shadow-[0_0_40px_rgba(0,255,157,0.2)] border-4 border-white/10 group-hover:scale-105 transition-transform">
              <img
                src={qrCodeUrl}
                alt="Join QR Code"
                width="140"
                height="140"
                className="block"
              />
            </div>
            <div className="text-center md:text-left flex-1 relative z-10">
              <strong className="text-[var(--neon-green)] block mb-3 uppercase tracking-[0.3em] text-xs font-black font-righteous">SCAN TO JOIN</strong>
              <div className="text-white text-xl font-mono break-all mb-4 bg-black/50 px-4 py-2 rounded-lg inline-block border border-white/5">{currentUrl}</div>
              {isUsingLocalhost && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                  <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-2 font-righteous">⚠️ LOCALHOST DETECTED</p>
                  <button
                    onClick={() => { setShowNetworkConfig(true); setNetworkIpInput(storedIp || ''); }}
                    className="text-[10px] font-black text-white hover:text-[var(--neon-cyan)] uppercase tracking-[0.2em] underline decoration-white/30 hover:decoration-[var(--neon-cyan)] transition-all font-righteous"
                  >
                    CONFIGURE NETWORK IP
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Network IP Configuration Modal */}
        {showNetworkConfig && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-[#0a0a0a] border-2 border-white/10 rounded-[3rem] p-10 space-y-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-blue)]"></div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2 font-bungee uppercase tracking-tight">Network Config</h2>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-righteous">ESTABLISH REMOTE CONNECTION PROTOCOLS</p>
              </div>
              <div className="space-y-4">
                <label className="block text-[11px] font-bold text-[var(--neon-cyan)] uppercase tracking-[0.2em] ml-4 font-righteous">Network IP Address</label>
                <input
                  type="text"
                  value={networkIpInput}
                  onChange={(e) => setNetworkIpInput(e.target.value)}
                  placeholder="e.g. 192.168.0.x OR https://....ngrok.io"
                  className="w-full bg-[#151520] border-2 border-white/10 rounded-2xl px-6 py-4 text-white font-mono focus:border-[var(--neon-cyan)] outline-none transition-all shadow-inner text-sm"
                />
                <p className="text-slate-500 text-[9px] uppercase tracking-widest font-righteous ml-4 opacity-60">
                  <span className="text-[var(--neon-yellow)]">PRO TIP:</span> Use <span className="text-white">ngrok</span> for secure external tunneling.
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowNetworkConfig(false)}
                  className="flex-1 py-4 bg-black border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all font-righteous"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNetworkIp}
                  className="flex-1 py-4 bg-[var(--neon-cyan)] text-black rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:bg-white transition-all font-righteous hover:scale-105"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-[#050510] text-white selection:bg-[var(--neon-pink)] selection:text-white">
      <nav className="fixed top-0 inset-x-0 z-[100] backdrop-blur-xl bg-black/80 border-b border-white/5 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div onClick={() => setRole('SELECT')} className="cursor-pointer group flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--neon-pink)] p-0.5 group-hover:shadow-[0_0_20px_rgba(255,0,127,0.4)] transition-all">
              <img src="IGK.jpeg" alt="Logo" className="w-full h-full rounded-full" />
            </div>
            <span className="font-bungee text-xl text-white tracking-widest group-hover:text-[var(--neon-cyan)] transition-colors">Singmode v.2</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => { setRole('SELECT'); setError(null); }}
              className="text-[9px] font-bold uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all font-righteous bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 hover:border-white/20"
            >
              EXIT {role}
            </button>
          </div>
        </div>
      </nav>

      <main className="pb-20">
        {role === 'DJ' ? (
          <DJView onAdminAccess={() => setRole('ADMIN')} />
        ) : (
          <ParticipantView />
        )}
      </main>


    </div>
  );
};

export default App;
