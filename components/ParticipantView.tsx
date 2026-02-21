

import React, { useState, useEffect, useRef } from 'react';
import { Participant, KaraokeSession, ParticipantStatus, RequestType, RequestStatus, SongRequest, UserProfile, FavoriteSong } from '../types';
// Fixed: Removed non-existent 'isFavorite' from imports.
import {
  getSession, joinSession, updateParticipantStatus, addRequest, deleteRequest,
  updateRequest, getUserProfile, toggleFavorite, saveUserProfile, registerUser,
  loginUser, logoutUser, updateParticipantMic, reorderMyRequests, updateVocalRange, loginUserById
} from '../services/sessionManager';
import SongRequestForm from './SongRequestForm';
import { syncService } from '../services/syncService';
import { getNetworkUrl } from '../services/networkUtils';
import SessionList from './SessionList';
import VocalFxPanel from './VocalFxPanel';


type Tab = 'ROTATION' | 'REQUESTS' | 'FAVORITES' | 'HISTORY' | 'VOCALS';

const VideoLink: React.FC<{ url?: string }> = ({ url }) => {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open Video Link"
      className="p-2 rounded-lg text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)]/30 transition-all shadow-[0_0_10px_rgba(0,229,255,0.2)]"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
    </a>
  );
};



const ParticipantView: React.FC = () => {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authError, setAuthError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [session, setSession] = useState<KaraokeSession | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<SongRequest | null>(null);
  const [prefillData, setPrefillData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('ROTATION');

  const [showQrModal, setShowQrModal] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [showSessionScanner, setShowSessionScanner] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  const roomId = syncService.getRoomId();
  const roomJoinUrl = getNetworkUrl() + (roomId ? `?room=${roomId}` : '');

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => { }
  });

  const askConfirm = (message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmState({
      isOpen: true,
      message,
      onConfirm
    });
  };

  useEffect(() => {
    const init = async () => {
      // Check for SINC Login
      const params = new URLSearchParams(window.location.search);
      const sincUserId = params.get('userId');

      if (sincUserId) {
        console.log(`[Participant] SINC Login detected for userId: ${sincUserId}`);
        const result = await loginUserById(sincUserId);
        if (result.success && result.profile) {
          setUserProfile(result.profile);
          setIsLoginMode(false);
          // Clear param to prevent re-login loop or messy URL
          window.history.replaceState({}, '', window.location.pathname + (roomId ? `?room=${roomId}` : ''));
        }
      }

      const profile = await getUserProfile();
      if (profile) {
        setUserProfile(profile);
        const sess = await getSession();
        setSession(sess);
        const found = sess.participants.find(p => p.id === profile.id);
        if (found) {
          setParticipant(found);
        } else {
          console.log(`[Participant] Auto-joining session ${roomId} for profile ${profile.id}`);
          try {
            const newPart = await joinSession(profile.id);
            setParticipant(newPart);
          } catch (e) {
            console.error("Auto-join failed:", e);
          }
        }
      } else {
        const sess = await getSession();
        setSession(sess);
      }
    };
    init();

    syncService.onConnectionStatus = (status) => {
      setConnectionStatus(status);
    };
  }, [roomId]);

  /* 
  // Google Sign-In is currently disabled as it requires a valid Client ID.
  // To enable, uncomment this block and provide a valid client_id from Google Cloud Console.
  useEffect(() => {
    // Initialize Google Identity Services
    const handleGoogleCallback = async (response: any) => {
      try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        const googleProfile = {
          name: payload.name,
          email: payload.email,
          picture: payload.picture,
          googleId: payload.sub
        };

        const result = await registerUser({
          name: googleProfile.name,
          email: googleProfile.email,
          picture: googleProfile.picture,
          googleId: googleProfile.googleId
        }, true);

        if (result.success && result.profile) {
          const newPart = await joinSession(result.profile.id);
          setParticipant(newPart);
          setUserProfile(result.profile);
        }
      } catch (err) {
        console.error('[Google Auth] Failed to handle callback', err);
        setAuthError('Google Sign-in failed. Please try again.');
      }
    };

    if ((window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: 'YOUR_GOOGLE_CLIENT_ID', // Requires valid Client ID
        callback: handleGoogleCallback,
      });

      // Render button if in login/unauthenticated state
      const buttonDiv = document.getElementById('google-signin-btn');
      if (buttonDiv && !participant) {
        (window as any).google.accounts.id.renderButton(buttonDiv, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with'
        });
      }
    }
  }, [participant]);
  */

  const refresh = async () => {
    const sess = await getSession();
    setSession(sess);
    const up = await getUserProfile();
    setUserProfile(up);
    if (!up) {
      setParticipant(null);
    } else {
      const found = sess.participants.find(p => p.id === up.id);
      if (found) setParticipant(found);
    }
  };

  useEffect(() => {
    window.addEventListener('kstar_sync', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('kstar_sync', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      if (isLoginMode) {
        const result = await loginUser(name, password);
        if (result.success && result.profile) {
          const newPart = await joinSession(result.profile.id);
          setParticipant(newPart);
          setUserProfile(result.profile);
        } else {
          setAuthError(result.error || "Authorization failed.");
        }
      } else {
        if (password !== confirmPassword) {
          setAuthError("PASSWORDS_DO_NOT_MATCH");
          return;
        }

        const result = await registerUser({
          name,
          email: email || undefined,
          password: password || undefined
        }, true);

        if (result.success && result.profile) {
          const newPart = await joinSession(result.profile.id);
          setParticipant(newPart);
          setUserProfile(result.profile);
        } else {
          setAuthError(result.error || "Initialization failed.");
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "An unexpected error occurred.");
    }
  };

  const toggleStatus = async () => {
    if (!participant) return;
    const newStatus = participant.status === ParticipantStatus.READY ? ParticipantStatus.STANDBY : ParticipantStatus.READY;
    await updateParticipantStatus(participant.id, newStatus);
    await refresh();
  };

  const setStatus = async (status: ParticipantStatus) => {
    if (!participant) return;
    await updateParticipantStatus(participant.id, status);
    await refresh();
  };

  const handleRequest = async (data: { songName: string, artist: string, youtubeUrl?: string, type: RequestType, message?: string }) => {
    if (!participant) return;
    if (editingRequest) {
      await updateRequest(editingRequest.id, { songName: data.songName, artist: data.artist, youtubeUrl: data.youtubeUrl, type: data.type, message: data.message });
      setEditingRequest(null);
    } else {
      await addRequest({
        participantId: participant.id,
        participantName: participant.name,
        songName: data.songName,
        artist: data.artist,
        youtubeUrl: data.youtubeUrl,
        type: data.type,
        message: data.message
      });
      setShowRequestForm(false);
      // Auto-set status to READY upon request
      if (participant.status !== ParticipantStatus.READY) {
        await updateParticipantStatus(participant.id, ParticipantStatus.READY);
      }
    }
    setPrefillData(null);
    await refresh();
  };

  const closeModals = () => { setShowRequestForm(false); setEditingRequest(null); setPrefillData(null); };

  const handleGuestSingNow = async () => {
    setAuthError('');
    try {
      const guestName = `Guest-${Math.floor(Math.random() * 10000)}`;
      const result = await registerUser({ name: guestName }, true); // Auto-login true
      if (result.success && result.profile) {
        const newPart = await joinSession(result.profile.id);
        setParticipant(newPart);
        setUserProfile(result.profile);
        setPrefillData(null);
        setShowRequestForm(true);
        // Auto-set status to READY upon entry?
        await updateParticipantStatus(result.profile.id, ParticipantStatus.READY);
      } else {
        setAuthError(result.error || "Guest initialization failed.");
      }
    } catch (err: any) {
      setAuthError(err.message || "An unexpected error occurred.");
    }
  };

  if (!participant) {
    return (
      <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-[90vh] text-center animate-in fade-in duration-1000 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#10002B] to-black -z-10"></div>

        <div className="w-48 h-48 flex items-center justify-center mb-12 relative group">
          <div className="absolute inset-0 bg-[var(--neon-pink)] blur-[60px] opacity-40 group-hover:opacity-60 transition-opacity"></div>
          <div className="p-3 rounded-full border-4 border-white/10 relative z-10 bg-black shadow-2xl">
            <div className="rounded-full overflow-hidden border-4 border-[var(--neon-pink)] shadow-[0_0_40px_rgba(255,0,127,0.5)] w-full h-full">
              <img src="IGK.jpeg" alt="Island Groove" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>

        <h1 className="text-6xl md:text-8xl font-bold font-bungee text-white mb-6 uppercase tracking-tight neon-text-glow-purple leading-none">
          SINGMODE
        </h1>
        <p className="text-[var(--neon-cyan)] font-righteous mb-16 uppercase tracking-[0.6em] text-lg font-black neon-glow-cyan">SINGER LOGIN</p>

        <div className="w-full max-w-lg mb-12 relative z-20">
          <button
            onClick={handleGuestSingNow}
            className="w-full py-8 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-blue)] text-white rounded-[2.5rem] font-black text-4xl shadow-[0_0_60px_rgba(255,0,127,0.4)] uppercase tracking-[0.1em] active:scale-95 transition-all font-bungee hover:brightness-110 border-4 border-white/10 animate-pulse"
          >
            SING!
          </button>
          <p className="text-slate-500 font-righteous uppercase tracking-widest text-xs mt-4">GUEST PASS</p>
        </div>

        <div className="relative w-full max-w-lg">
          <div className="absolute inset-0 flex items-center mb-8">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center mb-8">
            <span className="bg-black px-4 text-slate-500 font-righteous uppercase tracking-widest text-sm">MEMBER LOGIN</span>
          </div>
        </div>

        <form onSubmit={handleAuth} className="w-full space-y-8 bg-[#050510] p-10 md:p-14 rounded-[4rem] border-4 border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)]"></div>


          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-base py-4 px-6 rounded-2xl font-black uppercase tracking-widest animate-pulse font-righteous">{authError}</div>}

          <div className="space-y-4">
            <label className="block text-base font-black text-slate-500 uppercase tracking-[0.3em] mb-3 text-left font-righteous ml-4">STAGE NAME</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stage Name"
              className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-8 py-5 text-white font-bold focus:border-[var(--neon-cyan)] outline-none transition-all shadow-inner text-2xl uppercase tracking-wider placeholder:text-slate-600 font-righteous"
            />
          </div>

          {!isLoginMode && (
            <div className="space-y-4">
              <label className="block text-base font-black text-slate-500 uppercase tracking-[0.3em] mb-3 text-left font-righteous ml-4">EMAIL (OPTIONAL)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="myname@emailserver.com"
                className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-8 py-5 text-white font-bold focus:border-[var(--neon-purple)] outline-none transition-all shadow-inner text-xl tracking-wider placeholder:text-slate-600 font-righteous"
              />
            </div>
          )}

          {/* 
          <div className="pt-2">
            <div id="google-signin-btn" className="w-full overflow-hidden rounded-2xl border-2 border-white/5 bg-white/5 grayscale hover:grayscale-0 transition-all"></div>
          </div>

          <div className="flex items-center gap-6 py-2 opacity-30">
            <div className="h-px flex-1 bg-white/30"></div>
            <span className="text-sm font-black uppercase tracking-widest font-righteous text-white">OR SIGN IN TO PROFILE</span>
            <div className="h-px flex-1 bg-white/30"></div>
          </div>
*/}

          <div className="space-y-4">
            <label className="block text-base font-black text-slate-500 uppercase tracking-[0.3em] mb-3 text-left font-righteous ml-4">PASSWORD</label>
            <input
              type="password"
              required={!isLoginMode}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-8 py-5 text-white font-bold focus:border-[var(--neon-pink)] outline-none transition-all shadow-inner text-3xl tracking-wider placeholder:text-slate-600 font-righteous"
            />
          </div>

          {!isLoginMode && (
            <div className="space-y-4">
              <label className="block text-base font-black text-slate-500 uppercase tracking-[0.3em] mb-3 text-left font-righteous ml-4">CONFIRM PASSWORD</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-8 py-5 text-white font-bold focus:border-[var(--neon-pink)] outline-none transition-all shadow-inner text-3xl tracking-wider placeholder:text-slate-600 font-righteous"
              />
            </div>
          )}

          <button type="submit" className="w-full py-6 mt-6 bg-[var(--neon-pink)] hover:bg-white hover:text-black text-white rounded-2xl font-black text-3xl shadow-[0_0_40px_rgba(255,0,127,0.3)] transition-all uppercase tracking-[0.2em] font-bungee hover:scale-[1.02] active:scale-95">
            {isLoginMode ? 'SIGN IN' : 'CREATE PROFILE'}
          </button>

          <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} className="text-slate-600 hover:text-[var(--neon-cyan)] text-sm font-black uppercase tracking-[0.3em] pt-6 block mx-auto transition-colors font-righteous border-b-2 border-transparent hover:border-[var(--neon-cyan)] pb-1">
            {isLoginMode ? "CREATE ACCOUNT" : "BACK TO START"}
          </button>
        </form>
      </div>
    );
  }

  if (!session) return null;

  const myRequests = session.requests.filter(r => r.participantId === participant.id);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-10 relative">
      {/* Tropical Profile Header */}
      <header className="relative rounded-[3rem] p-1 overflow-hidden shadow-2xl group">
        <div className="absolute inset-0 bg-[#0a0a0a] rounded-[2.9rem]"></div>
        <div className="absolute top-0 inset-x-0 h-32 bg-[var(--neon-purple)]/10 blur-[50px]"></div>

        <div className="relative p-8 flex flex-col items-center text-center">
          <div className="absolute top-6 right-6 z-20">
            {/* Authorized Node Badge Removed, Sign Out moved here */}
          </div>

          <div className="w-24 h-24 p-1 rounded-full border-2 border-white/10 mb-6 relative">
            <div className="absolute inset-0 rounded-full bg-[var(--neon-pink)]/20 blur-xl"></div>
            <img src="IGK.jpeg" alt="Logo" className="w-full h-full rounded-full object-cover relative z-10" />
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-black rounded-full flex items-center justify-center border-2 border-black z-20">
              <div className={`w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_currentColor] ${connectionStatus === 'connected' ? 'bg-[var(--neon-green)] text-[var(--neon-green)]' : connectionStatus === 'connecting' ? 'bg-[var(--neon-yellow)] text-[var(--neon-yellow)]' : 'bg-rose-500 text-rose-500'}`}></div>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-white tracking-tight uppercase leading-none font-bungee mb-2">{participant.name}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                askConfirm('Are you sure you want to sign out?', async () => {
                  await logoutUser();
                  window.location.reload();
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all font-black uppercase text-[10px] tracking-widest font-righteous border border-rose-500/20 hover:border-transparent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              SIGN OUT
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 w-full max-w-xs mx-auto mt-8">
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 w-full group hover:border-[var(--neon-cyan)] transition-all">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest font-righteous">VOICE TYPE</span>
                <span className="text-base font-bold text-[var(--neon-cyan)] uppercase font-righteous tracking-wider">{userProfile?.vocalRange || 'UNKNOWN'}</span>
              </div>
              {isScanning ? (
                <div className="space-y-2 py-1">
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--neon-cyan)] animate-pulse shadow-[0_0_10px_var(--neon-cyan)]" style={{ width: `${scanProgress}%` }}></div>
                  </div>
                  <div className="text-xs text-[var(--neon-cyan)] font-black animate-pulse font-righteous text-center">ANALYZING_PITCH_WAVETABLE...</div>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setIsScanning(true);
                    let progress = 0;
                    const interval = setInterval(() => {
                      progress += 5;
                      setScanProgress(progress);
                      if (progress >= 100) {
                        clearInterval(interval);
                        setTimeout(async () => {
                          const ranges: ('Soprano' | 'Alto' | 'Tenor' | 'Baritone' | 'Bass')[] = ['Soprano', 'Alto', 'Tenor', 'Baritone', 'Bass'];
                          const randomRange = ranges[Math.floor(Math.random() * ranges.length)];
                          if (userProfile) await updateVocalRange(userProfile.id, randomRange);
                          setIsScanning(false);
                          setScanProgress(0);
                          await refresh();
                        }, 500);
                      }
                    }, 100);
                  }}
                  className="w-full text-center py-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--neon-cyan)] hover:text-white transition-colors font-righteous"
                >
                  [ TAP TO CALIBRATE ]
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Live On Stage - Palm Glow */}
      {session.currentRound && session.currentRound.length > 0 && (
        <section className="animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-4 px-4">
            <div className="w-2 h-2 bg-[var(--neon-green)] rounded-full animate-blink"></div>
            <h3 className="text-[var(--neon-green)] font-black uppercase tracking-[0.3em] text-base font-righteous">ON STAGE</h3>
          </div>
          <div className="flex flex-col gap-3">
            {session.currentRound.map((song, i) => (
              <div
                key={song.id}
                className={`p-3 pl-6 pr-4 rounded-xl border-l-8 transition-all duration-300 flex items-center justify-between gap-4 w-full shadow-lg relative overflow-hidden group ${i === 0
                  ? 'bg-[#001005] border-l-[var(--neon-green)] border-y border-r border-[#1a3320] z-10 scale-[1.01]'
                  : 'bg-[#0a0a10] border-l-slate-700 border-y border-r border-white/10 opacity-70 hover:opacity-100'
                  }`}
              >
                {/* Strip Background Grid Lines */}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,rgba(255,255,255,0.03)_50%,transparent_51%)] bg-[length:50px_100%] pointer-events-none"></div>

                {/* Left Side: Info Strip */}
                <div className="flex items-center gap-6 min-w-0 flex-1 z-10">
                  {/* ID Box */}
                  <div className="relative">
                    {i === 0 && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[var(--neon-green)] text-black text-[8px] font-black uppercase tracking-[0.2em] rounded animate-pulse shadow-[0_0_10px_var(--neon-green)] z-20">
                        LIVE
                      </div>
                    )}
                    <div className={`w-14 h-14 flex flex-col justify-center items-center border-2 rounded-xl transition-all shrink-0 ${i === 0 ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/10 text-[var(--neon-green)]' : 'border-white/10 text-slate-400'}`}>
                      <span className="text-xl font-bold font-mono tracking-tighter">
                        {song.requestNumber}
                      </span>
                    </div>
                  </div>

                  {/* Main Info */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6 min-w-0 flex-1">
                    <h3 className={`text-xl sm:text-2xl font-black uppercase font-righteous tracking-tight leading-tight ${i === 0 ? 'text-white' : 'text-slate-300'}`}>
                      {song.songName}
                    </h3>
                    <div className="flex items-center gap-2 sm:gap-3 opacity-80 shrink-0">
                      <span className="text-sm sm:text-lg font-bold font-righteous text-[var(--neon-cyan)] uppercase tracking-wider">{song.artist}</span>
                      <span className="text-slate-600 font-mono text-lg hidden sm:inline">/</span>
                      <span className="text-sm sm:text-lg font-bold font-righteous text-[var(--neon-pink)] uppercase tracking-wider">@{song.participantName}</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Status/Link */}
                <div className="flex items-center gap-3 z-10 pl-4 border-l border-white/10 bg-gradient-to-l from-black/80 to-transparent">
                  {i === 0 && <VideoLink url={song.youtubeUrl} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Retro Arcade Tabs */}
      <div className="grid grid-cols-5 gap-2 bg-[#0a0a0a] p-2 rounded-2xl border border-white/5 shadow-inner">
        {(['ROTATION', 'REQUESTS', 'FAVORITES', 'HISTORY', 'VOCALS'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-righteous flex flex-col items-center justify-center gap-1.5 ${activeTab === tab
              ? 'bg-[#151520] text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10'
              : 'text-slate-600 hover:text-white hover:bg-white/5'
              }`}
          >
            <span className={`text-2xl mb-0.5 ${activeTab === tab ? 'text-[var(--neon-pink)]' : 'grayscale opacity-50'}`}>
              {tab === 'ROTATION' ? '💿' : tab === 'REQUESTS' ? '📼' : tab === 'FAVORITES' ? '⭐' : tab === 'HISTORY' ? '📜' : '🎤'}
            </span>
            {tab === 'ROTATION' ? 'STAGE' :
              tab === 'REQUESTS' ? 'MY SONGS' :
                tab === 'FAVORITES' ? 'SONGBOOK' :
                  tab === 'HISTORY' ? 'LOG' : 'MIC SETUP'}
          </button>
        ))}
      </div>

      <button
        onClick={() => { setPrefillData(null); setShowRequestForm(true); }}
        className="w-full py-8 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-blue)] text-white rounded-[2.5rem] font-black text-4xl shadow-[0_0_60px_rgba(255,0,127,0.4)] uppercase tracking-[0.1em] active:scale-95 transition-all font-bungee hover:brightness-110 border-4 border-white/10 animate-pulse"
      >
        SING!
      </button>

      <div className="flex gap-4 pt-2">
        <button
          onClick={() => setStatus(ParticipantStatus.READY)}
          className={`flex-1 py-4 rounded-[1.5rem] font-bold text-xl uppercase tracking-wider transition-all border-2 flex items-center justify-center gap-2 group relative overflow-hidden font-bungee ${participant.status === ParticipantStatus.READY
            ? 'bg-[#051005] border-[var(--neon-green)] shadow-[0_0_30px_rgba(0,255,157,0.2)] text-[var(--neon-green)]'
            : 'bg-[#101015] border-white/5 text-slate-700 hover:border-white/10'
            }`}
        >
          <span className="relative z-10">READY</span>
        </button>

        <button
          onClick={() => setStatus(ParticipantStatus.STANDBY)}
          className={`flex-1 py-4 rounded-[1.5rem] font-bold text-xl uppercase tracking-wider transition-all border-2 flex items-center justify-center gap-2 group relative overflow-hidden font-bungee ${participant.status === ParticipantStatus.STANDBY
            ? 'bg-[#150505] border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.2)] text-rose-500'
            : 'bg-[#101015] border-white/5 text-slate-700 hover:border-white/10'
            }`}
        >
          <span className="relative z-10">NOT YET</span>
        </button>
      </div>

      {(showRequestForm || editingRequest) && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-50 overflow-y-auto backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="w-full max-w-lg space-y-6">
            <SongRequestForm
              key={editingRequest?.id || 'new-request'}
              title={editingRequest ? "Remix Request" : "New Transmission"}
              submitLabel={editingRequest ? "Save Remix" : "Transmit"}
              initialSongName={editingRequest?.songName || prefillData?.songName || ''}
              initialArtist={editingRequest?.artist || prefillData?.artist || ''}
              initialYoutubeUrl={editingRequest?.youtubeUrl || prefillData?.youtubeUrl || ''}
              initialType={editingRequest?.type || prefillData?.type || RequestType.SINGING}
              onSubmit={handleRequest}
              onCancel={closeModals}
              participants={session.participants}
              currentUserId={participant.id}
            />
          </div>
        </div>
      )}

      <main className="min-h-[300px] pb-32">
        {activeTab === 'ROTATION' && (
          <section className="animate-in slide-in-from-bottom-8 duration-500 space-y-6">
            <h3 className="text-[var(--neon-green)] font-black uppercase tracking-[0.3em] text-sm px-4 font-righteous opacity-80">COMING UP</h3>
            <div className="space-y-4">
              {(() => {
                // Custom Interleaved Sorting Logic (Matching DJ View)
                const pendingRequests = session.requests.filter(r => r.status === RequestStatus.PENDING && !r.isInRound);
                const approvedSingingRaw = session.requests.filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING && !r.isInRound);

                const participantsWithSongs = session.participants.filter(p => approvedSingingRaw.some(r => r.participantId === p.id))
                  .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0)); // Rank by Newest First

                const requestsByParticipant: { [key: string]: SongRequest[] } = {};
                approvedSingingRaw.forEach(r => {
                  if (!requestsByParticipant[r.participantId]) requestsByParticipant[r.participantId] = [];
                  requestsByParticipant[r.participantId].push(r);
                });

                Object.keys(requestsByParticipant).forEach(pid => {
                  requestsByParticipant[pid].sort((a, b) => a.createdAt - b.createdAt);
                });

                const approvedSinging: SongRequest[] = [];
                let round = 0;
                let hasMore = true;
                while (hasMore) {
                  hasMore = false;
                  participantsWithSongs.forEach(p => {
                    if (requestsByParticipant[p.id] && requestsByParticipant[p.id][round]) {
                      approvedSinging.push(requestsByParticipant[p.id][round]);
                      hasMore = true;
                    }
                  });
                  round++;
                }

                if (approvedSinging.length === 0) return (
                  <div className="text-center py-16 opacity-30 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/20">
                    <p className="text-sm font-black uppercase tracking-[0.4em] font-righteous text-slate-600">QUEUE EMPTY</p>
                  </div>
                );

                return approvedSinging.map((req, i) => (
                  <div key={req.id} className="bg-[#101015] border-2 border-white/5 p-6 rounded-[2rem] flex justify-between items-center group hover:border-[var(--neon-blue)] transition-all">
                    <div className="min-w-0 pr-4">
                      <div className="text-white font-bold uppercase truncate text-2xl font-bungee tracking-tight mb-1 group-hover:text-[var(--neon-blue)] transition-colors">{req.songName}</div>
                      <div className="text-base text-[var(--neon-cyan)] uppercase tracking-[0.2em] flex items-center gap-2 font-righteous">
                        {req.artist} <span className="text-white/20">|</span> <span className="text-slate-400">{req.participantName}</span>
                      </div>
                    </div>
                    <div className="shrink-0 w-12 h-12 rounded-full border border-[var(--neon-blue)]/50 bg-[var(--neon-blue)]/10 flex items-center justify-center text-[var(--neon-blue)] text-xl font-black font-bungee shadow-[0_0_15px_rgba(5,217,232,0.2)]">
                      {i + 1}
                    </div>
                  </div>
                ));
              })()}

            </div>
          </section>
        )}

        {activeTab === 'REQUESTS' && (
          <section className="animate-in slide-in-from-bottom-8 duration-500 space-y-4">
            {myRequests.map(req => (
              <div key={req.id} className="relative group">
                <div className="bg-[#151520] border-2 border-white/5 p-6 rounded-[2rem] hover:border-[var(--neon-pink)] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="font-bold text-white tracking-tight uppercase truncate font-bungee text-3xl group-hover:text-[var(--neon-pink)] transition-colors">
                          <span className="text-slate-500 mr-2 text-[11px] font-mono tracking-widest">#{req.requestNumber}</span>{req.songName}
                        </div>
                        <VideoLink url={req.youtubeUrl} />
                      </div>
                      <div className="text-base text-slate-400 font-bold uppercase tracking-[0.2em] truncate font-righteous">{req.artist}</div>
                    </div>
                    <div className={`shrink-0 px-3 py-1 rounded-lg border text-xs font-black uppercase tracking-widest ${req.status === RequestStatus.APPROVED
                      ? (req.isInRound ? 'bg-[var(--neon-green)] border-[var(--neon-green)] text-black animate-pulse shadow-[0_0_15px_var(--neon-green)]' : 'bg-[var(--neon-cyan)]/10 border-[var(--neon-cyan)] text-[var(--neon-cyan)]')
                      : 'border-white/10 text-slate-600'
                      }`}>
                      {req.status === RequestStatus.APPROVED ? (req.isInRound ? 'LIVE' : 'QUEUED') : 'PENDING'}
                    </div>
                  </div>
                  {(req.status === RequestStatus.PENDING || req.status === RequestStatus.APPROVED) && (
                    <div className="flex gap-3 pt-4 border-t border-white/5">
                      <div className="flex gap-1">
                        <button
                          onClick={async () => { await reorderMyRequests(participant.id, req.id, 'up'); await refresh(); }}
                          className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-white transition-all text-xl"
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={async () => { await reorderMyRequests(participant.id, req.id, 'down'); await refresh(); }}
                          className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-white transition-all text-xl"
                          title="Move Down"
                        >
                          ▼
                        </button>
                      </div>
                      <button onClick={() => setEditingRequest(req)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-black uppercase tracking-widest transition-all font-righteous text-white">EDIT</button>
                      <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="flex-1 py-3 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-sm font-black uppercase tracking-widest transition-all font-righteous text-rose-500">CANCEL</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {myRequests.length === 0 && (
              <div className="text-center py-20 bg-black/20 rounded-[3rem] border-2 border-dashed border-white/5">
                <p className="text-base font-black uppercase tracking-[0.5em] font-righteous text-slate-700">NO REQUESTS</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'FAVORITES' && userProfile && (
          <section className="animate-in slide-in-from-bottom-8 duration-500 space-y-6">
            <div className="relative group">
              <input
                type="text"
                placeholder="SEARCH SONGBOOK..."
                value={librarySearchQuery}
                onChange={(e) => setLibrarySearchQuery(e.target.value)}
                className="w-full bg-[#101015] border-2 border-white/10 rounded-[2rem] py-5 px-6 pl-14 text-xl font-bold uppercase tracking-wider text-white focus:outline-none focus:border-[var(--neon-pink)] transition-all font-righteous placeholder:text-slate-600 shadow-inner"
              />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-slate-600 group-focus-within:text-[var(--neon-pink)] transition-colors">🔍</span>
            </div>

            <div className="grid gap-3">
              {(() => {
                const combined = [
                  ...userProfile.favorites.map(f => ({ ...f, isFavorite: true })),
                  ...(session?.verifiedSongbook || [])
                    .filter(v => !userProfile.favorites.some(f => f.songName === v.songName && f.artist === v.artist))
                    .map(v => ({ ...v, isFavorite: false }))
                ].filter(song => !librarySearchQuery || song.songName.toLowerCase().includes(librarySearchQuery.toLowerCase()) || song.artist.toLowerCase().includes(librarySearchQuery.toLowerCase()));

                if (combined.length === 0) return <div className="text-center py-20 opacity-30 font-righteous text-sm uppercase tracking-widest text-slate-500">NO_MATCHES</div>;

                return combined.map(song => (
                  <div key={song.id} className="bg-[#101015] p-5 rounded-[2rem] flex justify-between items-center group border-2 border-white/5 hover:border-[var(--neon-yellow)] transition-all">
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-white font-bold uppercase truncate text-2xl font-bungee tracking-tight group-hover:text-[var(--neon-yellow)] transition-colors">{song.songName}</div>
                        {song.isFavorite && <span className="text-lg text-[var(--neon-yellow)] animate-pulse">★</span>}
                      </div>
                      <div className="text-sm text-slate-400 font-bold uppercase tracking-[0.2em] font-righteous">{song.artist}</div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { setPrefillData({ ...song }); setShowRequestForm(true); }} className="bg-[var(--neon-pink)] text-black px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all font-righteous shadow-[0_0_15px_rgba(255,0,127,0.3)] hover:scale-105 active:scale-95">ADD</button>
                      <button onClick={async () => { await toggleFavorite(song); await refresh(); }} className={`px-2 transition-colors ${song.isFavorite ? 'text-rose-500' : 'text-slate-700 hover:text-[var(--neon-yellow)]'}`}>{song.isFavorite ? '✕' : '★'}</button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </section>
        )}

        {activeTab === 'HISTORY' && userProfile && (
          <section className="animate-in slide-in-from-bottom-8 duration-500 space-y-4">
            {userProfile.personalHistory.map((h, i) => (
              <div key={i} className="bg-[#101015] p-6 rounded-[2rem] flex justify-between items-center border-2 border-white/5 hover:border-[var(--neon-purple)] group transition-all">
                <div className="min-w-0 pr-4">
                  <div className="text-white font-bold uppercase truncate text-2xl font-bungee tracking-tight mb-1 group-hover:text-[var(--neon-purple)] transition-colors">{h.songName}</div>
                  <div className="text-base text-[var(--neon-cyan)]/70 font-bold uppercase tracking-[0.2em] font-righteous">{h.artist}</div>
                </div>
                <button onClick={() => { setPrefillData({ ...h, type: RequestType.SINGING }); setShowRequestForm(true); }} className="text-slate-600 hover:text-white border border-white/5 hover:border-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all font-righteous">AGAIN</button>
              </div>
            ))}
            {userProfile.personalHistory.length === 0 && (
              <div className="text-center py-20 opacity-30 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/20">
                <p className="text-sm font-black uppercase tracking-[0.4em] font-righteous text-slate-600">NO HISTORY FOUND</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'VOCALS' && (
          <section className="animate-in slide-in-from-bottom-8 duration-500 space-y-6">
            <div className="bg-[#101015] border-2 border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group hover:border-[var(--neon-cyan)] transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
                <span className="text-5xl">🎤</span>
              </div>

              <h3 className="text-[var(--neon-cyan)] font-black uppercase tracking-[0.3em] font-righteous mb-6">VOCAL SETUP</h3>

              <div className="flex flex-col items-center gap-6">
                <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
                  <span className="text-sm font-black text-slate-500 uppercase tracking-widest font-righteous mb-2">SINGER RANGE</span>
                  <span className="text-4xl font-bold text-white uppercase font-bungee tracking-tight neon-text-glow-cyan">
                    {userProfile?.vocalRange || 'UNKNOWN'}
                  </span>
                </div>

                {isScanning ? (
                  <div className="w-full space-y-3 py-2">
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--neon-cyan)] animate-pulse shadow-[0_0_10px_var(--neon-cyan)]" style={{ width: `${scanProgress}%` }}></div>
                    </div>
                    <div className="text-xs text-[var(--neon-cyan)] font-black animate-pulse font-righteous text-center tracking-[0.2em]">CALIBRATING VOICE...</div>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setIsScanning(true);
                      let progress = 0;
                      const interval = setInterval(() => {
                        progress += 5;
                        setScanProgress(progress);
                        if (progress >= 100) {
                          clearInterval(interval);
                          setTimeout(async () => {
                            const ranges: ('Soprano' | 'Alto' | 'Tenor' | 'Baritone' | 'Bass')[] = ['Soprano', 'Alto', 'Tenor', 'Baritone', 'Bass'];
                            const randomRange = ranges[Math.floor(Math.random() * ranges.length)];
                            if (userProfile) await updateVocalRange(userProfile.id, randomRange);
                            setIsScanning(false);
                            setScanProgress(0);
                            await refresh();
                          }, 500);
                        }
                      }, 100);
                    }}
                    className="px-8 py-4 bg-[var(--neon-cyan)]/10 hover:bg-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:text-black rounded-xl font-black uppercase tracking-[0.2em] transition-all font-righteous border border-[var(--neon-cyan)]/30 hover:shadow-[0_0_20px_var(--neon-cyan)]"
                  >
                    START_CALIBRATION_SEQUENCE
                  </button>
                )}
              </div>
            </div>

            <div className="bg-[#101015] border-2 border-white/5 rounded-[2.5rem] p-8 opacity-50 relative overflow-hidden border-dashed">
              <h3 className="text-slate-500 font-black uppercase tracking-[0.3em] font-righteous mb-2">MICROPHONE_TOOLS</h3>
              <p className="text-slate-600 font-mono text-xs uppercase tracking-wider">
                HARDWARE_LINK_OFFLINE // COMING_SOON
              </p>
            </div>
          </section>
        )}
      </main>


      <footer className="fixed bottom-6 left-6 right-6 z-40 flex gap-4">
        <button
          onClick={() => setShowSessionScanner(true)}
          className="flex-1 bg-[#101015] border-2 border-[var(--neon-green)]/30 p-4 rounded-[2rem] flex items-center justify-between px-8 shadow-2xl hover:bg-[var(--neon-green)] hover:text-black hover:border-[var(--neon-green)] transition-all group"
        >
          <span className="text-sm font-black uppercase tracking-[0.3em] font-righteous group-hover:text-black text-[var(--neon-green)]">SCAN_NODES</span>
          <span className="text-2xl group-hover:scale-125 transition-transform">📡</span>
        </button>

        <button
          onClick={() => setShowQrModal(true)}
          className="flex-1 bg-[#101015] border-2 border-white/10 p-4 rounded-[2rem] flex items-center justify-between px-8 shadow-2xl hover:border-[var(--neon-pink)] transition-all group"
        >
          <span className="text-sm text-[var(--neon-pink)] font-black uppercase tracking-[0.3em] font-righteous">SYSTEM_LINK</span>
          <div className="flex items-center gap-3">
            <span className="text-2xl group-hover:scale-125 transition-transform">📲</span>
          </div>
        </button>
      </footer>

      {showSessionScanner && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-8 z-[200] animate-in zoom-in-95 duration-300">
          <div className="w-full max-w-4xl text-center relative bg-[#050510] border-4 border-white/10 rounded-[3rem] p-4 md:p-10 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-green)] via-[var(--neon-cyan)] to-[var(--neon-blue)] animate-gradient-x"></div>
            <button onClick={() => setShowSessionScanner(false)} className="absolute top-6 right-6 text-slate-700 hover:text-white text-3xl transition-colors z-50">✕</button>

            <h3 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-8 font-bungee neon-glow-green mt-8">ACTIVE_SIGNALS</h3>

            <SessionList onJoin={(id) => {
              window.location.href = `/?room=${id}`;
            }} />
          </div>
        </div>
      )}

      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-8 z-[200] animate-in zoom-in-95 duration-300">
          <div className="w-full max-w-sm text-center relative bg-[#050510] border-4 border-white/10 rounded-[3rem] p-10 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] animate-gradient-x"></div>
            <button onClick={() => setShowQrModal(false)} className="absolute top-6 right-6 text-slate-700 hover:text-white text-3xl transition-colors">✕</button>
            <div className="bg-white p-4 rounded-[2rem] inline-block mb-8 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(roomJoinUrl)}&bgcolor=ffffff`} alt="Room QR" className="w-48 h-48" />
            </div>
            <h3 className="text-5xl font-black text-white uppercase tracking-tight mb-2 font-bungee neon-glow-white">SYNC_NODE</h3>
            <p className="text-[var(--neon-cyan)] text-sm font-black uppercase tracking-[0.4em] font-righteous opacity-80">SCAN TO INITIALIZE CONNECTION</p>
          </div>
        </div>
      )}
      {confirmState.isOpen && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[300] backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#050510] border-4 border-[var(--neon-pink)]/30 rounded-[3rem] p-10 text-center shadow-[0_0_100px_rgba(255,42,109,0.3)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--neon-pink)] shadow-[0_0_20px_rgba(255,42,109,0.8)]"></div>
            <div className="w-20 h-20 bg-[var(--neon-pink)]/10 text-[var(--neon-pink)] rounded-[2rem] border-2 border-[var(--neon-pink)]/20 flex items-center justify-center mx-auto mb-6 text-4xl font-black shadow-[0_0_30px_rgba(255,42,109,0.2)] animate-pulse">⚠️</div>
            <h2 className="text-5xl font-black text-white uppercase mb-4 tracking-tight font-bungee neon-text-glow-pink">CONFIRM</h2>
            <p className="text-slate-400 text-lg mb-8 leading-relaxed font-black font-righteous uppercase tracking-widest">
              {confirmState.message}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-4 bg-black border-2 border-white/10 text-white rounded-xl text-base font-black uppercase tracking-widest font-righteous transition-all hover:bg-white/5"
              >
                CANCEL
              </button>
              <button
                onClick={async () => {
                  setConfirmState(prev => ({ ...prev, isOpen: false }));
                  await confirmState.onConfirm();
                }}
                className="flex-[2] py-4 bg-[var(--neon-pink)] text-white rounded-xl text-base font-black uppercase tracking-widest font-righteous shadow-[0_0_30px_rgba(255,42,109,0.4)] transition-all hover:bg-rose-400 hover:scale-105"
              >
                PROCEED
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantView;
