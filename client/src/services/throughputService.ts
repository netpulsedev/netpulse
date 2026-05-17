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
 *
 * Modified to fetch consecutive lightweight 1 MB chunks to prevent
 * Cloudflare Worker CPU limits (free tier) and memory/CORS bottlenecks.
 */
export async function measureDownload(
  durationOrSize = 2000,
  onProgress?: (mbps: number) => void,
): Promise<ThroughputResult> {
  const durationMs = durationOrSize > 100_000 ? 2000 : durationOrSize;
  const start = performance.now();
  const bytesPerStream = new Array(NUM_STREAMS).fill(0);
  let allDone = false;
  const abortController = new AbortController();

  // Set timeout to abort the fetches after durationMs
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, durationMs);

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
    // Launch all streams in parallel, consecutively downloading 1 MB chunks as long as test is active
    const streamPromises = Array.from({ length: NUM_STREAMS }, async (_, i) => {
      while (!allDone) {
        try {
          const res = await fetch(
            `${API.down}?bytes=${1 * 1024 * 1024}&t=${Date.now()}&s=${i}`,
            { cache: 'no-store', signal: abortController.signal }
          );
          if (!res.ok || !res.body) break;

          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytesPerStream[i] += value?.length ?? 0;
          }
        } catch {
          break; // Abort or connection error stops this stream loop
        }
      }
    });

    await Promise.all(streamPromises);
  } finally {
    allDone = true;
    clearTimeout(timeoutId);
    clearInterval(progressInterval);
  }

  const durationMsActual = performance.now() - start;
  const totalBytesReceived = bytesPerStream.reduce((a, b) => a + b, 0);
  const mbps = durationMsActual > 0
    ? (totalBytesReceived * 8) / (durationMsActual / 1000) / 1_000_000
    : 0;

  // One final progress callback with the accurate result
  onProgress?.(mbps);

  return { mbps: Math.max(0, mbps), durationMs: durationMsActual, bytes: totalBytesReceived };
}

// ─── Multi-Stream Upload ──────────────────────────────────────────────────────

/**
 * Opens `NUM_STREAMS` parallel upload connections.
 * Each sends a slice of the pre-allocated buffer.
 * XHR is used for upload progress events.
 *
 * Modified to upload consecutive lightweight 1 MB chunks to prevent
 * CORS, memory limitations, or Cloudflare Worker timeout/payload errors.
 */
export async function measureUpload(
  durationOrSize = 2000,
  onProgress?: (mbps: number) => void,
): Promise<ThroughputResult> {
  const durationMs = durationOrSize > 100_000 ? 2000 : durationOrSize;
  const start = performance.now();
  const loadedPerStream = new Array(NUM_STREAMS).fill(0);
  let allDone = false;
  const xhrList: XMLHttpRequest[] = [];

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

  // Set timeout to abort the XHR uploads after durationMs
  const timeoutId = setTimeout(() => {
    xhrList.forEach(xhr => {
      try { xhr.abort(); } catch { /* ignore */ }
    });
  }, durationMs);

  try {
    const streamPromises = Array.from({ length: NUM_STREAMS }, (_, i) => {
      return new Promise<void>(async (resolve) => {
        while (!allDone) {
          try {
            const perStream = 1 * 1024 * 1024; // 1 MB chunk
            const offset = (i * perStream) % (MAX_UPLOAD_BYTES - perStream);
            const slice = _uploadBuffer.subarray(offset, offset + perStream);
            const blob = new Blob([slice], { type: 'application/octet-stream' });

            const xhr = new XMLHttpRequest();
            xhrList.push(xhr);

            const xhrPromise = new Promise<void>((xhrResolve) => {
              xhr.open('POST', `${API.up}?t=${Date.now()}&s=${i}`, true);
              xhr.setRequestHeader('Content-Type', 'application/octet-stream');
              xhr.timeout = 10_000;

              let lastLoaded = 0;
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && !allDone) {
                  const delta = e.loaded - lastLoaded;
                  loadedPerStream[i] += delta;
                  lastLoaded = e.loaded;
                }
              };

              xhr.onload = () => {
                xhrResolve();
              };
              xhr.onerror = () => xhrResolve();
              xhr.ontimeout = () => xhrResolve();
              xhr.onabort = () => xhrResolve();

              xhr.send(blob);
            });

            await xhrPromise;
          } catch {
            break;
          }
        }
        resolve();
      });
    });

    await Promise.all(streamPromises);
  } finally {
    allDone = true;
    clearTimeout(timeoutId);
    clearInterval(progressInterval);
  }

  const durationMsActual = performance.now() - start;
  const totalSent = loadedPerStream.reduce((a, b) => a + b, 0);
  const mbps = durationMsActual > 0
    ? (totalSent * 8) / (durationMsActual / 1000) / 1_000_000
    : 0;

  onProgress?.(mbps);

  return { mbps: Math.max(0, mbps), durationMs: durationMsActual, bytes: totalSent };
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
