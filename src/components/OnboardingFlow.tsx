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
import type { OwnedCard, VaultCard } from '../services/vaultService';
import { purchasePack, redeemInviteCode, fetchAllCards, findCardWithFallback } from '../services/vaultService';
import { useVaultStore } from '../store/useVaultStore';
import { useLocation } from 'wouter';
import { useAuthStore } from '../store/useAuthStore';
import { RARITY_CONFIG } from '../utils/rarity';
import { getAdminConfig } from '../utils/adminConfig';
import { logAnalyticsEvent } from '../services/telemetryService';
import { audioManager } from '../game/audio';
import { GraduationCap, Wallet, Zap, ChevronRight, Radio, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

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
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>('welcome');
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [loadError, setLoadError] = useState(false);
  const purchasedRef = useRef(false);
  const { addToCollection, loadVaultData } = useVaultStore();
  const { user, setShowAuthModal } = useAuthStore();
  const isGuest =
    user?.is_anonymous ||
    user?.app_metadata?.provider === 'anonymous' ||
    (!user?.email && !user?.user_metadata?.wallet && !user?.user_metadata?.wallet_address);

  // Track start of onboarding funnel
  useEffect(() => {
    logAnalyticsEvent('onboarding_start');
  }, []);

  // Phase 0 → 1: Purchase pack after wallet authentication with fast fallback
  useEffect(() => {
    if (phase !== 'welcome') return;
    if (purchasedRef.current) return;
    purchasedRef.current = true;

    async function buyWelcomePack() {
      try {
        const timeoutPromise = new Promise<OwnedCard[]>((resolve) => setTimeout(() => resolve([]), 7000));
        const purchasePromise = (async () => {
          try {
            const res = await purchasePack('taste', 'single');
            if (res && res.length > 0) return res;
            const free = await purchasePack('free', 'single');
            if (free && free.length > 0) return free;
            return [];
          } catch {
            return [];
          }
        })();

        let result = await Promise.race([purchasePromise, timeoutPromise]);

        // If edge function returned empty, errored, or timed out, generate guaranteed welcome cards from local catalog
        if (!result || result.length === 0) {
          try {
            const pool = await fetchAllCards();
            if (pool && pool.length > 0) {
              const commonCard = pool.find(c => c.rarity === 'COMMON') || pool[0];
              const rareCard = pool.find(c => c.rarity === 'RARE' || c.rarity === 'UNCOMMON') || pool[1] || pool[0];
              const selected = [commonCard, rareCard].filter(Boolean);

              result = selected.map((card, idx) => ({
                id: `welcome_${Date.now()}_${idx}_${card.id}`,
                cardId: card.id,
                card: { ...card },
                source: 'pack_welcome',
                cardSet: 'gen-0',
                claimedAt: new Date().toISOString(),
                edition: 1,
                maxSupply: 1000,
                isEcho: false,
              }));
            }
          } catch (poolErr) {
            console.warn('[OnboardingFlow] Pool fetch fallback error:', poolErr);
          }
        }

        if (result && result.length > 0) {
          addToCollection(result);
          setCards(result);
          logAnalyticsEvent('onboarding_welcome_pull', {
            packType: 'welcome',
            cards: result.map(r => ({ cardId: r.cardId, rarity: r.card.rarity, isEcho: !!r.isEcho }))
          });
        } else {
          setLoadError(true);
        }
      } catch (err) {
        console.warn('[OnboardingFlow] Welcome pack error:', err);
        setLoadError(true);
      }
    }
    buyWelcomePack();
  }, [phase, addToCollection]);

  // Auto-advance from welcome → reveal after cards load
  useEffect(() => {
    if (phase !== 'welcome' || cards.length === 0) return;
    const timer = setTimeout(() => setPhase('reveal'), 1800);
    return () => clearTimeout(timer);
  }, [phase, cards]);

  // Skip welcome if there's an error
  useEffect(() => {
    if (loadError && phase === 'welcome') {
      onComplete();
    }
  }, [loadError, phase, onComplete]);

  // Master safety timeout: ensure the user is NEVER stuck on welcome screen
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (phase === 'welcome') {
        if (cards.length > 0) {
          setPhase('reveal');
        } else {
          onComplete();
        }
      }
    }, 10000);
    return () => clearTimeout(safetyTimer);
  }, [phase, cards, onComplete]);

  const handleRevealComplete = useCallback(() => {
    setPhase('explainer');
  }, []);

  const handleExplainerDone = useCallback(async () => {
    await logAnalyticsEvent('onboarding_complete');
    await loadVaultData(); // Sync with Supabase after welcome pull
    // Guests land on the conversion screen (rendered by the 'done' phase) so
    // they can bind an identity before the flow exits. Signed-in users skip it.
    setPhase('done');
    if (!isGuest) {
      onComplete();
    }
  }, [onComplete, loadVaultData, isGuest]);

  // Guest conversion actions from the DONE screen.
  const handleConnectIdentity = useCallback(() => {
    audioManager.playSfx('tap_nav', 0.4);
    onComplete(); // exit the flow first so it never re-triggers
    setShowAuthModal(true);
  }, [onComplete, setShowAuthModal]);

  const handleContinueAsGuest = useCallback(() => {
    audioManager.playSfx('tap_nav', 0.4);
    onComplete();
  }, [onComplete]);



  // ── WELCOME SPLASH ────────────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#070605',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingTop: 'calc(var(--fc-safe-area-top, 0px) + env(safe-area-inset-top, 0px) + 1.25rem)',
          paddingBottom: 'calc(var(--fc-safe-area-bottom, 0px) + env(safe-area-inset-bottom, 0px) + 5.5rem)',
        }}
      >
        {/* Ambient glow */}
        <motion.div
          animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: 'min(500px, 120vw)',
            height: 'min(500px, 120vw)',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,85,0,0.25) 0%, rgba(255,20,147,0.12) 40%, transparent 70%)',
            filter: 'blur(70px)',
            pointerEvents: 'none',
          }}
        />

        {/* CRT Scanline & grid screen effects */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,20,147,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.015) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* Content Card with my-auto for natural vertical centering & mobile scrolling */}
        <div className="w-full max-w-sm px-4 my-auto flex flex-col items-center text-center relative z-10 space-y-4">
          
          {/* Top HUD Stomp Line */}
          <div className="w-full flex items-center justify-between border-b border-white/10 pb-2 font-mono text-[9px] text-zinc-400 font-black tracking-widest uppercase">
            <span className="text-[#00E5FF] flex items-center gap-1.5">
              <Radio size={11} className="text-[#00E5FF] animate-pulse" />
              SYS // PIM_VAULT_v2
            </span>
            <span className="text-[#FF5500]">INITIAL_TRANSMISSION</span>
          </div>

          {/* Central Holographic Radar HUD Graphic */}
          <div className="relative my-1 flex items-center justify-center">
            {/* Spinning Radar Reticle Ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 16, ease: 'linear' }}
              className="absolute w-32 h-32 rounded-full border border-dashed border-[#FF5500]/30 pointer-events-none"
            />
            {/* Pulsing inner cyan ring */}
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              className="absolute w-28 h-28 rounded-full border border-[#00E5FF]/40 pointer-events-none"
            />

            {/* Core Emblem Badge */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.15 }}
              style={{
                width: '84px',
                height: '84px',
                background: 'linear-gradient(145deg, #180a04 0%, #2e1005 60%, #120401 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #FF5500',
                boxShadow: '0 0 35px rgba(255,85,0,0.55), inset 0 0 15px rgba(255,20,147,0.3)',
                position: 'relative',
              }}
            >
              {/* Corner tech ticks */}
              <div className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-[#00E5FF]" />
              <div className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r border-[#00E5FF]" />
              <div className="absolute bottom-1 left-1 w-1.5 h-1.5 border-b border-l border-[#00E5FF]" />
              <div className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-[#00E5FF]" />

              <span
                style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: '44px',
                  fontWeight: 900,
                  color: '#fff',
                  lineHeight: 1,
                  textShadow: '0 0 20px rgba(255,85,0,0.8)',
                  letterSpacing: '-2px',
                }}
              >
                V
              </span>
              <span className="font-mono text-[7px] text-[#00E5FF] font-black tracking-widest mt-0.5 uppercase">
                詩の動き
              </span>
            </motion.div>
          </div>

          {/* Title & Subtitle */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="font-mono text-2xl font-black tracking-tight text-white uppercase m-0 leading-none drop-shadow-[0_0_20px_rgba(255,85,0,0.5)]"
            >
              PIM : th3v4ult
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              transition={{ delay: 0.5 }}
              className="font-mono text-[9px] font-black tracking-[0.28em] text-[#FF5500] uppercase mt-2"
            >
              365 DAYS OF DARK AND LIGHT
            </motion.p>
          </div>

          {/* Status pill: preparing first pack */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full font-mono text-[8.5px] font-bold text-zinc-300 tracking-wider uppercase"
          >
            <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-ping" />
            <span>PREPARING WELCOME PACK // READY</span>
          </motion.div>

          {/* Onboarding Choices: PIM Technical Brutalist Action Buttons */}
          <div className="w-full space-y-2.5 pt-2">
            {/* Primary Action: FLIGHT ACADEMY */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setLocation('/tutorial');
              }}
              style={{
                clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)',
              }}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FF1493] via-[#ff3800] to-[#FF5500] hover:brightness-110 active:brightness-90 text-white font-mono font-black tracking-[0.15em] uppercase border-2 border-black shadow-[0_0_25px_rgba(255,20,147,0.45)] transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded bg-black/40 flex items-center justify-center shrink-0 border border-white/20">
                  <GraduationCap size={16} className="text-white group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <div className="text-[12px] font-black leading-tight tracking-wide text-white">
                    ENTER FLIGHT ACADEMY
                  </div>
                  <div className="text-[8.5px] font-bold text-white/80 normal-case tracking-normal">
                    Pilot Training · Guaranteed 2-Card Welcome Pack
                  </div>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-white group-hover:translate-x-1 transition-transform" />
            </motion.button>

            {/* Secondary Action: SIGN IN / CONNECT WALLET */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                useAuthStore.getState().setShowAuthModal(true);
              }}
              style={{
                clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)',
              }}
              className="w-full py-3 px-4 bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20 active:bg-[#00E5FF]/30 text-[#00E5FF] hover:text-white font-mono font-black text-xs tracking-[0.15em] uppercase border-2 border-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.25)] transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded bg-[#00E5FF]/20 flex items-center justify-center shrink-0 border border-[#00E5FF]/40">
                  <Wallet size={15} className="text-[#00E5FF] group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <div className="text-[12px] font-black leading-tight tracking-wide">
                    SIGN IN / CONNECT WALLET
                  </div>
                  <div className="text-[8.5px] font-bold text-zinc-300 normal-case tracking-normal">
                    Base Web3 · Coinbase Smart Wallet · Passkey
                  </div>
                </div>
              </div>
              <Zap size={15} className="shrink-0 text-[#00E5FF] group-hover:rotate-12 transition-transform" />
            </motion.button>

            {/* Tertiary / Skip Action: inside card, safely buffered from bottom */}
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              onClick={() => {
                logAnalyticsEvent('onboarding_skip');
                onComplete();
              }}
              className="w-full pt-1.5 pb-0.5 text-zinc-500 hover:text-zinc-200 font-mono text-[9.5px] font-bold tracking-[0.2em] uppercase transition-all cursor-pointer flex items-center justify-center gap-1 hover:underline decoration-[#00E5FF]/50"
            >
              <span>SKIP TO VAULT</span>
              <span className="text-[#00E5FF]">➔</span>
            </motion.button>
          </div>

        </div>

        {/* Film grain */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 100,
            opacity: 0.05,
            mixBlendMode: 'overlay',
            background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
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

  if (phase === 'done') {
    // Guests get a conversion screen: bind an identity to keep the cards they
    // just pulled. Signed-in users never see this (onComplete fires instantly).
    if (isGuest) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#070605',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflowY: 'auto',
          }}
        >
          {/* Glow */}
          <div style={{
            position: 'absolute', width: 'min(420px, 150vw)', height: 'min(420px, 150vw)', borderRadius: '50%',
            background: 'radial-gradient(ellipse, #39FF1420, transparent 70%)',
            filter: 'blur(60px)', pointerEvents: 'none',
          }} />

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 260, delay: 0.1 }}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(57,255,20,0.08)',
              border: '2px solid #39FF14',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <ShieldCheck size={34} color="#39FF14" />
          </motion.div>

          <p style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: '0.35em', color: '#39FF14', marginBottom: 8,
          }}>
            FIRST PULL SECURED
          </p>
          <h2 style={{
            fontFamily: 'Impact, sans-serif', fontSize: 34, color: '#fff',
            textTransform: 'uppercase', letterSpacing: '0.02em',
            textAlign: 'center', marginBottom: 12, lineHeight: 1.1,
          }}>
            Your cards are<br />in the vault
          </h2>
          <p style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
            color: 'rgba(255,255,255,0.55)', textAlign: 'center',
            maxWidth: 320, lineHeight: 1.7, marginBottom: 28,
          }}>
            They live in this browser for now. Connect an identity — email,
            wallet, or GitHub — to bind your cards, streaks, and progress to
            your sovereign profile forever.
          </p>

          <button
            onClick={handleConnectIdentity}
            style={{
              width: '100%', maxWidth: 320, padding: '14px 0',
              background: '#39FF14', color: '#000',
              fontFamily: 'Impact, sans-serif', fontSize: 17,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              border: '2px solid #000', boxShadow: '4px 4px 0 #000',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 16,
            }}
          >
            Connect identity <ArrowRight size={18} />
          </button>

          <button
            onClick={handleContinueAsGuest}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            Continue as guest
          </button>
        </motion.div>
      );
    }

    return (
      <div className="fixed inset-0 bg-[#050402] flex flex-col items-center justify-center z-[9999]">
        <div
          className="w-8 h-8 border-2 border-white/10 rounded-full animate-spin mb-4"
          style={{ borderTopColor: '#ff3800' }}
        />
        <p className="font-mono text-[10px] tracking-widest text-[#ff3800] uppercase">
          Synchronizing Vault Profile...
        </p>
      </div>
    );
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
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#070605',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '16px',
        paddingTop: 'calc(var(--fc-safe-area-top, 0px) + env(safe-area-inset-top, 0px) + 1.5rem)',
        paddingBottom: 'calc(var(--fc-safe-area-bottom, 0px) + env(safe-area-inset-bottom, 0px) + 5.5rem)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
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

      <div className="my-auto w-full max-w-sm flex flex-col items-center text-center relative z-10">
        {/* Pull summary — shown on first step */}
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="pull-summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                display: 'flex', gap: '12px', marginBottom: '24px',
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
            style={{ width: '100%', textAlign: 'center' }}
          >
            {/* Step indicator */}
            <div style={{
              display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '20px',
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
              fontSize: '26px', fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '-0.5px',
              color: '#fff', lineHeight: 1.1,
              textShadow: `0 0 20px ${current.accent}60, 2px 2px 0 rgba(0,0,0,0.9)`,
              margin: '0 0 14px',
            }}>
              {current.title}
            </h2>

            {/* Divider */}
            <div style={{
              width: '40px', height: '2px', margin: '0 auto 14px',
              background: `linear-gradient(90deg, transparent, ${current.accent}, transparent)`,
            }} />

            {/* Body */}
            <p style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '11.5px', lineHeight: 1.6,
              color: 'rgba(255,255,255,0.65)',
              margin: '0 0 16px',
            }}>
              {current.body}
            </p>

            {current.showList && (
              <div style={{
                textAlign: 'left',
                maxHeight: '160px',
                overflowY: 'auto',
                background: 'rgba(255,255,255,0.02)',
                border: '2px solid rgba(255,255,255,0.08)',
                padding: '12px',
                scrollbarWidth: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <div>
                  <span style={{ color: '#b44dff', fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ultra Rewards</span>
                  <p style={{ margin: '4px 0 0', fontFamily: '"JetBrains Mono", monospace', fontSize: '9.5px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
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
                        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>{mod.description}</div>
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

        {/* PIM Sheared Brutalist CTA button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={isLast ? onDone : () => setStep(s => s + 1)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{
            marginTop: '24px',
            clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)',
            background: isLast
              ? 'linear-gradient(135deg, #FF1493 0%, #FF5500 100%)'
              : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontFamily: isLast
              ? '"Impact", "Arial Black", sans-serif'
              : '"JetBrains Mono", monospace',
            fontWeight: 900,
            fontSize: isLast ? '16px' : '11px',
            letterSpacing: isLast ? '-0.5px' : '0.18em',
            textTransform: 'uppercase',
            border: isLast ? '2px solid #000' : `2px solid ${current.accent}`,
            cursor: 'pointer',
            boxShadow: isLast
              ? '0 0 25px rgba(255,85,0,0.5), 3px 3px 0 #000'
              : `0 0 15px ${current.accent}40`,
            width: '100%',
            padding: '14px 20px',
          }}
        >
          {isLast ? 'ENTER THE VAULT ➔' : 'NEXT PILLAR ➔'}
        </motion.button>

        {/* Skip button inside the centered card */}
        {!isLast && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 0.8 }}
            onClick={onDone}
            style={{
              marginTop: '14px',
              background: 'none',
              border: 'none',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9.5px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
            }}
            className="hover:text-white transition-colors"
          >
            SKIP INTRO ➔
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
