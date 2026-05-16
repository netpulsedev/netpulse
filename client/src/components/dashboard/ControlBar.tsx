import { motion } from 'framer-motion';
import { Play, Square, Maximize2, Download, Moon } from 'lucide-react';
import { useNetworkStore } from '../../store/networkStore';
import { useDiagnostics } from '../../hooks/useDiagnostics';
import { useElapsedTime, useExport, useFullscreen } from '../../hooks/useUtils';
import { formatDuration } from '../../utils/stability';

interface ControlBarProps {
  onAlignmentMode: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  idle: 'Idle',
  ping: 'Measuring latency...',
  download: 'Testing download...',
  upload: 'Testing upload...',
  analyzing: 'Analyzing...',
};

export function ControlBar({ onAlignmentMode }: ControlBarProps) {
  const { isMonitoring, testPhase, wakeLockActive, sessionStart, history } = useNetworkStore();
  const { startMonitoring, stopMonitoring } = useDiagnostics();
  const { exportCSV } = useExport();
  const { toggle: toggleFullscreen } = useFullscreen();

  const duration = useElapsedTime(sessionStart, isMonitoring);

  return (
    <div className="glass-card px-5 py-4 flex flex-wrap items-center gap-3 md:gap-4">
      {/* Status indicator */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className={`status-dot ${isMonitoring ? 'active' : 'inactive'}`} />
        <span className="text-sm font-medium truncate" style={{ color: 'rgba(240,244,255,0.7)' }}>
          {isMonitoring ? PHASE_LABELS[testPhase] ?? 'Monitoring' : 'Stopped'}
        </span>
        {isMonitoring && sessionStart && (
          <>
            <span className="text-xs" style={{ color: 'rgba(240,244,255,0.3)' }}>·</span>
            <span className="text-xs font-mono" style={{ color: 'rgba(240,244,255,0.45)' }}>
              {formatDuration(duration)}
            </span>
          </>
        )}
        {wakeLockActive && (
          <div className="flex items-center gap-1 ml-1">
            <Moon size={11} color="#FFD600" />
            <span className="text-xs" style={{ color: '#FFD600' }}>Wake Lock</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Start/Stop */}
        <motion.button
          id="btn-toggle-monitor"
          className={`btn-primary flex items-center gap-2 px-4 py-2 text-sm font-bold`}
          style={
            isMonitoring
              ? { background: 'linear-gradient(135deg, #FF1744, #D50000)', color: '#fff' }
              : {}
          }
          whileTap={{ scale: 0.96 }}
          onClick={() => isMonitoring ? stopMonitoring() : startMonitoring()}
          aria-label={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}
        >
          {isMonitoring ? <Square size={14} /> : <Play size={14} />}
          {isMonitoring ? 'Stop' : 'Start'}
        </motion.button>

        {/* Alignment mode */}
        <motion.button
          id="btn-alignment-mode"
          className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
          whileTap={{ scale: 0.96 }}
          onClick={onAlignmentMode}
          disabled={!isMonitoring}
          style={{ opacity: isMonitoring ? 1 : 0.4 }}
          aria-label="Open alignment mode"
        >
          <Maximize2 size={14} />
          <span className="hidden md:inline">Alignment</span>
        </motion.button>

        {/* Export CSV */}
        <motion.button
          id="btn-export-csv"
          className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
          whileTap={{ scale: 0.96 }}
          onClick={() => exportCSV(history)}
          disabled={history.length === 0}
          style={{ opacity: history.length > 0 ? 1 : 0.4 }}
          aria-label="Export CSV"
          title="Export session as CSV"
        >
          <Download size={14} />
          <span className="hidden md:inline">Export</span>
        </motion.button>

        {/* Fullscreen */}
        <motion.button
          id="btn-fullscreen"
          className="btn-secondary px-3 py-2"
          whileTap={{ scale: 0.96 }}
          onClick={() => toggleFullscreen()}
          aria-label="Toggle fullscreen"
          title="Toggle fullscreen"
        >
          <Maximize2 size={14} />
        </motion.button>
      </div>
    </div>
  );
}
