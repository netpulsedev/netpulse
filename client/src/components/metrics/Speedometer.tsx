import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUp, Zap } from 'lucide-react';
import { useNetworkStore } from '../../store/networkStore';
import { AnimatedNumber } from './AnimatedNumber';
import { getQualityColor } from '../../utils/stability';

export function Speedometer() {
  const { download, upload, testPhase, stability, isMonitoring } = useNetworkStore();

  // Determine current active metric
  const isUpload = testPhase === 'upload';
  const isActive = testPhase === 'download' || testPhase === 'upload';
  const currentValue = isUpload ? upload : download;
  
  // Color logic
  const primaryColor = isUpload ? '#7C4DFF' : '#00E5FF';
  const trackColor = 'rgba(255,255,255,0.05)';
  const qualityColor = getQualityColor(stability);

  // Math for SVG arc (270 degree dial)
  const radius = 120;
  const strokeWidth = 14;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  // Cap the display scale to 1000 Mbps for visual fill, scaled logarithmically or linearly.
  // We'll use a simple scale: 0-100 is 50%, 100-1000 is the rest.
  const calculateFill = (val: number) => {
    if (val === 0) return 0;
    if (val <= 100) return (val / 100) * 0.5;
    return 0.5 + (Math.min(val, 1000) - 100) / 900 * 0.5;
  };
  
  const fillPercentage = isActive ? calculateFill(currentValue) : 0;
  // 75% of circumference is the visible track (270 degrees)
  const trackLength = circumference * 0.75; 
  const strokeDashoffset = circumference - (fillPercentage * trackLength);

  return (
    <div className="relative flex flex-col items-center justify-center py-10">
      
      {/* Outer pulsing glow when active */}
      {isActive && (
        <motion.div
          className="absolute inset-0 m-auto rounded-full pointer-events-none blur-3xl opacity-20"
          style={{ width: 300, height: 300, background: primaryColor }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* SVG Dial */}
      <div className="relative" style={{ width: 320, height: 320 }}>
        <svg
          height="320"
          width="320"
          className="transform -rotate-135" // Start at bottom left
          style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}
        >
          {/* Background Track */}
          <circle
            stroke={trackColor}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${trackLength} ${circumference}`}
            style={{ strokeLinecap: 'round' }}
            r={normalizedRadius}
            cx="160"
            cy="160"
          />
          {/* Active Fill */}
          <motion.circle
            stroke={primaryColor}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeLinecap: 'round' }}
            r={normalizedRadius}
            cx="160"
            cy="160"
            animate={{ strokeDashoffset }}
            transition={{ type: 'spring', stiffness: 60, damping: 15 }}
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ marginTop: '-20px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={testPhase}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
            >
              {!isMonitoring ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Zap size={28} color="rgba(240,244,255,0.4)" />
                  </div>
                  <span className="text-sm font-semibold tracking-widest uppercase mt-2" style={{ color: 'rgba(240,244,255,0.3)' }}>
                    Ready
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2" style={{ color: primaryColor }}>
                    {isUpload ? <ArrowUp size={24} /> : <ArrowDown size={24} />}
                    <span className="text-sm font-bold tracking-widest uppercase opacity-80">
                      {isUpload ? 'Upload' : 'Download'}
                    </span>
                  </div>
                  <AnimatedNumber
                    value={currentValue > 0 ? currentValue.toFixed(1) : '0.0'}
                    className="font-black tabular-nums tracking-tighter"
                    style={{
                      fontSize: '4.5rem',
                      lineHeight: '1',
                      color: primaryColor,
                      textShadow: `0 0 40px ${primaryColor}80`
                    }}
                  />
                  <span className="text-xl font-medium mt-1" style={{ color: 'rgba(240,244,255,0.5)' }}>
                    Mbps
                  </span>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Stability Score (Always visible during monitoring) */}
        {isMonitoring && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card px-6 py-2 rounded-full flex items-center gap-3 border"
              style={{ borderColor: `${qualityColor}40`, background: 'rgba(5,8,22,0.8)' }}
            >
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(240,244,255,0.5)' }}>Score</span>
              <span className="font-black text-lg tabular-nums" style={{ color: qualityColor }}>{stability}</span>
            </motion.div>
          </div>
        )}
      </div>

    </div>
  );
}
