import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KaraokeSession, RequestStatus, ParticipantStatus, SongRequest, Participant, RequestType, UserProfile, FavoriteSong, VerifiedSong } from '../types';
import {
  getSession, approveRequest, promoteToStage, deleteRequest, reorderRequest,
  generateRound, finishRound, addRequest, updateRequest,
  updateParticipantStatus, updateParticipantMic, removeParticipant,
  reAddFromHistory, clearHistory, getAllAccounts, updateAccount,
  deleteAccount, registerUser, joinSession, removeUserFavorite, updateUserFavorite,
  addUserFavorite, getUserProfile, setStageVideoPlaying, rotateStageSong, completeStageSong,
  resetSession, removeUserHistoryItem, updateUserHistoryItem,
  addVerifiedSong, updateVerifiedSong, deleteVerifiedSong,
  reorderCurrentRound, reorderRequests, reorderPendingRequests
} from '../services/sessionManager';
import SongRequestForm from './SongRequestForm';
import { syncService } from '../services/syncService';
import { getNetworkUrl, setNetworkIp, getStoredNetworkIp } from '../services/networkUtils';

interface DJViewProps {
  // No props needed after removing stage/pro features
}

type DJTab = 'COMMAND' | 'ROTATION' | 'PERFORMERS' | 'LIBRARY';

const QUICK_SET_POOL = [
  { songName: "Bohemian Rhapsody", artist: "Queen" },
  { songName: "Toxic", artist: "Britney Spears" },
  { songName: "Someone Like You", artist: "Adele" },
  { songName: "Sweet Caroline", artist: "Neil Diamond" },
  { songName: "Wonderwall", artist: "Oasis" },
  { songName: "Dancing Queen", artist: "ABBA" },
  { songName: "I Will Survive", artist: "Gloria Gaynor" },
  { songName: "Don't Stop Believin'", artist: "Journey" },
  { songName: "Livin' on a Prayer", artist: "Bon Jovi" },
  { songName: "My Way", artist: "Frank Sinatra" }
];

const VideoLink: React.FC<{ url?: string }> = ({ url }) => {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open Video Link"
      className="p-1.5 rounded-lg text-slate-500 hover:text-teal-400 hover:bg-teal-400/10 transition-all"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
    </a>
  );
};

const CopyUrlButton: React.FC<{ url?: string }> = ({ url }) => {
  const [copied, setCopied] = useState(false);
  if (!url) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy Video URL"
      className={`p-1.5 rounded-lg transition-all ${copied ? 'text-teal-400 bg-teal-400/10' : 'text-slate-500 hover:text-teal-400 hover:bg-teal-400/10'}`}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1-2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  );
};

const CopyButton: React.FC<{ request: SongRequest | VerifiedSong }> = ({ request }) => {
  const [copied, setCopied] = useState(false);

  const songName = (request as SongRequest).songName || (request as VerifiedSong).songName;
  const youtubeUrl = (request as any).youtubeUrl;

  if (youtubeUrl && !copied) return null;

  const handleCopy = () => {
    const type = (request as SongRequest).type || (request as VerifiedSong).type || RequestType.SINGING;
    const suffix = type === RequestType.LISTENING ? ' Lyrics' : ' Karaoke';
    const text = `${songName} - ${request.artist}${suffix}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy search string"
      className={`p-1.5 rounded-lg transition-all ${copied ? 'text-teal-400 bg-teal-400/10' : 'text-slate-500 hover:text-teal-400 hover:bg-teal-400/10'}`}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
      )}
    </button>
  );
};

const DJView: React.FC<DJViewProps> = () => {
  const [session, setSession] = useState<KaraokeSession | null>(null);
  const [accounts, setAccounts] = useState<UserProfile[]>([]);
  const [isAddingRequest, setIsAddingRequest] = useState(false);


  const [isAddingVerifiedSong, setIsAddingVerifiedSong] = useState(false);
  const [verifiedSongToEdit, setVerifiedSongToEdit] = useState<VerifiedSong | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showRoundConfirm, setShowRoundConfirm] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [previewSongs, setPreviewSongs] = useState<SongRequest[]>([]);
  const [requestToEdit, setRequestToEdit] = useState<SongRequest | null>(null);
  const [profileItemToEdit, setProfileItemToEdit] = useState<{ type: 'favorite' | 'history', itemId: string } | null>(null);
  const [prefilledSinger, setPrefilledSinger] = useState<Participant | null>(null);

  const [intro, setIntro] = useState<{ [key: string]: string }>({});
  const [showNetworkConfig, setShowNetworkConfig] = useState(false);
  const [networkIpInput, setNetworkIpInput] = useState(getStoredNetworkIp() || '');
  const [directorySearch, setDirectorySearch] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [lastDoneId, setLastDoneId] = useState<string | null>(null);
  const [doneRequests, setDoneRequests] = useState<Set<string>>(new Set());

  // Smart Library State - AI features removed
  const [pickingSongForUser, setPickingSongForUser] = useState<Participant | UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<DJTab>('COMMAND');
  const [pickerSearch, setPickerSearch] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

  // Audio Refs for Monitoring
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // User Manager States
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [managedProfile, setManagedProfile] = useState<UserProfile | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', password: '' });
  const [profileError, setProfileError] = useState('');

  const refresh = useCallback(async () => {
    const currentSession = await getSession();
    setSession(currentSession);
    const allAccounts = await getAllAccounts();
    setAccounts(allAccounts);
  }, []);

  useEffect(() => {
    if (managedProfile && accounts.length > 0) {
      const updated = accounts.find(a => a.id === managedProfile.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(managedProfile)) {
        setManagedProfile(updated);
      }
    }
  }, [accounts, managedProfile]);

  useEffect(() => {
    refresh();
    window.addEventListener('kstar_sync', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('kstar_sync', refresh);
      window.removeEventListener('storage', refresh);
      stopMicMonitoring();
    };
  }, [refresh]);

  // Reset doneRequests when a new round starts
  useEffect(() => {
    if (!session?.currentRound || session.currentRound.length === 0) {
      setDoneRequests(new Set());
    }
  }, [session?.currentRound]);

  const stopMicMonitoring = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicActive(false);
    setMicVolume(0);
  };

  const startMicMonitoring = async (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    micStreamRef.current = stream;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalized = Math.min(1, (average / 128) * 1.5);
      setMicVolume(normalized);
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();
  };


  const handleGenerateIntro = async (singer: string, song: string, id: string) => {
    const result = `Taking the stage now, it's ${singer} with "${song}"!`;
    await updateRequest(id, { aiIntro: result });
    setIntro(prev => ({ ...prev, [id]: result }));
    await refresh();
  };

  const handleManualRequestSubmit = async (data: any) => {
    if (profileItemToEdit && managedProfile) {
      if (profileItemToEdit.type === 'favorite') {
        await updateUserFavorite(managedProfile.id, profileItemToEdit.itemId, {
          songName: data.songName,
          artist: data.artist,
          youtubeUrl: data.youtubeUrl,
          type: data.type
        });
      } else {
        await updateUserHistoryItem(managedProfile.id, profileItemToEdit.itemId, {
          songName: data.songName,
          artist: data.artist,
          youtubeUrl: data.youtubeUrl,
          type: data.type
        });
      }
      setProfileItemToEdit(null);
    } else if (requestToEdit) {
      await updateRequest(requestToEdit.id, {
        participantName: data.singerName || requestToEdit.participantName,
        songName: data.songName,
        artist: data.artist,
        youtubeUrl: data.youtubeUrl,
        type: data.type
      });
      setRequestToEdit(null);
    } else if (verifiedSongToEdit) {
      await updateVerifiedSong(verifiedSongToEdit.id, {
        songName: data.songName,
        artist: data.artist,
        youtubeUrl: data.youtubeUrl,
        type: data.type
      });
      setVerifiedSongToEdit(null);
    } else if (isAddingVerifiedSong) {
      await addVerifiedSong({
        songName: data.songName,
        artist: data.artist,
        youtubeUrl: data.youtubeUrl,
        type: data.type
      });
      setIsAddingVerifiedSong(false);
    } else {
      let participantId = prefilledSinger?.id || 'DJ-MANUAL';
      let participantName = data.singerName || prefilledSinger?.name || 'Guest';

      if (!prefilledSinger && data.singerName) {
        // Register a guest user for the manually entered name
        const result = await registerUser({ name: data.singerName });
        if (result.success && result.profile) {
          participantId = result.profile.id;
          participantName = result.profile.name;
          // Also join the session so they appear in the participants list
          await joinSession(participantId);
        }
      }

      await addRequest({
        participantId,
        participantName,
        songName: data.songName,
        artist: data.artist,
        youtubeUrl: data.youtubeUrl,
        type: data.type
      });
      setIsAddingRequest(false);
      setPrefilledSinger(null);
    }
    await refresh();
  };

  const handleQuickSet = async (user: UserProfile) => {
    await joinSession(user.id);
    const pool = [...QUICK_SET_POOL];
    for (let i = 0; i < 3; i++) {
      if (pool.length === 0) break;
      const randIdx = Math.floor(Math.random() * pool.length);
      const song = pool.splice(randIdx, 1)[0];
      const newRequest = await addRequest({
        participantId: user.id,
        participantName: user.name,
        songName: song.songName,
        artist: song.artist,
        type: RequestType.SINGING
      });
      if (newRequest) {
        await approveRequest(newRequest.id);
      }
    }
    await updateParticipantStatus(user.id, ParticipantStatus.READY);
    await refresh();
  };

  // AI library generation removed

  const handleSongSearch = (songName: string, artist: string, type: RequestType) => {
    const query = type === RequestType.SINGING
      ? `${songName} ${artist} karaoke`
      : `${songName} ${artist} Lyrics Letra`;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  };

  const handlePromoteToStage = async (requestId: string) => {
    await promoteToStage(requestId);
    await refresh();
    // Auto-generate simple intro when promoting to stage
    const currentSession = await getSession();
    const song = currentSession.currentRound?.find(r => r.id === requestId);
    if (song) {
      handleGenerateIntro(song.participantName, song.songName, song.id);
    }
  };

  const handlePlayOnStage = (song: SongRequest) => {
    if (song.youtubeUrl) {
      window.open(song.youtubeUrl, '_blank');
    } else {
      handleSongSearch(song.songName, song.artist, song.type);
    }
  };



  const handleProfileFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    const data = {
      name: profileForm.name,
      password: profileForm.password || undefined,
    };

    let result;
    if (editingProfile) {
      result = await updateAccount(editingProfile.id, data);
    } else {
      result = await registerUser(data);
    }

    if (result.success) {
      setEditingProfile(null);
      setIsCreatingProfile(false);
      setProfileForm({ name: '', password: '' });
      setProfileError('');
      await refresh();
    } else {
      setProfileError(result.error || "Action failed.");
    }
  };

  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [draggedListType, setDraggedListType] = useState<'ROUND' | 'QUEUE' | 'PENDING' | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number, type: 'ROUND' | 'QUEUE' | 'PENDING') => {
    setDraggedItemIndex(index);
    setDraggedListType(type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number, type: 'ROUND' | 'QUEUE' | 'PENDING') => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedListType !== type) return;

    if (type === 'ROUND' && session?.currentRound) {
      const items = Array.from(session.currentRound);
      const [reorderedItem] = items.splice(draggedItemIndex, 1);
      items.splice(targetIndex, 0, reorderedItem);
      await reorderCurrentRound(items);
    } else if (type === 'QUEUE') {
      const items = Array.from(approvedSinging);
      const [reorderedItem] = items.splice(draggedItemIndex, 1);
      items.splice(targetIndex, 0, reorderedItem);
      await reorderRequests(items);
    } else if (type === 'PENDING') {
      const items = Array.from(pendingRequests);
      const [reorderedItem] = items.splice(draggedItemIndex, 1);
      items.splice(targetIndex, 0, reorderedItem);
      await reorderPendingRequests(items);
    }

    setDraggedItemIndex(null);
    setDraggedListType(null);
    await refresh();
  };

  const startEditProfile = (user: UserProfile) => {
    setEditingProfile(user);
    setIsCreatingProfile(true);
    setProfileForm({
      name: user.name,
      password: user.password || '',
    });
  };

  const closeModals = () => {
    setIsAddingRequest(false);

    setRequestToEdit(null);
    setProfileItemToEdit(null);
    setPrefilledSinger(null);
    setShowQrModal(false);
    setShowRoundConfirm(false);
    setShowUserManager(false);
    setShowLibrary(false);
    setShowResetConfirm(false);
    setIsCreatingProfile(false);
    setEditingProfile(null);
    setManagedProfile(null);
    setShowNetworkConfig(false);
    setIsAddingVerifiedSong(false);
    setVerifiedSongToEdit(null);
    setPickingSongForUser(null);
  };

  const handleSaveNetworkIp = () => {
    setNetworkIp(networkIpInput);
    setShowNetworkConfig(false);
    refresh();
  };

  const handleConfirmRound = async () => {
    await generateRound();
    setShowRoundConfirm(false);
    await refresh();

    const updatedSession = await getSession();
    if (updatedSession.currentRound) {
      updatedSession.currentRound.forEach(song => {
        if (!song.aiIntro) {
          handleGenerateIntro(song.participantName, song.songName, song.id);
        }
      });
    }
  };

  const handleConfirmReset = async () => {
    await resetSession();
    setShowResetConfirm(false);
    await refresh();
  };

  const viewPerformerProfile = (userId: string) => {
    const user = accounts.find(a => a.id === userId);
    if (user) {
      setManagedProfile(user);
      setShowUserManager(true);
    }
  };

  const handleRotateSong = async (requestId: string) => {
    setDoneRequests(prev => new Set(prev).add(requestId));
    setLastDoneId(requestId);
    await completeStageSong(requestId);
    await refresh();
    setTimeout(() => {
      setLastDoneId(null);
    }, 4000);
  };

  if (!session) return (
    <div className="flex items-center justify-center p-20 min-h-screen">
      <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const pendingRequests = session.requests.filter(r => r.status === RequestStatus.PENDING && !r.isInRound);
  const approvedSinging = session.requests.filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING && !r.isInRound);
  const approvedListening = session.requests.filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.LISTENING && !r.isInRound);
  const liveMicCount = session.participants.filter(p => p.status === ParticipantStatus.READY).length;
  const verifiedSongs = session.verifiedSongbook || [];

  const roomId = syncService.getRoomId();
  const roomJoinUrl = getNetworkUrl() + (roomId ? `?room=${roomId}` : '');

  const UserAvatar = ({ name, isActive }: { name: string, isActive?: boolean }) => {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const colors = [
      'from-teal-400 to-indigo-500',
      'from-rose-400 to-orange-500',
      'from-amber-400 to-rose-500',
      'from-indigo-400 to-purple-500',
      'from-emerald-400 to-teal-500'
    ];
    const colorIndex = name.length % colors.length;

    return (
      <div className="relative">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[colorIndex]} p-[2px] shadow-lg shadow-black/20`}>
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <span className="text-sm font-black text-white tracking-widest">{initials}</span>
          </div>
        </div>
        {isActive && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-teal-400 rounded-full border-4 border-slate-950 animate-pulse" />
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8 relative font-inter text-slate-300">
      <header className="flex flex-col md:flex-row justify-between items-center gap-6 pb-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <img src="IGK.jpeg" alt="Island Groove" className="w-20 h-20 rounded-full neon-border-pink shadow-[0_0_15px_rgba(255,20,147,0.5)]" />
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-cyan-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative">
              <h1 className="text-5xl font-black font-bungee text-white flex items-center gap-3 uppercase tracking-tighter neon-glow-pink">
                SINGMODE <span className="text-cyan-400 neon-glow-cyan">COMMAND</span>
              </h1>
              <p className="text-slate-500 uppercase tracking-[0.4em] text-[9px] font-righteous mt-1 opacity-80">
                <span className="text-pink-500 neon-glow-pink">Isle Groove</span> Operations / <span className="text-cyan-400 neon-glow-cyan">{session.participants.length} Performers</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => setShowQrModal(true)} className="px-5 py-2.5 bg-black hover:bg-slate-900 text-white rounded-xl font-righteous text-xs uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10 hover:neon-border-pink">
            <span>📱</span> Entry QR
          </button>

          <button onClick={() => setShowUserManager(true)} className="px-5 py-2.5 bg-black hover:bg-slate-900 text-cyan-400 rounded-xl font-righteous text-xs uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10 hover:neon-border-cyan">
            <span>👥</span> Directory
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-5 py-2.5 bg-black hover:bg-rose-500/10 text-rose-500 rounded-xl font-righteous text-xs uppercase tracking-widest transition-all flex items-center gap-2 border border-rose-500/20 hover:border-rose-500"
            title="Wipe Session & Kick Everyone"
          >
            <span>🧹</span> New Session
          </button>

          <div className="h-10 w-[1px] bg-white/5 mx-2 hidden md:block"></div>

          <button onClick={() => setIsAddingRequest(true)} className="px-6 py-2.5 bg-pink-500 hover:bg-pink-400 text-white rounded-xl font-black font-righteous text-xs uppercase tracking-widest transition-all shadow-xl shadow-pink-900/20 active:scale-95">
            + Add Track
          </button>

          <button
            onClick={() => {
              setShowRoundConfirm(true);
              refresh();
            }}
            className="px-8 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-black rounded-xl font-black font-bungee transition-all shadow-xl shadow-cyan-900/40 uppercase tracking-widest text-xs active:scale-95"
          >
            Launch Round
          </button>
        </div>
      </header>

      <div className="flex bg-black/40 p-2 rounded-2xl border border-white/5 shadow-2xl mb-10 overflow-x-auto no-scrollbar backdrop-blur-md sticky top-4 z-40">
        {(['COMMAND', 'ROTATION', 'PERFORMERS', 'LIBRARY'] as DJTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); }}
            className={`flex-1 py-4 px-8 text-[11px] font-black uppercase tracking-[0.3em] rounded-xl transition-all whitespace-nowrap font-righteous ${activeTab === tab
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-xl shadow-pink-900/40 neon-border-pink'
              : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
          >
            {tab === 'COMMAND' ? 'Console' : tab === 'ROTATION' ? 'Rotation' : tab === 'PERFORMERS' ? 'Performers' : 'Songbook'}
          </button>
        ))}
      </div>

      <main className="min-h-[600px] animate-in fade-in duration-500">
        {activeTab === 'COMMAND' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-2">
            <div className="lg:col-span-8 space-y-8">
              {session.currentRound && (
                <section className="bg-black/40 border border-white/5 rounded-[2.5rem] p-8 shadow-3xl relative overflow-hidden animate-in fade-in zoom-in duration-500 backdrop-blur-md">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-cyan-500"></div>
                  <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-black text-white uppercase flex items-center gap-4 font-bungee neon-glow-pink">
                      <div className="w-3 h-3 bg-pink-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(236,72,153,0.8)]"></div>
                      On Stage Now
                    </h2>
                    <button onClick={async () => { await finishRound(); await refresh(); }} className="px-6 py-2 bg-black text-white border border-white/10 rounded-xl font-black text-[10px] uppercase hover:bg-rose-600 transition-all font-righteous tracking-widest">End Session</button>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {session.currentRound.map((song, i) => {
                      const participant = session.participants.find(p => p.id === song.participantId);
                      const isReady = participant?.status === ParticipantStatus.READY;
                      const isActive = i === 0;
                      const isDoneHighlight = song.id === lastDoneId;
                      const hasBeenDone = doneRequests.has(song.id);

                      return (
                        <div
                          key={song.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, i, 'ROUND')}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, i, 'ROUND')}
                          className={`p-6 rounded-[2rem] relative group transition-all duration-700 border cursor-move ${draggedItemIndex === i && draggedListType === 'ROUND' ? 'opacity-20 scale-95 ring-4 ring-pink-500/50' : ''} ${isActive
                            ? 'bg-black neon-border-pink shadow-[0_0_30px_rgba(236,72,153,0.1)]'
                            : isDoneHighlight
                              ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.2)] animate-pulse'
                              : 'bg-black/60 border-white/5 opacity-80 hover:opacity-100 transition-opacity'
                            }`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                              <div className={`text-[9px] font-black uppercase tracking-[0.2em] font-righteous ${isActive ? 'text-pink-500 neon-glow-pink' : isDoneHighlight ? 'text-cyan-400' : 'text-slate-500'}`}>
                                {isActive ? 'LIVE PERFORMANCE' : isDoneHighlight ? 'Just Finished' : 'Standby'}
                              </div>
                            </div>
                            <div className="flex gap-1 items-center">
                              <VideoLink url={song.youtubeUrl} />
                              <CopyUrlButton url={song.youtubeUrl} />
                              <CopyButton request={song} />

                              <button onClick={() => setRequestToEdit(song)} className="text-slate-600 hover:text-white p-1 ml-2 transition-colors">✏️</button>
                              <button onClick={async () => { await deleteRequest(song.id); await refresh(); }} className="text-rose-500/40 hover:text-rose-500 transition-colors p-2 px-3 font-bold">✕</button>
                            </div>
                          </div>
                          <button
                            onClick={() => handlePlayOnStage(song)}
                            className="block w-full text-left group/play mb-1"
                          >
                            <div className={`text-2xl font-black truncate uppercase tracking-tighter transition-colors font-righteous ${isActive ? 'text-white group-hover/play:text-pink-400' : 'text-slate-400 group-hover/play:text-white'}`}>
                              <span className="text-cyan-400 mr-2 text-sm opacity-50 font-normal">ID-{song.requestNumber}</span>{song.songName}
                            </div>
                          </button>
                          <div className="text-cyan-400/80 text-[10px] uppercase font-bold tracking-widest mb-6 font-righteous">{song.artist}</div>
                          <div className="flex items-center justify-between border-t border-white/5 pt-5 mt-auto">
                            <button
                              onClick={() => viewPerformerProfile(song.participantId)}
                              className={`text-xs font-black uppercase truncate transition-colors hover:text-cyan-400 font-righteous tracking-wide ${isReady ? 'text-white' : 'text-slate-600'}`}
                            >
                              {song.participantName}
                            </button>
                            <div className="flex gap-2">
                              {!hasBeenDone && !isDoneHighlight && (
                                <button
                                  onClick={() => handleRotateSong(song.id)}
                                  title="Done & Move to Last"
                                  className={`px-4 py-2 border text-[9px] font-black rounded-xl uppercase transition-all flex items-center gap-1.5 font-righteous tracking-widest ${isActive
                                    ? 'bg-pink-500 text-white border-pink-400 hover:bg-pink-400'
                                    : 'bg-black text-slate-500 border-white/10 hover:border-cyan-400 hover:text-cyan-400'
                                    }`}
                                >
                                  Done
                                </button>
                              )}

                              <button onClick={() => handleGenerateIntro(song.participantName, song.songName, song.id)} className="text-[9px] font-black bg-white/5 text-slate-500 hover:text-cyan-400 px-3 py-2 rounded-xl border border-white/10 uppercase font-righteous transition-colors">
                                {song.aiIntro ? 'Retry AI' : 'AI Intro'}
                              </button>
                            </div>
                          </div>
                          {song.aiIntro && (
                            <p className={`mt-4 text-[11px] italic p-4 rounded-2xl border leading-relaxed font-medium ${isActive ? 'bg-pink-500/5 border-pink-500/20 text-pink-200/80' : 'bg-black border-white/5 text-slate-500'}`}>
                              "{song.aiIntro}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section>
                <div className="flex justify-between items-center mb-8 px-2">
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter font-righteous neon-glow-cyan">Review Lineup</h2>
                  <span className="px-4 py-1.5 bg-black border border-white/10 rounded-full text-[10px] text-cyan-400 font-black font-righteous tracking-widest">{pendingRequests.length} QUEUED</span>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  {pendingRequests.map((req, i) => (
                    <div
                      key={req.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, i, 'PENDING')}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, i, 'PENDING')}
                      className={`bg-black/60 border p-6 rounded-[2rem] flex flex-col justify-between hover:neon-border-cyan transition-all group backdrop-blur-sm cursor-move ${draggedItemIndex === i && draggedListType === 'PENDING' ? 'opacity-20 scale-95 border-cyan-400' : 'border-white/5'}`}
                    >
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-[9px] font-black text-pink-500 uppercase tracking-[0.2em] font-righteous">{req.type}</div>
                          <div className="flex gap-1">
                            <VideoLink url={req.youtubeUrl} />
                            <CopyButton request={req} />
                            <button onClick={() => setRequestToEdit(req)} className="text-slate-600 hover:text-white text-xs ml-2 transition-colors">✏️</button>
                          </div>
                        </div>
                        <div className="text-xl font-black text-white uppercase truncate tracking-tight font-righteous mb-1">{req.songName}</div>
                        <div className="text-cyan-400/60 text-[10px] uppercase font-bold tracking-widest font-righteous">{req.artist}</div>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-5 mt-auto">
                        <button onClick={() => viewPerformerProfile(req.participantId)} className="text-xs font-black text-white uppercase truncate hover:text-pink-500 transition-colors font-righteous">{req.participantName}</button>
                        <div className="flex gap-2">
                          <button onClick={async () => { await approveRequest(req.id); await refresh(); }} className="px-4 py-2 bg-black text-cyan-400 border border-cyan-400/30 text-[9px] font-black rounded-xl uppercase transition-all hover:bg-cyan-400 hover:text-black font-righteous tracking-widest">Approve</button>
                          <button onClick={() => handlePromoteToStage(req.id)} className="px-5 py-2 bg-pink-500 text-white text-[9px] font-black rounded-xl uppercase transition-all shadow-lg shadow-pink-900/40 hover:bg-pink-400 font-righteous tracking-widest">Stage</button>
                          <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="p-2 px-3 text-rose-500/40 hover:text-rose-500 transition-colors font-bold text-lg">✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingRequests.length === 0 && <div className="col-span-full py-20 text-center bg-black/20 border-2 border-dashed border-white/5 rounded-[2.5rem] opacity-30"><p className="text-sm font-righteous uppercase tracking-[0.4em] italic text-slate-500">No pending validations</p></div>}
                </div>
              </section>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <section className="bg-black/40 rounded-[2rem] p-8 border border-white/5 backdrop-blur-sm shadow-xl">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8 px-2 font-righteous neon-glow-cyan">Ready to Sing</h3>
                    <div className="space-y-3">
                      {approvedSinging.map((req, i) => (
                        <div
                          key={req.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, i, 'QUEUE')}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, i, 'QUEUE')}
                          className={`bg-black/60 p-4 rounded-2xl border flex items-center justify-between group hover:neon-border-pink transition-all cursor-move ${draggedItemIndex === i && draggedListType === 'QUEUE' ? 'opacity-20 scale-95 border-cyan-400' : 'border-white/5'}`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="flex flex-col gap-1">
                              <button onClick={async () => { await reorderRequest(req.id, 'up'); await refresh(); }} className="text-slate-700 hover:text-cyan-400 transition-colors"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
                              <button onClick={async () => { await reorderRequest(req.id, 'down'); await refresh(); }} className="text-slate-700 hover:text-cyan-400 transition-colors"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
                            </div>
                            <div
                              className="min-w-0 cursor-pointer p-1 rounded transition-colors"
                              onClick={() => handleSongSearch(req.songName, req.artist, req.type)}
                            >
                              <div className="text-sm font-black text-white truncate uppercase font-righteous tracking-tight">{req.songName}</div>
                              <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-1 font-medium"><button onClick={(e) => { e.stopPropagation(); viewPerformerProfile(req.participantId); }} className="text-pink-500 hover:neon-glow-pink font-righteous">{req.participantName}</button> • {req.artist}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CopyUrlButton url={req.youtubeUrl} />
                            <CopyButton request={req} />
                            <button onClick={() => handlePromoteToStage(req.id)} className="px-3 py-1.5 bg-black text-cyan-400 border border-cyan-400/30 text-[9px] font-black rounded-lg uppercase hover:bg-cyan-400 hover:text-black transition-all font-righteous tracking-widest">Stage</button>
                            <button onClick={() => setRequestToEdit(req)} className="text-slate-600 hover:text-white p-1 ml-1 transition-colors">✏️</button>
                            <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="text-rose-500/40 hover:text-rose-500 transition-colors px-3 font-bold text-lg">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="bg-black/40 rounded-[2rem] p-8 border border-white/5 backdrop-blur-sm shadow-xl flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8 px-2 font-righteous">Atmosphere Control</h3>

                    <div className="space-y-6 flex-1">
                      <div>
                        <h4 className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-4 px-2 font-righteous">Background Stream</h4>
                        <div className="space-y-3">
                          {approvedListening.map((req) => (
                            <div key={req.id} className="bg-black/60 p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:neon-border-cyan transition-all">
                              <div
                                className="min-w-0 cursor-pointer p-1 rounded transition-colors"
                                onClick={() => handleSongSearch(req.songName, req.artist, req.type)}
                              >
                                <div className="text-sm font-black text-white truncate uppercase font-righteous tracking-tight">{req.songName}</div>
                                <div className="text-[9px] text-slate-500 uppercase tracking-[0.1em] font-medium mt-1 uppercase font-righteous">{req.artist}</div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <VideoLink url={req.youtubeUrl} />
                                <CopyButton request={req} />
                                <button onClick={() => handlePromoteToStage(req.id)} className="px-3 py-1.5 bg-black text-purple-400 border border-purple-400/30 text-[9px] font-black rounded-lg uppercase hover:bg-purple-500 hover:text-white transition-all font-righteous tracking-widest">Stage</button>
                                <button onClick={() => setRequestToEdit(req)} className="text-slate-600 hover:text-white p-1 ml-1 transition-colors">✏️</button>
                                <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="text-rose-500/40 hover:text-rose-500 transition-colors px-3 font-bold text-lg">✕</button>
                              </div>
                            </div>
                          ))}
                          {approvedListening.length === 0 && <p className="text-[10px] text-slate-600 italic px-4 font-righteous">No background tracks active</p>}
                        </div>
                      </div>

                      <div className="pt-8 border-t border-white/5">
                        <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-6 px-2 flex justify-between items-center font-righteous">
                          Verified Links
                          <div className="flex gap-3">
                            <span className="text-[9px] bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded-lg border border-cyan-400/20 font-black">{verifiedSongs.length}</span>
                            <button
                              onClick={() => setIsAddingVerifiedSong(true)}
                              className="text-[9px] font-black bg-cyan-400 text-black px-3 py-1 rounded-lg uppercase hover:bg-cyan-300 transition-all font-righteous tracking-wider"
                            >
                              + NEW
                            </button>
                          </div>
                        </h4>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar">
                          {verifiedSongs.map(v => (
                            <div key={v.id} className="bg-black/40 p-4 rounded-xl border border-white/5 flex justify-between items-center group hover:neon-border-pink transition-all">
                              <div className="min-w-0 pr-4">
                                <div className="text-xs font-black text-white uppercase truncate font-righteous tracking-tight group-hover:text-pink-400 transition-colors">{v.songName}</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase truncate font-righteous tracking-widest mt-1 opacity-60">{v.artist}</div>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  onClick={() => handleSongSearch(v.songName, v.artist, v.type)}
                                  className="p-2 bg-black text-cyan-400 hover:bg-cyan-500 hover:text-black border border-cyan-400/20 rounded-lg text-[9px] font-black uppercase transition-all font-righteous tracking-wider"
                                >
                                  Play
                                </button>
                                <button
                                  onClick={() => {
                                    setIsAddingRequest(true);
                                  }}
                                  className="p-2 bg-black text-pink-500 hover:bg-pink-500 hover:text-white border border-pink-500/20 rounded-lg text-[9px] font-black uppercase transition-all font-righteous tracking-wider"
                                >
                                  Queue
                                </button>
                                <CopyUrlButton url={v.youtubeUrl} />
                                <button onClick={() => setVerifiedSongToEdit(v)} className="text-slate-600 hover:text-white p-1.5 transition-colors">✏️</button>
                                <button onClick={async () => { if (confirm('Delete verified song?')) { await deleteVerifiedSong(v.id); await refresh(); } }} className="text-rose-500/40 hover:text-rose-500 transition-colors px-2 font-bold text-lg">✕</button>
                              </div>
                            </div>
                          ))}
                          {verifiedSongs.length === 0 && <p className="text-[10px] text-slate-700 italic px-4 font-righteous">No persistent links found</p>}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <section className="bg-black/40 rounded-[2rem] p-8 border border-white/5 backdrop-blur-md shadow-xl">
                <div className="flex justify-between items-center mb-8 px-2">
                  <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] font-righteous">Performers</h2>
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-black border border-white/10 rounded-full shadow-inner">
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.1em] font-righteous">{liveMicCount} ONLINE</span>
                  </div>
                </div>
                <div className="grid gap-3">
                  {session.participants.map(p => {
                    const isReady = p.status === ParticipantStatus.READY;
                    const requests = session.requests.filter(r => r.participantId === p.id);
                    const approvedCount = requests.filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING).length;

                    return (
                      <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl transition-all border ${isReady ? 'bg-pink-500/5 border-pink-500/30 neon-border-pink' : 'bg-black/40 border-white/5'}`}>
                        <div className="min-w-0 flex items-center gap-4">
                          <button
                            onClick={async () => { await updateParticipantStatus(p.id, isReady ? ParticipantStatus.STANDBY : ParticipantStatus.READY); await refresh(); }}
                            className={`w-6 h-6 rounded-full shrink-0 border-2 ${isReady ? 'bg-pink-500 border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.6)] animate-pulse' : 'bg-slate-800 border-white/5 hover:border-slate-600'}`}
                            title={isReady ? "Set to Standby" : "Set to Ready"}
                          />
                          <div className="min-w-0">
                            <button
                              onClick={() => viewPerformerProfile(p.id)}
                              className={`font-black text-sm uppercase truncate text-left font-righteous transition-colors ${isReady ? 'text-white' : 'text-slate-600 hover:text-pink-500'}`}
                            >
                              {p.name}
                            </button>
                            {approvedCount > 0 && <span className="block text-[8px] text-cyan-400 font-black mt-0.5 tracking-widest">{approvedCount} APPROVED</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 items-center">
                          <button
                            onClick={() => setPrefilledSinger(p)}
                            title={`Manual Search Add for ${p.name}`}
                            className="p-2 hover:text-cyan-400 transition-colors text-slate-600"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          </button>

                          <button
                            onClick={() => setPickingSongForUser(p)}
                            title={`Add Song from Verified Book for ${p.name}`}
                            className="p-2 hover:text-pink-500 transition-colors text-slate-600"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              <line x1="12" y1="19" x2="12" y2="22" />
                            </svg>
                          </button>

                          <button
                            onClick={() => { const user = accounts.find(a => a.id === p.id); if (user) setManagedProfile(user); else setPrefilledSinger(p); }}
                            title="Manage Account"
                            className="p-2 hover:text-cyan-400 transition-colors text-slate-600"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                              <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                          </button>

                          <button onClick={async () => { if (confirm(`Remove ${p.name}?`)) { await removeParticipant(p.id); await refresh(); } }} className="p-2 text-rose-500/30 hover:text-rose-500 transition-colors font-bold text-lg">✕</button>
                        </div>
                      </div>
                    );
                  })}
                  {session.participants.length === 0 && <p className="text-[10px] text-slate-700 italic text-center py-8 font-righteous">No performers online</p>}
                </div>
              </section>

              <section className="bg-black/40 rounded-[2rem] p-8 border border-white/5 backdrop-blur-md shadow-xl">
                <div className="flex justify-between items-center mb-8 px-2">
                  <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] font-righteous">History Archive</h2>
                  {session.history.length > 0 && <button onClick={async () => { await clearHistory(); await refresh(); }} className="text-[9px] font-black text-rose-500/60 hover:text-rose-500 uppercase tracking-widest font-righteous transition-colors">Wipe</button>}
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
                  {session.history.map((item, i) => (
                    <div key={i} className="bg-black/40 p-5 rounded-2xl border border-white/5 flex flex-col group hover:border-cyan-400/30 transition-all backdrop-blur-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 pr-4">
                          <div className="text-[13px] font-black text-white uppercase truncate font-righteous tracking-tight group-hover:text-cyan-400 transition-colors">{item.songName}</div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase truncate font-righteous tracking-widest mt-1 opacity-60">{item.artist}</div>
                        </div>
                        <VideoLink url={item.youtubeUrl} />
                      </div>
                      <div className="flex items-center justify-between mt-2 border-t border-white/5 pt-4">
                        <button onClick={() => viewPerformerProfile(item.participantId)} className="text-[10px] font-black text-pink-500/60 uppercase truncate hover:text-pink-500 font-righteous tracking-wider transition-colors">{item.participantName}</button>
                        <button onClick={async () => { await reAddFromHistory(item, true); await refresh(); }} className="opacity-0 group-hover:opacity-100 text-[10px] font-black bg-pink-500/10 text-pink-500 px-3 py-1.5 rounded-xl border border-pink-500/20 transition-all font-righteous tracking-wider">Retry</button>
                      </div>
                    </div>
                  ))}
                  {session.history.length === 0 && <div className="text-center py-16 opacity-30"><p className="text-[10px] italic font-righteous uppercase tracking-widest text-slate-600">Archive empty</p></div>}
                </div>
              </section>
            </div>
          </div>
        )
        }

        {
          activeTab === 'ROTATION' && (
            <div className="space-y-12 animate-in slide-in-from-bottom-2">
              {session.currentRound && session.currentRound.length > 0 && (
                <section className="bg-black/40 border border-white/5 rounded-[3rem] p-10 shadow-3xl backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"></div>
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-3 h-3 bg-pink-500 rounded-full animate-ping"></div>
                    <h3 className="text-white font-black uppercase tracking-[0.4em] text-sm font-bungee neon-glow-pink">Current Playlist Rotation</h3>
                  </div>
                  <div className="grid gap-8 sm:grid-cols-2">
                    {session.currentRound.map((song, i) => (
                      <div
                        key={song.id}
                        className={`p-8 rounded-[2.5rem] border transition-all duration-500 ${i === 0
                          ? 'bg-black neon-border-pink shadow-[0_0_40px_rgba(236,72,153,0.15)] ring-1 ring-pink-500/20'
                          : 'bg-black/40 border-white/5 opacity-50'
                          }`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="min-w-0 pr-6">
                            <div className={`text-3xl font-black uppercase truncate tracking-tighter mb-2 font-righteous ${i === 0 ? 'text-white' : 'text-slate-500'}`}>
                              <span className="text-cyan-400 mr-3 text-lg opacity-50 font-normal">ID-{song.requestNumber}</span>{song.songName}
                            </div>
                            <div className="text-[11px] text-cyan-400 font-bold uppercase tracking-[0.2em] font-righteous">{song.artist}</div>
                            <div className="mt-8 text-sm font-black text-pink-500 uppercase tracking-widest font-righteous neon-glow-pink">{song.participantName}</div>
                          </div>
                          {i === 0 && <div className="px-5 py-2 bg-pink-500 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] font-righteous shadow-xl shadow-pink-900/40 neon-border-pink">LIVE ON STAGE</div>}
                        </div>

                        <div className="flex gap-3 pt-6 border-t border-white/5">
                          <button onClick={() => handlePlayOnStage(song)} className="flex-1 py-4 bg-black hover:bg-slate-900 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest font-righteous transition-all">Play Track</button>
                          <button onClick={() => handleRotateSong(song.id)} className="flex-1 py-4 bg-cyan-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest font-righteous transition-all shadow-lg shadow-cyan-900/20 hover:bg-cyan-300">Finish Set</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="bg-black/20 rounded-[3rem] p-10 border border-white/5 backdrop-blur-sm">
                <h3 className="text-slate-500 font-black uppercase tracking-[0.4em] text-[11px] mb-10 px-4 font-righteous">Verified Performance Queue</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {approvedSinging.map((req) => (
                    <div key={req.id} className="bg-black/40 p-6 rounded-[2rem] border border-white/5 flex justify-between items-center group hover:neon-border-cyan transition-all backdrop-blur-md">
                      <div className="min-w-0 pr-6">
                        <div className="text-white font-black uppercase truncate text-lg font-righteous tracking-tight">{req.songName}</div>
                        <div className="text-[10px] text-slate-500 uppercase flex items-center gap-3 mt-2 font-righteous tracking-widest">
                          <span className="text-pink-500 font-black">{req.participantName}</span>
                          <span className="opacity-30">•</span>
                          <span className="truncate">{req.artist}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handlePromoteToStage(req.id)} className="px-6 py-3 bg-pink-500 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest font-righteous shadow-xl shadow-pink-900/20 transition-all hover:bg-pink-400">Stage</button>
                        <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="text-rose-500/40 hover:text-rose-500 p-3 rounded-2xl transition-all text-xl font-bold">✕</button>
                      </div>
                    </div>
                  ))}
                  {approvedSinging.length === 0 && (
                    <div className="col-span-full py-24 text-center bg-black/10 rounded-[3rem] border-2 border-dashed border-white/5 opacity-30">
                      <p className="text-sm font-black uppercase tracking-[0.5em] italic font-righteous text-slate-600">Rotation queue is empty</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )
        }

        {
          activeTab === 'PERFORMERS' && (
            <div className="grid md:grid-cols-12 gap-8 animate-in slide-in-from-bottom-2">
              <section className="md:col-span-7 bg-black/40 rounded-[3rem] p-10 border border-white/5 backdrop-blur-md shadow-xl">
                <div className="flex justify-between items-center mb-10 px-4">
                  <h2 className="text-white font-black uppercase tracking-[0.4em] text-sm font-bungee neon-glow-cyan">Global Performer Directory</h2>
                  <div className="flex items-center gap-3 px-4 py-2 bg-black border border-white/10 rounded-full shadow-inner">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] font-righteous">{liveMicCount} ONLINE NOW</span>
                  </div>
                </div>
                <div className="grid gap-4">
                  {session.participants.map(p => {
                    const isReady = p.status === ParticipantStatus.READY;
                    const requests = session.requests.filter(r => r.participantId === p.id);
                    const approvedCount = requests.filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING).length;

                    return (
                      <div key={p.id} className={`flex items-center justify-between p-6 rounded-[2rem] transition-all border ${isReady ? 'bg-pink-500/5 border-pink-500/30 neon-border-pink shadow-[0_0_20px_rgba(236,72,153,0.05)]' : 'bg-black/60 border-white/5'}`}>
                        <div className="min-w-0 flex items-center gap-6 text-left">
                          <button
                            onClick={async () => { await updateParticipantStatus(p.id, isReady ? ParticipantStatus.STANDBY : ParticipantStatus.READY); await refresh(); }}
                            className={`w-8 h-8 rounded-full shrink-0 border-2 transition-all ${isReady ? 'bg-pink-500 border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.6)] animate-pulse' : 'bg-slate-800 border-white/10 hover:border-slate-600'}`}
                          />
                          <div className="min-w-0">
                            <button
                              onClick={() => viewPerformerProfile(p.id)}
                              className={`font-black text-xl uppercase truncate font-righteous tracking-tight transition-colors ${isReady ? 'text-white' : 'text-slate-600 hover:text-pink-500'}`}
                            >
                              {p.name}
                            </button>
                            {approvedCount > 0 && <div className="text-[9px] font-black text-cyan-400 uppercase mt-1 tracking-widest font-righteous">{approvedCount} SONGS READY</div>}
                          </div>
                        </div>
                        <div className="flex gap-3 items-center">
                          <button onClick={() => setPrefilledSinger(p)} className="p-3 bg-black hover:bg-slate-900 text-cyan-400 rounded-xl border border-white/10 transition-all font-righteous text-[10px] uppercase tracking-widest">
                            QUEUE+
                          </button>
                          <button onClick={async () => { if (confirm(`Remove ${p.name}?`)) { await removeParticipant(p.id); await refresh(); } }} className="text-rose-500/40 hover:text-rose-500 p-3 transition-colors text-xl font-bold">✕</button>
                        </div>
                      </div>
                    );
                  })}
                  {session.participants.length === 0 && <div className="py-20 text-center opacity-30"><p className="text-sm font-black uppercase tracking-[0.5em] italic font-righteous text-slate-700">No performers connected</p></div>}
                </div>
              </section>

              <section className="md:col-span-5 bg-black/40 rounded-[3rem] p-10 border border-white/5 shadow-xl backdrop-blur-md">
                <div className="flex justify-between items-center mb-10 px-4">
                  <h2 className="text-slate-500 font-black uppercase tracking-[0.4em] text-[11px] font-righteous">Archive Vault</h2>
                  {session.history.length > 0 && <button onClick={async () => { await clearHistory(); await refresh(); }} className="text-[9px] font-black text-rose-500/60 hover:text-rose-500 uppercase tracking-widest font-righteous transition-colors">WIPEOUT</button>}
                </div>
                <div className="space-y-4 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar">
                  {session.history.map((item, i) => (
                    <div key={i} className="bg-black/60 p-6 rounded-[2rem] border border-white/5 group hover:neon-border-cyan transition-all backdrop-blur-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="min-w-0 pr-6">
                          <div className="text-lg font-black text-white uppercase truncate font-righteous tracking-tight group-hover:text-cyan-400 transition-colors">{item.songName}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase truncate font-righteous tracking-widest mt-1">{item.artist}</div>
                        </div>
                        <VideoLink url={item.youtubeUrl} />
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-5">
                        <button onClick={() => viewPerformerProfile(item.participantId)} className="text-[11px] font-black text-pink-500/60 uppercase truncate hover:text-pink-500 font-righteous tracking-wider transition-colors">{item.participantName}</button>
                        <button onClick={async () => { await reAddFromHistory(item, true); await refresh(); }} className="opacity-0 group-hover:opacity-100 text-[10px] font-black bg-pink-500 text-white px-6 py-2 rounded-xl transition-all font-righteous tracking-widest shadow-lg shadow-pink-900/40">RETRY</button>
                      </div>
                    </div>
                  ))}
                  {session.history.length === 0 && <div className="text-center py-20 opacity-20"><p className="text-[10px] italic font-righteous uppercase tracking-widest text-slate-700">Vault is empty</p></div>}
                </div>
              </section>
            </div>
          )
        }

        {
          activeTab === 'LIBRARY' && (
            <section className="animate-in fade-in slide-in-from-bottom-2 space-y-12 pb-32">
              <div className="sticky top-0 z-30 pt-4 -mt-4 mb-4">
                <div className="relative group p-[2px] rounded-[2.5rem] bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                  <input
                    type="text"
                    placeholder="SCANNING GLOBAL SONGBOOK CHANNELS..."
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    className="w-full bg-black/90 border border-white/5 rounded-[2.5rem] py-8 pl-16 pr-8 text-sm font-black tracking-[0.3em] text-white placeholder:text-slate-700/60 focus:outline-none focus:neon-border-pink transition-all backdrop-blur-3xl shadow-3xl font-righteous"
                  />
                  <span className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-pink-500 transition-colors pointer-events-none">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </span>
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 flex gap-4">
                    <button
                      onClick={() => setIsAddingVerifiedSong(true)}
                      className="px-8 py-3 bg-cyan-400 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-cyan-900/20 active:scale-95 transition-all font-righteous hover:bg-cyan-300"
                    >
                      + ADD LINK
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {(() => {
                  const verified = (session?.verifiedSongbook || []).map(v => ({
                    ...v,
                    isVerified: true,
                    title: v.songName,
                    source: 'VERIFIED'
                  }));

                  const combined = verified.filter(song => {
                    if (!librarySearchQuery) return true;
                    const query = librarySearchQuery.toLowerCase();
                    return song.title.toLowerCase().includes(query) || song.artist.toLowerCase().includes(query);
                  });

                  if (combined.length === 0) {
                    return (
                      <div className="col-span-full text-center py-40 opacity-20 border-2 border-dashed border-white/5 rounded-[4rem]">
                        <div className="text-8xl mb-8 opacity-50">{librarySearchQuery ? '🚫' : '✨'}</div>
                        <p className="text-lg font-black uppercase tracking-[0.5em] font-righteous text-slate-600">{librarySearchQuery ? 'NO FREQUENCY MATCH' : 'SONGBOOK OFFLINE'}</p>
                      </div>
                    );
                  }

                  return combined.map((song, idx) => (
                    <div key={idx} className="bg-black/60 border border-white/5 p-8 rounded-[3rem] flex flex-col justify-between group hover:neon-border-cyan transition-all relative overflow-hidden backdrop-blur-md shadow-2xl">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500/5 blur-3xl rounded-full -mr-20 -mt-20 group-hover:bg-pink-500/10 transition-all opacity-50" />

                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex gap-3 items-center">
                            {song.isVerified && (
                              <div className="px-3 py-1 bg-pink-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest font-righteous shadow-[0_0_15px_rgba(236,72,153,0.4)]">VERIFIED</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <VideoLink url={(song as any).youtubeUrl} />
                            <CopyUrlButton url={(song as any).youtubeUrl} />
                          </div>
                        </div>

                        <div className="min-w-0 mb-10">
                          <h4 className="text-2xl font-black text-white uppercase truncate tracking-tighter font-righteous mb-1 group-hover:text-cyan-400 transition-colors">{song.title}</h4>
                          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em] font-righteous opacity-60">{song.artist}</p>
                        </div>
                      </div>

                      <div className="relative z-10 flex gap-3 border-t border-white/5 pt-6 mt-auto">
                        <div className="relative group/assign flex-1">
                          <button className="w-full py-4 bg-cyan-400 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-cyan-900/20 hover:bg-cyan-300 transition-all font-righteous active:scale-95">
                            INJECT TRACK
                          </button>
                          <div className="absolute bottom-full left-0 right-0 mb-4 bg-black border border-white/10 rounded-[2rem] shadow-[0_0_60px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover/assign:opacity-100 group-hover/assign:visible transition-all p-4 z-50 backdrop-blur-3xl">
                            <p className="text-[9px] text-pink-500 font-black uppercase mb-4 border-b border-white/5 pb-3 font-righteous tracking-widest">Target Channel:</p>
                            <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                              {session.participants.map(p => (
                                <button
                                  key={p.id}
                                  onClick={async () => { const req = await addRequest({ participantId: p.id, participantName: p.name, songName: song.title, artist: song.artist, youtubeUrl: (song as any).youtubeUrl, type: RequestType.SINGING }); if (req) await approveRequest(req.id); await refresh(); }}
                                  className="w-full text-left p-3 rounded-xl hover:bg-white/5 hover:text-cyan-400 text-[11px] font-black text-slate-500 uppercase truncate font-righteous transition-all"
                                >
                                  {p.name}
                                </button>
                              ))}
                              <div className="h-[1px] bg-white/5 my-3" />
                              <button
                                onClick={async () => { const req = await addRequest({ participantId: 'DJ-MANUAL', participantName: 'Guest', songName: song.title, artist: song.artist, youtubeUrl: (song as any).youtubeUrl, type: RequestType.SINGING }); if (req) await approveRequest(req.id); await refresh(); }}
                                className="w-full text-left p-3 rounded-xl hover:bg-cyan-500 hover:text-black text-[11px] font-black text-white uppercase font-righteous transition-all"
                              >
                                + GUEST PERFORMER
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="relative group/star flex-[0.6]">
                          <button className="w-full py-4 bg-black border border-white/10 text-pink-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:neon-border-pink transition-all font-righteous active:scale-95">
                            STARS
                          </button>
                          <div className="absolute bottom-full left-0 right-0 mb-4 bg-black border border-white/10 rounded-[2rem] shadow-[0_0_60px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover/star:opacity-100 group-hover/star:visible transition-all p-4 z-50 backdrop-blur-3xl">
                            <p className="text-[9px] text-cyan-400 font-black uppercase mb-4 border-b border-white/5 pb-3 font-righteous tracking-widest">Favorite For:</p>
                            <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                              {session.participants.map(p => (
                                <button
                                  key={p.id}
                                  onClick={async () => { await addUserFavorite(p.id, { songName: song.title, artist: song.artist, youtubeUrl: (song as any).youtubeUrl, type: song.type as RequestType }); await refresh(); }}
                                  className="w-full text-left p-3 rounded-xl hover:bg-white/5 hover:text-pink-500 text-[11px] font-black text-slate-500 uppercase truncate font-righteous transition-all"
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {song.isVerified && (
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => setVerifiedSongToEdit(song as any)} className="p-4 bg-black border border-white/10 text-slate-600 hover:text-white rounded-2xl transition-all">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                            </button>
                            <button onClick={async () => { if (confirm('Delete verified song?')) { await deleteVerifiedSong((song as any).id); await refresh(); } }} className="p-4 bg-black border border-white/10 text-rose-500/40 hover:text-rose-500 rounded-2xl transition-all">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </section>
          )
        }
      </main >

      {showRoundConfirm && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[90] backdrop-blur-3xl">
          <div className="w-full max-w-2xl bg-black border border-white/10 rounded-[3rem] p-12 shadow-3xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"></div>
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none font-bungee neon-glow-pink">Review Lineup</h2>
              <button onClick={() => setShowRoundConfirm(false)} className="text-slate-500 hover:text-white font-black text-2xl px-2 transition-colors">✕</button>
            </div>
            <div className="mb-10 text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] font-righteous opacity-60">Finalize performance signals before activation</div>

            <div className="space-y-4 mb-12 max-h-[450px] overflow-y-auto pr-4 custom-scrollbar">
              {session.participants
                .filter(p => session.requests?.some(r => r.participantId === p.id && r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING && !r.isInRound))
                .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))
                .map(p => {
                  const isReady = p.status === ParticipantStatus.READY;
                  const song = session.requests?.find(r =>
                    r.participantId === p.id &&
                    r.status === RequestStatus.APPROVED &&
                    r.type === RequestType.SINGING &&
                    !r.isInRound
                  );

                  return (
                    <div key={p.id} className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all duration-300 ${isReady ? 'bg-pink-500/5 border-pink-500/30' : 'bg-black/40 border-white/5 opacity-40'}`}>
                      <div className="flex items-center gap-6 min-w-0">
                        <button
                          onClick={async () => { await updateParticipantStatus(p.id, isReady ? ParticipantStatus.STANDBY : ParticipantStatus.READY); await refresh(); }}
                          className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center transition-all border-2 ${isReady ? 'bg-pink-500 border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.4)]' : 'bg-slate-800 border-white/10 hover:border-slate-600'}`}
                        >
                          {isReady && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </button>
                        <div className="min-w-0">
                          <div className={`font-black uppercase text-lg truncate tracking-tight font-righteous ${isReady ? 'text-white' : 'text-slate-600'}`}>{p.name}</div>
                          {isReady ? (
                            song ? (
                              <div className="text-cyan-400 text-[10px] font-black uppercase tracking-widest font-righteous mt-1">
                                <span className="opacity-50 mr-2 text-white/40">ID-{song.requestNumber}</span>{song.songName}
                              </div>
                            ) : (
                              <div className="text-rose-500 text-[10px] font-black uppercase tracking-widest font-righteous mt-1">⚠️ No Approved Track</div>
                            )
                          ) : (
                            <div className="text-slate-700 text-[10px] font-black uppercase tracking-widest font-righteous mt-1">Standby Mode</div>
                          )}
                        </div>
                      </div>
                      {isReady && song && <div className="shrink-0 text-[9px] bg-cyan-400 text-black px-4 py-1.5 rounded-xl font-black uppercase tracking-widest font-righteous shadow-lg shadow-cyan-900/20 animate-in fade-in zoom-in">LINING UP</div>}
                    </div>
                  );
                })}

              {session.participants.length === 0 && (
                <div className="text-center py-24 bg-black/20 rounded-[3rem] border-2 border-dashed border-white/5 animate-in fade-in duration-700">
                  <p className="text-slate-700 text-[11px] font-black uppercase tracking-[0.4em] font-righteous">No performers detected in signal range</p>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowRoundConfirm(false)} className="flex-1 py-5 bg-black hover:bg-slate-900 text-white border border-white/10 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all font-righteous">CANCEL</button>
              {(() => {
                const eligibleCount = session.participants.filter(p =>
                  session.requests?.some(r => r.participantId === p.id && r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING && !r.isInRound)
                ).length;

                return (
                  <button
                    onClick={handleConfirmRound}
                    disabled={eligibleCount === 0}
                    className={`flex-[2] py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl font-righteous ${eligibleCount > 0 ? 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-cyan-900/40' : 'bg-slate-900 text-slate-700 cursor-not-allowed border border-white/5'}`}
                  >
                    {eligibleCount > 0 ? (
                      <>
                        <span className="w-2 h-2 bg-black rounded-full animate-ping"></span>
                        ACTIVATE ROUND ({eligibleCount} SINGERS)
                      </>
                    ) : 'NO ELIGIBLE SINGERS'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}


      {
        showResetConfirm && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200] backdrop-blur-3xl">
            <div className="w-full max-w-md bg-black border border-rose-500/30 rounded-[3rem] p-12 text-center shadow-3xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]"></div>
              <div className="w-24 h-24 bg-rose-500/10 text-rose-500 rounded-[2rem] border-2 border-rose-500/20 flex items-center justify-center mx-auto mb-8 text-5xl font-black shadow-xl">🧹</div>
              <h2 className="text-4xl font-black text-white uppercase mb-4 tracking-tighter font-bungee neon-glow-pink">New Session?</h2>
              <p className="text-slate-500 text-sm mb-12 leading-relaxed font-bold font-righteous uppercase tracking-widest">
                This will <span className="text-rose-500 underline decoration-2 underline-offset-4">kick everyone out</span>, clear all requests, history, and chat messages.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-5 bg-black border border-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest font-righteous transition-all">ABORT</button>
                <button onClick={handleConfirmReset} className="flex-[2] py-5 bg-rose-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest font-righteous shadow-2xl shadow-rose-900/40 transition-all hover:bg-rose-400">RESET ENGINE</button>
              </div>
            </div>
          </div>
        )
      }

      {
        (showUserManager || managedProfile) && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[70] backdrop-blur-3xl">
            <div className="w-full max-w-6xl bg-black border border-white/10 rounded-[4rem] overflow-hidden shadow-3xl flex flex-col max-h-[90vh] relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"></div>
              <div className="p-10 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-md">
                <div>
                  <h2 className="text-3xl font-black text-white font-bungee uppercase tracking-tighter neon-glow-pink">User Directory</h2>
                  <p className="text-[10px] text-cyan-400 uppercase font-black tracking-[0.4em] font-righteous opacity-60 mt-1">Authenticated Identities & Signal History</p>
                </div>
                <div className="flex gap-4">
                  {managedProfile && (
                    <button onClick={() => setManagedProfile(null)} className="px-8 py-3 bg-black border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest font-righteous hover:bg-slate-900 transition-all">← ALL ACCOUNTS</button>
                  )}
                  <button
                    onClick={() => setIsCreatingProfile(true)}
                    className="px-8 py-3 bg-cyan-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest font-righteous shadow-xl shadow-cyan-900/40 hover:bg-cyan-300 transition-all"
                  >
                    + NEW ACCOUNT
                  </button>
                  <button onClick={closeModals} className="text-slate-500 hover:text-white p-2 ml-4 font-black text-2xl transition-colors">✕</button>
                </div>
              </div>

              <div className="p-8 border-b border-white/5 bg-black/20">
                <div className="relative group max-w-2xl mx-auto">
                  <input
                    type="text"
                    placeholder="SCANNING DIRECTORY RECORDS..."
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-2xl px-12 py-5 text-white font-black uppercase font-righteous tracking-widest outline-none focus:neon-border-pink transition-all shadow-inner placeholder:text-slate-800"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-pink-500 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar bg-black/20">
                {managedProfile ? (
                  <div className="animate-in slide-in-from-right-4 duration-500 grid lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-4 space-y-8">
                      <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-[3.5rem] p-10 shadow-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-pink-500/5 blur-3xl rounded-full -mr-24 -mt-24" />
                        <div className="relative z-10 flex flex-col items-center text-center">
                          <UserAvatar name={managedProfile.name} isActive={session.participants.some(p => p.id === managedProfile.id)} />
                          <div className="mt-8">
                            <div className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-2 font-righteous">AUTHENTICATED IDENTITY</div>
                            <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none font-bungee">{managedProfile.name}</h3>
                          </div>

                          <div className="w-full mt-10 space-y-4 pt-8 border-t border-white/5">
                            <div className="flex justify-between items-center text-[10px] uppercase font-black font-righteous tracking-widest">
                              <span className="text-slate-600">ID SIGNATURE</span>
                              <span className="text-pink-500/60 font-mono">{managedProfile.id.slice(0, 12)}...</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] uppercase font-black font-righteous tracking-widest">
                              <span className="text-slate-600">ENCRYPTION</span>
                              <span className={`px-3 py-1 rounded-full ${managedProfile.password ? 'bg-pink-500/10 text-pink-500' : 'bg-slate-900 text-slate-700'}`}>
                                {managedProfile.password ? 'SECURE PIN' : 'OPEN LINK'}
                              </span>
                            </div>
                          </div>

                          <div className="w-full mt-12 space-y-3">
                            <button onClick={() => startEditProfile(managedProfile)} className="w-full py-4 bg-black border border-white/10 hover:neon-border-pink text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all font-righteous">MODIFY SECURITY</button>
                            <button onClick={async () => { await joinSession(managedProfile.id); await refresh(); }} className="w-full py-4 bg-cyan-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-cyan-900/40 font-righteous hover:bg-cyan-300">FORCE RE-JOIN</button>
                            <button onClick={async () => { if (confirm('Permanently delete this account?')) { await deleteAccount(managedProfile.id); setManagedProfile(null); await refresh(); } }} className="w-full py-4 bg-rose-500/5 hover:bg-rose-500 text-rose-500/40 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-transparent hover:border-rose-500/30 font-righteous mt-4">TERMINATE ACCOUNT</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-8 space-y-8">
                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-black/40 border border-white/5 rounded-[3rem] p-10 backdrop-blur-md">
                          <h4 className="text-[10px] font-black text-pink-500 uppercase tracking-[0.4em] mb-8 font-righteous">LIBRARY STARS ({managedProfile.favorites.length})</h4>
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                            {managedProfile.favorites.map(fav => (
                              <div key={fav.id} className="bg-black/60 border border-white/5 p-5 rounded-2xl flex justify-between items-center group hover:neon-border-pink transition-all">
                                <div className="min-w-0 pr-6">
                                  <div className="text-base font-black text-white truncate uppercase tracking-tight font-righteous group-hover:text-pink-500 transition-colors">{fav.songName}</div>
                                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 font-righteous opacity-60">{fav.artist}</div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <button onClick={async () => { await addRequest({ participantId: managedProfile!.id, participantName: managedProfile!.name, songName: fav.songName, artist: fav.artist, youtubeUrl: fav.youtubeUrl, type: fav.type }); await refresh(); }} className="px-5 py-2.5 bg-cyan-400 text-black rounded-xl text-[9px] font-black uppercase font-righteous shadow-lg shadow-cyan-900/10 hover:bg-cyan-300 transition-all">ADD</button>
                                  <button onClick={() => setProfileItemToEdit({ type: 'favorite', itemId: fav.id })} className="p-2 text-slate-700 hover:text-white transition-colors">✏️</button>
                                  <button onClick={async () => { await removeUserFavorite(managedProfile!.id, fav.id); await refresh(); }} className="p-2 text-rose-500/30 hover:text-rose-500 transition-colors">✕</button>
                                </div>
                              </div>
                            ))}
                            {managedProfile.favorites.length === 0 && <div className="flex flex-col items-center py-24 opacity-20"><span className="text-5xl mb-4 grayscale">⭐</span><p className="text-[10px] font-black uppercase tracking-[0.3em] font-righteous text-slate-600">Catalog is empty</p></div>}
                          </div>
                        </div>

                        <div className="bg-black/40 border border-white/5 rounded-[3rem] p-10 backdrop-blur-md">
                          <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-8 font-righteous">PERFORMANCE LOG ({managedProfile.personalHistory.length})</h4>
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                            {managedProfile.personalHistory.map((h, i) => (
                              <div key={i} className="bg-black/60 border border-white/5 p-5 rounded-2xl group hover:neon-border-cyan transition-all">
                                <div className="flex justify-between items-start">
                                  <div className="min-w-0 pr-6">
                                    <div className="text-base font-black text-white truncate uppercase tracking-tight font-righteous group-hover:text-cyan-400 transition-colors">{h.songName}</div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 font-righteous opacity-60">{h.artist}</div>
                                  </div>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                    <button onClick={() => setProfileItemToEdit({ type: 'history', itemId: h.id })} className="p-2 text-slate-700 hover:text-white transition-colors">✏️</button>
                                    <button onClick={async () => { await removeUserHistoryItem(managedProfile!.id, h.id); await refresh(); }} className="p-2 text-rose-500/30 hover:text-rose-500 transition-colors">✕</button>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
                                  <span className="text-[8px] text-slate-600 font-black uppercase font-righteous tracking-widest">{new Date(h.createdAt).toLocaleDateString()}</span>
                                  <button
                                    onClick={async () => { await reAddFromHistory(h, true); await refresh(); }}
                                    className="px-5 py-2 bg-pink-500 text-white rounded-xl text-[9px] font-black uppercase font-righteous shadow-lg shadow-pink-900/20 hover:bg-pink-400 transition-all"
                                  >
                                    RE-QUEUE
                                  </button>
                                </div>
                              </div>
                            ))}
                            {managedProfile.personalHistory.length === 0 && <div className="flex flex-col items-center py-24 opacity-20"><span className="text-5xl mb-4 grayscale">🎤</span><p className="text-[10px] font-black uppercase tracking-[0.3em] font-righteous text-slate-600">No transmissions recorded</p></div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : isCreatingProfile ? (
                  <form onSubmit={handleProfileFormSubmit} className="max-w-xl mx-auto bg-black border border-white/10 p-12 rounded-[3.5rem] space-y-8 shadow-3xl animate-in fade-in zoom-in-95 duration-500">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter font-bungee neon-glow-pink mb-4 text-center">{editingProfile ? 'Modify Profile' : 'New User Account'}</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-3 ml-4 tracking-[0.4em] font-righteous">IDENTITY HANDLE</label>
                        <input required type="text" value={profileForm.name} onChange={e => { setProfileForm({ ...profileForm, name: e.target.value }); setProfileError(''); }} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black uppercase font-righteous tracking-widest outline-none focus:neon-border-pink transition-all" />
                      </div>

                      {profileError && (
                        <div className="mb-6 animate-pulse">
                          <p className="text-pink-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                            <span className="text-sm">⚠️</span> {profileError}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-3 ml-4 tracking-[0.4em] font-righteous">ENCRYPTION PIN (OPTIONAL)</label>
                        <input type="password" value={profileForm.password} onChange={e => setProfileForm({ ...profileForm, password: e.target.value })} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-black uppercase font-righteous tracking-widest outline-none focus:neon-border-pink transition-all" />
                      </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => { setIsCreatingProfile(false); setEditingProfile(null); }} className="flex-1 py-5 bg-black border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest font-righteous">ABORT</button>
                      <button type="submit" className="flex-[2] py-5 bg-cyan-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest font-righteous shadow-xl shadow-cyan-900/40 hover:bg-cyan-300">AUTHORIZE ACCOUNT</button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-20">
                    {(() => {
                      const connectedGuests = accounts.filter(user =>
                        !user.password &&
                        session.participants.some(p => p.id === user.id) &&
                        (user.name.toLowerCase().includes(directorySearch.toLowerCase()) || user.id.toLowerCase().includes(directorySearch.toLowerCase()))
                      );
                      const others = accounts.filter(user =>
                        (user.password || !session.participants.some(p => p.id === user.id)) &&
                        (user.name.toLowerCase().includes(directorySearch.toLowerCase()) || user.id.toLowerCase().includes(directorySearch.toLowerCase()))
                      );

                      return (
                        <>
                          {connectedGuests.length > 0 && (
                            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                              <div className="flex items-center gap-6">
                                <h3 className="text-[10px] font-black text-pink-500 uppercase tracking-[0.5em] font-righteous whitespace-nowrap">ACTIVE SIGNALS</h3>
                                <div className="h-[1px] w-full bg-gradient-to-r from-pink-500/30 to-transparent"></div>
                              </div>
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {connectedGuests.map(user => (
                                  <div key={user.id} className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-[3.5rem] p-8 flex flex-col justify-between hover:neon-border-pink transition-all shadow-2xl group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-pink-500/10 transition-colors" />
                                    <div className="flex items-start gap-6 mb-8 relative z-10">
                                      <UserAvatar name={user.name} isActive={true} />
                                      <div className="min-w-0">
                                        <button
                                          onClick={() => setManagedProfile(user)}
                                          className="text-white font-black text-xl uppercase truncate tracking-tighter text-left block hover:text-pink-500 transition-colors font-righteous"
                                        >
                                          {user.name}
                                        </button>
                                        <div className="flex items-center gap-2 mt-2">
                                          <span className="text-[8px] bg-pink-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest font-righteous">LIVE</span>
                                          <span className="text-[8px] text-slate-600 uppercase font-black font-righteous tracking-widest">{user.favorites.length} ★ • {user.personalHistory.length} TX</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 relative z-10">
                                      <div className="flex gap-3">
                                        <button onClick={() => setManagedProfile(user)} className="flex-[2] py-3 bg-black border border-white/10 hover:neon-border-pink text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all font-righteous">OPEN PROFILE</button>
                                        <button onClick={() => startEditProfile(user)} className="flex-1 py-3 bg-slate-900 border border-white/5 text-slate-500 hover:text-white rounded-xl text-[9px] font-black uppercase transition-all font-righteous">EDIT</button>
                                      </div>
                                      <button
                                        onClick={() => handleQuickSet(user)}
                                        className="w-full py-4 bg-cyan-400/10 hover:bg-cyan-400 text-cyan-400 hover:text-black rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-cyan-400/20 shadow-lg shadow-cyan-400/5 font-righteous"
                                      >
                                        ⚡ QUICK SET (3 RANDOM)
                                      </button>
                                      <div className="flex gap-3">
                                        <button
                                          onClick={() => setPickingSongForUser(user)}
                                          className="flex-[4] py-3 bg-pink-500/10 hover:bg-pink-500 text-pink-500 hover:text-white rounded-xl flex items-center justify-center gap-2 transition-all border border-pink-500/20 text-[9px] font-black uppercase font-righteous"
                                        >
                                          MANUAL SELECT
                                        </button>
                                        <button onClick={async () => { if (confirm('Terminate temporary link?')) { await deleteAccount(user.id); await refresh(); } }} className="flex-1 py-3 bg-rose-500/10 text-rose-500/40 hover:text-white hover:bg-rose-500 border border-rose-500/20 rounded-xl transition-all flex items-center justify-center">✕</button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center gap-6">
                              <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] font-righteous whitespace-nowrap">ARCHIVE DIRECTORY</h3>
                              <div className="h-[1px] w-full bg-white/5"></div>
                            </div>
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {others.map(user => {
                                const isActive = session.participants.some(p => p.id === user.id);
                                return (
                                  <div key={user.id} className={`bg-black/40 border ${isActive ? 'neon-border-cyan bg-cyan-500/5' : 'border-white/5'} rounded-[3.5rem] p-8 flex flex-col justify-between hover:neon-border-pink transition-all group`}>
                                    <div className="flex items-start gap-6 mb-8">
                                      <UserAvatar name={user.name} isActive={isActive} />
                                      <div className="min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                          <button
                                            onClick={() => setManagedProfile(user)}
                                            className="text-white font-black text-xl uppercase truncate tracking-tighter text-left block hover:text-pink-500 transition-colors font-righteous"
                                          >
                                            {user.name}
                                          </button>
                                        </div>
                                        <p className="text-[8px] text-slate-600 uppercase font-black tracking-[0.2em] mt-2 font-righteous">
                                          {user.password ? '🔐 AUTHENTICATED' : 'GUEST ID'} • {user.favorites.length} ★
                                        </p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                      <div className="flex gap-3">
                                        <button onClick={() => setManagedProfile(user)} className="flex-1 py-3 bg-black border border-white/10 hover:neon-border-pink text-white rounded-xl text-[9px] font-black uppercase transition-all font-righteous">LOG</button>
                                        <button onClick={() => startEditProfile(user)} className="flex-1 py-3 bg-black border border-white/10 hover:neon-border-pink text-white rounded-xl text-[9px] font-black uppercase transition-all font-righteous">EDIT</button>
                                        <button
                                          onClick={() => handleQuickSet(user)}
                                          className="flex-[2] py-3 bg-cyan-400 text-black rounded-xl text-[9px] font-black uppercase transition-all shadow-lg shadow-cyan-900/10 font-righteous hover:bg-cyan-300"
                                        >
                                          AUTO-SET
                                        </button>
                                      </div>
                                      <div className="flex gap-3">
                                        <button
                                          onClick={() => setPickingSongForUser(user)}
                                          className="flex-[4] py-3 bg-slate-900 border border-white/5 hover:neon-border-pink text-slate-500 hover:text-white rounded-xl flex items-center justify-center gap-2 transition-all text-[9px] font-black uppercase font-righteous"
                                        >
                                          MANUAL SELECT
                                        </button>
                                        <button onClick={async () => { if (confirm('Erase this record permanently?')) { await deleteAccount(user.id); await refresh(); } }} className="flex-1 py-3 bg-rose-500/5 text-rose-500/20 hover:text-rose-500 border border-transparent hover:border-rose-500/30 rounded-xl transition-all flex items-center justify-center">✕</button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {others.length === 0 && connectedGuests.length === 0 && (
                              <div className="text-center py-32 bg-black/20 rounded-[4rem] border-2 border-dashed border-white/5">
                                <p className="text-slate-800 text-[11px] font-black uppercase tracking-[0.5em] font-righteous">EMPTY DIRECTORY - NO SIGNALS DETECTED</p>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }



      {
        (isAddingRequest || requestToEdit || profileItemToEdit || prefilledSinger || isAddingVerifiedSong || verifiedSongToEdit) && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[100] backdrop-blur-xl">
            <div className="w-full max-w-md">
              {(() => {
                let initialData = { singerName: '', songName: '', artist: '', youtubeUrl: '', type: RequestType.SINGING };
                let title = "Global Track Input";

                if (profileItemToEdit && managedProfile) {
                  if (profileItemToEdit.type === 'favorite') {
                    const fav = managedProfile.favorites.find(f => f.id === profileItemToEdit.itemId);
                    if (fav) {
                      initialData = { singerName: managedProfile.name, songName: fav.songName, artist: fav.artist, youtubeUrl: fav.youtubeUrl || '', type: fav.type };
                      title = `Edit Permanent Favorite for ${managedProfile.name}`;
                    }
                  } else {
                    const hist = managedProfile.personalHistory.find(h => h.id === profileItemToEdit.itemId);
                    if (hist) {
                      initialData = { singerName: managedProfile.name, songName: hist.songName, artist: hist.artist, youtubeUrl: hist.youtubeUrl || '', type: hist.type };
                      title = `Edit History Entry for ${managedProfile.name}`;
                    }
                  }
                } else if (requestToEdit) {
                  initialData = { singerName: requestToEdit.participantName, songName: requestToEdit.songName, artist: requestToEdit.artist, youtubeUrl: requestToEdit.youtubeUrl || '', type: requestToEdit.type };
                  title = "Modify Track";
                } else if (verifiedSongToEdit) {
                  initialData = { singerName: '', songName: verifiedSongToEdit.songName, artist: verifiedSongToEdit.artist, youtubeUrl: verifiedSongToEdit.youtubeUrl || '', type: verifiedSongToEdit.type };
                  title = "Edit Verified Song";
                } else if (isAddingVerifiedSong) {
                  initialData = { singerName: '', songName: '', artist: '', youtubeUrl: '', type: RequestType.SINGING };
                  title = "Add to Verified Songbook";
                } else if (prefilledSinger) {
                  initialData.singerName = prefilledSinger.name;
                  title = `Song for ${prefilledSinger.name}`;
                }

                return (
                  <SongRequestForm
                    key={requestToEdit?.id || profileItemToEdit?.itemId || prefilledSinger?.id || verifiedSongToEdit?.id || (isAddingVerifiedSong ? 'new-verified' : 'new-request')}
                    title={title}
                    showSingerName={!profileItemToEdit && !verifiedSongToEdit && !isAddingVerifiedSong}
                    initialSingerName={initialData.singerName}
                    initialSongName={initialData.songName}
                    initialArtist={initialData.artist}
                    initialYoutubeUrl={initialData.youtubeUrl}
                    initialType={initialData.type}
                    submitLabel={(requestToEdit || profileItemToEdit || verifiedSongToEdit) ? "Save Update" : (isAddingVerifiedSong ? "Add to Library" : "Queue Track")}
                    onSubmit={handleManualRequestSubmit}
                    onCancel={closeModals}
                  />
                );
              })()}
            </div>
          </div>
        )
      }

      {
        showQrModal && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[100] backdrop-blur-3xl">
            <div className="w-full max-w-md bg-black border border-white/10 rounded-[4rem] p-10 shadow-3xl text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"></div>
              <h3 className="text-3xl font-black text-white uppercase mb-4 tracking-tighter font-bungee neon-glow-pink">Access Entry</h3>
              <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-8 font-righteous opacity-60">Point Guest cameras at the code below</p>
              <div className="bg-white p-8 rounded-[3rem] inline-block shadow-3xl mb-10 relative group">
                <div className="absolute -inset-4 bg-gradient-to-tr from-pink-500/20 to-cyan-500/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(roomJoinUrl)}&bgcolor=ffffff`} alt="Room QR" className="w-56 h-56 relative z-10" />
              </div>
              <div className="text-[10px] text-white/40 font-mono break-all mb-10 font-black lowercase opacity-30 px-8 leading-relaxed select-all cursor-pointer hover:opacity-100 transition-opacity">{roomJoinUrl}</div>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => { setShowQrModal(false); setShowNetworkConfig(true); }}
                  className="w-full py-5 bg-black border border-white/10 hover:neon-border-pink text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all font-righteous"
                >
                  ⚙️ CONFIGURE SIGNAL ORIGIN
                </button>
                <button onClick={closeModals} className="w-full py-5 bg-black border border-white/10 text-slate-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all font-righteous">DISMISS PANEL</button>
              </div>
            </div>
          </div>
        )
      }

      {
        showNetworkConfig && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200] backdrop-blur-3xl">
            <div className="w-full max-w-xl bg-black border border-white/10 p-12 rounded-[4rem] shadow-3xl relative overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"></div>
              <h3 className="text-3xl font-black text-white uppercase mb-2 tracking-tighter font-bungee neon-glow-pink">Signal Origin</h3>
              <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mb-10 font-righteous opacity-60">Set the endpoint for guest terminal connections</p>

              <div className="space-y-8">
                <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 border-dashed">
                  <p className="text-[10px] text-slate-600 uppercase font-black mb-3 tracking-[0.3em] font-righteous">LOCAL ENVIRONMENT DETECTION</p>
                  <div className="text-sm text-cyan-400 font-mono font-black tracking-widest">
                    {window.location.hostname} <span className="text-[10px] text-slate-700 opacity-60">(CURRENT HOST)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-4 ml-4 tracking-[0.4em] font-righteous">TERMINAL ADDRESS / PUBLIC TUNNEL URL</label>
                  <input
                    type="text"
                    value={networkIpInput}
                    onChange={(e) => setNetworkIpInput(e.target.value)}
                    placeholder="E.G. 192.168.1.15 OR HTTPS://SIGNAL.NGROK.APP"
                    className="w-full bg-black border border-white/10 rounded-2xl px-6 py-5 text-white font-black uppercase font-mono tracking-widest outline-none focus:neon-border-pink transition-all placeholder:text-slate-900"
                  />
                </div>

                <div className="bg-pink-500/5 border border-pink-500/10 p-6 rounded-2xl">
                  <p className="text-[10px] text-pink-500/60 font-black leading-relaxed uppercase tracking-widest font-righteous italic">
                    Note: Cross-network connectivity requires tunneling (ngrok) for public-private bridge.
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setShowNetworkConfig(false)}
                    className="flex-1 py-5 bg-black border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest font-righteous"
                  >
                    ABORT
                  </button>
                  <button
                    onClick={handleSaveNetworkIp}
                    className="flex-[2] py-5 bg-cyan-400 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest font-righteous shadow-xl shadow-cyan-900/40"
                  >
                    AUTHORIZE CONFIG
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {
        pickingSongForUser && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200] backdrop-blur-3xl">
            <div className="w-full max-w-4xl bg-black border border-white/10 rounded-[4rem] overflow-hidden shadow-3xl flex flex-col max-h-[90vh] relative animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500"></div>
              <div className="p-10 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-xl">
                <div>
                  <h2 className="text-3xl font-black text-white font-bungee uppercase tracking-tighter neon-glow-pink">Signal Selection</h2>
                  <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em] mt-2 font-righteous opacity-60">Verified Catalog • Target: <span className="text-pink-500">{pickingSongForUser.name}</span></p>
                </div>
                <button onClick={() => setPickingSongForUser(null)} className="text-slate-700 hover:text-white p-3 font-black text-2xl transition-colors">✕</button>
              </div>

              <div className="p-10 bg-black/20 border-b border-white/5">
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="FILTER VERIFIED TRANSMISSIONS..."
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-2xl px-12 py-5 text-white font-black uppercase tracking-widest font-righteous outline-none focus:neon-border-pink transition-all shadow-inner placeholder:text-slate-900"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-pink-500 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-3 bg-black/20">
                {verifiedSongs
                  .filter(s =>
                    s.songName.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                    s.artist.toLowerCase().includes(pickerSearch.toLowerCase())
                  )
                  .map(v => (
                    <button
                      key={v.id}
                      onClick={async () => {
                        const newRequest = await addRequest({
                          participantId: pickingSongForUser.id,
                          participantName: pickingSongForUser.name,
                          songName: v.songName,
                          artist: v.artist,
                          youtubeUrl: v.youtubeUrl,
                          type: v.type
                        });
                        if (newRequest) {
                          await approveRequest(newRequest.id);
                        }
                        setPickingSongForUser(null);
                        setPickerSearch('');
                        await refresh();
                      }}
                      className="w-full flex justify-between items-center p-6 bg-black/40 hover:bg-white/5 border border-white/5 hover:neon-border-pink rounded-3xl transition-all group text-left"
                    >
                      <div className="min-w-0 pr-6">
                        <div className="text-xl font-black text-white uppercase truncate font-righteous group-hover:text-pink-500 transition-colors tracking-tight">{v.songName}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 font-righteous opacity-60">{v.artist}</div>
                      </div>
                      <div className="text-[9px] font-black text-cyan-400 bg-cyan-400/5 px-4 py-2 rounded-xl uppercase border border-cyan-400/10 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 font-righteous">
                        AUTHORIZE SIGNAL
                      </div>
                    </button>
                  ))}
                {verifiedSongs.length === 0 && (
                  <div className="text-center py-32 bg-black/10 rounded-[3rem] border-2 border-dashed border-white/5">
                    <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-800 font-righteous">NO VERIFIED RECORDS DETECTED</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    </div >

  );
};

export default DJView;