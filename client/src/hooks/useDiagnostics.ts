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
  const lightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heavyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const packetLossRef = useRef(0);
  const totalHeartbeatsRef = useRef(0);
  const missedHeartbeatsRef = useRef(0);
  const isRunningRef = useRef(false);

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

  // ── Throughput Measurement ──────────────────────────────────────────────────
  const runLightThroughput = useCallback(async () => {
    if (!isRunningRef.current) return;
    const { download: lastDl, upload: lastUl } = useNetworkStore.getState();

    setPhase('download');
    const dlSize = adaptiveDownloadSize(lastDl);
    const dl = await measureDownload(dlSize);

    if (!isRunningRef.current) return;

    setPhase('upload');
    const ulSize = adaptiveUploadSize(lastUl);
    const ul = await measureUpload(ulSize);

    if (!isRunningRef.current) return;

    setPhase('analyzing');
    setMetrics({ download: dl.mbps, upload: ul.mbps });
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

    pushHistory({
      ts: Date.now(),
      download: s.download,
      upload: s.upload,
      ping: s.ping,
      jitter,
      packetLoss: pl,
      stability,
    });
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

    // Connect WebSocket
    socketService.connect();

    socketService.onSession((id) => setSessionId(id));

    socketService.onConnect(() => {
      socketService.startHeartbeat(1000);
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

    // Light throughput every 4s
    lightIntervalRef.current = setInterval(() => {
      runLightThroughput().catch(() => {});
    }, 4000);

    // Heavy throughput every 25s
    heavyIntervalRef.current = setInterval(async () => {
      if (!isRunningRef.current) return;
      setPhase('download');
      const dl = await measureDownload(4 * 1024 * 1024); // 4MB
      if (!isRunningRef.current) return;
      setPhase('upload');
      const ul = await measureUpload(2 * 1024 * 1024); // 2MB
      if (!isRunningRef.current) return;
      setMetrics({ download: dl.mbps, upload: ul.mbps });
    }, 25000);

    // Initial light run
    setTimeout(() => runLightThroughput().catch(() => {}), 500);
  }, [
    acquireWakeLock, addPingSample, commitSnapshot, pollNetworkInfo,
    runLightThroughput, setMetrics, setMonitoring, setPhase, setSessionId,
  ]);

  // ── Stop Monitoring ─────────────────────────────────────────────────────────
  const stopMonitoring = useCallback(async () => {
    isRunningRef.current = false;

    if (lightIntervalRef.current) {
      clearInterval(lightIntervalRef.current);
      lightIntervalRef.current = null;
    }
    if (heavyIntervalRef.current) {
      clearInterval(heavyIntervalRef.current);
      heavyIntervalRef.current = null;
    }

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
