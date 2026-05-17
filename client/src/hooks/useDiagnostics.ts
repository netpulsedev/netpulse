import { useEffect, useRef, useCallback } from 'react';
import { useNetworkStore, type TestPhase } from '../store/networkStore';
import { useEdgeStore } from '../store/edgeStore';
import { useEventsStore, detectEvents, resetEventDetection } from '../store/eventsStore';
import { heartbeatService } from '../services/heartbeatService';
import { saveSession, type SavedSession } from '../services/sessionStorage';
import { API } from '../config/api';
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

// Main diagnostics hook.
// Runs the heartbeat loop for ping/jitter/packet-loss,
// plus a continuous throughput loop for download/upload.
export function useDiagnostics() {
  const store = useNetworkStore();
  const {
    setMetrics, setPhase, setMonitoring, setSessionId,
    setWakeLock, setNetworkInfo, addPingSample, pushHistory, setQuality,
  } = store;

  const edgeStore = useEdgeStore();
  const pushEvent = useEventsStore(s => s.pushEvent);
  const clearEvents = useEventsStore(s => s.clearEvents);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const packetLossRef = useRef(0);
  const totalHeartbeatsRef = useRef(0);
  const missedHeartbeatsRef = useRef(0);
  const isRunningRef = useRef(false);
  const throughputInFlightRef = useRef(false);

  // Keep the screen on while monitoring.
  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLock(true);
        wakeLockRef.current.addEventListener('release', () => setWakeLock(false));
      }
    } catch {
      // Not available or denied — no big deal.
    }
  }, [setWakeLock]);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
      wakeLockRef.current = null;
      setWakeLock(false);
    } catch { /* ignore */ }
  }, [setWakeLock]);

  // Pull connection type info from the browser's Network Information API (Chrome/Edge).
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

  // Fetch edge region info from the Worker.
  const fetchEdgeInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API.health}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        edgeStore.setColo(
          data.colo ?? '',
          data.region ?? '',
          data.country ?? '',
          data.version ?? '',
        );
      }
    } catch {
      // Worker might not be deployed yet — no worries.
    }
  }, [edgeStore]);

  // Continuous download/upload loop (Simultaneous).
  const runContinuousThroughput = useCallback(async () => {
    while (isRunningRef.current) {
      if (throughputInFlightRef.current) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      throughputInFlightRef.current = true;
      setPhase('active' as TestPhase); // Use 'active' or similar instead of alternating

      try {
        const { download: lastDl, upload: lastUl, addDataConsumed } = useNetworkStore.getState();

        const dlSize = adaptiveDownloadSize(lastDl) * 2;
        const ulSize = adaptiveUploadSize(lastUl) * 2;

        const [dlResult, ulResult] = await Promise.all([
          measureDownload(dlSize, (mbps) => {
            if (isRunningRef.current) setMetrics({ download: mbps });
          }),
          measureUpload(ulSize, (mbps) => {
            if (isRunningRef.current) setMetrics({ upload: mbps });
          })
        ]);

        if (isRunningRef.current) {
          setMetrics({ download: dlResult.mbps, upload: ulResult.mbps });
          addDataConsumed(dlResult.bytes + ulResult.bytes);
        }

      } finally {
        throughputInFlightRef.current = false;
      }

      // Short pause so the heartbeat can measure idle latency between tests.
      await new Promise(r => setTimeout(r, 500));
    }
  }, [setMetrics, setPhase]);

  // Commit a snapshot: calculate derived metrics, push to history, detect events.
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
    heartbeatService.pushMetrics(snapshot);

    // Generate events based on how the metrics changed.
    detectEvents(snapshot, pushEvent);
  }, [setMetrics, setQuality, pushHistory, pushEvent]);

  // Start everything.
  const startMonitoring = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    setMonitoring(true);
    setPhase('ping');
    packetLossRef.current = 0;
    totalHeartbeatsRef.current = 0;
    missedHeartbeatsRef.current = 0;
    heartbeatService.resetHeartbeatStats();
    resetEventDetection();
    clearEvents();

    await acquireWakeLock();
    pollNetworkInfo();
    fetchEdgeInfo();

    heartbeatService.onSession((id) => setSessionId(id));

    heartbeatService.onConnect(() => {
      heartbeatService.startHeartbeat(250);
    });

    heartbeatService.onDisconnect((unexpected) => {
      if (!unexpected) return;
      heartbeatService.markDisconnectAsMissed();
      missedHeartbeatsRef.current = heartbeatService.getMissedHeartbeats();
      packetLossRef.current = heartbeatService.getPacketLossPercent();
      setMetrics({ packetLoss: packetLossRef.current });
    });

    heartbeatService.onPing((ping) => {
      addPingSample(ping);
      setMetrics({ ping });
      totalHeartbeatsRef.current++;

      missedHeartbeatsRef.current = heartbeatService.getMissedHeartbeats();
      packetLossRef.current = heartbeatService.getPacketLossPercent();

      commitSnapshot();
    });

    heartbeatService.connect();
    runContinuousThroughput().catch(() => {});
  }, [
    acquireWakeLock, addPingSample, commitSnapshot, pollNetworkInfo,
    fetchEdgeInfo, clearEvents, runContinuousThroughput, setMetrics,
    setMonitoring, setPhase, setSessionId,
  ]);

  // Stop everything and save the session to IndexedDB.
  const stopMonitoring = useCallback(async () => {
    isRunningRef.current = false;
    throughputInFlightRef.current = false;

    heartbeatService.stopHeartbeat();
    heartbeatService.disconnect();
    await releaseWakeLock();

    // Save session locally before resetting.
    const state = useNetworkStore.getState();
    const edge = useEdgeStore.getState();
    if (state.analytics.sampleCount > 2) {
      const session: SavedSession = {
        id: state.sessionId ?? crypto.randomUUID(),
        startedAt: state.sessionStart ?? Date.now(),
        endedAt: Date.now(),
        durationMs: state.sessionStart ? Date.now() - state.sessionStart : 0,
        colo: edge.colo,
        avgDownload: state.analytics.avgDownload,
        avgUpload: state.analytics.avgUpload,
        bestDownload: state.analytics.bestDownload,
        bestUpload: state.analytics.bestUpload,
        lowestPing: state.analytics.lowestPing === Infinity ? 0 : state.analytics.lowestPing,
        peakJitter: state.analytics.peakJitter,
        avgStability: state.analytics.avgStability,
        sampleCount: state.analytics.sampleCount,
      };
      saveSession(session).catch(() => {});
    }

    setMonitoring(false);
    setPhase('idle');
  }, [releaseWakeLock, setMonitoring, setPhase]);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      if (isRunningRef.current) {
        stopMonitoring();
      }
    };
  }, [stopMonitoring]);

  return { startMonitoring, stopMonitoring };
}
