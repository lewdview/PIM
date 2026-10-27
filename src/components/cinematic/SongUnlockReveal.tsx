import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { OwnedCard } from '../../services/vaultService';
import { RARITY_CONFIG, type Rarity } from '../../utils/rarity';
import { useSmartCoverArt } from '../../utils/rarityArtwork';
import { haptics } from '../../utils/haptics';
import Card from '../Card';
import { getCinematicAudioContext, playSignalRiser, playSongUnlockDrop } from './audioEngine';

/**
 * First-pull song unlock — "the signal becomes the song".
 *
 * Choreography (ms from mount):
 *   0    blackout; a hairline signal draws out from the centre
 *   150  two pulses travel in from the screen edges, riser builds
 *   900  OPEN: pulses collide, sub drop + spark burst, the card unfolds out
 *        of the line, the song starts underwater and its low-pass filter opens
 *        up; from here the line is the song's live waveform
 *   1350 SONG UNLOCKED kicker, then title / artist
 *   2100 READY: continue button, tap anywhere to continue
 *
 * Everything per-frame is either canvas or transform/opacity so it stays on the
 * compositor at 60fps on phones.
 */

const OPEN_AT = 900;
const TITLE_AT = 1350;
const READY_AT = 2100;

// The hook usually lives a way into the track, not in the intro.
const HOOK_POSITION = 0.25;
const HOOK_MAX_SECONDS = 45;
const SONG_VOLUME = 0.6;

type Stage = 'signal' | 'open' | 'title' | 'ready';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  width: number;
}

interface Props {
  owned: OwnedCard;
  onContinue: () => void;
}

function accentFor(rarity: Rarity): string {
  // Common's slate reads as "disabled" on black; give it the playback pink instead.
  if (rarity === 'common') return '#FF1493';
  return RARITY_CONFIG[rarity]?.color || '#FF1493';
}

/**
 * The cover drawn into a tiny canvas and stretched to fill the screen: bilinear
 * upscaling gives the heavy blur for free, so there is no full-screen CSS filter
 * to re-rasterise while it fades (that filter alone halved the frame rate).
 */
function CoverBleed({ src, visible }: { src: string; visible: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = ref.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.filter = 'saturate(1.5)';
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, c.width, c.height);
    };
    img.src = src;
    return () => { img.onload = null; };
  }, [src]);

  return (
    <motion.canvas
      ref={ref}
      width={12}
      height={20}
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 0.4 : 0 }}
      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

export default function SongUnlockReveal({ owned, onContinue }: Props) {
  const card = owned.card;
  const rarity = (card.rarity || 'common') as Rarity;
  const accent = accentFor(rarity);
  const reduceMotion = useReducedMotion() ?? false;
  const { src: coverSrc } = useSmartCoverArt(card.coverUrl, rarity);

  const [stage, setStage] = useState<Stage>('signal');
  const stageRef = useRef<Stage>('signal');
  const continuedRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageElRef = useRef<HTMLDivElement | null>(null);
  const lineYRef = useRef(0);
  const sparksRef = useRef<Spark[]>([]);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  const advance = useCallback((next: Stage) => {
    stageRef.current = next;
    setStage(next);
  }, []);

  // ── Audio: preload on mount, start + filter sweep on OPEN ─────────────────
  useEffect(() => {
    if (!card.audioUrl) return;
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.src = card.audioUrl;
    // If the host refuses CORS, retry plain so the song still plays (no live waveform).
    el.onerror = () => {
      if (el.crossOrigin === null) return;
      el.removeAttribute('crossorigin');
      el.src = card.audioUrl;
      el.load();
    };
    audioElRef.current = el;

    return () => {
      el.onerror = null;
      el.pause();
      el.removeAttribute('src');
      el.load();
      nodesRef.current.forEach(n => { try { n.disconnect(); } catch { /* noop */ } });
      nodesRef.current = [];
      analyserRef.current = null;
      gainRef.current = null;
      audioElRef.current = null;
    };
  }, [card.audioUrl]);

  const startSong = useCallback(() => {
    const el = audioElRef.current;
    if (!el) return;

    if (Number.isFinite(el.duration) && el.duration > 0) {
      el.currentTime = Math.min(el.duration * HOOK_POSITION, HOOK_MAX_SECONDS);
    }

    const ctx = getCinematicAudioContext();
    // Only route through Web Audio when the context is actually running (unlocked
    // by the pack tap) and the element was loaded with CORS; otherwise the
    // element would be silent, so fall back to a plain volume fade.
    if (ctx && ctx.state === 'running' && el.crossOrigin !== null) {
      try {
        const src = ctx.createMediaElementSource(el);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 0.9;
        filter.frequency.setValueAtTime(320, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(18000, ctx.currentTime + 1.6);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(SONG_VOLUME, ctx.currentTime + 0.35);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        src.connect(filter).connect(gain).connect(analyser).connect(ctx.destination);
        nodesRef.current = [src, filter, gain, analyser];
        analyserRef.current = analyser;
        gainRef.current = gain;
      } catch {
        analyserRef.current = null;
        gainRef.current = null;
      }
    }

    if (!gainRef.current) {
      el.volume = 0;
      const fadeIn = setInterval(() => {
        el.volume = Math.min(SONG_VOLUME, el.volume + 0.05);
        if (el.volume >= SONG_VOLUME) clearInterval(fadeIn);
      }, 30);
    }

    el.play().catch(e => {
      if (e?.name !== 'AbortError') console.warn('Song unlock playback failed:', e);
    });
  }, []);

  const fadeOutSong = useCallback(() => {
    const el = audioElRef.current;
    if (!el) return;
    const ctx = getCinematicAudioContext();
    if (gainRef.current && ctx) {
      const g = gainRef.current.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(Math.max(g.value, 0.001), ctx.currentTime);
      g.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    } else {
      const fade = setInterval(() => {
        el.volume = Math.max(0, el.volume - 0.06);
        if (el.volume <= 0) clearInterval(fade);
      }, 30);
    }
    setTimeout(() => el.pause(), 520);
  }, []);

  // ── Timeline ───────────────────────────────────────────────────────────────
  useEffect(() => {
    playSignalRiser(OPEN_AT / 1000 - 0.1);
    const timers = [
      window.setTimeout(() => {
        advance('open');
        playSongUnlockDrop();
        haptics.packReveal();
        startSong();
        if (!reduceMotion) spawnSparks();
      }, OPEN_AT),
      window.setTimeout(() => advance('title'), TITLE_AT),
      window.setTimeout(() => advance('ready'), READY_AT),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = useCallback(() => {
    if (stageRef.current !== 'ready' || continuedRef.current) return;
    continuedRef.current = true;
    haptics.lightTap();
    fadeOutSong();
    onContinue();
  }, [fadeOutSong, onContinue]);

  // ── Canvas: signal line → live waveform, plus spark burst ─────────────────
  function spawnSparks() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const cx = w / 2;
    const cy = lineYRef.current;
    const sparks: Spark[] = [];
    for (let i = 0; i < 56; i++) {
      // Bias the burst along the line so it reads as the signal splitting open.
      const horizontal = i % 3 !== 0;
      const angle = horizontal
        ? (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.5
        : Math.random() * Math.PI * 2;
      const speed = (horizontal ? 9 : 5) + Math.random() * 9;
      sparks.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        width: 1 + Math.random() * 2,
      });
    }
    sparksRef.current = sparks;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const el = stageElRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        lineYRef.current = r.top + r.height / 2;
      } else {
        lineYRef.current = h * 0.45;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    // Card art / fonts can shift the stage after mount; keep the line centred on it.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro && stageElRef.current) ro.observe(stageElRef.current);

    const samples = new Uint8Array(1024);
    const start = performance.now();
    let last = start;
    let raf = 0;

    const draw = (now: number) => {
      const t = now - start;
      // Spark physics is tuned per 60fps frame; scale by real elapsed time.
      const f = Math.min(3, (now - last) / (1000 / 60));
      last = now;
      const cy = lineYRef.current;
      const cx = w / 2;
      ctx.clearRect(0, 0, w, h);

      // Line draws outward from the centre.
      const drawIn = Math.min(1, t / 450);
      const half = (w / 2) * (1 - Math.pow(1 - drawIn, 3));
      const opened = stageRef.current !== 'signal';
      const amp = Math.min(70, h * 0.09);

      const analyser = analyserRef.current;
      if (opened && analyser) analyser.getByteTimeDomainData(samples);

      const grad = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, accent);
      grad.addColorStop(1, 'rgba(255,255,255,0)');

      // Two converging pulses before OPEN, meeting dead centre at OPEN_AT.
      const pulseT = Math.min(1, Math.max(0, (t - 150) / (OPEN_AT - 150)));
      const pulseOffset = (w / 2) * (1 - pulseT * pulseT);

      const step = 3;
      ctx.beginPath();
      for (let x = cx - half; x <= cx + half; x += step) {
        let y = 0;
        const fromCentre = Math.abs(x - cx) / (w / 2);
        const taper = 1 - fromCentre * fromCentre;
        if (!opened) {
          const d1 = x - (cx - pulseOffset);
          const d2 = x - (cx + pulseOffset);
          const blip = (d: number) => Math.exp(-(d * d) / 260) * Math.sin(d * 0.35);
          y = (blip(d1) + blip(d2)) * amp * 0.45 * (0.4 + pulseT);
        } else if (analyser) {
          const idx = Math.floor(((x - (cx - half)) / (2 * half || 1)) * (samples.length - 1));
          y = ((samples[idx] - 128) / 128) * amp * 1.6 * taper;
        } else {
          // No analyser (CORS / locked context): a musical-looking stand-in.
          const k = t / 1000;
          y = (Math.sin(x * 0.045 + k * 7) * 0.5 + Math.sin(x * 0.11 - k * 11) * 0.3 + Math.sin(x * 0.023 + k * 3) * 0.4)
            * amp * 0.45 * taper * (0.75 + 0.25 * Math.sin(k * 8));
        }
        if (x === cx - half) ctx.moveTo(x, cy + y);
        else ctx.lineTo(x, cy + y);
      }

      // Cheap glow: a wide faint pass, then a crisp pass (no shadowBlur).
      ctx.strokeStyle = grad;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Spark burst.
      const sparks = sparksRef.current;
      if (sparks.length) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = accent;
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.x += s.vx * f;
          s.y += s.vy * f;
          s.vx *= Math.pow(0.94, f);
          s.vy *= Math.pow(0.94, f);
          s.life -= s.decay * f;
          if (s.life <= 0) { sparks.splice(i, 1); continue; }
          ctx.globalAlpha = s.life;
          ctx.lineWidth = s.width;
          ctx.strokeStyle = accent;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.vx * 2.2, s.y - s.vy * 2.2);
          ctx.stroke();
          // White-hot head so the burst reads as light, not just colour.
          ctx.globalAlpha = s.life * 0.9;
          ctx.lineWidth = Math.max(0.6, s.width * 0.45);
          ctx.strokeStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.vx * 0.7, s.y - s.vy * 0.7);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ro?.disconnect();
    };
  }, [accent]);

  const isOpen = stage !== 'signal';
  const showTitle = stage === 'title' || stage === 'ready';
  const isReady = stage === 'ready';
  const dayLabel = String(card.day || 0).padStart(3, '0');
  const artist = (card as { artist?: string }).artist || 'TH3SCR1B3';
  const kicker = 'SONG UNLOCKED';

  return (
    <motion.div
      data-testid="song-unlock-reveal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, delay: 0.15 } }}
      onClick={handleContinue}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#040303',
        overflow: 'hidden',
        cursor: isReady ? 'pointer' : 'default',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Cover art bleed: the song's own colours fill the room once it opens */}
      {coverSrc && <CoverBleed src={coverSrc} visible={isOpen} />}

      {/* Flash on OPEN */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={isOpen && !reduceMotion ? { opacity: [0, 0.55, 0] } : { opacity: 0 }}
        transition={{ duration: 0.5, times: [0, 0.12, 1] }}
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 70% 40% at 50% 45%, ${accent}, transparent 70%)`,
        }}
      />

      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Vignette + scanlines (static) */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 90% 90% at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 62%, rgba(0,0,0,0.9) 100%)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.14) 3px, rgba(0,0,0,0.14) 4px)',
      }} />

      {/* Content column — shakes once on OPEN */}
      <motion.div
        animate={isOpen && !reduceMotion ? { x: [0, -5, 4, -2, 1, 0], y: [0, 3, -2, 1, 0, 0] } : {}}
        transition={{ duration: 0.38, ease: 'easeOut' }}
        style={{
          position: 'relative', zIndex: 2, height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 'max(16px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))',
          gap: 'clamp(10px, 2.2vh, 22px)',
        }}
      >
        {/* Day stamp */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.42em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}
        >
          <motion.span
            animate={isOpen || reduceMotion ? { opacity: 1 } : { opacity: [1, 0.25, 1] }}
            transition={isOpen || reduceMotion ? { duration: 0.2 } : { duration: 0.6, repeat: Infinity }}
            style={{ width: 6, height: 6, background: accent, display: 'inline-block', boxShadow: `0 0 10px ${accent}` }}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isOpen ? 'day' : 'acquiring'}
              initial={{ opacity: 0, y: 4, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -4, filter: 'blur(3px)' }}
              transition={{ duration: 0.18 }}
            >
              {isOpen ? `Day ${dayLabel} / 365 · First Pull` : 'Acquiring Signal'}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        {/* Kicker — letters snap in */}
        <div aria-label={kicker} style={{ height: 'clamp(30px, 5.4vh, 44px)', display: 'flex' }}>
          {kicker.split('').map((ch, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={{ y: '60%', opacity: 0, filter: 'blur(6px)' }}
              animate={showTitle ? { y: '0%', opacity: 1, filter: 'blur(0px)' } : { y: '60%', opacity: 0, filter: 'blur(6px)' }}
              transition={{ delay: showTitle ? i * 0.028 : 0, type: 'spring', stiffness: 520, damping: 30 }}
              style={{
                display: 'inline-block', whiteSpace: 'pre',
                fontFamily: 'Anton, Impact, "Arial Black", sans-serif',
                fontSize: 'clamp(26px, 5vh, 40px)', lineHeight: 1.1,
                letterSpacing: '0.08em', color: '#fff',
                textShadow: `0 0 24px ${accent}aa`,
              }}
            >
              {ch}
            </motion.span>
          ))}
        </div>

        {/* Card stage */}
        <div ref={stageElRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Rotating light rays */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scale: 0.4 }}
            animate={isOpen ? { opacity: 0.85, scale: 1 } : { opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'absolute', width: 'min(150vw, 820px)', aspectRatio: '1', pointerEvents: 'none' }}
          >
            <div
              className={reduceMotion ? undefined : 'song-unlock-rays'}
              style={{
                width: '100%', height: '100%', borderRadius: '50%',
                // Soft-edged rays: each one ramps in and out so the turning edges don't alias.
                background: `repeating-conic-gradient(from 0deg, ${accent}00 0deg, ${accent}4d 4deg, ${accent}00 8deg, transparent 18deg)`,
                WebkitMaskImage: 'radial-gradient(circle, #000 8%, transparent 62%)',
                maskImage: 'radial-gradient(circle, #000 8%, transparent 62%)',
              }}
            />
          </motion.div>

          {/* Glow disk (gradient, not filter, so it stays cheap) */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scale: 0.6 }}
            animate={isOpen ? { opacity: [0, 1, 0.75], scale: [0.6, 1.15, 1] } : { opacity: 0, scale: 0.6 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            style={{
              position: 'absolute', width: 'min(110vw, 560px)', aspectRatio: '1', borderRadius: '50%',
              background: `radial-gradient(circle, ${accent}55 0%, ${accent}18 38%, transparent 66%)`,
              pointerEvents: 'none',
            }}
          />

          {/* Shockwave rings */}
          {[0, 0.12].map(delay => (
            <motion.div
              key={delay}
              aria-hidden
              initial={{ opacity: 0, scale: 0.15 }}
              animate={isOpen && !reduceMotion ? { opacity: [0, 0.9, 0], scale: [0.15, 2.6] } : { opacity: 0 }}
              transition={{ duration: 0.9, delay, ease: [0.2, 0.7, 0.3, 1] }}
              style={{
                position: 'absolute', width: 260, height: 260, borderRadius: '50%',
                border: `2px solid ${accent}`, pointerEvents: 'none',
              }}
            />
          ))}

          {/* The card unfolds out of the signal line */}
          <motion.div
            initial={{ scaleY: 0.012, scaleX: 1.25, opacity: 0, y: 0 }}
            animate={isOpen
              ? { scaleY: 1, scaleX: 1, opacity: 1, y: 0 }
              : { scaleY: 0.012, scaleX: 1.25, opacity: 0, y: 0 }}
            exit={{ scale: 0.55, y: '38vh', opacity: 0, transition: { duration: 0.45, ease: [0.55, 0, 0.75, 0] } }}
            transition={reduceMotion
              ? { duration: 0.3 }
              : { scaleY: { type: 'spring', stiffness: 260, damping: 17, mass: 0.9 }, scaleX: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.12 } }}
            style={{
              position: 'relative', transformOrigin: '50% 50%', willChange: 'transform, opacity',
              // Card fills its parent's width, so size it here: as wide as fits, but
              // never so tall that the title and button drop below the fold.
              width: 'min(64vw, 264px, 31vh)',
            }}
          >
            <Card card={card} interactive={false} showAudio={false} isRevealed={true} />

            {/* One light sweep across the face as it lands */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 12 }}>
              <motion.div
                initial={{ x: '-130%' }}
                animate={isOpen && !reduceMotion ? { x: '130%' } : { x: '-130%' }}
                transition={{ delay: 0.35, duration: 0.85, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  position: 'absolute', top: '-20%', bottom: '-20%', width: '60%',
                  background: 'linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.55) 50%, transparent 80%)',
                  mixBlendMode: 'overlay', transform: 'skewX(-12deg)',
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* Title / artist */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={showTitle ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          transition={{ delay: showTitle ? 0.3 : 0, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: 'center', maxWidth: 340 }}
        >
          <h2 style={{
            margin: 0, color: '#fff', fontFamily: 'Anton, Impact, sans-serif',
            fontSize: 'clamp(20px, 3.4vh, 28px)', letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.15,
          }}>
            {card.title}
          </h2>
          <p style={{
            margin: '6px 0 0', fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            color: 'rgba(255,255,255,0.55)', letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            by {artist} · <span style={{ color: accent }}>{RARITY_CONFIG[rarity]?.label || 'COMMON'}</span>
          </p>
        </motion.div>

        {/* Continue */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: isReady ? 'auto' : 'none' }}
        >
          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleContinue(); }}
            whileTap={{ scale: 0.95 }}
            animate={isReady && !reduceMotion
              // Inset only: the button's clip-path would cut off an outer glow.
              ? { boxShadow: [`inset 0 0 0px ${accent}00`, `inset 0 0 22px ${accent}66`, `inset 0 0 0px ${accent}00`] }
              : {}}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            style={{
              padding: '14px 34px', border: `2px solid ${accent}`, background: `${accent}1f`, color: '#fff',
              fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 12,
              letterSpacing: '0.3em', textTransform: 'uppercase', cursor: 'pointer',
              clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
              textShadow: `0 0 16px ${accent}`,
            }}
          >
            Add to Vault ▸
          </motion.button>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase' }}>
            Tap anywhere
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
