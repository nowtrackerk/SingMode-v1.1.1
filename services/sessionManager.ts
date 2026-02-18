import { KaraokeSession, Participant, SongRequest, ParticipantStatus, RequestStatus, UserProfile, FavoriteSong, RequestType, ChatMessage, TickerMessage, RemoteAction, VerifiedSong, ActiveSession } from '../types';
import { syncService } from './syncService';
import { auth, db } from './firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs } from "firebase/firestore";

const STORAGE_KEY = 'kstar_karaoke_session';
const PROFILE_KEY = 'kstar_active_user';
const ACCOUNTS_KEY = 'kstar_user_accounts';

let isRemoteClient = false;

const INITIAL_SESSION: KaraokeSession = {
  id: 'current-session',
  participants: [],
  requests: [],
  currentRound: null,
  history: [],
  messages: [],
  tickerMessages: [],
  verifiedSongbook: [],
  isPlayingVideo: false,
  nextRequestNumber: 1,
  maxRequestsPerUser: 5,
  bannedUsers: []
};

const isExtension = typeof window !== 'undefined' && (window as any).chrome && (window as any).chrome.storage;

const storage = {
  get: async (key: string): Promise<any> => {
    if (isExtension) {
      const result = await (window as any).chrome.storage.local.get([key]);
      return result[key];
    }
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },
  set: async (key: string, value: any): Promise<void> => {
    if (isExtension) {
      await (window as any).chrome.storage.local.set({ [key]: value });
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
    // Always dispatch sync event for both extension and localStorage
    // This ensures DJ console sees updates from local participants
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kstar_sync'));
      window.dispatchEvent(new Event('storage'));
    }
  }
};

syncService.onStateReceived = (state) => {
  if (isRemoteClient) {
    storage.set(STORAGE_KEY, state);
  }
};

syncService.onActionReceived = (action) => {
  handleRemoteAction(action);
};

syncService.onPeerConnected = async () => {
  if (!isRemoteClient) {
    const session = await getSession();
    syncService.broadcastState(session);
  }
};

async function handleRemoteAction(action: RemoteAction) {
  switch (action.type) {
    case 'ADD_REQUEST':
      await addRequest(action.payload);
      break;
    case 'JOIN_SESSION': {
      const { id, profile } = action.payload;
      if (profile) {
        const accounts = await getAllAccounts();
        const existingIdx = accounts.findIndex(a => a.id === id);
        if (existingIdx === -1) {
          accounts.push(profile);
          await storage.set(ACCOUNTS_KEY, accounts);
        } else {
          accounts[existingIdx] = { ...accounts[existingIdx], ...profile };
          await storage.set(ACCOUNTS_KEY, accounts);
        }
      }
      await joinSession(id);
      break;
    }
    case 'TOGGLE_STATUS':
      await updateParticipantStatus(action.payload.id, action.payload.status);
      break;
    case 'TOGGLE_MIC':
      await updateParticipantMic(action.payload.id, action.payload.enabled);
      break;
    case 'DELETE_REQUEST':
      await deleteRequest(action.payload);
      break;
    case 'UPDATE_REQUEST':
      await updateRequest(action.payload.id, action.payload.updates);
      break;
    case 'ADD_CHAT':
      await addChatMessage(action.senderId, action.payload.name, action.payload.text);
      break;
    case 'SYNC_PROFILE':
      if (isRemoteClient) {
        const profile = await getUserProfile();
        if (profile && profile.id === action.payload.id) {
          await storage.set(PROFILE_KEY, action.payload);
        }
      }
      // Both DJ and Participant should update their accounts list
      const accounts = await getAllAccounts();
      const idx = accounts.findIndex(a => a.id === action.payload.id);
      if (idx > -1) {
        accounts[idx] = action.payload;
      } else {
        accounts.push(action.payload);
      }
      await storage.set(ACCOUNTS_KEY, accounts);
      break;
    case 'TOGGLE_FAVORITE':
      // DJ handles a request from participant to toggle a favorite
      if (!isRemoteClient) {
        await toggleFavorite(action.payload, action.senderId);
      }
      break;
    case 'REORDER_ROUND':
      await reorderCurrentRound(action.payload);
      break;
    case 'REORDER_REQUESTS':
      await reorderRequests(action.payload);
      break;
    case 'REORDER_PENDING':
      await reorderPendingRequests(action.payload);
      break;
    case 'REORDER_MY_REQUESTS':
      await reorderMyRequests(action.senderId, action.payload.requestId, action.payload.direction);
      break;
  }
}

export const initializeSync = async (role: 'DJ' | 'PARTICIPANT', room?: string) => {
  isRemoteClient = role === 'PARTICIPANT' && !!room;
  const peerId = await syncService.initialize(role, room);

  // Initialize Firebase Realtime Sync for Users if we are the DJ/Host
  if (!isRemoteClient && peerId) {
    // Register Session
    const user = await getUserProfile();
    const hostName = user?.name || "SingMode DJ";
    const hostUid = user?.id;

    await registerSession({
      id: peerId,
      hostName,
      hostUid,
      isActive: true,
      startedAt: Date.now()
    });

    // Cleanup on close
    window.addEventListener('beforeunload', () => {
      unregisterSession(peerId);
    });

    const usersRef = collection(db, "users");
    onSnapshot(usersRef, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      console.log("Synced users from Firestore:", users.length);
      storage.set(ACCOUNTS_KEY, users);
    });
  }
};

export const getSession = async (): Promise<KaraokeSession> => {
  const session = await storage.get(STORAGE_KEY) || { ...INITIAL_SESSION };
  if (!session.history) session.history = [];
  if (!session.messages) session.messages = [];
  if (!session.tickerMessages) session.tickerMessages = [];
  if (!session.verifiedSongbook) session.verifiedSongbook = [];
  if (session.isPlayingVideo === undefined) session.isPlayingVideo = false;
  if (!session.nextRequestNumber) session.nextRequestNumber = 1;
  if (session.maxRequestsPerUser === undefined) session.maxRequestsPerUser = 5;
  if (!session.bannedUsers) session.bannedUsers = [];
  return session;
};

export const saveSession = async (session: KaraokeSession) => {
  await storage.set(STORAGE_KEY, session);
  syncService.broadcastState(session);
};

const updateVerifiedSongbook = (session: KaraokeSession, song: { songName: string, artist: string, youtubeUrl?: string, type: RequestType }) => {
  if (song.youtubeUrl && song.youtubeUrl.trim() !== "") {
    const existing = session.verifiedSongbook.find(s =>
      s.songName.toLowerCase() === song.songName.toLowerCase() &&
      s.artist.toLowerCase() === song.artist.toLowerCase()
    );
    if (!existing) {
      const verified: VerifiedSong = {
        id: Math.random().toString(36).substr(2, 9),
        songName: song.songName,
        artist: song.artist,
        youtubeUrl: song.youtubeUrl,
        type: song.type,
        addedAt: Date.now()
      };
      session.verifiedSongbook.push(verified);
    } else if (existing.youtubeUrl !== song.youtubeUrl) {
      existing.youtubeUrl = song.youtubeUrl;
    }
  }
};

export const addVerifiedSong = async (song: Omit<VerifiedSong, 'id' | 'addedAt'>) => {
  const session = await getSession();
  const newSong: VerifiedSong = {
    ...song,
    id: Math.random().toString(36).substr(2, 9),
    addedAt: Date.now()
  };
  session.verifiedSongbook.push(newSong);
  await saveSession(session);
};

export const updateVerifiedSong = async (songId: string, updates: Partial<VerifiedSong>) => {
  const session = await getSession();
  const index = session.verifiedSongbook.findIndex(s => s.id === songId);
  if (index !== -1) {
    session.verifiedSongbook[index] = { ...session.verifiedSongbook[index], ...updates };
    await saveSession(session);
  }
};

export const deleteVerifiedSong = async (songId: string) => {
  const session = await getSession();
  session.verifiedSongbook = session.verifiedSongbook.filter(s => s.id !== songId);
  await saveSession(session);
};

export const resetSession = async () => {
  const current = await getSession();
  const emptySession: KaraokeSession = {
    ...INITIAL_SESSION,
    id: `session-${Date.now()}`,
    verifiedSongbook: current.verifiedSongbook, // Persist the songbook
    nextRequestNumber: 1
  };
  await saveSession(emptySession);
};

export const setStageVideoPlaying = async (active: boolean) => {
  const session = await getSession();
  session.isPlayingVideo = active;
  await saveSession(session);
};

export const getAllAccounts = async (): Promise<UserProfile[]> => {
  // If we have a local cache from onSnapshot, use it.
  // Fallback to fetch from Firestore if cache is empty (e.g. first load before sync)
  let accounts = await storage.get(ACCOUNTS_KEY);
  if (!accounts || accounts.length === 0) {
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      const fetchedUsers: UserProfile[] = [];
      snapshot.forEach(doc => fetchedUsers.push(doc.data() as UserProfile));

      if (fetchedUsers.length > 0) {
        await storage.set(ACCOUNTS_KEY, fetchedUsers);
        return fetchedUsers;
      }
    } catch (e) {
      console.error("Error fetching users from Firebase:", e);
    }

    const seededAccounts: UserProfile[] = Array.from({ length: 5 }, (_, i) => ({
      id: `singer-${i + 1}`,
      name: `Singer${i + 1}`,
      favorites: [],
      personalHistory: [],
      createdAt: Date.now()
    }));
    // Don't save seeds to Firestore automatically to avoid pollution, just local fallback
    return seededAccounts;
  }
  return accounts;
};

export const updateAccount = async (profileId: string, updates: Partial<UserProfile>): Promise<{ success: boolean, error?: string }> => {
  try {
    const userRef = doc(db, "users", profileId);
    // Check if username/name is being updated and if it is unique
    if (updates.name) {
      const accounts = await getAllAccounts();
      const existing = accounts.find(a => a.id !== profileId && a.name.toLowerCase() === updates.name?.toLowerCase());
      if (existing) {
        return { success: false, error: "Username already exists." };
      }
    }

    await updateDoc(userRef, updates);

    // Update local state immediately for responsiveness (Snapshot will confirm later)
    const accounts = await getAllAccounts();
    const idx = accounts.findIndex(a => a.id === profileId);
    if (idx > -1) {
      accounts[idx] = { ...accounts[idx], ...updates };
      await storage.set(ACCOUNTS_KEY, accounts);

      const active = await getUserProfile();
      if (active && active.id === profileId) {
        await storage.set(PROFILE_KEY, accounts[idx]);
      }
      if (!isRemoteClient) {
        syncService.broadcastAction({ type: 'SYNC_PROFILE', payload: accounts[idx], senderId: 'DJ' });
      }
    }
    return { success: true };
  } catch (e: any) {
    console.error("Error updating account:", e);
    return { success: false, error: e.message };
  }
};

export const removeUserFavorite = async (profileId: string, favoriteId: string) => {
  const accounts = await getAllAccounts();
  const idx = accounts.findIndex(a => a.id === profileId);
  if (idx > -1) {
    const updatedFavorites = accounts[idx].favorites.filter(f => f.id !== favoriteId);
    await updateAccount(profileId, { favorites: updatedFavorites });
  }
};

export const updateUserFavorite = async (profileId: string, favoriteId: string, updates: Partial<FavoriteSong>) => {
  const accounts = await getAllAccounts();
  const idx = accounts.findIndex(a => a.id === profileId);
  if (idx > -1) {
    const favorites = [...accounts[idx].favorites];
    const fIdx = favorites.findIndex(f => f.id === favoriteId);
    if (fIdx > -1) {
      favorites[fIdx] = { ...favorites[fIdx], ...updates };
      await updateAccount(profileId, { favorites });
    }
  }
};

export const addUserFavorite = async (profileId: string, song: Omit<FavoriteSong, 'id'>) => {
  const accounts = await getAllAccounts();
  const idx = accounts.findIndex(a => a.id === profileId);
  if (idx > -1) {
    const newFav = { ...song, id: Math.random().toString(36).substr(2, 9) };
    const favorites = [...accounts[idx].favorites, newFav];
    await updateAccount(profileId, { favorites });
  }
};

export const removeUserHistoryItem = async (profileId: string, historyId: string) => {
  const accounts = await getAllAccounts();
  const idx = accounts.findIndex(a => a.id === profileId);
  if (idx > -1) {
    const personalHistory = accounts[idx].personalHistory.filter(h => h.id !== historyId);
    await updateAccount(profileId, { personalHistory });
  }
};

export const updateUserHistoryItem = async (profileId: string, historyId: string, updates: Partial<SongRequest>) => {
  const accounts = await getAllAccounts();
  const idx = accounts.findIndex(a => a.id === profileId);
  if (idx > -1) {
    const personalHistory = [...accounts[idx].personalHistory];
    const hIdx = personalHistory.findIndex(h => h.id === historyId);
    if (hIdx > -1) {
      personalHistory[hIdx] = { ...personalHistory[hIdx], ...updates };
      await updateAccount(profileId, { personalHistory });
    }
  }
};

export const deleteAccount = async (profileId: string) => {
  await removeParticipant(profileId);
  // Deleting user from Firestore is not typically done from client sdk directly for Auth users
  // But we can delete the document.
  // For now, let's just delete the processed document.
  try {
    // NOTE: We cannot delete the Auth user easily from here without Admin SDK or re-authentication
    // Just delete the profile doc
    // await deleteDoc(doc(db, "users", profileId)); 
    // Commented out to avoid accidental data loss during dev, maybe just flag as deleted?
    let accounts = await getAllAccounts();
    accounts = accounts.filter(a => a.id !== profileId);
    await storage.set(ACCOUNTS_KEY, accounts);
  } catch (e) {
    console.error("Error deleting account", e);
  }

  const active = await getUserProfile();
  if (active && active.id === profileId) {
    await logoutUser();
  }
};

export const getUserProfile = async (): Promise<UserProfile | null> => {
  return await storage.get(PROFILE_KEY);
};

export const saveUserProfile = async (profile: UserProfile) => {
  // Save to Firestore
  await updateAccount(profile.id, profile);
  // Update local
  await storage.set(PROFILE_KEY, profile);
};

export const registerUser = async (data: Partial<UserProfile>, autoLogin = false): Promise<{ success: boolean, error?: string, profile?: UserProfile }> => {
  try {
    let uid = data.id;
    const isFirebaseUser = !!(data.password && data.email);
    const isLocalUser = !!(data.password && !data.email);

    if (isFirebaseUser) {
      try {
        const credential = await createUserWithEmailAndPassword(auth, data.email!, data.password!);
        uid = credential.user.uid;
      } catch (e: any) {
        if (e.code === 'auth/email-already-in-use') {
          return { success: false, error: "Email already in use." };
        }
        throw e;
      }
    } else if (isLocalUser) {
      // Local/Firestore-only user (no email)
      // Check for username uniqueness in our 'users' collection
      const accounts = await getAllAccounts();
      const existing = accounts.find(a => a.name.toLowerCase() === data.name?.trim().toLowerCase());
      if (existing) {
        return { success: false, error: "Username already taken." };
      }
      // Generate ID
      uid = activeId() || `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    } else {
      // Guest user (no password)
      uid = data.id || activeId() || `guest-${Math.random().toString(36).substr(2, 9)}`;
    }

    const profile: UserProfile = {
      id: uid!,
      name: data.name?.trim() || 'Guest',
      email: data.email || undefined,
      // Store password for local users only
      password: isLocalUser ? data.password : undefined,
      isGuest: !isFirebaseUser && !isLocalUser,
      favorites: data.favorites || [],
      personalHistory: data.personalHistory || [],
      createdAt: Date.now()
    };

    // Remove undefined fields
    const profileData = JSON.parse(JSON.stringify(profile));

    // Save profile to Firestore (both Auth users and Local users lives here)
    await setDoc(doc(db, "users", uid!), profileData);

    const accounts = await getAllAccounts();
    // Update local cache if not present
    if (!accounts.some(a => a.id === uid)) {
      accounts.push(profile);
      await storage.set(ACCOUNTS_KEY, accounts);
    }

    if (autoLogin) {
      await storage.set(PROFILE_KEY, profile);
    } else if (!isRemoteClient) {
      syncService.broadcastAction({ type: 'SYNC_PROFILE', payload: profile, senderId: 'DJ' });
    }
    return { success: true, profile };

  } catch (e: any) {
    console.error("Registration error:", e);
    return { success: false, error: e.message };
  }
};

// Helper for generating IDs
const activeId = () => { return undefined; } // Placeholder helper


export const loginUser = async (name: string, password?: string): Promise<{ success: boolean, error?: string, profile?: UserProfile }> => {
  // D.14: Super User Authentication
  if (name.toLowerCase() === 'singmaster' && password === 'Organized') {
    const adminProfile: UserProfile = {
      id: 'admin-singmaster',
      name: 'SingMaster',
      password: 'Organized',
      favorites: [],
      personalHistory: [],
      createdAt: Date.now()
    };
    await storage.set(PROFILE_KEY, adminProfile);
    return { success: true, profile: adminProfile };
  }

  // Try to find user in local list first to see if they exist
  const accounts = await getAllAccounts();
  let found = accounts.find(a => a.name.toLowerCase() === name.toLowerCase());

  // If not found locally, check Firestore (Crucial for Local Users on new devices)
  if (!found) {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("name", "==", name));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        found = querySnapshot.docs[0].data() as UserProfile;
        // Cache for future use
        accounts.push(found);
        await storage.set(ACCOUNTS_KEY, accounts);
      }
    } catch (e) {
      console.warn("Error checking remote user:", e);
    }
  }

  if (!found && !password) {
    // Guest login attempt
    return await registerUser({ name }, true);
  }

  if (password) {
    try {
      // Attempt Firebase Auth Login
      // Construct email from name
      const email = `${name.replace(/\s+/g, '').toLowerCase()}@singmode.app`;
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;

      // Fetch profile
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const profile = userDoc.data() as UserProfile;
        await storage.set(PROFILE_KEY, profile);
        return { success: true, profile };
      } else {
        // Auth success but no profile? Create one?
        if (found) {
          // We have a local profile but no remote one? Migration case maybe?
          // For now, just return found
          return { success: true, profile: found };
        }
        return { success: false, error: "Profile data missing." };
      }

    } catch (e: any) {
      // Fallback to local check if firebase fails (e.g. migration transition or legacy users)
      console.warn("Firebase login failed, checking legacy local storage:", e);
      if (found) {
        if (found.password && found.password === password) {
          // It's a legacy user
          await storage.set(PROFILE_KEY, found);
          return { success: true, profile: found };
        }
        return { success: false, error: "Incorrect passkey." };
      }
      return { success: false, error: e.message || "Login failed." };
    }
  }

  // Guest login with existing handle?
  if (found && !found.password) {
    return { success: true, profile: found };
  }

  return { success: false, error: "User handle not found." };
};

export const logoutUser = async () => {
  await signOut(auth);
  if (isExtension) await (window as any).chrome.storage.local.remove([PROFILE_KEY]);
  else localStorage.removeItem(PROFILE_KEY);
  window.dispatchEvent(new Event('kstar_sync'));
};

export const joinSession = async (profileId: string): Promise<Participant> => {
  const session = await getSession(); // Check ban status on join
  const banRecord = session.bannedUsers?.find((b: any) => b.id === profileId);
  if (banRecord) {
    throw new Error(`ACCESS DENIED: ${banRecord.reason}`);
  }

  if (isRemoteClient) {
    const existingProfile = await getUserProfile();
    syncService.sendAction({
      type: 'JOIN_SESSION',
      payload: {
        id: profileId,
        profile: existingProfile
      },
      senderId: profileId
    });
    return {
      id: profileId,
      name: existingProfile?.name || 'Joining...',
      status: ParticipantStatus.STANDBY,
      joinedAt: Date.now()
    };
  }
  // use existing session variable from line 460

  const accounts = await getAllAccounts();
  const profile = accounts.find(a => a.id === profileId);
  if (!profile) {
    const active = await getUserProfile();
    if (active && active.id === profileId) {
      return await addParticipantToSession(session, active);
    }
    throw new Error("Profile not found");
  }
  return await addParticipantToSession(session, profile);
};

const addParticipantToSession = async (session: KaraokeSession, profile: UserProfile): Promise<Participant> => {
  const newParticipant: Participant = {
    id: profile.id,
    name: profile.name,
    status: ParticipantStatus.STANDBY,
    micEnabled: false,
    joinedAt: Date.now()
  };
  const existingIdx = session.participants.findIndex(p => p.id === profile.id);
  if (existingIdx > -1) {
    session.participants[existingIdx] = {
      ...session.participants[existingIdx],
      ...newParticipant,
      status: session.participants[existingIdx].status
    };
  } else {
    session.participants.push(newParticipant);
  }
  await saveSession(session);
  return newParticipant;
};

export const updateVocalRange = async (profileId: string, range: 'Soprano' | 'Alto' | 'Tenor' | 'Baritone' | 'Bass' | 'Unknown') => {
  const accounts = await getAllAccounts();
  const accIdx = accounts.findIndex(a => a.id === profileId);
  if (accIdx > -1) {
    accounts[accIdx].vocalRange = range;
    await storage.set(ACCOUNTS_KEY, accounts);

    if (!isRemoteClient) {
      syncService.broadcastAction({ type: 'SYNC_PROFILE', payload: accounts[accIdx], senderId: 'DJ' });
    }

    const active = await getUserProfile();
    if (active && active.id === profileId) {
      await storage.set(PROFILE_KEY, accounts[accIdx]);
    }
  }
};

export const toggleFavorite = async (song: Omit<FavoriteSong, 'id'>, specificProfileId?: string) => {
  const profileId = specificProfileId || (await getUserProfile())?.id;
  if (!profileId) return;

  if (isRemoteClient && !specificProfileId) {
    syncService.sendAction({ type: 'TOGGLE_FAVORITE', payload: song, senderId: profileId });
    // Optimistic update locally
    const profile = await getUserProfile();
    if (profile) {
      const existingIndex = profile.favorites.findIndex(f => f.songName === song.songName && f.artist === song.artist);
      if (existingIndex > -1) profile.favorites.splice(existingIndex, 1);
      else profile.favorites.push({ ...song, id: Math.random().toString(36).substr(2, 9) });
      await storage.set(PROFILE_KEY, profile);
    }
    return;
  }

  const accounts = await getAllAccounts();
  const accIdx = accounts.findIndex(a => a.id === profileId);
  if (accIdx > -1) {
    const existingIndex = accounts[accIdx].favorites.findIndex(f =>
      f.songName === song.songName && f.artist === song.artist
    );
    if (existingIndex > -1) {
      accounts[accIdx].favorites.splice(existingIndex, 1);
    } else {
      accounts[accIdx].favorites.push({ ...song, id: Math.random().toString(36).substr(2, 9) });
    }
    await storage.set(ACCOUNTS_KEY, accounts);

    if (!isRemoteClient) {
      syncService.broadcastAction({ type: 'SYNC_PROFILE', payload: accounts[accIdx], senderId: 'DJ' });
    }

    const active = await getUserProfile();
    if (active && active.id === profileId) {
      await storage.set(PROFILE_KEY, accounts[accIdx]);
    }
  }
};

export const addParticipantByDJ = async (name: string, status: ParticipantStatus = ParticipantStatus.STANDBY): Promise<Participant> => {
  const session = await getSession();
  const newParticipant: Participant = {
    id: 'dj-added-' + Math.random().toString(36).substr(2, 5),
    name,
    status,
    micEnabled: false,
    joinedAt: Date.now()
  };
  session.participants.push(newParticipant);
  await saveSession(session);
  return newParticipant;
};

export const removeParticipant = async (participantId: string) => {
  const session = await getSession();

  // Concept: move information not existing into session to History if participant is no longer connected
  const retiringRequests = session.requests.filter(r => r.participantId === participantId);
  const historyCopies = retiringRequests.map(r => ({
    ...r,
    playedAt: Date.now(),
    status: RequestStatus.DONE, // Marking as done for history record
    isInRound: false
  }));

  if (historyCopies.length > 0) {
    session.history = [...historyCopies, ...session.history].slice(0, 100);
  }

  session.participants = session.participants.filter(p => p.id !== participantId);
  session.requests = session.requests.filter(r => r.participantId !== participantId);
  if (session.currentRound) {
    session.currentRound = session.currentRound.filter(r => r.participantId !== participantId);
    if (session.currentRound.length === 0) session.currentRound = null;
  }
  await saveSession(session);
};

export const updateParticipantStatus = async (participantId: string, status: ParticipantStatus) => {
  if (isRemoteClient) {
    syncService.sendAction({ type: 'TOGGLE_STATUS', payload: { id: participantId, status }, senderId: participantId });
    return;
  }
  const session = await getSession();
  const p = session.participants.find(p => p.id === participantId);
  if (p) {
    p.status = status;
    await saveSession(session);
  }
};

export const banUser = async (userId: string, name: string, reason: string) => {
  const session = await getSession();

  if (!session.bannedUsers) session.bannedUsers = [];

  // Add to banned list
  session.bannedUsers.push({
    id: userId,
    name: name,
    reason: reason,
    bannedAt: Date.now()
  });

  await saveSession(session);

  // Remove from current session using existing logic
  await removeParticipant(userId);
};

export const unbanUser = async (userId: string) => {
  const session = await getSession();
  if (session.bannedUsers) {
    session.bannedUsers = session.bannedUsers.filter(b => b.id !== userId);
    await saveSession(session);
  }
};

export const setMaxRequestsPerUser = async (max: number) => {
  const session = await getSession();
  session.maxRequestsPerUser = max;
  await saveSession(session);
};

export const reorderMyRequests = async (profileId: string, requestId: string, direction: 'up' | 'down') => {
  if (isRemoteClient) {
    syncService.sendAction({ type: 'REORDER_MY_REQUESTS', payload: { requestId, direction }, senderId: profileId });
    return;
  }
  const session = await getSession();
  // Filter active requests (pending/approved) for this participant
  const myRequests = session.requests.filter(r => r.participantId === profileId && r.status !== RequestStatus.DONE);
  const index = myRequests.findIndex(r => r.id === requestId);
  if (index === -1) return;

  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= myRequests.length) return;

  // Reorder within the filtered list
  const [moved] = myRequests.splice(index, 1);
  myRequests.splice(newIndex, 0, moved);

  // Reconstruct the global session.requests
  const updatedRequests = [...session.requests];

  // Find all global indices of this participant's active requests
  const globalIndices = updatedRequests
    .map((r, i) => (r.participantId === profileId && r.status !== RequestStatus.DONE) ? i : -1)
    .filter(i => i !== -1);

  globalIndices.forEach((globalIdx, i) => {
    updatedRequests[globalIdx] = myRequests[i];
  });

  session.requests = updatedRequests;
  await saveSession(session);
};

export const updateParticipantMic = async (participantId: string, enabled: boolean) => {
  if (isRemoteClient) {
    syncService.sendAction({ type: 'TOGGLE_MIC', payload: { id: participantId, enabled }, senderId: participantId });
    return;
  }
  const session = await getSession();
  const p = session.participants.find(p => p.id === participantId);
  if (p) {
    p.micEnabled = enabled;
    await saveSession(session);
  }
};

export const addRequest = async (request: Omit<SongRequest, 'id' | 'createdAt' | 'status' | 'isInRound'>): Promise<SongRequest | null> => {
  if (isRemoteClient) {
    syncService.sendAction({ type: 'ADD_REQUEST', payload: request, senderId: request.participantId });
    return null;
  }
  const session = await getSession();
  const requestNumber = session.nextRequestNumber++;
  const newRequest: SongRequest = {
    ...request,
    id: Math.random().toString(36).substr(2, 9),
    requestNumber,
    createdAt: Date.now(),
    status: RequestStatus.PENDING,
    isInRound: false
  };
  // A.7.1 Enforce Max Requests Per User
  const totalUserRequests = session.requests.filter(r => r.participantId === request.participantId && r.status === RequestStatus.PENDING).length;
  if (session.maxRequestsPerUser && totalUserRequests >= session.maxRequestsPerUser) {
    throw new Error(`Request limit reached. Max ${session.maxRequestsPerUser} requests allowed per performer.`);
  }

  // D.12: New Performer requests are added on the first position in the Queue (LIFO? The description says 'first position in the Queue', traditionally this means highest priority)
  // Let's implement unshift as requested.
  session.requests.unshift(newRequest);
  updateVerifiedSongbook(session, newRequest);

  // Update the account's personal history on the DJ/Host side
  const accounts = await getAllAccounts();
  const accIdx = accounts.findIndex(a => a.id === request.participantId);
  if (accIdx > -1) {
    accounts[accIdx].personalHistory = [newRequest, ...accounts[accIdx].personalHistory].slice(0, 50);
    await storage.set(ACCOUNTS_KEY, accounts);
    if (!isRemoteClient) {
      syncService.broadcastAction({ type: 'SYNC_PROFILE', payload: accounts[accIdx], senderId: 'DJ' });
    }
  }

  // Also update local active profile if it's us
  const activeStub = await getUserProfile();
  if (activeStub && activeStub.id === request.participantId) {
    const updated = accounts.find(a => a.id === request.participantId);
    if (updated) await storage.set(PROFILE_KEY, updated);
  }

  await saveSession(session);
  return newRequest;
};

export const updateRequest = async (requestId: string, updates: Partial<SongRequest>) => {
  if (isRemoteClient) {
    syncService.sendAction({ type: 'UPDATE_REQUEST', payload: { id: requestId, updates }, senderId: 'client' });
    return;
  }
  const session = await getSession();
  const index = session.requests.findIndex(r => r.id === requestId);
  let participantId = '';
  if (index !== -1) {
    session.requests[index] = { ...session.requests[index], ...updates };
    participantId = session.requests[index].participantId;
    updateVerifiedSongbook(session, session.requests[index]);
  }
  if (session.currentRound) {
    const roundIndex = session.currentRound.findIndex(r => r.id === requestId);
    if (roundIndex !== -1) {
      session.currentRound[roundIndex] = { ...session.currentRound[roundIndex], ...updates };
      participantId = session.currentRound[roundIndex].participantId;
    }
  }

  if (participantId) {
    const accounts = await getAllAccounts();
    const accIdx = accounts.findIndex(a => a.id === participantId);
    if (accIdx > -1) {
      const hIdx = accounts[accIdx].personalHistory.findIndex(h => h.id === requestId);
      if (hIdx !== -1) {
        accounts[accIdx].personalHistory[hIdx] = { ...accounts[accIdx].personalHistory[hIdx], ...updates };
        await storage.set(ACCOUNTS_KEY, accounts);
        if (!isRemoteClient) {
          syncService.broadcastAction({ type: 'SYNC_PROFILE', payload: accounts[accIdx], senderId: 'DJ' });
        }
      }
    }
    const activeStub = await getUserProfile();
    if (activeStub && activeStub.id === participantId) {
      const updated = accounts.find(a => a.id === participantId);
      if (updated) await storage.set(PROFILE_KEY, updated);
    }
  }
  await saveSession(session);
};

export const approveRequest = async (requestId: string) => {
  const session = await getSession();
  const req = session.requests.find(r => r.id === requestId);
  if (req) {
    req.status = RequestStatus.APPROVED;
    await saveSession(session);
  }
};

export const promoteToStage = async (requestId: string) => {
  const session = await getSession();
  const index = session.requests.findIndex(r => r.id === requestId);
  if (index === -1) return;
  const req = session.requests[index];
  req.status = RequestStatus.APPROVED;
  req.isInRound = true;
  if (!session.currentRound) {
    session.currentRound = [{ ...req }];
  } else {
    session.currentRound.push({ ...req });
  }
  await saveSession(session);
};

export const markRequestAsDone = async (requestId: string) => {
  if (isRemoteClient) {
    // If we need remote support later, add action here
    return;
  }
  const session = await getSession();
  const req = session.requests.find(r => r.id === requestId);
  if (req) {
    req.status = RequestStatus.DONE;
    req.completedAt = Date.now();
    // Also update in currentRound if present
    if (session.currentRound) {
      const roundReq = session.currentRound.find(r => r.id === requestId);
      if (roundReq) {
        roundReq.status = RequestStatus.DONE;
        roundReq.completedAt = Date.now();
      }
    }
    await saveSession(session);
  }
};

export const deleteRequest = async (requestId: string) => {
  if (isRemoteClient) {
    syncService.sendAction({ type: 'DELETE_REQUEST', payload: requestId, senderId: 'client' });
    return;
  }
  const session = await getSession();
  session.requests = session.requests.filter(r => r.id !== requestId);
  if (session.currentRound) {
    session.currentRound = session.currentRound.filter(r => r.id !== requestId);
    if (session.currentRound.length === 0) session.currentRound = null;
  }
  await saveSession(session);
};

export const reorderRequest = async (requestId: string, direction: 'up' | 'down') => {
  const session = await getSession();
  const index = session.requests.findIndex(r => r.id === requestId);
  if (index === -1) return;
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex >= 0 && newIndex < session.requests.length) {
    const temp = session.requests[index];
    session.requests[index] = session.requests[newIndex];
    session.requests[newIndex] = temp;
    await saveSession(session);
  }
};

export const generateRound = async () => {
  const session = await getSession();

  // Find all participants who have at least one approved singing request that isn't already in a round
  const eligibleParticipants = session.participants.filter(p =>
    session.requests.some(r =>
      r.participantId === p.id &&
      r.status === RequestStatus.APPROVED &&
      r.type === RequestType.SINGING &&
      !r.isInRound
    )
  ).sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));

  const roundSongs: SongRequest[] = [];

  eligibleParticipants.forEach(p => {
    const songRef = session.requests.find(r =>
      r.participantId === p.id &&
      r.status === RequestStatus.APPROVED &&
      r.type === RequestType.SINGING &&
      !r.isInRound
    );
    if (songRef) {
      songRef.isInRound = true;
      roundSongs.push({ ...songRef });
      // Automatically set participant to READY if they are in the round
      p.status = ParticipantStatus.READY;
    }
  });

  if (roundSongs.length > 0) {
    session.currentRound = roundSongs;
    await saveSession(session);
  }
};

export const reorderCurrentRound = async (newRound: SongRequest[]) => {
  const session = await getSession();
  session.currentRound = newRound;
  await saveSession(session);
};

export const reorderRequests = async (newRequests: SongRequest[]) => {
  const session = await getSession();
  // We need to preserve non-singing/listening requests if they aren't in the newRequests list,
  // or just replace the approved singing ones in their specific order while keeping others?
  // Usually, newRequests will be the full list of filtered 'approvedSinging' from the UI.

  // Strategy: Map the new order back to the session.requests
  const otherRequests = session.requests.filter(r =>
    !(r.status === RequestStatus.APPROVED && r.type === RequestType.SINGING && !r.isInRound)
  );

  session.requests = [...newRequests, ...otherRequests];
  await saveSession(session);
};

export const reorderPendingRequests = async (newRequests: SongRequest[]) => {
  const session = await getSession();
  // Strategy: Map the new order back to the session.requests
  const otherRequests = session.requests.filter(r =>
    !(r.status === RequestStatus.PENDING && !r.isInRound)
  );

  session.requests = [...newRequests, ...otherRequests];
  await saveSession(session);
};

export const rotateStageSong = async (requestId: string) => {
  const session = await getSession();
  if (!session.currentRound) return;
  const index = session.currentRound.findIndex(r => r.id === requestId);
  if (index !== -1) {
    const [song] = session.currentRound.splice(index, 1);
    const historicalCopy = { ...song, playedAt: Date.now(), isInRound: false };
    session.history = [historicalCopy, ...session.history].slice(0, 100);
    session.currentRound.push(song);
    await saveSession(session);
  }
};

export const completeStageSong = async (requestId: string) => {
  const session = await getSession();
  if (!session.currentRound) return;
  const index = session.currentRound.findIndex(r => r.id === requestId);
  if (index !== -1) {
    const [song] = session.currentRound.splice(index, 1);
    const finishedSong = { ...song, playedAt: Date.now(), isInRound: false, status: RequestStatus.DONE };
    session.history = [finishedSong, ...session.history].slice(0, 100);
    session.requests = session.requests.filter(r => r.id !== requestId);

    // Update performer's personal history
    const accounts = await getAllAccounts();
    const accountIdx = accounts.findIndex(a => a.id === song.participantId);
    if (accountIdx !== -1) {
      accounts[accountIdx].personalHistory = [finishedSong, ...accounts[accountIdx].personalHistory].slice(0, 50);
      await storage.set(ACCOUNTS_KEY, accounts);
      const active = await getUserProfile();
      if (active && active.id === song.participantId) {
        await storage.set(PROFILE_KEY, accounts[accountIdx]);
      }
    }
    if (session.currentRound.length === 0) {
      session.currentRound = null;
      session.isPlayingVideo = false;
    }
    await saveSession(session);
  }
};

export const finishRound = async () => {
  const session = await getSession();
  if (!session.currentRound) return;

  // Sort by completedAt to preserve order of completion
  const sortedRound = [...session.currentRound].sort((a, b) => {
    if (a.completedAt && b.completedAt) return a.completedAt - b.completedAt;
    if (a.completedAt) return -1; // Completed items come first? Or last? User said "order they were set to done". So likely completed ones first, sorted by time.
    if (b.completedAt) return 1;
    return 0;
  });

  const now = Date.now();
  const finishedSongs = sortedRound.map(r => ({
    ...r,
    playedAt: now,
    isInRound: false,
    status: RequestStatus.DONE,
    completedAt: r.completedAt || now
  }));

  const roundIds = session.currentRound.map(r => r.id);
  session.history = [...finishedSongs, ...session.history].slice(0, 100);
  session.requests = session.requests.filter(r => !roundIds.includes(r.id));

  // Update personal histories for all performers in the round
  const accounts = await getAllAccounts();
  for (const song of finishedSongs) {
    const accountIdx = accounts.findIndex(a => a.id === song.participantId);
    if (accountIdx !== -1) {
      accounts[accountIdx].personalHistory = [song, ...accounts[accountIdx].personalHistory].slice(0, 50);
    }
  }
  await storage.set(ACCOUNTS_KEY, accounts);
  const active = await getUserProfile();
  if (active) {
    const updatedActive = accounts.find(a => a.id === active.id);
    if (updatedActive) await storage.set(PROFILE_KEY, updatedActive);
  }

  session.currentRound = null;
  session.isPlayingVideo = false;
  await saveSession(session);
};

export const reAddFromHistory = async (historyItem: SongRequest, asApproved: boolean) => {
  const session = await getSession();
  const requestNumber = session.nextRequestNumber++;
  const newRequest: SongRequest = {
    ...historyItem,
    id: Math.random().toString(36).substr(2, 9),
    requestNumber,
    createdAt: Date.now(),
    status: asApproved ? RequestStatus.APPROVED : RequestStatus.PENDING,
    isInRound: false,
    playedAt: undefined,
    aiIntro: undefined
  };
  session.requests.push(newRequest);
  await saveSession(session);
};

export const clearHistory = async () => {
  const session = await getSession();
  session.history = [];
  await saveSession(session);
};

export const addChatMessage = async (senderId: string, senderName: string, text: string) => {
  if (isRemoteClient) {
    syncService.sendAction({ type: 'ADD_CHAT', payload: { name: senderName, text }, senderId });
    return;
  }
  const session = await getSession();
  const newMessage: ChatMessage = {
    id: Math.random().toString(36).substr(2, 9),
    senderId,
    senderName,
    text,
    timestamp: Date.now()
  };
  if (!session.messages) session.messages = [];
  session.messages.push(newMessage);
  await saveSession(session);
};

export const addTickerMessage = async (msg: Omit<TickerMessage, 'id' | 'createdAt'>) => {
  const session = await getSession();
  const newMsg: TickerMessage = {
    ...msg,
    id: Math.random().toString(36).substr(2, 9),
    createdAt: Date.now()
  };
  session.tickerMessages.push(newMsg);
  await saveSession(session);
};

export const updateTickerMessage = async (id: string, updates: Partial<TickerMessage>) => {
  const session = await getSession();
  const idx = session.tickerMessages.findIndex(m => m.id === id);
  if (idx > -1) {
    session.tickerMessages[idx] = { ...session.tickerMessages[idx], ...updates };
    await saveSession(session);
  }
};

export const deleteTickerMessage = async (id: string) => {
  const session = await getSession();
  session.tickerMessages = session.tickerMessages.filter(m => m.id !== id);
  await saveSession(session);
};

export const cleanupExpiredGuestAccounts = async () => {
  const accounts = await getAllAccounts();
  const now = Date.now();
  const cutoff = 24 * 60 * 60 * 1000; // 24 hours

  const toDelete = accounts.filter(a => !a.password && a.createdAt && (now - a.createdAt > cutoff));

  if (toDelete.length > 0) {
    for (const user of toDelete) {
      await deleteAccount(user.id);
    }
    console.log(`Cleaned up ${toDelete.length} expired guest accounts.`);
  }
};

export const registerSession = async (metadata: Omit<ActiveSession, 'participantsCount'>) => {
  try {
    const sessionData: ActiveSession = {
      ...metadata,
      participantsCount: 0
    };
    await setDoc(doc(db, "sessions", metadata.id), sessionData);
  } catch (e) {
    console.error("Error registering session:", e);
  }
};

export const unregisterSession = async (sessionId: string) => {
  try {
    const sessionDoc = doc(db, "sessions", sessionId);
    // Determine if we should delete or just mark inactive
    // For now delete to keep clean
    await deleteDoc(sessionDoc);
  } catch (e) {
    console.error("Error unregistering session:", e);
  }
};

export const getActiveSessions = async (): Promise<ActiveSession[]> => {
  try {
    const sessionsRef = collection(db, "sessions");
    const q = query(sessionsRef, where("isActive", "==", true));
    const snapshot = await getDocs(q);
    const sessions: ActiveSession[] = [];
    snapshot.forEach(doc => {
      sessions.push(doc.data() as ActiveSession);
    });
    return sessions;
  } catch (e) {
    console.error("Error fetching sessions:", e);
    return [];
  }
};

export const subscribeToSessions = (callback: (sessions: ActiveSession[]) => void) => {
  const sessionsRef = collection(db, "sessions");
  const q = query(sessionsRef, where("isActive", "==", true));
  return onSnapshot(q, (snapshot) => {
    const sessions: ActiveSession[] = [];
    snapshot.forEach(doc => {
      sessions.push(doc.data() as ActiveSession);
    });
    callback(sessions);
  });
};
