/**
 * All API endpoint URLs live here. This is the only place you
 * ever need to change if the Worker URL or routes shift.
 *
 * In development: Vite proxies /api/* to localhost:8787 (wrangler dev),
 * so relative URLs work fine and there's no CORS to worry about.
 *
 * In production on Cloudflare Pages: set VITE_API_BASE to the Worker origin
 * if /api/* is not routed on the same domain.
 *   VITE_API_BASE=https://netpulse-worker.yourname.workers.dev
 */

function normalizeApiBase(value: unknown): string {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1'
      ? url.toString().replace(/\/+$/, '')
      : '';
  } catch {
    return '';
  }
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE);

export const API = {
  ping:   `${API_BASE}/api/ping`,
  down:   `${API_BASE}/api/down`,
  up:     `${API_BASE}/api/up`,
  health: `${API_BASE}/api/health`,
} as const;
