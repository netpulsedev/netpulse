import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Wifi, Zap } from 'lucide-react';
import { Speedometer } from '../components/metrics/Speedometer';
import { AnimatedNumber } from '../components/metrics/AnimatedNumber';
import { ThroughputChart, PingChart } from '../components/charts/Charts';
import { SessionSummary } from '../components/dashboard/SessionSummary';
import { ControlBar } from '../components/dashboard/ControlBar';
import { AlignmentView } from '../components/alignment/AlignmentView';
import { EdgeRegionBadge } from '../components/dashboard/EdgeRegionBadge';
import { EventsTimeline } from '../components/dashboard/EventsTimeline';
import { RecentSessions } from '../components/dashboard/RecentSessions';
import { useNetworkStore } from '../store/networkStore';
import { getQualityColor, getQualityLabel, formatDuration } from '../utils/stability';
import { getPingLabel, getJitterLabel, getPacketLossLabel } from '../utils/classify';
import { useElapsedTime } from '../hooks/useUtils';

function SessionTimer() {
  const { sessionStart, isMonitoring } = useNetworkStore();
  const elapsed = useElapsedTime(sessionStart, isMonitoring);
  if (!isMonitoring) return null;
  return (
    <span className="font-mono text-xs px-3 py-1 rounded-full glass-panel" style={{ color: 'rgba(255,255,255,0.7)' }}>
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
      className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider glass-panel"
      style={{ color, boxShadow: `0 0 10px ${color}40` }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {label}
    </motion.span>
  );
}

function MiniMetric({ label, value, unit, icon: Icon, qualityClass, idle }: any) {
  return (
    <div className="glass-panel glass-panel-hover flex-1 p-5 flex flex-col items-center justify-center text-center">
      <div className="flex items-center gap-2 mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
        <Icon size={16} />
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-2 tabular-nums">
        <AnimatedNumber
          value={idle ? '—' : value}
          className="font-black text-3xl"
          style={{ color: idle ? '#fff' : (qualityClass?.color || '#fff'), textShadow: idle ? 'none' : `0 0 20px ${qualityClass?.color}80` }}
        />
        {!idle && <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>{unit}</span>}
      </div>
      {!idle && qualityClass && (
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: `${qualityClass.color}20`, color: qualityClass.color }}>
          {qualityClass.text}
        </span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [alignmentMode, setAlignmentMode] = useState(false);
  const { isMonitoring, ping, jitter, packetLoss, stability } = useNetworkStore();

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
    <div className="min-h-screen flex flex-col font-sans relative">
      {/* Immersive Background */}
      <div className="ambient-bg">
        <div className="orb orb-cyan" />
        <div className="orb orb-purple" />
        <div className="orb orb-magenta" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex-shrink-0 glass-panel mx-4 mt-4 rounded-full border-white/10">
        <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center gap-6">
          <button className="flex items-center gap-2 text-sm font-semibold text-white/50 hover:text-white transition-colors" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Home
          </button>
          
          <div className="w-px h-6 bg-white/10" />
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
              <Activity size={14} className="text-[#00F0FF]" />
            </div>
            <span className="font-black tracking-widest text-sm">
              NET<span className="text-white/50">PULSE</span>
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <QualityBadge />
            <SessionTimer />
            <EdgeRegionBadge />
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <div className={`status-dot ${isMonitoring ? 'active' : 'inactive'}`} />
              <span className="text-xs font-semibold text-white/50">{isMonitoring ? 'LIVE' : 'IDLE'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-screen-2xl mx-auto w-full px-4 md:px-6 py-8 flex flex-col gap-8">
        
        <ControlBar onAlignmentMode={() => setAlignmentMode(true)} />

        {/* Dual Speedometers */}
        <div className="flex flex-col md:flex-row gap-6 justify-center">
          <div className="glass-panel p-6 flex-1 flex flex-col items-center justify-center max-w-xl mx-auto md:mx-0 w-full">
            <Speedometer type="download" />
          </div>
          <div className="glass-panel p-6 flex-1 flex flex-col items-center justify-center max-w-xl mx-auto md:mx-0 w-full">
            <Speedometer type="upload" />
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="flex flex-col md:flex-row gap-6">
          <MiniMetric label="Latency" value={ping > 0 ? Math.round(ping) : 0} unit="ms" icon={Activity} qualityClass={pingClass} idle={idle} />
          <MiniMetric label="Jitter" value={jitter.toFixed(1)} unit="ms" icon={Zap} qualityClass={jitterClass} idle={idle} />
          <MiniMetric label="Packet Loss" value={packetLoss.toFixed(1)} unit="%" icon={Wifi} qualityClass={plClass} idle={idle} />
          <div className="glass-panel glass-panel-hover flex-1 p-5 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2 mb-2 text-white/50">
              <Activity size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Stability Score</span>
            </div>
            <AnimatedNumber value={idle ? '—' : stability} className="font-black text-4xl tabular-nums" style={{ color: idle ? '#fff' : getQualityColor(stability) }} />
          </div>
        </div>

        {/* Charts & Data */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel p-4"><ThroughputChart /></div>
          <div className="glass-panel p-4"><PingChart /></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel p-4"><EventsTimeline /></div>
          <div className="flex flex-col gap-6">
            <div className="glass-panel p-4"><SessionSummary /></div>
            <div className="glass-panel p-4"><RecentSessions /></div>
          </div>
        </div>

      </main>

      <footer className="relative z-10 text-center py-6 text-white/30">
        <p className="text-xs tracking-widest uppercase font-semibold">NetPulse v2.0 · Glassmorphic Telemetry</p>
      </footer>

      {/* Alignment Mode */}
      <AnimatePresence>
        {alignmentMode && <AlignmentView onClose={() => setAlignmentMode(false)} />}
      </AnimatePresence>
    </div>
  );
}
