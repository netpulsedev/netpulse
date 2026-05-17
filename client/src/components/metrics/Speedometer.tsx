import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useNetworkStore } from '../../store/networkStore';
import { AnimatedNumber } from './AnimatedNumber';

interface SpeedometerProps {
  type: 'download' | 'upload';
}

export function Speedometer({ type }: SpeedometerProps) {
  const { download, upload, isMonitoring, testPhase } = useNetworkStore();

  const isDownload = type === 'download';
  const value = isDownload ? download : upload;
  const label = isDownload ? 'Download' : 'Upload';
  const color = isDownload ? '#22d3ee' : '#a78bfa';
  const Icon = isDownload ? ArrowDown : ArrowUp;
  const isActivePhase = testPhase === type || testPhase === 'active';

  // SVG gauge math — 240 degree arc
  const size = 220;
  const strokeWidth = 10;
  const center = size / 2;
  const radius = center - strokeWidth - 8;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 240 / 360; // 240 degrees of the circle
  const arcLength = circumference * arcFraction;
  const gapLength = circumference - arcLength;

  // Logarithmic fill for better range visualization
  const calcFill = (v: number): number => {
    if (v <= 0) return 0;
    if (v <= 1) return v * 0.1;
    if (v <= 10) return 0.1 + ((v - 1) / 9) * 0.2;
    if (v <= 100) return 0.3 + ((v - 10) / 90) * 0.35;
    return 0.65 + (Math.min(v, 1000) - 100) / 900 * 0.35;
  };

  const fillPercent = isMonitoring ? calcFill(value) : 0;
  const filledLength = arcLength * fillPercent;
  const emptyLength = circumference - filledLength;

  // Tick marks around the gauge


  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(150deg)' }} // Start from bottom-left
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${gapLength}`}
            strokeLinecap="round"
          />
          {/* Fill */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference}`}
            strokeLinecap="round"
            animate={{ strokeDashoffset: emptyLength }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>

        {/* Center content */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ paddingBottom: 16 }}
        >
          <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
            <Icon size={14} strokeWidth={2.5} />
            <span className="text-[11px] font-bold uppercase tracking-[0.15em]">{label}</span>
          </div>

          <AnimatedNumber
            value={value > 0 ? value.toFixed(1) : '0.0'}
            className="tabular-nums font-black"
            style={{
              fontSize: '2.75rem',
              lineHeight: 1,
              color: isMonitoring && isActivePhase && value > 0 ? color : 'var(--text-1)',
            }}
          />

          <span
            className="text-xs font-semibold mt-1"
            style={{ color: 'var(--text-3)' }}
          >
            Mbps
          </span>
        </div>
      </div>
    </div>
  );
}
