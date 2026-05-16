import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../store/networkStore';

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs border-none" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}{unit}
        </div>
      ))}
    </div>
  );
}

// ─── Chart Panel Wrapper ──────────────────────────────────────────────────────
function ChartPanel({ title, children, accentColor = '#00E5FF', id }: {
  title: string;
  children: React.ReactNode;
  accentColor?: string;
  id: string;
}) {
  return (
    <motion.div
      id={id}
      className="glass-card p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(240,244,255,0.7)' }}>{title}</h3>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accentColor}30, transparent)` }} />
      </div>
      <div className="h-40">{children}</div>
    </motion.div>
  );
}

// ─── Throughput Chart ─────────────────────────────────────────────────────────
export function ThroughputChart() {
  const history = useNetworkStore((s) => s.history);

  const data = useMemo(() =>
    history.map((h, i) => ({
      t: i,
      download: +h.download.toFixed(2),
      upload: +h.upload.toFixed(2),
    })),
  [history]);

  return (
    <ChartPanel title="Throughput" accentColor="#00E5FF" id="chart-throughput">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradDl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00E5FF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradUl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7C4DFF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#7C4DFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="t" hide />
          <YAxis tick={{ fill: 'rgba(240,244,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} unit=" M" />
          <Tooltip content={<CustomTooltip unit=" Mbps" />} />
          <Area
            type="monotone" dataKey="download" name="↓ DL" stroke="#00E5FF" strokeWidth={2}
            fill="url(#gradDl)" dot={false} isAnimationActive={false}
          />
          <Area
            type="monotone" dataKey="upload" name="↑ UL" stroke="#7C4DFF" strokeWidth={2}
            fill="url(#gradUl)" dot={false} isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// ─── Ping Chart ───────────────────────────────────────────────────────────────
export function PingChart() {
  const history = useNetworkStore((s) => s.history);

  const data = useMemo(() =>
    history.map((h, i) => ({
      t: i,
      ping: h.ping,
      jitter: +h.jitter.toFixed(1),
    })),
  [history]);

  return (
    <ChartPanel title="Latency & Jitter" accentColor="#00FF95" id="chart-ping">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="t" hide />
          <YAxis tick={{ fill: 'rgba(240,244,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} unit="ms" />
          <Tooltip content={<CustomTooltip unit="ms" />} />
          <ReferenceLine y={30} stroke="#FFD60030" strokeDasharray="4 4" />
          <ReferenceLine y={80} stroke="#FF174430" strokeDasharray="4 4" />
          <Line
            type="monotone" dataKey="ping" name="Ping" stroke="#00FF95" strokeWidth={2}
            dot={false} isAnimationActive={false}
          />
          <Line
            type="monotone" dataKey="jitter" name="Jitter" stroke="#FFD600" strokeWidth={1.5}
            strokeDasharray="4 2" dot={false} isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

// ─── Stability Chart ──────────────────────────────────────────────────────────
export function StabilityChart() {
  const history = useNetworkStore((s) => s.history);

  const data = useMemo(() =>
    history.map((h, i) => ({
      t: i,
      stability: h.stability,
      packetLoss: h.packetLoss,
    })),
  [history]);

  return (
    <ChartPanel title="Stability & Packet Loss" accentColor="#7C4DFF" id="chart-stability">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradStab" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7C4DFF" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#7C4DFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="t" hide />
          <YAxis tick={{ fill: 'rgba(240,244,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip content={<CustomTooltip unit="" />} />
          <ReferenceLine y={81} stroke="#00FF9520" strokeDasharray="4 4" />
          <ReferenceLine y={66} stroke="#00E5FF20" strokeDasharray="4 4" />
          <ReferenceLine y={41} stroke="#FFD60020" strokeDasharray="4 4" />
          <Area
            type="monotone" dataKey="stability" name="Score" stroke="#7C4DFF" strokeWidth={2}
            fill="url(#gradStab)" dot={false} isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
