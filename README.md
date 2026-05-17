<p align="center">
  <img src="https://img.shields.io/badge/NetPulse-v2.0-22d3ee?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyMmQzZWUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSIyMiAxMiAxOCA2IDE0IDEyIDEwIDYgNiAxMiAyIDE4Ii8+PC9zdmc+" alt="NetPulse" />
  <img src="https://img.shields.io/github/license/netpulsedev/netpulse?style=for-the-badge&color=34d399" alt="License" />
  <img src="https://img.shields.io/badge/Cloudflare-Workers-f38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/github/stars/netpulsedev/netpulse?style=for-the-badge&color=fbbf24" alt="Stars" />
</p>

<h1 align="center">⚡ NetPulse</h1>

<p align="center">
  <strong>Continuous internet diagnostics that run entirely in your browser.</strong><br/>
  Multi-connection speed tests · Real-time latency tracking · Stability scoring · WiFi alignment
</p>

<p align="center">
  <a href="https://netpulse.eu.cc"><strong>🌐 Live Demo →</strong></a>
</p>

---

## 🎯 What is NetPulse?

NetPulse is an **open-source, browser-based network diagnostics tool** — like Speedtest, but it runs continuously and gives you a live dashboard of your connection health.

Unlike one-shot speed tests, NetPulse **monitors your connection over time**, detecting latency spikes, throughput drops, jitter instability, and packet loss in real time. It runs entirely client-side (no login, no tracking, no data collection) with measurements routed through your own Cloudflare Worker.

## ⚡ Quick Start

```bash
# Clone the repo
git clone https://github.com/netpulsedev/netpulse.git
cd netpulse

# Start the Worker (API backend)
cd worker && npm install && npm run dev

# Start the Frontend (in another terminal)
cd client && npm install && npm run dev
```

Open **http://localhost:5173** → Click **Start** → Watch your network in real time.

Or just visit the **[live demo](https://netpulse.eu.cc)** — no install needed.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏎️ **Multi-Connection Speed Test** | 4 parallel streams (like Ookla) for accurate download & upload measurement |
| 📊 **Live Dashboard** | Dual speedometer gauges, animated charts, 60s rolling history |
| 🏓 **Latency Analysis** | HTTP ping, jitter calculation, bufferbloat-aware measurement |
| 📈 **Stability Score** | Weighted composite score (0–100) combining all metrics |
| 🎯 **Test Mode Selector** | Choose Download only, Upload only, or Both |
| 🛡️ **Packet Loss Detection** | Estimated from heartbeat failures |
| 🗺️ **Edge Region Display** | Shows which Cloudflare datacenter you're connected to |
| 📱 **Alignment Mode** | Fullscreen high-contrast view for router placement & dead-zone hunting |
| 💾 **Session Persistence** | Auto-saves to IndexedDB, viewable across page reloads |
| 📤 **Multi-Format Export** | Export as TXT (human-readable report), CSV (spreadsheet), or JSON (programmatic) |
| ☕ **Wake Lock** | Keeps screen active during long monitoring sessions |
| 🔒 **Privacy-First** | Zero tracking, no accounts, all data stays in your browser |

---

## 🏗️ Architecture

```
Browser (React SPA on Cloudflare Pages)
    │
    │  /api/ping, /api/down, /api/up, /api/health
    ▼
Cloudflare Worker (netpulse-worker)
    │
    │  Streams payload / echoes upload / returns edge metadata
    ▼
Cloudflare Edge Network (300+ locations)
```

The frontend never calls third-party endpoints. All measurements go through your own Worker, giving you full control over the measurement infrastructure.

---

## 📐 Measurement Methodology

| Metric | How it works |
|--------|-------------|
| **Download** | 4 parallel `fetch()` streams from `/api/down`, aggregate throughput measured via `ReadableStream` |
| **Upload** | 4 parallel XHR POSTs to `/api/up` with pre-allocated buffer, tracked via `upload.onprogress` |
| **Ping** | HTTP round-trip to `/api/ping` — measured only between throughput tests to avoid bufferbloat inflation |
| **Jitter** | Mean absolute difference between consecutive pings (10-sample sliding window) |
| **Packet Loss** | Failed/timed-out heartbeat ratio (HTTP approximation, not ICMP) |
| **Stability** | Weighted composite: Download 35% · Upload 15% · Ping 25% · Jitter 15% · Packet Loss 10% |

### ⚠️ Limitations

- Ping is HTTP-based, not ICMP — includes TLS handshake overhead
- Packet loss is estimated from HTTP failures, not measured at the network layer
- Throughput depends on distance to Cloudflare edge — a nearby PoP gives better results
- Browser-based measurements differ from native/system-level diagnostics

---

## 📁 Project Structure

```
netpulse/
├── client/                       React SPA (Cloudflare Pages)
│   ├── src/
│   │   ├── config/api.ts         API endpoint URLs
│   │   ├── services/             Throughput, heartbeat, session storage
│   │   ├── hooks/                Diagnostics loop, utilities
│   │   ├── store/                Zustand state (metrics, edge info, events)
│   │   ├── utils/                Stability algorithm, classifiers, trends
│   │   ├── components/           Charts, gauges, dashboard panels
│   │   └── pages/                HomePage, DashboardPage
│   └── vite.config.ts            Dev proxy: /api/* → localhost:8787
│
├── worker/                       Cloudflare Worker (API backend)
│   ├── src/index.ts              Route handlers
│   └── wrangler.toml             Worker config
│
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── LICENSE                       MIT
└── README.md
```

---

## 🔌 Worker API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/ping` | GET | Lightweight latency probe → `{ ok, ts, region, colo }` |
| `/api/down?bytes=N` | GET | Streams N bytes (max 20 MB) for download testing |
| `/api/up` | POST | Receives upload payload → `{ ok, received, ts, region, colo }` |
| `/api/health` | GET | Worker health + edge metadata |

All routes return CORS headers and `Cache-Control: no-store`.

---

## 🚀 Deployment

### Deploy the Worker
```bash
cd worker
npx wrangler login
npm run deploy:production
```

### Deploy the Frontend
```bash
cd client
npm run build
# Upload dist/ to Cloudflare Pages, or connect your GitHub repo for auto-deploy
```

### Connect Worker ↔ Pages
In Cloudflare Dashboard: **Pages → Settings → Functions → Service Bindings** → add `NETPULSE_API` → `netpulse-worker-production`

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS v4, Zustand, Recharts, Framer Motion, Lucide |
| **Backend** | Cloudflare Workers (TypeScript), Wrangler CLI |
| **Storage** | IndexedDB (local-first, no server-side data) |
| **Deployment** | Cloudflare Pages + Workers (edge-native) |

---

## 🗺️ Roadmap

- [ ] Multi-region Worker nodes with automatic nearest-node selection
- [ ] Cloud session sync (Cloudflare D1 / KV)
- [ ] Network quality heatmaps
- [ ] LAN diagnostics
- [ ] PWA support with offline mode
- [ ] Native mobile & desktop apps

---

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) before opening a pull request.

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with ☕ by <a href="https://github.com/netpulsedev">netpulsedev</a></sub>
</p>
