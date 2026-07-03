import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sparkles, Image as ImageIcon, Terminal } from 'lucide-react';
import { audioManager } from '../game/audio';
import type { VaultCard } from '../services/vaultService';

interface DecryptionAnimationProps {
  reward: {
    type: string;
    value: string;
    details?: {
      tokensGranted?: number;
      card?: VaultCard;
      skinUnlocked?: string;
    };
  };
  onClose: () => void;
}

interface ShardParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  angle: number;
  spin: number;
  alpha: number;
  decay: number;
  points: number; // For polygon drawing
}

export default function DecryptionAnimation({ reward, onClose }: DecryptionAnimationProps) {
  const [phase, setPhase] = useState<'idle' | 'shaking' | 'bursting' | 'revealed'>('idle');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<ShardParticle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize and run particle system
  const triggerBurst = () => {
    setPhase('bursting');
    audioManager.playSfx('open_chest', 0.95);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Spawn shards
    const colors = [
      '#39FF14', // Neon Green
      '#00F0FF', // Neon Cyan
      '#FF007F', // Neon Pink
      '#FFB800', // Neon Gold
      '#BD00FF', // Neon Purple
    ];

    const particles: ShardParticle[] = [];
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      
      // Burst outwards, with a slight upward bias
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3, // Shoot upward
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        alpha: 1,
        decay: 0.012 + Math.random() * 0.015,
        points: Math.floor(Math.random() * 3) + 3, // 3 to 5 points (triangles, diamonds, pentagons)
      });
    }

    particlesRef.current = particles;

    // Physics Loop
    let startTimestamp: number | null = null;
    const loop = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const activeParticles = particlesRef.current.filter((p) => p.alpha > 0);
      
      for (const p of activeParticles) {
        // Apply physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16; // Gravity
        p.vx *= 0.97; // Drag
        p.vy *= 0.97;
        p.angle += p.spin;
        p.alpha -= p.decay;

        // Draw glowing crystal shard
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;

        ctx.beginPath();
        for (let j = 0; j < p.points; j++) {
          const shardAngle = (j * Math.PI * 2) / p.points;
          const r = j % 2 === 0 ? p.size : p.size / 2; // Make it star-like/crystal-like
          const px = Math.cos(shardAngle) * r;
          const py = Math.sin(shardAngle) * r;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      particlesRef.current = activeParticles;

      // Transition to revealed phase once particles settle
      if (elapsed > 1600 && phase === 'bursting') {
        setPhase('revealed');
        audioManager.playSfx('song_completion', 0.85);
      }

      if (activeParticles.length > 0 || elapsed < 2500) {
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  // Adjust canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleInteract = () => {
    if (phase !== 'idle') return;
    setPhase('shaking');
    audioManager.playSfx('tap_nav', 0.4);
    setTimeout(triggerBurst, 800); // Shake for 800ms, then burst
  };

  return (
    <div className="relative w-full min-h-[400px] bg-black/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Canvas Layer for Shards */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-20 pointer-events-none"
      />

      <AnimatePresence mode="wait">
        {/* Closed/Shaking Bag Phase */}
        {(phase === 'idle' || phase === 'shaking') && (
          <motion.div
            key="closed-bag"
            exit={{ scale: 0.6, opacity: 0 }}
            className="flex flex-col items-center gap-6 z-10 cursor-pointer text-center select-none"
            onClick={handleInteract}
          >
            {/* Ambient background glow */}
            <div className="absolute w-48 h-48 rounded-full bg-radial-gradient blur-3xl opacity-20 pointer-events-none"
              style={{
                background: 'radial-gradient(circle, var(--color-neon-gold) 0%, transparent 70%)',
              }}
            />

            {/* Glowing Pouch Pushing / Shaking */}
            <motion.div
              animate={
                phase === 'shaking'
                  ? {
                      x: [0, -8, 8, -6, 6, -3, 3, 0],
                      y: [0, 4, -4, 3, -3, 1, -1, 0],
                      scale: [1, 1.15, 1.25, 1.2, 1.3, 1.25, 1.35, 1.25],
                      rotate: [0, -4, 4, -3, 3, -1, 1, 0],
                    }
                  : {
                      y: [0, -10, 0],
                      scale: [1, 1.04, 1],
                    }
              }
              transition={
                phase === 'shaking'
                  ? { duration: 0.8, ease: 'easeInOut' }
                  : { repeat: Infinity, duration: 3, ease: 'easeInOut' }
              }
              className="relative w-40 h-40 filter drop-shadow-[0_0_25px_rgba(255,184,0,0.35)]"
            >
              {/* Premium Vector SVG Cyber Pouch */}
              <svg viewBox="0 0 120 120" className="w-full h-full">
                <defs>
                  <linearGradient id="bagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1a1200" />
                    <stop offset="50%" stopColor="#0a0700" />
                    <stop offset="100%" stopColor="#251a02" />
                  </linearGradient>
                  <linearGradient id="neonTrim" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ffb800" />
                    <stop offset="50%" stopColor="#ff5500" />
                    <stop offset="100%" stopColor="#ffb800" />
                  </linearGradient>
                </defs>

                {/* Draw string ties */}
                <path d="M 50,22 Q 60,35 70,22 M 45,20 L 35,15 M 75,20 L 85,15" stroke="#ffb800" strokeWidth="2.5" fill="none" strokeLinecap="round" />

                {/* Hexagonal Bag body */}
                <path
                  d="M 60,18 L 92,38 L 98,82 L 60,108 L 22,82 L 28,38 Z"
                  fill="url(#bagGrad)"
                  stroke="url(#neonTrim)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />

                {/* Futuristic detailing panels */}
                <path d="M 34,42 L 54,34 L 54,92 L 28,78 Z" fill="#ffffff" fillOpacity="0.03" />
                <path d="M 86,42 L 66,34 L 66,92 L 92,78 Z" fill="#ffffff" fillOpacity="0.03" />

                {/* Matrix circuit lines */}
                <path d="M 30,55 L 42,50 L 42,75" stroke="#ffb800" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
                <path d="M 90,55 L 78,50 L 78,75" stroke="#ffb800" strokeWidth="1.5" strokeOpacity="0.4" fill="none" />

                {/* central power core padlock */}
                <circle cx="60" cy="62" r="14" fill="#111" stroke="#ffb800" strokeWidth="2" />
                
                {/* Glow Core */}
                <circle cx="60" cy="62" r="8" fill="#ffb800" className="animate-pulse" />

                {/* Lock icon grid */}
                <path d="M 56,60 L 64,60 M 60,56 L 60,68" stroke="#000" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </motion.div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-[#ffb800] uppercase blink">
                {phase === 'shaking' ? '✦ DECRYPTING TRANSMISSION ✦' : '✦ CLICK POUCH TO DECRYPT ✦'}
              </span>
              <p className="text-[9px] font-mono text-zinc-500 uppercase">// ENCRYPTED DATA BAG RECIEVED</p>
            </div>
          </motion.div>
        )}

        {/* Bursting / Expelled Particles (Wait for reveal) */}
        {phase === 'bursting' && (
          <motion.div
            key="burst-core"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 2, 1.5], opacity: [0.8, 1, 0.4] }}
            transition={{ duration: 0.8 }}
            className="absolute w-24 h-24 rounded-full bg-white blur-xl pointer-events-none"
          />
        )}

        {/* Glory Reveal Phase */}
        {phase === 'revealed' && (
          <motion.div
            key="glory-reveal"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-6 z-10 max-w-sm"
          >
            {/* Cyber halo */}
            <div className="absolute w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{
                background: 'radial-gradient(circle, #39FF14 0%, transparent 70%)',
              }}
            />

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#39FF14] tracking-widest uppercase mb-4">
                <Sparkles size={13} className="animate-spin" />
                <span>DECRYPT SUCCESSFUL</span>
              </div>

              {/* Reward rendering */}
              {reward.type === 'tokens' && (
                <motion.div 
                  initial={{ rotate: -10, scale: 0.5 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="py-2 flex flex-col items-center"
                >
                  <div className="w-20 h-20 rounded-full bg-[#ffb800]/10 border border-[#ffb800]/30 flex items-center justify-center shadow-[0_0_30px_rgba(255,184,0,0.3)]">
                    <Zap size={44} className="text-[#ffb800] fill-[#ffb800]/20 animate-bounce" />
                  </div>
                  <div className="text-4xl font-black font-mono text-[#ffb800] mt-4 tracking-tighter" style={{ textShadow: '0 0 15px rgba(255,184,0,0.4)' }}>
                    +{reward.details?.tokensGranted?.toLocaleString() || reward.value}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 tracking-wider mt-1 uppercase">VAULT TOKENS CREDITED</div>
                </motion.div>
              )}

              {reward.type === 'card' && reward.details?.card && (
                <motion.div
                  initial={{ rotate: 10, scale: 0.5 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="py-2 flex flex-col items-center"
                >
                  <div className="w-32 aspect-[3/4] rounded-lg overflow-hidden border border-white/20 mb-4 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                    <img
                      src={reward.details.card.coverUrl}
                      alt="Reward Card"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10" style={{ color: 'var(--color-neon-cyan)' }}>
                    {reward.details.card.rarity}
                  </div>
                  <div className="text-2xl font-black uppercase text-white mt-2 leading-none">
                    {reward.details.card.title}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">
                    ADDED TO COLLECTION
                  </div>
                </motion.div>
              )}

              {reward.type === 'pack' && reward.details?.card && (
                <motion.div
                  initial={{ rotate: 10, scale: 0.5 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="py-2 flex flex-col items-center"
                >
                  <div className="relative w-32 aspect-[3/4] mb-4">
                    {/* Visual stack of cards */}
                    <div className="absolute inset-0 rounded-lg bg-black/50 border border-white/10 translate-x-2 translate-y-2 opacity-40" />
                    <div className="absolute inset-0 rounded-lg bg-black/55 border border-white/10 translate-x-1 translate-y-1 opacity-70" />
                    <div className="absolute inset-0 rounded-lg overflow-hidden border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                      <img
                        src={reward.details.card.coverUrl}
                        alt="Reward Card"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10" style={{ color: 'var(--color-neon-gold)' }}>
                    PROMO PACK ({reward.value} CARDS)
                  </div>
                  <div className="text-2xl font-black uppercase text-white mt-2 leading-none">
                    {reward.details.card.title} +More
                  </div>
                  <div className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">
                    ADDED TO COLLECTION
                  </div>
                </motion.div>
              )}

              {reward.type === 'background_skin' && (
                <motion.div
                  initial={{ y: 20, scale: 0.5 }}
                  animate={{ y: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="py-2 flex flex-col items-center"
                >
                  <div className="w-24 h-16 rounded border border-[#ff3800]/40 bg-black/60 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(255,56,0,0.2)]">
                    <ImageIcon size={32} className="text-[#ffd700]" />
                  </div>
                  <div className="font-mono text-[9px] tracking-widest text-[#ffd700] uppercase">
                    THEME UNLOCKED
                  </div>
                  <div className="text-xl font-black uppercase text-white mt-1">
                    {reward.details?.skinUnlocked?.replace('_', ' ') || reward.value}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500 mt-2 max-w-[240px] leading-relaxed uppercase">
                    Background theme is now permanently unlocked in options.
                  </div>
                </motion.div>
              )}

              {reward.type === 'cheat_code' && (
                <motion.div
                  initial={{ y: 20, scale: 0.5 }}
                  animate={{ y: 0, scale: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="py-2 flex flex-col items-center"
                >
                  <div className="w-20 h-20 rounded border border-[#39FF14]/40 bg-black/60 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(57,255,20,0.2)]">
                    <Terminal size={36} className="text-[#39FF14] animate-pulse" />
                  </div>
                  <div className="font-mono text-[9px] tracking-widest text-[#39FF14] uppercase">
                    ACCESS OVERRIDE DECRYPTED
                  </div>
                  <div className="text-2xl font-black uppercase text-white mt-1 font-mono tracking-wider">
                    {reward.value}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 mt-2 max-w-[280px] leading-relaxed uppercase text-center">
                    {reward.value === 'idnoclip' 
                      ? "MISS SYSTEM SAFETY BYPASSED. CONFIGURATION SETTINGS UNLOCKED." 
                      : "PROCEDURAL GENERATOR DECRYPTED. LYRIC & BPM ENGINE ENGAGED."}
                  </div>
                </motion.div>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white text-black font-mono font-bold text-xs uppercase tracking-wider rounded hover:scale-103 active:scale-97 transition-all cursor-pointer shadow-lg"
            >
              Continue
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
