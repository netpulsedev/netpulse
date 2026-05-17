import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Trash2 } from 'lucide-react';
import { getRecentSessions, deleteSession, type SavedSession } from '../../services/sessionStorage';
import { getColoCity } from '../../utils/coloMap';
import { getQualityColor, getQualityLabel, formatDuration } from '../../utils/stability';

export function RecentSessions() {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      const results = await getRecentSessions(5);
      if (cancelled) return;

      setSessions(results);
      setLoading(false);
    }

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  if (loading || sessions.length === 0) return null;

  return (
    <motion.div
      id="recent-sessions"
      className="glass-card p-5 flex flex-col gap-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: '#7C4DFF', boxShadow: '0 0 8px #7C4DFF' }} />
        <h3 className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(240,244,255,0.7)' }}>
          Recent Sessions
        </h3>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #7C4DFF30, transparent)' }} />
      </div>

      <div className="flex flex-col gap-2">
        {sessions.map(session => {
          const color = getQualityColor(session.avgStability);
          const label = getQualityLabel(Math.round(session.avgStability));
          const date = new Date(session.startedAt);
          const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={session.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span style={{ color: 'rgba(240,244,255,0.7)' }}>{dateStr} {timeStr}</span>
                  <span style={{ color: 'rgba(240,244,255,0.2)' }}>·</span>
                  <span className="font-mono" style={{ color: 'rgba(240,244,255,0.4)' }}>
                    {formatDuration(session.durationMs)}
                  </span>
                  {session.colo && (
                    <>
                      <span style={{ color: 'rgba(240,244,255,0.2)' }}>·</span>
                      <span style={{ color: 'rgba(240,244,255,0.3)' }}>{getColoCity(session.colo)}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span style={{ color: '#00E5FF' }}>↓{session.avgDownload.toFixed(0)}</span>
                  <span style={{ color: '#7C4DFF' }}>↑{session.avgUpload.toFixed(0)}</span>
                  <span style={{ color }}>
                    {Math.round(session.avgStability)} · {label}
                  </span>
                </div>
              </div>

              <button
                className="opacity-0 group-hover:opacity-60 transition-opacity p-1"
                onClick={() => handleDelete(session.id)}
                title="Delete session"
              >
                <Trash2 size={12} color="rgba(240,244,255,0.5)" />
              </button>

              <Clock size={12} style={{ color: 'rgba(240,244,255,0.15)', flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
