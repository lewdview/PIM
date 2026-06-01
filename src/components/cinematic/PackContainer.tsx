import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVaultStore, type RevealPackMeta } from '../../store/useVaultStore';
import type { OwnedCard } from '../../services/vaultService';
import { audioManager } from '../../game/audio';
import { RARITY_CONFIG, type Rarity } from '../../utils/rarity';
import Card from '../Card';
import RarityBadge from '../RarityBadge';
import {
  playAmbient, playCrinkle, playTension, playTear,
  playSnap, playShimmer, playTick, playNearMiss, playRareHit,
  playUnlockChime, disposeAudioContext,
} from './audioEngine';

// ── Types ────────────────────────────────────────────────────────────

type Phase =
  | 'preloading' // assets being fetched
  | 'idle'       // 0: floating pack
  | 'grip'       // 1: press-and-hold
  | 'tension'    // 2: pre-tear stretch
  | 'tearing'    // 3: tear starts
  | 'snap'       // 4: tear snap
  | 'pause'      // 5: reveal pause (anticipation)
  | 'rise'       // 6: card stack rises
  | 'flipping'   // 7: flip sequence
  | 'layout'     // 8: post layout (arc spread)
  | 'inspect';   // 9: inspection mode

interface Props {
  meta: RevealPackMeta;
  cards: OwnedCard[];
  onComplete: () => void;
  onBuyAnother?: () => void;
  isRepurchasing?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────


const isRareOrHigher = (r: Rarity) => ['rare', 'legendary', 'mythic'].includes(r);

function shouldFakeNearMiss(): boolean {
  return Math.random() < 0.6;
}

function isUltraTrigger(): boolean {
  return Math.random() < 0.003;
}

// ── Grain Overlay ────────────────────────────────────────────────────

function GrainOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100,
      opacity: 0.06, mixBlendMode: 'overlay',
      background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  );
}

// ── Pack Shell (the bag visual) ──────────────────────────────────────

function PackShell({ meta, phase }: { meta: RevealPackMeta; phase: Phase }) {
  const isTorn = ['snap', 'pause', 'rise', 'flipping', 'layout', 'inspect'].includes(phase);
  const isTearing = phase === 'tearing';

  return (
    <>
      {/* Intact pack — visible during idle/grip/tension */}
      <AnimatePresence>
        {!isTorn && !isTearing && (
          <motion.div
            key="intact"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', inset: 0, borderRadius: '6px', overflow: 'hidden',
              background: meta.gradient,
              boxShadow: `8px 8px 0 #000, 0 0 40px ${meta.accent}15`,
              border: '2px solid rgba(255,255,255,0.06)',
            }}
          >
            <PackBagContents meta={meta} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tearing mask — visible during tear phase */}
      <AnimatePresence>
        {isTearing && (
          <motion.div
            key="tearing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* Top seam stretching */}
            <motion.div
              initial={{ scaleY: 1 }}
              animate={{ scaleY: 1.08 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute', inset: 0, borderRadius: '6px', overflow: 'hidden',
                background: meta.gradient, transformOrigin: 'top center',
                boxShadow: `8px 8px 0 #000`,
                border: '2px solid rgba(255,255,255,0.06)',
              }}
            >
              <PackBagContents meta={meta} />
              {/* Glow leak at seam */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0.3, 0.8] }}
                transition={{ duration: 0.4 }}
                style={{
                  position: 'absolute', left: 0, right: 0, top: '46%', height: '8%',
                  background: `linear-gradient(180deg, transparent, ${meta.accent}80, transparent)`,
                  filter: 'blur(4px)',
                }}
              />
            </motion.div>
            {/* Jitter edge fibers */}
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 0 }}
                animate={{
                  opacity: [0, 0.7, 0],
                  y: [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8],
                  x: [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6],
                }}
                transition={{ duration: 0.3, delay: i * 0.02 }}
                style={{
                  position: 'absolute',
                  left: `${8 + i * 7}%`, top: '48%',
                  width: '2px', height: '6px',
                  background: meta.accent, borderRadius: '1px',
                  filter: `blur(${Math.random()}px)`,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Torn halves — visible after snap */}
      <AnimatePresence>
        {isTorn && (
          <>
            <motion.div
              key="top-half"
              initial={{ rotateX: 0, y: 0, opacity: 1 }}
              animate={{ rotateX: -45, y: -60, opacity: 0.3 }}
              transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'absolute', inset: 0,
                clipPath: 'polygon(0 0, 100% 0, 98% 48%, 2% 50%)',
                borderRadius: '6px', overflow: 'hidden',
                background: meta.gradient, transformOrigin: 'top center',
                border: '2px solid rgba(255,255,255,0.06)',
              }}
            >
              <PackBagContents meta={meta} />
            </motion.div>
            <motion.div
              key="bottom-half"
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: 12, opacity: 0.4 }}
              transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: 'absolute', inset: 0,
                clipPath: 'polygon(2% 50%, 98% 48%, 100% 100%, 0 100%)',
                borderRadius: '6px', overflow: 'hidden',
                background: meta.gradient,
                border: '2px solid rgba(255,255,255,0.06)',
              }}
            >
              <PackBagContents meta={meta} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ===== PACK EMBLEM (Custom Icon) =====
function PackEmblem({ accent, size = 80 }: { accent: string; size?: number }) {
  return (
    <div className="relative flex justify-center items-center my-2 rounded-full mx-auto" style={{ width: size, height: size, boxShadow: `0 0 30px ${accent}20` }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ animation: 'spin-slow 16s linear infinite', transformOrigin: 'center', willChange: 'transform' }}>
        <path id="circlePath" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
        <text fill={accent} fontWeight="bold" style={{ textTransform: 'uppercase', fontSize: '8.5px', textShadow: `0 0 10px ${accent}60`, letterSpacing: '1px' }}>
          <textPath href="#circlePath" startOffset="0%">
            TH3SCR1B3 •  GEN 0  •
          </textPath>
          <textPath href="#circlePath" startOffset="50%">
            TH3SCR1B3 •  GEN 0  •
          </textPath>
        </text>
        <circle cx="50" cy="50" r="23" fill="none" stroke={accent} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-black" style={{ 
          fontSize: size * 0.45, 
          color: '#fff', 
          fontFamily: '"Impact", "Arial Black", sans-serif',
          letterSpacing: '-1.5px',
          transform: 'scaleY(1.2) scaleX(0.9)',
          WebkitTextStroke: '1px #000',
          textShadow: `0 0 10px ${accent}, 2px 2px 0 #000`,
        }}>
          365
        </span>
      </div>
    </div>
  );
}

function PackBagContents({ meta }: { meta: RevealPackMeta }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${meta.accent}40, transparent 55%)` }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Top Crimp Edge */}
        <div className="absolute inset-x-0 top-0 h-[14px] crimp-edge z-10" style={{
          boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }} />

        {/* VERTICAL TH3SCR1B3 SIDE BANNER */}
        <div className="absolute left-1 top-24 w-8 flex items-center justify-center pointer-events-none z-20 mix-blend-overlay">
          <div className="font-black leading-none uppercase whitespace-nowrap" style={{
            transform: 'rotate(-90deg) scaleY(1.3) scaleX(0.9)',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '16px',
            letterSpacing: '-0.5px',
            WebkitTextStroke: `1px ${meta.accent}`,
            textShadow: `0 0 10px ${meta.accent}60`,
          }}>
            TH3SCR1B3
          </div>
        </div>

        {/* Middle-Left: Price Sticker */}
        <div className="absolute left-0 top-20 z-30 pointer-events-none">
          <div className="sticker-gun-tag sticker-slits drop-shadow-lg" style={{ 
            transform: 'rotate(-90deg) translateX(-50%)',
            transformOrigin: 'left center',
            background: `linear-gradient(${meta.accent}99, ${meta.accent}99), #ffffff`,
            '--slit-color': `${meta.accent}30`,
            padding: '4px 10px',
            alignItems: 'center'
          } as any}>
            <span className="text-[6px] font-black tracking-tighter opacity-70 mb-0.5 leading-none" style={{ fontFamily: 'Impact, sans-serif' }}>
              TH3SCR1B3 VAULT
            </span>
            <div className="flex items-baseline leading-none py-0.5">
              <span className="text-[15px] font-black mr-0.5" style={{ transform: 'scaleY(1.3)', letterSpacing: '-0.8px' }}>
                {meta.price}
              </span>
            </div>
          </div>
        </div>

        {/* CENTER BAG GRAPHICS */}
        <div className="absolute top-8 left-0 right-0 flex flex-col items-center w-full">
            {/* Sealed top dashed line */}
            <div className="w-full h-5" style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06), transparent)',
              borderBottom: '2px dashed rgba(255,255,255,0.08)',
            }} />
          
            <h3 className="text-[32px] leading-[0.9] pack-label-neon uppercase font-black text-center" style={{
              '--neon-accent': meta.accent,
              color: '#ffffff',
              fontFamily: '"Impact", "Arial Black", sans-serif',
              letterSpacing: '0.02em',
              transform: 'scaleY(1.22) scaleX(0.95)',
              transformOrigin: 'center',
              WebkitTextStroke: '1.2px #000000',
              textShadow: `
                0 0 10px ${meta.accent}, 
                0 0 20px ${meta.accent}, 
                1px 2px 0 #000000, 
                2px 4px 10px rgba(0,0,0,0.8)
              `,
              margin: '12px 0 8px 0',
            } as React.CSSProperties}>
              {meta.label}
            </h3>
            
            <PackEmblem accent={meta.accent} size={60} />
            
            <div className="text-center mt-2 w-full">
              <div className="inline-block">
                <div className="sticker-gun-tag sticker-slits drop-shadow-md" style={{
                  background: '#ffffff',
                  border: `1px solid ${meta.accent}30`,
                  '--slit-color': `${meta.accent}20`,
                  padding: '3px 10px',
                  transform: 'rotate(0.5deg)',
                  minWidth: '150px'
                } as any}>
                  <span className="text-[8px] font-black tracking-tighter uppercase italic opacity-90" style={{ color: '#000' }}>
                    365 DAYS OF LIGHT AND DARK
                  </span>
                </div>
              </div>
            </div>
        </div>

        {/* Bottom Center: Card Count Sticker */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="sticker-gun-tag sticker-slits drop-shadow-sm" style={{ 
            background: '#ffffff',
            '--slit-color': 'rgba(0,0,0,0.1)',
            transform: 'rotate(2deg)',
            padding: '2px 10px',
            alignItems: 'center'
          } as any}>
            <span className="text-[7px] font-black tracking-tighter uppercase mb-0.5 opacity-60">CARDS</span>
            <span className="text-[14px] font-black leading-none" style={{ transform: 'scaleY(1.2)' }}>
              {meta.cardCount || 1}
            </span>
          </div>
        </div>

        {/* Bottom Crimp Edge */}
        <div className="absolute inset-x-0 bottom-0 h-[14px] crimp-edge z-10" style={{
          boxShadow: '0 -3px 6px rgba(0,0,0,0.4)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }} />
      </div>

      <div style={{ position: 'absolute', inset: 0, border: '1.5px solid rgba(255,255,255,0.05)', borderRadius: '6px', pointerEvents: 'none' }} />
    </>
  );
}

// ── FX Layer ─────────────────────────────────────────────────────────

function FXLayer({ phase }: { phase: Phase; accent: string }) {
  return (
    <>
      {/* Flash on snap */}
      <AnimatePresence>
        {phase === 'snap' && (
          <motion.div
            key="snap-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ duration: 0.12 }}
            style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 300, pointerEvents: 'none' }}
          />
        )}
      </AnimatePresence>
      {/* Zoom pulse on snap */}
      <AnimatePresence>
        {phase === 'snap' && (
          <motion.div
            key="zoom-pulse"
            initial={{ scale: 1 }}
            animate={{ scale: 1.05 }}
            transition={{ duration: 0.12 }}
            style={{ position: 'fixed', inset: 0, zIndex: -1 }}
          />
        )}
      </AnimatePresence>
      {/* Rare reveal screen dim */}
      <AnimatePresence>
        {phase === 'flipping' && (
          <motion.div
            key="dim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 50, pointerEvents: 'none' }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Foil shimmer for rare cards ──────────────────────────────────────

const shimmerKeyframes = `
@keyframes cine-shimmer {
  0% { transform: translateX(-150%) skewX(-20deg); }
  100% { transform: translateX(150%) skewX(-20deg); }
}
`;

// ── Main Component ───────────────────────────────────────────────────

export default function PackContainer({ meta, cards, onComplete, onBuyAnother, isRepurchasing }: Props) {
  const [phase, setPhase] = useState<Phase>('preloading');
  const [flipIndex, setFlipIndex] = useState(-1); // current card being flipped
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [rareRevealing, setRareRevealing] = useState(false);
  const [nearMissFlash, setNearMissFlash] = useState(false);
  const [ultraTriggered, setUltraTriggered] = useState(false);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);
  const ambientStop = useRef<(() => void) | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sequenceRunning = useRef(false);
  const abortRef = useRef(false); // Aborts in-flight reveal sequences on re-purchase

  const collection = useVaultStore(s => s.collection);
  const [firstUnlockCard, setFirstUnlockCard] = useState<OwnedCard | null>(null);
  const unlockResolveRef = useRef<(() => void) | null>(null);
  const unlockAudioRef = useRef<HTMLAudioElement | null>(null);

  const checkFirstUnlock = useCallback((cardId: string) => {
    if (!collection || collection.length === 0) return true;
    const count = collection.filter(c => c && c.cardId === cardId).length;
    return count <= 1;
  }, [collection]);

  const [showFragmentDecrypter, setShowFragmentDecrypter] = useState(false);
  const [decrypterPhase, setDecrypterPhase] = useState<'idle' | 'shaking' | 'ripping' | 'revealed'>('idle');
  interface FragmentReward {
    cardId: string;
    title: string;
    artist: string;
    coverArt: string | null;
    rarity: Rarity;
    added: number;
    oldTotal: number;
    newTotal: number;
    unlocked: boolean;
  }
  const [fragmentRewards, setFragmentRewards] = useState<FragmentReward[]>([]);

  const handleStartDecrypter = useCallback(() => {
    const rewards: FragmentReward[] = cards.map((owned) => {
      const card = owned.card;
      const rarity = card.rarity as Rarity;
      let gain = 2;
      if (rarity === 'uncommon') gain = 3;
      else if (rarity === 'rare') gain = 5;
      else if (rarity === 'legendary' || rarity === 'mythic') gain = 10;

      const storageKey = `fragments_${card.id}`;
      const oldTotal = parseInt(localStorage.getItem(storageKey) || '0', 10);
      const newTotal = Math.min(10, oldTotal + gain);

      // Write to localStorage
      localStorage.setItem(storageKey, newTotal.toString());

      return {
        cardId: card.id,
        title: card.title,
        artist: card.artist,
        coverArt: card.coverUrl || null,
        rarity,
        added: gain,
        oldTotal,
        newTotal,
        unlocked: newTotal >= 10 && oldTotal < 10,
      };
    });

    setFragmentRewards(rewards);
    setShowFragmentDecrypter(true);
    setDecrypterPhase('idle');
  }, [cards]);

  useEffect(() => {
    if (firstUnlockCard && firstUnlockCard.card.audioUrl) {
      const audio = new Audio(firstUnlockCard.card.audioUrl);
      audio.volume = 0.55;
      audio.play().catch(e => console.warn("Audio snippet play failed:", e));
      unlockAudioRef.current = audio;
    } else {
      if (unlockAudioRef.current) {
        const audio = unlockAudioRef.current;
        let vol = audio.volume;
        const fade = setInterval(() => {
          vol = Math.max(0, vol - 0.05);
          audio.volume = vol;
          if (vol <= 0) {
            clearInterval(fade);
            audio.pause();
            audio.src = "";
          }
        }, 30);
        unlockAudioRef.current = null;
      }
    }
    return () => {
      if (unlockAudioRef.current) {
        unlockAudioRef.current.pause();
        unlockAudioRef.current.src = "";
      }
    };
  }, [firstUnlockCard]);

  // ── Manage Ambient Audio & State Reset ──────────────────────────
  useEffect(() => {
    // Abort any in-flight reveal sequence from the previous cards
    abortRef.current = true;

    // Stop previous ambient audio
    ambientStop.current?.();
    ambientStop.current = null;

    // Allow new sequence after a tick (to let the abort propagate)
    const resetTimer = setTimeout(() => {
      abortRef.current = false;
    }, 50);

    // Reset visual state
    setPhase('preloading');
    setFlipIndex(-1);
    setFlippedCards(new Set());
    setRareRevealing(false);
    setNearMissFlash(false);
    setUltraTriggered(false);
    setInspectIndex(null);
    setExpandedIndex(null);
    setHasInteracted(false);
    sequenceRunning.current = false;
    
    // Reset decrypter states
    setShowFragmentDecrypter(false);
    setDecrypterPhase('idle');
    setFragmentRewards([]);

    return () => {
      clearTimeout(resetTimer);
      abortRef.current = true;
      ambientStop.current?.();
      ambientStop.current = null;
      disposeAudioContext();
    };
  }, [cards]);

  // Audio trigger on interaction
  useEffect(() => {
    if (hasInteracted && !ambientStop.current) {
        ambientStop.current = playAmbient();
    }
  }, [hasInteracted]);

  // ── Preloading Hook ────────────────────────────────────────────────
  useEffect(() => {
    let isCancelled = false;

    async function preloadAssets() {
      const urls = new Set<string>();
      cards.forEach(owned => {
        if (owned.card.coverUrl) urls.add(owned.card.coverUrl);
        if (owned.card.holographicUrl) urls.add(owned.card.holographicUrl);
      });

      const preloadPromise = Promise.all(
        Array.from(urls).map(url => new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve; // Continue on error prevents total hang
          img.src = url;
        }))
      );

      // Failsafe timeout
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 4000));
      
      await Promise.race([preloadPromise, timeoutPromise]);
      if (!isCancelled) setPhase('idle');
    }

    preloadAssets();
    return () => { isCancelled = true; };
  }, [cards]);

  // ── Timeline Controller (Post-Snap Reveal) ─────────────────────────

  const triggerRevealSequence = useCallback(async () => {
    if (sequenceRunning.current) return;
    if (abortRef.current) return;
    sequenceRunning.current = true;

    // Abortable wait — returns true if aborted
    const abortableWait = (ms: number) =>
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(abortRef.current), ms);
        // Check immediately in case abort was set before this call
        if (abortRef.current) {
          clearTimeout(timer);
          resolve(true);
        }
      });

    // Phase 3 & 4: TEAR START & SNAP
    setPhase('tearing');
    playTear();
    if (await abortableWait(400)) return;

    setPhase('snap');
    playSnap();
    if (await abortableWait(300)) return;

    // Phase 5: REVEAL PAUSE — anticipation builder (longer for drama)
    setPhase('pause');
    playShimmer();
    if (await abortableWait(1200)) return;

    // Phase 6: CARD STACK RISE
    setPhase('rise');
    if (await abortableWait(1000)) return;

    // Phase 7: FLIP SEQUENCE
    setPhase('flipping');
    ambientStop.current?.(); // kill ambient
    ambientStop.current = null;

    for (let i = 0; i < cards.length; i++) {
      if (abortRef.current) return;
      setFlipIndex(i);
      const card = cards[i];
      const rarity = card.card.rarity as Rarity;

      if (isRareOrHigher(rarity)) {
        // Near-miss system (60% fake higher tier)
        if (shouldFakeNearMiss() && i > 0) {
          setNearMissFlash(true);
          playNearMiss();
          if (await abortableWait(250)) return;
          setNearMissFlash(false);
        }

        // Rare reveal sequence (slower build up)
        setRareRevealing(true);

        // Phase A: Silence — let the tension breathe
        if (await abortableWait(400)) return;

        // Phase B: Energy Build
        if (await abortableWait(600)) return;

        // Phase C: Slow flip — hold the moment
        setFlippedCards(prev => new Set(prev).add(i));
        playRareHit();
        if (await abortableWait(800)) return;

        // Ultra trigger check (0.3%)
        if (isUltraTrigger()) {
          setUltraTriggered(true);
          if (await abortableWait(1000)) return;
          setUltraTriggered(false);
        }

        setRareRevealing(false);
        if (await abortableWait(700)) return; // Linger on the card
      } else if (rarity === 'uncommon') {
        // Uncommon — let it sit a beat
        setFlippedCards(prev => new Set(prev).add(i));
        playTick();
        if (await abortableWait(600)) return;
      } else {
        // Common — still give it a moment
        setFlippedCards(prev => new Set(prev).add(i));
        playTick();
        if (await abortableWait(500)) return;
      }

      // First-time card unlock overlay step (paused until resolved)
      if (checkFirstUnlock(card.card.id)) {
        setFirstUnlockCard(card);
        audioManager.playSfx('hidden_secret_found', 1.0);
        await new Promise<void>((resolve) => {
          unlockResolveRef.current = resolve;
        });
        setFirstUnlockCard(null);
        if (await abortableWait(400)) return;
      }
    }

    if (abortRef.current) return;

    // Phase 8: POST LAYOUT
    setPhase('layout');
    sequenceRunning.current = false;
    // We now pause here for the user to examine the cards and click continue.
  }, [cards]);

  // ── Mobile tap-to-rip (fallback for when drag is difficult) ─────────
  const handlePackTap = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('grip');
    playCrinkle();
    // Auto-advance through tension to rip after a brief grip
    setTimeout(() => {
      setPhase('tension');
      playTension();
      setTimeout(() => {
        triggerRevealSequence();
      }, 400);
    }, 350);
  }, [phase, triggerRevealSequence]);

  // ── Hover/Inspect/Lock Logic ─────────────────────────────────────────

  const handleCardHover = (index: number | null) => {
    if (phase !== 'layout' && phase !== 'inspect') return;
    setInspectIndex(index);
    if (index !== null) setPhase('inspect');
    else setPhase('layout');
  };

  const handleCardClick = (index: number) => {
    if (phase !== 'layout' && phase !== 'inspect') return;
    setExpandedIndex(prev => prev === index ? null : index);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    if (!hasInteracted) setHasInteracted(true);
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
    });
  }, [hasInteracted]);

  const handleDecryptPodTap = useCallback(() => {
    if (decrypterPhase !== 'idle') return;
    setDecrypterPhase('shaking');
    playTension();
    
    setTimeout(() => {
      setDecrypterPhase('ripping');
      playTear();
      playSnap();

      setTimeout(() => {
        setDecrypterPhase('revealed');
        playShimmer();

        const hasUnlocks = fragmentRewards.some(r => r.unlocked);
        if (hasUnlocks) {
          setTimeout(() => {
            playUnlockChime();
          }, 400);
        }
      }, 500);
    }, 600);
  }, [decrypterPhase, fragmentRewards]);

  // ── Card offset properties ──────────────────────────────

  const showPack = ['idle', 'grip', 'tension', 'tearing', 'snap'].includes(phase);
  const showCards = ['pause', 'rise', 'flipping', 'layout', 'inspect'].includes(phase);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        background: '#050402',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: phase === 'idle' ? 'pointer' : 'default',
      }}
    >
      <style>{shimmerKeyframes}</style>
      <GrainOverlay />
      <FXLayer phase={phase} accent={meta.accent} />

      {/* ── PRELOADING UI ───────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'preloading' && (
          <motion.div
            key="preloader"
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 400, background: '#050402'
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              style={{
                width: '40px', height: '40px',
                border: '2px solid rgba(255,255,255,0.1)',
                borderTop: `2px solid ${meta.accent}`,
                borderRadius: '50%',
                marginBottom: '20px'
              }}
            />
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
              color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em'
            }}>
              DECRYPTING ASSETS...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient glow */}
      <motion.div
        animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        style={{
          position: 'absolute', width: 'min(600px, 150vw)', height: 'min(600px, 150vw)', borderRadius: '50%',
          background: `radial-gradient(ellipse, ${meta.accent}25, transparent 70%)`,
          filter: 'blur(80px)', pointerEvents: 'none',
        }}
      />

      {/* ── PACK SHELL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showPack && (
          <motion.div
            key="pack-wrapper"
            // Drag Interactive (desktop) + tap fallback (mobile)
            drag={['idle', 'grip', 'tension'].includes(phase) ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragStart={() => {
              if (phase !== 'idle') return;
              setPhase('grip');
              playCrinkle();
            }}
            onDrag={(_, info) => {
              if (!['idle', 'grip', 'tension'].includes(phase)) return;
              const y = info.offset.y;

              if (y > 40 && phase !== 'tension') {
                setPhase('tension');
                playTension();
              }

              if (y > 150) {
                // Drag threshold passed! Trigger tear and snap
                triggerRevealSequence();
              }
            }}
            onDragEnd={(_, info) => {
              // Return to idle if drag didn't pass rip threshold
              if (['grip', 'tension'].includes(phase) && info.offset.y <= 150) {
                setPhase('idle');
              }
            }}
            // Mobile tap-to-rip fallback
            onClick={handlePackTap}
            // Idle float
            animate={
              phase === 'idle'
                ? { y: [-4, 4, -4], rotate: [-1, 1, -1], scale: 1 }
                : phase === 'grip'
                ? { y: 0, rotate: 0, scale: [1, 0.96, 0.96, 0.94], x: [0, -2, 2, -2, 2, -1, 1, 0] }
                : phase === 'tension'
                ? { y: 0, rotate: 0, scale: 0.94, scaleY: 1.08 }
                : phase === 'tearing'
                ? { y: 0, rotate: 0, scale: 0.94 }
                : phase === 'snap'
                ? { y: 0, rotate: 0, scale: 1.05 }
                : {}
            }
            transition={
              phase === 'idle'
                ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
                : phase === 'grip'
                ? { duration: 0.4, ease: [0.36, 0.07, 0.19, 0.97] }
                : phase === 'tension'
                ? { duration: 0.3, ease: 'easeOut' }
                : { duration: 0.12 }
            }
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: 'relative', width: '220px', height: '300px',
              perspective: '800px',
            }}
          >
            <PackShell meta={meta} phase={phase} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAP PROMPT ──────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === 'idle' && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{ textAlign: 'center', pointerEvents: 'none', marginTop: '24px' }}
          >
            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '11px',
                fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase',
                color: meta.accent,
              }}
            >
              PULL TO RIP · TAP TO OPEN
            </motion.p>
            <p style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
              letterSpacing: '0.15em', marginTop: '6px', opacity: 0.25,
              color: '#fff', textTransform: 'uppercase',
            }}>
              {meta.cardCount} card{meta.cardCount > 1 ? 's' : ''} inside
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CARD STACK ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showCards && (
          <motion.div
            key="card-stack"
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: phase === 'rise' ? -20 : 0,
              rotateX: phase === 'rise' ? 10 : 0,
            }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              gap: phase === 'layout' || phase === 'inspect' ? '0px' : '0px',
              perspective: '1200px',
              position: 'relative',
              minHeight: '340px',
              width: '100%',
            }}
          >
            {/* Near-miss gold flash */}
            <AnimatePresence>
              {nearMissFlash && (
                <motion.div
                  key="near-miss"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.8, 0] }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    background: 'radial-gradient(circle, rgba(255,215,0,0.4), transparent 70%)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </AnimatePresence>

            {/* Dim overlay behind expanded card (internal to stacking context) */}
            <AnimatePresence>
              {expandedIndex !== null && (phase === 'layout' || phase === 'inspect') && (
                <motion.div
                  key="expand-dim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setExpandedIndex(null)}
                  style={{
                    position: 'fixed', inset: 0,
                    background: '#000', zIndex: 210, // Above normal cards (0-200), below expanded (250)
                    cursor: 'pointer',
                  }}
                />
              )}
            </AnimatePresence>

            {cards.map((owned, i) => {
              const rarity = owned.card.rarity as Rarity;
              const rarityColor = RARITY_CONFIG[rarity]?.color || '#fff';
              const isRevealed = flippedCards.has(i);
              const isCurrentFlip = flipIndex === i;
              const isRare = isRareOrHigher(rarity);
              const isInLayout = phase === 'layout' || phase === 'inspect';
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

              let targetX = 0;
              let targetY = i * 2; // Default stack offset
              let targetRotate = 0;
              let baseScale = 1;

              if (isInLayout) {
                // Determine max columns based on screen size and pack size
                const maxCols = isMobile ? Math.min(3, cards.length) : (cards.length > 5 ? 5 : cards.length);
                
                // Calculate grid indices
                const row = Math.floor(i / maxCols);
                const col = i % maxCols;

                // Center the specific row if it's the last row and not completely full
                const cardsInRow = Math.min(maxCols, cards.length - row * maxCols);
                const rowCenter = (cardsInRow - 1) / 2;

                // Vertically center the entire block
                const totalRows = Math.ceil(cards.length / maxCols);
                const verticalCenterOffset = (totalRows - 1) / 2;

                // Optimal scaling for large packs
                baseScale = isMobile 
                  ? (cards.length > 6 ? 0.35 : 0.45) 
                  : (cards.length > 5 ? 0.5 : 0.7);

                const stepX = isMobile 
                  ? (cards.length > 6 ? 85 : 120)
                  : (cards.length > 5 ? 130 : 170);
                  
                const stepY = isMobile 
                  ? (cards.length > 6 ? 120 : 160)
                  : (cards.length > 5 ? 180 : 230);

                targetX = (col - rowCenter) * stepX;
                targetY = (row - verticalCenterOffset) * stepY;
                
                // Slight organic rotation fan for each card in the row
                targetRotate = (col - rowCenter) * (isMobile ? 1.5 : 2.5);

                // If expanded or hovered
                if (expandedIndex === i) {
                  targetX = 0;
                  targetY = 0;
                  targetRotate = 0; // Straighten when inspecting
                  baseScale = isMobile ? 1.2 : 1.8;
                } else if (inspectIndex === i) {
                  targetY -= isMobile ? 10 : 20; // Raise slightly
                  baseScale *= 1.05; // Very slight scale on hover
                  targetRotate *= 0.9; // Lessen rotation slightly
                }
              }

              // Reveal pause glow intensity based on rarity
              const glowIntensity = phase === 'pause'
                ? (rarity === 'mythic' ? 0.8 : rarity === 'legendary' ? 0.5 : rarity === 'rare' ? 0.35 : 0.15)
                : 0;

              // Inspection tilt
              const isInspecting = expandedIndex === i || inspectIndex === i;
              const tiltX = isInspecting ? mousePos.y * (isMobile ? 0 : 12) : 0;
              const tiltY = isInspecting ? mousePos.x * (isMobile ? 0 : 12) : 0;

              return (
                <motion.div
                  key={owned.id}
                  onClick={() => handleCardClick(i)}
                  animate={{
                    x: targetX,
                    y: targetY,
                    rotate: targetRotate,
                    rotateX: tiltX,
                    rotateY: tiltY,
                    scale: rareRevealing && isCurrentFlip ? 1.08 : baseScale,
                    opacity: (!isRevealed && phase === 'flipping' && i > flipIndex) ? 0.6 : 1,
                  }}
                  transition={{
                    type: 'spring', stiffness: 300, damping: 25,
                    ...(isInLayout ? { delay: i * 0.06 } : {}),
                  }}
                  style={{
                    position: 'absolute',
                    width: '220px',
                    zIndex: expandedIndex === i ? 250 : (inspectIndex === i ? 200 : (isCurrentFlip ? 50 : i)),
                    cursor: isInLayout ? 'pointer' : 'default',
                    transformStyle: 'preserve-3d',
                  }}
                  onMouseEnter={() => handleCardHover(i)}
                  onMouseLeave={() => handleCardHover(null)}
                >
                  {/* Rarity glow under card during pause */}
                  {phase === 'pause' && (
                    <motion.div
                      animate={{ opacity: [glowIntensity * 0.5, glowIntensity, glowIntensity * 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{
                        position: 'absolute', inset: '-16px', borderRadius: '16px',
                        background: `radial-gradient(ellipse, ${rarityColor}40, transparent 70%)`,
                        filter: 'blur(12px)', pointerEvents: 'none', zIndex: -1,
                      }}
                    />
                  )}

                  {/* Card shake during pause */}
                  <motion.div
                    animate={phase === 'pause' ? { x: [-1, 1, -1] } : {}}
                    transition={phase === 'pause' ? { repeat: Infinity, duration: 0.3 } : {}}
                  >
                        {/* Foil shimmer for rare+ */}
                        {isRare && isRevealed && (
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

                        {/* Screen flash on rare impact */}
                        {isRare && isCurrentFlip && isRevealed && (
                          <motion.div
                            initial={{ opacity: 0.8 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                              position: 'fixed', inset: 0,
                              background: '#fff', zIndex: 300, pointerEvents: 'none',
                            }}
                          />
                        )}

                        <Card 
                            card={owned.card}
                            edition={owned.edition}
                            interactive={true} 
                            showAudio={false} 
                            isDailyOrigin={owned.source === 'daily_claim' || owned.source === 'pack_miss_out'} 
                            ultraReward={owned.ultraReward} 
                            isRevealed={isRevealed}
                            isEcho={owned.isEcho}
                            echoGeneration={owned.echoGeneration}
                        />
                        {isRevealed && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ marginTop: '8px', textAlign: 'center' }}>
                            <RarityBadge rarity={rarity} size="sm" />
                          </motion.div>
                        )}
                  </motion.div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ultra reward crackling overlay */}
      <AnimatePresence>
        {ultraTriggered && (
          <motion.div
            key="ultra"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.7, 1, 0] }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 250, pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(255,215,0,0.3), rgba(255,100,0,0.15), transparent 70%)',
            }}
          >
            {/* Gold fracture lines */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 1, 0] }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                style={{
                  position: 'absolute',
                  top: `${30 + Math.random() * 40}%`,
                  left: `${20 + Math.random() * 60}%`,
                  width: `${40 + Math.random() * 80}px`,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #ffd700, transparent)',
                  transform: `rotate(${Math.random() * 360}deg)`,
                  transformOrigin: 'left center',
                  filter: 'blur(0.5px)',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flip counter */}
      <AnimatePresence>
        {phase === 'flipping' && flipIndex >= 0 && (
          <motion.div
            key={`flip-counter-${flipIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', bottom: '60px',
              fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
              fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            CARD {flipIndex + 1} / {cards.length}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue Button */}
      <AnimatePresence>
        {(phase === 'layout' || phase === 'inspect') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            style={{
              position: 'fixed', bottom: '40px',
              display: 'flex', gap: '12px', zIndex: 300,
            }}
          >
            {onBuyAnother && (
              <motion.button
                onClick={onBuyAnother}
                disabled={isRepurchasing}
                style={{
                  padding: '12px 24px', borderRadius: '8px',
                  background: `${meta.accent}18`,
                  color: '#fff',
                  fontFamily: '"JetBrains Mono", monospace', fontWeight: 900,
                  letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '12px',
                  border: `1px solid ${meta.accent}40`,
                  cursor: isRepurchasing ? 'default' : 'pointer',
                  opacity: isRepurchasing ? 0.5 : 1,
                  backdropFilter: 'blur(10px)',
                }}
                whileHover={!isRepurchasing ? { scale: 1.05 } : {}}
                whileTap={!isRepurchasing ? { scale: 0.98 } : {}}
              >
                {isRepurchasing ? 'RIPPING...' : 'RIP ANOTHER'}
              </motion.button>
            )}
            <motion.button
              onClick={handleStartDecrypter}
              style={{
                padding: '12px 24px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #00f0ff, #7000ff)',
                color: '#fff',
                fontFamily: '"JetBrains Mono", monospace', fontWeight: 900,
                letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: '11px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 32px rgba(0,240,255,0.25)'
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              [ Decrypt Fragments ]
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FIRST-TIME UNLOCK OVERLAY ────────────────────────────── */}
      <AnimatePresence>
        {firstUnlockCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: '#050402',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '24px'
            }}
          >
            {/* Pulsing glow background in rarity color */}
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                width: '600px',
                height: '600px',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700'}30, transparent 75%)`,
                filter: 'blur(80px)',
                pointerEvents: 'none',
              }}
            />

            {/* Scanning monitor scanlines */}
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.15) 2px, rgba(0, 0, 0, 0.15) 4px)'
            }} />

            {/* Underground header */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ textAlign: 'center', zIndex: 10, marginBottom: '32px' }}
            >
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '11px',
                fontWeight: 900,
                color: RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700',
                letterSpacing: '0.4em',
                textTransform: 'uppercase',
                textShadow: `0 0 10px ${RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700'}50`
              }}>
                [ NEW SIGNAL UNLOCKED ]
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '8px',
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.2em',
                marginTop: '6px',
                textTransform: 'uppercase'
              }}>
                Neural Compatibility Confirmed // Minting Provenance
              </div>
            </motion.div>

            {/* Rising card in the center */}
            <motion.div
              initial={{ scale: 0.3, rotateY: -180, y: 100, opacity: 0 }}
              animate={{ scale: 1.15, rotateY: 0, y: 0, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 180, damping: 20, delay: 0.3 }}
              style={{
                perspective: '1000px',
                zIndex: 10,
                marginBottom: '40px',
                filter: `drop-shadow(0 0 35px ${RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700'}30)`
              }}
            >
              <Card card={firstUnlockCard.card} interactive={false} showAudio={false} isRevealed={true} />
            </motion.div>

            {/* Title / Artist details */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              style={{ textAlign: 'center', zIndex: 10, marginBottom: '36px', maxWidth: '300px' }}
            >
              <h2 style={{
                fontFamily: 'Impact, sans-serif',
                fontSize: '24px',
                fontWeight: 900,
                color: '#fff',
                margin: 0,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                transform: 'scaleY(1.15)'
              }}>
                {firstUnlockCard.card.title}
              </h2>
              <p style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.5)',
                margin: '8px 0 0',
                letterSpacing: '0.15em',
                textTransform: 'uppercase'
              }}>
                by {firstUnlockCard.card.artist}
              </p>
            </motion.div>

            {/* Continue / Integrate Button */}
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8 }}
              onClick={() => {
                if (unlockResolveRef.current) {
                  unlockResolveRef.current();
                  unlockResolveRef.current = null;
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                zIndex: 10,
                padding: '14px 32px',
                background: RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700',
                color: '#000',
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 900,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: `0 8px 32px ${RARITY_CONFIG[firstUnlockCard.card.rarity]?.color || '#ffd700'}30`,
                borderRadius: '4px'
              }}
            >
              [ INTEGRATE SIGNAL ]
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NEURAL FRAGMENT DECRYPTOR OVERLAY ───────────────────────── */}
      <AnimatePresence>
        {showFragmentDecrypter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 900,
              background: '#050402',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            {/* Scanlines overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 10,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.15) 2px, rgba(0, 0, 0, 0.15) 4px)'
            }} />

            {/* Neon ambient glow */}
            <motion.div
              animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
              style={{
                position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
                background: 'radial-gradient(circle, #00f0ff20, #7000ff10, transparent 70%)',
                filter: 'blur(100px)', pointerEvents: 'none',
              }}
            />

            {decrypterPhase === 'idle' && (
              <div className="flex flex-col items-center gap-8 z-20">
                {/* Cyberpunk Header */}
                <div className="text-center space-y-2">
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                    fontWeight: 900, color: '#00f0ff', letterSpacing: '0.4em',
                    textShadow: '0 0 10px rgba(0,240,255,0.4)', textTransform: 'uppercase',
                  }}>
                    [ NEURAL DECRYPTOR SEED v2.0 ]
                  </div>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '8px',
                    color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                  }}>
                    ESTABLISHING DENSITY CORRELATION DATA
                  </div>
                </div>

                {/* The glowing rotating 3D capsule pod */}
                <motion.div
                  onClick={handleDecryptPodTap}
                  animate={{
                    y: [-6, 6, -6],
                    rotateY: [0, 360],
                  }}
                  transition={{
                    y: { repeat: Infinity, duration: 3.5, ease: 'easeInOut' },
                    rotateY: { repeat: Infinity, duration: 20, ease: 'linear' },
                  }}
                  style={{
                    width: '160px', height: '240px',
                    position: 'relative',
                    perspective: '800px',
                    transformStyle: 'preserve-3d',
                    cursor: 'pointer',
                  }}
                >
                  {/* Glowing Wireframe Pod Design */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    border: '2px solid #00f0ff',
                    borderRadius: '80px / 30px',
                    background: 'linear-gradient(180deg, rgba(0, 240, 255, 0.05), rgba(112, 0, 255, 0.15))',
                    boxShadow: '0 0 40px rgba(0, 240, 255, 0.25), inset 0 0 30px rgba(0, 240, 255, 0.15)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: '15%',
                      width: '80%', height: '1px', background: '#00f0ff', opacity: 0.4
                    }} />
                    <div style={{
                      position: 'absolute', bottom: '15%',
                      width: '80%', height: '1px', background: '#00f0ff', opacity: 0.4
                    }} />
                    <span style={{
                      fontFamily: '"Impact", sans-serif', fontSize: '32px', color: '#fff',
                      transform: 'scaleY(1.2) scaleX(0.9)',
                      textShadow: '0 0 15px rgba(0,240,255,0.8), 2px 2px 0 #000',
                    }}>
                      FRAG
                    </span>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', color: '#7000ff',
                      fontWeight: 900, letterSpacing: '0.2em', marginTop: '6px',
                    }}>
                      POD {cards.length}x
                    </span>
                  </div>
                </motion.div>

                {/* Tap Prompt */}
                <div className="text-center space-y-2 pointer-events-none">
                  <motion.p
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: '11px',
                      fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase',
                      color: '#00f0ff',
                    }}
                  >
                    TAP TO EXTRACTION
                  </motion.p>
                  <p style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '8px',
                    letterSpacing: '0.12em', opacity: 0.3, color: '#fff',
                  }}>
                    EXTRACTS {cards.map(c => {
                      const rarity = c.card.rarity;
                      return rarity === 'common' ? 2 : rarity === 'uncommon' ? 3 : rarity === 'rare' ? 5 : 10;
                    }).reduce((a, b) => a + b, 0)} TOTAL FRAGMENTS
                  </p>
                </div>
              </div>
            )}

            {decrypterPhase === 'shaking' && (
              <motion.div
                animate={{
                  x: [-8, 8, -8, 8, -5, 5, -2, 2, 0],
                  y: [-4, 4, -4, 4, -2, 2, -1, 1, 0],
                }}
                transition={{ duration: 0.5 }}
                style={{
                  width: '160px', height: '240px',
                  border: '2.5px solid #ff3800',
                  borderRadius: '80px / 30px',
                  background: 'linear-gradient(180deg, rgba(255, 56, 0, 0.05), rgba(255, 184, 0, 0.15))',
                  boxShadow: '0 0 50px rgba(255, 56, 0, 0.4), inset 0 0 35px rgba(255, 56, 0, 0.25)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  zIndex: 20,
                }}
              >
                <span style={{
                  fontFamily: '"Impact", sans-serif', fontSize: '32px', color: '#fff',
                  textShadow: '0 0 15px #ff3800, 2px 2px 0 #000',
                }}>
                  DECRYPT
                </span>
              </motion.div>
            )}

            {decrypterPhase === 'ripping' && (
              <div style={{ position: 'relative', width: '160px', height: '240px', zIndex: 20 }}>
                {/* Top half splits upwards */}
                <motion.div
                  initial={{ y: 0, rotate: 0, opacity: 1 }}
                  animate={{ y: -200, rotate: -10, opacity: 0 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: 0,
                    clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 45%)',
                    border: '2px solid #00f0ff',
                    borderRadius: '80px / 30px',
                    background: 'linear-gradient(180deg, rgba(0, 240, 255, 0.05), rgba(112, 0, 255, 0.15))',
                  }}
                />
                {/* Bottom half splits downwards */}
                <motion.div
                  initial={{ y: 0, rotate: 0, opacity: 1 }}
                  animate={{ y: 200, rotate: 8, opacity: 0 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: 0,
                    clipPath: 'polygon(0 45%, 100% 50%, 100% 100%, 0 100%)',
                    border: '2px solid #00f0ff',
                    borderRadius: '80px / 30px',
                    background: 'linear-gradient(180deg, rgba(0, 240, 255, 0.05), rgba(112, 0, 255, 0.15))',
                  }}
                />
              </div>
            )}

            {/* Full Screen White Flash Overlay */}
            <AnimatePresence>
              {decrypterPhase === 'ripping' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.95, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: '#00f0ff',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </AnimatePresence>

            {decrypterPhase === 'revealed' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg flex flex-col items-center gap-6 z-20"
              >
                {/* Title */}
                <div className="text-center space-y-1.5">
                  <h3 style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '28px', color: '#fff', textTransform: 'uppercase',
                    letterSpacing: '0.05em', transform: 'scaleY(1.15)',
                    textShadow: '0 0 20px rgba(0,240,255,0.4)', margin: 0
                  }}>
                    FRAGMENTS EXTRACTED
                  </h3>
                  <p style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                    color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em',
                    textTransform: 'uppercase'
                  }}>
                    Integrations synced to local cache
                  </p>
                </div>

                {/* Rewards Grid */}
                <div className="w-full space-y-4 max-h-[50vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {fragmentRewards.map((rew, index) => {
                    const rarityColor = RARITY_CONFIG[rew.rarity]?.color || '#fff';
                    return (
                      <motion.div
                        key={`${rew.cardId}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.15 }}
                        className="flex items-center gap-4 border-2 border-black p-3.5 relative overflow-hidden"
                        style={{
                          background: '#0d0d0d',
                          boxShadow: '4px 4px 0 #000',
                          border: `1.5px solid ${rarityColor}35`,
                        }}
                      >
                        {rew.coverArt ? (
                          <img
                            src={rew.coverArt}
                            alt={rew.title}
                            className="w-14 h-14 object-cover border-2 border-black flex-shrink-0"
                            style={{ boxShadow: '2px 2px 0 #000' }}
                          />
                        ) : (
                          <div
                            className="w-14 h-14 border-2 border-black flex-shrink-0 flex items-center justify-center font-black"
                            style={{
                              background: rarityColor,
                              color: '#000',
                              boxShadow: '2px 2px 0 #000',
                              fontFamily: 'Impact, sans-serif'
                            }}
                          >
                            {rew.rarity.substring(0, 2).toUpperCase()}
                          </div>
                        )}

                        {/* Song Details & Progress */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <div
                                className="font-black truncate leading-tight text-sm uppercase"
                                style={{ fontFamily: '"Impact", "Arial Black", sans-serif', color: '#fff' }}
                              >
                                {rew.title}
                              </div>
                              <div className="text-[9px] font-mono opacity-50 truncate uppercase tracking-wider">
                                by {rew.artist}
                              </div>
                            </div>
                            
                            <div className="flex-shrink-0 text-right">
                              <span
                                className="text-xs font-black italic tracking-tight font-mono"
                                style={{ color: '#00f0ff' }}
                              >
                                +{rew.added} FRAGS
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar Container */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[8px] font-mono">
                              <span style={{ color: rarityColor }} className="uppercase font-bold tracking-widest">
                                {rew.rarity}
                              </span>
                              <span style={{ color: '#fff' }} className="font-bold">
                                {rew.newTotal} / 10 FRAGMENTS
                              </span>
                            </div>
                            
                            <div className="h-2 w-full bg-black/80 rounded-full overflow-hidden border border-white/5 relative">
                              {/* Old Total Bar */}
                              <div
                                className="absolute left-0 top-0 bottom-0 rounded-full"
                                style={{
                                  width: `${(rew.oldTotal / 10) * 100}%`,
                                  background: 'rgba(255,255,255,0.15)',
                                }}
                              />
                              {/* Animated Added Bar */}
                              <motion.div
                                initial={{ width: `${(rew.oldTotal / 10) * 100}%` }}
                                animate={{ width: `${(rew.newTotal / 10) * 100}%` }}
                                transition={{ duration: 1.2, delay: index * 0.15 + 0.3, ease: 'easeOut' }}
                                className="absolute left-0 top-0 bottom-0 rounded-full"
                                style={{
                                  background: `linear-gradient(90deg, ${rarityColor}, #00f0ff)`,
                                  boxShadow: `0 0 8px ${rarityColor}`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Blinking unlocked notification banner */}
                        {rew.newTotal >= 10 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: [0, 1, 0.4, 1], scale: 1 }}
                            transition={{ duration: 0.8, delay: index * 0.15 + 0.9 }}
                            className="absolute right-3 bottom-2 px-2 py-0.5 text-[8px] font-mono font-black rounded"
                            style={{
                              background: 'rgba(0, 240, 255, 0.15)',
                              border: '1px solid #00f0ff',
                              color: '#00f0ff',
                              boxShadow: '0 0 10px rgba(0, 240, 255, 0.3)',
                              letterSpacing: '0.15em',
                              textTransform: 'uppercase',
                            }}
                          >
                            UNLOCKED
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Continue CTA */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: fragmentRewards.length * 0.15 + 1.2 }}
                  onClick={onComplete}
                  className="w-full py-4 text-sm font-black italic tracking-wider uppercase border-2 border-black drop-shadow-[0_0_20px_rgba(255,215,0,0.3)] cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
                    color: '#000',
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    transform: 'rotate(-0.5deg)',
                    boxShadow: '4px 4px 0 #000',
                  }}
                >
                  {meta.category === 'daily_claim' || meta.redirectPath === '/tutorial' || meta.redirectPath?.startsWith('/play/') ? '[ START PIM GATEWAY ]' : '[ COMPLETE SYNC ]'}
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
