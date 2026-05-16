const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
  pingInterval: 2000,
  pingTimeout: 5000,
});

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(compression());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ─── Session Store ───────────────────────────────────────────────────────────
const sessions = new Map();

// ─── Random Data Endpoint (Download Test) ────────────────────────────────────
app.get('/api/download', (req, res) => {
  const size = parseInt(req.query.size) || 1024 * 1024; // default 1MB
  const safeSize = Math.min(size, 20 * 1024 * 1024); // cap at 20MB

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', safeSize);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const chunkSize = 65536; // 64KB chunks
  let sent = 0;

  function writeChunk() {
    while (sent < safeSize) {
      const remaining = safeSize - sent;
      const currentChunk = Math.min(chunkSize, remaining);
      const chunk = Buffer.allocUnsafe(currentChunk);
      // Fill with pseudo-random-ish data to prevent compression
      for (let i = 0; i < currentChunk; i++) {
        chunk[i] = (Math.random() * 256) | 0;
      }
      sent += currentChunk;

      if (!res.write(chunk)) {
        res.once('drain', writeChunk);
        return;
      }
    }
    res.end();
  }

  writeChunk();
});

// ─── Upload Endpoint ─────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('data'), (req, res) => {
  const received = req.file ? req.file.size : (req.body ? JSON.stringify(req.body).length : 0);
  res.json({ ok: true, received });
});

// ─── Ping Endpoint (HTTP fallback) ───────────────────────────────────────────
app.get('/api/ping', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ t: Date.now() });
});

// ─── Session Analytics ────────────────────────────────────────────────────────
app.get('/api/session/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// ─── WebSocket Logic ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    connectedAt: Date.now(),
    metrics: [],
    socketId: socket.id,
  };
  sessions.set(sessionId, session);

  socket.emit('session:init', { sessionId, serverTime: Date.now() });

  // Heartbeat ping/pong for latency measurement
  socket.on('heartbeat', (data) => {
    socket.emit('heartbeat:ack', {
      clientTime: data.clientTime,
      serverTime: Date.now(),
    });
  });

  // Store metric snapshot
  socket.on('metrics:update', (data) => {
    if (session.metrics.length > 3600) {
      session.metrics.shift(); // Rolling 1hr window
    }
    session.metrics.push({ ...data, ts: Date.now() });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
    // Keep session data for export
    const s = sessions.get(sessionId);
    if (s) {
      s.disconnectedAt = Date.now();
    }
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 NetPulse Server running on http://localhost:${PORT}`);
  console.log(`   WebSocket ready for connections`);
  console.log(`   Download endpoint: GET /api/download?size=<bytes>`);
  console.log(`   Upload endpoint:   POST /api/upload`);
  console.log(`   Ping endpoint:     GET /api/ping\n`);
});
