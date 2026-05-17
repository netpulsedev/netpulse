// Network events timeline.
// Auto-generates events when interesting things happen during monitoring,
// like latency spikes, packet loss, or throughput drops. Users can glance
// at this to correlate what they were doing (walking around, microwave on, etc.)
// with what happened to their connection.

import { create } from 'zustand';

export type EventSeverity = 'info' | 'warning' | 'critical';

export interface NetworkEvent {
  id: string;
  ts: number;
  message: string;
  severity: EventSeverity;
}

interface EventsState {
  events: NetworkEvent[];
  pushEvent: (message: string, severity: EventSeverity) => void;
  clearEvents: () => void;
}

// Rolling buffer size — keeps the last 50 events max.
const MAX_EVENTS = 50;

// Deduplication window — don't repeat the same message within 5 seconds.
const DEDUP_WINDOW_MS = 5000;

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],

  pushEvent: (message, severity) => {
    const now = Date.now();
    const existing = get().events;

    // Skip if the same message was generated recently.
    const isDuplicate = existing.some(
      e => e.message === message && now - e.ts < DEDUP_WINDOW_MS
    );
    if (isDuplicate) return;

    const event: NetworkEvent = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      ts: now,
      message,
      severity,
    };

    set({ events: [event, ...existing].slice(0, MAX_EVENTS) });
  },

  clearEvents: () => set({ events: [] }),
}));

// These functions check the current metrics against the previous snapshot
// and fire events when thresholds are crossed. Called from useDiagnostics
// after each snapshot commit.

interface SnapForEvents {
  ping: number;
  jitter: number;
  packetLoss: number;
  download: number;
  upload: number;
  stability: number;
}

let _prev: SnapForEvents | null = null;

export function detectEvents(current: SnapForEvents, push: (msg: string, sev: EventSeverity) => void) {
  if (!_prev) {
    _prev = { ...current };
    return;
  }

  // Latency spike: ping jumped by more than 50ms or crossed 150ms
  if (current.ping > 0 && _prev.ping > 0) {
    if (current.ping - _prev.ping > 50) {
      push('Latency spike detected', current.ping > 150 ? 'critical' : 'warning');
    }
    if (_prev.ping > 80 && current.ping < 40) {
      push('Latency recovered', 'info');
    }
  }

  // Packet loss appeared
  if (current.packetLoss > 1 && _prev.packetLoss <= 0.5) {
    push('Packet loss detected', current.packetLoss > 3 ? 'critical' : 'warning');
  }
  if (_prev.packetLoss > 1 && current.packetLoss <= 0.5) {
    push('Packet loss cleared', 'info');
  }

  // Download throughput dropped significantly
  if (_prev.download > 5 && current.download > 0) {
    const dropPct = ((_prev.download - current.download) / _prev.download) * 100;
    if (dropPct > 40) {
      push('Download throughput dropped', 'warning');
    }
  }

  // Upload throughput dropped significantly
  if (_prev.upload > 2 && current.upload > 0) {
    const dropPct = ((_prev.upload - current.upload) / _prev.upload) * 100;
    if (dropPct > 40) {
      push('Upload throughput dropped', 'warning');
    }
  }

  // Jitter spike
  if (current.jitter > 20 && _prev.jitter < 10) {
    push('High jitter detected', 'warning');
  }
  if (_prev.jitter > 20 && current.jitter < 10) {
    push('Jitter stabilized', 'info');
  }

  // Stability recovered
  if (_prev.stability < 50 && current.stability >= 70) {
    push('Connection stabilized', 'info');
  }
  if (_prev.stability >= 70 && current.stability < 50) {
    push('Connection quality degrading', 'critical');
  }

  _prev = { ...current };
}

export function resetEventDetection() {
  _prev = null;
}
