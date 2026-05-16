import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUp, Activity, Zap, Wifi, Shield } from 'lucide-react';
import { useNetworkStore } from '../../store/networkStore';
import { getQualityColor } from '../../utils/stability';

interface MetricCardProps {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  subtext?: string;
}

function MetricCard({ id, label, value, unit, icon, color, subtext }: MetricCardProps) {
  const prevRef = useRef(value);
  const changed = prevRef.current !== value;
  useEffect(() => { prevRef.current = value; }, [value]);

  return (
    <motion.div
      id={id}
      className="glass-card glass-card-hover relative overflow-hidden flex flex-col gap-2"
      style={{ padding: 'clamp(12px, 2vw, 20px)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      {/* Background glow blob */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 blur-2xl pointer-events-none"
        style={{ background: color }}
      />

      {/* Label + icon row */}
      <div className="flex items-center justify-between">
        <span
          className="font-semibold uppercase tracking-widest truncate"
          style={{ fontSize: '0.6rem', color: 'rgba(240,244,255,0.45)' }}
        >
          {label}
        </span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ml-1"
          style={{ background: `${color}15`, border: `1px solid ${color}28` }}
        >
          <span style={{ color, display: 'flex' }}>{icon}</span>
        </div>
      </div>

      {/* Value + unit */}
      <div className="flex items-end gap-1.5 min-w-0">
        <AnimatePresence mode="wait">
          <motion.span
            key={String(value)}
            className="metric-value font-black leading-none truncate"
            style={{
              fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)',
              color,
              textShadow: `0 0 20px ${color}50`,
            }}
            initial={changed ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
        {unit && (
          <span
            className="font-medium flex-shrink-0 pb-0.5"
            style={{ fontSize: '0.7rem', color: 'rgba(240,244,255,0.35)' }}
          >
            {unit}
          </span>
        )}
      </div>

      {subtext && (
        <p style={{ fontSize: '0.68rem', color: 'rgba(240,244,255,0.35)' }}>{subtext}</p>
      )}
    </motion.div>
  );
}

function getSpeedDisplay(mbps: number): { value: string; unit: string } {
  if (mbps === 0) return { value: '0', unit: 'Mbps' };
  if (mbps >= 1000) return { value: (mbps / 1000).toFixed(2), unit: 'Gbps' };
  if (mbps < 1) return { value: (mbps * 1000).toFixed(0), unit: 'Kbps' };
  return { value: mbps.toFixed(1), unit: 'Mbps' };
}

export function MetricsGrid() {
  const { download, upload, ping, jitter, packetLoss, stability, isMonitoring } = useNetworkStore();
  const qualityColor = getQualityColor(stability);
  const idle = !isMonitoring;

  const dl = getSpeedDisplay(download);
  const ul = getSpeedDisplay(upload);

  const pingColor = ping > 0
    ? (ping < 30 ? '#00FF95' : ping < 80 ? '#FFD600' : '#FF1744')
    : '#00E5FF';
  const jitterColor = jitter > 20 ? '#FF1744' : jitter > 8 ? '#FFD600' : '#00FF95';
  const plColor = packetLoss > 2 ? '#FF1744' : packetLoss > 0.5 ? '#FFD600' : '#00FF95';

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
      <MetricCard
        id="metric-download"
        label="Download"
        value={idle ? '—' : dl.value}
        unit={idle ? undefined : dl.unit}
        icon={<ArrowDown size={14} />}
        color="#00E5FF"
        subtext="↓ Throughput"
      />
      <MetricCard
        id="metric-upload"
        label="Upload"
        value={idle ? '—' : ul.value}
        unit={idle ? undefined : ul.unit}
        icon={<ArrowUp size={14} />}
        color="#7C4DFF"
        subtext="↑ Throughput"
      />
      <MetricCard
        id="metric-ping"
        label="Ping"
        value={idle ? '—' : ping > 0 ? String(Math.round(ping)) : '0'}
        unit={idle ? undefined : 'ms'}
        icon={<Activity size={14} />}
        color={idle ? '#00E5FF' : pingColor}
        subtext="Latency"
      />
      <MetricCard
        id="metric-jitter"
        label="Jitter"
        value={idle ? '—' : jitter.toFixed(1)}
        unit={idle ? undefined : 'ms'}
        icon={<Zap size={14} />}
        color={idle ? '#7C4DFF' : jitterColor}
        subtext="Variance"
      />
      <MetricCard
        id="metric-packetloss"
        label="Pkt Loss"
        value={idle ? '—' : packetLoss.toFixed(1)}
        unit={idle ? undefined : '%'}
        icon={<Wifi size={14} />}
        color={idle ? '#00FF95' : plColor}
        subtext="Lost pkts"
      />
      <MetricCard
        id="metric-stability"
        label="Stability"
        value={idle ? '—' : stability}
        unit={idle ? undefined : '/100'}
        icon={<Shield size={14} />}
        color={idle ? '#7C4DFF' : qualityColor}
        subtext={
          idle ? 'Idle'
          : stability >= 81 ? 'Excellent'
          : stability >= 66 ? 'Good'
          : stability >= 41 ? 'Fair'
          : 'Poor'
        }
      />
    </div>
  );
}
