import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../store/networkStore';
import {
  formatMbps, formatMs, formatDuration, getQualityColor, getQualityLabel,
} from '../../utils/stability';
import { Clock, TrendingUp, TrendingDown, Zap, Award, BarChart2 } from 'lucide-react';

function StatBlock({ label, value, unit, icon, color }: {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}25` }}
      >
        <span style={{ color, fontSize: 14 }}>{icon}</span>
      </div>
      <div>
        <div className="text-xs font-medium" style={{ color: 'rgba(240,244,255,0.45)' }}>{label}</div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="metric-value font-bold text-lg" style={{ color: 'rgba(240,244,255,0.95)' }}>{value}</span>
          {unit && <span className="text-xs" style={{ color: 'rgba(240,244,255,0.4)' }}>{unit}</span>}
        </div>
      </div>
    </div>
  );
}

export function SessionSummary() {
  const { analytics, sessionStart, isMonitoring } = useNetworkStore();
  const now = Date.now();
  const duration = sessionStart ? now - sessionStart : 0;
  const avgStability = isFinite(analytics.avgStability) ? Math.round(analytics.avgStability) : 0;
  const qualityColor = getQualityColor(avgStability);

  return (
    <motion.div
      id="session-summary"
      className="glass-card p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="w-2 h-2 rounded-full" style={{ background: '#7C4DFF', boxShadow: '0 0 8px #7C4DFF' }} />
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(240,244,255,0.7)' }}>Session Analytics</h3>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #7C4DFF30, transparent)' }} />
        {isMonitoring && sessionStart && (
          <span className="text-xs font-mono" style={{ color: 'rgba(240,244,255,0.4)' }}>
            {formatDuration(duration)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
        <StatBlock
          label="Avg Download"
          value={analytics.sampleCount > 0 ? analytics.avgDownload.toFixed(1) : '—'}
          unit={analytics.sampleCount > 0 ? 'Mbps' : ''}
          icon={<TrendingDown size={14} />}
          color="#00E5FF"
        />
        <StatBlock
          label="Best Download"
          value={analytics.bestDownload > 0 ? analytics.bestDownload.toFixed(1) : '—'}
          unit={analytics.bestDownload > 0 ? 'Mbps' : ''}
          icon={<Award size={14} />}
          color="#00FF95"
        />
        <StatBlock
          label="Avg Upload"
          value={analytics.sampleCount > 0 ? analytics.avgUpload.toFixed(1) : '—'}
          unit={analytics.sampleCount > 0 ? 'Mbps' : ''}
          icon={<TrendingUp size={14} />}
          color="#7C4DFF"
        />
        <StatBlock
          label="Lowest Ping"
          value={analytics.lowestPing !== Infinity && analytics.lowestPing > 0 ? analytics.lowestPing : '—'}
          unit={analytics.lowestPing !== Infinity && analytics.lowestPing > 0 ? 'ms' : ''}
          icon={<Zap size={14} />}
          color="#00FF95"
        />
        <StatBlock
          label="Peak Jitter"
          value={analytics.peakJitter > 0 ? analytics.peakJitter.toFixed(1) : '—'}
          unit={analytics.peakJitter > 0 ? 'ms' : ''}
          icon={<BarChart2 size={14} />}
          color="#FFD600"
        />
        <StatBlock
          label="Avg Quality"
          value={analytics.sampleCount > 0 ? getQualityLabel(avgStability) : '—'}
          icon={<Clock size={14} />}
          color={qualityColor}
        />
      </div>
    </motion.div>
  );
}
