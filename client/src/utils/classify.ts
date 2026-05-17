// Human-readable quality labels for individual metrics.
// These thresholds should match the stability scoring in stability.ts.

export function getPingLabel(ms: number): { text: string; color: string } {
  if (ms <= 0)  return { text: 'Waiting',   color: 'rgba(240,244,255,0.4)' };
  if (ms < 20)  return { text: 'Excellent',  color: '#00FF95' };
  if (ms < 50)  return { text: 'Good',       color: '#00E5FF' };
  if (ms < 100) return { text: 'Fair',       color: '#FFD600' };
  return               { text: 'Poor',       color: '#FF1744' };
}

export function getJitterLabel(ms: number): { text: string; color: string } {
  if (ms < 2)   return { text: 'Stable',     color: '#00FF95' };
  if (ms < 8)   return { text: 'Good',       color: '#00E5FF' };
  if (ms < 20)  return { text: 'Moderate',   color: '#FFD600' };
  return               { text: 'Unstable',   color: '#FF1744' };
}

export function getPacketLossLabel(pct: number): { text: string; color: string } {
  if (pct <= 0)  return { text: 'None',       color: '#00FF95' };
  if (pct < 0.5) return { text: 'Minimal',    color: '#00E5FF' };
  if (pct < 2)   return { text: 'Noticeable', color: '#FFD600' };
  return                { text: 'Severe',     color: '#FF1744' };
}

export function getStabilityLabel(score: number): { text: string; color: string } {
  if (score >= 81) return { text: 'Excellent', color: '#00FF95' };
  if (score >= 66) return { text: 'Good',      color: '#00E5FF' };
  if (score >= 41) return { text: 'Fair',      color: '#FFD600' };
  return                  { text: 'Poor',      color: '#FF1744' };
}
