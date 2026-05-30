import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OwnedCard } from '../services/vaultService';
import { RARITY_CONFIG, type Rarity } from '../utils/rarity';
import Card from './Card';
import RarityBadge from './RarityBadge';
import {
  playShimmer, playTension, playSnap, playRareHit,
  disposeAudioContext,
} from './cinematic/audioEngine';
import { haptics } from '../utils/haptics';


// ── Types ────────────────────────────────────────────────────────────

type Phase =
  | 'entering'   // cards fly in from off-screen
  | 'orbiting'   // cards circle each other
  | 'merging'    // cards converge → flash → mystery card
  | 'flipping'   // mystery card flips to reveal
  | 'revealed'   // card shown with badge + close
  | 'exiting';   // fade out

interface FusionAnimationProps {
  sourceCards: OwnedCard[];  // 3 cards being fused
  resultCard: OwnedCard;     // the fused result
  onClose: () => void;
  closeLabel?: string;       // defaults to '🔥 Back to Forge'
}

// ── Entry positions (fly-in origins) ─────────────────────────────────

const ENTRY_ORIGINS = [
  { x: -500, y: -300, rotate: -45 },  // top-left
  { x: 500, y: -200, rotate: 35 },    // top-right
  { x: 0, y: 600, rotate: 15 },       // bottom-center
];

// ── Orbit positions at different time steps ──────────────────────────

function getOrbitPosition(index: number, progress: number, radius: number) {
  const baseAngle = (index / 3) * Math.PI * 2;
  const angle = baseAngle + progress * Math.PI * 4; // 2 full rotations
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.6, // elliptical
  };
}

// ── Grain Overlay ────────────────────────────────────────────────────

function GrainOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100,
      opacity: 0.05, mixBlendMode: 'overlay',
      background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  );
}

// ── Main Component ───────────────────────────────────────────────────

export default function FusionAnimation({ sourceCards, resultCard, onClose, closeLabel = '🔥 Back to Forge' }: FusionAnimationProps) {
  const [phase, setPhase] = useState<Phase>('entering');
  const [orbitProgress, setOrbitProgress] = useState(0);
  const [orbitRadius, setOrbitRadius] = useState(140);
  const [showMysteryCard, setShowMysteryCard] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const orbitRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const rarity = resultCard.card.rarity as Rarity;
  const rarityColor = RARITY_CONFIG[rarity]?.color || '#fff';

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current);
      disposeAudioContext();
    };
  }, []);

  // ── Phase timeline ─────────────────────────────────────────────────

  useEffect(() => {
    if (!mountedRef.current) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>(resolve => {
      timers.push(setTimeout(resolve, ms));
    });

    async function runSequence() {
      // Phase 1: ENTERING (cards fly in) — 800ms
      playShimmer();
      await wait(900);
      if (!mountedRef.current) return;

      // Phase 2: ORBITING — cards circle each other
      setPhase('orbiting');
      haptics.fusionProgress();
      playTension();

      // Animate orbit with shrinking radius
      const orbitDuration = 1800; // ms
      const startTime = performance.now();

      const animateOrbit = (now: number) => {
        if (!mountedRef.current) return;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / orbitDuration, 1);

        // Ease-in-out for smooth feel
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        setOrbitProgress(eased);
        // Radius shrinks from 140 to 0
        setOrbitRadius(140 * (1 - eased));

        if (progress < 1) {
          orbitRef.current = requestAnimationFrame(animateOrbit);
        }
      };
      orbitRef.current = requestAnimationFrame(animateOrbit);

      await wait(orbitDuration);
      if (!mountedRef.current) return;

      // Phase 3: MERGING — flash + mystery card
      setPhase('merging');
      haptics.heavyTap();
      setShowFlash(true);
      playSnap();
      await wait(150);
      if (!mountedRef.current) return;
      setShowMysteryCard(true);
      await wait(200);
      if (!mountedRef.current) return;
      setShowFlash(false);
      await wait(800);
      if (!mountedRef.current) return;

      // Phase 4: FLIPPING — mystery card flips to reveal
      setPhase('flipping');
      haptics.fusionSuccess();
      playRareHit(); // THE DING
      setIsRevealed(true);
      await wait(600);
      if (!mountedRef.current) return;

      // Phase 5: REVEALED — show badge + close
      setPhase('revealed');
      setShowBadge(true);
      await wait(400);
      if (!mountedRef.current) return;
      setShowClose(true);
    }

    runSequence();

    return () => {
      timers.forEach(clearTimeout);
      if (orbitRef.current) cancelAnimationFrame(orbitRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    haptics.lightTap();
    setPhase('exiting');
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  // ── Render ─────────────────────────────────────────────────────────

  const showSourceCards = phase === 'entering' || phase === 'orbiting';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exiting' ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: '#050402',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <GrainOverlay />

        {/* Ambient glow — pulsing with rarity color */}
        <motion.div
          animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: '600px', height: '600px', borderRadius: '50%',
            background: `radial-gradient(ellipse, ${rarityColor}30, transparent 70%)`,
            filter: 'blur(80px)', pointerEvents: 'none',
          }}
        />

        {/* ── SOURCE CARDS (entering + orbiting) ─────────────────── */}
        <AnimatePresence>
          {showSourceCards && sourceCards.slice(0, 3).map((owned, i) => {
            const entry = ENTRY_ORIGINS[i];
            const orbit = phase === 'orbiting'
              ? getOrbitPosition(i, orbitProgress, orbitRadius)
              : { x: 0, y: 0 };

            return (
              <motion.div
                key={`source-${owned.id}`}
                initial={{
                  x: entry.x,
                  y: entry.y,
                  rotate: entry.rotate,
                  scale: 0.4,
                  opacity: 0,
                }}
                animate={{
                  x: phase === 'orbiting' ? orbit.x : 0,
                  y: phase === 'orbiting' ? orbit.y : 0,
                  rotate: phase === 'orbiting'
                    ? (orbitProgress * 360 * 2) + (i * 120)
                    : 0,
                  scale: phase === 'orbiting'
                    ? 0.45 - (orbitProgress * 0.15)
                    : 0.5,
                  opacity: 1,
                }}
                exit={{
                  scale: 0,
                  opacity: 0,
                }}
                transition={
                  phase === 'entering'
                    ? {
                        duration: 0.7,
                        delay: i * 0.12,
                        ease: [0.22, 1, 0.36, 1],
                      }
                    : {
                        duration: 0.05,
                        ease: 'linear',
                      }
                }
                style={{
                  position: 'absolute',
                  width: '160px',
                  zIndex: 10 + i,
                  filter: phase === 'orbiting'
                    ? `drop-shadow(0 0 ${20 + orbitProgress * 30}px ${rarityColor}60)`
                    : `drop-shadow(0 0 12px ${rarityColor}40)`,
                }}
              >
                {/* Motion trail during orbit */}
                {phase === 'orbiting' && (
                  <motion.div
                    animate={{ opacity: [0.3, 0] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                    style={{
                      position: 'absolute', inset: '-4px',
                      borderRadius: '12px',
                      background: `radial-gradient(ellipse, ${rarityColor}20, transparent 70%)`,
                      filter: 'blur(8px)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
                <Card
                  card={owned.card}
                  interactive={false}
                  showAudio={false}
                  isRevealed={true}
                  isEcho={owned.isEcho}
                  echoGeneration={owned.echoGeneration}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* ── ENERGY PARTICLES (during orbit) ─────────────────────── */}
        {phase === 'orbiting' && (
          <>
            {Array.from({ length: 16 }).map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.8, 0],
                  scale: [0, 1, 0.5],
                  x: [0, (Math.random() - 0.5) * 200],
                  y: [0, (Math.random() - 0.5) * 200],
                }}
                transition={{
                  duration: 1.2,
                  delay: i * 0.1,
                  repeat: 1,
                  ease: 'easeOut',
                }}
                style={{
                  position: 'absolute',
                  width: '4px', height: '4px',
                  borderRadius: '50%',
                  background: rarityColor,
                  boxShadow: `0 0 6px ${rarityColor}`,
                  pointerEvents: 'none',
                }}
              />
            ))}
          </>
        )}

        {/* ── MERGE FLASH ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showFlash && (
            <motion.div
              key="merge-flash"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 0] }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'fixed', inset: 0,
                background: '#fff', zIndex: 300,
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* ── CONVERGENCE RING (during merge) ─────────────────────── */}
        <AnimatePresence>
          {phase === 'merging' && (
            <motion.div
              key="merge-ring"
              initial={{ scale: 2, opacity: 0.8 }}
              animate={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                width: '300px', height: '300px',
                borderRadius: '50%',
                border: `2px solid ${rarityColor}`,
                boxShadow: `0 0 40px ${rarityColor}60, inset 0 0 40px ${rarityColor}20`,
                pointerEvents: 'none',
                zIndex: 20,
              }}
            />
          )}
        </AnimatePresence>

        {/* ── MYSTERY / RESULT CARD ───────────────────────────────── */}
        <AnimatePresence>
          {showMysteryCard && (
            <motion.div
              key="result-card"
              initial={{ scale: 0.3, opacity: 0, rotateY: 0 }}
              animate={{
                scale: phase === 'revealed' ? 1.05 : 0.9,
                opacity: 1,
                y: phase === 'revealed' ? -20 : 0,
              }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 20,
              }}
              style={{
                position: 'relative',
                width: '220px',
                zIndex: 50,
                filter: phase === 'revealed'
                  ? `drop-shadow(0 0 30px ${rarityColor}60)`
                  : 'none',
              }}
            >
              {/* Rarity glow behind card */}
              {phase === 'revealed' && (
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  style={{
                    position: 'absolute', inset: '-30px',
                    borderRadius: '24px',
                    background: `radial-gradient(ellipse, ${rarityColor}30, transparent 70%)`,
                    filter: 'blur(20px)',
                    pointerEvents: 'none', zIndex: -1,
                  }}
                />
              )}

              <Card
                card={resultCard.card}
                interactive={false}
                showAudio={false}
                isRevealed={isRevealed}
                isEcho={resultCard.isEcho}
                echoGeneration={resultCard.echoGeneration}
              />

              {/* Foil shimmer on reveal */}
              {isRevealed && ['rare', 'legendary', 'mythic'].includes(rarity) && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '12px', zIndex: 10,
                  pointerEvents: 'none', overflow: 'hidden',
                  mixBlendMode: 'overlay',
                }}>
                  <div style={{
                    position: 'absolute', inset: '-100%',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 60%, transparent 100%)',
                    animation: 'cine-shimmer 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                    willChange: 'transform',
                    transform: 'translateZ(0)',
                  }} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RARITY BADGE ────────────────────────────────────────── */}
        <AnimatePresence>
          {showBadge && (
            <motion.div
              key="badge"
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ marginTop: '16px', zIndex: 60 }}
            >
              <RarityBadge rarity={rarity} size="lg" />

              {/* Upgrade indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{
                  marginTop: '8px', textAlign: 'center',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '10px', letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: rarityColor,
                }}
              >
                <span style={{ opacity: 0.5 }}>3× → 1×</span>{' '}
                <span style={{ fontWeight: 700 }}>
                  {rarity.toUpperCase()}
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CLOSE BUTTON ────────────────────────────────────────── */}
        <AnimatePresence>
          {showClose && (
            <motion.button
              key="close-btn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={handleClose}
              style={{
                position: 'fixed', bottom: '50px',
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #ff3800, #ff6600)',
                color: '#fff',
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '16px', fontWeight: 900,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                border: '2px solid #000',
                boxShadow: '4px 4px 0 #000, 0 0 30px rgba(255,56,0,0.3)',
                cursor: 'pointer',
                zIndex: 300,
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              {closeLabel}
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── FUSION LABEL (top) ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: phase === 'exiting' ? 0 : 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
            position: 'fixed', top: '40px',
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 'clamp(20px, 5vw, 32px)',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #ff3800, #ff9900)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            zIndex: 60,
          }}
        >
          {phase === 'entering' || phase === 'orbiting' ? 'FUSING...' :
           phase === 'merging' ? 'FORGING...' :
           phase === 'flipping' || phase === 'revealed' ? 'FUSION COMPLETE' :
           'FUSION'}
        </motion.div>

        {/* ── Shimmer keyframes (reused from PackContainer) ────── */}
        <style>{`
          @keyframes cine-shimmer {
            0% { transform: translateX(-150%) skewX(-20deg); }
            100% { transform: translateX(150%) skewX(-20deg); }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
