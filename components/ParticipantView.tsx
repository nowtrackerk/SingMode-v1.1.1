

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
      className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
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
      <div className="max-w-md mx-auto p-8 flex flex-col items-center justify-center min-h-[85vh] text-center animate-in fade-in duration-700">
        <div className="w-40 h-40 flex items-center justify-center mb-10 shadow-2xl relative">
          <img src="IGK.jpeg" alt="Island Groove" className="w-full h-full rounded-full neon-border-pink shadow-[0_0_30px_rgba(255,20,147,0.5)]" />
        </div>
        <h1 className="text-4xl font-black font-bungee text-white mb-3 uppercase tracking-tighter neon-glow-pink">
          Activate <span className="rainbow-text">SingMode</span>
        </h1>
        <p className="text-cyan-400 font-righteous mb-10 uppercase tracking-widest text-[10px] font-bold neon-glow-cyan">Claim your session handle.</p>

        <form onSubmit={handleAuth} className="w-full space-y-5 bg-black/60 p-8 rounded-3xl border border-pink-500/30 shadow-3xl backdrop-blur-md">
          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[10px] py-3 px-4 rounded-xl font-black uppercase tracking-widest">{authError}</div>}
          <div>
            <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-3 text-left font-righteous">Your Handle</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VocalistPrime" className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:border-cyan-400 outline-none transition-all shadow-inner" />
          </div>

          <div className="pt-2">
            <div id="google-signin-btn" className="w-full overflow-hidden rounded-xl bg-white/5 border border-white/10"></div>
          </div>

          <div className="flex items-center gap-4 py-2 opacity-20">
            <div className="h-px flex-1 bg-white"></div>
            <span className="text-[10px] font-black uppercase tracking-widest">OR</span>
            <div className="h-px flex-1 bg-white"></div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-3 text-left font-righteous">Passkey (Optional)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold focus:border-cyan-400 outline-none transition-all shadow-inner" />
          </div>
          <button type="submit" className="w-full py-5 mt-4 bg-pink-500 text-white rounded-2xl font-black text-lg shadow-2xl shadow-pink-900/40 active:scale-95 transition-all uppercase tracking-widest neon-border-pink font-righteous">
            {isLoginMode ? 'Authorize' : 'Initialize'}
          </button>
          <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} className="text-slate-600 hover:text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] pt-6 block mx-auto">{isLoginMode ? "New User?" : "Back to Auth"}</button>
        </form>
      </div>
    );
  }

  if (!session) return null;

  const myRequests = session.requests.filter(r => r.participantId === participant.id);

  return (
    <div className="max-w-md mx-auto p-6 space-y-8 relative">
      <header className="bg-black/60 rounded-3xl p-8 border border-cyan-400/30 relative shadow-2xl overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 p-6">
          <button onClick={async () => { await logoutUser(); await refresh(); }} className="text-rose-500 hover:text-rose-400 text-[10px] font-black uppercase tracking-widest py-2 px-4 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl transition-all border border-rose-500/10">Log Out</button>
        </div>
        <div className="flex flex-col items-center text-center">
          <img src="IGK.jpeg" alt="Logo" className="w-20 h-20 rounded-full mb-4 neon-border-pink shadow-[0_0_15px_rgba(255,20,147,0.5)]" />
          <div className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-2 px-4 py-1 bg-cyan-400/5 rounded-full border border-cyan-400/10 neon-glow-cyan">Secure Connection</div>
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none mt-2 font-bungee neon-glow-pink">{participant.name}</h2>
          <div className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest mt-4 font-righteous neon-glow-yellow">Authorized Performer Account</div>
        </div>
      </header>



      {/* Persistent On Stage Now Section */}
      {session.currentRound && session.currentRound.length > 0 && (
        <section className="animate-in fade-in slide-in-from-top-2 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-ping shadow-[0_0_10px_var(--neon-pink)]"></div>
            <h3 className="text-white font-black uppercase tracking-widest text-[10px] font-righteous neon-glow-cyan">On Stage Now</h3>
          </div>
          <div className="grid gap-4">
            {session.currentRound.map((song, i) => (
              <div key={song.id} className={`bg-black/80 border p-6 rounded-3xl shadow-2xl transition-all backdrop-blur-sm ${i === 0 ? 'neon-border-pink ring-1 ring-pink-500/20' : 'border-white/10'}`}>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`font-black tracking-tight uppercase truncate font-outfit ${i === 0 ? 'text-white text-lg neon-glow-pink' : 'text-slate-300'}`}>
                        <span className="text-cyan-400 mr-2 text-sm opacity-50 font-normal">#{song.requestNumber}</span>{song.songName}
                      </div>
                      <VideoLink url={song.youtubeUrl} />
                    </div>
                    <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest truncate font-righteous">{song.artist}</div>
                    <div className="mt-3 text-[11px] font-black text-yellow-400 uppercase tracking-tighter neon-glow-yellow">{song.participantName}</div>
                  </div>
                  {i === 0 && (
                    <div className="px-3 py-1 bg-pink-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg shadow-pink-500/20 neon-pulse">LIVE</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/10 shadow-inner backdrop-blur-md">
        {(['ROTATION', 'REQUESTS', 'FAVORITES', 'HISTORY'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all font-righteous ${activeTab === tab ? 'bg-cyan-400 text-black shadow-xl shadow-cyan-900/20 neon-border-cyan' : 'text-slate-500 hover:text-cyan-400'
              }`}
          >
            {tab === 'ROTATION' ? 'Rotation' :
              tab === 'REQUESTS' ? 'Requests' :
                tab === 'FAVORITES' ? 'Library' :
                  tab === 'HISTORY' ? 'History' : tab}
          </button>
        ))}
      </div>

      <button
        onClick={() => { setPrefillData(null); setShowRequestForm(true); }}
        className="w-full py-5 bg-pink-500 text-white rounded-2xl font-black text-lg shadow-3xl shadow-pink-900/40 uppercase tracking-widest active:scale-95 transition-all neon-border-pink font-righteous"
      >
        + Queue Track
      </button>

      <div className="pt-4 space-y-8">
        <section className="flex justify-center">
          <button
            onClick={toggleStatus}
            className={`w-full py-8 rounded-[2.5rem] font-black text-2xl uppercase tracking-[0.2em] transition-all border-2 flex flex-col items-center justify-center gap-2 group shadow-2xl relative overflow-hidden font-bungee ${participant.status === ParticipantStatus.READY
              ? 'bg-cyan-400 text-black border-cyan-300 shadow-cyan-900/40 scale-105 neon-border-cyan'
              : 'bg-black text-slate-500 border-white/10 hover:border-cyan-400/50'
              }`}
          >
            {participant.status === ParticipantStatus.READY && (
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent opacity-50 group-hover:opacity-80 transition-opacity" />
            )}
            <span className="relative z-10">{participant.status === ParticipantStatus.READY ? 'IM READY' : 'CLICK TO START'}</span>
            <span className={`relative z-10 text-[10px] tracking-[0.4em] font-black font-righteous ${participant.status === ParticipantStatus.READY ? 'opacity-80' : 'opacity-30'}`}>
              {participant.status === ParticipantStatus.READY ? 'BROADCASTING STATUS' : 'CURRENTLY STANDBY'}
            </span>
          </button>
        </section>


      </div>

      {(showRequestForm || editingRequest) && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50 overflow-y-auto backdrop-blur-2xl">
          <div className="w-full max-w-md space-y-6 py-10">
            <SongRequestForm
              key={editingRequest?.id || 'new-request'}
              title={editingRequest ? "Modify Request" : "Request Mode"}
              submitLabel={editingRequest ? "Save Update" : "Add to Rotation"}
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

      <main className="min-h-[300px]">
        {activeTab === 'ROTATION' && (
          <section className="animate-in fade-in slide-in-from-bottom-2 space-y-8">
            {/* Rotation Queue Section */}
            <div className="space-y-4">
              <h3 className="text-slate-500 font-black uppercase tracking-widest text-[10px] px-2">Performance Queue</h3>
              <div className="space-y-3">
                {session.requests.filter(r => r.status === RequestStatus.APPROVED && !r.isInRound).length > 0 ? (
                  session.requests.filter(r => r.status === RequestStatus.APPROVED && !r.isInRound).map(req => (
                    <div key={req.id} className="bg-black/60 border border-white/10 p-5 rounded-2xl flex justify-between items-center group backdrop-blur-sm">
                      <div className="min-w-0 pr-2">
                        <div className="text-white font-bold uppercase truncate text-sm font-outfit">{req.songName}</div>
                        <div className="text-[9px] text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 font-righteous">
                          {req.artist} • <span className="text-pink-500/80">{req.participantName}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest bg-black text-cyan-400 border border-cyan-400/20 neon-glow-cyan">Approved</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 opacity-40 bg-black/40 rounded-3xl border border-dashed border-cyan-400/20">
                    <p className="text-[10px] font-black uppercase tracking-widest font-righteous text-cyan-400">No tracks in queue</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'REQUESTS' && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <div className="space-y-4">
              {myRequests.map(req => (
                <div key={req.id} className="bg-black/80 border border-white/10 p-6 rounded-3xl shadow-2xl transition-all hover:neon-border-cyan backdrop-blur-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-black text-white tracking-tight uppercase truncate font-outfit">
                          <span className="text-cyan-400 mr-2 text-sm opacity-50 font-normal">#{req.requestNumber}</span>{req.songName}
                        </div>
                        <VideoLink url={req.youtubeUrl} />
                      </div>
                      <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest truncate font-righteous">{req.artist} • <span className={req.type === RequestType.SINGING ? 'text-pink-500' : 'text-purple-400'}>{req.type}</span></div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2 shrink-0">
                      <div className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] border ${req.status === RequestStatus.APPROVED ? (req.isInRound ? 'bg-pink-500/10 text-pink-500 border-pink-500/20 neon-glow-pink' : 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20 neon-glow-cyan') : 'bg-black text-slate-600 border-white/10'}`}>
                        {req.status === RequestStatus.APPROVED ? (req.isInRound ? 'LIVE' : 'READY') : 'QUEUE'}
                      </div>
                      {req.status === RequestStatus.PENDING && (
                        <div className="flex gap-4">
                          <button onClick={() => setEditingRequest(req)} className="text-[9px] font-black text-cyan-400 hover:text-white uppercase tracking-widest underline underline-offset-4 font-righteous">Edit</button>
                          <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="text-[9px] font-black text-rose-500/60 hover:text-rose-500 uppercase tracking-widest px-2 font-righteous">Cancel</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {myRequests.length === 0 && (
                <div className="text-center py-20 opacity-40">
                  <p className="text-xs font-bold uppercase italic font-righteous text-cyan-400/50">Your rotation is empty</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'FAVORITES' && userProfile && (
          <section className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
            {/* Search Bar */}
            <div className="sticky top-0 z-20 pb-2">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="SEARCH SONGBOOK..."
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  className="w-full bg-black/80 border border-cyan-400/30 rounded-2xl py-4 pl-12 pr-4 text-xs font-black uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:neon-border-cyan transition-all backdrop-blur-xl font-righteous"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 group-focus-within:neon-glow-cyan transition-colors">🔍</span>
              </div>
            </div>

            <div className="space-y-4">
              {(() => {
                const combined = [
                  ...userProfile.favorites.map(f => ({ ...f, isFavorite: true })),
                  ...(session?.verifiedSongbook || [])
                    .filter(v => !userProfile.favorites.some(f => f.songName === v.songName && f.artist === v.artist))
                    .map(v => ({ ...v, isFavorite: false }))
                ].filter(song => {
                  if (!librarySearchQuery) return true;
                  const query = librarySearchQuery.toLowerCase();
                  return song.songName.toLowerCase().includes(query) || song.artist.toLowerCase().includes(query);
                });

                if (combined.length === 0) {
                  return (
                    <div className="text-center py-20 opacity-20">
                      <p className="text-xs font-bold uppercase italic">{librarySearchQuery ? 'No matching tracks' : 'Library is empty'}</p>
                    </div>
                  );
                }

                return combined.map(song => (
                  <div key={song.id} className="bg-black/60 border border-white/10 p-5 rounded-3xl flex justify-between items-center group hover:neon-border-pink transition-all backdrop-blur-sm">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="text-white font-bold uppercase truncate font-outfit">{song.songName}</div>
                        {song.isFavorite && <span className="text-[10px]" title="Personal Favorite">⭐️</span>}
                      </div>
                      <div className="text-[9px] text-cyan-400 uppercase tracking-widest font-righteous">{song.artist}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setPrefillData({ ...song }); setShowRequestForm(true); }}
                        className="bg-pink-500 text-white px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-pink-500/10 active:scale-95 transition-all font-righteous neon-border-pink"
                      >
                        Add
                      </button>
                      {song.isFavorite ? (
                        <button
                          onClick={async () => { await toggleFavorite(song); await refresh(); }}
                          className="text-slate-600 hover:text-rose-500 px-2 transition-colors"
                          title="Remove from Favorites"
                        >
                          ✕
                        </button>
                      ) : (
                        <button
                          onClick={async () => { await toggleFavorite(song); await refresh(); }}
                          className="text-slate-600 hover:text-yellow-400 px-2 transition-colors neon-glow-yellow"
                          title="Add to Favorites"
                        >
                          +⭐️
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </section>
        )}

        {activeTab === 'HISTORY' && userProfile && (
          <section className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
            {userProfile.personalHistory.map((h, i) => (
              <div key={i} className="bg-black/60 border border-white/10 p-5 rounded-3xl flex justify-between items-center group backdrop-blur-sm hover:neon-border-yellow transition-all">
                <div className="min-w-0 pr-2">
                  <div className="text-white font-bold uppercase truncate font-outfit">
                    <span className="text-cyan-400 mr-2 text-sm opacity-50 font-normal">#{h.requestNumber}</span>{h.songName}
                  </div>
                  <div className="text-[9px] text-yellow-400 uppercase tracking-widest font-righteous">{h.artist}</div>
                </div>
                <button
                  onClick={() => { setPrefillData({ ...h, type: RequestType.SINGING }); setShowRequestForm(true); }}
                  className="bg-white/5 hover:bg-yellow-400 hover:text-black hover:border-yellow-400 text-white px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest border border-white/10 transition-all font-righteous"
                >
                  Repeat
                </button>
              </div>
            ))}
            {userProfile.personalHistory.length === 0 && (
              <div className="text-center py-20 opacity-20">
                <p className="text-xs font-bold uppercase italic">No performance history found</p>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="pt-8 pb-12">
        <button
          onClick={() => setShowQrModal(true)}
          className="w-full bg-black/60 backdrop-blur-xl border border-pink-500/20 hover:neon-border-pink p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 transition-all group shadow-2xl"
        >
          <div className="w-16 h-16 bg-pink-500/10 border border-pink-500/20 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">📱</div>
          <div className="text-center">
            <h4 className="text-xl font-black text-white uppercase tracking-tight font-bungee">Invite Friends to Sing</h4>
            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.2em] mt-1 group-hover:neon-glow-cyan transition-colors font-righteous">Tap to show session QR code</p>
          </div>
        </button>
      </footer>

      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 z-[200] animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-black border border-cyan-400/30 rounded-[3rem] p-10 shadow-3xl text-center relative overflow-hidden neon-border-cyan">
            <button onClick={() => setShowQrModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white font-black">✕</button>
            <div className="bg-white p-6 rounded-[2rem] inline-block mb-8 shadow-2xl">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(roomJoinUrl)}&bgcolor=ffffff`} alt="Room QR" className="w-56 h-56" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 leading-none font-bungee">Invite Others</h3>
            <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest mb-8 font-righteous neon-glow-yellow">Scan to join this SingMode session</p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-4 bg-cyan-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-cyan-900/20 font-righteous"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantView;
