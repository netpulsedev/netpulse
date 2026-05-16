import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private onPingCallback: ((ping: number) => void) | null = null;
  private onSessionCallback: ((sessionId: string) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private pendingHeartbeats: Map<number, number> = new Map();

  connect() {
    if (this.socket?.connected) return;

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
      this.stopHeartbeat();
      this.onDisconnectCallback?.();
    });

    this.socket.on('session:init', ({ sessionId }: { sessionId: string }) => {
      this.onSessionCallback?.(sessionId);
    });

    this.socket.on('heartbeat:ack', ({ clientTime }: { clientTime: number }) => {
      const now = Date.now();
      const ping = now - clientTime;
      this.onPingCallback?.(ping);
      this.pendingHeartbeats.delete(clientTime);
    });
  }

  disconnect() {
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
  }

  startHeartbeat(intervalMs = 1000) {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (!this.socket?.connected) return;
      const clientTime = Date.now();
      this.pendingHeartbeats.set(clientTime, clientTime);
      this.socket.emit('heartbeat', { clientTime });

      // Prune stale pending heartbeats (>5s = lost)
      for (const [t] of this.pendingHeartbeats) {
        if (Date.now() - t > 5000) {
          this.pendingHeartbeats.delete(t);
        }
      }
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

  // Callbacks
  onPing(cb: (ping: number) => void) { this.onPingCallback = cb; }
  onSession(cb: (id: string) => void) { this.onSessionCallback = cb; }
  onConnect(cb: () => void) { this.onConnectCallback = cb; }
  onDisconnect(cb: () => void) { this.onDisconnectCallback = cb; }

  isConnected() { return this.socket?.connected ?? false; }
  
  getMissedHeartbeats(): number {
    return this.pendingHeartbeats.size;
  }
}

export const socketService = new SocketService();
