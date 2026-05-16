import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;
const HEARTBEAT_TIMEOUT_MS = 5000;

class SocketService {
  private socket: Socket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private onPingCallback: ((ping: number) => void) | null = null;
  private onSessionCallback: ((sessionId: string) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: ((unexpected: boolean) => void) | null = null;
  private pendingHeartbeats: Map<number, number> = new Map();
  private sentHeartbeats = 0;
  private missedHeartbeats = 0;
  private intentionalDisconnect = false;

  connect() {
    if (this.socket?.connected) return;

    this.intentionalDisconnect = false;
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.onConnectCallback?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      const unexpected = !this.intentionalDisconnect;
      if (unexpected) {
        this.markPendingAsMissed();
      }
      this.stopHeartbeat();
      this.onDisconnectCallback?.(unexpected);
      this.intentionalDisconnect = false;
    });

    this.socket.on('session:init', ({ sessionId }: { sessionId: string }) => {
      this.onSessionCallback?.(sessionId);
    });

    this.socket.on('heartbeat:ack', ({ clientTime }: { clientTime: number }) => {
      if (!this.pendingHeartbeats.has(clientTime)) return;

      this.pendingHeartbeats.delete(clientTime);
      const ping = Date.now() - clientTime;
      this.onPingCallback?.(ping);
    });
  }

  disconnect() {
    this.stopHeartbeat();
    this.intentionalDisconnect = true;
    this.socket?.disconnect();
    this.socket = null;
    this.pendingHeartbeats.clear();
  }

  startHeartbeat(intervalMs = 1000) {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (!this.socket?.connected) return;

      this.pruneStaleHeartbeats();

      const clientTime = Date.now();
      this.pendingHeartbeats.set(clientTime, clientTime);
      this.sentHeartbeats++;
      this.socket.emit('heartbeat', { clientTime });
    }, intervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  pushMetrics(data: object) {
    this.socket?.emit('metrics:update', data);
  }

  resetHeartbeatStats() {
    this.pendingHeartbeats.clear();
    this.sentHeartbeats = 0;
    this.missedHeartbeats = 0;
  }

  markDisconnectAsMissed(expectedMissedBeats = 3) {
    this.markPendingAsMissed();
    this.missedHeartbeats += expectedMissedBeats;
    this.sentHeartbeats += expectedMissedBeats;
  }

  getPacketLossPercent(): number {
    this.pruneStaleHeartbeats();
    if (this.sentHeartbeats === 0) return 0;
    return Math.round((this.missedHeartbeats / this.sentHeartbeats) * 1000) / 10;
  }

  private pruneStaleHeartbeats() {
    const now = Date.now();
    for (const [clientTime] of this.pendingHeartbeats) {
      if (now - clientTime > HEARTBEAT_TIMEOUT_MS) {
        this.pendingHeartbeats.delete(clientTime);
        this.missedHeartbeats++;
      }
    }
  }

  private markPendingAsMissed() {
    this.missedHeartbeats += this.pendingHeartbeats.size;
    this.pendingHeartbeats.clear();
  }

  // Callbacks
  onPing(cb: (ping: number) => void) { this.onPingCallback = cb; }
  onSession(cb: (id: string) => void) { this.onSessionCallback = cb; }
  onConnect(cb: () => void) { this.onConnectCallback = cb; }
  onDisconnect(cb: (unexpected: boolean) => void) { this.onDisconnectCallback = cb; }

  isConnected() { return this.socket?.connected ?? false; }

  getMissedHeartbeats(): number {
    this.pruneStaleHeartbeats();
    return this.missedHeartbeats;
  }
}

export const socketService = new SocketService();
