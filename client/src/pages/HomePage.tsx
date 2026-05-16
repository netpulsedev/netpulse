import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Activity, Wifi, Zap, Shield } from 'lucide-react';

// Animated particle canvas
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

    const COLORS = ['#00E5FF', '#7C4DFF', '#00FF95'];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Spawn particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,229,255,${0.06 * (1 - dist / 120)})`;
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

const FEATURE_LIST = [
  { icon: <Activity size={18} />, label: 'Realtime ping, jitter & packet loss' },
  { icon: <Zap size={18} />, label: 'Adaptive throughput testing' },
  { icon: <Shield size={18} />, label: 'Stability score (0–100)' },
  { icon: <Wifi size={18} />, label: 'Alignment mode for dead-zone hunting' },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background canvas */}
      <ParticleCanvas />

      {/* Animated grid overlay */}
      <div className="absolute inset-0 animated-grid pointer-events-none" />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,229,255,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center max-w-2xl px-6 gap-8"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Logo pulse */}
        <motion.div
          className="relative"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #00E5FF20, #7C4DFF20)',
              border: '1px solid rgba(0,229,255,0.3)',
              boxShadow: '0 0 40px rgba(0,229,255,0.2), 0 0 80px rgba(124,77,255,0.1)',
            }}
          >
            <Activity size={40} color="#00E5FF" />
          </div>
          {/* Ping rings */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-2xl border"
              style={{
                borderColor: `rgba(0,229,255,${0.3 - i * 0.08})`,
                transform: `scale(${1 + i * 0.25})`,
                animation: `ping-ring ${2 + i * 0.7}s ease-out infinite`,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}
        </motion.div>

        {/* Title */}
        <div>
          <h1
            className="font-black tracking-tight"
            style={{ fontSize: 'clamp(3rem, 8vw, 5rem)', letterSpacing: '-0.04em' }}
          >
            <span className="gradient-text-cyan">NET</span>
            <span style={{ color: '#F0F4FF' }}>PULSE</span>
          </h1>
          <p
            className="mt-3 text-lg font-medium uppercase tracking-[0.3em]"
            style={{ color: 'rgba(240,244,255,0.45)' }}
          >
            Continuous Internet Diagnostics
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-col gap-2.5 w-full max-w-sm">
          {FEATURE_LIST.map((f, i) => (
            <motion.div
              key={f.label}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <span style={{ color: '#00E5FF' }}>{f.icon}</span>
              <span className="text-sm" style={{ color: 'rgba(240,244,255,0.65)' }}>{f.label}</span>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          id="btn-start-monitoring"
          className="btn-primary px-10 py-4 text-base font-black uppercase tracking-[0.15em]"
          style={{ fontSize: '1rem', borderRadius: '14px' }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/dashboard')}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          aria-label="Start monitoring"
        >
          Start Monitoring
        </motion.button>

        <motion.p
          className="text-xs tracking-widest uppercase"
          style={{ color: 'rgba(240,244,255,0.2)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          No account required · Runs entirely in your browser
        </motion.p>
      </motion.div>
    </div>
  );
}
