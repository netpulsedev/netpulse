import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useEventsStore, type EventSeverity } from '../../store/eventsStore';

const SEVERITY_CONFIG: Record<EventSeverity, { icon: typeof Info; color: string; bg: string }> = {
  info:     { icon: Info,          color: '#00E5FF', bg: 'rgba(0,229,255,0.06)' },
  warning:  { icon: AlertTriangle, color: '#FFD600', bg: 'rgba(255,214,0,0.06)' },
  critical: { icon: AlertCircle,   color: '#FF1744', bg: 'rgba(255,23,68,0.06)' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function EventsTimeline() {
  const events = useEventsStore(s => s.events);

  // Show only the 8 most recent events to keep things compact.
  const visible = useMemo(() => events.slice(0, 8), [events]);

  return (
    <motion.div
      id="events-timeline"
      className="glass-card p-5 flex flex-col gap-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: '#00E5FF', boxShadow: '0 0 8px #00E5FF' }} />
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(240,244,255,0.7)' }}>
          Network Events
        </h3>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #00E5FF30, transparent)' }} />
        {events.length > 0 && (
          <span className="text-xs font-mono" style={{ color: 'rgba(240,244,255,0.3)' }}>
            {events.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1" style={{ minHeight: '80px', maxHeight: '200px', overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: 'rgba(240,244,255,0.25)' }}>
            No events yet — start monitoring to see activity
          </p>
        ) : (
          <AnimatePresence mode="popLayout">
            {visible.map(event => {
              const config = SEVERITY_CONFIG[event.severity];
              const Icon = config.icon;
              return (
                <motion.div
                  key={event.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{ background: config.bg }}
                  initial={{ opacity: 0, x: -10, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <Icon size={12} color={config.color} style={{ flexShrink: 0 }} />
                  <span className="text-xs font-medium flex-1 truncate" style={{ color: 'rgba(240,244,255,0.75)' }}>
                    {event.message}
                  </span>
                  <span className="text-xs font-mono flex-shrink-0" style={{ color: 'rgba(240,244,255,0.25)' }}>
                    {formatTime(event.ts)}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
