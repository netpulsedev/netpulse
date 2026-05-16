/**
 * Stability Score Formula
 * 
 * Score = throughput_score + ping_score + jitter_penalty + packet_loss_penalty
 * Weights: Download 35%, Upload 15%, Ping 25%, Jitter 15%, Packet Loss 10%
 * 
 * 0–40   Poor
 * 41–65  Fair
 * 66–80  Good
 * 81–100 Excellent
 */

const WEIGHTS = {
  download: 0.35,
  upload: 0.15,
  ping: 0.25,
  jitter: 0.15,
  packetLoss: 0.10,
};

// Reference thresholds
const DOWNLOAD_EXCELLENT = 200;  // Mbps
const UPLOAD_EXCELLENT = 50;
const PING_EXCELLENT = 10;       // ms
const PING_TERRIBLE = 300;
const JITTER_EXCELLENT = 2;      // ms
const JITTER_TERRIBLE = 100;
const PACKET_LOSS_NONE = 0;      // %
const PACKET_LOSS_TERRIBLE = 5;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function calculateStability(
  download: number,
  upload: number,
  ping: number,
  jitter: number,
  packetLoss: number
): number {
  // Throughput scores (log scale feels more natural for speed)
  const dlScore = download > 0
    ? clamp(Math.log10(download + 1) / Math.log10(DOWNLOAD_EXCELLENT + 1), 0, 1)
    : 0;

  const ulScore = upload > 0
    ? clamp(Math.log10(upload + 1) / Math.log10(UPLOAD_EXCELLENT + 1), 0, 1)
    : 0;

  // Ping score: lower is better
  const pingScore = ping > 0
    ? clamp(1 - (ping - PING_EXCELLENT) / (PING_TERRIBLE - PING_EXCELLENT), 0, 1)
    : 1;

  // Jitter score: lower is better
  const jitterScore = clamp(
    1 - (jitter - JITTER_EXCELLENT) / (JITTER_TERRIBLE - JITTER_EXCELLENT),
    0,
    1
  );

  // Packet loss score: lower is better (exponential penalty)
  const plScore = clamp(
    1 - (packetLoss / PACKET_LOSS_TERRIBLE) ** 0.5,
    0,
    1
  );

  const raw =
    dlScore * WEIGHTS.download +
    ulScore * WEIGHTS.upload +
    pingScore * WEIGHTS.ping +
    jitterScore * WEIGHTS.jitter +
    plScore * WEIGHTS.packetLoss;

  return Math.round(clamp(raw * 100, 0, 100));
}

export function getQualityLabel(score: number): string {
  if (score >= 81) return 'Excellent';
  if (score >= 66) return 'Good';
  if (score >= 41) return 'Fair';
  return 'Poor';
}

export function getQualityColor(score: number): string {
  if (score >= 81) return '#00FF95';
  if (score >= 66) return '#00E5FF';
  if (score >= 41) return '#FFD600';
  return '#FF1744';
}

export function getQualityKey(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 81) return 'excellent';
  if (score >= 66) return 'good';
  if (score >= 41) return 'fair';
  return 'poor';
}

export function calcJitter(pings: number[]): number {
  if (pings.length < 2) return 0;
  const diffs = [];
  for (let i = 1; i < pings.length; i++) {
    diffs.push(Math.abs(pings[i] - pings[i - 1]));
  }
  return diffs.reduce((a, b) => a + b, 0) / diffs.length;
}

export function formatMbps(v: number): string {
  if (v === 0) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(2)} Gbps`;
  if (v < 1) return `${(v * 1000).toFixed(0)} Kbps`;
  return `${v.toFixed(1)}`;
}

export function formatMs(v: number): string {
  if (v === 0) return '—';
  return `${Math.round(v)}`;
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
