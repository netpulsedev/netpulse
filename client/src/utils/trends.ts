// Trend analysis for the stability score.
// Compares short-term vs long-term moving averages to detect
// whether the connection is improving, degrading, or stable.
// Also detects sudden spikes.

import type { MetricSnapshot } from '../store/networkStore';

export type TrendDirection = 'improving' | 'stable' | 'degrading' | 'unstable';

interface TrendResult {
  direction: TrendDirection;
  shortTermAvg: number;
  longTermAvg: number;
  spikeDetected: boolean;
}

// Compute average of an array of numbers.
function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Standard deviation — used for spike detection.
function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = avg(nums);
  const variance = nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

export function analyzeTrend(history: MetricSnapshot[]): TrendResult {
  // Need at least 10 samples to say anything meaningful.
  if (history.length < 10) {
    return { direction: 'stable', shortTermAvg: 0, longTermAvg: 0, spikeDetected: false };
  }

  const scores = history.map(h => h.stability);

  // Short-term: last 10 samples. Long-term: last 30 (or whatever we have).
  const shortWindow = scores.slice(-10);
  const longWindow = scores.slice(-30);

  const shortAvg = avg(shortWindow);
  const longAvg = avg(longWindow);

  // Spike detection: if the latest score is more than 2 standard deviations
  // away from the long-term average, something weird is happening.
  const sd = stdDev(longWindow);
  const latest = scores[scores.length - 1];
  const spikeDetected = sd > 0 && Math.abs(latest - longAvg) > sd * 2;

  // Figure out the trend direction.
  const diff = shortAvg - longAvg;

  let direction: TrendDirection;
  if (spikeDetected && sd > 10) {
    // High variance + spike = unstable
    direction = 'unstable';
  } else if (diff > 5) {
    direction = 'improving';
  } else if (diff < -5) {
    direction = 'degrading';
  } else {
    direction = 'stable';
  }

  return {
    direction,
    shortTermAvg: Math.round(shortAvg),
    longTermAvg: Math.round(longAvg),
    spikeDetected,
  };
}

export function getTrendColor(dir: TrendDirection): string {
  switch (dir) {
    case 'improving': return '#00FF95';
    case 'stable':    return '#00E5FF';
    case 'degrading': return '#FFD600';
    case 'unstable':  return '#FF1744';
  }
}

export function getTrendLabel(dir: TrendDirection): string {
  switch (dir) {
    case 'improving': return 'Improving';
    case 'stable':    return 'Stable';
    case 'degrading': return 'Degrading';
    case 'unstable':  return 'Unstable';
  }
}
