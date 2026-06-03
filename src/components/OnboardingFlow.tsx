/**
 * OnboardingFlow — first-time user guided experience.
 *
 * Flow:
 *  1. WELCOME    — cinematic splash (auto-advances after ~2.5s)
 *  2. REVEAL     — auto-purchased free pack opens via PackContainer
 *  3. EXPLAINER  — brief animated explainer of core concepts
 *  4. DONE       — sets onboarded flag, hands control to App
 *
 * No menus. No decisions. Just flow.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PackContainer from './cinematic/PackContainer';
import type { RevealPackMeta } from '../store/useVaultStore';
import type { OwnedCard } from '../services/vaultService';
import { purchasePack, redeemInviteCode } from '../services/vaultService';
import { useVaultStore } from '../store/useVaultStore';
import { RARITY_CONFIG } from '../utils/rarity';
import { getAdminConfig } from '../utils/adminConfig';
import { logAnalyticsEvent } from '../services/telemetryService';



type Phase = 'welcome' | 'reveal' | 'explainer' | 'done';

const WELCOME_META: RevealPackMeta = {
  category: 'taste',
  size: 'single',
  label: 'WELCOME PACK',
  icon: '🎵',
  accent: '#ff3800',
  gradient: 'linear-gradient(160deg, #1a0800 0%, #3a1200 40%, #200a00 100%)',
  price: 'FREE',
  cardCount: 2,
  revealType: 'cinematic',
};

interface Props {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('welcome');
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [loadError, setLoadError] = useState(false);
  const purchasedRef = useRef(false);
  const { addToCollection, loadVaultData } = useVaultStore();

  // Phase 0 → 1: Purchase pack after invite is validated
  useEffect(() => {
    if (phase !== 'welcome') return;
    if (purchasedRef.current) return;
    purchasedRef.current = true;

    async function buyWelcomePack() {
      try {
        // Purchase a taste pack as the welcome gift
        const result = await purchasePack('taste', 'single');
        if (result.length > 0) {
          addToCollection(result);
          setCards(result);
        } else {
          // Fallback — try free pack
          const free = await purchasePack('free', 'single');
          if (free.length > 0) {
            addToCollection(free);
            setCards(free);
          } else {
            setLoadError(true);
          }
        }
      } catch {
        setLoadError(true);
      }
    }
    buyWelcomePack();
  }, [phase, addToCollection]);

  // Auto-advance from welcome → reveal after cards load
  useEffect(() => {
    if (phase !== 'welcome' || cards.length === 0) return;
    const timer = setTimeout(() => setPhase('reveal'), 2800);
    return () => clearTimeout(timer);
  }, [phase, cards]);

  // Skip welcome if there's an error
  useEffect(() => {
    if (loadError && phase === 'welcome') {
      onComplete();
    }
  }, [loadError, phase, onComplete]);

  const handleRevealComplete = useCallback(() => {
    setPhase('explainer');
  }, []);

  const handleExplainerDone = useCallback(async () => {
    await logAnalyticsEvent('onboarding_complete');
    await loadVaultData(); // Sync with Supabase after welcome pull
    setPhase('done');
    onComplete();
  }, [onComplete, loadVaultData]);



  // ── WELCOME SPLASH ────────────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#050402',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow */}
        <motion.div
          animate={{ opacity: [0.15, 0.3, 0.15], scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          style={{
            position: 'absolute', width: 'min(600px, 150vw)', height: 'min(600px, 150vw)', borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,56,0,0.25), transparent 70%)',
            filter: 'blur(80px)', pointerEvents: 'none',
          }}
        />

        {/* V icon */}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.2 }}
          style={{
            width: '90px', height: '90px',
            background: '#ff3800',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '56px', fontWeight: 900, color: '#fff',
            boxShadow: '6px 6px 0 #000, 0 0 40px rgba(255,56,0,0.6)',
            border: '4px solid #000',
            letterSpacing: '-3px',
            marginBottom: '24px',
          }}
        >
          V
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '32px', fontWeight: 900,
            letterSpacing: '-1px',
            color: '#fff',
            textShadow: '0 0 30px rgba(255,56,0,0.6), 3px 3px 0 rgba(0,0,0,0.9)',
            transform: 'scaleY(1.2)',
            margin: 0,
          }}
        >
          th3v4ult : PIM
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.9 }}
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.35em', textTransform: 'uppercase',
            color: '#ff3800', marginTop: '8px',
          }}
        >
          365 DAYS OF DARK AND LIGHT
        </motion.p>

        {/* Loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          style={{ marginTop: '48px', textAlign: 'center' }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            style={{
              width: '28px', height: '28px', margin: '0 auto 12px',
              border: '2px solid rgba(255,255,255,0.08)',
              borderTop: '2px solid #ff3800',
              borderRadius: '50%',
            }}
          />
          <motion.p
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px', letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
            }}
          >
            PREPARING YOUR FIRST PACK...
          </motion.p>
        </motion.div>

        {/* Film grain */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100,
          opacity: 0.05, mixBlendMode: 'overlay',
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />
      </motion.div>
    );
  }

  // ── CINEMATIC REVEAL ──────────────────────────────────────────────
  if (phase === 'reveal' && cards.length > 0) {
    return (
      <PackContainer
        key={`onboarding-${cards[0]?.id}`}
        meta={WELCOME_META}
        cards={cards}
        onComplete={handleRevealComplete}
      />
    );
  }

  // ── EXPLAINER ─────────────────────────────────────────────────────
  if (phase === 'explainer') {
    return <ExplainerOverlay cards={cards} onDone={handleExplainerDone} />;
  }

  return null;
}

// ── EXPLAINER SCREEN ──────────────────────────────────────────────────

const EXPLAINER_STEPS = [
  {
    title: 'YOU JUST RIPPED YOUR FIRST PACK',
    body: 'Every pack contains cards with different rarities — from Common to Mythic. Rarer cards are harder to pull.',
    accent: '#ff3800',
  },
  {
    title: 'EVERY CARD IS A SONG',
    body: 'Each card is a unique piece of music from th3scr1b3\'s 365-day archive. Rare cards unlock longer previews. Mythics unlock stems.',
    accent: '#ffd700',
  },
  {
    title: 'COLLECT · SELL · EARN',
    body: 'Sell duplicates for V⚡ tokens. Use tokens to buy Vault Packs with boosted odds. Climb the leaderboard.',
    accent: '#ff9900',
  },
  {
    title: 'CLAIM DAILY · NEVER MISS',
    body: 'A new free card drops every day. Come back daily to build your collection. Gen 0 cards are never reminted.',
    accent: '#00f0ff',
  },
  {
    title: 'FORGE BUFFS & ULTRA REWARDS',
    body: 'Explore the full list of dynamic drop modifiers you can unlock, and learn about the physical Ultra Rewards.',
    accent: '#b44dff',
    showList: true,
  },
];

function ExplainerOverlay({ cards, onDone }: { cards: OwnedCard[]; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step >= EXPLAINER_STEPS.length - 1;
  const current = EXPLAINER_STEPS[step];

  // Show a summary of what they pulled
  const rarityBreakdown = cards.reduce((acc, c) => {
    acc[c.card.rarity] = (acc[c.card.rarity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#050402',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Film grain */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100,
        opacity: 0.04, mixBlendMode: 'overlay',
        background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* Glow */}
      <motion.div
        key={step}
        animate={{ opacity: [0.1, 0.25, 0.1], scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 3 }}
        style={{
          position: 'absolute', width: 'min(400px, 150vw)', height: 'min(400px, 150vw)', borderRadius: '50%',
          background: `radial-gradient(ellipse, ${current.accent}20, transparent 70%)`,
          filter: 'blur(60px)', pointerEvents: 'none',
        }}
      />

      {/* Pull summary — shown on first step */}
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="pull-summary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              display: 'flex', gap: '12px', marginBottom: '32px',
              padding: '12px 20px',
              background: 'rgba(255,255,255,0.03)',
              border: '2px solid rgba(255,255,255,0.08)',
            }}
          >
            {Object.entries(rarityBreakdown).map(([rarity, count]) => (
              <div key={rarity} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '18px', fontWeight: 900,
                  color: RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG]?.color || '#fff',
                }}>
                  {count}×
                </div>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '8px', fontWeight: 700,
                  letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.4)',
                }}>
                  {rarity}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: '100%', maxWidth: '400px', textAlign: 'center', zIndex: 10 }}
        >
          {/* Step indicator */}
          <div style={{
            display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '24px',
          }}>
            {EXPLAINER_STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? '24px' : '6px',
                height: '6px',
                background: i === step ? current.accent : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>

          {/* Title */}
          <h2 style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: '28px', fontWeight: 900,
            textTransform: 'uppercase', letterSpacing: '-0.5px',
            color: '#fff', lineHeight: 1.1,
            textShadow: `0 0 20px ${current.accent}60, 2px 2px 0 rgba(0,0,0,0.9)`,
            margin: '0 0 16px',
          }}>
            {current.title}
          </h2>

          {/* Divider */}
          <div style={{
            width: '40px', height: '2px', margin: '0 auto 16px',
            background: `linear-gradient(90deg, transparent, ${current.accent}, transparent)`,
          }} />

          {/* Body */}
          <p style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12px', lineHeight: 1.7,
            color: 'rgba(255,255,255,0.55)',
            margin: '0 0 16px',
          }}>
            {current.body}
          </p>

          {current.showList && (
            <div style={{
              textAlign: 'left',
              maxHeight: '180px',
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.02)',
              border: '2px solid rgba(255,255,255,0.08)',
              padding: '12px',
              scrollbarWidth: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div>
                <span style={{ color: '#b44dff', fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ultra Rewards</span>
                <p style={{ margin: '4px 0 0', fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  0.3% chance per card to uncover a premium gold foil backing. Redeemable for physical 1-of-1s and custom prizes.
                </p>
              </div>
              <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <div>
                <span style={{ color: '#00d4aa', fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Forge Buffs</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {getAdminConfig().modifiers.filter(m => m.enabled).map(mod => (
                    <div key={mod.id}>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>{mod.name}</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{mod.description}</div>
                    </div>
                  ))}
                  {getAdminConfig().modifiers.filter(m => m.enabled).length === 0 && (
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>No active buffs right now.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* CTA button */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={isLast ? onDone : () => setStep(s => s + 1)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        style={{
          marginTop: '40px', zIndex: 10,
          padding: isLast ? '14px 36px' : '12px 28px',
          background: isLast ? '#ff3800' : `${current.accent}18`,
          color: '#fff',
          fontFamily: isLast
            ? '"Impact", "Arial Black", sans-serif'
            : '"JetBrains Mono", monospace',
          fontWeight: 900,
          fontSize: isLast ? '18px' : '11px',
          letterSpacing: isLast ? '-0.5px' : '0.15em',
          textTransform: 'uppercase',
          border: '2px solid #000',
          cursor: 'pointer',
          boxShadow: isLast
            ? '4px 4px 0 #000, 0 0 30px rgba(255,56,0,0.4)'
            : '2px 2px 0 #000',
        }}
      >
        {isLast ? 'ENTER THE VAULT →' : 'NEXT'}
      </motion.button>

      {/* Skip button */}
      {!isLast && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 0.8 }}
          onClick={onDone}
          style={{
            marginTop: '16px', zIndex: 10,
            background: 'none', border: 'none',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
          }}
        >
          SKIP INTRO
        </motion.button>
      )}
    </motion.div>
  );
}
