import { useEffect, useRef, useCallback } from 'react';
import { useNetworkStore } from '../store/networkStore';
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

  // Continuous throughput loop — sequential phases (download → upload).
  // Running them simultaneously splits bandwidth on shared pipes,
  // which is why Ookla also runs them one at a time.
  // Each phase uses 4 parallel streams internally (multi-connection).
  // Respects testMode: 'download' | 'upload' | 'both'.
  const runContinuousThroughput = useCallback(async () => {
    while (isRunningRef.current) {
      if (throughputInFlightRef.current) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      throughputInFlightRef.current = true;

      try {
        const state = useNetworkStore.getState();
        const { download: lastDl, upload: lastUl, addDataConsumed, testMode } = state;
        let totalBytes = 0;

        // ── Download phase (4 parallel streams) ──
        if (testMode === 'both' || testMode === 'download') {
          setPhase('download');
          const dlSize = adaptiveDownloadSize(lastDl);
          const dlResult = await measureDownload(dlSize, (mbps) => {
            if (isRunningRef.current) setMetrics({ download: mbps });
          });
          if (!isRunningRef.current) break;
          setMetrics({ download: dlResult.mbps });
          totalBytes += dlResult.bytes;
        }

        // ── Upload phase (4 parallel streams) ──
        if (testMode === 'both' || testMode === 'upload') {
          setPhase('upload');
          const ulSize = adaptiveUploadSize(lastUl);
          const ulResult = await measureUpload(ulSize, (mbps) => {
            if (isRunningRef.current) setMetrics({ upload: mbps });
          });
          if (!isRunningRef.current) break;
          setMetrics({ upload: ulResult.mbps });
          totalBytes += ulResult.bytes;
        }

        addDataConsumed(totalBytes);
        setPhase('active');

      } finally {
        throughputInFlightRef.current = false;
      }

      // Brief pause for latency measurement between cycles
      await new Promise(r => setTimeout(r, 300));
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
      // Only accept ping samples when NOT running throughput tests.
      // During active download/upload, latency spikes due to bufferbloat
      // and gives wildly misleading numbers (2000ms+ on a 150ms connection).
      const phase = useNetworkStore.getState().testPhase;
      const isDuringTest = phase === 'download' || phase === 'upload';

      if (!isDuringTest) {
        addPingSample(ping);
        setMetrics({ ping });
      }
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
