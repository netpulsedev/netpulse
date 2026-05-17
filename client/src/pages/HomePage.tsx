import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Activity, Wifi, Zap, Shield } from 'lucide-react';

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color: string;
    }[] = [];

    const COLORS = ['#22d3ee', '#a78bfa', '#34d399'];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.05,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(34,211,238,${0.04 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}

const FEATURES = [
  { icon: <Activity size={16} />, text: 'Real-time ping, jitter & packet loss' },
  { icon: <Zap size={16} />, text: 'Simultaneous throughput testing' },
  { icon: <Shield size={16} />, text: 'Stability score (0–100)' },
  { icon: <Wifi size={16} />, text: 'Alignment mode for dead-zone hunting' },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      <ParticleCanvas />

      {/* Subtle gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 50% 40% at 50% 45%, rgba(34,211,238,0.04) 0%, transparent 70%)',
        }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center text-center max-w-xl px-6 gap-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Icon */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 0 30px rgba(34,211,238,0.1)',
            }}
          >
            <Activity size={32} style={{ color: 'var(--cyan)' }} />
          </div>
        </motion.div>

        {/* Title */}
        <div>
          <h1
            className="font-black"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 4.5rem)', letterSpacing: '-0.04em', lineHeight: 1 }}
          >
            <span style={{ color: 'var(--cyan)' }}>NET</span>
            <span style={{ color: 'var(--text-1)' }}>PULSE</span>
          </h1>
          <p
            className="mt-3 text-sm font-medium uppercase tracking-[0.25em]"
            style={{ color: 'var(--text-3)' }}
          >
            Continuous Internet Diagnostics
          </p>
        </div>

        {/* Features */}
        <div className="flex flex-col gap-2 w-full max-w-sm">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              className="card flex items-center gap-3 px-4 py-2.5"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
            >
              <span style={{ color: 'var(--cyan)' }}>{f.icon}</span>
              <span className="text-sm" style={{ color: 'var(--text-2)' }}>{f.text}</span>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          className="btn-primary px-10 py-3.5 text-sm font-black uppercase tracking-[0.12em]"
          style={{ borderRadius: 14 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/dashboard')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Start Monitoring
        </motion.button>

        <p
          className="text-[11px] tracking-widest uppercase"
          style={{ color: 'var(--text-3)' }}
        >
          No account needed · Browser-based
        </p>
      </motion.div>
    </div>
  );
}
