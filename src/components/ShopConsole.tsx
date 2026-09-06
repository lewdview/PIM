import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sparkles, Target, Flame, ArrowUpRight, ShieldCheck, ChevronRight, Layers, Shuffle, Calendar, AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useVaultStore } from '../store/useVaultStore';
import { targetedPull, upgradeRarity, fuseDuplicates } from '../services/vaultService';
import { audioManager } from '../game/audio';
import { useLoadingToast } from '../store/useLoadingToast';
import { RARITY_CONFIG, type Rarity, type OwnedCard, type PackCategory, type PackSize } from '../utils/rarity';
import { getCurrentDay } from '../utils/dayCalc';
import TokenBundleShelf from './TokenBundleShelf';

interface ShopConsoleProps {
  onPurchasePack?: (category: PackCategory, size: PackSize) => Promise<void> | void;
  className?: string;
}

export default function ShopConsole({ onPurchasePack, className = '' }: ShopConsoleProps) {
  const [, setLocation] = useLocation();
  const { collection, tokenBalance, addToCollection, removeFromCollection, loadVaultData, startReveal } = useVaultStore();
  const currentDay = getCurrentDay();

  // Local state for interactive modules
  const [targetDay, setTargetDay] = useState<string>('');
  const [targetLoading, setTargetLoading] = useState(false);

  const [upgradeCardId, setUpgradeCardId] = useState<string>('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const [fusionLoading, setFusionLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Eligible cards for Rarity Upgrade (below Legendary)
  const upgradeableCards = useMemo(() => {
    return collection.filter(c => c && c.card && c.card.rarity && c.card.rarity !== 'legendary' && c.card.rarity !== 'mythic');
  }, [collection]);

  // Triplet groups for Duplicate Fusion
  const fusableGroups = useMemo(() => {
    const groups: Record<string, OwnedCard[]> = {};
    for (const c of collection) {
      if (!c || !c.card) continue;
      const key = `${c.card.day}-${c.card.rarity}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return Object.entries(groups).filter(([, cards]) => cards.length >= 3);
  }, [collection]);

  // Fast day shortcuts (strictly within released days 1 to currentDay)
  const handleSetRandomDay = () => {
    audioManager.playSfx('tap_nav', 0.2);
    const rand = Math.floor(Math.random() * currentDay) + 1;
    setTargetDay(String(rand));
  };

  const handleSetToday = () => {
    audioManager.playSfx('tap_nav', 0.2);
    setTargetDay(String(currentDay));
  };

  // 1. Pack purchase wrapper
  const handlePackRip = async (category: PackCategory, size: PackSize = 'single') => {
    if (onPurchasePack) {
      setIsPurchasing(true);
      try {
        await onPurchasePack(category, size);
      } finally {
        setIsPurchasing(false);
      }
    }
  };

  // 2. Targeted pull handler (strictly locked to released days to protect Prophecy pull exclusivity)
  const handleTargetedPull = useCallback(async (dayNum: number) => {
    if (!dayNum || dayNum < 1 || dayNum > currentDay || tokenBalance < 500) {
      if (dayNum > currentDay) {
        alert(`Day ${dayNum} is locked. Targeted Pull is restricted to released calendar days (Day 1 to ${currentDay}). Future tracks require a Prophecy Pull.`);
      }
      return;
    }
    setTargetLoading(true);
    useLoadingToast.getState().show(`Targeting Day ${dayNum} pool…`);
    try {
      const card = await targetedPull(dayNum);
      if (card) {
        addToCollection([card]);
        audioManager.playSfx('open_chest', 0.9);
        startReveal([card], {
          category: 'targeted',
          label: `Targeted Pull: Day ${dayNum}`,
          icon: '🎯',
          accent: '#00F0FF',
          gradient: 'linear-gradient(145deg, #021a24, #010c12)',
          price: '500 V⚡',
          cardCount: 1,
          revealType: 'cinematic',
        });
        setLocation('/vault/reveal');
      }
    } catch (err) {
      console.error('Targeted pull error:', err);
    } finally {
      useLoadingToast.getState().hide();
      await loadVaultData(true);
      setTargetLoading(false);
      setTargetDay('');
    }
  }, [currentDay, tokenBalance, addToCollection, startReveal, setLocation, loadVaultData]);

  // 3. Upgrade handler
  const handleUpgrade = useCallback(async (cardOwnedId: string) => {
    if (!cardOwnedId || tokenBalance < 150) return;
    setUpgradeLoading(true);
    useLoadingToast.getState().show('Overclocking card tier…');
    try {
      const result = await upgradeRarity(cardOwnedId);
      if (result.success) {
        audioManager.playSfx('upgrade', 0.9);
        alert(`⚡ Overclock Successful! Card upgraded to ${result.newRarity?.toUpperCase()}`);
      }
    } catch (err) {
      console.error('Upgrade error:', err);
    } finally {
      useLoadingToast.getState().hide();
      await loadVaultData(true);
      setUpgradeLoading(false);
      setUpgradeCardId('');
    }
  }, [tokenBalance, loadVaultData]);

  // 4. Duplicate fusion handler
  const handleFusion = useCallback(async (cardsToFuse: OwnedCard[]) => {
    if (cardsToFuse.length !== 3) return;
    setFusionLoading(true);
    useLoadingToast.getState().show('Igniting fusion matrix…');
    try {
      const card = await fuseDuplicates(cardsToFuse.map(c => c.id));
      if (card) {
        cardsToFuse.forEach(c => removeFromCollection(c.id));
        addToCollection([card]);
        audioManager.playSfx('fusion', 0.9);
        startReveal([card], {
          category: 'fusion',
          label: `Duplicate Fusion`,
          icon: '🔥',
          accent: '#ff3800',
          gradient: 'linear-gradient(145deg, #240800, #0d0300)',
          price: 'FREE',
          cardCount: 1,
          revealType: 'cinematic',
        });
        setLocation('/vault/reveal');
      }
    } catch (err) {
      console.error('Fusion error:', err);
    } finally {
      useLoadingToast.getState().hide();
      await loadVaultData(true);
      setFusionLoading(false);
    }
  }, [addToCollection, removeFromCollection, startReveal, setLocation, loadVaultData]);

  const scrollToBundles = () => {
    const el = document.getElementById('token-bundle-shelf');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className="p-5 md:p-8 rounded-2xl relative overflow-hidden border border-[#ff9900]/30 transition-all duration-300 shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, #100d05 0%, #080602 60%, #030201 100%)',
          boxShadow: '8px 8px 0 #000000, 0 0 50px rgba(255,153,0,0.06)',
        }}
      >
        {/* CRT Scanline & Grid Effect */}
        <div className="scanlines absolute inset-0 opacity-10 pointer-events-none" />
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 184, 0, 0.4) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        />

        <div className="relative z-10">
          {/* Top Telemetry & Console Status Bar */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-[10px] font-mono font-black uppercase tracking-[0.25em] text-amber-400">
                  HARDWARE CONSOLE // V2.1 NOMINAL
                </span>
              </div>
              <h2
                style={{
                  fontFamily: '"Impact", "Arial Black", sans-serif',
                  fontSize: '30px',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.02em',
                  margin: 0,
                  color: 'var(--color-neon-gold, #FFD700)',
                  textShadow: '0 0 16px rgba(255,184,0,0.4)',
                }}
              >
                V⚡ Shop Console
              </h2>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 mt-1">
                Targeted pulls • Instant overclocks • Plasma fusion • Real-time decryption
              </p>
            </div>

            {/* Spark Balance Counter with Quick Recharge Action */}
            <div className="flex items-center gap-3">
              <div
                className="sticker-gun-tag sticker-slits flex items-center gap-2 px-3.5 py-2 rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, #FFB800, #FF8800)',
                  color: '#000000',
                  transform: 'rotate(0.5deg)',
                  boxShadow: '3px 3px 0 #000000',
                }}
              >
                <Zap size={14} className="fill-black" />
                <span className="text-xs font-mono font-black tracking-tight uppercase">
                  {tokenBalance.toLocaleString()} V⚡ SPARKS AVAILABLE
                </span>
              </div>

              <button
                onClick={scrollToBundles}
                className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40 text-amber-400 text-[10px] font-mono font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>GET SPARKS</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* 5 Hardware Action Modules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* MODULE 1: VAULT PACK (275 V⚡ • 3% MYTHIC RATE) */}
            <div 
              className="group p-4.5 rounded-xl border flex flex-col justify-between relative overflow-hidden transition-all duration-200"
              style={{
                background: 'linear-gradient(180deg, rgba(255,215,0,0.08) 0%, rgba(18,14,4,0.95) 100%)',
                borderColor: 'rgba(255,215,0,0.45)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              }}
            >
              <div className="absolute top-2.5 right-2.5">
                <span className="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ✦ 3% MYTHIC
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-lg text-amber-400 border border-amber-500/30">
                    ⚡
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-amber-400">Vault Pack</h3>
                    <span className="text-[9px] font-mono text-zinc-400">3 Cards • 365 Days</span>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-zinc-300 mb-3.5 leading-relaxed">
                  Premium archive release. High-yield 3.0% Mythic drop chance!
                </p>

                <div className="p-2.5 rounded-lg bg-black/60 border border-amber-500/20 mb-4 text-[9.5px] font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Mythic Chance:</span>
                    <span className="text-amber-400 font-bold">3.0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Pool:</span>
                    <span className="text-purple-300 font-bold">All 365 Days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Yield:</span>
                    <span className="text-white font-bold">3 Collectibles</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[9.5px] font-mono uppercase tracking-widest text-zinc-400 mb-2">
                  <span>Standard Cost</span>
                  <span className="text-amber-400 font-bold">275 V⚡</span>
                </div>

                <button
                  disabled={isPurchasing || tokenBalance < 275}
                  onClick={() => handlePackRip('vault_token', 'single')}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black uppercase text-xs tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer shadow flex items-center justify-center gap-1.5"
                  style={{ border: '2px solid #000000', boxShadow: '2px 2px 0 #000000' }}
                >
                  <Zap size={13} className="fill-black" />
                  <span>{isPurchasing ? 'OPENING…' : tokenBalance < 275 ? 'NEED SPARKS' : 'RIP VAULT PACK'}</span>
                </button>
              </div>
            </div>

            {/* MODULE 2: BOMBSHELL PULL (100 V⚡ • 1-CARD ARTWORK) */}
            <div 
              className="group p-4.5 rounded-xl border flex flex-col justify-between relative overflow-hidden transition-all duration-200"
              style={{
                background: 'linear-gradient(180deg, rgba(255,20,147,0.1) 0%, rgba(30,8,20,0.95) 100%)',
                borderColor: 'rgba(255,20,147,0.45)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              }}
            >
              <div className="absolute top-2.5 right-2.5">
                <span className="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/40">
                  ✦ 3% MYTHIC
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-lg text-pink-400 border border-pink-500/30">
                    💖
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-pink-400">Bombshell Pull</h3>
                    <span className="text-[9px] font-mono text-zinc-400">1 Card • Art Series</span>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-zinc-300 mb-3.5 leading-relaxed">
                  Collector-grade artwork single rip. High aesthetic variance.
                </p>

                <div className="p-2.5 rounded-lg bg-black/60 border border-pink-500/20 mb-4 text-[9.5px] font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Mythic Chance:</span>
                    <span className="text-pink-400 font-bold">3.0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Pool:</span>
                    <span className="text-pink-300 font-bold">Bombshell Art</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Yield:</span>
                    <span className="text-white font-bold">1 Collectible</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[9.5px] font-mono uppercase tracking-widest text-zinc-400 mb-2">
                  <span>Entry Cost</span>
                  <span className="text-pink-400 font-bold">100 V⚡</span>
                </div>

                <button
                  disabled={isPurchasing || tokenBalance < 100}
                  onClick={() => handlePackRip('bombshell_token', 'single')}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-black uppercase text-xs tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer shadow flex items-center justify-center gap-1.5"
                  style={{ border: '2px solid #000000', boxShadow: '2px 2px 0 #000000' }}
                >
                  <Sparkles size={13} className="fill-white" />
                  <span>{isPurchasing ? 'OPENING…' : tokenBalance < 100 ? 'NEED SPARKS' : 'RIP BOMBSHELL'}</span>
                </button>
              </div>
            </div>

            {/* MODULE 3: TARGETED PULL (500 V⚡ • DAY 1-365) */}
            <div 
              className="group p-4.5 rounded-xl border flex flex-col justify-between relative overflow-hidden transition-all duration-200"
              style={{
                background: 'linear-gradient(180deg, rgba(0,240,255,0.08) 0%, rgba(6,18,26,0.95) 100%)',
                borderColor: 'rgba(0,240,255,0.35)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              }}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-lg text-cyan-400 border border-cyan-500/30">
                    🎯
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-cyan-400">Targeted Pull</h3>
                    <span className="text-[9px] font-mono text-zinc-400">Day Exact Match</span>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-zinc-300 mb-2 leading-relaxed">
                  Target any released drop (Day 1–{currentDay}). Future days are locked to preserve Prophecy value.
                </p>

                {/* Day Input & Quick Buttons */}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max={currentDay}
                      value={targetDay}
                      onChange={(e) => setTargetDay(e.target.value)}
                      placeholder={`Day (1–${currentDay})`}
                      className={`w-full bg-black/80 border text-white font-mono text-xs p-2 rounded-lg outline-none transition-colors ${
                        parseInt(targetDay, 10) > currentDay
                          ? 'border-purple-500/80 text-purple-300 bg-purple-950/20'
                          : 'border-cyan-500/30 focus:border-cyan-400'
                      }`}
                    />
                  </div>

                  {/* Future Day Warning Pill */}
                  {parseInt(targetDay, 10) > currentDay && (
                    <div className="flex items-center gap-1 text-[8px] font-mono font-black text-purple-400 bg-purple-950/50 border border-purple-500/40 px-2 py-1 rounded">
                      <AlertCircle size={10} className="shrink-0" />
                      <span>FUTURE LOCKED // REQUIRES PROPHECY</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSetToday}
                      className="flex-1 py-1 px-1.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[8px] font-mono font-bold text-cyan-300 flex items-center justify-center gap-1"
                    >
                      <Calendar size={9} /> TODAY (D{currentDay})
                    </button>
                    <button
                      type="button"
                      onClick={handleSetRandomDay}
                      className="flex-1 py-1 px-1.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[8px] font-mono font-bold text-cyan-300 flex items-center justify-center gap-1"
                    >
                      <Shuffle size={9} /> RANDOM
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[9.5px] font-mono uppercase tracking-widest text-zinc-400 mb-2">
                  <span>Targeted Cost</span>
                  <span className="text-cyan-400 font-bold">500 V⚡</span>
                </div>

                <button
                  disabled={
                    targetLoading ||
                    !targetDay ||
                    parseInt(targetDay, 10) < 1 ||
                    parseInt(targetDay, 10) > currentDay ||
                    tokenBalance < 500
                  }
                  onClick={() => handleTargetedPull(parseInt(targetDay, 10))}
                  className={`w-full py-2.5 rounded-lg font-black uppercase text-xs tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer shadow flex items-center justify-center gap-1.5 ${
                    parseInt(targetDay, 10) > currentDay
                      ? 'bg-purple-950/60 border border-purple-500/50 text-purple-300'
                      : 'bg-cyan-400 hover:bg-cyan-300 text-black border-2 border-black'
                  }`}
                  style={{ boxShadow: parseInt(targetDay, 10) > currentDay ? 'none' : '2px 2px 0 #000000' }}
                >
                  <Target size={13} className={parseInt(targetDay, 10) > currentDay ? 'text-purple-400' : 'fill-black'} />
                  <span>
                    {targetLoading
                      ? 'TARGETING…'
                      : parseInt(targetDay, 10) > currentDay
                      ? 'PROPHECY ONLY'
                      : tokenBalance < 500
                      ? 'NEED SPARKS'
                      : 'EXECUTE PULL'}
                  </span>
                </button>
              </div>
            </div>

            {/* MODULE 4: RARITY OVERCLOCK (150 V⚡) */}
            <div 
              className="group p-4.5 rounded-xl border flex flex-col justify-between relative overflow-hidden transition-all duration-200"
              style={{
                background: 'linear-gradient(180deg, rgba(57,255,20,0.07) 0%, rgba(6,20,8,0.95) 100%)',
                borderColor: 'rgba(57,255,20,0.35)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              }}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-lg text-green-400 border border-green-500/30">
                    ⚡
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-green-400">Rarity Upgrade</h3>
                    <span className="text-[9px] font-mono text-zinc-400">+1 Tier Overclock</span>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-zinc-300 mb-2 leading-relaxed">
                  Elevate any owned card below Legendary by +1 tier instant prestige.
                </p>

                <div className="mb-3">
                  <select
                    value={upgradeCardId}
                    onChange={(e) => setUpgradeCardId(e.target.value)}
                    className="w-full bg-black/80 border border-green-500/30 text-white font-mono text-[10px] p-2 rounded-lg focus:border-green-400 outline-none"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="">-- Choose Card to Boost --</option>
                    {upgradeableCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        Day {c.card.day}: {c.card.title.slice(0, 14)} ({c.card.rarity.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[9.5px] font-mono uppercase tracking-widest text-zinc-400 mb-2">
                  <span>Overclock Cost</span>
                  <span className="text-green-400 font-bold">150 V⚡</span>
                </div>

                <button
                  disabled={upgradeLoading || !upgradeCardId || tokenBalance < 150}
                  onClick={() => handleUpgrade(upgradeCardId)}
                  className="w-full py-2.5 rounded-lg bg-green-400 hover:bg-green-300 text-black font-black uppercase text-xs tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer shadow flex items-center justify-center gap-1.5"
                  style={{ border: '2px solid #000000', boxShadow: '2px 2px 0 #000000' }}
                >
                  <ArrowUpRight size={13} />
                  <span>{upgradeLoading ? 'UPGRADING…' : 'UPGRADE CARD'}</span>
                </button>
              </div>
            </div>

            {/* MODULE 5: DUPLICATE FUSION (FREE) */}
            <div 
              className="group p-4.5 rounded-xl border flex flex-col justify-between relative overflow-hidden transition-all duration-200"
              style={{
                background: 'linear-gradient(180deg, rgba(255,56,0,0.08) 0%, rgba(24,6,0,0.95) 100%)',
                borderColor: 'rgba(255,56,0,0.35)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              }}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-lg text-red-400 border border-red-500/30">
                    🔥
                  </div>
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-wider text-red-400">Duplicate Fusion</h3>
                    <span className="text-[9px] font-mono text-zinc-400">Combine 3 ➔ 1</span>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-zinc-300 mb-2 leading-relaxed">
                  Combine 3 identical cards to ignite 1 upgraded tier copy.
                </p>

                {/* Fusable scroll area */}
                <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1 mb-3" style={{ scrollbarWidth: 'thin' }}>
                  {fusableGroups.length === 0 ? (
                    <div className="text-[9.5px] font-mono text-zinc-500 text-center py-3 bg-black/40 rounded-lg border border-white/5">
                      No fusable triplets yet
                    </div>
                  ) : (
                    fusableGroups.map(([key, cards]) => {
                      const first = cards[0];
                      const rc = RARITY_CONFIG[first.card.rarity as Rarity];
                      return (
                        <div key={key} className="flex items-center justify-between p-1.5 rounded bg-black/60 border border-white/5">
                          <div className="text-[8.5px] font-mono text-zinc-200 truncate pr-1">
                            D{first.card.day} <span className="font-bold" style={{ color: rc?.color || '#fff' }}>{first.card.rarity.toUpperCase()}</span>
                          </div>
                          <button
                            disabled={fusionLoading}
                            onClick={() => handleFusion(cards.slice(0, 3))}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-mono text-[8px] font-black uppercase rounded cursor-pointer transition-all"
                          >
                            FUSE
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-[9.5px] font-mono uppercase tracking-widest text-zinc-400 mb-2">
                  <span>Energy Cost</span>
                  <span className="text-red-400 font-bold">FREE (0 V⚡)</span>
                </div>

                <div className="text-[9px] font-mono text-zinc-400 text-center py-2 bg-black/40 rounded border border-white/5">
                  {fusableGroups.length > 0 ? `${fusableGroups.length} Triplet(s) Ready` : 'Requires 3 Identicals'}
                </div>
              </div>
            </div>
          </div>

          {/* V⚡ TOKEN BUNDLES RECHARGE SECTION */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <TokenBundleShelf onPurchased={loadVaultData} />
          </div>
        </div>
      </div>
    </div>
  );
}
