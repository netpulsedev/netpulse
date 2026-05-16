/**
 * Throughput measurement service
 * Uses fetch() with streaming reads for download and XHR blobs for upload.
 * Adaptive test sizes keep buffer bloat minimal.
 */

const API_BASE = 'https://speed.cloudflare.com';

interface ThroughputResult {
  mbps: number;
  durationMs: number;
  bytes: number;
}

/**
 * Download test — streams a known-size payload and measures time.
 */
export async function measureDownload(sizeBytes = 512 * 1024, onProgress?: (mbps: number) => void): Promise<ThroughputResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/__down?bytes=${sizeBytes}&t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok || !res.body) {
      throw new Error('Download endpoint unavailable');
    }

    const reader = res.body.getReader();
    let lastCallbackTime = start;
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value?.length ?? 0;
      
      const now = performance.now();
      if (now - lastCallbackTime > 100) {
        const duration = now - start;
        const mbps = (totalBytes * 8) / (duration / 1000) / 1_000_000;
        onProgress?.(mbps);
        lastCallbackTime = now;
      }
    }

    const durationMs = performance.now() - start;
    const mbps = (totalBytes * 8) / (durationMs / 1000) / 1_000_000;

    return { mbps: Math.max(0, mbps), durationMs, bytes: totalBytes };
  } catch {
    return { mbps: 0, durationMs: 0, bytes: 0 };
  }
}

/**
 * Upload test — sends a random blob and measures throughput.
 */
export async function measureUpload(sizeBytes = 256 * 1024, onProgress?: (mbps: number) => void): Promise<ThroughputResult> {
  const start = performance.now();
  return new Promise((resolve) => {
    try {
      const data = new Uint8Array(sizeBytes);
      crypto.getRandomValues(data.subarray(0, Math.min(sizeBytes, 65536)));
      const blob = new Blob([data]);
      const formData = new FormData();
      formData.append('data', blob, 'payload.bin');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/__up`, true);

      let lastCallbackTime = start;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const now = performance.now();
          if (now - lastCallbackTime > 100) {
            const duration = now - start;
            const mbps = (e.loaded * 8) / (duration / 1000) / 1_000_000;
            onProgress?.(mbps);
            lastCallbackTime = now;
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const durationMs = performance.now() - start;
          const mbps = (sizeBytes * 8) / (durationMs / 1000) / 1_000_000;
          resolve({ mbps: Math.max(0, mbps), durationMs, bytes: sizeBytes });
        } else {
          resolve({ mbps: 0, durationMs: 0, bytes: 0 });
        }
      };

      xhr.onerror = () => resolve({ mbps: 0, durationMs: 0, bytes: 0 });
      xhr.timeout = 15000;
      xhr.ontimeout = () => resolve({ mbps: 0, durationMs: 0, bytes: 0 });

      xhr.send(formData);
    } catch {
      resolve({ mbps: 0, durationMs: 0, bytes: 0 });
    }
  });
}

/**
 * HTTP ping fallback (used if WebSocket isn't connected)
 */
export async function httpPing(): Promise<number> {
  try {
    const start = performance.now();
    await fetch(`${API_BASE}/__down?bytes=0&t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    return Math.round(performance.now() - start);
  } catch {
    return 0;
  }
}

/**
 * Adaptive size selection based on recent speeds
 * Keeps test duration around 1-3s to avoid buffer bloat
 */
export function adaptiveDownloadSize(recentMbps: number): number {
  if (recentMbps === 0) return 512 * 1024;      // 512 KB default
  const targetDurationSec = 1.5;
  const bytes = (recentMbps * 1_000_000 * targetDurationSec) / 8;
  // Clamp between 256KB and 10MB
  return Math.max(256 * 1024, Math.min(10 * 1024 * 1024, bytes));
}

export function adaptiveUploadSize(recentMbps: number): number {
  if (recentMbps === 0) return 256 * 1024;
  const targetDurationSec = 1.0;
  const bytes = (recentMbps * 1_000_000 * targetDurationSec) / 8;
  return Math.max(128 * 1024, Math.min(5 * 1024 * 1024, bytes));
}
