import { useEffect, useRef, useCallback } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { socketService } from '../services/socketService';
import {
  measureDownload,
  measureUpload,
  adaptiveDownloadSize,
  adaptiveUploadSize,
} from '../services/throughputService';
import {
  calculateStability,
  calcJitter,
  getQualityKey,
} from '../utils/stability';

/**
 * Main diagnostics loop.
 * - 1s: ping/jitter/packet-loss via WebSocket heartbeat
 * - 4s: lightweight throughput sample
 * - 25s: heavier throughput verification
 */
export function useDiagnostics() {
  const store = useNetworkStore();
  const {
    setMetrics, setPhase, setMonitoring, setSessionId,
    setWakeLock, setNetworkInfo, addPingSample, pushHistory, setQuality,
  } = store;

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const packetLossRef = useRef(0);
  const totalHeartbeatsRef = useRef(0);
  const missedHeartbeatsRef = useRef(0);
  const isRunningRef = useRef(false);
  const throughputInFlightRef = useRef(false);

  // ── Acquire Wake Lock ───────────────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLock(true);
        wakeLockRef.current.addEventListener('release', () => setWakeLock(false));
      }
    } catch {
      // Wake lock not available or denied — non-fatal
    }
  }, [setWakeLock]);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
      wakeLockRef.current = null;
      setWakeLock(false);
    } catch { /* ignore */ }
  }, [setWakeLock]);

  // ── Network Info API ────────────────────────────────────────────────────────
  const pollNetworkInfo = useCallback(() => {
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number } }).connection;
    if (conn) {
      setNetworkInfo({
        effectiveType: conn.effectiveType ?? '—',
        downlink: conn.downlink ?? 0,
        rtt: conn.rtt ?? 0,
      });
    }
  }, [setNetworkInfo]);

  const runContinuousThroughput = useCallback(async () => {
    while (isRunningRef.current) {
      if (throughputInFlightRef.current) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      
      throughputInFlightRef.current = true;
      try {
        const { download: lastDl, upload: lastUl } = useNetworkStore.getState();

        setPhase('download');
        const dlSize = adaptiveDownloadSize(lastDl) * 2; // Increase target duration for continuous mode
        const dl = await measureDownload(dlSize, (mbps) => {
          setMetrics({ download: mbps });
        });

        if (!isRunningRef.current) break;
        setMetrics({ download: dl.mbps });

        setPhase('upload');
        const ulSize = adaptiveUploadSize(lastUl) * 2;
        const ul = await measureUpload(ulSize, (mbps) => {
          setMetrics({ upload: mbps });
        });

        if (!isRunningRef.current) break;
        setMetrics({ upload: ul.mbps });
        setPhase('analyzing');

      } finally {
        throughputInFlightRef.current = false;
      }
      
      // Short breather to allow ping/heartbeats to measure idle latency
      await new Promise(r => setTimeout(r, 500));
    }
  }, [setMetrics, setPhase]);

  // ── History Push ─────────────────────────────────────────────────────────────
  const commitSnapshot = useCallback(() => {
    const s = useNetworkStore.getState();
    const jitter = calcJitter(s.pingHistory);
    const pl = packetLossRef.current;
    const stability = calculateStability(s.download, s.upload, s.ping, jitter, pl);
    const quality = getQualityKey(stability);

    setMetrics({ jitter, packetLoss: pl, stability });
    setQuality(quality);

    const snapshot = {
      ts: Date.now(),
      download: s.download,
      upload: s.upload,
      ping: s.ping,
      jitter,
      packetLoss: pl,
      stability,
    };

    pushHistory(snapshot);
    socketService.pushMetrics(snapshot);
  }, [setMetrics, setQuality, pushHistory]);

  // ── Start Monitoring ────────────────────────────────────────────────────────
  const startMonitoring = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    setMonitoring(true);
    setPhase('ping');
    packetLossRef.current = 0;
    totalHeartbeatsRef.current = 0;
    missedHeartbeatsRef.current = 0;
    socketService.resetHeartbeatStats();

    await acquireWakeLock();
    pollNetworkInfo();

    socketService.onSession((id) => setSessionId(id));

    socketService.onConnect(() => {
      socketService.startHeartbeat(250);
    });

    socketService.onDisconnect((unexpected) => {
      if (!unexpected) return;

      // Count unexpected disconnects as packet loss so brief drops are visible in the UI.
      socketService.markDisconnectAsMissed();
      missedHeartbeatsRef.current = socketService.getMissedHeartbeats();
      packetLossRef.current = socketService.getPacketLossPercent();
      setMetrics({ packetLoss: packetLossRef.current });
    });

    socketService.onPing((ping) => {
      addPingSample(ping);
      setMetrics({ ping });
      totalHeartbeatsRef.current++;

      // Packet loss: missed / sent heartbeat ratio maintained by the socket service.
      missedHeartbeatsRef.current = socketService.getMissedHeartbeats();
      packetLossRef.current = socketService.getPacketLossPercent();

      commitSnapshot();
    });

    // Connect after handlers are registered so fast connections cannot miss setup.
    socketService.connect();

    // Start continuous loop
    runContinuousThroughput().catch(() => {});
  }, [
    acquireWakeLock, addPingSample, commitSnapshot, pollNetworkInfo,
    runContinuousThroughput, setMetrics, setMonitoring, setPhase, setSessionId,
  ]);

  // ── Stop Monitoring ─────────────────────────────────────────────────────────
  const stopMonitoring = useCallback(async () => {
    isRunningRef.current = false;
    throughputInFlightRef.current = false;

    socketService.stopHeartbeat();
    socketService.disconnect();
    await releaseWakeLock();

    setMonitoring(false);
    setPhase('idle');
  }, [releaseWakeLock, setMonitoring, setPhase]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (isRunningRef.current) {
        stopMonitoring();
      }
    };
  }, [stopMonitoring]);

  return { startMonitoring, stopMonitoring };
}
