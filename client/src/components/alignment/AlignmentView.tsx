import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowDown, ArrowUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useNetworkStore } from '../../store/networkStore';
import { getQualityColor, getQualityLabel } from '../../utils/stability';
import { useFullscreen } from '../../hooks/useUtils';

interface AlignmentViewProps {
  onClose: () => void;
}

function TrendArrow({ current, previous, threshold = 5 }: {
  current: number;
  previous: number;
  threshold?: number;
}) {
  const delta = current - previous;
  if (Math.abs(delta) < threshold) {
    return <Minus size={24} color="rgba(240,244,255,0.5)" />;
  }
  if (delta > 0) {
    return <TrendingUp size={24} color="#00FF95" />;
  }
  return <TrendingDown size={24} color="#FF1744" />;
}

function PulseRing({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${100 + i * 80}px`,
            height: `${100 + i * 80}px`,
            borderColor: `${color}${Math.round((1 - i * 0.25) * 255).toString(16).padStart(2, '0')}`,
            animation: `ping-ring ${1.5 + i * 0.5}s ease-out infinite`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}

export function AlignmentView({ onClose }: AlignmentViewProps) {
  const { download, upload, ping, stability, isMonitoring, history } = useNetworkStore();
  const { enter: enterFullscreen, exit: exitFullscreen } = useFullscreen();
  const containerRef = useRef<HTMLDivElement>(null);

  const qualityColor = getQualityColor(stability);
  const qualityLabel = getQualityLabel(stability);

  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const prevDl = prev?.download ?? download;
  const prevUl = prev?.upload ?? upload;

  useEffect(() => {
    enterFullscreen(containerRef.current);
    return () => { exitFullscreen(); };
  }, [enterFullscreen, exitFullscreen]);

  // Score gradient background
  const bgGradient =
    stability >= 81
      ? 'radial-gradient(ellipse at center, rgba(0, 255, 149, 0.08) 0%, #050816 65%)'
      : stability >= 66
      ? 'radial-gradient(ellipse at center, rgba(0, 229, 255, 0.08) 0%, #050816 65%)'
      : stability >= 41
      ? 'radial-gradient(ellipse at center, rgba(255, 214, 0, 0.08) 0%, #050816 65%)'
      : 'radial-gradient(ellipse at center, rgba(255, 23, 68, 0.08) 0%, #050816 65%)';

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        id="alignment-view"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
        style={{ background: bgGradient, backgroundColor: '#050816' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-label="Alignment mode"
      >
        {/* Animated grid */}
        <div className="absolute inset-0 animated-grid opacity-50 pointer-events-none" />

        {/* Close button */}
        <motion.button
          id="btn-close-alignment"
          className="absolute top-6 right-6 btn-secondary p-3 rounded-xl"
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          aria-label="Close alignment mode"
        >
          <X size={20} />
        </motion.button>

        {/* ALIGNMENT MODE label */}
        <div className="absolute top-6 left-6 flex items-center gap-2">
          <div className="status-dot active" />
          <span className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(240,244,255,0.5)' }}>
            Alignment Mode
          </span>
        </div>

        {/* Main score */}
        <div className="relative flex flex-col items-center justify-center">
          <PulseRing color={qualityColor} />

          {/* Score number */}
          <motion.div
            key={stability}
            className="relative z-10 flex flex-col items-center"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <span
              className="metric-value font-black leading-none"
              style={{
                fontSize: 'clamp(7rem, 20vw, 14rem)',
                color: qualityColor,
                textShadow: `0 0 60px ${qualityColor}80, 0 0 120px ${qualityColor}30`,
              }}
            >
              {isMonitoring ? stability : '—'}
            </span>

            <motion.span
              key={qualityLabel}
              className="font-bold uppercase tracking-[0.4em] mt-2"
              style={{
                fontSize: 'clamp(1rem, 3vw, 2rem)',
                color: qualityColor,
                textShadow: `0 0 20px ${qualityColor}60`,
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {isMonitoring ? qualityLabel : 'Start Monitoring'}
            </motion.span>
          </motion.div>
        </div>

        {/* Speed readouts */}
        <div className="mt-12 flex flex-col items-center gap-5">
          {/* Download */}
          <motion.div
            className="flex items-center gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ArrowDown size={28} color="#00E5FF" />
            <span
              className="metric-value font-black"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', color: '#00E5FF', textShadow: '0 0 30px #00E5FF60' }}
            >
              {download > 0 ? download.toFixed(0) : '—'}
            </span>
            <span className="text-2xl font-semibold" style={{ color: 'rgba(0,229,255,0.6)' }}>Mbps</span>
            <TrendArrow current={download} previous={prevDl} threshold={2} />
          </motion.div>

          {/* Upload */}
          <motion.div
            className="flex items-center gap-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ArrowUp size={28} color="#7C4DFF" />
            <span
              className="metric-value font-black"
              style={{ fontSize: 'clamp(2.5rem, 7vw, 5rem)', color: '#7C4DFF', textShadow: '0 0 30px #7C4DFF60' }}
            >
              {upload > 0 ? upload.toFixed(0) : '—'}
            </span>
            <span className="text-2xl font-semibold" style={{ color: 'rgba(124,77,255,0.6)' }}>Mbps</span>
            <TrendArrow current={upload} previous={prevUl} threshold={1} />
          </motion.div>

          {/* Ping */}
          <motion.div
            className="flex items-center gap-3 mt-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <span
              className="metric-value font-bold"
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 3rem)',
                color: ping > 0 && ping < 30 ? '#00FF95' : ping < 80 ? '#FFD600' : '#FF1744',
              }}
            >
              {ping > 0 ? ping : '—'}ms
            </span>
            <span className="text-lg" style={{ color: 'rgba(240,244,255,0.4)' }}>latency</span>
          </motion.div>
        </div>

        {/* Hint */}
        <p
          className="absolute bottom-8 text-xs uppercase tracking-widest"
          style={{ color: 'rgba(240,244,255,0.2)' }}
        >
          Move around to find the best signal · Press Esc to exit
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
