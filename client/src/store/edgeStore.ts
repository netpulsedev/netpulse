// Stores the Cloudflare edge region info fetched from /api/health.
// Updated once when monitoring starts, and periodically if you want.

import { create } from 'zustand';

interface EdgeState {
  colo: string;      // e.g. "BOM"
  region: string;    // e.g. "Asia Pacific"
  country: string;   // e.g. "IN"
  version: string;   // Worker version
  loaded: boolean;   // Have we fetched at least once?
  setColo: (colo: string, region: string, country: string, version: string) => void;
  reset: () => void;
}

export const useEdgeStore = create<EdgeState>((set) => ({
  colo: '',
  region: '',
  country: '',
  version: '',
  loaded: false,
  setColo: (colo, region, country, version) =>
    set({ colo, region, country, version, loaded: true }),
  reset: () =>
    set({ colo: '', region: '', country: '', version: '', loaded: false }),
}));
