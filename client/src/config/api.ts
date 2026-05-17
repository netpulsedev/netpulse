/**
 * All API endpoint URLs live here. This is the only place you
 * ever need to change if the Worker URL or routes shift.
 *
 * In development: Vite proxies /api/* to localhost:8787 (wrangler dev),
 * so relative URLs work fine and there's no CORS to worry about.
 *
 * In production on Cloudflare Pages: the Worker is bound to the
 * same domain, so /api/* routes there automatically.
 *
 * If you want to point at a remote Worker during dev instead of
 * running one locally, set VITE_API_BASE in your .env.local:
 *   VITE_API_BASE=https://netpulse-worker.yourname.workers.dev
 */

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export const API = {
  ping:   `${API_BASE}/api/ping`,
  down:   `${API_BASE}/api/down`,
  up:     `${API_BASE}/api/up`,
  health: `${API_BASE}/api/health`,
} as const;
