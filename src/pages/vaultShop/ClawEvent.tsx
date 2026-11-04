import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, animate, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { audioManager } from '../../game/audio';
import type { OwnedCard } from '../../services/vaultService';
import { PackToken } from './PackToken';
import type { PitPack } from './clawPits';

/**
 * Full-screen bonus claw event.
 *
 * One pull buys three tries. The claw swings on its own; tap to stop it and it drops.
 * Tries one and two always slip. Try three wins whatever pack is under the claw: that is
 * when the pull is spent (onWin), so backing out before then costs nothing.
 */

export type ClawWinResult = { cards: OwnedCard[] } | { error: string; pullUsed: boolean };

export interface ClawEventProps {
  packs: PitPack[];
  /** Third grab closed on `pack`: spend the pull and mint it. */
  onWin: (pack: PitPack) => Promise<ClawWinResult>;
  /** Player tapped "Open it" on the prize. */
  onOpen: (pack: PitPack, cards: OwnedCard[]) => void;
  onClose: () => void;
}

type Phase = 'intro' | 'swing' | 'drop' | 'grip' | 'lift' | 'slip' | 'carry' | 'release' | 'won' | 'jammed';

const TRIES = 3;
const SWING_SPEED = [1.5, 2.0, 2.5];     // radians per second, per try
const CHUTE_X = 0.1;                     // chute centre, fraction of stage width
const RAIL_Y = 54;                       // px from stage top to the rail
const REST_CABLE = 40;
const HEAD_W = 120;
const HEAD_H = 110;
const GRIP = 46;                         // how far the prongs reach down over a pack top
const FLOOR_PAD = 18;
const SLIP_LINES = ['SO CLOSE!', 'ARGH! ONE MORE!'];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function ClawEvent({ packs, onWin, onOpen, onClose }: ClawEventProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [phase, setPhase] = useState<Phase>('intro');
  const [tryNo, setTryNo] = useState(0);
  const [open, setOpen] = useState(true);
  const [carried, setCarried] = useState<PitPack | null>(null);
  const [bounce, setBounce] = useState<{ id: string; from: number; key: number } | null>(null);
  const [falling, setFalling] = useState<PitPack | null>(null);
  const [shout, setShout] = useState<string | null>(null);
  const [prize, setPrize] = useState<{ pack: PitPack; cards: OwnedCard[] } | null>(null);
  const [jamMsg, setJamMsg] = useState('');

  const x = useMotionValue(0.6);
  const cable = useMotionValue(REST_CABLE);
  const sway = useMotionValue(0);
  const rigLeft = useTransform(x, v => v * size.w);

  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const tryRef = useRef(0);
  tryRef.current = tryNo;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);

  // Lock page scroll while the event is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // A fresh, oversized handful of packs each time the event opens.
  const n = size.w < 640 ? 5 : 7;
  const pile = useMemo(() => shuffle(packs), [packs]);
  const shown = pile.slice(0, n);
  const packW = Math.round(Math.max(92, Math.min(190, size.w * (n === 5 ? 0.25 : 0.16))));
  const packH = Math.round(packW * 1.36);
  const backLift = Math.round(packH * 0.32);
  const slots = shown.map((p, i) => ({
    p, i,
    cx: 0.27 + (i / (n - 1)) * 0.66,
    back: i % 2 === 1,
    tilt: [-8, 6, -4, 9, -6, 4, -9][i % 7],
  }));

  const floorTop = (back: boolean) => size.h - FLOOR_PAD - (back ? backLift : 0) - packH;

  // Intro: title card, then the claw starts swinging.
  useEffect(() => {
    audioManager.playSfx('open_case', 0.7);
    const t = setTimeout(() => setPhase('swing'), 1500);
    return () => clearTimeout(t);
  }, []);

  // Auto-swing.
  useEffect(() => {
    if (phase !== 'swing') return;
    let raf = 0;
    const start = performance.now();
    const base = x.get();
    // Start the sine from wherever the claw is so it doesn't jump.
    const phase0 = Math.asin(Math.max(-1, Math.min(1, (base - 0.6) / 0.34)));
    const speed = SWING_SPEED[Math.min(tryRef.current, SWING_SPEED.length - 1)];
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const v = 0.6 + 0.34 * Math.sin(phase0 + t * speed);
      const dx = v - x.get();
      x.set(v);
      sway.set(Math.max(-9, Math.min(9, -dx * 900)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, x, sway]);

  const say = useCallback(async (text: string, ms = 1100) => {
    setShout(text);
    await wait(ms);
    setShout(null);
  }, []);

  const stop = useCallback(async () => {
    if (phaseRef.current !== 'swing') return;
    const attempt = tryRef.current;           // 0, 1, 2
    const isFinal = attempt === TRIES - 1;
    setPhase('drop');
    audioManager.playSfx('swipe', 0.6);

    // Nearest pack always: oversized packs cover the floor.
    const here = x.get();
    const target = slots.reduce((best, s) => (Math.abs(s.cx - here) < Math.abs(best.cx - here) ? s : best), slots[0]);
    animate(sway, 0, { type: 'spring', stiffness: 200, damping: 8 });
    await animate(x, target.cx, { duration: 0.28, ease: 'easeOut' });

    const depth = floorTop(target.back) - RAIL_Y - HEAD_H + GRIP;
    await animate(cable, depth, { duration: 0.75, ease: [0.5, 0, 0.75, 1.25] });
    setPhase('grip');
    setOpen(false);
    audioManager.playSfx('cas_slam_down', 0.6);
    await wait(280);

    if (isFinal) {
      const res = await onWin(target.p);
      if ('error' in res) {
        setOpen(true);
        await animate(cable, REST_CABLE, { duration: 0.7, ease: 'easeInOut' });
        setJamMsg(res.pullUsed ? res.error : `${res.error} Your pull wasn’t used.`);
        setPhase('jammed');
        audioManager.playSfx('locked_out', 0.6);
        return;
      }
      setCarried(target.p);
      setPhase('lift');
      await animate(cable, REST_CABLE, { duration: 0.9, ease: [0.3, 0, 0.3, 1] });
      setPhase('carry');
      sway.set(10);
      await animate(x, CHUTE_X, { duration: 0.5 + Math.abs(target.cx - CHUTE_X) * 0.9, ease: 'easeInOut' });
      animate(sway, 0, { type: 'spring', stiffness: 120, damping: 5 });
      setPhase('release');
      setOpen(true);
      setFalling(target.p);
      setCarried(null);
      audioManager.playSfx('open_chest', 0.9);
      await wait(650);
      setFalling(null);
      setPrize({ pack: target.p, cards: res.cards });
      setPhase('won');
      audioManager.playSfx('by_th3scr1b3', 0.9);
      return;
    }

    // Tries one and two: lift, wobble, and lose it.
    setCarried(target.p);
    setPhase('lift');
    const liftTo = REST_CABLE + (depth - REST_CABLE) * 0.42;
    await animate(cable, liftTo, { duration: 0.75, ease: [0.3, 0, 0.3, 1] });
    await animate(sway, [0, -12, 12, -9, 9, -5, 0], { duration: 0.55 });
    setPhase('slip');
    setOpen(true);
    setCarried(null);
    const dropFrom = (depth - liftTo);
    setBounce({ id: target.p.id, from: dropFrom, key: Date.now() });
    audioManager.playSfx('miss', 0.7);
    say(SLIP_LINES[attempt] ?? 'AGAIN!');
    await animate(cable, REST_CABLE, { duration: 0.6, ease: 'easeInOut' });
    await wait(500);
    setTryNo(attempt + 1);
    setPhase('swing');
  }, [slots, x, sway, cable, onWin, say]); // eslint-disable-line react-hooks/exhaustive-deps

  // Space / Enter also stop the claw; Esc closes when nothing is at stake.
  const closable = phase === 'intro' || phase === 'swing' || phase === 'jammed';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (phaseRef.current === 'swing') { e.preventDefault(); stop(); }
      } else if (e.key === 'Escape' && closable) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stop, closable, onClose]);

  const triesLeft = TRIES - tryNo;
  const hint = phase === 'intro' ? 'Get ready…'
    : phase === 'swing' ? (tryNo === TRIES - 1 ? 'Last try! Tap to drop' : 'Tap anywhere to drop')
    : phase === 'grip' && tryNo === TRIES - 1 ? 'Gripping…'
    : '';

  return createPortal(
    <motion.div
      className="clawx"
      role="dialog"
      aria-modal="true"
      aria-label="Bonus claw"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="clawx-rays" aria-hidden />
      <div className="clawx-spot" aria-hidden />

      <header className="clawx-top">
        <div className="clawx-tries" aria-label={`${triesLeft} tries left`}>
          {Array.from({ length: TRIES }, (_, i) => (
            <span key={i} className={`clawx-try${i < tryNo ? ' is-used' : ''}${i === tryNo && phase !== 'won' ? ' is-now' : ''}`}>{i + 1}</span>
          ))}
        </div>
        <h2 className="clawx-title">BONUS CLAW</h2>
        <button type="button" className="clawx-close" aria-label="Close" disabled={!closable} onClick={onClose}>
          <X size={22} />
        </button>
      </header>

      <div
        ref={stageRef}
        className="clawx-stage"
        onPointerDown={(e) => { if (phase === 'swing' && e.button === 0) stop(); }}
      >
        <div className="clawx-rail" style={{ top: RAIL_Y - 10 }} aria-hidden />
        <div className="clawx-chute" style={{ left: `${CHUTE_X * 100}%`, width: packW * 1.15, height: packH * 0.9 }} aria-hidden>
          <span>PRIZE</span>
        </div>

        {/* Oversized pile */}
        {slots.map(({ p, cx, back, tilt }) => {
          const hidden = carried?.id === p.id || falling?.id === p.id || prize?.pack.id === p.id;
          const bouncing = bounce?.id === p.id;
          return (
            <motion.div
              key={bouncing ? `${p.id}-${bounce!.key}` : p.id}
              className={`clawx-pack${back ? ' is-back' : ''}`}
              style={{ left: cx * size.w, top: floorTop(back), width: packW, height: packH, zIndex: back ? 2 : 3 }}
              initial={bouncing ? { y: -bounce!.from, rotate: tilt * 3, scaleY: 1 } : false}
              animate={{ y: 0, rotate: tilt, opacity: hidden ? 0 : 1, scaleY: [1, 1] }}
              transition={bouncing
                ? { y: { type: 'spring', stiffness: 380, damping: 11 }, rotate: { type: 'spring', stiffness: 200, damping: 8 } }
                : { duration: 0.08 }}
            >
              <PackToken pack={p} hidePrice />
            </motion.div>
          );
        })}

        {/* Prize falling into the chute */}
        <AnimatePresence>
          {falling && (
            <motion.div
              key="falling"
              className="clawx-pack clawx-falling"
              style={{ left: CHUTE_X * size.w, top: RAIL_Y + REST_CABLE + HEAD_H - GRIP, width: packW, height: packH }}
              initial={{ y: 0, rotate: 0 }}
              animate={{ y: size.h, rotate: 30 }}
              transition={{ duration: 0.6, ease: [0.5, 0, 1, 0.6] }}
            >
              <PackToken pack={falling} hidePrice />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gantry, cable and the big cartoon claw */}
        <motion.div className="clawx-rig" style={{ left: rigLeft, top: RAIL_Y - 14 }} aria-hidden>
          <div className="clawx-carriage" />
          <motion.div className="clawx-cable" style={{ height: useTransform(cable, c => c + 18) }} />
          <motion.div className="clawx-head" style={{ y: cable, rotate: sway, width: HEAD_W, marginLeft: -HEAD_W / 2 }}>
            {carried && (
              <div className="clawx-carried" style={{ width: packW, height: packH, top: HEAD_H - GRIP }}>
                <PackToken pack={carried} hidePrice />
              </div>
            )}
            <CartoonClaw open={open} />
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {shout && (
            <motion.div
              key={shout}
              className="clawx-shout"
              initial={{ scale: 0.2, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            >
              {shout}
            </motion.div>
          )}
          {phase === 'intro' && (
            <motion.div
              key="intro"
              className="clawx-shout clawx-shout-intro"
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 12 }}
            >
              3 TRIES!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="clawx-foot">
        {phase === 'swing' ? (
          <motion.button
            type="button"
            className="clawx-stop"
            onClick={stop}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
          >
            STOP!
          </motion.button>
        ) : (
          <p className="clawx-hint" aria-live="polite">{hint || ' '}</p>
        )}
        {phase === 'swing' && <p className="clawx-hint">{hint}</p>}
      </footer>

      {/* Win card */}
      <AnimatePresence>
        {phase === 'won' && prize && (
          <motion.div key="won" className="clawx-win" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="clawx-rays clawx-rays-gold" aria-hidden />
            <Confetti />
            <motion.p
              className="clawx-win-title"
              initial={{ scale: 0.3, rotate: -10 }}
              animate={{ scale: 1, rotate: -4 }}
              transition={{ type: 'spring', stiffness: 260, damping: 10 }}
            >
              YOU WON!
            </motion.p>
            <motion.div
              className="clawx-win-pack"
              style={{ ['--pack-accent' as string]: prize.pack.accent }}
              initial={{ scale: 0.2, y: 200, rotate: 30 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.15 }}
            >
              <PackToken pack={prize.pack} hidePrice />
              <span className="clawx-win-sheen" aria-hidden />
            </motion.div>
            <p className="clawx-win-label">{prize.pack.label} · {prize.pack.cardCount} card{prize.pack.cardCount === 1 ? '' : 's'}</p>
            <motion.button
              type="button"
              className="clawx-open"
              onClick={() => onOpen(prize.pack, prize.cards)}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              autoFocus
            >
              <Sparkles size={20} /> Open it!
            </motion.button>
          </motion.div>
        )}
        {phase === 'jammed' && (
          <motion.div key="jam" className="clawx-win" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="clawx-win-title clawx-jam">JAMMED!</p>
            <p className="clawx-win-label">{jamMsg}</p>
            <button type="button" className="clawx-open" onClick={onClose}>Back to the shop</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

export function CartoonClaw({ open }: { open: boolean }) {
  const a = open ? 28 : 3;
  const prong = (side: 1 | -1) => (
    <g style={{
      transform: `rotate(${side * -a}deg)`,
      transformOrigin: `${60 + side * 14}px 34px`,
      transformBox: 'view-box',
      transition: 'transform 0.24s cubic-bezier(.3,1.8,.5,1)',
    }}>
      <path
        d={side === -1
          ? 'M46 32 Q30 58 34 84 Q36 100 50 106 L56 98 Q46 92 46 80 Q46 60 58 38 Z'
          : 'M74 32 Q90 58 86 84 Q84 100 70 106 L64 98 Q74 92 74 80 Q74 60 62 38 Z'}
        fill="url(#clawxMetal)" stroke="#120814" strokeWidth="4" strokeLinejoin="round"
      />
    </g>
  );
  return (
    <svg viewBox="0 0 120 110" width={HEAD_W} height={HEAD_H} className="clawx-claw">
      <defs>
        <linearGradient id="clawxMetal" x1="0" x2="1">
          <stop offset="0" stopColor="#9ca3af" />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="1" stopColor="#6b7280" />
        </linearGradient>
        <linearGradient id="clawxHub" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ff6ec7" />
          <stop offset="1" stopColor="#c0126f" />
        </linearGradient>
      </defs>
      {prong(-1)}
      {prong(1)}
      <path d="M56 34 L60 92 L64 34 Z" fill="#d1d5db" stroke="#120814" strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="34" y="4" width="52" height="34" rx="12" fill="url(#clawxHub)" stroke="#120814" strokeWidth="4" />
      <circle cx="60" cy="21" r="7" fill="#fde047" stroke="#120814" strokeWidth="3" />
      <path d="M42 12 Q50 8 58 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7" />
    </svg>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 1.8 + Math.random() * 1.4,
    rot: Math.random() * 720 - 360,
    color: ['#ff1493', '#fde047', '#22d3ee', '#a3e635', '#fb923c', '#ffffff'][i % 6],
  })), []);
  return (
    <div className="clawx-confetti" aria-hidden>
      {bits.map(b => (
        <motion.span
          key={b.i}
          style={{ left: `${b.left}%`, background: b.color }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: b.rot, opacity: [1, 1, 0.6] }}
          transition={{ duration: b.dur, delay: b.delay, ease: 'easeIn', repeat: Infinity, repeatDelay: 0.4 }}
        />
      ))}
    </div>
  );
}
