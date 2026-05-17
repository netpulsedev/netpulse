/**
 * heartbeatService.ts
 *
 * This replaced the old socketService.ts. Despite the name, that service
 * never actually used WebSockets — it was always just HTTP polling, so
 * we renamed it to something honest.
 *
 * What this does:
 * - Hits /api/ping repeatedly on an interval to measure latency
 * - Tracks how many pings succeed vs fail to estimate packet loss
 * - Uses a callback API so useDiagnostics.ts stays clean
 *
 * A note on "packet loss":
 * Browsers can't measure real packet loss without raw socket access.
 * What we're really tracking is HTTP request failure rate, which is a
 * reasonable stand-in but not a true network-layer measurement.
 *
 * A note on latency:
 * The first ping of a session will be slower because it includes the
 * TCP + TLS handshake. After that, keepalive: true reuses the connection
 * so the numbers are much closer to real RTT.
 */

import { API } from '../config/api';

// If a ping request doesn't complete in 5 seconds, we count it as lost.
const HEARTBEAT_TIMEOUT_MS = 5000;

class HeartbeatService {
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

    // Small delay so callers have time to register their callbacks
    // before we fire the connect event.
    setTimeout(() => {
      this.onConnectCallback?.();
      // Session ID is client-generated for now. When we add a backend
      // analytics layer, this can come from /api/health instead.
      this.onSessionCallback?.(crypto.randomUUID());
    }, 50);
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
      const start = performance.now();

      try {
        const res = await fetch(`${API.ping}?t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
          mode: 'cors',
          keepalive: true, // reuse the connection so we're measuring RTT, not handshake
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const ping = Math.round(performance.now() - start);
          this.onPingCallback?.(ping);
        } else {
          this.missedHeartbeats++;
        }
      } catch {
        // Either timed out or the network dropped — both count as a missed ping.
        clearTimeout(timeoutId);
        this.missedHeartbeats++;
      }
    }, intervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  resetHeartbeatStats() {
    this.sentHeartbeats = 0;
    this.missedHeartbeats = 0;
  }

  // Call this when the connection drops unexpectedly so those silent
  // missed beats show up in the packet loss calculation.
  markDisconnectAsMissed(expectedMissedBeats = 3) {
    this.missedHeartbeats += expectedMissedBeats;
    this.sentHeartbeats += expectedMissedBeats;
  }

  getPacketLossPercent(): number {
    if (this.sentHeartbeats === 0) return 0;
    return Math.round((this.missedHeartbeats / this.sentHeartbeats) * 1000) / 10;
  }

  getMissedHeartbeats(): number {
    return this.missedHeartbeats;
  }

  isConnected() {
    return this.connected;
  }

  // Placeholder for future analytics. Once we have a backend we can
  // POST snapshots here. For now it just does nothing.
  pushMetrics(data?: object) { void data; }

  onPing(cb: (ping: number) => void)            { this.onPingCallback = cb; }
  onSession(cb: (id: string) => void)           { this.onSessionCallback = cb; }
  onConnect(cb: () => void)                     { this.onConnectCallback = cb; }
  onDisconnect(cb: (unexpected: boolean) => void) { this.onDisconnectCallback = cb; }
}

// One instance for the whole page — we don't need more than one heartbeat loop.
export const heartbeatService = new HeartbeatService();
