# NetPulse

NetPulse is a real-time internet diagnostics dashboard for continuous network monitoring, router alignment, latency analysis, and WiFi optimization.

Unlike traditional speed test websites, NetPulse continuously measures your network quality and visualizes it through a live, responsive dashboard — making it easy to identify unstable connections, dead zones, latency spikes, and the optimal router placement.

---

## Architecture

```
Browser (React SPA on Cloudflare Pages)
    │
    │  /api/ping, /api/down, /api/up, /api/health
    ▼
Cloudflare Worker  (netpulse-worker)
    │
    │  Streams payload / echoes upload / returns edge metadata
    ▼
Cloudflare Edge Network
```

The frontend never calls third-party endpoints directly. All measurements go through the NetPulse Worker, which acts as a controlled API layer you fully own. Edge region metadata (colo, country) is surfaced in the dashboard so users can see which datacenter they're hitting.

---

## Features

- **Continuous Monitoring** — Download, upload, ping, jitter, packet loss, stability score
- **Live Dashboard** — Animated charts with 60-second rolling history, session analytics
- **Quality Classifications** — Human-readable labels on every metric (e.g. "12ms · Excellent", "Jitter: 2ms · Stable")
- **Stability Trend Analysis** — Detects whether the connection is improving, stable, degrading, or unstable using short-term vs long-term moving averages
- **Network Events Timeline** — Auto-generated rolling feed of network events (latency spikes, packet loss, throughput drops) with severity levels and timestamps
- **Edge Region Display** — Shows which Cloudflare datacenter you're connected to (e.g. "Mumbai (BOM)")
- **Session Persistence** — Completed sessions are saved locally to IndexedDB. Recent sessions show up on the dashboard across page reloads
- **Alignment Mode** — Fullscreen high-contrast view for router placement and WiFi dead-zone hunting
- **CSV Export** — Export session history
- **Wake Lock** — Keeps screen active during monitoring
- **Adaptive Payload Sizing** — Test sizes scale with connection speed
- **Transparency Notice** — Footer explains that browser-based measurements differ from system-level diagnostics

---

## Project Structure

```
netpulse/
├── client/                        React SPA (Cloudflare Pages)
│   ├── public/
│   │   └── _redirects             Pages routing (SPA fallback)
│   ├── src/
│   │   ├── config/
│   │   │   └── api.ts             All API endpoint URLs (single source of truth)
│   │   ├── services/
│   │   │   ├── heartbeatService.ts   HTTP latency poller (renamed from socketService)
│   │   │   ├── throughputService.ts  Download / upload measurement
│   │   │   └── sessionStorage.ts     IndexedDB session persistence
│   │   ├── hooks/
│   │   │   ├── useDiagnostics.ts     Main diagnostics loop + event detection
│   │   │   └── useUtils.ts           Export, fullscreen, elapsed time
│   │   ├── store/
│   │   │   ├── networkStore.ts       Zustand — live metrics + rolling history
│   │   │   ├── edgeStore.ts          Cloudflare edge region info
│   │   │   └── eventsStore.ts        Network events timeline + auto-detection
│   │   ├── utils/
│   │   │   ├── stability.ts          Stability score algorithm
│   │   │   ├── classify.ts           Quality labels for metrics
│   │   │   ├── trends.ts             Moving averages + trend detection
│   │   │   └── coloMap.ts            Cloudflare colo → city name mapping
│   │   ├── components/
│   │   │   ├── alignment/            Alignment mode (fullscreen WiFi optimizer)
│   │   │   ├── charts/               Recharts dashboard visualizations
│   │   │   ├── dashboard/
│   │   │   │   ├── ControlBar.tsx
│   │   │   │   ├── SessionSummary.tsx
│   │   │   │   ├── EventsTimeline.tsx  Network events feed
│   │   │   │   ├── EdgeRegionBadge.tsx Edge datacenter display
│   │   │   │   └── RecentSessions.tsx  Past sessions from IndexedDB
│   │   │   └── metrics/              MetricCard with quality labels
│   │   └── pages/
│   │       ├── HomePage.tsx
│   │       └── DashboardPage.tsx
│   ├── vite.config.ts             Dev proxy: /api/* → localhost:8787
│   └── package.json
│
├── worker/                        Cloudflare Worker (API backend)
│   ├── src/
│   │   └── index.ts               All route handlers
│   ├── wrangler.toml
│   ├── tsconfig.json
│   └── package.json
│
└── README.md
```

---

## Worker API

| Route | Method | Description |
|---|---|---|
| `/api/ping` | GET | Lightweight latency probe. Returns `{ ok, ts, region, colo }` |
| `/api/down?bytes=N` | GET | Streams N bytes (max 20MB) for download speed testing |
| `/api/up` | POST | Receives upload payload, returns `{ ok, received, ts, region, colo }` |
| `/api/health` | GET | Worker health + edge metadata `{ ok, ts, region, colo, country, version }` |

All routes return CORS headers and `Cache-Control: no-store`.

---

## Local Development

**Terminal 1 — Worker:**
```bash
cd worker
npm install
npm run dev
# Worker on http://localhost:8787
```

**Terminal 2 — Frontend:**
```bash
cd client
npm install
npm run dev
# App on http://localhost:5173, /api/* proxied to :8787
```

---

## Deployment

### Deploy the Worker
```bash
cd worker
npx wrangler login
npm run deploy:production
```

### Connect Worker to Pages
In Cloudflare Dashboard: Pages → Settings → Functions → Service bindings → add `NETPULSE_API` → `netpulse-worker-production`

### Deploy the Frontend
```bash
cd client
npm run build
# Upload dist/ to Cloudflare Pages
```

---

## Measurement Methodology

| Metric | How it works |
|---|---|
| **Download** | Streams bytes from `/api/down`, measures throughput via `ReadableStream` |
| **Upload** | Sends pre-allocated buffer to `/api/up` via XHR, tracks `upload.onprogress` |
| **Ping** | HTTP round-trip to `/api/ping` with `keepalive: true` |
| **Jitter** | Mean absolute difference between consecutive pings (10-sample window) |
| **Packet Loss** | Failed/timed-out ping ratio — approximation, not true ICMP loss |
| **Stability Score** | Weighted composite: DL 35%, UL 15%, Ping 25%, Jitter 15%, PL 10% |
| **Trend** | Short-term (10s) vs long-term (30s) moving average comparison |
| **Events** | Auto-detected from metric deltas: spikes, drops, recoveries |

### Limitations
- Ping is HTTP-based, not ICMP — includes keep-alive overhead on first request
- Packet loss is estimated from HTTP failures, not measured at the network layer
- Upload buffer is pre-allocated (5MB max) with partial randomization
- Single Cloudflare Anycast edge — no explicit regional node selection yet

---

## Tech Stack

**Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Zustand, Recharts, Framer Motion, Lucide React

**Backend:** Cloudflare Workers (TypeScript), Wrangler CLI

**Storage:** IndexedDB (local-first session persistence)

---

## Planned

- Multi-region Worker nodes with nearest-node auto-selection
- Cloud session sync (Cloudflare D1 / KV)
- Network heatmaps
- LAN diagnostics
- Native mobile and desktop apps

---

## License

MIT
