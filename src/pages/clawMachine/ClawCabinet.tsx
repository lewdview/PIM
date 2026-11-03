import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, animate, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { audioManager } from '../../game/audio';
import type { PitPack } from './clawPits';

type Phase = 'idle' | 'aiming' | 'dropping' | 'lifting' | 'carrying' | 'releasing' | 'returning';

const REST_CABLE = 26;          // px of cable showing at rest
const HEAD_H = 58;              // claw head height (svg box)
const GRIP_DEPTH = 30;          // how far the prongs reach down over the pack top
const FLOOR_PAD = 26;           // gap between pack bottoms and the glass bottom
const CHUTE_X = 0.09;           // chute centre (fraction of glass width)
const MIN_X = 0.07;
const MAX_X = 0.95;
const SPEED = 0.55;             // glass widths per second while a direction is held
const GRAB_RADIUS = 0.07;       // how close (fraction of width) the claw must be to a pack centre

function packWidth(p: PitPack, scale = 1) {
  return Math.round((70 + Math.min(p.cardCount, 50) / 50 * 40) * scale);
}
function packHeight(p: PitPack, scale = 1) {
  return Math.round(packWidth(p, scale) * 1.32);
}
/** Spread packs across the floor right of the chute. Deterministic so they don't jump. */
function packX(i: number, n: number) {
  if (n === 1) return 0.6;
  return 0.3 + (i / (n - 1)) * 0.6;
}
function packTilt(i: number) {
  return [-7, 5, -3, 8, -5, 3][i % 6];
}

export interface ClawCabinetProps {
  packs: PitPack[];
  accent: string;
  /** Packs that can't be grabbed right now (e.g. today's free pack already taken). */
  lockedIds?: Set<string>;
  /** Pack currently held at the prize door; it's off the floor until resolved. */
  heldId: string | null;
  disabled?: boolean;
  onPrize: (pack: PitPack) => void;
  onEmptyGrab?: () => void;
  onLockedGrab?: (pack: PitPack) => void;
  /** Rendered over the glass (the prize door ticket). */
  overlay?: React.ReactNode;
}

export default function ClawCabinet({ packs, accent, lockedIds, heldId, disabled, onPrize, onEmptyGrab, onLockedGrab, overlay }: ClawCabinetProps) {
  const glassRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 420 });
  const [phase, setPhase] = useState<Phase>('idle');
  const [carried, setCarried] = useState<PitPack | null>(null);
  const [falling, setFalling] = useState<PitPack | null>(null);
  const [open, setOpen] = useState(true);

  const x = useMotionValue(0.55);
  const cable = useMotionValue(REST_CABLE);
  const sway = useMotionValue(0);
  const leftPct = useTransform(x, v => `${v * 100}%`);
  const headY = useTransform(cable, c => c);

  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  const dirRef = useRef(0);

  useLayoutEffect(() => {
    const el = glassRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Held-direction movement loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (dirRef.current !== 0 && phaseRef.current === 'idle') {
        const next = Math.max(MIN_X, Math.min(MAX_X, x.get() + dirRef.current * SPEED * dt));
        x.set(next);
        sway.set(-dirRef.current * 6);
      } else if (sway.get() !== 0 && dirRef.current === 0) {
        sway.set(sway.get() * 0.85);
        if (Math.abs(sway.get()) < 0.2) sway.set(0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [x, sway]);

  // Shrink packs on narrow glass so a full pit still fits.
  const scale = Math.max(0.55, Math.min(1, (size.w * 0.6 / Math.max(1, packs.length)) / 80 * 1.25));

  const visiblePacks = packs.map((p, i) => ({ p, i, cx: packX(i, packs.length) }));

  const findTarget = useCallback((at: number) => {
    let best: { p: PitPack; cx: number } | null = null;
    let bestD = Infinity;
    for (const { p, cx } of visiblePacks) {
      if (p.id === heldId) continue;
      const d = Math.abs(cx - at);
      if (d < bestD) { bestD = d; best = { p, cx }; }
    }
    return best && bestD <= GRAB_RADIUS ? best : null;
  }, [visiblePacks, heldId]);

  const drop = useCallback(async () => {
    if (phaseRef.current !== 'idle' || disabled || heldId) return;
    dirRef.current = 0;
    const target = findTarget(x.get());
    setPhase('dropping');
    setOpen(true);
    audioManager.playSfx('swipe', 0.5);

    const depth = target
      ? size.h - FLOOR_PAD - packHeight(target.p, scale) + GRIP_DEPTH - HEAD_H
      : size.h - FLOOR_PAD - HEAD_H + 6;
    if (target) {
      // Snap the last few pixels so the prongs land square on the pack.
      animate(x, target.cx, { duration: 0.5, ease: 'easeOut' });
    }
    await animate(cable, depth, { duration: 0.95, ease: [0.45, 0, 0.7, 1] });

    setOpen(false);
    audioManager.playSfx('cas_slam_down', 0.45);
    await new Promise(r => setTimeout(r, 260));

    const locked = target && lockedIds?.has(target.p.id);
    if (target && !locked) setCarried(target.p);

    setPhase('lifting');
    await animate(cable, REST_CABLE, { duration: 0.9, ease: [0.3, 0, 0.3, 1] });

    if (!target || locked) {
      setOpen(true);
      setPhase('idle');
      if (locked) { audioManager.playSfx('locked_out', 0.5); onLockedGrab?.(target!.p); }
      else { audioManager.playSfx('miss', 0.45); onEmptyGrab?.(); }
      return;
    }

    setPhase('carrying');
    const travel = Math.abs(x.get() - CHUTE_X);
    sway.set(8);
    await animate(x, CHUTE_X, { duration: 0.35 + travel * 1.1, ease: 'easeInOut' });
    animate(sway, 0, { type: 'spring', stiffness: 120, damping: 6 });

    setPhase('releasing');
    setOpen(true);
    setFalling(target.p);
    setCarried(null);
    audioManager.playSfx('open_case', 0.7);
    await new Promise(r => setTimeout(r, 520));
    setFalling(null);
    onPrize(target.p);

    setPhase('returning');
    await animate(x, 0.55, { duration: 0.8, ease: 'easeInOut' });
    setPhase('idle');
  }, [disabled, heldId, findTarget, x, cable, sway, size.h, lockedIds, onPrize, onEmptyGrab, onLockedGrab, scale]);

  const aimAndDrop = useCallback(async (cx: number) => {
    if (phaseRef.current !== 'idle' || disabled || heldId) return;
    setPhase('aiming');
    audioManager.playSfx('tap_nav', 0.2);
    await animate(x, cx, { duration: 0.3 + Math.abs(x.get() - cx) * 0.9, ease: 'easeInOut' });
    setPhase('idle');
    phaseRef.current = 'idle';
    drop();
  }, [disabled, heldId, x, drop]);

  // Keyboard: ← → to steer, Space / ↓ / Enter to drop.
  useEffect(() => {
    const typing = () => {
      const t = document.activeElement?.tagName;
      return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT';
    };
    const down = (e: KeyboardEvent) => {
      if (typing()) return;
      if (e.key === 'ArrowLeft') { dirRef.current = -1; e.preventDefault(); }
      else if (e.key === 'ArrowRight') { dirRef.current = 1; e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); drop(); }
    };
    const up = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' && dirRef.current < 0) || (e.key === 'ArrowRight' && dirRef.current > 0)) dirRef.current = 0;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [drop]);

  const hold = (d: number) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); dirRef.current = d; audioManager.playSfx('tap_nav', 0.12); },
    onPointerUp: () => { dirRef.current = 0; },
    onPointerCancel: () => { dirRef.current = 0; },
    onPointerLeave: () => { dirRef.current = 0; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const busy = phase !== 'idle' || !!heldId || !!disabled;
  const statusText = heldId ? 'Prize at the door ↓'
    : phase === 'idle' ? 'Steer, then drop'
    : phase === 'aiming' ? 'Lining up…'
    : phase === 'dropping' ? 'Dropping…'
    : phase === 'lifting' ? (carried ? 'Got it!' : 'Lifting…')
    : phase === 'carrying' ? 'To the chute…'
    : phase === 'releasing' ? 'Prize!'
    : 'Resetting…';

  return (
    <div className="claw-cabinet" style={{ ['--claw-accent' as string]: accent }}>
      {/* Marquee */}
      <div className="claw-marquee">
        <span className="claw-marquee-bulbs" aria-hidden />
        <span className="claw-marquee-title">THE&nbsp;CLAW</span>
        <span className="claw-marquee-status" aria-live="polite">{statusText}</span>
      </div>

      {/* Glass */}
      <div
        ref={glassRef}
        className="claw-glass"
        style={{ ['--pack-s' as string]: scale }}
        onPointerDown={(e) => {
          if (busy || e.target !== e.currentTarget) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const fx = Math.max(MIN_X, Math.min(MAX_X, (e.clientX - rect.left) / rect.width));
          animate(x, fx, { duration: 0.35, ease: 'easeOut' });
        }}
      >
        <div className="claw-glass-back" aria-hidden />
        <div className="claw-rail" aria-hidden />

        {/* Chute */}
        <div className="claw-chute" style={{ left: `${CHUTE_X * 100}%` }} aria-hidden>
          <span>PRIZE</span>
        </div>

        {/* Back-row stock: decoration only, so the pit reads full */}
        {visiblePacks.map(({ p, i, cx }) => (
          <span
            key={`back-${p.id}`}
            className="claw-pack-back"
            aria-hidden
            style={{ left: `${(cx + (i % 2 ? 0.05 : -0.05)) * 100}%`, bottom: FLOOR_PAD + 34, width: packWidth(p, scale) * 0.8, height: packHeight(p, scale) * 0.8, rotate: `${-packTilt(i) * 1.5}deg` }}
          >
            <PackToken pack={p} />
          </span>
        ))}

        {/* Floor packs */}
        {visiblePacks.map(({ p, i, cx }) => {
          const hidden = p.id === heldId || carried?.id === p.id || falling?.id === p.id;
          const locked = lockedIds?.has(p.id);
          return (
            <motion.button
              key={p.id}
              type="button"
              aria-label={`Grab ${p.label}, ${p.cardCount} card${p.cardCount === 1 ? '' : 's'}, ${p.price}`}
              disabled={busy}
              className={`claw-pack-slot${locked ? ' is-locked' : ''}`}
              style={{ left: `${cx * 100}%`, bottom: FLOOR_PAD, width: packWidth(p, scale), height: packHeight(p, scale) }}
              initial={false}
              animate={{ opacity: hidden ? 0 : 1, y: hidden ? -8 : 0, rotate: packTilt(i) }}
              transition={{ duration: hidden ? 0.05 : 0.35 }}
              onClick={() => aimAndDrop(cx)}
            >
              <PackToken pack={p} locked={locked} />
            </motion.button>
          );
        })}

        {/* Falling prize into the chute */}
        <AnimatePresence>
          {falling && (
            <motion.div
              key={falling.id}
              className="claw-falling"
              style={{ left: `${CHUTE_X * 100}%`, width: packWidth(falling, scale), height: packHeight(falling, scale) }}
              initial={{ y: REST_CABLE + HEAD_H - GRIP_DEPTH, rotate: 0, opacity: 1 }}
              animate={{ y: size.h + 20, rotate: 24, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.5, 0, 1, 0.6] }}
            >
              <PackToken pack={falling} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gantry carriage + cable + claw head */}
        <motion.div className="claw-rig" style={{ left: leftPct }} aria-hidden>
          <div className="claw-carriage" />
          <motion.div className="claw-cable" style={{ height: headY }} />
          <motion.div className="claw-head" style={{ y: headY, rotate: sway }}>
            {carried && (
              <div className="claw-carried" style={{ width: packWidth(carried, scale), height: packHeight(carried, scale), top: HEAD_H - GRIP_DEPTH }}>
                <PackToken pack={carried} />
              </div>
            )}
            <ClawHeadSVG open={open} />
          </motion.div>
        </motion.div>

        <div className="claw-glass-glare" aria-hidden />
        <AnimatePresence>{overlay}</AnimatePresence>
      </div>

      {/* Control deck */}
      <div className="claw-deck">
        <div className="claw-deck-stick">
          <button type="button" className="claw-dir" aria-label="Move claw left" disabled={busy} {...hold(-1)}>
            <ChevronLeft size={26} />
          </button>
          <button type="button" className="claw-dir" aria-label="Move claw right" disabled={busy} {...hold(1)}>
            <ChevronRight size={26} />
          </button>
        </div>
        <p className="claw-deck-hint">Hold the arrows or tap a pack. <kbd>←</kbd><kbd>→</kbd> <kbd>Space</kbd></p>
        <button type="button" className="claw-drop" onClick={drop} disabled={busy}>
          <span>DROP</span>
        </button>
      </div>
    </div>
  );
}

function ClawHeadSVG({ open }: { open: boolean }) {
  const a = open ? 26 : 4;
  return (
    <svg viewBox="0 0 64 58" width={64} height={HEAD_H} className="claw-head-svg">
      <defs>
        <linearGradient id="clawMetal" x1="0" x2="1">
          <stop offset="0" stopColor="#6b7280" />
          <stop offset="0.45" stopColor="#f3f4f6" />
          <stop offset="1" stopColor="#4b5563" />
        </linearGradient>
      </defs>
      {/* hub */}
      <rect x="20" y="0" width="24" height="14" rx="3" fill="url(#clawMetal)" stroke="#111" strokeWidth="1" />
      <rect x="22" y="12" width="20" height="5" rx="1.5" fill="var(--claw-accent)" opacity="0.9" />
      {/* prongs: rotate around the hub base */}
      <g style={{ transform: `rotate(${a}deg)`, transformOrigin: '26px 16px', transformBox: 'view-box', transition: 'transform 0.22s cubic-bezier(.3,1.6,.5,1)' }}>
        <path d="M26 16 L18 36 L22 54 L26 53 L23 37 L30 18 Z" fill="url(#clawMetal)" stroke="#111" strokeWidth="1" />
      </g>
      <g style={{ transform: `rotate(${-a}deg)`, transformOrigin: '38px 16px', transformBox: 'view-box', transition: 'transform 0.22s cubic-bezier(.3,1.6,.5,1)' }}>
        <path d="M38 16 L46 36 L42 54 L38 53 L41 37 L34 18 Z" fill="url(#clawMetal)" stroke="#111" strokeWidth="1" />
      </g>
      <path d="M30 17 L32 44 L34 17 Z" fill="#9ca3af" stroke="#111" strokeWidth="0.8" />
    </svg>
  );
}

export function PackToken({ pack, locked }: { pack: PitPack; locked?: boolean }) {
  return (
    <span
      className="claw-pack"
      style={{
        ['--pack-accent' as string]: pack.accent,
        backgroundImage: pack.coverImage
          ? `linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.85)), url("${pack.coverImage}")`
          : undefined,
      }}
    >
      {!pack.coverImage && <span className="claw-pack-icon">{pack.icon}</span>}
      <span className="claw-pack-count">{pack.cardCount}<small>{pack.cardCount === 1 ? 'card' : 'cards'}</small></span>
      <span className="claw-pack-price">{locked ? 'TAKEN' : pack.price}</span>
    </span>
  );
}
