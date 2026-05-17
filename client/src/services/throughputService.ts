/**
 * throughputService.ts
 *
 * Multi-connection throughput measurement, similar to how Ookla Speedtest works.
 *
 * Key design decisions:
 * 1. We use MULTIPLE parallel connections (4 streams) to saturate the pipe.
 *    A single HTTP connection can't fill a link due to TCP slow-start and
 *    flow control. Ookla uses 4-8 connections for exactly this reason.
 *
 * 2. Each stream downloads/uploads independently and we sum the bytes
 *    across all streams to calculate total throughput.
 *
 * 3. Upload buffer is pre-allocated once (25 MB) to avoid GC pressure.
 *
 * 4. Progress callbacks fire every 100ms with the combined throughput
 *    across all active streams.
 */

import { API } from '../config/api';

export interface ThroughputResult {
  mbps: number;
  durationMs: number;
  bytes: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const NUM_STREAMS = 4;   // Number of parallel connections (like Ookla "Multi")
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB buffer

// ─── Upload Buffer (allocated once, reused forever) ───────────────────────────

const _uploadBuffer = new Uint8Array(MAX_UPLOAD_BYTES);
crypto.getRandomValues(_uploadBuffer.subarray(0, 65_536));

// ─── Multi-Stream Download ────────────────────────────────────────────────────

/**
 * Opens `NUM_STREAMS` parallel download connections and measures
 * aggregate throughput across all of them. This saturates the link
 * much more effectively than a single stream.
 */
export async function measureDownload(
  totalBytes = 2 * 1024 * 1024,
  onProgress?: (mbps: number) => void,
): Promise<ThroughputResult> {
  const perStream = Math.ceil(totalBytes / NUM_STREAMS);
  const start = performance.now();
  const bytesPerStream = new Array(NUM_STREAMS).fill(0);
  let allDone = false;

  // Progress reporter runs on a timer to avoid flooding the UI
  const progressInterval = setInterval(() => {
    if (allDone) return;
    const now = performance.now();
    const totalBytesNow = bytesPerStream.reduce((a, b) => a + b, 0);
    const durationSec = (now - start) / 1000;
    if (durationSec > 0) {
      const mbps = (totalBytesNow * 8) / durationSec / 1_000_000;
      onProgress?.(mbps);
    }
  }, 100);

  try {
    // Launch all streams in parallel
    const streamPromises = Array.from({ length: NUM_STREAMS }, async (_, i) => {
      try {
        const res = await fetch(
          `${API.down}?bytes=${perStream}&t=${Date.now()}&s=${i}`,
          { cache: 'no-store', signal: AbortSignal.timeout(20_000) }
        );
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytesPerStream[i] += value?.length ?? 0;
        }
      } catch {
        // Individual stream failure is ok — others still count
      }
    });

    await Promise.all(streamPromises);
  } finally {
    allDone = true;
    clearInterval(progressInterval);
  }

  const durationMs = performance.now() - start;
  const totalBytesReceived = bytesPerStream.reduce((a, b) => a + b, 0);
  const mbps = durationMs > 0
    ? (totalBytesReceived * 8) / (durationMs / 1000) / 1_000_000
    : 0;

  // One final progress callback with the accurate result
  onProgress?.(mbps);

  return { mbps: Math.max(0, mbps), durationMs, bytes: totalBytesReceived };
}

// ─── Multi-Stream Upload ──────────────────────────────────────────────────────

/**
 * Opens `NUM_STREAMS` parallel upload connections.
 * Each sends a slice of the pre-allocated buffer.
 * XHR is used for upload progress events.
 */
export async function measureUpload(
  totalBytes = 1 * 1024 * 1024,
  onProgress?: (mbps: number) => void,
): Promise<ThroughputResult> {
  const perStream = Math.min(
    Math.ceil(totalBytes / NUM_STREAMS),
    Math.floor(MAX_UPLOAD_BYTES / NUM_STREAMS)
  );
  const start = performance.now();
  const loadedPerStream = new Array(NUM_STREAMS).fill(0);
  let allDone = false;

  // Progress reporter
  const progressInterval = setInterval(() => {
    if (allDone) return;
    const now = performance.now();
    const totalLoaded = loadedPerStream.reduce((a, b) => a + b, 0);
    const durationSec = (now - start) / 1000;
    if (durationSec > 0) {
      const mbps = (totalLoaded * 8) / durationSec / 1_000_000;
      onProgress?.(mbps);
    }
  }, 100);

  try {
    const streamPromises = Array.from({ length: NUM_STREAMS }, (_, i) => {
      return new Promise<void>((resolve) => {
        try {
          const offset = i * perStream;
          const slice = _uploadBuffer.subarray(offset, offset + perStream);
          const blob = new Blob([slice], { type: 'application/octet-stream' });

          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API.up}?t=${Date.now()}&s=${i}`, true);
          xhr.setRequestHeader('Content-Type', 'application/octet-stream');
          xhr.timeout = 20_000;

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              loadedPerStream[i] = e.loaded;
            }
          };

          xhr.onload = () => {
            loadedPerStream[i] = perStream;
            resolve();
          };
          xhr.onerror = () => resolve();
          xhr.ontimeout = () => resolve();

          xhr.send(blob);
        } catch {
          resolve();
        }
      });
    });

    await Promise.all(streamPromises);
  } finally {
    allDone = true;
    clearInterval(progressInterval);
  }

  const durationMs = performance.now() - start;
  const totalSent = loadedPerStream.reduce((a, b) => a + b, 0);
  const mbps = durationMs > 0
    ? (totalSent * 8) / (durationMs / 1000) / 1_000_000
    : 0;

  onProgress?.(mbps);

  return { mbps: Math.max(0, mbps), durationMs, bytes: totalSent };
}

// ─── One-shot ping ────────────────────────────────────────────────────────────

export async function httpPing(): Promise<number> {
  try {
    const start = performance.now();
    const res = await fetch(`${API.ping}?t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
      keepalive: true,
    });
    if (!res.ok) return 0;
    return Math.round(performance.now() - start);
  } catch {
    return 0;
  }
}

// ─── Adaptive sizing ──────────────────────────────────────────────────────────

/**
 * Targets ~2 seconds of download at the current speed.
 * Capped at 10 MB to avoid tests that take 15+ seconds on slower links.
 */
export function adaptiveDownloadSize(recentMbps: number): number {
  if (recentMbps === 0) return 1 * 1024 * 1024; // cold start: 1 MB total
  const bytes = (recentMbps * 1_000_000 * 2) / 8; // 2 seconds target
  return Math.max(512 * 1024, Math.min(10 * 1024 * 1024, bytes));
}

/**
 * Targets ~1.5 seconds of upload.
 */
export function adaptiveUploadSize(recentMbps: number): number {
  if (recentMbps === 0) return 512 * 1024; // cold start: 512 KB total
  const bytes = (recentMbps * 1_000_000 * 1.5) / 8;
  return Math.max(256 * 1024, Math.min(MAX_UPLOAD_BYTES, bytes));
}
