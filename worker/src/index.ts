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
  /** Comma-separated list of browser origins allowed to call the Worker. */
  CORS_ORIGINS?: string;
}

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024; // 20 MB cap
const DEFAULT_DOWNLOAD_BYTES = 1 * 1024 * 1024; // 1 MB if nothing is specified
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // per-request upload cap
const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk

const CORS_METHODS = 'GET, POST, OPTIONS';
const CORS_HEADERS = 'Content-Type, Cache-Control';

// We never want any caching on test responses — stale data would totally
// break the measurements.
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
} as const;

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://netpulse.eu.cc',
]);

function getAllowedOrigins(env: Env): Set<string> {
  const configuredOrigins = env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins?.length
    ? new Set(configuredOrigins)
    : DEFAULT_ALLOWED_ORIGINS;
}

function getAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;

  return getAllowedOrigins(env).has(origin) ? origin : null;
}

function isCorsOriginAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin');
  return !origin || getAllowedOrigin(request, env) !== null;
}

function applySharedHeaders(headers: Headers, request: Request, env: Env): void {
  const allowedOrigin = getAllowedOrigin(request, env);
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Vary', 'Origin');
  }

  for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) headers.set(k, v);
}

function preflightResponse(request: Request, env: Env): Response {
  const origin = request.headers.get('Origin');
  const allowedOrigin = getAllowedOrigin(request, env);

  if (origin && !allowedOrigin) {
    return new Response(null, { status: 403, headers: NO_CACHE_HEADERS });
  }

  const headers = new Headers(NO_CACHE_HEADERS);
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', CORS_METHODS);
  headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(null, { status: 204, headers });
}

function methodNotAllowed(request: Request, env: Env, allowed: string): Response {
  return json(request, env, { ok: false, error: 'Method Not Allowed' }, 405, {
    Allow: allowed,
  });
}

// Builds a Response with CORS + no-cache headers baked in.
function corsResponse(
  request: Request,
  env: Env,
  body: string | ReadableStream | null,
  init: ResponseInit,
): Response {
  const headers = new Headers(init.headers ?? {});
  applySharedHeaders(headers, request, env);
  return new Response(body, { ...init, headers });
}

// Shorthand for JSON responses.
function json(
  request: Request,
  env: Env,
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  return corsResponse(request, env, JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function parseRequestedBytes(request: Request): number {
  const url = new URL(request.url);
  const requested = Number.parseInt(url.searchParams.get('bytes') ?? '', 10);

  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_DOWNLOAD_BYTES;
  return Math.min(MAX_DOWNLOAD_BYTES, requested);
}

function getCfString(request: Request, key: string): string {
  const value = request.cf?.[key as keyof IncomingRequestCfProperties];
  return typeof value === 'string' ? value : 'unknown';
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
function handlePing(request: Request, env: Env): Response {
  if (request.method !== 'GET') return methodNotAllowed(request, env, 'GET, OPTIONS');

  return json(request, env, {
    ok: true,
    ts: Date.now(),
    region: getCfString(request, 'region'),
    colo: getCfString(request, 'colo'),
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
function handleDown(request: Request, env: Env): Response {
  if (request.method !== 'GET') return methodNotAllowed(request, env, 'GET, OPTIONS');

  const totalBytes = parseRequestedBytes(request);
  // One reusable zeroed chunk — we just write it over and over.
  const chunk = new Uint8Array(CHUNK_SIZE);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let remaining = totalBytes;

      while (remaining > 0) {
        const size = Math.min(CHUNK_SIZE, remaining);
        controller.enqueue(size === CHUNK_SIZE ? chunk : chunk.subarray(0, size));
        remaining -= size;
      }

      controller.close();
    },
  });

  return corsResponse(request, env, stream, {
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
async function handleUp(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(request, env, 'POST, OPTIONS');

  const contentLength = Number.parseInt(request.headers.get('Content-Length') ?? '', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    return json(request, env, {
      ok: false,
      error: 'Payload Too Large',
      maxBytes: MAX_UPLOAD_BYTES,
    }, 413);
  }

  let received = 0;

  if (request.body) {
    const reader = request.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        received += value?.byteLength ?? 0;
        if (received > MAX_UPLOAD_BYTES) {
          await reader.cancel('Upload payload exceeded NetPulse limit');
          return json(request, env, {
            ok: false,
            error: 'Payload Too Large',
            maxBytes: MAX_UPLOAD_BYTES,
          }, 413);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  return json(request, env, {
    ok: true,
    received,
    ts: Date.now(),
    region: getCfString(request, 'region'),
    colo: getCfString(request, 'colo'),
  });
}

/**
 * GET /api/health
 *
 * Simple health check. Returns the Cloudflare edge location
 * so you can confirm the worker is deployed and see which colo
 * is handling your requests.
 */
function handleHealth(request: Request, env: Env): Response {
  if (request.method !== 'GET') return methodNotAllowed(request, env, 'GET, OPTIONS');

  return json(request, env, {
    ok: true,
    ts: Date.now(),
    region: getCfString(request, 'region'),
    colo: getCfString(request, 'colo'),
    country: getCfString(request, 'country'),
    version: '1.0.0',
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    // CORS preflight — browsers send this before cross-origin requests.
    if (request.method === 'OPTIONS') return preflightResponse(request, env);

    if (!isCorsOriginAllowed(request, env)) {
      return json(request, env, { ok: false, error: 'Forbidden origin' }, 403);
    }

    if (pathname === '/api/ping')   return handlePing(request, env);
    if (pathname === '/api/down')   return handleDown(request, env);
    if (pathname === '/api/up')     return handleUp(request, env);
    if (pathname === '/api/health') return handleHealth(request, env);

    return json(request, env, { ok: false, error: 'Not Found', path: pathname }, 404);
  },
};
