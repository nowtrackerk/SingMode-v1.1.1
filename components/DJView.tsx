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
  reorderCurrentRound, reorderRequests, reorderPendingRequests,
  banUser, setMaxRequestsPerUser, markRequestAsDone, logoutUser
} from '../services/sessionManager';
import SongRequestForm from './SongRequestForm';
import { syncService } from '../services/syncService';
import { getNetworkUrl, setNetworkIp, getStoredNetworkIp } from '../services/networkUtils';

interface DJViewProps {
  onAdminAccess?: () => void;
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
      className="p-3 rounded-2xl text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 border-2 border-[var(--neon-cyan)]/10 transition-all shadow-xl"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
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
      className={`p-3 rounded-2xl transition-all border-2 ${copied ? 'bg-[var(--neon-cyan)] text-black border-[var(--neon-cyan)] shadow-[0_0_20px_var(--neon-cyan)]' : 'text-slate-400 hover:text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10 border-white/5 shadow-xl'}`}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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

  const handleCopy = () => {
    const type = (request as SongRequest).type || (request as VerifiedSong).type || RequestType.SINGING;
    const suffix = type === RequestType.SINGING ? ' Karaoke' : ' Lyric';
    const text = `${songName} ${request.artist}${suffix}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy Command String"
      className={`p-3 rounded-2xl transition-all border-2 ${copied ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] shadow-[0_0_20px_rgba(0,255,157,0.4)]' : 'text-slate-400 hover:text-[var(--neon-green)] hover:bg-[var(--neon-green)]/10 border-white/5 shadow-xl'}`}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  );
};

const YouTubeSearchButton: React.FC<{ request: SongRequest | VerifiedSong }> = ({ request }) => {
  const songName = (request as SongRequest).songName || (request as VerifiedSong).songName;
  const handleSearch = () => {
    const type = (request as SongRequest).type || (request as VerifiedSong).type || RequestType.SINGING;
    const suffix = type === RequestType.SINGING ? ' Karaoke' : ' Lyric';
    const query = encodeURIComponent(`${songName} ${request.artist}${suffix}`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };

  return (
    <button
      onClick={handleSearch}
      title="Search on YouTube"
      className="p-3 rounded-2xl transition-all border-2 text-rose-500 hover:text-white hover:bg-rose-500 border-white/5 shadow-xl"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
      </svg>
    </button>
  );
};

const DJView: React.FC<DJViewProps> = ({ onAdminAccess }) => {
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
  const [banReason, setBanReason] = useState('');

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
          type: data.type,
          message: data.message
        });
      }
      setProfileItemToEdit(null);
    } else if (requestToEdit) {
      await updateRequest(requestToEdit.id, {
        participantName: data.singerName || requestToEdit.participantName,
        songName: data.songName,
        artist: data.artist,
        youtubeUrl: data.youtubeUrl,
        type: data.type,
        message: data.message
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
        type: data.type,
        message: data.message
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

  const handleDrop = async (e: React.DragEvent, targetIndexUI: number, type: 'ROUND' | 'QUEUE' | 'PENDING') => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedListType !== type) return;

    if (type === 'ROUND' && session?.currentRound) {
      const items = Array.from(session.currentRound);
      const [reorderedItem] = items.splice(draggedItemIndex, 1);
      items.splice(targetIndexUI, 0, reorderedItem);
      await reorderCurrentRound(items);
    } else if (type === 'QUEUE') {
      const list = approvedSinging;
      const items = Array.from(list);
      const [reorderedItem] = items.splice(draggedItemIndex, 1);
      items.splice(targetIndexUI, 0, reorderedItem);
      await reorderRequests(items);
    } else if (type === 'PENDING') {
      const list = pendingRequests;
      const items = Array.from(list);
      const [reorderedItem] = items.splice(draggedItemIndex, 1);
      items.splice(targetIndexUI, 0, reorderedItem);
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

  // Custom Interleaved Sorting Logic for Ready Nodes
  const approvedSingingRaw = session.requests.filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING && !r.isInRound);
  const participantsWithSongs = session.participants.filter(p => approvedSingingRaw.some(r => r.participantId === p.id))
    .sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0)); // Rank by Newest First

  const requestsByParticipant: { [key: string]: SongRequest[] } = {};
  approvedSingingRaw.forEach(r => {
    if (!requestsByParticipant[r.participantId]) requestsByParticipant[r.participantId] = [];
    requestsByParticipant[r.participantId].push(r);
  });
  // Sort each user's requests by creation time
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
            <span className="text-xl font-black text-white tracking-widest">{initials}</span>
          </div>
        </div>
        {isActive && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--neon-green)] rounded-full border-4 border-slate-950 animate-pulse" />
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 lg:p-8 space-y-12 relative font-inter text-slate-300">
      {/* Tropical Header */}
      <header className="relative rounded-[4rem] p-1 overflow-hidden shadow-3xl mb-12 group">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-blue)] opacity-80 group-hover:opacity-100 transition-all duration-1000 animate-gradient-x"></div>
        <div className="relative glass-panel rounded-[3.9rem] p-10 flex flex-col md:flex-row justify-between items-center gap-12 border border-white/20 backdrop-blur-3xl">
          <div className="flex items-center gap-10">
            <div className="relative group/logo">
              <div className="absolute inset-0 bg-gradient-to-tr from-[var(--neon-yellow)] to-[var(--neon-pink)] rounded-full blur-xl opacity-60 group-hover/logo:opacity-100 transition-opacity duration-500"></div>
              <div className="relative p-1.5 rounded-full border-4 border-white/10 shadow-2xl bg-black/40">
                <img src="IGK.jpeg" alt="Island Groove" className="w-32 h-32 rounded-full transition-transform duration-700 group-hover/logo:rotate-[360deg]" />
              </div>
            </div>
            <div>
              <h1 className="text-8xl font-bold font-bungee text-white flex items-center gap-6 uppercase tracking-tight neon-glow-pink leading-none">
                SINGMODE <span className="text-[var(--neon-blue)] neon-glow-cyan text-5xl font-righteous translate-y-2">MAX</span>
              </h1>
              <div className="flex items-center gap-4 mt-4">
                <span className="px-4 py-1.5 rounded-full bg-[var(--neon-pink)]/10 border border-[var(--neon-pink)]/30 text-[var(--neon-pink)] text-lg font-bold uppercase tracking-widest font-righteous">SYS_OP_01</span>
                <span className="text-[var(--neon-blue)]/30">||</span>
                <span className="text-[var(--neon-blue)] text-lg font-bold uppercase tracking-widest font-righteous neon-glow-cyan">ACTIVE_NODES: {session.participants.length}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="text-right">
              <div className="text-base text-[var(--neon-yellow)] font-bold uppercase tracking-widest font-righteous mb-1">SYSTEM_STATUS</div>
              <div className="text-4xl text-white font-bold uppercase tracking-widest font-bungee flex items-center justify-end gap-3">
                ONLINE <div className="w-3 h-3 bg-[var(--neon-green)] rounded-full animate-pulse shadow-[0_0_10px_var(--neon-green)]"></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Retro Control Deck */}
      <div className="sticky top-4 z-50">
        <div className="glass-panel p-4 rounded-[2.5rem] border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-wrap items-center gap-4 backdrop-blur-3xl">
          <div className="flex gap-3 p-2 bg-black/40 rounded-[2rem] border border-white/5">
            <button onClick={() => setIsAddingRequest(true)} className="px-8 py-4 bg-[var(--neon-pink)] text-black font-black hover:bg-white transition-all active:scale-95 rounded-[1.5rem] shadow-[0_0_25px_rgba(255,42,109,0.4)] text-lg uppercase tracking-[0.2em] font-righteous flex items-center gap-3 group">
              <span className="text-3xl group-hover:rotate-90 transition-transform">＋</span> TRACK
            </button>

            <button
              onClick={() => { setShowRoundConfirm(true); refresh(); }}
              className="px-8 py-4 bg-[var(--neon-blue)] text-black font-black hover:bg-white transition-all uppercase tracking-[0.2em] text-lg active:scale-95 rounded-[1.5rem] shadow-[0_0_25px_rgba(5,217,232,0.4)] font-righteous flex items-center gap-3 group"
            >
              <span className="text-3xl group-hover:animate-spin">↻</span> SEQUENCE
            </button>
          </div>

          <div className="w-[1px] h-12 bg-white/10 mx-2"></div>

          <div className="flex gap-2">
            <button onClick={() => setShowQrModal(true)} className="w-14 h-14 flex items-center justify-center text-[var(--neon-yellow)] border border-[var(--neon-yellow)]/30 bg-[var(--neon-yellow)]/5 hover:bg-[var(--neon-yellow)] hover:text-black transition-all rounded-[1.2rem] shadow-[0_0_15px_rgba(255,200,87,0.1)] group">
              <span className="text-4xl group-hover:scale-110 transition-transform">📱</span>
            </button>

            <button onClick={() => setShowUserManager(true)} className="w-14 h-14 flex items-center justify-center text-[var(--neon-blue)] border border-[var(--neon-blue)]/30 bg-[var(--neon-blue)]/5 hover:bg-[var(--neon-blue)] hover:text-black transition-all rounded-[1.2rem] shadow-[0_0_15px_rgba(5,217,232,0.1)] group">
              <span className="text-4xl group-hover:scale-110 transition-transform">👥</span>
            </button>

            <button onClick={() => setShowResetConfirm(true)} className="w-14 h-14 flex items-center justify-center text-rose-500 border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500 hover:text-white transition-all rounded-[1.2rem] shadow-[0_0_15px_rgba(244,63,94,0.1)] group">
              <span className="text-4xl group-hover:rotate-12 transition-transform">☢️</span>
            </button>

            {onAdminAccess && (
              <button onClick={onAdminAccess} title="ADMIN PORTAL" className="w-14 h-14 flex items-center justify-center text-[var(--neon-purple)] border border-[var(--neon-purple)]/30 bg-[var(--neon-purple)]/5 hover:bg-[var(--neon-purple)] hover:text-black transition-all rounded-[1.2rem] shadow-[0_0_15px_rgba(147,51,234,0.1)] group ml-4 relative">
                <span className="text-4xl group-hover:scale-110 transition-transform">⚙️</span>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--neon-pink)] rounded-full animate-pulse border-2 border-black"></span>
              </button>
            )}

            <button
              onClick={async () => {
                if (confirm('Are you sure you want to sign out?')) {
                  await logoutUser();
                  window.location.reload();
                }
              }}
              title="SIGN OUT"
              className="px-6 h-14 flex items-center justify-center gap-3 text-rose-500 border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500 hover:text-white transition-all rounded-[1.2rem] shadow-[0_0_15px_rgba(244,63,94,0.1)] group ml-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              <span className="text-[10px] font-black uppercase tracking-widest font-righteous">SIGN_OUT</span>
            </button>
          </div>

          <div className="flex-1"></div>

          <div className="flex gap-2 p-2 bg-black/40 rounded-[2rem] border border-white/5 overflow-x-auto no-scrollbar">
            {(['COMMAND', 'ROTATION', 'PERFORMERS', 'LIBRARY'] as DJTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); }}
                className={`px-8 py-3 text-base font-bold uppercase tracking-widest transition-all rounded-[1.2rem] font-righteous ${activeTab === tab
                  ? 'bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.4)] scale-105'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
                  }`}
              >
                {tab === 'COMMAND' ? 'DECK' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="min-h-[600px] animate-in fade-in duration-500">
        {activeTab === 'COMMAND' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-2">
            <div className="lg:col-span-8 space-y-10">
              {session.currentRound && (
                <section className="relative rounded-[3rem] p-1 overflow-hidden shadow-[0_0_100px_rgba(255,42,109,0.3)] zoom-in-95 duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-orange)] opacity-20 animate-pulse"></div>
                  <div className="relative bg-[#150030]/90 p-10 rounded-[2.8rem] backdrop-blur-xl border-2 border-[var(--neon-green)]/50">
                    <div className="flex justify-between items-center mb-8">
                      <h2 className="text-4xl font-bold font-bungee text-white uppercase flex items-center gap-4 neon-glow-green">
                        <span className="text-6xl animate-pulse">▶</span> ACTIVE SEQUENCE
                      </h2>
                      <button onClick={async () => { await finishRound(); await refresh(); }} className="px-8 py-3 bg-[var(--neon-pink)] text-black text-base font-bold uppercase hover:bg-white transition-all rounded-[1rem] tracking-widest font-righteous shadow-[0_0_20px_var(--neon-pink)] active:scale-95">
                        FINISH_SET
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {session.currentRound.map((song, i) => {
                        const participant = session.participants.find(p => p.id === song.participantId);
                        const isReady = participant?.status === ParticipantStatus.READY;
                        // Find index of first non-done song
                        const activeIndex = session.currentRound!.findIndex(s => s.status !== RequestStatus.DONE);
                        const isActive = i === (activeIndex === -1 ? 0 : activeIndex);

                        return (
                          <div
                            key={song.id}
                            className={`p-3 pl-6 pr-4 rounded-xl border-l-8 transition-all duration-300 flex items-center justify-between gap-4 w-full shadow-lg relative overflow-hidden group ${isActive
                              ? 'bg-[#001005] border-l-[var(--neon-green)] border-y border-r border-[#1a3320] z-10 scale-[1.01]'
                              : 'bg-[#0a0a10] border-l-slate-700 border-y border-r border-white/10 opacity-70 hover:opacity-100'
                              }`}
                          >
                            {/* Strip Background Grid Lines */}
                            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,rgba(255,255,255,0.03)_50%,transparent_51%)] bg-[length:50px_100%] pointer-events-none"></div>

                            {/* Left Side: Info Strip */}
                            <div className="flex items-center gap-6 min-w-0 flex-1 z-10">
                              {/* ID Box */}
                              <div className="w-16 h-full flex flex-col justify-center items-center border-r border-white/10 pr-4 shrink-0">
                                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest hidden sm:block">SEQ_ID</span>
                                <span className={`text-xl font-bold font-mono tracking-tighter ${isActive ? 'text-[var(--neon-green)]' : 'text-slate-400'}`}>
                                  {String(song.requestNumber).padStart(3, '0')}
                                </span>
                              </div>

                              {/* Main Info */}
                              <div className="flex items-baseline gap-6 min-w-0 flex-1">
                                <h3 className={`text-3xl font-black uppercase truncate font-righteous tracking-tight ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                  {song.songName}
                                </h3>
                                <div className="flex items-center gap-3 opacity-80 shrink-0">
                                  <span className="text-xl font-bold font-righteous text-[var(--neon-cyan)] uppercase tracking-wider">{song.artist}</span>
                                  <span className="text-slate-600 font-mono text-lg">/</span>
                                  <button onClick={() => viewPerformerProfile(song.participantId)} className="flex items-center gap-2 group/singer hover:underline">
                                    <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-[var(--neon-green)] shadow-[0_0_5px_var(--neon-green)]' : 'bg-slate-700'}`}></div>
                                    <span className="text-xl font-bold font-righteous text-[var(--neon-pink)] uppercase tracking-wider">@{song.participantName}</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Right Side: Control Cluster */}
                            <div className="flex items-center gap-3 z-10 pl-4 border-l border-white/10 bg-gradient-to-l from-black/80 to-transparent">
                              {isActive && (
                                <div className="px-3 py-1 bg-[var(--neon-green)] text-black text-[10px] font-black uppercase tracking-[0.2em] rounded animate-pulse shadow-[0_0_10px_var(--neon-green)] mr-2 shrink-0">
                                  LIVE
                                </div>
                              )}

                              <CopyButton request={song} />

                              <button
                                disabled={song.status === RequestStatus.DONE}
                                onClick={async () => {
                                  await markRequestAsDone(song.id);
                                  await refresh();
                                }}
                                className={`h-8 px-4 rounded text-xs font-black uppercase tracking-wider font-righteous transition-all border ${song.status === RequestStatus.DONE
                                  ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                                  : 'bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border-[var(--neon-cyan)]/50 hover:bg-[var(--neon-cyan)] hover:text-black'
                                  }`}
                              >
                                {song.status === RequestStatus.DONE ? 'DONE' : 'MARK DONE'}
                              </button>

                              <button
                                onClick={async () => {
                                  if (confirm('Remove from active round?')) {
                                    await deleteRequest(song.id);
                                    await refresh();
                                  }
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all border border-rose-500/20"
                                title="REMOVE"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              <section className="bg-[#10002B]/80 border-2 border-[var(--neon-blue)]/30 rounded-[3rem] p-10 shadow-[0_0_60px_rgba(5,217,232,0.1)] relative overflow-hidden backdrop-blur-md">
                <div className="flex justify-between items-center mb-8 px-2">
                  <h2 className="text-4xl font-bold font-bungee text-white uppercase flex items-center gap-4 neon-glow-cyan">
                    <span className="text-[var(--neon-blue)]">⟳</span> QUEUE VALIDATION
                  </h2>
                  <span className="px-6 py-2 bg-[var(--neon-blue)]/10 border border-[var(--neon-blue)]/30 rounded-full text-base text-[var(--neon-blue)] font-bold tracking-widest font-righteous">
                    {pendingRequests.length} PENDING
                  </span>
                </div>
                <div className="flex flex-col gap-4">
                  {pendingRequests.map((req, i) => (
                    <div
                      key={req.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, i, 'PENDING')}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, i, 'PENDING')}
                      className="bg-black/40 border border-white/5 p-4 rounded-3xl flex items-center gap-6 hover:border-[var(--neon-blue)] transition-all group cursor-move shadow-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 mb-1">
                          <div className="text-xs font-black font-righteous text-[var(--neon-pink)] uppercase tracking-[0.2em] bg-[var(--neon-pink)]/10 px-2 py-0.5 rounded-full border border-[var(--neon-pink)]/20 shrink-0">
                            NEW_SIGNAL
                          </div>
                          <div className="text-3xl font-black text-white uppercase truncate tracking-tighter font-bungee group-hover:text-[var(--neon-blue)] transition-colors">{req.songName}</div>
                          <div className="text-slate-500 text-base font-black uppercase tracking-[0.2em] font-righteous truncate">/ {req.artist}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => viewPerformerProfile(req.participantId)} className="text-base font-bold text-[var(--neon-pink)] uppercase truncate hover:text-white transition-colors font-righteous tracking-[0.2em]">@{req.participantName}</button>
                          {req.message && (
                            <div className="flex-1 max-w-md px-3 py-1 bg-black/40 border-l-2 border-[var(--neon-pink)] rounded-r-lg">
                              <p className="text-base text-white/60 font-medium italic truncate">"{req.message}"</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton request={req} />
                          <YouTubeSearchButton request={req} />
                          <VideoLink url={req.youtubeUrl} />
                          <button onClick={() => setRequestToEdit(req)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-black uppercase tracking-widest transition-all font-righteous text-white/50 hover:text-white border border-white/5">EDIT</button>
                        </div>
                        <div className="flex gap-2 bg-black/40 p-1 rounded-2xl border border-white/5">
                          <button onClick={async () => { await approveRequest(req.id); await refresh(); }} className="px-6 py-3 bg-[var(--neon-blue)] text-black text-sm font-black uppercase hover:bg-white transition-all rounded-xl tracking-[0.1em] shadow-[0_0_20px_rgba(5,217,232,0.3)]">ACCEPT</button>
                          <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="w-11 h-11 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">✕</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingRequests.length === 0 && (
                    <div className="col-span-full py-24 text-center border-4 border-dashed border-white/5 rounded-[2.5rem] opacity-30">
                      <p className="text-4xl font-black font-righteous uppercase tracking-[0.4em] italic text-slate-500">NO SIGNAL DETECTED</p>
                    </div>
                  )}
                </div>
              </section>

              <div className="flex flex-col gap-10">
                <section className="bg-[#10002B]/60 border-2 border-[var(--neon-yellow)]/20 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden backdrop-blur-sm">
                  <h3 className="text-5xl font-bold font-bungee text-white uppercase mb-8 px-2 neon-glow-yellow flex items-center gap-4">
                    <span className="text-[var(--neon-yellow)] animate-pulse">★</span> READY NODES
                  </h3>
                  <div className="flex flex-col gap-3">
                    {approvedSinging.map((req, i) => (
                      <div
                        key={req.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, i, 'QUEUE')}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, i, 'QUEUE')}
                        className="bg-black/40 border border-white/5 p-4 rounded-[2rem] flex items-center gap-6 group hover:border-[var(--neon-yellow)] transition-all cursor-move shadow-lg relative"
                      >
                        <div className="w-12 h-12 flex items-center justify-center bg-black/40 rounded-2xl border border-white/5 text-[var(--neon-yellow)] font-bungee text-3xl shrink-0 group-hover:scale-110 transition-transform">
                          {i + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-4 mb-0.5">
                            <div className="text-2xl font-bold text-white truncate uppercase tracking-tight font-bungee group-hover:text-[var(--neon-yellow)] transition-colors">{req.songName}</div>
                            <div className="text-sm text-slate-500 uppercase tracking-widest font-righteous">/ {req.artist}</div>
                          </div>
                          <div className="flex items-center gap-4">
                            <button onClick={(e) => { e.stopPropagation(); viewPerformerProfile(req.participantId); }} className="text-sm font-black text-[var(--neon-yellow)] uppercase tracking-[0.2em] font-righteous hover:text-white transition-colors">@{req.participantName}</button>
                            {req.message && (
                              <div className="flex-1 max-w-sm px-2 py-0.5 bg-[var(--neon-yellow)]/5 border-l border-[var(--neon-yellow)]/30 rounded-r text-xs text-[var(--neon-yellow)]/70 italic truncate">
                                "{req.message}"
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="flex flex-col gap-0.5 px-2">
                            <button onClick={async () => { await reorderRequest(req.id, 'up'); await refresh(); }} className="text-slate-700 hover:text-white transition-colors p-1 text-base">▲</button>
                            <button onClick={async () => { await reorderRequest(req.id, 'down'); await refresh(); }} className="text-slate-700 hover:text-white transition-colors p-1 text-base">▼</button>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <CopyButton request={req} />
                            <YouTubeSearchButton request={req} />
                            <VideoLink url={req.youtubeUrl} />
                            <button onClick={() => setRequestToEdit(req)} className="p-2 text-slate-600 hover:text-white text-xs font-black uppercase tracking-widest font-righteous transition-colors border border-white/5 rounded-lg">EDIT</button>
                          </div>
                          <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                            <button onClick={() => handlePromoteToStage(req.id)} className="px-4 py-2 bg-[var(--neon-yellow)] text-black text-sm font-black uppercase rounded-lg hover:bg-white transition-all shadow-[0_0_15px_rgba(255,200,87,0.3)] tracking-wider">STAGE</button>
                            <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="w-9 h-9 flex items-center justify-center text-rose-500/20 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">✕</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {approvedSinging.length === 0 && (
                      <div className="flex-1 py-12 flex items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] opacity-30 w-full">
                        <p className="text-xl font-black font-righteous uppercase tracking-[0.3em] text-slate-500">QUEUE EMPTY</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-[#10002B]/60 border-2 border-[var(--neon-green)]/20 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden backdrop-blur-sm">
                  <h3 className="text-3xl md:text-4xl font-bold font-bungee text-white uppercase mb-8 px-2 neon-glow-green flex items-center gap-4 flex-wrap">
                    <span className="text-[var(--neon-green)] animate-pulse">☢</span> ATMOSPHERE
                  </h3>

                  <div className="space-y-10">
                    <div className="p-6 bg-black/40 rounded-3xl border border-white/5 space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <label className="text-sm md:text-base font-black text-[var(--neon-cyan)] uppercase tracking-[0.2em] font-righteous opacity-80 break-words">MAX_REQUESTS_PER_NODE</label>
                        <span className="text-4xl font-black text-white font-bungee neon-glow-cyan">{session.maxRequestsPerUser || 5}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={session.maxRequestsPerUser || 5}
                        onChange={async (e) => { await setMaxRequestsPerUser(parseInt(e.target.value)); await refresh(); }}
                        className="w-full accent-[var(--neon-cyan)] bg-white/5 rounded-lg appearance-none h-2 cursor-pointer transition-all"
                      />
                      <div className="flex justify-between text-xs font-black text-slate-600 font-righteous uppercase tracking-widest">
                        <span>STRICT (1)</span>
                        <span>UNLIMITED (20)</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-[var(--neon-pink)] uppercase tracking-[0.4em] mb-4 flex items-center gap-4 font-righteous opacity-80">
                        BACKGROUND THREADS
                      </h4>
                      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar custom-scrollbar-h">
                        {[...approvedListening].reverse().map((req) => (
                          <div key={req.id} className="bg-black/60 p-5 rounded-[2rem] border border-white/10 flex flex-col justify-between group hover:border-[var(--neon-pink)] transition-all shadow-lg min-w-[280px] max-w-[280px]">
                            <div className="min-w-0 mb-4 cursor-pointer" onClick={() => handleSongSearch(req.songName, req.artist, req.type)}>
                              <div className="text-2xl font-black text-white truncate uppercase tracking-tight font-bungee group-hover:text-[var(--neon-pink)] transition-all">{req.songName}</div>
                              <div className="text-base text-slate-500 uppercase tracking-widest mt-1 font-righteous opacity-60 truncate">{req.artist}</div>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-4">
                              <VideoLink url={req.youtubeUrl} />
                              <div className="flex gap-2">
                                <button onClick={() => handlePromoteToStage(req.id)} className="px-4 py-2 bg-[var(--neon-purple)] text-white text-sm font-black uppercase rounded-lg hover:bg-white hover:text-black transition-all shadow-[0_0_10px_var(--neon-purple)] tracking-[0.1em]">BOOST</button>
                                <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="text-rose-500/20 hover:text-rose-500 p-2 font-black">✕</button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {approvedListening.length === 0 && <p className="text-base text-slate-700 italic px-4 font-righteous uppercase tracking-widest opacity-50">NO BACKGROUND TRACKS</p>}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5">
                      <h4 className="text-base font-black text-[var(--neon-cyan)] uppercase tracking-[0.4em] mb-6 flex justify-between items-center font-righteous opacity-80">
                        <span>VERIFIED_LINKS</span>
                        <button onClick={() => setIsAddingVerifiedSong(true)} className="text-[var(--neon-cyan)] hover:text-white transition-colors underline decoration-dotted">+ ADD NEW</button>
                      </h4>
                      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar custom-scrollbar-h">
                        {[...verifiedSongs].reverse().map(v => (
                          <div key={v.id} className="bg-black/80 p-5 rounded-[2rem] border border-white/5 flex flex-col justify-between group hover:border-[var(--neon-cyan)] transition-all shadow-lg min-w-[280px] max-w-[280px]">
                            <div className="min-w-0 mb-4">
                              <div className="text-2xl font-bold text-white uppercase truncate tracking-tight group-hover:text-[var(--neon-cyan)] transition-colors font-bungee mb-1">{v.songName}</div>
                              <div className="text-sm text-slate-600 uppercase truncate tracking-widest font-righteous font-bold">{v.artist}</div>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-4">
                              <div className="flex gap-1">
                                <CopyUrlButton url={v.youtubeUrl} />
                                <button onClick={() => setVerifiedSongToEdit(v)} className="text-slate-600 hover:text-white p-2">✎</button>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={() => handleSongSearch(v.songName, v.artist, v.type)}
                                  className="px-3 py-1 bg-black border border-[var(--neon-cyan)] text-[var(--neon-cyan)] text-sm font-black uppercase rounded-md hover:bg-[var(--neon-cyan)] hover:text-black transition-all tracking-widest"
                                >
                                  RUN
                                </button>
                                <button
                                  onClick={() => { setIsAddingRequest(true); }}
                                  className="px-3 py-1 bg-[var(--neon-pink)] text-black text-sm font-black uppercase rounded-md hover:bg-white transition-all shadow-lg tracking-widest"
                                >
                                  PUSH
                                </button>
                                <button onClick={async () => { if (confirm('Delete verified song?')) { await deleteVerifiedSong(v.id); await refresh(); } }} className="text-rose-500/20 hover:text-rose-500 px-1 font-black">✕</button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {verifiedSongs.length === 0 && <p className="text-xl text-slate-800 italic px-4 font-righteous uppercase tracking-widest opacity-30">NO VERIFIED SONGS</p>}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              <section className="bg-[#0a0a0a] border-4 border-white/5 rounded-[3rem] p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col h-[600px]">
                <div className="flex justify-between items-center mb-6 px-2">
                  <h2 className="text-4xl font-bold font-bungee text-white uppercase tracking-tight opacity-90">PERFORMERS</h2>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    <div className="w-2 h-2 rounded-full bg-[var(--neon-cyan)] animate-pulse"></div>
                    <span className="text-sm text-[var(--neon-cyan)] font-bold uppercase tracking-widest">{liveMicCount} ONLINE</span>
                  </div>
                </div>
                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
                  {session.participants.map(p => {
                    const isReady = p.status === ParticipantStatus.READY;
                    const requests = session.requests.filter(r => r.participantId === p.id);
                    const approvedCount = requests.filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING).length;

                    return (
                      <div key={p.id} className={`flex items-center justify-between p-4 rounded-[1.5rem] transition-all border ${isReady ? 'bg-[#002a1a]/30 border-[var(--neon-green)] shadow-[0_0_15px_rgba(0,255,157,0.2)]' : 'bg-black/40 border-white/5 hover:bg-white/5'}`}>
                        <div className="min-w-0 flex items-center gap-4">
                          <button
                            onClick={async () => { await updateParticipantStatus(p.id, isReady ? ParticipantStatus.STANDBY : ParticipantStatus.READY); await refresh(); }}
                            className={`w-3 h-3 rounded-full shrink-0 transition-all ${isReady ? 'bg-[var(--neon-green)] shadow-[0_0_10px_var(--neon-green)]' : 'bg-slate-800'}`}
                          />
                          <div className="min-w-0">
                            <button
                              onClick={() => viewPerformerProfile(p.id)}
                              className={`text-xl font-black uppercase truncate text-left transition-colors font-righteous ${isReady ? 'text-white' : 'text-slate-500 hover:text-[var(--neon-green)]'}`}
                            >
                              {p.name}
                            </button>
                            {approvedCount > 0 && <span className="block text-xs text-[var(--neon-cyan)] font-black mt-0.5 tracking-[0.2em]">{approvedCount} REQUESTS</span>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setPrefilledSinger(p)} className="p-2 hover:text-[var(--neon-cyan)] transition-colors text-slate-600">
                            +
                          </button>
                          <button onClick={async () => { if (confirm(`Remove ${p.name}?`)) { await removeParticipant(p.id); await refresh(); } }} className="p-2 text-rose-500/20 hover:text-rose-500 transition-colors">✕</button>
                        </div>
                      </div>
                    );
                  })}
                  {session.participants.length === 0 && <div className="text-center py-20 opacity-20"><p className="text-lg font-righteous uppercase tracking-widest">NO DATA</p></div>}
                </div>
              </section>

              <section className="bg-[#0a0a0a] border-4 border-white/5 rounded-[3rem] p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-6 px-2">
                  <h2 className="text-4xl font-bold font-bungee text-white uppercase tracking-tight opacity-90">LOG</h2>
                  {session.history.length > 0 && (
                    <button onClick={async () => { await clearHistory(); await refresh(); }} className="text-sm font-bold text-rose-500/40 hover:text-rose-500 uppercase tracking-widest transition-all">
                      CLEAR
                    </button>
                  )}
                </div>
                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
                  {session.history.map((item, i) => (
                    <div key={i} className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col group hover:border-[var(--neon-purple)] transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0 pr-2">
                          <div className="text-xl font-bold text-white uppercase truncate tracking-tight group-hover:text-[var(--neon-purple)] transition-colors font-bungee">{item.songName}</div>
                          <div className="text-sm text-slate-600 uppercase truncate tracking-widest font-righteous">{item.artist}</div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <CopyButton request={item} />
                          <YouTubeSearchButton request={item} />
                          <VideoLink url={item.youtubeUrl} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 border-t border-white/5 pt-2">
                        <span className="text-base font-black text-[var(--neon-pink)] uppercase truncate">@{item.participantName}</span>
                        <button
                          onClick={async () => { await reAddFromHistory(item, true); await refresh(); }}
                          className="opacity-0 group-hover:opacity-100 text-xs font-black text-[var(--neon-pink)] hover:underline transition-all uppercase tracking-widest"
                        >
                          RE-QUEUE
                        </button>
                      </div>
                    </div>
                  ))}
                  {session.history.length === 0 && <div className="text-center py-16 opacity-20"><p className="text-lg italic font-righteous uppercase tracking-widest text-slate-800">EMPTY</p></div>}
                </div>
              </section>
            </div>
          </div>
        )
        }


        {
          activeTab === 'ROTATION' && (
            <div className="space-y-16 animate-in slide-in-from-bottom-2 pb-32">
              {session.currentRound && session.currentRound.length > 0 && (
                <section className="glass-panel border-4 rounded-[4rem] p-12 shadow-[0_0_100px_rgba(0,255,157,0.3)] relative overflow-hidden neon-sign-border-green">
                  <div className="flex items-center gap-8 mb-12">
                    <div className="w-8 h-8 bg-[var(--neon-green)] rounded-full animate-ping shadow-[0_0_25px_var(--neon-green)]"></div>
                    <h3 className="text-6xl font-black text-white uppercase tracking-tighter font-righteous neon-glow-green">CURRENT_ROTATION</h3>
                  </div>
                  <div className="flex flex-col gap-4">
                    {session.currentRound.map((song, i) => {
                      // Find index of first non-done song
                      const activeIndex = session.currentRound!.findIndex(s => s.status !== RequestStatus.DONE);
                      const isActive = i === (activeIndex === -1 ? 0 : activeIndex);

                      return (
                        <div
                          key={song.id}
                          className={`p-3 pl-6 pr-4 rounded-xl border-l-8 transition-all duration-300 flex items-center justify-between gap-4 w-full shadow-lg relative overflow-hidden group ${isActive
                            ? 'bg-[#001005] border-l-[var(--neon-green)] border-y border-r border-[#1a3320] z-10 scale-[1.01]'
                            : 'bg-[#0a0a10] border-l-slate-700 border-y border-r border-white/10 opacity-70 hover:opacity-100'
                            }`}
                        >
                          {/* Strip Background Grid Lines */}
                          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,rgba(255,255,255,0.03)_50%,transparent_51%)] bg-[length:50px_100%] pointer-events-none"></div>

                          {/* Left Side: Info Strip */}
                          <div className="flex items-center gap-6 min-w-0 flex-1 z-10">
                            {/* ID Box */}
                            <div className="w-16 h-full flex flex-col justify-center items-center border-r border-white/10 pr-4 shrink-0">
                              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">SEQ_ID</span>
                              <span className={`text-xl font-bold font-mono tracking-tighter ${isActive ? 'text-[var(--neon-green)]' : 'text-slate-400'}`}>
                                {String(song.requestNumber).padStart(3, '0')}
                              </span>
                            </div>

                            {/* Main Info */}
                            <div className="flex items-baseline gap-6 min-w-0 flex-1">
                              <h3 className={`text-3xl font-black uppercase truncate font-righteous tracking-tight ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                {song.songName}
                              </h3>
                              <div className="flex items-center gap-3 opacity-80 shrink-0">
                                <span className="text-xl font-bold font-righteous text-[var(--neon-cyan)] uppercase tracking-wider">{song.artist}</span>
                                <span className="text-slate-600 font-mono text-lg">/</span>
                                <span className="text-xl font-bold font-righteous text-[var(--neon-pink)] uppercase tracking-wider">@{song.participantName}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Control Cluster */}
                          <div className="flex items-center gap-3 z-10 pl-6 border-l border-white/10 bg-gradient-to-l from-black/80 to-transparent">
                            {isActive && (
                              <div className="px-3 py-1 bg-[var(--neon-green)] text-black text-[10px] font-black uppercase tracking-[0.2em] rounded animate-pulse shadow-[0_0_10px_var(--neon-green)] mr-2 shrink-0">
                                LIVE
                              </div>
                            )}
                            <div className="flex gap-2">
                              <CopyButton request={song} />
                              <YouTubeSearchButton request={song} />
                              <VideoLink url={song.youtubeUrl} />
                              <button onClick={() => setRequestToEdit(song)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white hover:text-black border border-white/10 transition-all text-slate-400 group" title="EDIT">
                                <span className="text-sm font-black font-righteous">EDIT</span>
                              </button>

                              <button
                                onClick={() => handlePlayOnStage(song)}
                                className="w-10 h-10 flex items-center justify-center rounded-lg bg-black border border-white/20 hover:bg-white hover:text-black hover:border-white transition-all group"
                                title="RESET TRACK"
                              >
                                <span className="text-lg">⏮</span>
                              </button>

                              <button
                                disabled={song.status === RequestStatus.DONE}
                                onClick={async () => {
                                  await markRequestAsDone(song.id);
                                  await refresh();
                                }}
                                className={`h-10 px-6 rounded-lg text-sm font-black uppercase tracking-widest font-righteous transition-all flex items-center gap-2 ${song.status === RequestStatus.DONE
                                  ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
                                  : 'bg-[var(--neon-cyan)]/10 hover:bg-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:text-black border border-[var(--neon-cyan)]/50'
                                  }`}
                              >
                                <span>{song.status === RequestStatus.DONE ? 'COMPLETED' : 'DONE'}</span>
                                {song.status !== RequestStatus.DONE && <span className="text-lg leading-none">→</span>}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="bg-[#050510] border-4 border-[var(--neon-cyan)]/30 rounded-[3rem] p-10 shadow-[0_0_80px_rgba(0,229,255,0.15)] relative overflow-hidden backdrop-blur-md">
                <div className="flex items-center gap-6 mb-10">
                  <div className="w-4 h-4 bg-[var(--neon-cyan)] shadow-[0_0_20px_var(--neon-cyan)] rounded-full animate-pulse"></div>
                  <h3 className="text-4xl font-bold text-white uppercase tracking-tight font-bungee neon-glow-cyan">UPCOMING NODES</h3>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
                  {approvedSinging.map((req) => (
                    <div key={req.id} className="relative group perspective-1000">
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-blue)] rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                      <div className="relative bg-[#101015] p-8 rounded-[2.5rem] border border-white/10 flex justify-between items-center group-hover:border-[var(--neon-cyan)] transition-all shadow-2xl h-full">
                        <div className="min-w-0 pr-6 flex-1">
                          <div className="text-white font-black uppercase truncate text-4xl font-bungee tracking-tight mb-2 group-hover:text-[var(--neon-cyan)] transition-colors">{req.songName}</div>
                          <div className="text-lg text-slate-500 uppercase flex items-center gap-3 font-righteous tracking-[0.2em] opacity-80">
                            <span className="text-[var(--neon-green)] font-black">@{req.participantName}</span>
                            <span className="opacity-20">|</span>
                            <span className="truncate">{req.artist}</span>
                          </div>
                        </div>
                        <div className="flex gap-3 shrink-0 flex-col">
                          <button onClick={() => handlePromoteToStage(req.id)} className="px-6 py-3 bg-[var(--neon-green)] text-black text-base font-black rounded-xl uppercase tracking-[0.2em] font-righteous shadow-[0_0_20px_var(--neon-green)] transition-all hover:bg-white hover:scale-105">STAGE</button>
                          <button onClick={async () => { await deleteRequest(req.id); await refresh(); }} className="px-6 py-3 border border-white/10 text-white/40 hover:text-rose-500 hover:border-rose-500/50 rounded-xl transition-all text-lg font-black uppercase tracking-[0.2em]">REMOVE</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {approvedSinging.length === 0 && (
                    <div className="col-span-full py-32 text-center border-4 border-dashed border-white/5 rounded-[4rem] opacity-30">
                      <p className="text-5xl font-black uppercase tracking-[0.5em] italic font-righteous text-slate-700">NO DATA STREAM</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )
        }

        {
          activeTab === 'PERFORMERS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-bottom-2 pb-32">
              <section className="lg:col-span-8 bg-[#0a0a0a] border-4 border-[var(--neon-cyan)]/20 rounded-[3rem] p-10 shadow-[0_0_60px_rgba(0,229,255,0.1)] relative overflow-hidden backdrop-blur-md">
                <div className="flex justify-between items-center mb-10 px-2">
                  <h2 className="text-4xl font-bold text-white uppercase tracking-tight font-bungee neon-glow-cyan">PERFORMER INDEX</h2>
                  <div className="flex items-center gap-4 px-6 py-2 bg-black/40 border border-[var(--neon-cyan)]/30 rounded-full shadow-lg">
                    <div className="w-2 h-2 rounded-full bg-[var(--neon-cyan)] animate-pulse"></div>
                    <span className="text-lg font-bold text-[var(--neon-cyan)] uppercase tracking-widest font-righteous">{liveMicCount} ACTIVE</span>
                  </div>
                </div>
                <div className="grid gap-6">
                  {session.participants.map(p => {
                    const isReady = p.status === ParticipantStatus.READY;
                    const requests = session.requests.filter(r => r.participantId === p.id);
                    const approvedCount = requests.filter(r => r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING).length;

                    return (
                      <div key={p.id} className={`flex items-center justify-between p-6 rounded-[2rem] transition-all border-2 ${isReady ? 'bg-[#002a1a]/30 border-[var(--neon-green)] shadow-[0_0_30px_rgba(0,255,157,0.15)]' : 'bg-black/40 border-white/5 hover:border-white/20'}`}>
                        <div className="min-w-0 flex items-center gap-6 text-left">
                          <button
                            onClick={async () => { await updateParticipantStatus(p.id, isReady ? ParticipantStatus.STANDBY : ParticipantStatus.READY); await refresh(); }}
                            className={`w-12 h-12 rounded-full shrink-0 border-2 transition-all flex items-center justify-center ${isReady ? 'bg-[var(--neon-green)] border-[var(--neon-green)] shadow-[0_0_20px_var(--neon-green)]' : 'bg-slate-900 border-white/10 hover:border-white/50'}`}
                          >
                            {isReady && <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>}
                          </button>
                          <div className="min-w-0">
                            <button
                              onClick={() => viewPerformerProfile(p.id)}
                              className={`font-bold text-4xl uppercase truncate font-bungee tracking-tight transition-colors ${isReady ? 'text-white' : 'text-slate-600 hover:text-[var(--neon-green)]'}`}
                            >
                              {p.name}
                            </button>
                            {approvedCount > 0 && <div className="text-base font-bold text-[var(--neon-cyan)] uppercase mt-1 tracking-widest font-righteous opacity-90">{approvedCount} TRACKS READY</div>}
                          </div>
                        </div>
                        <div className="flex gap-4 items-center">
                          <button onClick={() => setPrefilledSinger(p)} className="px-6 py-3 bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] rounded-xl border border-[var(--neon-cyan)]/50 transition-all font-righteous text-base font-black uppercase tracking-[0.2em] hover:bg-[var(--neon-cyan)] hover:text-black hover:shadow-[0_0_20px_var(--neon-cyan)]">
                            ADD TRACK
                          </button>
                          <button onClick={async () => { if (confirm(`Remove ${p.name}?`)) { await removeParticipant(p.id); await refresh(); } }} className="text-rose-500/30 hover:text-rose-500 p-3 transition-colors text-3xl font-black">✕</button>
                        </div>
                      </div>
                    );
                  })}
                  {session.participants.length === 0 && <div className="py-32 text-center border-4 border-dashed border-white/5 rounded-[3rem] opacity-30"><p className="text-5xl font-black uppercase tracking-[0.6em] italic font-righteous text-slate-800">NO SIGNALS</p></div>}
                </div>
              </section>

              <section className="lg:col-span-4 lg:sticky lg:top-36 h-fit bg-[#050510] border-4 border border-white/5 rounded-[3.5rem] p-8 shadow-[0_0_60px_rgba(157,0,255,0.15)] relative overflow-hidden">
                <div className="flex justify-between items-center mb-10 px-2">
                  <h2 className="text-4xl font-black text-white uppercase tracking-tighter font-bungee neon-glow-purple">SESSION LOG</h2>
                  {session.history.length > 0 && <button onClick={async () => { await clearHistory(); await refresh(); }} className="text-sm font-black text-rose-500/40 hover:text-rose-500 uppercase tracking-[0.3em] font-righteous transition-all">CLEAR ALL</button>}
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {session.history.map((item, i) => (
                    <div key={i} className="bg-black/40 p-5 rounded-[1.5rem] border border-white/5 group hover:border-[var(--neon-purple)] transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 pr-4">
                          <div className="text-2xl font-black text-white uppercase truncate font-bungee tracking-tight group-hover:text-[var(--neon-purple)] transition-colors">{item.songName}</div>
                          <div className="text-sm text-slate-600 font-bold uppercase truncate font-righteous tracking-widest mt-1">{item.artist}</div>
                        </div>
                        <VideoLink url={item.youtubeUrl} />
                      </div>
                      <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                        <button onClick={() => viewPerformerProfile(item.participantId)} className="text-sm font-black text-[var(--neon-pink)] uppercase truncate hover:text-white font-righteous tracking-widest transition-colors mb-0">@{item.participantName}</button>
                        <button onClick={async () => { await reAddFromHistory(item, true); await refresh(); }} className="opacity-0 group-hover:opacity-100 text-xs font-black text-[var(--neon-cyan)] hover:text-white transition-all font-righteous tracking-widest uppercase ml-auto">RELOAD</button>
                      </div>
                    </div>
                  ))}
                  {session.history.length === 0 && <div className="text-center py-20 opacity-20"><p className="text-lg italic font-righteous uppercase tracking-widest text-slate-700">EMPTY</p></div>}
                </div>
              </section>

              <section className="lg:col-span-12 bg-black/40 border-4 border-white/5 rounded-[3rem] p-10 mt-10 relative overflow-hidden">
                <div className="flex justify-between items-center mb-10 px-2">
                  <h2 className="text-4xl font-black text-white uppercase tracking-tighter font-bungee neon-glow-cyan">COMPLETED ROUNDS</h2>
                  <div className="text-[var(--neon-cyan)]/40 text-sm font-black uppercase tracking-[0.4em] font-righteous">CHRONOLOGICAL_ARCHIVE</div>
                </div>

                <div className="grid gap-12">
                  {(() => {
                    const rounds: Record<number, SongRequest[]> = {};
                    session.history.forEach(song => {
                      const time = song.playedAt || 0;
                      if (!rounds[time]) rounds[time] = [];
                      rounds[time].push(song);
                    });

                    const sortedTimestamps = Object.keys(rounds).map(Number).sort((a, b) => b - a);

                    if (sortedTimestamps.length === 0) {
                      return (
                        <div className="text-center py-24 border-4 border-dashed border-white/5 rounded-[2.5rem] opacity-20">
                          <p className="text-2xl font-black uppercase tracking-[0.4em] font-righteous text-slate-500">HISTORY_NULL</p>
                        </div>
                      );
                    }

                    return sortedTimestamps.map(timestamp => (
                      <div key={timestamp} className="bg-[#050510] border-2 border-white/5 rounded-[2.5rem] p-8 relative group hover:border-[var(--neon-cyan)]/30 transition-all">
                        <div className="absolute top-0 left-10 py-1 px-4 bg-[var(--neon-cyan)] text-black text-[10px] font-black uppercase tracking-widest rounded-b-lg font-righteous shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                          ROUND_{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                          {rounds[timestamp].map((song, i) => (
                            <div key={song.id} className="flex flex-col p-4 bg-black/40 rounded-2xl border border-white/5 group/song hover:bg-white/5 transition-all">
                              <div className="flex justify-between items-start mb-2">
                                <div className="text-lg font-black text-white uppercase truncate font-bungee tracking-tight group-hover/song:text-[var(--neon-cyan)] transition-colors">{song.songName}</div>
                                <VideoLink url={song.youtubeUrl} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-[var(--neon-pink)] uppercase tracking-widest font-righteous">@{song.participantName}</span>
                                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter">POS_{i + 1}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </section>
            </div>
          )
        }

        {
          activeTab === 'LIBRARY' && (
            <section className="animate-in fade-in slide-in-from-bottom-2 space-y-10 pb-32">
              <div className="sticky top-0 z-40 pt-4 -mt-4">
                <div className="relative group p-1 rounded-[2.5rem] bg-[#050510]/90 shadow-2xl backdrop-blur-xl border border-white/10">
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--neon-pink)]/20 via-[var(--neon-purple)]/20 to-[var(--neon-cyan)]/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
                  <input
                    type="text"
                    placeholder="SCANNING GLOBAL SONGBOOK..."
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    className="w-full bg-black/50 border-2 border-white/10 rounded-[2.3rem] py-6 pl-16 pr-32 text-2xl font-bold tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-[var(--neon-pink)] transition-all font-righteous uppercase"
                  />
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-[var(--neon-pink)] transition-colors pointer-events-none">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </span>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                    <button
                      onClick={() => setIsAddingVerifiedSong(true)}
                      className="px-6 py-3 bg-[var(--neon-cyan)] text-black rounded-[2rem] font-black text-base uppercase tracking-widest shadow-[0_0_15px_rgba(0,229,255,0.4)] active:scale-95 transition-all font-righteous hover:bg-white hover:scale-105"
                    >
                      + ADD NEW
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
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
                      <div className="col-span-full text-center py-40 opacity-30 border-4 border-dashed border-white/5 rounded-[4rem]">
                        <div className="text-8xl mb-6 opacity-50 grayscale animate-pulse">{librarySearchQuery ? '🚫' : '📡'}</div>
                        <p className="text-5xl font-black uppercase tracking-[0.5em] font-righteous text-slate-600">{librarySearchQuery ? 'NO MATCH FOUND' : 'DATABASE OFFLINE'}</p>
                      </div>
                    );
                  }

                  return combined.map((song, idx) => (
                    <div key={idx} className="bg-[#101015] border-2 border-white/5 p-4 rounded-[2rem] flex items-center justify-between group hover:border-[var(--neon-cyan)] transition-all relative overflow-hidden shadow-lg">
                      <div className="flex items-center gap-6 flex-1 min-w-0">
                        <div className="w-12 h-12 flex items-center justify-center bg-black rounded-lg border border-white/10 text-[var(--neon-cyan)] text-2xl">💿</div>
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-3">
                            {song.isVerified && (
                              <div className="px-2 py-0.5 bg-[var(--neon-pink)] text-black rounded-full text-[10px] font-black uppercase tracking-widest font-righteous shrink-0">VERIFIED</div>
                            )}
                            <h4 className="text-3xl font-black text-white uppercase truncate tracking-tighter font-bungee group-hover:text-[var(--neon-cyan)] transition-colors">{song.title}</h4>
                            <span className="text-base text-slate-600 font-bold uppercase font-righteous tracking-widest truncate">/ {song.artist}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton request={song as any} />
                          <YouTubeSearchButton request={song as any} />
                          <VideoLink url={(song as any).youtubeUrl} />
                          <button
                            onClick={async () => { await deleteVerifiedSong(song.id).then(refresh); }}
                            className="p-2 text-rose-500/20 hover:text-rose-500 transition-all text-xl"
                          >✕</button>
                        </div>
                        <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5 ml-4">
                          <div className="relative group/assign">
                            <button className="px-6 py-2.5 bg-white text-black text-sm font-black uppercase rounded-lg hover:bg-[var(--neon-cyan)] transition-all font-righteous tracking-wider">
                              ASSIGN
                            </button>
                            <div className="absolute bottom-full right-0 mb-4 bg-[#0a0a0a] border-2 border-[var(--neon-cyan)]/30 rounded-[1.5rem] shadow-2xl opacity-0 invisible group-hover/assign:opacity-100 group-hover/assign:visible transition-all p-4 z-50 backdrop-blur-xl w-[200px]">
                              <p className="text-base text-[var(--neon-cyan)] font-black uppercase mb-3 border-b border-white/10 pb-2 font-righteous tracking-widest">TRANSMIT TO:</p>
                              <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                {session.participants.map(p => (
                                  <button
                                    key={p.id}
                                    onClick={async () => { const req = await addRequest({ participantId: p.id, participantName: p.name, songName: song.title, artist: song.artist, youtubeUrl: (song as any).youtubeUrl, type: RequestType.SINGING }); if (req) await approveRequest(req.id); await refresh(); }}
                                    className="w-full text-left p-2 rounded-lg hover:bg-white/10 hover:text-[var(--neon-cyan)] text-lg font-black text-slate-400 uppercase truncate font-righteous transition-all"
                                  >
                                    {p.name}
                                  </button>
                                ))}
                                <div className="h-[1px] bg-white/10 my-2" />
                                <button
                                  onClick={async () => { const req = await addRequest({ participantId: 'DJ-MANUAL', participantName: 'GUEST', songName: song.title, artist: song.artist, youtubeUrl: (song as any).youtubeUrl, type: RequestType.SINGING }); if (req) await approveRequest(req.id); await refresh(); }}
                                  className="w-full text-left p-2 rounded-lg bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)] hover:text-black text-sm font-black uppercase font-righteous transition-all"
                                >
                                  + GUEST
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="relative group/star">
                            <button className="px-4 py-2.5 bg-black border border-white/10 text-[var(--neon-pink)] rounded-lg font-black text-sm uppercase tracking-widest hover:border-[var(--neon-pink)] transition-all font-righteous">★</button>
                            <div className="absolute bottom-full right-0 mb-4 bg-[#0a0a0a] border-2 border-[var(--neon-pink)]/30 rounded-[1.5rem] shadow-2xl opacity-0 invisible group-hover/star:opacity-100 group-hover/star:visible transition-all p-4 z-50 backdrop-blur-xl w-[180px]">
                              <p className="text-base text-[var(--neon-pink)] font-black uppercase mb-3 border-b border-white/10 pb-2 font-righteous tracking-widest">ADD FAVORITE:</p>
                              <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                {session.participants.map(p => (
                                  <button
                                    key={p.id}
                                    onClick={async () => { await addUserFavorite(p.id, { songName: song.title, artist: song.artist, youtubeUrl: (song as any).youtubeUrl, type: song.type as RequestType }); await refresh(); }}
                                    className="w-full text-left p-2 rounded-lg hover:bg-white/10 hover:text-[var(--neon-pink)] text-lg font-black text-slate-400 uppercase truncate font-righteous transition-all"
                                  >
                                    {p.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
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
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-[100] backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-[#0a0a0a] border-4 border-[var(--neon-pink)]/30 rounded-[3rem] p-10 shadow-[0_0_100px_rgba(255,42,109,0.2)] animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-5xl font-bold text-white uppercase tracking-tight leading-none font-bungee neon-glow-pink">REVIEW LINEUP</h2>
              <button onClick={() => setShowRoundConfirm(false)} className="text-slate-600 hover:text-white font-bold text-5xl px-2 transition-all transform hover:scale-110">✕</button>
            </div>
            <div className="mb-8 text-lg text-[var(--neon-cyan)] font-bold uppercase tracking-widest font-righteous opacity-80 decoration-dotted underline underline-offset-4">OPERATIONAL READY CHECK</div>

            <div className="space-y-4 mb-10 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
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
                    <div key={p.id} className={`flex items-center justify-between p-4 rounded-[1.5rem] border-2 transition-all duration-300 ${isReady ? 'bg-[#150030] border-[var(--neon-green)] shadow-[0_0_20px_rgba(57,255,20,0.15)]' : 'bg-black/40 border-white/5 opacity-50'}`}>
                      <div className="flex items-center gap-4 min-w-0">
                        <button
                          onClick={async () => { await updateParticipantStatus(p.id, isReady ? ParticipantStatus.STANDBY : ParticipantStatus.READY); await refresh(); }}
                          className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center transition-all border-2 ${isReady ? 'bg-[var(--neon-green)] border-[var(--neon-green)] shadow-[0_0_10px_var(--neon-green)]' : 'bg-slate-900 border-white/10 hover:border-slate-600'}`}
                        >
                          {isReady && <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>}
                        </button>
                        <div className="min-w-0">
                          <div className={`font-bold uppercase text-2xl truncate tracking-tight font-bungee ${isReady ? 'text-white' : 'text-slate-600'}`}>{p.name}</div>
                          {isReady ? (
                            song ? (
                              <div className="text-[var(--neon-cyan)] text-base font-black uppercase tracking-[0.2em] font-righteous mt-0.5 opacity-90">
                                {song.songName}
                              </div>
                            ) : (
                              <div className="text-rose-500 text-sm font-black uppercase tracking-[0.1em] font-righteous mt-0.5">⚠️ NO SIGNAL</div>
                            )
                          ) : (
                            <div className="text-slate-700 text-sm font-black uppercase tracking-[0.2em] font-righteous mt-0.5">STANDBY</div>
                          )}
                        </div>
                      </div>
                      {isReady && song && <div className="shrink-0 text-sm bg-[var(--neon-cyan)] text-black px-4 py-1.5 rounded-full font-black uppercase tracking-widest font-righteous shadow-[0_0_10px_var(--neon-cyan)] animate-in fade-in zoom-in">READY</div>}
                    </div>
                  );
                })}

              {session.participants.length === 0 && (
                <div className="text-center py-24 bg-black/20 rounded-[2.5rem] border-4 border-dashed border-white/5 animate-in fade-in duration-700">
                  <p className="text-slate-700 text-2xl font-black uppercase tracking-[0.4em] font-righteous">NO DATA</p>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowRoundConfirm(false)} className="flex-1 py-4 bg-black hover:bg-white hover:text-black text-white border border-white/10 rounded-xl font-black uppercase text-base tracking-widest transition-all font-righteous">CANCEL</button>
              {(() => {
                const eligibleCount = session.participants.filter(p =>
                  session.requests?.some(r => r.participantId === p.id && r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING && !r.isInRound)
                ).length;

                return (
                  <button
                    onClick={handleConfirmRound}
                    disabled={eligibleCount === 0}
                    className={`flex-[2] py-4 rounded-xl font-black uppercase text-base tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg font-righteous ${eligibleCount > 0 ? 'bg-[var(--neon-green)] hover:bg-white hover:text-black text-black hover:scale-105' : 'bg-slate-900 text-slate-800 cursor-not-allowed border border-white/5'}`}
                  >
                    {eligibleCount > 0 ? (
                      <>
                        <div className="w-1.5 h-1.5 bg-current rounded-full animate-ping"></div>
                        ACTIVATE ROUND ({eligibleCount})
                      </>
                    ) : 'IDLE'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}


      {
        showResetConfirm && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200] backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-[#050510] border-4 border-rose-500/30 rounded-[3rem] p-10 text-center shadow-[0_0_100px_rgba(244,63,94,0.3)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.8)]"></div>
              <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-[2rem] border-2 border-rose-500/20 flex items-center justify-center mx-auto mb-6 text-4xl font-black shadow-[0_0_30px_rgba(244,63,94,0.2)] animate-pulse">🧹</div>
              <h2 className="text-5xl font-black text-white uppercase mb-4 tracking-tight font-bungee neon-text-glow-rose">SYSTEM RESET</h2>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed font-black font-righteous uppercase tracking-widest">
                This will <span className="text-rose-500 underline decoration-2 underline-offset-4 decoration-rose-500">TERMINATE ALL SESSIONS</span>, clear requests, and wipe history logs.
              </p>
              <div className="flex gap-4">
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-4 bg-black border-2 border-white/10 text-white rounded-xl text-base font-black uppercase tracking-widest font-righteous transition-all hover:bg-white/5">ABORT</button>
                <button onClick={handleConfirmReset} className="flex-[2] py-4 bg-rose-500 text-white rounded-xl text-base font-black uppercase tracking-widest font-righteous shadow-[0_0_30px_rgba(244,63,94,0.4)] transition-all hover:bg-rose-400 hover:scale-105">EXECUTE WIPE</button>
              </div>
            </div>
          </div>
        )
      }

      {
        (showUserManager || managedProfile) && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[70] backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="w-full max-w-6xl bg-[#0a0a0a] border-4 border-white/10 rounded-[4rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] animate-gradient-x"></div>
              <div className="p-8 border-b-2 border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-xl">
                <div>
                  <h2 className="text-5xl font-black text-white font-bungee uppercase tracking-tight neon-glow-purple">User Directory</h2>
                  <p className="text-base text-[var(--neon-cyan)] uppercase font-black tracking-[0.3em] font-righteous opacity-80 mt-1">Authenticated Identities & Signal History</p>
                </div>
                <div className="flex gap-3">
                  {managedProfile && (
                    <button onClick={() => setManagedProfile(null)} className="px-6 py-3 bg-black border border-white/10 text-white rounded-xl text-sm font-black uppercase tracking-widest font-righteous hover:bg-white/10 transition-all">← ALL ACCOUNTS</button>
                  )}
                  <button
                    onClick={() => setIsCreatingProfile(true)}
                    className="px-6 py-3 bg-[var(--neon-cyan)] text-black rounded-xl text-sm font-black uppercase tracking-widest font-righteous shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:bg-white transition-all hover:scale-105"
                  >
                    + NEW ACCOUNT
                  </button>
                  <button onClick={closeModals} className="text-slate-600 hover:text-white p-2 ml-2 font-black text-4xl transition-colors transform hover:scale-110">✕</button>
                </div>
              </div>

              <div className="p-6 border-b-2 border-white/5 bg-black/20">
                <div className="relative group max-w-2xl mx-auto">
                  <input
                    type="text"
                    placeholder="SCANNING DIRECTORY RECORDS..."
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                    className="w-full bg-[#050510] border-2 border-white/10 rounded-2xl px-10 py-4 text-white font-black uppercase font-righteous tracking-widest outline-none focus:border-[var(--neon-pink)] transition-all shadow-inner placeholder:text-slate-700 text-xl"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-[var(--neon-pink)] transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar bg-black/20">
                {managedProfile ? (
                  <div className="animate-in slide-in-from-right-4 duration-500 grid lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-6">
                      <div className="bg-[#101015] border-2 border-white/5 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden group hover:border-[var(--neon-purple)] transition-all">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--neon-purple)]/10 blur-[60px] rounded-full -mr-24 -mt-24 group-hover:bg-[var(--neon-purple)]/20 transition-all" />
                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div className="scale-125 mb-4">
                            <UserAvatar name={managedProfile.name} isActive={session.participants.some(p => p.id === managedProfile.id)} />
                          </div>
                          <div className="mt-4">
                            <div className="text-sm font-bold text-[var(--neon-cyan)] uppercase tracking-widest mb-2 font-righteous">AUTHENTICATED IDENTITY</div>
                            <h3 className="text-5xl font-bold text-white uppercase tracking-tight leading-none font-bungee break-words">{managedProfile.name}</h3>
                          </div>

                          <div className="w-full mt-8 space-y-3 pt-6 border-t border-white/5">
                            <div className="flex justify-between items-center text-sm uppercase font-black font-righteous tracking-widest">
                              <span className="text-slate-600">ID SIGNATURE</span>
                              <span className="text-[var(--neon-pink)] font-mono opacity-80">{managedProfile.id.slice(0, 8)}...</span>
                            </div>
                            <div className="flex justify-between items-center text-sm uppercase font-black font-righteous tracking-widest">
                              <span className="text-slate-600">ENCRYPTION</span>
                              <span className={`px-2 py-0.5 rounded-full ${managedProfile.password ? 'bg-[var(--neon-pink)]/10 text-[var(--neon-pink)]' : 'bg-slate-900 text-slate-600'}`}>
                                {managedProfile.password ? 'SECURE PIN' : 'OPEN LINK'}
                              </span>
                            </div>
                          </div>

                          <div className="w-full mt-10 space-y-3">
                            <button onClick={() => startEditProfile(managedProfile)} className="w-full py-3 bg-black border border-white/10 hover:border-[var(--neon-pink)] text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all font-righteous">MODIFY SECURITY</button>
                            <button onClick={async () => { await joinSession(managedProfile.id); await refresh(); }} className="w-full py-3 bg-[var(--neon-cyan)] text-black rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(0,229,255,0.3)] font-righteous hover:bg-white">FORCE RE-JOIN</button>
                            <div className="pt-2 border-t border-white/5 mt-2 space-y-2">
                              {session.bannedUsers?.some(b => b.id === managedProfile.id) ? (
                                <button
                                  onClick={async () => { await banUser(managedProfile.id, managedProfile.name, 'unban'); await refresh(); }}
                                  className="w-full py-3 bg-[var(--neon-green)]/10 hover:bg-[var(--neon-green)] text-[var(--neon-green)] hover:text-black rounded-xl text-sm font-black uppercase tracking-widest transition-all font-righteous border border-[var(--neon-green)]/30"
                                >
                                  LIFT_BAN_IDENTITY
                                </button>
                              ) : (
                                <>
                                  <input
                                    type="text"
                                    placeholder="JUSTIFICATION REQUIRED..."
                                    value={banReason}
                                    onChange={(e) => setBanReason(e.target.value)}
                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-base text-white font-bold uppercase tracking-widest font-righteous outline-none focus:border-rose-500 transition-all mb-1"
                                  />
                                  <button
                                    onClick={async () => {
                                      if (!banReason) return alert('Provide a reason for the ban sequence.');
                                      await banUser(managedProfile.id, managedProfile.name, banReason);
                                      setBanReason('');
                                      setManagedProfile(null);
                                      await refresh();
                                    }}
                                    className="w-full py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 rounded-xl text-sm font-black uppercase tracking-widest transition-all font-righteous border border-rose-500/30"
                                  >
                                    TERMINATE_SIGNAL (BAN)
                                  </button>
                                </>
                              )}
                            </div>
                            <button onClick={async () => { if (confirm('Permanently delete this account?')) { await deleteAccount(managedProfile.id); setManagedProfile(null); await refresh(); } }} className="w-full py-3 bg-rose-500/5 hover:bg-rose-500 text-rose-500/40 hover:text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all border border-transparent hover:border-rose-500/30 font-righteous mt-2">TERMINATE ACCOUNT</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-[#101015] border-2 border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden">
                          <h4 className="text-sm font-black text-[var(--neon-pink)] uppercase tracking-[0.3em] mb-6 font-righteous">LIBRARY STARS ({managedProfile.favorites.length})</h4>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {managedProfile.favorites.map(fav => (
                              <div key={fav.id} className="bg-black/40 border border-white/5 p-4 rounded-xl flex justify-between items-center group hover:border-[var(--neon-pink)] transition-all">
                                <div className="min-w-0 pr-4">
                                  <div className="text-xl font-black text-white truncate uppercase tracking-tight font-righteous group-hover:text-[var(--neon-pink)] transition-colors">{fav.songName}</div>
                                  <div className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-0.5 font-righteous opacity-60">{fav.artist}</div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <button onClick={async () => { await addRequest({ participantId: managedProfile!.id, participantName: managedProfile!.name, songName: fav.songName, artist: fav.artist, youtubeUrl: fav.youtubeUrl, type: fav.type }); await refresh(); }} className="px-3 py-1.5 bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] rounded-lg text-xs font-black uppercase font-righteous hover:bg-[var(--neon-cyan)] hover:text-black transition-all">ADD</button>
                                  <button onClick={() => setProfileItemToEdit({ type: 'favorite', itemId: fav.id })} className="p-1.5 text-slate-700 hover:text-white transition-colors">✏️</button>
                                  <button onClick={async () => { await removeUserFavorite(managedProfile!.id, fav.id); await refresh(); }} className="p-1.5 text-rose-500/30 hover:text-rose-500 transition-colors">✕</button>
                                </div>
                              </div>
                            ))}
                            {managedProfile.favorites.length === 0 && <div className="flex flex-col items-center py-20 opacity-20"><span className="text-4xl mb-3 grayscale">⭐</span><p className="text-sm font-black uppercase tracking-[0.3em] font-righteous text-slate-600">Catalog is empty</p></div>}
                          </div>
                        </div>

                        <div className="bg-[#101015] border-2 border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden">
                          <h4 className="text-sm font-black text-[var(--neon-cyan)] uppercase tracking-[0.3em] mb-6 font-righteous">PERFORMANCE LOG ({managedProfile.personalHistory.length})</h4>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {managedProfile.personalHistory.map((h, i) => (
                              <div key={i} className="bg-black/40 border border-white/5 p-4 rounded-xl group hover:border-[var(--neon-cyan)] transition-all">
                                <div className="flex justify-between items-start">
                                  <div className="min-w-0 pr-4">
                                    <div className="text-xl font-bold text-white truncate uppercase tracking-tight font-righteous group-hover:text-[var(--neon-cyan)] transition-colors">{h.songName}</div>
                                    <div className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-0.5 font-righteous opacity-60">{h.artist}</div>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                    <button onClick={() => setProfileItemToEdit({ type: 'history', itemId: h.id })} className="p-1.5 text-slate-700 hover:text-white transition-colors">✏️</button>
                                    <button onClick={async () => { await removeUserHistoryItem(managedProfile!.id, h.id); await refresh(); }} className="p-1.5 text-rose-500/30 hover:text-rose-500 transition-colors">✕</button>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                                  <span className="text-xs text-slate-700 font-black uppercase font-righteous tracking-widest">{new Date(h.createdAt).toLocaleDateString()}</span>
                                  <button
                                    onClick={async () => { await reAddFromHistory(h, true); await refresh(); }}
                                    className="px-3 py-1.5 bg-[var(--neon-pink)]/10 border border-[var(--neon-pink)]/30 text-[var(--neon-pink)] rounded-lg text-xs font-black uppercase font-righteous hover:bg-[var(--neon-pink)] hover:text-black transition-all"
                                  >
                                    RE-QUEUE
                                  </button>
                                </div>
                              </div>
                            ))}
                            {managedProfile.personalHistory.length === 0 && <div className="flex flex-col items-center py-20 opacity-20"><span className="text-4xl mb-3 grayscale">🎤</span><p className="text-sm font-black uppercase tracking-[0.3em] font-righteous text-slate-600">No transmissions recorded</p></div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : isCreatingProfile ? (
                  <form onSubmit={handleProfileFormSubmit} className="max-w-xl mx-auto bg-[#101015] border-2 border-white/10 p-10 rounded-[3rem] space-y-6 shadow-[0_0_60px_rgba(255,0,127,0.1)] animate-in fade-in zoom-in-95 duration-500">
                    <h3 className="text-5xl font-bold text-white uppercase tracking-tight font-bungee neon-glow-pink mb-2 text-center">{editingProfile ? 'Modify Profile' : 'New User Account'}</h3>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-500 uppercase mb-2 ml-4 tracking-widest font-righteous">IDENTITY HANDLE</label>
                        <input required type="text" value={profileForm.name} onChange={e => { setProfileForm({ ...profileForm, name: e.target.value }); setProfileError(''); }} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-bold uppercase font-righteous tracking-widest outline-none focus:border-[var(--neon-pink)] transition-all" />
                      </div>

                      {profileError && (
                        <div className="mb-4 animate-pulse">
                          <p className="text-[var(--neon-pink)] font-bold uppercase text-sm tracking-widest flex items-center gap-2">
                            <span className="text-lg">⚠️</span> {profileError}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-bold text-slate-500 uppercase mb-2 ml-4 tracking-widest font-righteous">ENCRYPTION PIN (OPTIONAL)</label>
                        <input type="password" value={profileForm.password} onChange={e => setProfileForm({ ...profileForm, password: e.target.value })} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-white font-bold uppercase font-righteous tracking-widest outline-none focus:border-[var(--neon-pink)] transition-all" />
                      </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => { setIsCreatingProfile(false); setEditingProfile(null); }} className="flex-1 py-4 bg-black border border-white/10 text-white rounded-xl text-sm font-bold uppercase tracking-widest font-righteous hover:bg-white/5">ABORT</button>
                      <button type="submit" className="flex-[2] py-4 bg-[var(--neon-cyan)] text-black rounded-xl text-sm font-bold uppercase tracking-widest font-righteous shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:bg-white">AUTHORIZE ACCOUNT</button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-16">
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
                            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                              <div className="flex items-center gap-6">
                                <h3 className="text-base font-black text-[var(--neon-green)] uppercase tracking-[0.5em] font-righteous whitespace-nowrap">ACTIVE SIGNALS</h3>
                                <div className="h-[2px] w-full bg-gradient-to-r from-[var(--neon-green)]/30 to-transparent"></div>
                              </div>
                              <div className="flex flex-col gap-4">
                                {connectedGuests.map(user => (
                                  <div key={user.id} className="bg-[#151520] border-2 border-white/5 rounded-[2rem] p-4 flex items-center justify-between hover:border-[var(--neon-green)] transition-all shadow-lg group relative overflow-hidden">
                                    <div className="flex items-center gap-6 min-w-0 pr-4">
                                      <UserAvatar name={user.name} isActive={true} />
                                      <div className="min-w-0">
                                        <button
                                          onClick={() => setManagedProfile(user)}
                                          className="text-white font-bold text-3xl uppercase truncate tracking-tight text-left block hover:text-[var(--neon-green)] transition-colors font-bungee"
                                        >
                                          {user.name}
                                        </button>
                                        <div className="flex items-center gap-3 mt-1">
                                          <span className="text-[10px] bg-[var(--neon-green)] text-black px-2 py-0.5 rounded-full font-black uppercase tracking-widest font-righteous shrink-0">LIVE</span>
                                          <span className="text-sm text-slate-600 uppercase font-black font-righteous tracking-widest truncate">{user.favorites.length} ★ • {user.personalHistory.length} TX</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                      <div className="flex items-center gap-4 py-2 px-4 bg-black/40 rounded-2xl border border-white/5">
                                        <button onClick={() => setManagedProfile(user)} className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all font-righteous">LOG</button>
                                        <button onClick={() => startEditProfile(user)} className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-black uppercase transition-all font-righteous">EDIT</button>
                                        <button
                                          onClick={() => handleQuickSet(user)}
                                          className="py-2.5 px-6 bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:text-black rounded-lg text-xs font-black uppercase tracking-widest transition-all font-righteous hover:bg-[var(--neon-cyan)]"
                                        >
                                          AUTO_SET
                                        </button>
                                        <button
                                          onClick={() => setPickingSongForUser(user)}
                                          className="py-2.5 px-6 bg-[var(--neon-pink)]/20 text-[var(--neon-pink)] hover:text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all font-righteous hover:bg-[var(--neon-pink)]"
                                        >
                                          MANUAL
                                        </button>
                                      </div>
                                      <button onClick={async () => { if (confirm('Terminate temporary link?')) { await deleteAccount(user.id); await refresh(); } }} className="w-10 h-10 flex items-center justify-center text-rose-500/20 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all font-black">✕</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center gap-6">
                              <h3 className="text-base font-black text-slate-600 uppercase tracking-[0.5em] font-righteous whitespace-nowrap">ARCHIVE DIRECTORY</h3>
                              <div className="h-[1px] w-full bg-white/5"></div>
                            </div>
                            <div className="flex flex-col gap-4">
                              {others.map(user => {
                                const isActive = session.participants.some(p => p.id === user.id);
                                return (
                                  <div key={user.id} className={`bg-[#101015] border-2 ${isActive ? 'border-[var(--neon-cyan)] shadow-[0_0_20px_rgba(0,229,255,0.1)]' : 'border-white/5'} rounded-[2.5rem] p-6 flex flex-col justify-between hover:border-[var(--neon-purple)] transition-all group`}>
                                    <div className="flex items-start gap-4 mb-6">
                                      <UserAvatar name={user.name} isActive={isActive} />
                                      <div className="min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                          <button
                                            onClick={() => setManagedProfile(user)}
                                            className="text-white font-bold text-2xl uppercase truncate tracking-tight text-left block hover:text-[var(--neon-purple)] transition-colors font-bungee"
                                          >
                                            {user.name}
                                          </button>
                                        </div>
                                        <p className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] mt-1 font-righteous">
                                          {user.password ? '🔐 AUTHENTICATED' : 'GUEST ID'} • {user.favorites.length} ★
                                        </p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                      <div className="flex gap-2">
                                        <button onClick={() => setManagedProfile(user)} className="flex-1 py-2.5 bg-black border border-white/10 hover:border-[var(--neon-purple)] text-white rounded-lg text-xs font-black uppercase transition-all font-righteous">LOG</button>
                                        <button onClick={() => startEditProfile(user)} className="flex-1 py-2.5 bg-black border border-white/10 hover:border-[var(--neon-purple)] text-white rounded-lg text-xs font-black uppercase transition-all font-righteous">EDIT</button>
                                        <button
                                          onClick={() => handleQuickSet(user)}
                                          className="flex-[2] py-2.5 bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:text-black rounded-lg text-xs font-black uppercase transition-all font-righteous hover:bg-[var(--neon-cyan)]"
                                        >
                                          AUTO-SET
                                        </button>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => setPickingSongForUser(user)}
                                          className="flex-[4] py-2.5 bg-slate-900 border border-white/5 hover:border-[var(--neon-pink)] text-slate-500 hover:text-white rounded-lg flex items-center justify-center gap-2 transition-all text-xs font-black uppercase font-righteous"
                                        >
                                          MANUAL SELECT
                                        </button>
                                        <button onClick={async () => { if (confirm('Erase this record permanently?')) { await deleteAccount(user.id); await refresh(); } }} className="flex-1 py-2.5 bg-rose-500/5 text-rose-500/20 hover:text-rose-500 border border-transparent hover:border-rose-500/30 rounded-lg transition-all flex items-center justify-center">✕</button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {others.length === 0 && connectedGuests.length === 0 && (
                              <div className="text-center py-24 bg-black/20 rounded-[3rem] border-2 border-dashed border-white/5">
                                <p className="text-slate-800 text-base font-black uppercase tracking-[0.5em] font-righteous">EMPTY DIRECTORY - NO SIGNALS DETECTED</p>
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
                    participants={session.participants}
                  />
                );
              })()}
            </div>
          </div>
        )
      }

      {
        showQrModal && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[100] backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-[#050510] border-4 border-white/10 rounded-[3rem] p-10 shadow-[0_0_80px_rgba(255,0,255,0.2)] text-center relative overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] animate-gradient-x"></div>
              <h3 className="text-5xl font-black text-white uppercase mb-4 tracking-tight font-bungee neon-glow-pink">Access Entry</h3>

              {(roomJoinUrl.includes('localhost') || roomJoinUrl.includes('127.0.0.1')) && (
                <div className="mb-6 p-4 bg-amber-500/10 border-2 border-amber-500/50 rounded-2xl animate-pulse">
                  <div className="text-amber-500 font-black uppercase text-lg mb-2 flex items-center justify-center gap-2">
                    <span className="text-2xl">⚠️</span> LOCALHOST DETECTED
                  </div>
                  <p className="text-amber-200/80 text-xs font-bold uppercase tracking-wider mb-3">
                    External devices cannot connect to "localhost". Configure your computer's Wi-Fi IP.
                  </p>
                  <button
                    onClick={() => { setShowQrModal(false); setShowNetworkConfig(true); }}
                    className="px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-black uppercase tracking-widest hover:bg-white transition-all"
                  >
                    CONFIGURE NETWORK IP
                  </button>
                </div>
              )}

              <p className="text-base text-[var(--neon-cyan)] font-black uppercase tracking-[0.4em] mb-10 font-righteous opacity-80">Point Guest cameras at the code below</p>
              <div className="bg-white p-6 rounded-[2rem] inline-block shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-10 relative group">
                <div className="absolute -inset-4 bg-gradient-to-tr from-[var(--neon-pink)]/20 to-[var(--neon-cyan)]/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(roomJoinUrl)}&bgcolor=ffffff`} alt="Room QR" className="w-48 h-48 relative z-10" />
              </div>
              <div className="text-base text-white/40 font-mono break-all mb-10 font-black lowercase opacity-40 px-8 leading-relaxed select-all cursor-pointer hover:opacity-100 hover:text-[var(--neon-pink)] transition-all">{roomJoinUrl}</div>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => { setShowQrModal(false); setShowNetworkConfig(true); }}
                  className="w-full py-4 bg-black border border-white/10 hover:border-[var(--neon-pink)] text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all font-righteous"
                >
                  ⚙️ CONFIGURE SIGNAL ORIGIN
                </button>
                <button onClick={closeModals} className="w-full py-4 bg-black border border-white/10 text-slate-500 hover:text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all font-righteous">DISMISS PANEL</button>
              </div>
            </div>
          </div>
        )
      }

      {
        showNetworkConfig && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200] backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="w-full max-w-xl bg-[#050510] border-4 border-white/10 p-12 rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] animate-gradient-x"></div>
              <h3 className="text-5xl font-black text-white uppercase mb-4 tracking-tight font-bungee neon-glow-purple">Signal Origin</h3>
              <p className="text-base text-[var(--neon-cyan)] font-black uppercase tracking-[0.4em] mb-12 font-righteous opacity-80">Set the endpoint for guest terminal connections</p>

              <div className="space-y-8">
                <div className="bg-black/40 p-8 rounded-[2rem] border-2 border-white/5 border-dashed">
                  <p className="text-sm text-slate-500 uppercase font-black mb-3 tracking-[0.3em] font-righteous">LOCAL ENVIRONMENT DETECTION</p>
                  <div className="text-xl text-[var(--neon-cyan)] font-mono font-black tracking-widest">
                    {window.location.hostname} <span className="text-sm text-slate-700 opacity-60">(CURRENT HOST)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black text-slate-500 uppercase mb-4 ml-4 tracking-[0.3em] font-righteous">TERMINAL ADDRESS / PUBLIC TUNNEL URL</label>
                  <input
                    type="text"
                    value={networkIpInput}
                    onChange={(e) => setNetworkIpInput(e.target.value)}
                    placeholder="E.G. 192.168.1.15 OR HTTPS://SIGNAL.NGROK.APP"
                    className="w-full bg-black border-2 border-white/10 rounded-2xl px-8 py-5 text-white font-black uppercase font-mono tracking-widest outline-none focus:border-[var(--neon-pink)] transition-all placeholder:text-slate-800 text-lg"
                  />
                </div>

                <div className="bg-[var(--neon-pink)]/5 border border-[var(--neon-pink)]/10 p-6 rounded-2xl">
                  <p className="text-sm text-[var(--neon-pink)]/60 font-black leading-relaxed uppercase tracking-widest font-righteous italic">
                    Note: Cross-network connectivity requires tunneling (ngrok) for public-private bridge.
                  </p>
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    onClick={() => setShowNetworkConfig(false)}
                    className="flex-1 py-4 bg-black border border-white/10 text-white rounded-xl text-sm font-black uppercase tracking-widest font-righteous hover:bg-white/5"
                  >
                    ABORT
                  </button>
                  <button
                    onClick={handleSaveNetworkIp}
                    className="flex-[2] py-4 bg-[var(--neon-cyan)] text-black rounded-xl text-sm font-black uppercase tracking-widest font-righteous shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:bg-white transition-all hover:scale-105"
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
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200] backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="w-full max-w-4xl bg-[#0a0a0a] border-4 border-white/10 rounded-[4rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] relative animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--neon-pink)] via-[var(--neon-purple)] to-[var(--neon-cyan)] animate-gradient-x"></div>
              <div className="p-8 border-b-2 border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-xl">
                <div>
                  <h2 className="text-5xl font-black text-white font-bungee uppercase tracking-tight neon-glow-pink">Signal Selection</h2>
                  <p className="text-base text-[var(--neon-cyan)] font-black uppercase tracking-[0.4em] mt-1 font-righteous opacity-80">Verified Catalog • Target: <span className="text-[var(--neon-pink)]">{pickingSongForUser.name}</span></p>
                </div>
                <button onClick={() => setPickingSongForUser(null)} className="text-slate-600 hover:text-white p-3 font-black text-4xl transition-colors transform hover:scale-110">✕</button>
              </div>

              <div className="p-6 bg-black/20 border-b-2 border-white/5">
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="FILTER VERIFIED TRANSMISSIONS..."
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    className="w-full bg-[#050510] border-2 border-white/10 rounded-2xl px-12 py-4 text-white font-black uppercase tracking-widest font-righteous outline-none focus:border-[var(--neon-pink)] transition-all shadow-inner placeholder:text-slate-700 text-xl"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-[var(--neon-pink)] transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-4 bg-black/20">
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
                      className="w-full flex justify-between items-center p-6 bg-[#101015]/60 hover:bg-[#151520] border-2 border-white/5 hover:border-[var(--neon-pink)] rounded-[2rem] transition-all group text-left relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--neon-pink)]/0 to-[var(--neon-pink)]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="min-w-0 pr-6 relative z-10">
                        <div className="text-3xl font-black text-white uppercase truncate font-bungee group-hover:text-[var(--neon-pink)] transition-colors tracking-tight">{v.songName}</div>
                        <div className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1 font-righteous opacity-60">{v.artist}</div>
                      </div>
                      <div className="text-sm font-black text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 px-4 py-2 rounded-xl uppercase border border-[var(--neon-cyan)]/20 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 font-righteous relative z-10">
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