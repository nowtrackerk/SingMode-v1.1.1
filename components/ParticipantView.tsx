

import React, { useState, useEffect, useRef } from 'react';
import { Participant, KaraokeSession, ParticipantStatus, RequestType, RequestStatus, SongRequest, UserProfile, FavoriteSong } from '../types';
// Fixed: Removed non-existent 'isFavorite' from imports.
import { getSession, joinSession, updateParticipantStatus, addRequest, deleteRequest, updateRequest, getUserProfile, toggleFavorite, saveUserProfile, registerUser, loginUser, logoutUser, updateParticipantMic } from '../services/sessionManager';
import SongRequestForm from './SongRequestForm';
import { syncService } from '../services/syncService';
import { getNetworkUrl } from '../services/networkUtils';


type Tab = 'ROTATION' | 'REQUESTS' | 'FAVORITES' | 'HISTORY';

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
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<KaraokeSession | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<SongRequest | null>(null);
  const [prefillData, setPrefillData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('ROTATION');

  const [showQrModal, setShowQrModal] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

  const roomId = syncService.getRoomId();
  const roomJoinUrl = getNetworkUrl() + (roomId ? `?room=${roomId}` : '');

  useEffect(() => {
    const init = async () => {
      const profile = await getUserProfile();
      if (profile) {
        setUserProfile(profile);
        const sess = await getSession();
        setSession(sess);
        const found = sess.participants.find(p => p.id === profile.id);
        if (found) {
          setParticipant(found);
        } else if (roomId) {
          // Automatic Re-entry for returning users
          console.log(`[Participant] Auto-joining session ${roomId} for profile ${profile.id}`);
          const newPart = await joinSession(profile.id);
          setParticipant(newPart);
        }
      } else {
        const sess = await getSession();
        setSession(sess);
      }
    };
    init();
  }, [roomId]);

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
        client_id: '66143419946-b6hnhf5p7d9m8a1n7u1t3f6h1b1m2n3p.apps.googleusercontent.com', // Placeholder
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
        const result = await registerUser({ name, password: password || undefined }, true);
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
    // if (newStatus === ParticipantStatus.STANDBY && micStream) {
    //   stopMic();
    //   await updateParticipantMic(participant.id, false);
    // }
    await refresh();
  };

  const handleRequest = async (data: any) => {
    if (!participant) return;
    if (editingRequest) {
      await updateRequest(editingRequest.id, { songName: data.songName, artist: data.artist, youtubeUrl: data.youtubeUrl, type: data.type });
      setEditingRequest(null);
    } else {
      await addRequest({ participantId: participant.id, participantName: participant.name, songName: data.songName, artist: data.artist, youtubeUrl: data.youtubeUrl, type: data.type });
      setShowRequestForm(false);
    }
    setPrefillData(null);
    await refresh();
  };

  const closeModals = () => { setShowRequestForm(false); setEditingRequest(null); setPrefillData(null); };

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

        <h1 className="text-6xl md:text-8xl font-black font-bungee text-white mb-6 uppercase tracking-tighter neon-text-glow-purple leading-none">
          SINGMODE
        </h1>
        <p className="text-[var(--neon-cyan)] font-righteous mb-16 uppercase tracking-[0.6em] text-xs font-black neon-glow-cyan">AUTHORIZED_ACCESS_REQUIRED</p>

        <form onSubmit={handleAuth} className="w-full space-y-8 bg-[#050510] p-10 md:p-14 rounded-[4rem] border-4 border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)]"></div>

          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[10px] py-4 px-6 rounded-2xl font-black uppercase tracking-widest animate-pulse font-righteous">{authError}</div>}

          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 text-left font-righteous ml-4">USER_IDENTITY</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ENTER_HANDLE"
              className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-8 py-5 text-white font-black focus:border-[var(--neon-cyan)] outline-none transition-all shadow-inner text-lg uppercase tracking-widest placeholder:text-slate-800 font-righteous"
            />
          </div>

          <div className="pt-2">
            <div id="google-signin-btn" className="w-full overflow-hidden rounded-2xl border-2 border-white/5 bg-white/5 grayscale hover:grayscale-0 transition-all"></div>
          </div>

          <div className="flex items-center gap-6 py-2 opacity-30">
            <div className="h-px flex-1 bg-white/30"></div>
            <span className="text-[9px] font-black uppercase tracking-widest font-righteous text-white">OR_USE_KEY</span>
            <div className="h-px flex-1 bg-white/30"></div>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 text-left font-righteous ml-4">PASS_ENCRYPTION</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#101015] border-2 border-white/10 rounded-2xl px-8 py-5 text-white font-black focus:border-[var(--neon-pink)] outline-none transition-all shadow-inner text-xl tracking-widest placeholder:text-slate-800 font-rightous"
            />
          </div>

          <button type="submit" className="w-full py-6 mt-6 bg-[var(--neon-pink)] hover:bg-white hover:text-black text-white rounded-2xl font-black text-xl shadow-[0_0_40px_rgba(255,0,127,0.3)] transition-all uppercase tracking-[0.2em] font-bungee hover:scale-[1.02] active:scale-95">
            {isLoginMode ? 'AUTHORIZE' : 'INITIALIZE'}
          </button>

          <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} className="text-slate-600 hover:text-[var(--neon-cyan)] text-[9px] font-black uppercase tracking-[0.3em] pt-6 block mx-auto transition-colors font-righteous border-b-2 border-transparent hover:border-[var(--neon-cyan)] pb-1">
            {isLoginMode ? "ROOT_ACCESS_NEW?" : "BACK_TO_LOGIN"}
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
          <div className="absolute top-6 right-6">
            <button onClick={async () => { await logoutUser(); await refresh(); }} className="text-slate-700 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>

          <div className="w-24 h-24 p-1 rounded-full border-2 border-white/10 mb-6 relative">
            <div className="absolute inset-0 rounded-full bg-[var(--neon-pink)]/20 blur-xl"></div>
            <img src="IGK.jpeg" alt="Logo" className="w-full h-full rounded-full object-cover relative z-10" />
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-black rounded-full flex items-center justify-center border-2 border-black z-20">
              <div className="w-3 h-3 bg-[var(--neon-green)] rounded-full animate-pulse shadow-[0_0_10px_rgba(0,255,157,0.8)]"></div>
            </div>
          </div>

          <h2 className="text-4xl font-black text-white tracking-tight uppercase leading-none font-bungee mb-2">{participant.name}</h2>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-[var(--neon-cyan)] font-black uppercase tracking-[0.3em] font-righteous bg-[var(--neon-cyan)]/10 px-3 py-1 rounded-lg border border-[var(--neon-cyan)]/20">AUTHORIZED_NODE</span>
          </div>
        </div>
      </header>

      {/* Live On Stage - Palm Glow */}
      {session.currentRound && session.currentRound.length > 0 && (
        <section className="animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-4 px-4">
            <div className="w-2 h-2 bg-[var(--neon-yellow)] rounded-full animate-blink"></div>
            <h3 className="text-[var(--neon-yellow)] font-black uppercase tracking-[0.3em] text-[10px] font-righteous">CURRENT_WAVEFORM</h3>
          </div>
          <div className="space-y-4">
            {session.currentRound.map((song, i) => (
              <div key={song.id} className={`relative overflow-hidden rounded-[2.5rem] transition-all duration-500 ${i === 0 ? 'border-2 border-[var(--neon-yellow)] shadow-[0_0_30px_rgba(255,255,0,0.1)]' : 'opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'}`}>
                <div className={`relative bg-[#101015] p-6 rounded-[2.4rem] flex justify-between items-center z-10 ${i === 0 ? 'bg-[#151520]' : ''}`}>
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-3 mb-2">
                      {i === 0 && <span className="text-[9px] bg-[var(--neon-pink)] text-white px-2 py-0.5 rounded font-black uppercase tracking-widest font-righteous rotate-[-2deg] shadow-lg">LIVE</span>}
                      <div className={`font-black uppercase truncate font-bungee ${i === 0 ? 'text-xl text-white' : 'text-lg text-slate-500'}`}>
                        {song.songName}
                      </div>
                    </div>
                    <div className="text-[10px] text-[var(--neon-cyan)] font-black uppercase tracking-[0.3em] truncate font-righteous">{song.artist}</div>
                    <div className="mt-2 text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">@{song.participantName}</div>
                  </div>
                  {i === 0 && <VideoLink url={song.youtubeUrl} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Retro Arcade Tabs */}
      <div className="grid grid-cols-4 gap-2 bg-[#0a0a0a] p-2 rounded-2xl border border-white/5 shadow-inner">
        {(['ROTATION', 'REQUESTS', 'FAVORITES', 'HISTORY'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-4 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all font-righteous flex flex-col items-center justify-center gap-1.5 ${activeTab === tab
              ? 'bg-[#151520] text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10'
              : 'text-slate-600 hover:text-white hover:bg-white/5'
              }`}
          >
            <span className={`text-xl mb-0.5 ${activeTab === tab ? 'text-[var(--neon-pink)]' : 'grayscale opacity-50'}`}>
              {tab === 'ROTATION' ? '💿' : tab === 'REQUESTS' ? '📼' : tab === 'FAVORITES' ? '⭐' : '📜'}
            </span>
            {tab === 'ROTATION' ? 'LIVE' :
              tab === 'REQUESTS' ? 'MY_SET' :
                tab === 'FAVORITES' ? 'FAVS' : 'LOG'}
          </button>
        ))}
      </div>

      <button
        onClick={() => { setPrefillData(null); setShowRequestForm(true); }}
        className="w-full py-6 bg-gradient-to-r from-[var(--neon-blue)] to-[var(--neon-purple)] text-white rounded-[2rem] font-black text-lg shadow-[0_0_40px_rgba(93,0,255,0.3)] uppercase tracking-[0.2em] active:scale-95 transition-all font-bungee hover:brightness-110 border-2 border-white/10"
      >
        + REQUEST TRACK
      </button>

      <div className="pt-2">
        <button
          onClick={toggleStatus}
          className={`w-full py-8 rounded-[2.5rem] font-black text-2xl uppercase tracking-[0.2em] transition-all border-2 flex flex-col items-center justify-center gap-2 group relative overflow-hidden font-bungee ${participant.status === ParticipantStatus.READY
            ? 'bg-[#051005] border-[var(--neon-green)] shadow-[0_0_30px_rgba(0,255,157,0.1)]'
            : 'bg-[#101015] border-white/5 text-slate-700 hover:border-white/10'
            }`}
        >
          <span className={`relative z-10 ${participant.status === ParticipantStatus.READY ? 'text-[var(--neon-green)]' : 'text-slate-600'}`}>
            {participant.status === ParticipantStatus.READY ? 'STAGE_READY' : 'GO_OFFLINE'}
          </span>
          <span className={`relative z-10 text-[9px] font-righteous tracking-[0.4em] uppercase ${participant.status === ParticipantStatus.READY ? 'text-[var(--neon-green)] opacity-80' : 'text-slate-800'}`}>
            {participant.status === ParticipantStatus.READY ? 'MICROPHONE_LINK_ESTABLISHED' : 'STANDBY_MODE'}
          </span>
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
            />
          </div>
        </div>
      )}

      <main className="min-h-[300px] pb-32">
        {activeTab === 'ROTATION' && (
          <section className="animate-in slide-in-from-bottom-8 duration-500 space-y-6">
            <h3 className="text-[var(--neon-pink)] font-black uppercase tracking-[0.3em] text-[9px] px-4 font-righteous opacity-80">UPCOMING_WAVEFORM</h3>
            <div className="space-y-4">
              {session.requests.filter(r => r.status === RequestStatus.APPROVED && !r.isInRound).length > 0 ? (
                session.requests.filter(r => r.status === RequestStatus.APPROVED && !r.isInRound).map(req => (
                  <div key={req.id} className="bg-[#101015] border-2 border-white/5 p-6 rounded-[2rem] flex justify-between items-center group hover:border-[var(--neon-blue)] transition-all">
                    <div className="min-w-0 pr-4">
                      <div className="text-white font-black uppercase truncate text-lg font-bungee tracking-tight mb-1 group-hover:text-[var(--neon-blue)] transition-colors">{req.songName}</div>
                      <div className="text-[9px] text-[var(--neon-cyan)] uppercase tracking-[0.2em] flex items-center gap-2 font-righteous">
                        {req.artist} <span className="text-white/20">|</span> <span className="text-slate-500">{req.participantName}</span>
                      </div>
                    </div>
                    <div className="shrink-0 w-8 h-8 rounded-full border border-[var(--neon-blue)]/50 bg-[var(--neon-blue)]/10 flex items-center justify-center text-[var(--neon-blue)] text-xs shadow-[0_0_15px_rgba(5,217,232,0.2)]">✓</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 opacity-30 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/20">
                  <p className="text-[9px] font-black uppercase tracking-[0.4em] font-righteous text-slate-600">SILENCE_DETECTED</p>
                </div>
              )}
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
                        <div className="font-black text-white tracking-tight uppercase truncate font-bungee text-xl group-hover:text-[var(--neon-pink)] transition-colors">
                          <span className="text-slate-700 mr-2 text-[10px] font-mono tracking-widest">#{req.requestNumber}</span>{req.songName}
                        </div>
                        <VideoLink url={req.youtubeUrl} />
                      </div>
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] truncate font-righteous">{req.artist}</div>
                    </div>
                    <div className={`shrink-0 px-3 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${req.status === RequestStatus.APPROVED
                      ? (req.isInRound ? 'bg-[var(--neon-pink)] border-[var(--neon-pink)] text-black animate-pulse' : 'bg-[var(--neon-cyan)]/10 border-[var(--neon-cyan)] text-[var(--neon-cyan)]')
                      : 'border-white/10 text-slate-600'
                      }`}>
                      {req.status === RequestStatus.APPROVED ? (req.isInRound ? 'LIVE' : 'QUEUED') : 'PENDING'}
                    </div>
                  </div>
                  {req.status === RequestStatus.PENDING && (
                    <div className="flex gap-3 pt-4 border-t border-white/5">
                      <button onClick={() => setEditingRequest(req)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all font-righteous text-white">EDIT</button>
                      <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="flex-1 py-3 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all font-righteous text-rose-500">CANCEL</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {myRequests.length === 0 && (
              <div className="text-center py-20 bg-black/20 rounded-[3rem] border-2 border-dashed border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] font-righteous text-slate-700">NO_DATA_STREAM</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'FAVORITES' && userProfile && (
          <section className="animate-in slide-in-from-bottom-8 duration-500 space-y-6">
            <div className="relative group">
              <input
                type="text"
                placeholder="SEARCH ARCHIVE..."
                value={librarySearchQuery}
                onChange={(e) => setLibrarySearchQuery(e.target.value)}
                className="w-full bg-[#101015] border-2 border-white/10 rounded-[2rem] py-5 px-6 pl-14 text-xs font-black uppercase tracking-[0.2em] text-white focus:outline-none focus:border-[var(--neon-pink)] transition-all font-righteous placeholder:text-slate-700 shadow-inner"
              />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-lg text-slate-600 group-focus-within:text-[var(--neon-pink)] transition-colors">🔍</span>
            </div>

            <div className="grid gap-3">
              {(() => {
                const combined = [
                  ...userProfile.favorites.map(f => ({ ...f, isFavorite: true })),
                  ...(session?.verifiedSongbook || [])
                    .filter(v => !userProfile.favorites.some(f => f.songName === v.songName && f.artist === v.artist))
                    .map(v => ({ ...v, isFavorite: false }))
                ].filter(song => !librarySearchQuery || song.songName.toLowerCase().includes(librarySearchQuery.toLowerCase()) || song.artist.toLowerCase().includes(librarySearchQuery.toLowerCase()));

                if (combined.length === 0) return <div className="text-center py-20 opacity-30 font-righteous text-[9px] uppercase tracking-widest text-slate-500">NO_MATCHES</div>;

                return combined.map(song => (
                  <div key={song.id} className="bg-[#101015] p-5 rounded-[2rem] flex justify-between items-center group border-2 border-white/5 hover:border-[var(--neon-yellow)] transition-all">
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-white font-black uppercase truncate text-base font-bungee tracking-tight group-hover:text-[var(--neon-yellow)] transition-colors">{song.songName}</div>
                        {song.isFavorite && <span className="text-xs text-[var(--neon-yellow)] animate-pulse">★</span>}
                      </div>
                      <div className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] font-righteous">{song.artist}</div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { setPrefillData({ ...song }); setShowRequestForm(true); }} className="bg-[var(--neon-pink)] text-black px-4 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest hover:bg-white transition-all font-righteous shadow-[0_0_15px_rgba(255,0,127,0.3)] hover:scale-105 active:scale-95">ADD</button>
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
                  <div className="text-white font-black uppercase truncate text-lg font-bungee tracking-tight mb-1 group-hover:text-[var(--neon-purple)] transition-colors">{h.songName}</div>
                  <div className="text-[9px] text-[var(--neon-cyan)]/70 font-black uppercase tracking-[0.2em] font-righteous">{h.artist}</div>
                </div>
                <button onClick={() => { setPrefillData({ ...h, type: RequestType.SINGING }); setShowRequestForm(true); }} className="text-slate-600 hover:text-white border border-white/5 hover:border-white px-4 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all font-righteous">AGAIN</button>
              </div>
            ))}
            {userProfile.personalHistory.length === 0 && (
              <div className="text-center py-20 opacity-30 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/20">
                <p className="text-[9px] font-black uppercase tracking-[0.4em] font-righteous text-slate-600">NO_HISTORY_LOGS</p>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="fixed bottom-6 left-6 right-6 z-40">
        <button
          onClick={() => setShowQrModal(true)}
          className="w-full bg-[#101015] border-2 border-white/10 p-4 rounded-[2rem] flex items-center justify-between px-8 shadow-2xl hover:border-[var(--neon-pink)] transition-all group"
        >
          <span className="text-[9px] text-[var(--neon-pink)] font-black uppercase tracking-[0.3em] font-righteous">SYSTEM_LINK</span>
          <div className="flex items-center gap-3">
            <span className="text-white font-black uppercase tracking-tight font-bungee">INVITE FRIEND</span>
            <span className="text-lg group-hover:scale-125 transition-transform">📲</span>
          </div>
        </button>
      </footer>

      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-8 z-[200] animate-in zoom-in-95 duration-300">
          <div className="w-full max-w-sm text-center relative bg-[#050510] border-4 border-white/10 rounded-[3rem] p-10 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] animate-gradient-x"></div>
            <button onClick={() => setShowQrModal(false)} className="absolute top-6 right-6 text-slate-700 hover:text-white text-xl transition-colors">✕</button>
            <div className="bg-white p-4 rounded-[2rem] inline-block mb-8 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(roomJoinUrl)}&bgcolor=ffffff`} alt="Room QR" className="w-48 h-48" />
            </div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2 font-bungee neon-glow-white">SYNC_NODE</h3>
            <p className="text-[var(--neon-cyan)] text-[9px] font-black uppercase tracking-[0.4em] font-righteous opacity-80">SCAN TO INITIALIZE CONNECTION</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantView;
