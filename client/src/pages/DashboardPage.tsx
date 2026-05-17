import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, Wifi, Zap, Gauge, Database,
  Play, Square, Maximize2, Moon,
} from 'lucide-react';
import { Speedometer } from '../components/metrics/Speedometer';
import { AnimatedNumber } from '../components/metrics/AnimatedNumber';
import { ThroughputChart, PingChart } from '../components/charts/Charts';
import { SessionSummary } from '../components/dashboard/SessionSummary';
import { AlignmentView } from '../components/alignment/AlignmentView';
import { EdgeRegionBadge } from '../components/dashboard/EdgeRegionBadge';
import { EventsTimeline } from '../components/dashboard/EventsTimeline';
import { RecentSessions } from '../components/dashboard/RecentSessions';
import { useNetworkStore } from '../store/networkStore';
import { useEdgeStore } from '../store/edgeStore';
import { useDiagnostics } from '../hooks/useDiagnostics';
import { getQualityColor, getQualityLabel, formatDuration } from '../utils/stability';
import { getPingLabel, getJitterLabel, getPacketLossLabel } from '../utils/classify';
import { useElapsedTime, useExport, useFullscreen } from '../hooks/useUtils';

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/* ─── Mini Stat Card ─────────────────────────────────────────────────────────── */

function StatCard({ label, value, unit, color, icon: Icon }: {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className="card p-4 flex-1 min-w-[140px]">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}12` }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <AnimatedNumber
          value={value}
          className="tabular-nums font-bold text-2xl"
          style={{ color: 'var(--text-1)' }}
        />
        {unit && (
          <span className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

/* ─── Dashboard Page ─────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const navigate = useNavigate();
  const [alignmentMode, setAlignmentMode] = useState(false);
  const {
    isMonitoring, testPhase, wakeLockActive, sessionStart,
    ping, jitter, packetLoss, stability, dataConsumed,
    history, analytics, testMode, setTestMode,
  } = useNetworkStore();
  const { startMonitoring, stopMonitoring } = useDiagnostics();
  const { exportCSV, exportTXT, exportJSON } = useExport();
  const { toggle: toggleFullscreen } = useFullscreen();
  const elapsed = useElapsedTime(sessionStart, isMonitoring);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAlignmentMode(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const idle = !isMonitoring;
  const pingClass = getPingLabel(ping);
  const jitterClass = getJitterLabel(jitter);
  const plClass = getPacketLossLabel(packetLoss);
  const qualityColor = getQualityColor(stability);
  const qualityLabel = getQualityLabel(stability);

  const phaseLabel = idle ? 'Ready'
    : testPhase === 'ping' ? 'Measuring latency'
    : testPhase === 'download' ? 'Testing download'
    : testPhase === 'upload' ? 'Testing upload'
    : 'Monitoring';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1400px] mx-auto px-5 h-14 flex items-center gap-5">
          <button
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
            style={{ color: 'var(--text-3)' }}
            onClick={() => navigate('/')}
          >
            <ArrowLeft size={14} />
          </button>

          <div className="flex items-center gap-2">
            <Activity size={16} style={{ color: 'var(--cyan)' }} />
            <span className="font-black text-sm tracking-widest">
              NET<span style={{ color: 'var(--text-3)' }}>PULSE</span>
            </span>
          </div>

          <div className="flex-1" />

          {/* Status pills */}
          <div className="flex items-center gap-3">
            {isMonitoring && (
              <span className="mono text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg-surface)', color: 'var(--text-2)' }}>
                {formatDuration(elapsed)}
              </span>
            )}
            {isMonitoring && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg"
                style={{ background: `${qualityColor}15`, color: qualityColor }}
              >
                {qualityLabel}
              </span>
            )}
            <EdgeRegionBadge />
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
              <div className={`status-dot ${isMonitoring ? 'active' : 'inactive'}`} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--text-3)' }}>
                {isMonitoring ? 'LIVE' : 'IDLE'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-5 py-6 flex flex-col gap-6">

        {/* Controls */}
        <div className="card px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`status-dot ${isMonitoring ? 'active' : 'inactive'}`} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
              {phaseLabel}
            </span>
            {wakeLockActive && (
              <div className="flex items-center gap-1 ml-2">
                <Moon size={11} style={{ color: 'var(--yellow)' }} />
                <span className="text-[10px] font-semibold" style={{ color: 'var(--yellow)' }}>Wake Lock</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Test Mode Toggle */}
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['download', 'both', 'upload'] as const).map((mode) => (
                <button
                  key={mode}
                  className="text-[11px] font-semibold px-3 py-1.5 transition-colors"
                  style={{
                    background: testMode === mode ? 'var(--bg-surface)' : 'transparent',
                    color: testMode === mode ? 'var(--text-1)' : 'var(--text-3)',
                  }}
                  onClick={() => setTestMode(mode)}
                  disabled={isMonitoring}
                  title={`Test ${mode === 'both' ? 'both' : mode + ' only'}`}
                >
                  {mode === 'download' ? '↓ DL' : mode === 'upload' ? '↑ UL' : 'Both'}
                </button>
              ))}
            </div>
            {/* Start / Stop */}
            <motion.button
              className="btn-primary flex items-center gap-2 px-5 py-2 text-sm font-bold"
              style={isMonitoring ? { background: 'var(--red)', color: '#fff' } : {}}
              whileTap={{ scale: 0.96 }}
              onClick={() => isMonitoring ? stopMonitoring() : startMonitoring()}
            >
              {isMonitoring ? <Square size={14} /> : <Play size={14} />}
              {isMonitoring ? 'Stop' : 'Start'}
            </motion.button>

            {/* Alignment */}
            <motion.button
              className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
              whileTap={{ scale: 0.96 }}
              onClick={() => setAlignmentMode(true)}
              disabled={!isMonitoring}
              style={{ opacity: isMonitoring ? 1 : 0.4 }}
            >
              <Maximize2 size={14} />
              <span className="hidden md:inline">Align</span>
            </motion.button>

            {/* Exports */}
            <div className="flex items-center gap-1.5">
              {['TXT', 'CSV', 'JSON'].map((fmt) => (
                <motion.button
                  key={fmt}
                  className="btn-secondary flex items-center justify-center text-[10px] font-bold"
                  style={{ width: 40, height: 34, opacity: history.length > 0 ? 1 : 0.35 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={history.length === 0}
                  onClick={() => {
                    if (fmt === 'CSV') exportCSV(history);
                    else if (fmt === 'JSON') exportJSON(history, analytics, dataConsumed);
                    else exportTXT(history, analytics, dataConsumed, useEdgeStore.getState().colo);
                  }}
                  title={`Export as ${fmt}`}
                >
                  {fmt}
                </motion.button>
              ))}
            </div>

            {/* Fullscreen */}
            <motion.button
              className="btn-secondary px-3 py-2"
              whileTap={{ scale: 0.96 }}
              onClick={() => toggleFullscreen()}
              title="Fullscreen"
            >
              <Maximize2 size={14} />
            </motion.button>
          </div>
        </div>

        {/* ── Hero: Dual Gauges + Stats ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Gauge: Download */}
          <div className="lg:col-span-4 card p-6 flex flex-col items-center justify-center">
            <Speedometer type="download" />
          </div>

          {/* Center: Key Stats */}
          <div className="lg:col-span-4 flex flex-col gap-4 justify-center">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Ping"
                value={idle ? '—' : Math.round(ping)}
                unit={!idle ? 'ms' : ''}
                color={idle ? 'var(--text-3)' : (pingClass?.color || 'var(--green)')}
                icon={Activity}
              />
              <StatCard
                label="Jitter"
                value={idle ? '—' : jitter.toFixed(1)}
                unit={!idle ? 'ms' : ''}
                color={idle ? 'var(--text-3)' : (jitterClass?.color || 'var(--yellow)')}
                icon={Zap}
              />
              <StatCard
                label="Packet Loss"
                value={idle ? '—' : packetLoss.toFixed(1)}
                unit={!idle ? '%' : ''}
                color={idle ? 'var(--text-3)' : (plClass?.color || 'var(--green)')}
                icon={Wifi}
              />
              <StatCard
                label="Stability"
                value={idle ? '—' : stability}
                unit={!idle ? '/100' : ''}
                color={idle ? 'var(--text-3)' : qualityColor}
                icon={Gauge}
              />
            </div>

            {/* Data consumed */}
            <div className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={14} style={{ color: 'var(--cyan)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Data Used</span>
              </div>
              <span className="mono text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                {idle ? '—' : formatBytes(dataConsumed)}
              </span>
            </div>
          </div>

          {/* Right Gauge: Upload */}
          <div className="lg:col-span-4 card p-6 flex flex-col items-center justify-center">
            <Speedometer type="upload" />
          </div>
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ThroughputChart />
          </div>
          <div>
            <PingChart />
          </div>
        </div>

        {/* ── Lower Section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EventsTimeline />
          <div className="flex flex-col gap-6">
            <SessionSummary />
            <RecentSessions />
          </div>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="text-center py-5" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-[11px] tracking-widest uppercase font-semibold" style={{ color: 'var(--text-3)' }}>
          NetPulse v2.0 · Continuous Diagnostics
        </p>
      </footer>

      {/* Alignment overlay */}
      <AnimatePresence>
        {alignmentMode && <AlignmentView onClose={() => setAlignmentMode(false)} />}
      </AnimatePresence>
    </div>
  );
}
