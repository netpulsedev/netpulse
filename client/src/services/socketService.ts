// We removed socket.io-client because we don't use a local backend anymore.
// This service simulates the original SocketService API but uses HTTP polling
// against Cloudflare's public speed test endpoint to measure ping/latency.

const PING_URL = 'https://speed.cloudflare.com/__down?bytes=0';
const HEARTBEAT_TIMEOUT_MS = 5000;

class SocketService {
  private connected = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private onPingCallback: ((ping: number) => void) | null = null;
  private onSessionCallback: ((sessionId: string) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: ((unexpected: boolean) => void) | null = null;
  
  private sentHeartbeats = 0;
  private missedHeartbeats = 0;

  connect() {
    if (this.connected) return;
    this.connected = true;
    
    // Simulate async connection
    setTimeout(() => {
      this.onConnectCallback?.();
      // Provide a mock session ID
      this.onSessionCallback?.(crypto.randomUUID());
    }, 100);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.connected) {
      this.connected = false;
      this.onDisconnectCallback?.(false);
    }
  }

  startHeartbeat(intervalMs = 250) {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      if (!this.connected) return;

      this.sentHeartbeats++;
      const start = performance.now();
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
        
        const res = await fetch(`${PING_URL}&t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
          mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const ping = Math.round(performance.now() - start);
          this.onPingCallback?.(ping);
        } else {
          this.missedHeartbeats++;
        }
      } catch (err) {
        this.missedHeartbeats++;
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
    // No backend to push to, just ignore
  }

  resetHeartbeatStats() {
    this.sentHeartbeats = 0;
    this.missedHeartbeats = 0;
  }

  markDisconnectAsMissed(expectedMissedBeats = 3) {
    this.missedHeartbeats += expectedMissedBeats;
    this.sentHeartbeats += expectedMissedBeats;
  }

  getPacketLossPercent(): number {
    if (this.sentHeartbeats === 0) return 0;
    return Math.round((this.missedHeartbeats / this.sentHeartbeats) * 1000) / 10;
  }

  // Callbacks
  onPing(cb: (ping: number) => void) { this.onPingCallback = cb; }
  onSession(cb: (id: string) => void) { this.onSessionCallback = cb; }
  onConnect(cb: () => void) { this.onConnectCallback = cb; }
  onDisconnect(cb: (unexpected: boolean) => void) { this.onDisconnectCallback = cb; }

  isConnected() { return this.connected; }

  getMissedHeartbeats(): number {
    return this.missedHeartbeats;
  }
}

export const socketService = new SocketService();
