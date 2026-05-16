import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Radio } from 'lucide-react';
import { MetricsGrid } from '../components/metrics/MetricsGrid';
import { ThroughputChart, PingChart, StabilityChart } from '../components/charts/Charts';
import { SessionSummary } from '../components/dashboard/SessionSummary';
import { ControlBar } from '../components/dashboard/ControlBar';
import { AlignmentView } from '../components/alignment/AlignmentView';
import { useNetworkStore } from '../store/networkStore';
import { getQualityColor, getQualityLabel, formatDuration } from '../utils/stability';
import { useElapsedTime } from '../hooks/useUtils';

// ─── Session Timer ────────────────────────────────────────────────────────────
function SessionTimer() {
  const { sessionStart, isMonitoring } = useNetworkStore();
  const elapsed = useElapsedTime(sessionStart, isMonitoring);

  if (!isMonitoring) return null;

  return (
    <span className="font-mono text-xs px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(0,229,255,0.08)', color: 'rgba(240,244,255,0.5)', border: '1px solid rgba(0,229,255,0.12)' }}>
      {formatDuration(elapsed)}
    </span>
  );
}

// ─── Network Quality Badge ────────────────────────────────────────────────────
function QualityBadge() {
  const { stability, isMonitoring } = useNetworkStore();
  if (!isMonitoring) return null;
  const color = getQualityColor(stability);
  const label = getQualityLabel(stability);
  return (
    <motion.span
      key={label}
      className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {label}
    </motion.span>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [alignmentMode, setAlignmentMode] = useState(false);
  const { isMonitoring, effectiveType } = useNetworkStore();

  // Escape key closes alignment mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAlignmentMode(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050816' }}>
      {/* Fixed background layers */}
      <div className="fixed inset-0 animated-grid pointer-events-none" style={{ opacity: 0.5 }} />
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 100% 40% at 50% 0%, rgba(0,229,255,0.05) 0%, transparent 65%)' }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 h-13 flex items-center gap-3" style={{ height: '52px' }}>

          {/* Back */}
          <button
            id="btn-back-home"
            className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-150 flex-shrink-0"
            style={{ color: 'rgba(240,244,255,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#00E5FF')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,244,255,0.35)')}
            onClick={() => navigate('/')}
            aria-label="Back to home"
          >
            <ArrowLeft size={13} />
            <span>Home</span>
          </button>

          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.2)' }}>
              <Activity size={13} color="#00E5FF" />
            </div>
            <span className="font-black tracking-wider text-sm">
              <span style={{ color: '#00E5FF' }}>NET</span>
              <span style={{ color: 'rgba(240,244,255,0.9)' }}>PULSE</span>
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status row */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <QualityBadge />
            <SessionTimer />

            {effectiveType && effectiveType !== '—' && (
              <span className="hidden md:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(124,77,255,0.1)', border: '1px solid rgba(124,77,255,0.2)', color: '#7C4DFF' }}>
                <Radio size={10} />
                {effectiveType.toUpperCase()}
              </span>
            )}

            {/* Status dot */}
            <div className="flex items-center gap-1.5">
              <div className={`status-dot ${isMonitoring ? 'active' : 'inactive'}`} />
              <span className="text-xs hidden sm:inline" style={{ color: 'rgba(240,244,255,0.4)' }}>
                {isMonitoring ? 'Live' : 'Idle'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 max-w-screen-2xl mx-auto w-full px-4 md:px-6 py-4 flex flex-col gap-4">

        {/* Control bar */}
        <ControlBar onAlignmentMode={() => setAlignmentMode(true)} />

        {/* Metric cards */}
        <MetricsGrid />

        {/* Charts — 2/3 + 1/3 split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ThroughputChart />
          </div>
          <div>
            <PingChart />
          </div>
        </div>

        {/* Stability + Session analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <StabilityChart />
          </div>
          <div className="lg:col-span-3">
            <SessionSummary />
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 flex-shrink-0 text-center py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: 'rgba(240,244,255,0.18)' }}>
        <p className="text-xs tracking-wider">NetPulse v1.0 · Continuous Internet Diagnostics · All measurements run locally</p>
      </footer>

      {/* ── Idle hint overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isMonitoring && (
          <motion.div
            className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl text-center"
              style={{
                background: 'rgba(5,8,22,0.88)',
                border: '1px solid rgba(0,229,255,0.12)',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}>
                <Activity size={22} color="#00E5FF" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'rgba(240,244,255,0.7)' }}>
                  Ready to diagnose
                </p>
                <p className="text-xs mt-1" style={{ color: 'rgba(240,244,255,0.35)' }}>
                  Press <strong style={{ color: '#00E5FF' }}>Start</strong> in the control bar above
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Alignment Mode ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {alignmentMode && (
          <AlignmentView onClose={() => setAlignmentMode(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
