import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { OwnedCard } from '../../services/vaultService';
import { RARITY_CONFIG, type Rarity } from '../../utils/rarity';
import {
  DEFAULT_BOMBSHELL_PACK_COVER,
  getBombshellCoverCandidates,
} from '../../utils/bombshellCards';
import {
  playBombshellBonusGlitch, playBombshellBonusImpact,
  playBombshellHeartbeat, playBombshellShimmer, playBombshellSwell,
} from './audioEngine';

// The bonus Bombshell is a surprise, so it interrupts the regular pack's
// reveal with its own short film:
//   glitch  → the regular pack's flow cuts out (tape-stop + RGB tear)
//   pulse   → two heartbeats, "EXTRA CARD DETECTED"
//   slam    → a pink foil card back drops in over a giant BOMBSHELL wordmark
//   unveil  → the card flips and the cover art wipes in with a heart burst
//   hold    → caption + tap to add it to the pull

type Stage = 'glitch' | 'pulse' | 'slam' | 'unveil' | 'hold';

const PINK = '#FF1493';
const HOT = '#FF4FB8';

// ms from start at which each stage begins
const TIMELINE: Record<Stage, number> = {
  glitch: 0,
  pulse: 650,
  slam: 1750,
  unveil: 2700,
  hold: 3700,
};
const AUTO_CONTINUE_MS = 6200;
const SKIPPABLE_AFTER_MS = 900;

function useCoverCandidates(owned: OwnedCard): string[] {
  return useMemo(() => {
    const list: string[] = [];
    if (owned.card.coverUrl) list.push(owned.card.coverUrl);
    const file = owned.coverArtwork || (owned.card as any).coverArtwork;
    if (file && owned.card.day) list.push(...getBombshellCoverCandidates(owned.card.day, file));
    list.push(DEFAULT_BOMBSHELL_PACK_COVER);
    return Array.from(new Set(list));
  }, [owned]);
}

function Heart({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill={color}
        d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z"
      />
    </svg>
  );
}

interface Props {
  card: OwnedCard;
  onDone: () => void;
}

export default function BombshellBonusReveal({ card, onDone }: Props) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('glitch');
  const [canSkip, setCanSkip] = useState(false);
  const doneRef = useRef(false);
  const candidates = useCoverCandidates(card);
  const [coverIdx, setCoverIdx] = useState(0);
  const coverSrc = candidates[Math.min(coverIdx, candidates.length - 1)];

  const rarity = card.card.rarity as Rarity;
  const rarityColor = RARITY_CONFIG[rarity]?.color || HOT;
  const rarityLabel = RARITY_CONFIG[rarity]?.label || rarity;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  // Drive the timeline + sound cues
  useEffect(() => {
    // Warm the cover so the unveil never shows an empty frame
    const img = new Image();
    img.src = coverSrc;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    playBombshellBonusGlitch();
    at(TIMELINE.pulse, () => { setStage('pulse'); playBombshellHeartbeat(); });
    at(TIMELINE.pulse + 520, () => playBombshellHeartbeat());
    at(TIMELINE.slam, () => { setStage('slam'); playBombshellBonusImpact(); });
    at(TIMELINE.unveil, () => { setStage('unveil'); playBombshellSwell(); });
    at(TIMELINE.unveil + 350, () => playBombshellShimmer());
    at(TIMELINE.hold, () => setStage('hold'));
    at(SKIPPABLE_AFTER_MS, () => setCanSkip(true));
    at(AUTO_CONTINUE_MS, finish);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = () => {
    if (!canSkip) return;
    if (stage === 'hold') finish();
    else setStage('hold');
  };

  const flipped = stage === 'unveil' || stage === 'hold';
  const cardVisible = stage !== 'glitch' && stage !== 'pulse';

  // Heart burst particles, fixed per mount
  const hearts = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const angle = (i / 26) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 180 + Math.random() * 260;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      size: 10 + Math.random() * 18,
      rot: (Math.random() - 0.5) * 120,
      delay: Math.random() * 0.15,
      color: i % 3 === 0 ? '#fff' : i % 3 === 1 ? PINK : HOT,
    };
  }), []);

  return (
    <motion.div
      key="bombshell-bonus"
      data-testid="bombshell-bonus-reveal"
      data-stage={stage}
      onClick={handleTap}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.08 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500, overflow: 'hidden',
        background: '#050006', cursor: canSkip ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        perspective: 1400,
      }}
    >
      <style>{`
        @keyframes bsb-scan { from { transform: translateY(-100%); } to { transform: translateY(100%); } }
        @keyframes bsb-foil { from { transform: translateX(-120%) skewX(-18deg); } to { transform: translateX(220%) skewX(-18deg); } }
        @keyframes bsb-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>

      {/* Scanlines over everything */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40, opacity: 0.18,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 3px)',
      }} />

      {/* ── GLITCH: RGB tear bars ───────────────────────────────── */}
      <AnimatePresence>
        {stage === 'glitch' && !reduceMotion && (
          <motion.div key="glitch" exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ x: i % 2 ? -400 : 400, opacity: 0 }}
                animate={{ x: [i % 2 ? -400 : 400, 0, i % 2 ? 60 : -60, 0], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.55, delay: i * 0.03, times: [0, 0.3, 0.6, 1] }}
                style={{
                  position: 'absolute', left: 0, right: 0,
                  top: `${(i * 11 + 4) % 100}%`, height: `${4 + (i % 4) * 6}px`,
                  background: i % 3 === 0 ? PINK : i % 3 === 1 ? '#00F0FF' : '#fff',
                  mixBlendMode: 'screen',
                }}
              />
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.4, 1, 0] }}
              transition={{ duration: 0.6, times: [0, 0.15, 0.3, 0.5, 1] }}
              style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.4em', color: '#fff',
                fontSize: 'clamp(14px, 3vw, 22px)', textShadow: `3px 0 ${PINK}, -3px 0 #00F0FF`,
              }}
            >
              SIGNAL INTERRUPTED
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PULSE: heartbeat vignette ───────────────────────────── */}
      {stage !== 'glitch' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={stage === 'pulse'
            ? { opacity: [0, 0.9, 0.35, 1, 0.5] }
            : { opacity: 0.55 }}
          transition={stage === 'pulse' ? { duration: 1.05, times: [0, 0.15, 0.4, 0.62, 1] } : { duration: 0.6 }}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `radial-gradient(ellipse at center, transparent 25%, ${PINK}55 60%, ${PINK}cc 100%)`,
          }}
        />
      )}

      <AnimatePresence>
        {stage === 'pulse' && (
          <motion.div
            key="detected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.4, filter: 'blur(6px)' }}
            transition={{ duration: 0.25 }}
            style={{ position: 'absolute', textAlign: 'center', zIndex: 20 }}
          >
            <motion.div
              animate={reduceMotion ? {} : { scale: [1, 1.18, 1, 1.22, 1] }}
              transition={{ duration: 1.05, times: [0, 0.12, 0.35, 0.6, 1] }}
              style={{ display: 'inline-block', filter: `drop-shadow(0 0 22px ${PINK})` }}
            >
              <Heart size={84} color={PINK} />
            </motion.div>
            <div style={{
              marginTop: 18, fontFamily: 'monospace', fontWeight: 800, color: '#fff',
              letterSpacing: '0.35em', fontSize: 'clamp(11px, 2.4vw, 15px)', textShadow: `0 0 12px ${PINK}`,
            }}>
              EXTRA CARD DETECTED
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SLAM: giant wordmark + marquee bands ───────────────── */}
      {cardVisible && (
        <>
          <motion.div
            initial={{ scale: 2.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none', zIndex: 1,
            }}
          >
            <div style={{
              fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: 'clamp(72px, 19vw, 260px)',
              lineHeight: 1, letterSpacing: '-0.02em', color: 'transparent',
              WebkitTextStroke: `2px ${PINK}`, opacity: 0.55, transform: 'rotate(-8deg)',
              textShadow: `0 0 40px ${PINK}66`, whiteSpace: 'nowrap',
            }}>
              BOMBSHELL
            </div>
          </motion.div>

          {[{ top: '5%', rot: -4, dir: 1 }, { top: '91%', rot: 3, dir: -1 }].map((band, bi) => (
            <motion.div
              key={bi}
              initial={{ x: band.dir * 600, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.05 * bi }}
              style={{
                position: 'absolute', left: '-10%', right: '-10%', top: band.top, height: 34,
                background: bi ? '#fff' : PINK, transform: `rotate(${band.rot}deg)`,
                overflow: 'hidden', display: 'flex', alignItems: 'center', zIndex: 2,
                boxShadow: `0 0 30px ${PINK}88`,
              }}
            >
              <div style={{
                display: 'flex', whiteSpace: 'nowrap', fontFamily: 'Impact, "Arial Black", sans-serif',
                fontSize: 18, letterSpacing: '0.12em', color: bi ? PINK : '#fff',
                animation: reduceMotion ? undefined : `bsb-marquee ${bi ? 7 : 5}s linear infinite`,
                animationDirection: bi ? 'reverse' : 'normal',
              }}>
                {Array.from({ length: 2 }).map((_, k) => (
                  <span key={k}>{' BONUS PULL ✦ BOMBSHELL ✦ PANIK ED. ✦ EXTRA CARD ✦'.repeat(6)}</span>
                ))}
              </div>
            </motion.div>
          ))}

          {/* Impact shockwave */}
          {!reduceMotion && (
            <motion.div
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: 3.2, opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.12 }}
              style={{
                position: 'absolute', width: 260, height: 260, borderRadius: '50%',
                border: `3px solid ${HOT}`, boxShadow: `0 0 40px ${PINK}`, zIndex: 3, pointerEvents: 'none',
              }}
            />
          )}
        </>
      )}

      {/* ── THE CARD ───────────────────────────────────────────── */}
      {cardVisible && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { y: -900, rotate: -14, scale: 1.1 }}
          animate={reduceMotion
            ? { opacity: 1 }
            : { y: 0, rotate: flipped ? 0 : -4, scale: flipped ? 1.04 : 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 30, mass: 1.1 }}
          style={{ position: 'relative', zIndex: 10, width: 'min(260px, 62vw)', aspectRatio: '5 / 7' }}
        >
          {/* screen shake wrapper on impact */}
          <motion.div
            animate={reduceMotion ? {} : { x: [0, -10, 9, -6, 4, 0], y: [0, 6, -5, 3, 0, 0] }}
            transition={{ duration: 0.38, delay: 0.16 }}
            style={{ width: '100%', height: '100%' }}
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.2, 0.9, 0.25, 1] }}
              style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' }}
            >
              {/* Back: pink foil */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 16, overflow: 'hidden',
                background: 'linear-gradient(155deg, #2d031c 0%, #8a0a52 45%, #1a0010 100%)',
                border: `2px solid ${HOT}`, boxShadow: `0 0 50px ${PINK}aa, 10px 10px 0 #000`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10,
              }}>
                <img
                  src="/data/packs/bs_cover.png" alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, mixBlendMode: 'screen' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <div style={{ position: 'relative', filter: `drop-shadow(0 0 16px ${PINK})` }}><Heart size={64} color="#fff" /></div>
                <div style={{
                  position: 'relative', fontFamily: 'Impact, "Arial Black", sans-serif', color: '#fff',
                  fontSize: 26, letterSpacing: '0.08em', textShadow: `0 0 14px ${PINK}`,
                }}>BOMBSHELL</div>
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: '40%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
                    animation: reduceMotion ? undefined : 'bsb-foil 1.4s ease-in-out infinite',
                  }} />
                </div>
              </div>

              {/* Front: cover art */}
              <div style={{
                position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                borderRadius: 16, overflow: 'hidden', background: '#000',
                border: `2px solid ${rarityColor}`, boxShadow: `0 0 70px ${PINK}cc, 0 0 24px ${rarityColor}88, 10px 10px 0 #000`,
              }}>
                <motion.img
                  src={coverSrc} alt={card.card.title}
                  onError={() => setCoverIdx((i) => i + 1)}
                  initial={{ clipPath: 'circle(0% at 50% 50%)', scale: 1.25 }}
                  animate={flipped ? { clipPath: 'circle(75% at 50% 50%)', scale: 1 } : {}}
                  transition={{ duration: 0.75, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', mixBlendMode: 'overlay' }}>
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: '45%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)',
                    animation: reduceMotion ? undefined : 'bsb-foil 2.2s ease-in-out 0.9s infinite',
                  }} />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* BONUS stamp */}
          <motion.div
            initial={{ scale: 3, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 12 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.35 }}
            style={{
              position: 'absolute', top: -18, right: -22, zIndex: 20,
              background: '#fff', color: PINK, border: `3px solid ${PINK}`,
              fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: 20, letterSpacing: '0.1em',
              padding: '4px 12px', boxShadow: `4px 4px 0 ${PINK}`,
            }}
          >
            +1 BONUS
          </motion.div>
          {/* ── HOLD: caption ──────────────────────────────────────── */}
          <AnimatePresence>
            {stage === 'hold' && (
              <motion.div
                key="caption"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                style={{
                  position: 'absolute', top: 'calc(100% + 18px)', left: '-60%', right: '-60%', textAlign: 'center', zIndex: 30,
                  pointerEvents: 'none',
                }}
              >
                <div style={{
                  fontFamily: 'Impact, "Arial Black", sans-serif', color: '#fff', fontSize: 'clamp(20px, 4.5vw, 30px)',
                  letterSpacing: '0.04em', textShadow: `0 0 18px ${PINK}, 3px 3px 0 #000`,
                }}>
                  BOMBSHELL BONUS
                </div>
                <div style={{
                  marginTop: 6, fontFamily: 'monospace', fontSize: 12, letterSpacing: '0.2em', color: '#ffd1ea',
                }}>
                  DAY {String(card.card.day).padStart(3, '0')} · <span style={{ color: rarityColor }}>{String(rarityLabel).toUpperCase()}</span>
                </div>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  style={{ marginTop: 14, fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.7)' }}
                >
                  TAP TO ADD TO YOUR PULL
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── UNVEIL: heart burst + flash ─────────────────────────── */}
      <AnimatePresence>
        {stage === 'unveil' && (
          <motion.div key="burst" exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
            <motion.div
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.35, delay: 0.3 }}
              style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle, #fff 0%, ${HOT} 40%, transparent 75%)` }}
            />
            {!reduceMotion && hearts.map((h, i) => (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, scale: 0.2, opacity: 1, rotate: 0 }}
                animate={{ x: h.x, y: h.y, scale: 1, opacity: 0, rotate: h.rot }}
                transition={{ duration: 1.1, delay: 0.3 + h.delay, ease: 'easeOut' }}
                style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -h.size / 2, marginTop: -h.size / 2 }}
              >
                <Heart size={h.size} color={h.color} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
