import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Info, Flame, Shield, Star, Clock, Target, Award, ChevronDown, ChevronUp } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { useLoadingToast } from '../store/useLoadingToast';
import { useLocation } from 'wouter';
import {
  sellCard, sellCards,
  getTokenPackCost, buyTokenPack,
  targetedPull, upgradeRarity, fuseDuplicates,
  type OwnedCard,
} from '../services/vaultService';
import { audioManager } from '../game/audio';
import {
  getAdminConfig, buildModifierContext, isModifierActive,
  type ConditionalModifier, type ModifierContext,
} from '../utils/adminConfig';
import {
  canProduceEcho,
} from '../utils/echoSystem';
import { RARITY_CONFIG, type Rarity } from '../utils/rarity';
import Card from '../components/Card';
import FusionAnimation from '../components/FusionAnimation';

// ═══════════════════════════════════════════════════════════════
// HELPER: Condition progress for each modifier
// ═══════════════════════════════════════════════════════════════

interface ModifierProgress {
  modifier: ConditionalModifier;
  current: number;
  target: number;
  progress: number; // 0–1
  isActive: boolean;
  icon: React.ElementType;
  accentColor: string;
  progressLabel: string;
}

function getModifierProgress(mod: ConditionalModifier, ctx: ModifierContext): ModifierProgress {
  const c = mod.condition;
  let current = 0;
  let target = c.threshold;
  let icon: React.ElementType = Star;
  let accentColor = '#00d4aa';
  let progressLabel = '';

  switch (c.type) {
    case 'streak':
      current = ctx.streak;
      icon = Flame;
      accentColor = '#ff6b00';
      progressLabel = `${current} / ${target} day streak`;
      break;
    case 'collection_size':
      current = ctx.collectionSize;
      icon = Target;
      accentColor = '#4d8fff';
      progressLabel = `${current} / ${target} unique cards`;
      break;
    case 'rarity_drought':
      current = ctx.pullsSinceRarePlus;
      icon = Shield;
      accentColor = '#c44dff';
      progressLabel = `${current} / ${target} pulls since Rare+`;
      break;
    case 'first_pack':
      current = ctx.isFirstPack ? 1 : 0;
      target = 1;
      icon = Award;
      accentColor = '#ffd700';
      progressLabel = ctx.isFirstPack ? 'Active — first pack!' : 'Already used';
      break;
    case 'time_of_day':
      current = 0;
      target = 1;
      icon = Clock;
      accentColor = '#00d4aa';
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (c.timeStart && c.timeEnd) {
        const [sh, sm] = c.timeStart.split(':').map(Number);
        const [eh, em] = c.timeEnd.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const inWindow = startMin <= endMin
          ? (nowMin >= startMin && nowMin < endMin)
          : (nowMin >= startMin || nowMin < endMin);
        current = inWindow ? 1 : 0;
        progressLabel = inWindow ? `Active now (${c.timeStart}–${c.timeEnd})` : `Available ${c.timeStart}–${c.timeEnd}`;
      }
      break;
    case 'milestone':
      current = ctx.collectionSize;
      icon = Award;
      accentColor = '#ffd700';
      progressLabel = `${current} / ${target} unique cards`;
      break;
    default:
      progressLabel = 'Unknown condition';
  }

  const progress = target > 0 ? Math.min(1, current / target) : 0;
  const isActive = isModifierActive(mod, ctx);

  return { modifier: mod, current, target, progress, isActive, icon, accentColor, progressLabel };
}

// ═══════════════════════════════════════════════════════════════
// INFO TOOLTIP
// ═══════════════════════════════════════════════════════════════

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        aria-label="Info"
        type="button"
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
          color: 'rgba(255,255,255,0.25)', transition: 'color 0.15s',
        }}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
      >
        <Info size={12} />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', bottom: '100%', left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '6px', padding: '8px 12px',
              background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px', backdropFilter: 'blur(8px)',
              fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
              color: 'rgba(255,255,255,0.7)', lineHeight: 1.5,
              whiteSpace: 'nowrap', zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            {text}
            <div style={{
              position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%) rotate(45deg)',
              width: '8px', height: '8px', background: 'rgba(0,0,0,0.92)',
              borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)',
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION LABEL (reusable)
// ═══════════════════════════════════════════════════════════════

function SectionLabel({ label, accent = '#ff3800' }: { label: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <div style={{ width: '6px', height: '32px', background: accent, boxShadow: `0 0 8px ${accent}88` }} />
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
        letterSpacing: '0.4em', textTransform: 'uppercase', opacity: 0.6,
      }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${accent}30, transparent)` }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODIFIER PROGRESS BAR
// ═══════════════════════════════════════════════════════════════

function ModifierProgressBar({ prog }: { prog: ModifierProgress }) {
  const { modifier, progress, isActive, icon: Icon, accentColor, progressLabel } = prog;
  const EFFECT_SHORT: Record<string, string> = {
    rate_boost: '↑ Rates',
    rate_nerf: '↓ Nerf',
    guaranteed_floor: '🛡 Floor',
    bonus_card: '+ Card',
    token_multiplier: '× Tokens',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        padding: '14px 16px',
        border: `1px solid ${isActive ? `${accentColor}40` : 'rgba(255,255,255,0.05)'}`,
        background: isActive ? `${accentColor}08` : 'rgba(255,255,255,0.01)',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Active glow pulse */}
      {isActive && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon size={14} style={{ color: isActive ? accentColor : 'rgba(255,255,255,0.3)' }} />
          <span style={{
            fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '14px',
            textTransform: 'uppercase', letterSpacing: '0.02em',
            color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
          }}>
            {modifier.name}
          </span>
          <InfoTooltip text={modifier.description} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isActive && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '8px',
                fontWeight: 700, letterSpacing: '0.1em',
                padding: '2px 8px', background: `${accentColor}20`,
                border: `1px solid ${accentColor}50`, color: accentColor,
                textTransform: 'uppercase',
              }}
            >
              ACTIVE
            </motion.span>
          )}
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
            color: isActive ? accentColor : 'rgba(255,255,255,0.3)',
          }}>
            {EFFECT_SHORT[modifier.effect.type] || modifier.effect.type}
            {modifier.effect.target && ` → ${modifier.effect.target.toUpperCase()}`}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '6px', borderRadius: '1px', overflow: 'hidden',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            height: '100%',
            background: isActive
              ? `linear-gradient(90deg, ${accentColor}88, ${accentColor})`
              : `linear-gradient(90deg, ${accentColor}33, ${accentColor}66)`,
            boxShadow: isActive ? `0 0 12px ${accentColor}44` : 'none',
          }}
        />
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', marginTop: '5px',
        fontFamily: '"JetBrains Mono", monospace', fontSize: '8px',
        opacity: 0.4,
      }}>
        <span>{progressLabel}</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ECHO STATUS PANEL
// ═══════════════════════════════════════════════════════════════

const RARITY_COLORS: Record<Rarity, string> = {
  common: '#7a8090',
  uncommon: '#00d4aa',
  rare: '#4d8fff',
  legendary: '#c44dff',
  mythic: '#ffd700',
};

function EchoStatusPanel() {
  const [stats, setStats] = useState<{ total: number; byRarity: Record<string, number>; byGeneration: Record<number, number> }>({ total: 0, byRarity: {}, byGeneration: {} });

  // Fetch global echo pool from Supabase on mount (and after burns)
  useEffect(() => {
    async function fetchGlobalEchoPool() {
      const { supabase } = await import('../services/supabaseClient');
      const { data } = await supabase.from('echo_pool').select('echo_rarity, generation');
      if (data) {
        const byRarity: Record<string, number> = {};
        const byGeneration: Record<number, number> = {};
        for (const echo of data) {
          byRarity[echo.echo_rarity] = (byRarity[echo.echo_rarity] || 0) + 1;
          byGeneration[echo.generation] = (byGeneration[echo.generation] || 0) + 1;
        }
        setStats({ total: data.length, byRarity, byGeneration });
      }
    }
    fetchGlobalEchoPool();
  }, []);

  const config = getAdminConfig();
  const eco = config.echoSystem;

  return (
    <div style={{
      padding: '20px', border: '1px solid rgba(0,212,170,0.15)',
      background: 'linear-gradient(180deg, rgba(0,212,170,0.03), transparent)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>◎</span>
          <span style={{
            fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '18px',
            textTransform: 'uppercase',
          }}>Echo Pool</span>
          <InfoTooltip text="Global echo pool — burned cards fracture into echoes that re-enter pack pools for all players." />
        </div>
        <div style={{
          fontFamily: '"Impact", sans-serif', fontSize: '28px', color: '#00d4aa',
          letterSpacing: '-1px',
        }}>
          {stats.total}
        </div>
      </div>

      {/* Rarity breakdown */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {(['common', 'uncommon', 'rare', 'legendary', 'mythic'] as Rarity[]).map(r => {
          const count = stats.byRarity[r] || 0;
          return (
            <div key={r} style={{
              padding: '4px 10px',
              border: `1px solid ${RARITY_COLORS[r]}25`,
              background: count > 0 ? `${RARITY_COLORS[r]}08` : 'transparent',
              opacity: count > 0 ? 1 : 0.35,
            }}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                fontWeight: 700, color: RARITY_COLORS[r],
              }}>
                {r.slice(0, 3).toUpperCase()}: {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* System params */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.4, textTransform: 'uppercase', marginBottom: '3px' }}>
            Echo Chance
          </div>
          <span style={{ fontFamily: '"Impact", sans-serif', fontSize: '20px', color: '#00d4aa' }}>
            {eco.echoChance}%
          </span>
        </div>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.4, textTransform: 'uppercase', marginBottom: '3px' }}>
            Token Split
          </div>
          <span style={{ fontFamily: '"Impact", sans-serif', fontSize: '20px', color: '#ff9900' }}>
            {eco.tokenSplitPercent}%
          </span>
        </div>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.4, textTransform: 'uppercase', marginBottom: '3px' }}>
            Max Gen
          </div>
          <span style={{ fontFamily: '"Impact", sans-serif', fontSize: '20px', color: '#ff3800' }}>
            {eco.maxGeneration}
          </span>
        </div>
      </div>

      {/* Generation chain */}
      <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
          Echo Lifecycle
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { label: 'ORIGINAL', sub: '100% value', color: '#ffd700' },
            { label: 'RE-ENTRY 1', sub: `${Math.round(eco.gen1ValueMultiplier * 100)}% value`, color: '#00d4aa' },
            { label: 'RE-ENTRY 2', sub: `${Math.round(eco.gen2ValueMultiplier * 100)}% value`, color: '#4d8fff' },
            { label: `RE-ENTRY ${eco.maxGeneration}+`, sub: 'ENTROPY', color: '#7a8090' },
          ].map((step, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {i > 0 && <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.25 }}>→</span>}
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                fontWeight: 700, color: step.color,
                padding: '3px 8px',
                border: `1px solid ${step.color}30`,
                background: `${step.color}08`,
              }}>
                {step.label}
                <span style={{ display: 'block', fontSize: '7px', opacity: 0.5, fontWeight: 400 }}>{step.sub}</span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// MAIN FORGE PAGE
// ═══════════════════════════════════════════════════════════════

export default function ForgePage() {
  const [, setLocation] = useLocation();
  const { collection, removeFromCollection, tokenBalance, loadVaultData, addToCollection, startReveal, streakCount, totalPulls, pullsSinceRarePlus } = useVaultStore();
  const [confirmSell, setConfirmSell] = useState<OwnedCard | null>(null);
  const [lastBurnResult, setLastBurnResult] = useState<{ tokens: number; echoCreated: boolean; echoGen?: number } | null>(null);
  const [modifiersOpen, setModifiersOpen] = useState(true);
  const [echoOpen, setEchoOpen] = useState(true);
  const [sinksOpen, setSinksOpen] = useState(true);
  // Targeted Pull state
  const [targetDay, setTargetDay] = useState('');
  const [targetLoading, setTargetLoading] = useState(false);
  // Rarity Upgrade state
  const [upgradeCard, setUpgradeCard] = useState<OwnedCard | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  // Fusion state
  const [fusionCards, setFusionCards] = useState<OwnedCard[]>([]);
  const [fusionLoading, setFusionLoading] = useState(false);
  // Fusion animation overlay state
  const [fusionResult, setFusionResult] = useState<{ sourceCards: OwnedCard[]; resultCard: OwnedCard } | null>(null);
  // Burn station state
  const [burnTab, setBurnTab] = useState<'all' | Rarity>('all');
  const [burnSelected, setBurnSelected] = useState<Set<string>>(new Set());
  const [burnBusy, setBurnBusy] = useState(false);
  const [burnProgress, setBurnProgress] = useState({ done: 0, total: 0 });
  const [batchResult, setBatchResult] = useState<{ totalTokens: number; totalEchoes: number; failed: number } | null>(null);
  const [confirmBatch, setConfirmBatch] = useState<OwnedCard[] | null>(null);

  const config = getAdminConfig();
  const ctx = useMemo(() => buildModifierContext(), [streakCount, totalPulls, pullsSinceRarePlus, collection.length]);

  const modifierProgress = useMemo(() =>
    config.modifiers
      .filter(m => m.enabled)
      .map(m => getModifierProgress(m, ctx)),
    [config.modifiers, ctx],
  );

  const activeCount = modifierProgress.filter(p => p.isActive).length;

  const sortedCollection = useMemo(() => {
    const rarityIdx: Record<string, number> = { mythic: 0, legendary: 1, rare: 2, uncommon: 3, common: 4 };
    return [...collection].sort((a, b) => (rarityIdx[a.card.rarity] ?? 5) - (rarityIdx[b.card.rarity] ?? 5));
  }, [collection]);

  // Filtered collection for burn station tabs
  const burnFiltered = useMemo(() => {
    if (burnTab === 'all') return sortedCollection;
    return sortedCollection.filter(c => c.card.rarity === burnTab);
  }, [sortedCollection, burnTab]);

  // Rarity counts for tab badges
  const rarityCounts = useMemo(() => {
    const counts: Record<string, number> = { all: collection.length };
    for (const c of collection) {
      counts[c.card.rarity] = (counts[c.card.rarity] || 0) + 1;
    }
    return counts;
  }, [collection]);

  const packCost = getTokenPackCost();
  const canAfford = tokenBalance >= packCost;

  const handleSell = useCallback((card: OwnedCard) => {
    setConfirmSell(card);
  }, []);

  const confirmSellAction = useCallback(async () => {
    if (!confirmSell) return;
    useLoadingToast.getState().show('Burning card…');
    const result = await sellCard(confirmSell);
    removeFromCollection(confirmSell.id);
    await loadVaultData();
    useLoadingToast.getState().hide();
    setLastBurnResult({
      tokens: result.tokensEarned,
      echoCreated: result.echoCreated,
      echoGen: result.echoGeneration,
    });
    setConfirmSell(null);
    setBurnSelected(prev => { const next = new Set(prev); next.delete(confirmSell.id); return next; });
    setTimeout(() => setLastBurnResult(null), 3500);
  }, [confirmSell, removeFromCollection, loadVaultData]);

  // Batch burn: toggle selection
  const toggleBurnSelect = useCallback((id: string) => {
    setBurnSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Batch burn: select all visible
  const toggleSelectAll = useCallback(() => {
    const visibleIds = burnFiltered.map(c => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => burnSelected.has(id));
    if (allSelected) {
      setBurnSelected(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setBurnSelected(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [burnFiltered, burnSelected]);

  // Batch burn: initiate burn selected
  const handleBurnSelected = useCallback(() => {
    const cards = sortedCollection.filter(c => burnSelected.has(c.id));
    if (cards.length === 0) return;
    setConfirmBatch(cards.slice(0, 50));
  }, [sortedCollection, burnSelected]);

  // Batch burn: initiate burn all in current tab
  const handleBurnAll = useCallback(() => {
    if (burnFiltered.length === 0) return;
    setConfirmBatch(burnFiltered.slice(0, 50));
  }, [burnFiltered]);

  // Batch burn: execute
  const executeBatchBurn = useCallback(async () => {
    if (!confirmBatch || confirmBatch.length === 0) return;
    const cardsToBurn = [...confirmBatch];
    setConfirmBatch(null);
    setBurnBusy(true);
    setBurnProgress({ done: 0, total: cardsToBurn.length });
    setBatchResult(null);
    useLoadingToast.getState().show(`Burning ${cardsToBurn.length} cards…`);

    const result = await sellCards(cardsToBurn, (done, total) => {
      setBurnProgress({ done, total });
      useLoadingToast.getState().show(`Burning cards… ${done}/${total}`);
    });

    // Remove burned cards from local collection
    for (const card of cardsToBurn) {
      removeFromCollection(card.id);
    }
    setBurnSelected(new Set());
    await loadVaultData();
    useLoadingToast.getState().hide();

    setBatchResult(result);
    setBurnBusy(false);
    setTimeout(() => setBatchResult(null), 5000);
  }, [confirmBatch, removeFromCollection, loadVaultData]);

  const handleBuyTokenPack = useCallback(async () => {
    if (!canAfford) return;
    try {
      useLoadingToast.getState().show('Purchasing pack…');
      const cards = await buyTokenPack();
      useLoadingToast.getState().hide();
      if (cards === 'insufficient') {
        alert('Insufficient V⚡ tokens for this pack.');
        await loadVaultData();
        return;
      }
      if (cards.length === 0) {
        alert('Pack purchase failed — please try again.');
        await loadVaultData();
        return;
      }
      addToCollection(cards);
      await loadVaultData();
      audioManager.playSfx('open_chest', 0.9);
      startReveal(cards, {
        category: 'vault_token',
        size: 'single',
        label: 'Vault Pack',
        icon: '⚡',
        accent: '#ff9900',
        gradient: 'linear-gradient(145deg, #1a1000, #0a0800)',
        price: `${packCost} V⚡`,
        cardCount: cards.length,
        revealType: 'cinematic',
        showRipAnother: true,
      });
      setLocation('/vault/reveal');
    } catch (e) {
      console.error('Token pack purchase error:', e);
      useLoadingToast.getState().hide();
      alert('Pack purchase failed — please try again.');
      await loadVaultData();
    }
  }, [canAfford, addToCollection, loadVaultData, startReveal, setLocation, packCost]);

  // ── TARGETED PULL ──────────────────────────────────────────────
  const handleTargetedPull = useCallback(async () => {
    const day = parseInt(targetDay);
    if (!day || day < 1 || day > 365 || tokenBalance < 500) return;
    setTargetLoading(true);
    useLoadingToast.getState().show('Targeted pull…');
    const card = await targetedPull(day);
    useLoadingToast.getState().hide();
    if (card) {
      addToCollection([card]);
      audioManager.playSfx('open_chest', 0.9);
      startReveal([card], {
        category: 'targeted', label: `Targeted Pull: Day ${day}`, icon: '🎯',
        accent: '#ff9900', gradient: 'linear-gradient(145deg, #1a1000, #0a0800)',
        price: '500 V⚡', cardCount: 1, revealType: 'cinematic',
      });
      setLocation('/vault/reveal');
    }
    await loadVaultData();
    setTargetLoading(false);
    setTargetDay('');
  }, [targetDay, tokenBalance, addToCollection, startReveal, setLocation, loadVaultData]);

  // ── RARITY UPGRADE ─────────────────────────────────────────────
  const handleUpgrade = useCallback(async () => {
    if (!upgradeCard || tokenBalance < 150) return;
    setUpgradeLoading(true);
    useLoadingToast.getState().show('Upgrading rarity…');
    const result = await upgradeRarity(upgradeCard.id);
    useLoadingToast.getState().hide();
    if (result.success) {
      await loadVaultData();
    }
    setUpgradeLoading(false);
    setUpgradeCard(null);
  }, [upgradeCard, tokenBalance, loadVaultData]);

  // ── DUPLICATE FUSION ───────────────────────────────────────────
  const handleFusion = useCallback(async (cardsToFuse?: OwnedCard[]) => {
    const cards = cardsToFuse || fusionCards;
    if (cards.length !== 3) return;
    setFusionLoading(true);
    useLoadingToast.getState().show('Fusing cards…');
    const sourceSnapshot = [...cards];
    const card = await fuseDuplicates(cards.map(c => c.id));
    useLoadingToast.getState().hide();
    if (card) {
      addToCollection([card]);
      // Show in-place fusion animation instead of navigating to /reveal
      setFusionResult({ sourceCards: sourceSnapshot, resultCard: card });
    }
    await loadVaultData();
    setFusionLoading(false);
    setFusionCards([]);
  }, [fusionCards, addToCollection, loadVaultData]);

  // Find fusable groups (3+ identical card_id + rarity)
  const fusableGroups = useMemo(() => {
    const groups: Record<string, OwnedCard[]> = {};
    for (const c of collection) {
      const key = `${c.cardId}-${c.card.rarity}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return Object.entries(groups).filter(([, cards]) => cards.length >= 3);
  }, [collection]);

  // Upgradeable cards (not legendary or mythic)
  const upgradeableCards = useMemo(() =>
    collection.filter(c => !['legendary', 'mythic'].includes(c.card.rarity)),
    [collection]
  );

  return (
    <div className="flex-1 w-full" style={{ minHeight: '100vh' }}>
      {/* ═══ HERO HEADER ═══ */}
      <section style={{
        position: 'relative', padding: '40px 16px 32px',
        background: 'linear-gradient(180deg, rgba(255,56,0,0.04), transparent 60%)',
        overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '30%',
          transform: 'translate(-50%, -50%)',
          width: '500px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,56,0,0.08), transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: '24px' }}
          >
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
              textTransform: 'uppercase', letterSpacing: '0.4em',
              opacity: 0.4, marginBottom: '8px',
            }}>
              Card Economy
            </div>
            <h1 style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: 'clamp(40px, 8vw, 64px)',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              lineHeight: 0.9,
              background: 'linear-gradient(135deg, #ff3800, #ff9900)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
            }}>
              The Forge
            </h1>
            <p style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
              textTransform: 'uppercase', letterSpacing: '0.15em',
              opacity: 0.45, marginTop: '8px', maxWidth: '420px',
            }}>
              Burn cards for V⚡ tokens · Echoes fracture back into the pool · Upgrades unlock as you progress
            </p>
          </motion.div>

          {/* Token Balance + Buy */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              display: 'flex', gap: '16px', alignItems: 'stretch', flexWrap: 'wrap',
            }}
          >
            {/* Balance */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 20px', border: '2px solid #000',
              background: '#0d0d0d', boxShadow: '4px 4px 0 #000',
            }}>
              <Zap size={22} style={{ color: '#ff9900' }} />
              <div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.15em' }}>Vault Tokens</div>
                <div style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '36px',
                  color: '#ff9900', letterSpacing: '-1px', lineHeight: 1,
                }}>
                  {tokenBalance.toLocaleString()}
                </div>
              </div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.3, marginLeft: '4px' }}>V⚡</span>
            </div>

            {/* Buy pack button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBuyTokenPack}
              disabled={!canAfford}
              style={{
                padding: '12px 24px',
                background: canAfford ? 'linear-gradient(135deg, #ff9900, #ffb800)' : 'rgba(255,255,255,0.04)',
                color: canAfford ? '#000' : 'rgba(255,255,255,0.2)',
                border: '2px solid #000',
                fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '18px',
                textTransform: 'uppercase', letterSpacing: '0.02em',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                boxShadow: canAfford ? '4px 4px 0 #000, 0 0 20px rgba(255,153,0,0.3)' : '2px 2px 0 #000',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              <Zap size={16} />
              Buy Vault Pack ({packCost} V⚡)
            </motion.button>
          </motion.div>
        </div>
      </section>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 16px' }}>
        {/* Burn result toast */}
        <AnimatePresence>
          {lastBurnResult && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                marginBottom: '16px', padding: '12px 20px',
                display: 'flex', alignItems: 'center', gap: '12px',
                border: '2px solid #000',
                background: 'linear-gradient(135deg, rgba(255,153,0,0.1), rgba(0,212,170,0.05))',
                boxShadow: '4px 4px 0 #000',
              }}
            >
              <Flame size={18} style={{ color: '#ff9900' }} />
              <div>
                <span style={{ fontFamily: '"Impact", sans-serif', fontSize: '18px', color: '#ff9900' }}>
                  +{lastBurnResult.tokens} V⚡
                </span>
                {lastBurnResult.echoCreated && (
                  <span style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                    color: '#00d4aa', marginLeft: '12px', fontWeight: 700,
                  }}>
                    ◎ Resurrected Re-entry {lastBurnResult.echoGen} released
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ CONDITIONAL UPGRADES ═══ */}
        <section style={{ marginBottom: '32px' }}>
          <div
            onClick={() => setModifiersOpen(!modifiersOpen)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <SectionLabel label="Conditional Upgrades" accent="#00d4aa" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              {activeCount > 0 && (
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                  fontWeight: 700, color: '#00d4aa',
                  padding: '2px 8px', background: 'rgba(0,212,170,0.1)',
                  border: '1px solid rgba(0,212,170,0.3)',
                }}>
                  {activeCount} ACTIVE
                </span>
              )}
              {modifiersOpen ? <ChevronUp size={14} style={{ opacity: 0.4 }} /> : <ChevronDown size={14} style={{ opacity: 0.4 }} />}
            </div>
          </div>

          <AnimatePresence>
            {modifiersOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                {modifierProgress.length === 0 ? (
                  <div style={{
                    padding: '24px', textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.04)',
                    background: 'rgba(255,255,255,0.01)',
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.4,
                  }}>
                    No modifiers enabled — configure in Admin Dashboard
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {modifierProgress.map((prog) => (
                      <ModifierProgressBar key={prog.modifier.id} prog={prog} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ═══ V2 TOKEN SINKS ═══ */}
        <section style={{ marginBottom: '32px' }}>
          <div
            onClick={() => setSinksOpen(!sinksOpen)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <SectionLabel label="Token Sinks" accent="#ff9900" />
            {sinksOpen ? <ChevronUp size={14} style={{ opacity: 0.4, marginBottom: '16px' }} /> : <ChevronDown size={14} style={{ opacity: 0.4, marginBottom: '16px' }} />}
          </div>
          <AnimatePresence>
            {sinksOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                {/* ── TARGETED PULL ── */}
                <div style={{
                  padding: '16px', border: '1px solid rgba(255,153,0,0.2)',
                  background: 'rgba(255,153,0,0.03)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Target size={16} style={{ color: '#ff9900' }} />
                    <span style={{
                      fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '16px',
                      textTransform: 'uppercase', color: '#fff',
                    }}>Targeted Pull</span>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                      padding: '2px 8px', background: 'rgba(255,153,0,0.15)',
                      border: '1px solid rgba(255,153,0,0.3)', color: '#ff9900',
                    }}>500 V⚡</span>
                  </div>
                  <p style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                    color: 'rgba(255,255,255,0.4)', marginBottom: '12px', lineHeight: 1.5,
                  }}>
                    Choose a specific day (1–365) to pull a card from. Guaranteed 1 card at standard rates.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number" min="1" max="365"
                      value={targetDay}
                      onChange={e => setTargetDay(e.target.value)}
                      placeholder="Day #"
                      style={{
                        width: '80px', padding: '8px 12px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '12px',
                        color: '#fff', textAlign: 'center', outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleTargetedPull}
                      disabled={targetLoading || !targetDay || tokenBalance < 500}
                      style={{
                        flex: 1, padding: '8px 16px',
                        background: tokenBalance >= 500 && targetDay ? '#ff9900' : 'rgba(255,153,0,0.15)',
                        border: '1px solid rgba(255,153,0,0.4)',
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                        fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: tokenBalance >= 500 && targetDay ? '#000' : 'rgba(255,255,255,0.3)',
                        cursor: tokenBalance >= 500 && targetDay ? 'pointer' : 'default',
                      }}
                    >
                      {targetLoading ? 'PULLING...' : '🎯 PULL FROM DAY'}
                    </button>
                  </div>
                </div>

                {/* ── RARITY UPGRADE ── */}
                <div style={{
                  padding: '16px', border: '1px solid rgba(180,77,255,0.2)',
                  background: 'rgba(180,77,255,0.03)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Star size={16} style={{ color: '#b44dff' }} />
                    <span style={{
                      fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '16px',
                      textTransform: 'uppercase', color: '#fff',
                    }}>Rarity Upgrade</span>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                      padding: '2px 8px', background: 'rgba(180,77,255,0.15)',
                      border: '1px solid rgba(180,77,255,0.3)', color: '#b44dff',
                    }}>150 V⚡</span>
                  </div>
                  <p style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                    color: 'rgba(255,255,255,0.4)', marginBottom: '12px', lineHeight: 1.5,
                  }}>
                    Upgrade any card +1 rarity tier. Max: Legendary. Select a card below.
                  </p>
                  {upgradeCard ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        padding: '6px 12px', border: `1px solid ${RARITY_CONFIG[upgradeCard.card.rarity]?.color || '#888'}40`,
                        background: `${RARITY_CONFIG[upgradeCard.card.rarity]?.color || '#888'}10`,
                        fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', color: '#fff',
                      }}>
                        #{String(upgradeCard.card.day || 0).padStart(3, '0')} • {upgradeCard.card.title} • {upgradeCard.card.rarity.toUpperCase()}
                      </div>
                      <button
                        onClick={handleUpgrade}
                        disabled={upgradeLoading || tokenBalance < 150}
                        style={{
                          padding: '6px 16px',
                          background: tokenBalance >= 150 ? '#b44dff' : 'rgba(180,77,255,0.15)',
                          border: '1px solid rgba(180,77,255,0.4)',
                          fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                          fontWeight: 700, color: tokenBalance >= 150 ? '#fff' : 'rgba(255,255,255,0.3)',
                          cursor: tokenBalance >= 150 ? 'pointer' : 'default',
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                        }}
                      >
                        {upgradeLoading ? 'UPGRADING...' : '⬆ UPGRADE'}
                      </button>
                      <button
                        onClick={() => setUpgradeCard(null)}
                        style={{
                          padding: '6px 10px', background: 'none',
                          border: '1px solid rgba(255,255,255,0.1)',
                          fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                          color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div>
                      <select
                        aria-label="Select card to upgrade"
                        onChange={e => {
                          const card = upgradeableCards.find(c => c.id === e.target.value);
                          if (card) setUpgradeCard(card);
                        }}
                        value=""
                        style={{
                          width: '100%', padding: '8px 12px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          fontFamily: '"JetBrains Mono", monospace', fontSize: '11px',
                          color: '#fff', outline: 'none',
                        }}
                      >
                        <option value="" disabled>Select a card to upgrade...</option>
                        {upgradeableCards.map(c => (
                          <option key={c.id} value={c.id} style={{ background: '#111', color: '#fff' }}>
                            #{String(c.card.day || 0).padStart(3, '0')} {c.card.title} [{c.card.rarity.toUpperCase()}]
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* ── DUPLICATE FUSION ── */}
                <div style={{
                  padding: '16px', border: '1px solid rgba(255,56,0,0.2)',
                  background: 'rgba(255,56,0,0.03)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Flame size={16} style={{ color: '#ff3800' }} />
                    <span style={{
                      fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '16px',
                      textTransform: 'uppercase', color: '#fff',
                    }}>Duplicate Fusion</span>
                    <span style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                      padding: '2px 8px', background: 'rgba(255,56,0,0.15)',
                      border: '1px solid rgba(255,56,0,0.3)', color: '#ff3800',
                    }}>FREE</span>
                  </div>
                  <p style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                    color: 'rgba(255,255,255,0.4)', marginBottom: '12px', lineHeight: 1.5,
                  }}>
                    Combine 3 identical cards (same day + rarity) into 1 card of the next rarity tier.
                  </p>
                  {fusableGroups.length === 0 ? (
                    <div style={{
                      padding: '12px', border: '1px solid rgba(255,255,255,0.05)',
                      background: 'rgba(255,255,255,0.02)', textAlign: 'center',
                      fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                      color: 'rgba(255,255,255,0.25)',
                    }}>
                      No fusable duplicates found. You need 3 identical cards.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {fusableGroups.map(([key, cards]) => {
                        const first = cards[0];
                        const rc = RARITY_CONFIG[first.card.rarity as Rarity];
                        const rarityOrder: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
                        const nextRarity = rarityOrder[Math.min(rarityOrder.indexOf(first.card.rarity as Rarity) + 1, rarityOrder.length - 1)];
                        return (
                          <div key={key} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', border: `1px solid ${rc?.color || '#888'}25`,
                            background: `${rc?.color || '#888'}06`,
                          }}>
                            <div>
                              <div style={{
                                fontFamily: '"JetBrains Mono", monospace', fontSize: '11px',
                                color: '#fff', fontWeight: 700,
                              }}>
                                #{String(first.card.day || 0).padStart(3, '0')} {first.card.title}
                              </div>
                              <div style={{
                                fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                                color: rc?.color || '#888', marginTop: '2px',
                              }}>
                                {cards.length}× {first.card.rarity.toUpperCase()} → 1× {nextRarity.toUpperCase()}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const selected = cards.slice(0, 3);
                                handleFusion(selected);
                              }}
                              disabled={fusionLoading}
                              style={{
                                padding: '6px 14px',
                                background: '#ff3800',
                                border: '1px solid rgba(255,56,0,0.6)',
                                fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                                fontWeight: 700, color: '#fff', cursor: 'pointer',
                                textTransform: 'uppercase', letterSpacing: '0.1em',
                              }}
                            >
                              {fusionLoading ? 'FUSING...' : '🔥 FUSE'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ═══ ECHO SYSTEM STATUS ═══ */}
        <section style={{ marginBottom: '32px' }}>
          <div
            onClick={() => setEchoOpen(!echoOpen)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <SectionLabel label="Echo System" accent="#00d4aa" />
            {echoOpen ? <ChevronUp size={14} style={{ opacity: 0.4, marginBottom: '16px' }} /> : <ChevronDown size={14} style={{ opacity: 0.4, marginBottom: '16px' }} />}
          </div>
          <AnimatePresence>
            {echoOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <EchoStatusPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ═══ BURN STATION ═══ */}
        <section style={{ marginBottom: '40px' }}>
          <SectionLabel label="Burn Station" accent="#ff3800" />

          <div style={{
            border: '2px solid rgba(255,56,0,0.2)',
            background: 'rgba(255,56,0,0.02)',
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={16} style={{ color: '#ff3800' }} />
                <span style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '16px',
                  textTransform: 'uppercase',
                }}>
                  Burn Cards for V⚡
                </span>
                <InfoTooltip text="Earn base V⚡ value · 50% chance for Echo to re-enter pack pool" />
              </div>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                opacity: 0.4,
              }}>
                {collection.length} card{collection.length !== 1 ? 's' : ''} available
              </span>
            </div>

            {/* Rarity tabs */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(0,0,0,0.2)',
            }}>
              {([
                { key: 'all' as const, label: 'ALL', color: '#fff' },
                { key: 'common' as const, label: 'COM', color: RARITY_CONFIG.common.color },
                { key: 'uncommon' as const, label: 'UNC', color: RARITY_CONFIG.uncommon.color },
                { key: 'rare' as const, label: 'RARE', color: RARITY_CONFIG.rare.color },
                { key: 'legendary' as const, label: 'LEG', color: RARITY_CONFIG.legendary.color },
                { key: 'mythic' as const, label: 'MYTH', color: RARITY_CONFIG.mythic.color },
              ] as const).map(tab => {
                const count = rarityCounts[tab.key] || 0;
                const isActive = burnTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setBurnTab(tab.key); }}
                    style={{
                      flex: 1, minWidth: '50px',
                      padding: '8px 4px',
                      background: isActive ? `${tab.color}18` : 'transparent',
                      border: 'none',
                      borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '9px', fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: isActive ? tab.color : 'rgba(255,255,255,0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span style={{
                        display: 'block', fontSize: '8px', opacity: 0.6, marginTop: '2px',
                      }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(0,0,0,0.15)',
            }}>
              <button
                onClick={toggleSelectAll}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '5px 10px',
                  background: burnFiltered.length > 0 && burnFiltered.every(c => burnSelected.has(c.id))
                    ? 'rgba(255,153,0,0.12)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '12px', height: '12px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  background: burnFiltered.length > 0 && burnFiltered.every(c => burnSelected.has(c.id))
                    ? '#ff9900' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', color: '#000',
                }}>
                  {burnFiltered.length > 0 && burnFiltered.every(c => burnSelected.has(c.id)) ? '✓' : ''}
                </div>
                Select All
              </button>

              <div style={{ flex: 1 }} />

              <button
                onClick={handleBurnSelected}
                disabled={burnSelected.size === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 12px',
                  background: burnSelected.size > 0 ? 'rgba(255,153,0,0.15)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${burnSelected.size > 0 ? 'rgba(255,153,0,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: burnSelected.size > 0 ? '#ff9900' : 'rgba(255,255,255,0.2)',
                  cursor: burnSelected.size > 0 ? 'pointer' : 'default',
                  opacity: burnSelected.size > 0 ? 1 : 0.5,
                }}
              >
                <Flame size={10} />
                Burn {burnSelected.size > 0 ? `(${burnSelected.size})` : ''}
              </button>

              <button
                onClick={handleBurnAll}
                disabled={burnFiltered.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 12px',
                  background: burnFiltered.length > 0 ? 'rgba(255,56,0,0.12)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${burnFiltered.length > 0 ? 'rgba(255,56,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: burnFiltered.length > 0 ? '#ff3800' : 'rgba(255,255,255,0.2)',
                  cursor: burnFiltered.length > 0 ? 'pointer' : 'default',
                  opacity: burnFiltered.length > 0 ? 1 : 0.5,
                }}
              >
                <Flame size={10} />
                Burn All
              </button>
            </div>

            {/* Card list */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {burnFiltered.length === 0 ? (
                <div style={{
                  padding: '40px 16px', textAlign: 'center',
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '10px', opacity: 0.3,
                }}>
                  {burnTab === 'all' ? 'No cards to burn — claim daily drops or open packs' : `No ${burnTab} cards in collection`}
                </div>
              ) : (
                burnFiltered.map(card => {
                  const rc = RARITY_CONFIG[card.card.rarity];
                  const gen = card.echoGeneration ?? 0;
                  const willEcho = canProduceEcho(gen);
                  const tokenYield = rc.tokenValue ?? 5;
                  const isSelected = burnSelected.has(card.id);

                  return (
                    <div
                      key={card.id}
                      onClick={() => toggleBurnSelect(card.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: isSelected ? 'rgba(255,153,0,0.06)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        {/* Checkbox */}
                        <div style={{
                          width: '16px', height: '16px', flexShrink: 0,
                          border: `2px solid ${isSelected ? rc.color : 'rgba(255,255,255,0.15)'}`,
                          background: isSelected ? rc.color : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {isSelected && (
                            <span style={{ fontSize: '10px', color: '#000', fontWeight: 900 }}>✓</span>
                          )}
                        </div>

                        <div style={{
                          width: '5px', height: '24px',
                          background: rc.color, opacity: card.isEcho ? 0.5 : 1, flexShrink: 0,
                        }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontFamily: '"Impact", sans-serif', fontSize: '12px',
                            textTransform: 'uppercase', letterSpacing: '-0.2px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {card.isEcho && <span style={{ color: '#00d4aa', marginRight: '4px', fontSize: '9px', opacity: 0.7 }}>◎</span>}
                            {card.card.title}
                          </div>
                          <div style={{
                            fontFamily: '"JetBrains Mono", monospace', fontSize: '8px',
                            opacity: 0.35, textTransform: 'uppercase',
                          }}>
                            Day {card.card.day} · {card.card.rarity}
                            {card.isEcho && <span style={{ color: '#00d4aa', marginLeft: '4px' }}>RE-ENTRY {gen}</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {willEcho && (
                          <span style={{
                            fontFamily: '"JetBrains Mono", monospace', fontSize: '7px',
                            color: '#00d4aa', opacity: 0.5,
                          }}>
                            ◎ echo
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSell(card); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '4px 12px', border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent', cursor: 'pointer',
                            fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: '#ff9900',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'rgba(255,153,0,0.4)';
                            e.currentTarget.style.background = 'rgba(255,153,0,0.06)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Zap size={9} />
                          {tokenYield}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ═══ CONFIRM BURN MODAL ═══ */}
      <AnimatePresence>
        {confirmSell && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmSell(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              style={{
                border: '3px solid #000', background: '#0d0d0d',
                boxShadow: '8px 8px 0 #000', maxWidth: '380px', width: '90vw',
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '2px solid #000' }}>
                <h3 style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '24px',
                  textTransform: 'uppercase', margin: 0,
                  background: 'linear-gradient(135deg, #ff3800, #ff9900)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Burn Card?</h3>
              </div>

              <div style={{ padding: '16px 24px' }}>
                {/* Card preview */}
                <div style={{ width: '140px', margin: '0 auto 16px' }}>
                  <Card card={confirmSell.card} interactive={false} isEcho={confirmSell.isEcho} echoGeneration={confirmSell.echoGeneration} />
                </div>

                <div style={{
                  fontFamily: '"Impact", sans-serif', fontSize: '16px',
                  textTransform: 'uppercase', textAlign: 'center',
                }}>
                  {confirmSell.isEcho && <span style={{ color: '#00d4aa', marginRight: '6px', fontSize: '12px' }}>◎</span>}
                  {confirmSell.card.title}
                </div>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                  opacity: 0.5, textAlign: 'center', marginBottom: '12px',
                }}>
                  Day {confirmSell.card.day} · {confirmSell.card.rarity}
                  {confirmSell.isEcho && <span style={{ color: '#00d4aa', marginLeft: '6px' }}>RE-ENTRY {confirmSell.echoGeneration}</span>}
                </div>

                {/* Token + Echo Split */}
                {(() => {
                  const baseVal = RARITY_CONFIG[confirmSell.card.rarity]?.tokenValue ?? 5;
                  const gen = confirmSell.echoGeneration ?? 0;
                  const willEcho = canProduceEcho(gen);
                  const tokenYield = baseVal;

                  return (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                        padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <Zap size={18} style={{ color: '#ff9900' }} />
                        <span style={{
                          fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '28px',
                          color: '#ff9900',
                        }}>
                          +{tokenYield}
                        </span>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', opacity: 0.5 }}>V⚡</span>
                      </div>

                      {willEcho && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 12px',
                          border: '1px solid rgba(0,212,170,0.2)',
                          background: 'rgba(0,212,170,0.04)',
                          marginBottom: '8px',
                        }}>
                          <span style={{ fontSize: '14px' }}>◎</span>
                          <div>
                            <div style={{
                              fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                              color: '#00d4aa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                            }}>
                              {(() => { const rates: Record<number,number> = {0:25,1:15,2:8}; return rates[gen] ?? 0; })()}% CHANCE: Echo to Pack Pool
                            </div>
                            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.5 }}>
                              Re-entry {gen + 1} · {(() => { const r = ['common', 'uncommon', 'rare', 'legendary', 'mythic'] as Rarity[]; const idx = Math.max(0, r.indexOf(confirmSell.card.rarity) - 1); return r[idx]; })().toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}

                      {!willEcho && (
                        <div style={{
                          padding: '8px 12px',
                          border: '1px solid rgba(255,255,255,0.04)',
                          background: 'rgba(255,255,255,0.01)',
                          marginBottom: '8px',
                        }}>
                          <div style={{
                            fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                            opacity: 0.3, textTransform: 'uppercase', letterSpacing: '0.1em',
                          }}>
                            ⊘ Entropy Death · No Echo
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                <p style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                  opacity: 0.3, marginTop: '8px',
                }}>
                  This action cannot be undone.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', padding: '0 24px 20px' }}>
                <button
                  onClick={() => setConfirmSell(null)}
                  style={{
                    flex: 1, padding: '12px',
                    border: '2px solid rgba(255,255,255,0.15)', background: 'transparent',
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSellAction}
                  style={{
                    flex: 1, padding: '12px',
                    border: '2px solid #000',
                    background: '#ff9900', color: '#000',
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: 'pointer',
                    boxShadow: '3px 3px 0 #000',
                  }}
                >
                  Burn for V⚡
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ BATCH BURN CONFIRM MODAL ═══ */}
      <AnimatePresence>
        {confirmBatch && confirmBatch.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmBatch(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              style={{
                border: '3px solid #000', background: '#0d0d0d',
                boxShadow: '8px 8px 0 #000', maxWidth: '420px', width: '90vw',
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '2px solid #000' }}>
                <h3 style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '24px',
                  textTransform: 'uppercase', margin: 0,
                  background: 'linear-gradient(135deg, #ff3800, #ff9900)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Burn {confirmBatch.length} Card{confirmBatch.length !== 1 ? 's' : ''}?</h3>
              </div>

              <div style={{ padding: '16px 24px' }}>
                {/* Rarity breakdown */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px',
                }}>
                  {(() => {
                    const breakdown: Record<string, number> = {};
                    for (const c of confirmBatch) {
                      breakdown[c.card.rarity] = (breakdown[c.card.rarity] || 0) + 1;
                    }
                    return Object.entries(breakdown).map(([rarity, count]) => {
                      const rc = RARITY_CONFIG[rarity as Rarity];
                      return (
                        <div key={rarity} style={{
                          padding: '4px 10px',
                          border: `1px solid ${rc?.color || '#888'}40`,
                          background: `${rc?.color || '#888'}10`,
                        }}>
                          <span style={{
                            fontFamily: '"JetBrains Mono", monospace', fontSize: '11px',
                            fontWeight: 900, color: rc?.color || '#888',
                          }}>
                            {count}×
                          </span>
                          <span style={{
                            fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                            color: 'rgba(255,255,255,0.4)', marginLeft: '4px',
                            textTransform: 'uppercase',
                          }}>
                            {rarity}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Total yield estimate */}
                {(() => {
                  const totalYield = confirmBatch.reduce((sum, c) => {
                    return sum + (RARITY_CONFIG[c.card.rarity]?.tokenValue ?? 5);
                  }, 0);
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
                      padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <Zap size={18} style={{ color: '#ff9900' }} />
                      <span style={{
                        fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '28px',
                        color: '#ff9900',
                      }}>
                        ~{totalYield}
                      </span>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', opacity: 0.5 }}>V⚡ estimated</span>
                    </div>
                  );
                })()}

                {/* Anti-grind warning */}
                {confirmBatch.length >= 20 && (
                  <div style={{
                    padding: '8px 12px', marginTop: '8px',
                    border: '1px solid rgba(255,153,0,0.3)',
                    background: 'rgba(255,153,0,0.06)',
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                  }}>
                    <span style={{ fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>⚠</span>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                      color: '#ff9900', lineHeight: 1.5,
                    }}>
                      ANTI-GRIND: Token yield decreases after 20+ burns per day. You may earn less than estimated.
                    </div>
                  </div>
                )}

                {/* 50-card cap notice */}
                {confirmBatch.length >= 50 && (
                  <div style={{
                    padding: '6px 12px', marginTop: '6px',
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '8px',
                    color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    Batch capped at 50 cards. Remaining cards can be burned after.
                  </div>
                )}

                <p style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                  opacity: 0.3, marginTop: '8px',
                }}>
                  This action cannot be undone.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', padding: '0 24px 20px' }}>
                <button
                  onClick={() => setConfirmBatch(null)}
                  style={{
                    flex: 1, padding: '12px',
                    border: '2px solid rgba(255,255,255,0.15)', background: 'transparent',
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeBatchBurn}
                  style={{
                    flex: 1, padding: '12px',
                    border: '2px solid #000',
                    background: '#ff3800', color: '#fff',
                    fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '14px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: '3px 3px 0 #000',
                  }}
                >
                  🔥 Burn {confirmBatch.length} Cards
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ BATCH BURN LOADING OVERLAY ═══ */}
      <AnimatePresence>
        {burnBusy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(5,4,2,0.95)', backdropFilter: 'blur(12px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '24px',
            }}
          >
            {/* Animated flame */}
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
              <Flame size={48} style={{ color: '#ff3800' }} />
            </motion.div>

            <div style={{
              fontFamily: '"Impact", "Arial Black", sans-serif',
              fontSize: '28px', textTransform: 'uppercase',
              color: '#fff',
              textShadow: '0 0 20px rgba(255,56,0,0.5)',
            }}>
              BURNING CARDS
            </div>

            {/* Progress bar */}
            <div style={{ width: '280px' }}>
              <div style={{
                width: '100%', height: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
              }}>
                <motion.div
                  animate={{ width: `${burnProgress.total > 0 ? (burnProgress.done / burnProgress.total) * 100 : 0}%` }}
                  transition={{ duration: 0.3 }}
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #ff3800, #ff9900)',
                  }}
                />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: '8px',
                fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
              }}>
                <span style={{ color: '#ff9900' }}>{burnProgress.done} / {burnProgress.total}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {burnProgress.total > 0 ? Math.round((burnProgress.done / burnProgress.total) * 100) : 0}%
                </span>
              </div>
            </div>

            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
                letterSpacing: '0.15em',
              }}
            >
              Processing burns...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ BATCH RESULT TOAST ═══ */}
      <AnimatePresence>
        {batchResult && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            style={{
              position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 150,
              padding: '16px 24px',
              border: '2px solid #000',
              background: '#0d0d0d',
              boxShadow: '4px 4px 0 #000, 0 0 20px rgba(255,56,0,0.3)',
              display: 'flex', alignItems: 'center', gap: '16px',
              maxWidth: '90vw',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={18} style={{ color: '#ff9900' }} />
              <span style={{
                fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '22px',
                color: '#ff9900',
              }}>
                +{batchResult.totalTokens}
              </span>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '10px',
                opacity: 0.5,
              }}>V⚡</span>
            </div>
            {batchResult.totalEchoes > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '2px 8px',
                border: '1px solid rgba(0,212,170,0.3)',
                background: 'rgba(0,212,170,0.06)',
              }}>
                <span style={{ color: '#00d4aa', fontSize: '10px' }}>◎</span>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                  color: '#00d4aa', fontWeight: 700,
                }}>
                  {batchResult.totalEchoes} echo{batchResult.totalEchoes !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {batchResult.failed > 0 && (
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: '9px',
                color: '#ff3800',
              }}>
                {batchResult.failed} failed
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ height: '60px' }} />

      {/* ═══ FUSION ANIMATION OVERLAY ═══ */}
      {fusionResult && (
        <FusionAnimation
          sourceCards={fusionResult.sourceCards}
          resultCard={fusionResult.resultCard}
          onClose={() => setFusionResult(null)}
        />
      )}
    </div>
  );
}
