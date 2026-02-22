import { Peer, DataConnection } from 'peerjs';
import { KaraokeSession, RemoteAction } from '../types';
import { db } from './firebaseConfig';
import { collection, addDoc } from "firebase/firestore";

class SyncService {
  private peer: Peer | null = null;
  private lockPeer: Peer | null = null; // Separate peer to "hold" the network lock
  private connections: Map<string, DataConnection> = new Map();
  private hostId: string | null = null;
  private isHost: boolean = false;
  private heartbeatInterval: number | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 10;
  private actionQueue: RemoteAction[] = [];

  public onStateReceived: ((state: KaraokeSession) => void) | null = null;
  public onActionReceived: ((action: RemoteAction) => void) | null = null;
  public onConnectionStatus: ((status: 'connected' | 'disconnected' | 'connecting') => void) | null = null;
  public onPeerConnected: (() => void) | null = null;

  // New Event for Device Tracking
  public onDeviceConnected: ((peerId: string) => void) | null = null;
  public onDeviceDisconnected: ((peerId: string) => void) | null = null;

  constructor() {
    this.loadQueue();
  }

  private loadQueue() {
    try {
      const saved = localStorage.getItem('singmode_pending_actions');
      if (saved) {
        this.actionQueue = JSON.parse(saved);
        console.log(`[Sync] Loaded ${this.actionQueue.length} pending actions from storage.`);
      }
    } catch (e) {
      console.warn('[Sync] Failed to load pending actions:', e);
    }
  }

  private persistQueue() {
    try {
      localStorage.setItem('singmode_pending_actions', JSON.stringify(this.actionQueue));
      // Notify UI of local queue change
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('kstar_sync'));
      }
    } catch (e) {
      console.warn('[Sync] Failed to persist pending actions:', e);
    }
  }

  private async getPublicIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown-network';
    } catch (e) {
      console.warn('[Sync] Could not fetch public IP for lock, using fallback', e);
      return 'local-fallback';
    }
  }

  async initialize(role: 'DJ' | 'PARTICIPANT', room?: string): Promise<string> {
    this.isHost = role === 'DJ';
    if (!this.isHost && room) {
      this.hostId = room;
    }

    if (this.peer) {
      this.destroy();
    }

    // Step 1: Singleton Lock Enforcement for DJs
    if (this.isHost && !room) {
      const ip = await this.getPublicIP();
      const lockId = `singmode-lock-${btoa(ip).replace(/=/g, '').substr(0, 12)}`;

      console.log(`[Sync] Attempting to claim network lock: ${lockId}`);

      const lockAcquired = await new Promise<boolean>((resolve) => {
        const tempLock = new Peer(lockId, { debug: 1 });
        tempLock.on('open', () => {
          this.lockPeer = tempLock;
          resolve(true);
        });
        tempLock.on('error', (err) => {
          if (err.type === 'unavailable-id') {
            resolve(false);
          } else {
            // Some other error, might be network. We shouldn't block DJing just because signaling is down
            // But usually this means we can't be sure about the lock.
            resolve(true);
          }
          tempLock.destroy();
        });
      });

      if (!lockAcquired) {
        throw new Error('COLLISION: A SingMode DJ session is already active on this network.');
      }
    }

    return new Promise((resolve, reject) => {
      // Step 2: Initialize actual Data Peer
      // For DJs, always generate a fresh unique ID for the QR code
      const id = this.isHost ? (room || `singmode-${Math.random().toString(36).substr(2, 6)}`) : undefined;

      this.peer = new Peer(id, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
          ]
        }
      });

      this.peer.on('open', (peerId) => {
        console.log(`[Sync] Peer opened with ID: ${peerId}`);
        if (this.isHost) {
          this.hostId = peerId;
        }
        this.retryCount = 0;
        this.startHeartbeat();

        if (!this.isHost && room) {
          this.connectToHost(room);
        }

        if (this.onConnectionStatus && (!room || this.connections.size > 0)) {
          this.onConnectionStatus('connected');
        }

        resolve(peerId);
      });

      this.peer.on('disconnected', () => {
        console.warn('[Sync] Peer disconnected from signaling server. Attempting reconnect...');
        if (this.onConnectionStatus) this.onConnectionStatus('connecting');
        this.peer?.reconnect();
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err: any) => {
        console.error('[Sync] Peer error:', err.type, err);

        if (err.type === 'unavailable-id') {
          // This should be rare now with random IDs, but if it happens, try again
          this.destroy();
          this.initialize(role).then(resolve).catch(reject);
        } else if (err.type === 'network' || err.type === 'server-error' || err.message?.includes('Lost connection')) {
          if (this.onConnectionStatus) this.onConnectionStatus('disconnected');
          this.handleNetworkError(role, room);
        } else if (err.type === 'peer-unavailable') {
          if (this.onConnectionStatus) this.onConnectionStatus('disconnected');
        }
      });
    });
  }

  private handleNetworkError(role: 'DJ' | 'PARTICIPANT', room?: string) {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
      console.log(`[Sync] Network failure. Retrying in ${delay}ms... (Attempt ${this.retryCount})`);
      setTimeout(() => {
        this.initialize(role, room);
      }, delay);
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = window.setInterval(() => {
      if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
        this.peer.reconnect();
      }
      // Keep lock peer alive too if it exists
      if (this.lockPeer && this.lockPeer.disconnected && !this.lockPeer.destroyed) {
        this.lockPeer.reconnect();
      }
    }, 5000);
  }

  private connectToHost(hostId: string) {
    if (!this.peer || this.isHost || this.peer.destroyed) return;

    if (this.onConnectionStatus) this.onConnectionStatus('connecting');

    const conn = this.peer.connect(hostId, {
      reliable: true
    });

    this.handleConnection(conn);
  }

  private handleConnection(conn: DataConnection) {
    conn.on('open', () => {
      console.log(`[Sync] Data connection established with: ${conn.peer}`);
      this.connections.set(conn.peer, conn);

      // Flush Action Queue if we are a client connecting to host
      if (!this.isHost && this.actionQueue.length > 0) {
        console.log(`[Sync] Flushing ${this.actionQueue.length} queued actions to host.`);
        this.actionQueue.forEach(action => {
          conn.send(action);
        });
        this.actionQueue = [];
        this.persistQueue();
      }

      if (this.onConnectionStatus) this.onConnectionStatus('connected');
      if (this.isHost && this.onPeerConnected) this.onPeerConnected();

      // Trigger new device connected event
      if (this.isHost && this.onDeviceConnected) {
        this.onDeviceConnected(conn.peer);
      }
    });

    conn.on('data', (data: unknown) => {
      if (data && typeof data === 'object') {
        if ('type' in data) {
          const action = { ...(data as RemoteAction), senderId: conn.peer };
          if (this.onActionReceived) this.onActionReceived(action);
        } else if ('participants' in data) {
          this.applyIncomingState(data as KaraokeSession);
        }
      }
    });

    conn.on('close', () => {
      console.log(`[Sync] Connection closed: ${conn.peer}`);
      this.connections.delete(conn.peer);
      if (this.connections.size === 0 && this.onConnectionStatus) {
        if (!this.isHost) this.onConnectionStatus('disconnected');
      }
      // Trigger device disconnected event
      if (this.isHost && this.onDeviceDisconnected) {
        this.onDeviceDisconnected(conn.peer);
      }
    });

    conn.on('error', (err) => {
      console.error('[Sync] Connection error:', err);
      this.connections.delete(conn.peer);
    });
  }

  broadcastState(state: KaraokeSession) {
    if (!this.isHost) return;
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(state);
      }
    });
  }

  broadcastAction(action: RemoteAction) {
    if (!this.isHost) return;
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(action);
      }
    });
  }

  async sendAction(action: RemoteAction) {
    if (this.isHost) return;

    // Check if we have any open connection to host
    let sent = false;
    this.connections.forEach(conn => {
      if (conn.open) {
        conn.send(action);
        sent = true;
      }
    });

    if (!sent) {
      console.log('[Sync] No connection to host. Queuing action locally and buffering to Firestore:', action.type);

      // Only keep in memory queue and perform buffering if not already queued
      // (Basic deduplication for rapid retries/refresh loops)
      const alreadyQueued = this.actionQueue.some(q => JSON.stringify(q.payload) === JSON.stringify(action.payload) && q.type === action.type);

      if (!alreadyQueued) {
        this.actionQueue.push(action);
        this.persistQueue();

        // Robustness Upgrade: If we have a roomId, buffer the action to Firestore
        // This ensures the DJ receives it even if PeerJS signaling fails and we are using the fallback sync
        if (this.hostId) {
          try {
            const bufferRef = collection(db, "sessions", this.hostId, "pending_actions");
            await addDoc(bufferRef, {
              ...action,
              bufferedAt: Date.now()
            });
            console.log(`[Sync] Action ${action.type} buffered successfully to Firestore.`);
          } catch (e) {
            console.error('[Sync] Failed to buffer action to Firestore:', e);
          }
        }
      }
    }
  }

  getRoomId(): string | null {
    return this.hostId;
  }

  getMyPeerId(): string | null {
    return this.peer?.id || null;
  }

  applyIncomingState(state: KaraokeSession) {
    if (!this.isHost && this.actionQueue.length > 0) {
      const initialLen = this.actionQueue.length;
      this.actionQueue = this.actionQueue.filter(q => {
        if (q.type === 'ADD_REQUEST') {
          const payload = q.payload as any;
          // If this song/artist for this participant is already in session, it reached the host
          return !state.requests.some(r =>
            r.participantId === payload.participantId &&
            r.songName === payload.songName &&
            r.artist === payload.artist
          );
        }
        return true;
      });
      if (this.actionQueue.length !== initialLen) {
        console.log(`[Sync] Self-cleaned ${initialLen - this.actionQueue.length} processed actions from queue.`);
        this.persistQueue();
      }
    }

    if (this.onStateReceived) this.onStateReceived(state);
  }

  getPendingActions(): RemoteAction[] {
    return this.actionQueue;
  }

  destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.connections.forEach(c => c.close());
    this.connections.clear();
    this.actionQueue = [];
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    if (this.lockPeer) {
      this.lockPeer.destroy();
      this.lockPeer = null;
    }
  }
}

export const syncService = new SyncService();