/**
 * NetPulse Cloudflare Worker
 *
 * This is the backend API for NetPulse. Every time the browser
 * needs to test download speed, upload speed, or ping — it comes here.
 * The browser never talks to any third-party service directly.
 *
 * Routes:
 *   GET  /api/ping    → tiny latency check
 *   GET  /api/down    → streams random bytes back to measure download speed
 *   POST /api/up      → accepts upload bytes to measure upload speed
 *   GET  /api/health  → basic health check, returns your Cloudflare region
 */

export interface Env {
  // Nothing here yet. When we add analytics (KV or D1), bindings go here.
}

// These go on every response so the browser doesn't get blocked by CORS.
// In production you can tighten this to just your Pages domain if you want.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
  'Access-Control-Max-Age': '86400',
} as const;

// We never want any caching on test responses — stale data would totally
// break the measurements.
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
} as const;

// Builds a Response with CORS + no-cache headers baked in.
function corsResponse(body: string | ReadableStream | null, init: ResponseInit): Response {
  const headers = new Headers(init.headers ?? {});
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) headers.set(k, v);
  return new Response(body, { ...init, headers });
}

// Shorthand for JSON responses.
function json(data: unknown, status = 200): Response {
  return corsResponse(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/ping
 *
 * As lightweight as possible. The browser hits this repeatedly
 * to measure round-trip time. We also return which Cloudflare
 * datacenter (colo) you're talking to, which is handy for debugging
 * and future multi-region support.
 */
async function handlePing(request: Request): Promise<Response> {
  const cf = request.cf as Record<string, string> | undefined;
  return json({
    ok: true,
    ts: Date.now(),
    region: cf?.region ?? 'unknown',
    colo: cf?.colo ?? 'unknown',
  });
}

/**
 * GET /api/down?bytes=5000000
 *
 * Streams the requested number of bytes back to the browser.
 * The browser times how long this takes to calculate download speed.
 *
 * Max is 20MB. We stream in 64KB chunks so memory stays flat —
 * no huge allocation, just a small reusable chunk looped.
 */
async function handleDown(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap
  const DEFAULT_BYTES = 1 * 1024 * 1024; // 1 MB if nothing is specified
  const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk

  const requested = parseInt(url.searchParams.get('bytes') ?? '0', 10);
  const totalBytes = Math.max(1, Math.min(MAX_BYTES, requested || DEFAULT_BYTES));

  // One reusable zeroed chunk — we just write it over and over.
  const chunk = new Uint8Array(CHUNK_SIZE);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Start streaming immediately so the browser sees bytes right away.
  (async () => {
    let remaining = totalBytes;
    while (remaining > 0) {
      const size = Math.min(CHUNK_SIZE, remaining);
      await writer.write(size === CHUNK_SIZE ? chunk : chunk.subarray(0, size));
      remaining -= size;
    }
    await writer.close();
  })();

  return corsResponse(readable, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(totalBytes),
      'X-Netpulse-Bytes': String(totalBytes),
      'X-Netpulse-Timestamp': String(Date.now()),
    },
  });
}

/**
 * POST /api/up
 *
 * The browser sends a blob of bytes here during the upload test.
 * We drain the whole body so the timing is accurate, then return
 * how many bytes we received along with the edge region.
 */
async function handleUp(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method Not Allowed' }, 405);
  }

  const cf = request.cf as Record<string, string> | undefined;
  let received = 0;

  if (request.body) {
    const reader = request.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value?.byteLength ?? 0;
    }
  }

  return json({
    ok: true,
    received,
    ts: Date.now(),
    region: cf?.region ?? 'unknown',
    colo: cf?.colo ?? 'unknown',
  });
}

/**
 * GET /api/health
 *
 * Simple health check. Returns the Cloudflare edge location
 * so you can confirm the worker is deployed and see which colo
 * is handling your requests.
 */
async function handleHealth(request: Request): Promise<Response> {
  const cf = request.cf as Record<string, string> | undefined;
  return json({
    ok: true,
    ts: Date.now(),
    region: cf?.region ?? 'unknown',
    colo: cf?.colo ?? 'unknown',
    country: cf?.country ?? 'unknown',
    version: '1.0.0',
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    // CORS preflight — browsers send this before cross-origin requests.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (pathname === '/api/ping')   return handlePing(request);
    if (pathname === '/api/down')   return handleDown(request);
    if (pathname === '/api/up')     return handleUp(request);
    if (pathname === '/api/health') return handleHealth(request);

    return json({ ok: false, error: 'Not Found', path: pathname }, 404);
  },
};
