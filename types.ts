export enum ParticipantStatus {
  READY = 'ready to sing',
  STANDBY = 'standby'
}

export enum RequestType {
  SINGING = 'Singing',
  LISTENING = 'Listening'
}

export enum RequestStatus {
  PENDING = 'Pending Approval',
  APPROVED = 'Approved',
  DONE = 'Done'
}

export interface VerifiedSong {
  id: string;
  songName: string;
  artist: string;
  youtubeUrl: string;
  type: RequestType;
  addedAt: number;
}

export interface FavoriteSong {
  id: string;
  songName: string;
  artist: string;
  youtubeUrl?: string;
  type: RequestType;
}

export interface UserProfile {
  id: string;
  name: string;
  password?: string;
  email?: string;
  picture?: string;
  googleId?: string;
  favorites: FavoriteSong[];
  personalHistory: SongRequest[];
  createdAt: number;
  isGuest?: boolean; // Metadata for guest users
  isAdmin?: boolean; // Metadata for Admin users
  vocalRange?: 'Soprano' | 'Alto' | 'Tenor' | 'Baritone' | 'Bass' | 'Unknown'; // Metadata for A.5
}

export interface Participant {
  id: string;
  name: string;
  status: ParticipantStatus;
  joinedAt: number;
  micEnabled?: boolean;
  micRequested?: boolean;
}

export interface SongRequest {
  id: string;
  requestNumber?: number; // Unique numeric ID for display
  participantId: string;
  participantName: string;
  songName: string;
  artist: string;
  youtubeUrl?: string;
  type: RequestType;
  status: RequestStatus;
  createdAt: number;
  isInRound?: boolean;
  playedAt?: number;
  completedAt?: number;
  aiIntro?: string;
  message?: string; // Metadata for A.16: User message to DJ
  duetPartnerId?: string; // Metadata for A.12: Duet Partner ID
  duetPartnerName?: string; // Metadata for A.12: Duet Partner Name
}

export interface BannedUser {
  id: string;
  name: string;
  reason: string;
  bannedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface TickerMessage {
  id: string;
  text: string;
  color: string;
  fontSize: 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  repeatDays: string[];
  expiresAt: number | null;
  createdAt: number;
  isActive: boolean;
}

export interface DeviceConnection {
  id: string; // Readable Device ID (e.g. "D-8291")
  peerId: string; // Internal Network ID
  connectedAt: number;
  lastSeen: number;
  status: 'connected' | 'disconnected';
  userId?: string; // Link to enrolled user/guest
  isGuest?: boolean; // Derived from linked user or explicitly set
  userAgent?: string;
}

export enum QueueStrategy {
  FRESH_MEAT = 'FRESH_MEAT',
  FAIR_ROTATION = 'FAIR_ROTATION',
  FIFO = 'FIFO',
  OLDEST_MEMBER = 'OLDEST_MEMBER',
  RANDOM = 'RANDOM'
}

export interface KaraokeSession {
  id: string;
  participants: Participant[];
  requests: SongRequest[];
  currentRound: SongRequest[] | null;
  history: SongRequest[];
  messages: ChatMessage[];
  tickerMessages: TickerMessage[];
  verifiedSongbook: VerifiedSong[];
  deviceConnections: DeviceConnection[]; // Added for Device Tracking
  queueStrategy?: QueueStrategy; // Queue Management
  startedAt?: number; // Session Start Timestamp
  isPlayingVideo?: boolean;
  nextRequestNumber: number;
  maxRequestsPerUser?: number; // Metadata for A.7.1 / C.11
  bannedUsers?: BannedUser[]; // Metadata for D.6.1
  brandIdentity?: {
    venueName: string;
    logoUrl?: string;
    isBusinessAccount: boolean;
  }; // Metadata for B.1 / B.7
  customTheme?: {
    primaryNeon: string; // e.g. #ff007f
    secondaryNeon: string; // e.g. #05d9e8
    accentNeon: string; // e.g. #feff3f
  }; // Metadata for B.2
  logs?: { timestamp: number; message: string; type: 'info' | 'warn' | 'error' }[];
}

export type ViewRole = 'DJ' | 'PARTICIPANT' | 'STAGE' | 'SELECT' | 'FEATURES' | 'ADMIN';

// P2P Sync Types
export type RemoteActionType =
  | 'ADD_REQUEST'
  | 'JOIN_SESSION'
  | 'TOGGLE_STATUS'
  | 'TOGGLE_MIC'
  | 'DELETE_REQUEST'
  | 'UPDATE_REQUEST'
  | 'ADD_CHAT'
  | 'SYNC_PROFILE'
  | 'REORDER_ROUND'
  | 'REORDER_REQUESTS'
  | 'TOGGLE_FAVORITE'
  | 'REORDER_PENDING'
  | 'REORDER_MY_REQUESTS';

export interface RemoteAction {
  type: RemoteActionType;
  payload: any;
  senderId: string;
}

export interface ActiveSession {
  id: string; // Peer ID / Room ID
  hostName: string;
  hostUid?: string; // Firebase Auth UID of the host
  venueName?: string;
  isActive: boolean;
  startedAt: number;
  lastHeartbeat: number;
  participantsCount: number;
  endedAt?: number;
}
