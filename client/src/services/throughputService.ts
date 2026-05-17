/**
 * throughputService.ts
 *
 * Handles download and upload speed measurements.
 * All requests go to our own Worker (/api/down and /api/up),
 * never to any third-party service.
 *
 * The big change from the original:
 * The upload buffer is allocated once when this module loads, not
 * every time you run an upload test. The old approach was allocating
 * fresh megabytes every few seconds, which caused the browser's garbage
 * collector to kick in mid-test and stutter the UI. Now we just reuse
 * the same buffer with a zero-copy slice each time.
 */

import { API } from '../config/api';

export interface ThroughputResult {
  mbps: number;
  durationMs: number;
  bytes: number;
}

// ─── Upload Buffer (allocated once, reused forever) ───────────────────────────
//
// Max upload size is 5MB, so we allocate that once up front.
// We randomize the first 64KB so the payload isn't trivially compressible
// by any proxy. The rest stays zeroed — fine for throughput testing since
// we only care about byte count, not data content.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const _uploadBuffer = new Uint8Array(MAX_UPLOAD_BYTES);
crypto.getRandomValues(_uploadBuffer.subarray(0, Math.min(MAX_UPLOAD_BYTES, 65_536)));

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Requests a stream of bytes from /api/down and times how fast
 * they arrive. Fires the onProgress callback every ~100ms so the
 * UI can update the speed display in real time.
 */
export async function measureDownload(
  sizeBytes = 512 * 1024,
  onProgress?: (mbps: number) => void,
): Promise<ThroughputResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${API.down}?bytes=${sizeBytes}&t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Download endpoint returned ${res.status}`);
    }

    const reader = res.body.getReader();
    let totalBytes = 0;
    let lastCallbackTime = start;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value?.length ?? 0;

      const now = performance.now();
      if (now - lastCallbackTime > 100) {
        const duration = now - start;
        const mbps = (totalBytes * 8) / (duration / 1_000) / 1_000_000;
        onProgress?.(mbps);
        lastCallbackTime = now;
      }
    }

    const durationMs = performance.now() - start;
    const mbps = (totalBytes * 8) / (durationMs / 1_000) / 1_000_000;
    return { mbps: Math.max(0, mbps), durationMs, bytes: totalBytes };
  } catch {
    return { mbps: 0, durationMs: 0, bytes: 0 };
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Sends a slice of the pre-allocated buffer to /api/up via XHR.
 * We use XHR instead of fetch here because XHR gives us upload
 * progress events, which fetch still doesn't expose properly.
 *
 * The payload is sent as raw binary (application/octet-stream),
 * not as FormData, so there's no multipart encoding overhead
 * inflating the byte count.
 */
export async function measureUpload(
  sizeBytes = 256 * 1024,
  onProgress?: (mbps: number) => void,
): Promise<ThroughputResult> {
  // Never go above the pre-allocated buffer size — no new allocations.
  const actualSize = Math.min(sizeBytes, MAX_UPLOAD_BYTES);
  const payload = _uploadBuffer.subarray(0, actualSize); // zero-copy view
  const blob = new Blob([payload], { type: 'application/octet-stream' });

  const start = performance.now();

  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API.up}?t=${Date.now()}`, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = 15_000;

      let lastCallbackTime = start;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const now = performance.now();
          if (now - lastCallbackTime > 100) {
            const duration = now - start;
            const mbps = (e.loaded * 8) / (duration / 1_000) / 1_000_000;
            onProgress?.(mbps);
            lastCallbackTime = now;
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const durationMs = performance.now() - start;
          const mbps = (actualSize * 8) / (durationMs / 1_000) / 1_000_000;
          resolve({ mbps: Math.max(0, mbps), durationMs, bytes: actualSize });
        } else {
          resolve({ mbps: 0, durationMs: 0, bytes: 0 });
        }
      };

      xhr.onerror   = () => resolve({ mbps: 0, durationMs: 0, bytes: 0 });
      xhr.ontimeout = () => resolve({ mbps: 0, durationMs: 0, bytes: 0 });

      xhr.send(blob);
    } catch {
      resolve({ mbps: 0, durationMs: 0, bytes: 0 });
    }
  });
}

// ─── One-shot ping ────────────────────────────────────────────────────────────

/**
 * A single HTTP ping — used for quick health checks or the first
 * latency sample before the heartbeat loop takes over.
 */
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
 * Picks a download payload size that should take roughly 1.5 seconds
 * to complete at the current speed. This keeps tests responsive —
 * not too short (inaccurate) and not too long (slow to react to changes).
 */
export function adaptiveDownloadSize(recentMbps: number): number {
  if (recentMbps === 0) return 512 * 1024; // cold start: 512KB
  const bytes = (recentMbps * 1_000_000 * 1.5) / 8;
  return Math.max(256 * 1024, Math.min(10 * 1024 * 1024, bytes));
}

/**
 * Same idea for upload — targets about 1 second. Capped at MAX_UPLOAD_BYTES
 * so we never need to allocate a bigger buffer than what we have.
 */
export function adaptiveUploadSize(recentMbps: number): number {
  if (recentMbps === 0) return 256 * 1024; // cold start: 256KB
  const bytes = (recentMbps * 1_000_000 * 1.0) / 8;
  return Math.max(128 * 1024, Math.min(MAX_UPLOAD_BYTES, bytes));
}
