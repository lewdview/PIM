import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Tag, ShoppingBag, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { sellCard, buyTokenPack, getTokenPackCost } from '../services/vaultService';
import { RARITY_CONFIG } from '../utils/rarity';
import { canProduceEcho } from '../utils/echoSystem';

import type { OwnedCard } from '../services/vaultService';

interface TokenShopProps {
  onPackOpened: (cards: OwnedCard[]) => void;
}

const RARITY_ORDER = ['mythic', 'legendary', 'rare', 'uncommon', 'common'] as const;

export default function TokenShop({ onPackOpened }: TokenShopProps) {
  const { collection, removeFromCollection, tokenBalance, setTokenBalance, addToCollection, startReveal, loadVaultData } = useVaultStore();
  const [sellOpen, setSellOpen] = useState(false);
  const [lastEarned, setLastEarned] = useState<number | null>(null);
  const [buyFlash, setBuyFlash] = useState(false);
  const [buyError, setBuyError] = useState(false);
  const [confirmSell, setConfirmSell] = useState<OwnedCard | null>(null);


  const packCost = getTokenPackCost();
  const canAfford = tokenBalance >= packCost;

  const handleSell = useCallback((card: OwnedCard) => {
    setConfirmSell(card);
  }, []);

  const confirmSellAction = useCallback(async () => {
    if (!confirmSell) return;
    const result = await sellCard(confirmSell);
    removeFromCollection(confirmSell.id);
    await loadVaultData(); // Refresh balance from Supabase
    setLastEarned(result.tokensEarned);
    setConfirmSell(null);
    setTimeout(() => setLastEarned(null), 2500);
  }, [confirmSell, removeFromCollection, loadVaultData]);

  const handleBuyTokenPack = useCallback(async () => {
    if (!canAfford) {
      setBuyError(true);
      setTimeout(() => setBuyError(false), 700);
      return;
    }
    setBuyFlash(true);
    const result = await buyTokenPack();
    await loadVaultData(); // Refresh balance from backend
    setBuyFlash(false);
    if (result === 'insufficient' || result.length === 0) return;
    addToCollection(result);
    startReveal(result, {
      category: 'vault_token',
      size: 'single',
      label: 'Vault Pack',
      icon: '⚡',
      accent: '#ff9900',
      gradient: 'linear-gradient(135deg, #1a0f00, #2a1a00, #1a0f00)',
      price: `${packCost} V⚡`,
      cardCount: result.length,
      revealType: 'cinematic',
      showRipAnother: true,
    });
    onPackOpened(result);
  }, [canAfford, addToCollection, startReveal, onPackOpened, setTokenBalance]);

  // Sort collection: most valuable first
  const sortedCollection = [...collection].sort((a, b) => {
    const aIdx = RARITY_ORDER.indexOf(a.card.rarity as any);
    const bIdx = RARITY_ORDER.indexOf(b.card.rarity as any);
    return aIdx - bIdx;
  });

  const progress = Math.min((tokenBalance / packCost) * 100, 100);

  return (
    <section className="relative px-4 md:px-8 py-2">
      {/* Section header */}
      <div className="flex items-end gap-4 mb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-6 bg-amber-400" style={{ boxShadow: '0 0 8px #ff990088' }} />
            <span className="text-[9px] font-mono tracking-[0.35em] uppercase" style={{ color: 'var(--color-neon-amber)' }}>
              Economy
            </span>
          </div>
          <h2 className="text-[42px] brutalist-xl" style={{ '--neon-accent': '#ff9900' } as any}>
            Token Shop
          </h2>
        </div>
        <div className="mb-2 ml-auto flex items-center gap-3">
          {/* Live balance pill */}
          <div className="relative">
            <div
              className="flex items-center gap-2 px-4 py-2 border-2 border-black font-black"
              style={{
                background: canAfford ? '#ff9900' : '#fff',
                color: '#000',
                boxShadow: canAfford ? '4px 4px 0 #000, 0 0 20px #ff990055' : '4px 4px 0 #000',
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '22px',
                letterSpacing: '-0.5px',
                transition: 'all 0.25s ease',
              }}
            >
              <Zap size={18} style={{ color: canAfford ? '#000' : '#ff9900' }} />
              <span>{tokenBalance.toLocaleString()}</span>
              <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', opacity: 0.6 }}>V⚡</span>
            </div>
            <AnimatePresence>
              {lastEarned && (
                <motion.div
                  key="earned"
                  initial={{ opacity: 0, y: 0, x: '-50%' }}
                  animate={{ opacity: 1, y: -36 }}
                  exit={{ opacity: 0, y: -52 }}
                  transition={{ duration: 0.4 }}
                  className="absolute left-1/2 top-0 font-black whitespace-nowrap"
                  style={{ fontFamily: '"Impact", sans-serif', fontSize: '18px', color: '#ff9900', textShadow: '2px 2px 0 #000' }}
                >
                  +{lastEarned} V⚡
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ===== LEFT: SELL PANEL ===== */}
        <div
          className="relative border-2 border-black"
          style={{ background: '#0a0a0a', boxShadow: '6px 6px 0 #000' }}
        >
          {/* Header bar */}
          <button
            className="w-full flex items-center justify-between px-5 py-4 border-b-2 border-black"
            style={{ background: '#111' }}
            onClick={() => setSellOpen(!sellOpen)}
          >
            <div className="flex items-center gap-2">
              <Tag size={16} style={{ color: '#ff9900' }} />
              <span className="font-black uppercase tracking-tight" style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '20px' }}>
                Sell Cards
              </span>
              <span className="text-[9px] font-mono opacity-50 uppercase tracking-wider ml-2">
                ({collection.length} in vault)
              </span>
            </div>
            {sellOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Token value guide */}
          <div className="grid grid-cols-5 border-b border-white/10">
            {RARITY_ORDER.map(r => {
              const rc = RARITY_CONFIG[r];
              return (
                <div key={r} className="flex flex-col items-center py-2 px-1 border-r border-white/5 last:border-r-0">
                  <span className="text-[7px] font-mono uppercase" style={{ color: rc.color, opacity: 0.8 }}>{r}</span>
                  <span className="text-[15px] font-black" style={{ fontFamily: '"Impact", sans-serif', color: '#ff9900' }}>
                    {rc.tokenValue}
                  </span>
                  <span className="text-[6px] font-mono opacity-40">V⚡</span>
                </div>
              );
            })}
          </div>

          {/* Card list */}
          <AnimatePresence>
            {sellOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div className="max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {sortedCollection.length === 0 ? (
                    <div className="text-center py-8 text-xs font-mono opacity-40">
                      No cards in collection yet
                    </div>
                  ) : (
                    sortedCollection.map((card) => {
                      const rc = RARITY_CONFIG[card.card.rarity];
                      const gen = card.echoGeneration ?? 0;
                      const tokenYield = rc.tokenValue ?? 5;
                      return (
                        <div
                          key={card.id}
                          className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-1.5 h-6 flex-shrink-0 rounded-sm" style={{ background: rc.color, opacity: card.isEcho ? 0.5 : 1 }} />
                            <div className="min-w-0">
                              <div className="text-[11px] font-black uppercase truncate" style={{ letterSpacing: '-0.2px' }}>
                                {card.isEcho && <span style={{ color: '#00d4aa', marginRight: '4px', fontSize: '9px', opacity: 0.7 }}>◎</span>}
                                {card.card.title}
                              </div>
                              <div className="text-[8px] font-mono opacity-40 uppercase">
                                Day {card.card.day} · {card.card.rarity}
                                {card.isEcho && <span style={{ color: '#00d4aa', marginLeft: '4px' }}>RE-ENTRY {gen}</span>}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSell(card)}
                            className="flex-shrink-0 flex items-center gap-1 px-3 py-1 ml-3 border border-white/20 hover:border-amber-400 hover:bg-amber-400/10 transition-all text-[9px] font-black uppercase tracking-wider"
                            style={{ fontFamily: '"JetBrains Mono", monospace' }}
                          >
                            <Zap size={9} style={{ color: '#ff9900' }} />
                            {tokenYield}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!sellOpen && (
            <div className="px-5 py-4 text-[10px] font-mono opacity-40">
              Open to see your cards and sell for V⚡ tokens
            </div>
          )}
        </div>

        {/* ===== RIGHT: BUY VAULT PACK ===== */}
        <div
          className="relative border-2 border-black flex flex-col"
          style={{
            background: canAfford
              ? 'linear-gradient(135deg, #1a0f00 0%, #2a1a00 60%, #1a1000 100%)'
              : '#0a0a0a',
            boxShadow: canAfford ? '6px 6px 0 #000, 0 0 40px #ff990022' : '6px 6px 0 #000',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Label tab */}
          <div className="px-5 pt-5 pb-3 border-b-2 border-black flex items-center gap-3">
            <ShoppingBag size={16} style={{ color: '#ff9900' }} />
            <span className="font-black uppercase" style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '20px' }}>
              Vault Pack
            </span>
            <div
              className="ml-auto text-[9px] font-mono px-2 py-0.5 border font-black uppercase tracking-wider"
              style={{ borderColor: '#ff9900', color: '#ff9900' }}
            >
              TOKEN ONLY
            </div>
          </div>

          {/* Pack details */}
          <div className="flex-1 px-5 py-4 space-y-4">
            {/* Cost */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase opacity-50">Cost</span>
              <div className="flex items-center gap-1">
                <Zap size={14} style={{ color: '#ff9900' }} />
                <span className="font-black text-2xl" style={{ fontFamily: '"Impact", "Arial Black", sans-serif', color: '#ff9900' }}>
                  {packCost}
                </span>
                <span className="text-[11px] font-mono opacity-60">V⚡</span>
              </div>
            </div>

            {/* Cards */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase opacity-50">Cards</span>
              <span className="font-black text-xl" style={{ fontFamily: '"Impact", "Arial Black", sans-serif' }}>3</span>
            </div>

            {/* Drop rate highlight */}
            <div className="border border-white/10 p-3" style={{ background: 'rgba(255,153,0,0.04)' }}>
              <div className="flex items-center gap-1 mb-2">
                <TrendingUp size={10} style={{ color: '#ff9900' }} />
                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: '#ff9900' }}>Premium Odds</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {(['mythic', 'legendary', 'rare', 'uncommon', 'common'] as const).map((r, i) => {
                  const rates = [3, 14, 25, 28, 30];
                  const rc = RARITY_CONFIG[r];
                  return (
                    <div key={r} className="text-center">
                      <div className="text-[9px] font-black" style={{ color: rc.color }}>{rates[i]}%</div>
                      <div className="text-[6px] font-mono opacity-40 uppercase">{r.slice(0, 3)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[8px] font-mono opacity-50 mb-1">
                <span>{tokenBalance} / {packCost} V⚡</span>
                <span>{canAfford ? 'READY' : `${packCost - tokenBalance} more needed`}</span>
              </div>
              <div className="h-2 bg-black border border-white/10">
                <motion.div
                  className="h-full"
                  style={{ background: '#ff9900' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          </div>

          {/* Buy button */}
          <div className="px-5 pb-5">
            <motion.button
              whileHover={canAfford ? { scale: 1.02, y: -1 } : {}}
              whileTap={canAfford ? { scale: 0.98 } : {}}
              onClick={handleBuyTokenPack}
              animate={buyError ? { x: [-6, 6, -4, 4, 0] } : buyFlash ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.3 }}
              className="w-full py-4 flex items-center justify-center gap-2 border-2 border-black font-black uppercase transition-all"
              style={{
                background: canAfford ? '#ff9900' : '#1a1a1a',
                color: canAfford ? '#000' : '#333',
                boxShadow: canAfford ? '4px 4px 0 #000' : '4px 4px 0 #000',
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '20px',
                letterSpacing: '0.02em',
                cursor: canAfford ? 'pointer' : 'not-allowed',
              }}
            >
              <Zap size={20} />
              {buyFlash ? 'OPENING...' : canAfford ? 'RIP VAULT PACK' : 'NOT ENOUGH V⚡'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Confirm sell modal */}
      <AnimatePresence>
        {confirmSell && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setConfirmSell(null)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              className="border-2 border-black flex flex-col"
              style={{
                background: '#0e0e0e',
                boxShadow: '8px 8px 0 #000',
                maxWidth: '360px',
                width: '90vw',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-5 border-b-2 border-black">
                <h3 className="text-2xl brutalist-title" style={{ '--neon-accent': '#ff9900' } as any}>Burn Card?</h3>
              </div>
              <div className="px-6 py-4 space-y-2">
                <div className="font-black text-lg uppercase" style={{ fontFamily: '"Impact", sans-serif' }}>
                  {confirmSell.isEcho && <span style={{ color: '#00d4aa', marginRight: '6px', fontSize: '12px' }}>◎</span>}
                  {confirmSell.card.title}
                </div>
                <div className="text-[10px] font-mono opacity-60 uppercase">
                  Day {confirmSell.card.day} · {confirmSell.card.rarity}
                  {confirmSell.isEcho && <span style={{ color: '#00d4aa', marginLeft: '6px' }}>RE-ENTRY {confirmSell.echoGeneration}</span>}
                </div>

                {/* Token + Echo Split Display */}
                {(() => {
                  const baseVal = RARITY_CONFIG[confirmSell.card.rarity]?.tokenValue ?? 5;
                  const gen = confirmSell.echoGeneration ?? 0;
                  const willEcho = canProduceEcho(gen);
                  const tokenYield = baseVal;

                  return (
                    <>
                      <div className="flex items-center gap-2 mt-3 py-3 border-t border-white/10">
                        <Zap size={20} style={{ color: '#ff9900' }} />
                        <span className="font-black text-3xl" style={{ fontFamily: '"Impact", "Arial Black", sans-serif', color: '#ff9900' }}>
                          +{tokenYield}
                        </span>
                        <span className="text-sm font-mono opacity-60">V⚡</span>
                      </div>

                      {willEcho && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 12px', border: '1px solid rgba(0,212,170,0.2)',
                          background: 'rgba(0,212,170,0.04)',
                        }}>
                          <span style={{ fontSize: '14px' }}>◎</span>
                          <div>
                            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', color: '#00d4aa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                              {(() => { const rates: Record<number,number> = {0:25,1:15,2:8}; return rates[gen] ?? 0; })()}% CHANCE: Echo to Pack Pool
                            </div>
                            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '8px', opacity: 0.5 }}>
                              Re-entry {gen + 1} · {(() => { const r = ['common','uncommon','rare','legendary','mythic']; const idx = Math.max(0, r.indexOf(confirmSell.card.rarity) - 1); return r[idx]; })().toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}

                      {!willEcho && (
                        <div style={{
                          padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.02)',
                        }}>
                          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            ⊘ Entropy Death · No Echo
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                <p className="text-[10px] font-mono opacity-40">This action cannot be undone. The card will be permanently removed from your collection.</p>
              </div>
              <div className="px-6 pb-5 flex gap-3">
                <button
                  onClick={() => setConfirmSell(null)}
                  className="flex-1 py-3 border-2 border-white/20 text-[11px] font-black uppercase tracking-wider hover:bg-white/5 transition-colors"
                  style={{ fontFamily: '"JetBrains Mono", monospace' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSellAction}
                  className="flex-1 py-3 border-2 border-black text-[11px] font-black uppercase tracking-wider transition-all"
                  style={{
                    background: '#ff9900',
                    color: '#000',
                    boxShadow: '3px 3px 0 #000',
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  Burn for V⚡
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
