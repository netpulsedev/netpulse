import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface MetricSnapshot {
  ts: number;
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  packetLoss: number;
  stability: number;
}

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'idle';
export type TestPhase = 'idle' | 'ping' | 'download' | 'upload' | 'analyzing' | 'active';
export type TestMode = 'both' | 'download' | 'upload';

interface NetworkState {
  // Live metrics
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  packetLoss: number;
  stability: number;
  quality: ConnectionQuality;

  // Network info (from Navigator API)
  effectiveType: string;
  downlinkEstimate: number;
  rtt: number;

  // Session state
  isMonitoring: boolean;
  testPhase: TestPhase;
  sessionId: string | null;
  sessionStart: number | null;
  wakeLockActive: boolean;
  dataConsumed: number;
  testMode: TestMode;

  // Rolling history (60s at 1Hz)
  history: MetricSnapshot[];
  pingHistory: number[];

  // Session analytics
  analytics: {
    avgDownload: number;
    avgUpload: number;
    bestDownload: number;
    bestUpload: number;
    lowestPing: number;
    peakJitter: number;
    avgStability: number;
    sampleCount: number;
  };

  // Actions
  setMetrics: (metrics: Partial<MetricSnapshot>) => void;
  setQuality: (quality: ConnectionQuality) => void;
  setPhase: (phase: TestPhase) => void;
  setMonitoring: (v: boolean) => void;
  setSessionId: (id: string | null) => void;
  setWakeLock: (v: boolean) => void;
  addDataConsumed: (bytes: number) => void;
  setTestMode: (mode: TestMode) => void;
  setNetworkInfo: (info: { effectiveType?: string; downlink?: number; rtt?: number }) => void;
  addPingSample: (ping: number) => void;
  pushHistory: (snap: MetricSnapshot) => void;
  resetSession: () => void;
}

const defaultAnalytics = {
  avgDownload: 0,
  avgUpload: 0,
  bestDownload: 0,
  bestUpload: 0,
  lowestPing: Infinity,
  peakJitter: 0,
  avgStability: 0,
  sampleCount: 0,
};

export const useNetworkStore = create<NetworkState>()(
  subscribeWithSelector((set) => ({
    download: 0,
    upload: 0,
    ping: 0,
    jitter: 0,
    packetLoss: 0,
    stability: 0,
    quality: 'idle',
    effectiveType: '—',
    downlinkEstimate: 0,
    rtt: 0,
    isMonitoring: false,
    testPhase: 'idle',
    sessionId: null,
    sessionStart: null,
    wakeLockActive: false,
    dataConsumed: 0,
    testMode: 'both' as const,
    history: [],
    pingHistory: [],
    analytics: { ...defaultAnalytics },

    setMetrics: (metrics) => set((state) => ({ ...state, ...metrics })),

    setQuality: (quality) => set({ quality }),

    setPhase: (phase) => set({ testPhase: phase }),

    setMonitoring: (v) =>
      set((state) => ({
        isMonitoring: v,
        sessionStart: v ? Date.now() : state.sessionStart,
      })),

    setSessionId: (id) => set({ sessionId: id }),

    setWakeLock: (v) => set({ wakeLockActive: v }),
    
    addDataConsumed: (bytes) => set((state) => ({ dataConsumed: state.dataConsumed + bytes })),
    setTestMode: (mode) => set({ testMode: mode }),

    setNetworkInfo: (info) =>
      set((state) => ({
        effectiveType: info.effectiveType ?? state.effectiveType,
        downlinkEstimate: info.downlink ?? state.downlinkEstimate,
        rtt: info.rtt ?? state.rtt,
      })),

    addPingSample: (ping) =>
      set((state) => {
        const newHistory = [...state.pingHistory, ping].slice(-10);
        return { pingHistory: newHistory };
      }),

    pushHistory: (snap) =>
      set((state) => {
        const newHistory = [...state.history, snap].slice(-60); // 60s rolling window
        const a = state.analytics;
        const n = a.sampleCount + 1;
        const updated = {
          avgDownload: (a.avgDownload * a.sampleCount + snap.download) / n,
          avgUpload: (a.avgUpload * a.sampleCount + snap.upload) / n,
          bestDownload: Math.max(a.bestDownload, snap.download),
          bestUpload: Math.max(a.bestUpload, snap.upload),
          lowestPing: snap.ping > 0 ? Math.min(a.lowestPing === Infinity ? snap.ping : a.lowestPing, snap.ping) : a.lowestPing,
          peakJitter: Math.max(a.peakJitter, snap.jitter),
          avgStability: (a.avgStability * a.sampleCount + snap.stability) / n,
          sampleCount: n,
        };
        return { history: newHistory, analytics: updated };
      }),

    resetSession: () =>
      set({
        download: 0,
        upload: 0,
        ping: 0,
        jitter: 0,
        packetLoss: 0,
        stability: 0,
        quality: 'idle',
        history: [],
        pingHistory: [],
        analytics: { ...defaultAnalytics },
        sessionStart: null,
        sessionId: null,
        testPhase: 'idle',
        dataConsumed: 0,
      }),
  }))
);

