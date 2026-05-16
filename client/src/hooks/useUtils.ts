import { useState, useEffect, useCallback } from 'react';
import type { MetricSnapshot } from '../store/networkStore';

export function useExport() {
  const exportCSV = useCallback((history: MetricSnapshot[]) => {
    const header = 'Timestamp,Download (Mbps),Upload (Mbps),Ping (ms),Jitter (ms),Packet Loss (%),Stability\n';
    const rows = history.map((h) =>
      `${new Date(h.ts).toISOString()},${h.download.toFixed(2)},${h.upload.toFixed(2)},${h.ping},${h.jitter.toFixed(2)},${h.packetLoss},${h.stability}`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netpulse-session-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { exportCSV };
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const enter = useCallback(async (el?: HTMLElement | null) => {
    const target = el ?? document.documentElement;
    try {
      await target.requestFullscreen();
    } catch { /* ignore */ }
  }, []);

  const exit = useCallback(async () => {
    try {
      await document.exitFullscreen();
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback((el?: HTMLElement | null) => {
    if (isFullscreen) exit();
    else enter(el);
  }, [isFullscreen, enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}

export function useElapsedTime(startTime: number | null, active: boolean) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!active || !startTime) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active, startTime]);

  if (!active || !startTime) return 0;
  return Math.max(0, (now ?? startTime) - startTime);
}
