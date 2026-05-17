import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useNetworkStore } from '../../store/networkStore';
import { AnimatedNumber } from './AnimatedNumber';

interface SpeedometerProps {
  type: 'download' | 'upload';
}

export function Speedometer({ type }: SpeedometerProps) {
  const { download, upload, testPhase } = useNetworkStore();

  const isUpload = type === 'upload';
  const isActive = testPhase === type;
  const currentValue = isUpload ? upload : download;
  
  // Custom colors for each dial
  const primaryColor = isUpload ? '#8A2BE2' : '#00F0FF';
  const trackColor = 'rgba(255,255,255,0.05)';

  const radius = 100;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const calculateFill = (val: number) => {
    if (val === 0) return 0;
    if (val <= 100) return (val / 100) * 0.5;
    return 0.5 + (Math.min(val, 1000) - 100) / 900 * 0.5;
  };
  
  // Show fill if active OR if it has a final value from a finished test
  const displayValue = currentValue;
  const fillPercentage = (isActive || displayValue > 0) ? calculateFill(displayValue) : 0;
  
  const trackLength = circumference * 0.75; 
  const strokeDashoffset = circumference - (fillPercentage * trackLength);

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      {isActive && (
        <motion.div
          className="absolute inset-0 m-auto rounded-full pointer-events-none blur-[80px]"
          style={{ width: 200, height: 200, background: primaryColor, opacity: 0.2 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative" style={{ width: 240, height: 240 }}>
        <svg height="240" width="240" className="transform -rotate-135" style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' }}>
          <circle stroke={trackColor} fill="transparent" strokeWidth={strokeWidth} strokeDasharray={`${trackLength} ${circumference}`} style={{ strokeLinecap: 'round' }} r={normalizedRadius} cx="120" cy="120" />
          <motion.circle stroke={primaryColor} fill="transparent" strokeWidth={strokeWidth} strokeDasharray={`${circumference} ${circumference}`} style={{ strokeLinecap: 'round' }} r={normalizedRadius} cx="120" cy="120" animate={{ strokeDashoffset }} transition={{ type: 'spring', stiffness: 60, damping: 15 }} />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ marginTop: '-15px' }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: primaryColor }}>
            {isUpload ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
            <span className="text-xs font-bold tracking-widest uppercase opacity-80">{isUpload ? 'Upload' : 'Download'}</span>
          </div>
          <AnimatedNumber
            value={displayValue > 0 ? displayValue.toFixed(1) : '0.0'}
            className="font-black tabular-nums tracking-tighter"
            style={{ fontSize: '3rem', lineHeight: '1', color: isActive ? primaryColor : '#FFF', textShadow: isActive ? `0 0 30px ${primaryColor}80` : 'none' }}
          />
          <span className="text-sm font-medium mt-1 text-white/40">Mbps</span>
        </div>
      </div>
    </div>
  );
}
