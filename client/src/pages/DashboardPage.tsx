import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Radio, TrendingUp, TrendingDown, Minus, AlertTriangle, Wifi, Zap } from 'lucide-react';
import { Speedometer } from '../components/metrics/Speedometer';
import { AnimatedNumber } from '../components/metrics/AnimatedNumber';
import { ThroughputChart, PingChart, StabilityChart } from '../components/charts/Charts';
import { SessionSummary } from '../components/dashboard/SessionSummary';
import { ControlBar } from '../components/dashboard/ControlBar';
import { AlignmentView } from '../components/alignment/AlignmentView';
import { EdgeRegionBadge } from '../components/dashboard/EdgeRegionBadge';
import { EventsTimeline } from '../components/dashboard/EventsTimeline';
import { RecentSessions } from '../components/dashboard/RecentSessions';
import { useNetworkStore } from '../store/networkStore';
import { getQualityColor, getQualityLabel, formatDuration } from '../utils/stability';
import { getPingLabel, getJitterLabel, getPacketLossLabel } from '../utils/classify';
import { analyzeTrend, getTrendColor, getTrendLabel } from '../utils/trends';
import { useElapsedTime } from '../hooks/useUtils';

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

function TrendBadge() {
  const history = useNetworkStore(s => s.history);
  const isMonitoring = useNetworkStore(s => s.isMonitoring);
  const trend = useMemo(() => analyzeTrend(history), [history]);

  if (!isMonitoring || history.length < 10) return null;
  const color = getTrendColor(trend.direction);
  const label = getTrendLabel(trend.direction);

  const TrendIcon = trend.direction === 'improving' ? TrendingUp
    : trend.direction === 'degrading' ? TrendingDown
    : trend.direction === 'unstable' ? AlertTriangle
    : Minus;

  return (
    <motion.span
      key={trend.direction}
      className="hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{ background: `${color}10`, border: `1px solid ${color}20`, color }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      title={`Short-term avg: ${trend.shortTermAvg} · Long-term avg: ${trend.longTermAvg}`}
    >
      <TrendIcon size={10} />
      {label}
    </motion.span>
  );
}

function MiniMetric({ label, value, unit, icon: Icon, qualityClass, idle }: any) {
  return (
    <div className="glass-card flex-1 p-4 flex flex-col items-center text-center justify-center relative overflow-hidden group hover:border-white/20 transition-colors">
      {!idle && qualityClass?.color && (
        <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: qualityClass.color, opacity: 0.7 }} />
      )}
      <div className="flex items-center gap-1.5 mb-2" style={{ color: 'rgba(240,244,255,0.4)' }}>
        <Icon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-1 tabular-nums">
        <AnimatedNumber
          value={idle ? '—' : value}
          className="font-black"
          style={{ fontSize: '1.75rem', color: idle ? '#fff' : (qualityClass?.color || '#fff') }}
        />
        {!idle && <span className="text-xs font-semibold" style={{ color: 'rgba(240,244,255,0.3)' }}>{unit}</span>}
      </div>
      {!idle && qualityClass && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${qualityClass.color}15`, color: qualityClass.color }}>
          {qualityClass.text}
        </span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [alignmentMode, setAlignmentMode] = useState(false);
  const { isMonitoring, effectiveType, ping, jitter, packetLoss } = useNetworkStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setAlignmentMode(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const idle = !isMonitoring;
  const pingClass = getPingLabel(ping);
  const jitterClass = getJitterLabel(jitter);
  const plClass = getPacketLossLabel(packetLoss);

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: '#050816' }}>
      <div className="fixed inset-0 animated-grid pointer-events-none" style={{ opacity: 0.3 }} />
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(0,229,255,0.03) 0%, transparent 60%)' }} />

      {/* Header */}
      <header className="relative z-10 flex-shrink-0 border-b border-white/5 backdrop-blur-md bg-[#050816]/50">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 h-14 flex items-center gap-6">
          <button
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors duration-150 text-white/40 hover:text-[#00E5FF]"
            onClick={() => navigate('/')}
          >
            <ArrowLeft size={14} /> Back
          </button>
          
          <div className="w-px h-4 bg-white/10" />
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center bg-[#00E5FF]/10 border border-[#00E5FF]/20">
              <Activity size={12} color="#00E5FF" />
            </div>
            <span className="font-black tracking-widest text-xs">
              <span className="text-[#00E5FF]">NET</span><span className="text-white/90">PULSE</span>
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <QualityBadge />
            <TrendBadge />
            <SessionTimer />
            <EdgeRegionBadge />
            {effectiveType && effectiveType !== '—' && (
              <span className="hidden lg:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-[#7C4DFF]/10 border border-[#7C4DFF]/20 text-[#7C4DFF]">
                <Radio size={10} /> {effectiveType.toUpperCase()}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <div className={`status-dot ${isMonitoring ? 'active' : 'inactive'}`} />
              <span className="text-xs hidden sm:inline text-white/40">{isMonitoring ? 'Live' : 'Idle'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-screen-xl mx-auto w-full px-4 md:px-6 py-6 flex flex-col gap-6">
        
        <ControlBar onAlignmentMode={() => setAlignmentMode(true)} />

        {/* Hero Section: Speedometer + Telemetry */}
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          
          {/* Central Speedometer */}
          <div className="glass-card flex-1 p-6 flex flex-col items-center justify-center relative overflow-hidden" style={{ minHeight: '400px' }}>
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-[#00E5FF] rounded-full blur-[120px] opacity-10 pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[#7C4DFF] rounded-full blur-[120px] opacity-10 pointer-events-none" />
            
            <Speedometer />
          </div>

          {/* Side Telemetry Panels */}
          <div className="flex flex-col gap-4 lg:w-72">
            <MiniMetric label="Latency" value={ping > 0 ? Math.round(ping) : 0} unit="ms" icon={Activity} qualityClass={pingClass} idle={idle} />
            <MiniMetric label="Jitter" value={jitter.toFixed(1)} unit="ms" icon={Zap} qualityClass={jitterClass} idle={idle} />
            <MiniMetric label="Packet Loss" value={packetLoss.toFixed(1)} unit="%" icon={Wifi} qualityClass={plClass} idle={idle} />
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ThroughputChart />
          </div>
          <div>
            <PingChart />
          </div>
        </div>

        {/* Stability + Events row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <StabilityChart />
          </div>
          <div className="lg:col-span-3">
            <EventsTimeline />
          </div>
        </div>

        {/* Session analytics + recent sessions */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <SessionSummary />
          </div>
          <div className="lg:col-span-2">
            <RecentSessions />
          </div>
        </div>

      </main>

      <footer className="relative z-10 flex-shrink-0 text-center py-4 border-t border-white/5 text-white/20">
        <p className="text-xs tracking-widest uppercase font-semibold">NetPulse v1.1 · Professional Telemetry</p>
        <p className="text-[10px] mt-1.5 opacity-60 max-w-xl mx-auto px-4">
          Browser-based measurements may differ from ICMP or system-level diagnostics. Latency reflects HTTP round-trip time.
        </p>
      </footer>

      {/* Alignment Mode */}
      <AnimatePresence>
        {alignmentMode && <AlignmentView onClose={() => setAlignmentMode(false)} />}
      </AnimatePresence>
    </div>
  );
}
