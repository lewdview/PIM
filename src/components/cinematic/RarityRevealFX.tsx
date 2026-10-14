import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { motion } from 'framer-motion';
import type { RevealProfile, RevealStage } from './rarityRevealProfiles';

/**
 * Full-screen, tier-driven reveal FX for a single card flip.
 * Purely presentational: PackContainer drives `stage` on its own timeline,
 * this layer renders whatever the active profile asks for.
 */

export interface TierRevealState {
  /** Unique per card flip so animations restart cleanly. */
  id: number;
  stage: RevealStage;
  profile: RevealProfile;
}

interface Props {
  reveal: TierRevealState | null;
  /**
   * 'back' sits under the card stack (dim, glow, streaks, rays, shockwaves);
   * 'front' sits over it (letterbox, particles, flash, title).
   */
  layer: 'back' | 'front';
  zIndex: number;
  /** Element that receives the impact screen shake (front layer only). */
  shakeTargetRef?: RefObject<HTMLElement | null>;
}

export default function RarityRevealFX({ reveal, layer, zIndex, shakeTargetRef }: Props) {
  const back = layer === 'back';
  const p = reveal?.profile;
  const stage = reveal?.stage;
  const charging = stage === 'charge';
  const impacting = stage === 'impact';
  const lit = stage === 'impact' || stage === 'afterglow';

  // Screen shake via WAAPI so we don't fight framer's transforms on the cards.
  useEffect(() => {
    if (back || !impacting || !p || p.shake <= 0) return;
    const el = shakeTargetRef?.current;
    if (!el || typeof el.animate !== 'function') return;
    const a = p.shake;
    const frames: Keyframe[] = [];
    for (let k = 0; k <= 10; k++) {
      const falloff = 1 - k / 10;
      frames.push({
        transform: k === 10
          ? 'translate(0,0) rotate(0deg)'
          : `translate(${(Math.random() * 2 - 1) * a * falloff}px, ${(Math.random() * 2 - 1) * a * falloff}px) rotate(${(Math.random() * 2 - 1) * a * 0.04 * falloff}deg)`,
      });
    }
    const anim = el.animate(frames, { duration: 380 + a * 18, easing: 'cubic-bezier(.2,.7,.3,1)' });
    return () => anim.cancel();
  }, [back, impacting, reveal?.id, p, shakeTargetRef]);

  if (!reveal || !p) return null;

  return (
    <div
      key={reveal.id}
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex, pointerEvents: 'none', overflow: 'hidden' }}
    >
      {/* Backdrop dim — deepest during charge, eases back after impact */}
      {back && p.dim > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: charging ? p.dim : p.dim * 0.55 }}
          transition={{ duration: charging ? Math.min(0.6, p.chargeMs / 2000) : 0.8, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, #000 70%)`,
          }}
        />
      )}

      {/* Letterbox bars */}
      {!back && p.letterbox && (
        <>
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease: [0.7, 0, 0.2, 1] }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '11vh', background: '#000', borderBottom: `1px solid ${p.color}55` }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease: [0.7, 0, 0.2, 1] }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '11vh', background: '#000', borderTop: `1px solid ${p.color}55` }}
          />
        </>
      )}

      {/* ── CHARGE ─────────────────────────────────────────────── */}
      {back && charging && <ChargeCore p={p} />}
      {back && charging && p.streaks > 0 && <Streaks p={p} />}
      {!back && charging && p.arcs > 0 && <Arcs p={p} />}
      {back && charging && p.heartbeat && <Seams p={p} />}

      {/* ── IMPACT / AFTERGLOW ─────────────────────────────────── */}
      {back && lit && p.rays > 0 && <Rays p={p} />}
      {back && lit && <AfterglowCore p={p} />}
      {back && impacting && Array.from({ length: p.shockwaves }).map((_, k) => (
        <motion.div
          key={`sw-${k}`}
          initial={{ scale: 0.15, opacity: 0.95 }}
          animate={{ scale: 3.4 + k * 0.6, opacity: 0 }}
          transition={{ duration: 0.75 + k * 0.15, delay: k * 0.12, ease: [0.1, 0.8, 0.3, 1] }}
          style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 260, height: 260, marginLeft: -130, marginTop: -130,
            borderRadius: '50%',
            border: `${k === 0 ? 4 : 2}px solid ${k % 2 ? p.accent : p.color}`,
            boxShadow: `0 0 40px ${p.color}, inset 0 0 30px ${p.color}88`,
          }}
        />
      ))}
      {!back && impacting && p.particles > 0 && <ParticleBurst p={p} />}
      {!back && impacting && p.flash > 0 && (
        <motion.div
          initial={{ opacity: p.flash }}
          animate={{ opacity: 0 }}
          transition={{ duration: p.tier >= 4 ? 0.9 : p.tier >= 3 ? 0.45 : 0.25, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0,
            background: p.tier >= 2
              ? p.flashColor
              : `radial-gradient(circle at center, ${p.flashColor}, transparent 60%)`,
            mixBlendMode: p.tier >= 2 ? 'normal' : 'screen',
          }}
        />
      )}
      {!back && lit && p.title && <TitleSlam p={p} />}
    </div>
  );
}

// ── Charge pieces ───────────────────────────────────────────────────

function ChargeCore({ p }: { p: RevealProfile }) {
  const secs = p.chargeMs / 1000;
  // Mythic beats like a heart that speeds up; others swell steadily.
  if (p.heartbeat) {
    const beats = 5;
    const scale: number[] = [];
    const opacity: number[] = [];
    const times: number[] = [];
    for (let b = 0; b < beats; b++) {
      const t0 = Math.pow(b / beats, 0.75);
      const t1 = Math.min(1, t0 + 0.05);
      const s = 0.6 + (b / beats) * 1.4;
      scale.push(s * 0.85, s * 1.15);
      opacity.push(0.35 + b * 0.1, 0.75 + b * 0.05);
      times.push(t0, t1);
    }
    scale.push(2.4); opacity.push(1); times.push(1);
    return (
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale, opacity }}
        transition={{ duration: secs, times, ease: 'easeOut' }}
        style={coreStyle(p, 340)}
      />
    );
  }
  return (
    <motion.div
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1 + p.tier * 0.35, opacity: 0.35 + p.tier * 0.15 }}
      transition={{ duration: secs, ease: [0.5, 0, 0.9, 0.6] }}
      style={coreStyle(p, 300)}
    />
  );
}

function AfterglowCore({ p }: { p: RevealProfile }) {
  return (
    <motion.div
      initial={{ scale: 1.6 + p.tier * 0.2, opacity: 0.25 + p.tier * 0.15 }}
      animate={{ scale: [null, 1.1 + p.tier * 0.1, 1.25 + p.tier * 0.1], opacity: [null, 0.18 + p.tier * 0.08, 0.12 + p.tier * 0.06] }}
      transition={{ duration: 2.4, ease: 'easeOut', times: [0, 0.4, 1] }}
      style={coreStyle(p, 360)}
    />
  );
}

function coreStyle(p: RevealProfile, size: number): CSSProperties {
  return {
    position: 'absolute', left: '50%', top: '50%',
    width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${p.color}cc 0%, ${p.color}55 35%, transparent 70%)`,
    filter: 'blur(14px)',
    mixBlendMode: 'screen',
  };
}

function Streaks({ p }: { p: RevealProfile }) {
  const streaks = useMemo(
    () => Array.from({ length: p.streaks }, (_, k) => ({
      angle: (360 / p.streaks) * k + Math.random() * 12,
      delay: Math.random() * 0.6,
      len: 80 + Math.random() * 140,
      dur: 0.45 + Math.random() * 0.35,
      color: Math.random() < 0.3 ? p.accent : p.color,
    })),
    [p],
  );
  return (
    <>
      {streaks.map((s, k) => (
        <div
          key={k}
          style={{
            position: 'absolute', left: '50%', top: '50%', width: 0, height: 0,
            transform: `rotate(${s.angle}deg)`,
          }}
        >
          <motion.div
            initial={{ x: '75vmax', opacity: 0 }}
            animate={{ x: [ '75vmax', '6vmax' ], opacity: [0, 1, 0] }}
            transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, repeatDelay: Math.random() * 0.2, ease: [0.6, 0, 1, 1] }}
            style={{
              position: 'absolute', top: -1, left: 0,
              width: s.len, height: 2,
              background: `linear-gradient(90deg, ${s.color}, transparent)`,
              boxShadow: `0 0 8px ${s.color}`,
            }}
          />
        </div>
      ))}
    </>
  );
}

function jaggedPath(x0: number, y0: number, x1: number, y1: number, segs: number, jitter: number) {
  let d = `M ${x0} ${y0}`;
  for (let s = 1; s < segs; s++) {
    const t = s / segs;
    const x = x0 + (x1 - x0) * t + (Math.random() * 2 - 1) * jitter;
    const y = y0 + (y1 - y0) * t + (Math.random() * 2 - 1) * jitter;
    d += ` L ${x} ${y}`;
  }
  return `${d} L ${x1} ${y1}`;
}

function Arcs({ p }: { p: RevealProfile }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 85);
    return () => clearInterval(t);
  }, []);
  const paths = useMemo(() => {
    const out: string[] = [];
    for (let k = 0; k < p.arcs; k++) {
      // Arcs only fire some of the time — erratic, not a strobe.
      if (Math.random() < 0.45) continue;
      const a = Math.random() * Math.PI * 2;
      const r0 = 70 + Math.random() * 20;
      const r1 = 42;
      out.push(jaggedPath(50 + Math.cos(a) * r0, 50 + Math.sin(a) * r0, 50 + Math.cos(a) * r1 * 0.3, 50 + Math.sin(a) * r1 * 0.3, 9, 3.2));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, p.arcs]);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      {paths.map((d, k) => (
        <g key={k}>
          <path d={d} stroke={p.color} strokeWidth={0.9} fill="none" opacity={0.5} style={{ filter: `blur(1.2px)` }} />
          <path d={d} stroke="#fff" strokeWidth={0.22} fill="none" />
        </g>
      ))}
    </svg>
  );
}

function Seams({ p }: { p: RevealProfile }) {
  // Gold light leaking through cracks around the card, growing as the charge peaks.
  const seams = useMemo(
    () => Array.from({ length: 9 }, () => ({
      angle: Math.random() * 360,
      len: 120 + Math.random() * 260,
      delay: 0.35 + Math.random() * 0.55,
    })),
    [],
  );
  const secs = p.chargeMs / 1000;
  return (
    <>
      {seams.map((s, k) => (
        <div key={k} style={{ position: 'absolute', left: '50%', top: '50%', transform: `rotate(${s.angle}deg)` }}>
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: [0, 1, 0.85] }}
            transition={{ duration: secs * (1 - s.delay), delay: secs * s.delay, ease: 'easeIn' }}
            style={{
              position: 'absolute', left: 140, top: -1.5, width: s.len, height: 3,
              transformOrigin: 'left center',
              background: `linear-gradient(90deg, #fff, ${p.color} 30%, transparent)`,
              boxShadow: `0 0 14px ${p.color}, 0 0 28px ${p.accent}66`,
              clipPath: 'polygon(0 0, 100% 40%, 100% 60%, 0 100%)',
            }}
          />
        </div>
      ))}
    </>
  );
}

// ── Impact pieces ───────────────────────────────────────────────────

function Rays({ p }: { p: RevealProfile }) {
  const layer = (reverse: boolean, slice: number, alpha: string, dur: number, color: string) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
      animate={{ opacity: 1, scale: 1, rotate: reverse ? -360 : 360 }}
      transition={{ opacity: { duration: 0.3 }, scale: { duration: 0.6, ease: 'easeOut' }, rotate: { duration: dur, ease: 'linear', repeat: Infinity } }}
      style={{
        position: 'absolute', left: '50%', top: '50%',
        width: '160vmax', height: '160vmax', marginLeft: '-80vmax', marginTop: '-80vmax',
        background: `repeating-conic-gradient(from 0deg, ${color}${alpha} 0deg ${slice}deg, transparent ${slice}deg ${slice * 3}deg)`,
        WebkitMaskImage: 'radial-gradient(circle, #000 4%, rgba(0,0,0,0.6) 18%, transparent 42%)',
        maskImage: 'radial-gradient(circle, #000 4%, rgba(0,0,0,0.6) 18%, transparent 42%)',
        mixBlendMode: 'screen',
        ...(p.rays === 2 ? { animation: 'cine-prism 3.2s linear infinite' } : {}),
      }}
    />
  );
  return (
    <>
      <style>{`@keyframes cine-prism { 0%{filter:hue-rotate(0deg)} 50%{filter:hue-rotate(-40deg)} 100%{filter:hue-rotate(0deg)} }`}</style>
      {layer(false, p.rays === 2 ? 5 : 4, p.tier >= 3 ? '55' : '38', 26, p.color)}
      {p.rays === 2 && layer(true, 3, '40', 18, p.accent)}
    </>
  );
}

interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; star: boolean; }

function ParticleBurst({ p }: { p: RevealProfile }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.scale(dpr, dpr);
    const cx = w / 2, cy = h / 2;
    const palette = [p.color, p.accent, '#ffffff'];
    const power = 3 + p.tier * 2.2;
    const sparks: Spark[] = Array.from({ length: p.particles }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = (0.3 + Math.random()) * power;
      const max = 40 + Math.random() * (30 + p.tier * 25);
      return {
        x: cx + Math.cos(a) * 30, y: cy + Math.sin(a) * 40,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - (p.tier === 0 ? 0.6 : 1.2),
        life: max, max,
        size: p.tier === 0 ? 1 + Math.random() * 2 : 1.2 + Math.random() * (1.5 + p.tier * 0.6),
        color: p.tier === 0 ? (Math.random() < 0.5 ? p.color : p.accent) : palette[Math.floor(Math.random() * palette.length)],
        star: p.tier >= 2 && Math.random() < 0.25,
      };
    });
    let raf = 0;
    const step = () => {
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      let alive = 0;
      for (const s of sparks) {
        if (s.life <= 0) continue;
        alive++;
        s.life--;
        s.vx *= 0.965; s.vy = s.vy * 0.965 + 0.06;
        s.x += s.vx; s.y += s.vy;
        const t = s.life / s.max;
        g.globalAlpha = Math.min(1, t * 1.6);
        g.fillStyle = s.color;
        if (s.star) {
          const r = s.size * 3 * t + 1;
          g.fillRect(s.x - r, s.y - 0.6, r * 2, 1.2);
          g.fillRect(s.x - 0.6, s.y - r, 1.2, r * 2);
        } else {
          g.beginPath();
          g.arc(s.x, s.y, s.size * (0.4 + t * 0.6), 0, Math.PI * 2);
          g.fill();
        }
      }
      if (alive > 0) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [p]);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

function TitleSlam({ p }: { p: RevealProfile }) {
  const big = p.tier >= 3;
  return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          position: 'absolute', left: 0, right: 0,
          bottom: big ? 'calc(11vh + 14px)' : 'calc(env(safe-area-inset-bottom, 0px) + 6.5rem)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}
      >
        <motion.div
          initial={{ scale: big ? 2.6 : 1.6, opacity: 0, letterSpacing: '0.9em', filter: 'blur(8px)' }}
          animate={{ scale: 1, opacity: 1, letterSpacing: big ? '0.32em' : '0.28em', filter: 'blur(0px)' }}
          transition={{ duration: big ? 0.42 : 0.3, ease: [0.2, 0.9, 0.25, 1.15] }}
          style={{
            fontFamily: '"Outfit", "Impact", "Arial Black", sans-serif',
            fontWeight: 900,
            fontSize: big ? 'clamp(30px, 6.5vw, 60px)' : 'clamp(20px, 4.5vw, 34px)',
            color: '#fff',
            textShadow: `0 0 18px ${p.color}, 0 0 42px ${p.color}, 0 0 2px #fff`,
            WebkitTextStroke: big ? `1px ${p.color}` : undefined,
            paddingLeft: '0.32em', // balance trailing letter-spacing
            ...(p.rays === 2 ? { animation: 'cine-prism 2.4s linear infinite' } : {}),
          }}
        >
          {p.title}
        </motion.div>
        {p.subtitle && (
          <motion.div
            initial={{ opacity: 0, y: 6, letterSpacing: '0.6em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '0.35em' }}
            transition={{ delay: big ? 0.35 : 0.2, duration: 0.45, ease: 'easeOut' }}
            style={{
              fontFamily: '"JetBrains Mono", "Roboto Mono", monospace',
              fontSize: 11, fontWeight: 800, letterSpacing: '0.35em',
              color: p.color,
              padding: '4px 12px',
              background: 'rgba(0,0,0,0.7)',
              border: `1px solid ${p.color}66`,
              clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
            }}
          >
            {p.subtitle}
          </motion.div>
        )}
      </motion.div>
  );
}
