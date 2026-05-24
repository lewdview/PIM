import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useVaultStore } from '../store/useVaultStore';
import Card from '../components/Card';
import RarityBadge from '../components/RarityBadge';
import { RARITY_CONFIG, getSupplyCap, type Rarity } from '../utils/rarity';
import { ArrowRight } from 'lucide-react';
import UltraRewardModal from '../components/UltraRewardModal';
import PackRipAnimation from '../components/PackRipAnimation';
import PackContainer from '../components/cinematic/PackContainer';

import { purchasePack, sellCard } from '../services/vaultService';
import { audioManager } from '../game/audio';

export default function PackRevealPage() {
  const [, setLocation] = useLocation();
  const { revealCards, endReveal, revealPackMeta, startReveal, addToCollection, removeFromCollection, loadVaultData } = useVaultStore();
  const [isRepurchasing, setIsRepurchasing] = useState(false);
  const [revealedIndex, setRevealedIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [ultraModalOpen, setUltraModalOpen] = useState(false);
  // 'tap' → PackRipAnimation, 'cinematic' → PackContainer, 'slide' → skip straight to cards
  const [ripDone, setRipDone] = useState(
    () => !revealPackMeta || (revealPackMeta.revealType !== 'tap' && revealPackMeta.revealType !== 'cinematic')
  );

  useEffect(() => {
    if (revealCards.length === 0) {
      setLocation('/vault');
      return;
    }
  }, [revealCards, setLocation]);

  useEffect(() => {
    if (ripDone && revealPackMeta?.revealType !== 'cinematic' && revealedIndex >= 0 && revealedIndex < revealCards.length - 1) {
      const timer = setTimeout(() => setRevealedIndex(i => i + 1), 1200);
      return () => clearTimeout(timer);
    } else if (ripDone && revealPackMeta?.revealType !== 'cinematic' && revealedIndex >= revealCards.length - 1 && revealCards.length > 0) {
      const timer = setTimeout(() => setShowSummary(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [revealedIndex, revealCards.length, ripDone, revealPackMeta]);

  useEffect(() => {
    const current = revealCards[revealedIndex];
    if (current?.ultraReward) {
      const t = setTimeout(() => setUltraModalOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [revealedIndex, revealCards]);

  const handleDone = () => {
    const redirect = revealPackMeta?.redirectPath;
    endReveal();
    if (redirect) {
      setLocation(redirect);
    } else {
      setLocation('/vault/collection');
    }
  };

  const handleBuyAnother = async () => {
    if (!revealPackMeta || !revealPackMeta.category || !revealPackMeta.size) {
      endReveal();
      setLocation('/vault');
      return;
    }
    const { category, size } = revealPackMeta;
    setIsRepurchasing(true);
    const cards = await purchasePack(category as any, size as any);
    if (cards.length > 0) {
      audioManager.playSfx('open_chest', 0.9);
      addToCollection(cards);
      setRevealedIndex(0);
      setShowSummary(false);
      const newRipDone = revealPackMeta.revealType !== 'tap' && revealPackMeta.revealType !== 'cinematic';
      setRipDone(newRipDone);
      startReveal(cards, revealPackMeta);
    }
    setIsRepurchasing(false);
  };

  const handleBurn = async (owned: any) => {
    const confirm = window.confirm('Burn this sold-out card immediately?');
    if (!confirm) return;
    
    const res = await sellCard(owned);
    if (res.tokensEarned > 0) {
      removeFromCollection(owned.id);
      await loadVaultData();
      // If we are in the single reveal view, we might want to move to the next card or show summary if it was the last one
      if (!showSummary) {
        if (revealedIndex < revealCards.length - 1) {
          setRevealedIndex(i => i + 1);
        } else {
          setShowSummary(true);
        }
      }
    }
  };

  if (revealCards.length === 0) return null;

  // ── CINEMATIC reveal (third animation) ─────────────────────────────
  if (!ripDone && revealPackMeta?.revealType === 'cinematic') {
    return (
      <PackContainer
        key={`pack-${revealCards[0]?.id}`}
        meta={revealPackMeta}
        cards={revealCards}
        onComplete={handleDone}
        onBuyAnother={revealPackMeta?.showRipAnother ? handleBuyAnother : undefined}
        isRepurchasing={isRepurchasing}
      />
    );
  }

  // ── Tap-to-open bag (daily / month / vault packs) ──────────────────
  if (!ripDone && revealPackMeta?.revealType === 'tap') {
    return <PackRipAnimation key={`tap-${revealCards[0]?.id}`} meta={revealPackMeta} onComplete={() => setRipDone(true)} />;
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 min-h-[80vh]">
      {/* Card reveal */}
      {revealedIndex >= 0 && !showSummary && (
        <div className="text-center space-y-6">
          <motion.div
            key={`counter-${revealedIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs font-mono"
            style={{ color: 'var(--color-text-muted)' }}
          >
            CARD {revealedIndex + 1} / {revealCards.length}
          </motion.div>

          <div className="relative w-[240px] md:w-[280px]">
            <AnimatePresence mode="wait">
              {revealCards.map((owned, i) => {
                if (i !== revealedIndex) return null;
                const rarityConfig = RARITY_CONFIG[owned.card.rarity];

                return (
                  <motion.div
                    key={owned.id}
                    initial={{ opacity: 0, rotateY: -90, scale: 0.5 }}
                    animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -200, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    style={{ perspective: '1000px' }}
                  >
                    <Card 
                      card={owned.card} 
                      interactive={false} 
                      showAudio 
                      isDailyOrigin={owned.source === 'daily_claim' || owned.source === 'pack_miss_out'} 
                      ultraReward={owned.ultraReward} 
                      isEcho={owned.isEcho} 
                      echoGeneration={owned.echoGeneration}
                      onBurn={(owned.edition || 0) > (owned.maxSupply || getSupplyCap(owned.card.rarity as Rarity)) ? () => handleBurn(owned) : undefined}
                      proof={owned.proof}
                    />

                    {['legendary', 'mythic'].includes(owned.card.rarity) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 2, 3] }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{
                          background: `radial-gradient(circle, ${rarityConfig.color}30, transparent 60%)`,
                        }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <motion.div
            key={`badge-${revealedIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <RarityBadge rarity={revealCards[revealedIndex]?.card.rarity || 'common'} size="lg" />
            {revealCards[revealedIndex]?.proof && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="mt-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold"
                style={{
                  background: revealCards[revealedIndex].proof === 'proof_of_first'
                    ? 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.05))'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
                  border: `1px solid ${revealCards[revealedIndex].proof === 'proof_of_first' ? 'rgba(167,139,250,0.4)' : 'rgba(239,68,68,0.4)'}`,
                  color: revealCards[revealedIndex].proof === 'proof_of_first' ? '#a78bfa' : '#ef4444',
                }}
              >
                {revealCards[revealedIndex].proof === 'proof_of_first'
                  ? '🔮 PROOF OF FIRST (1/1)'
                  : '🎲 HEARD FIRST PROOF (1/1)'}
              </motion.div>
            )}
          </motion.div>
        </div>
      )}

      {/* Summary */}
      {showSummary && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl space-y-6"
        >
          <h2 className="text-2xl font-bold text-center text-gradient">Pack Opened!</h2>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {revealCards.map((owned, i) => (
              <motion.div
                key={owned.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card 
                  card={owned.card} 
                  interactive={false} 
                  delay={i} 
                  isDailyOrigin={owned.source === 'daily_claim' || owned.source === 'pack_miss_out'} 
                  ultraReward={owned.ultraReward} 
                  isEcho={owned.isEcho} 
                  echoGeneration={owned.echoGeneration}
                  onBurn={(owned.edition || 0) > (owned.maxSupply || getSupplyCap(owned.card.rarity as Rarity)) ? () => handleBurn(owned) : undefined}
                  proof={owned.proof}
                />
              </motion.div>
            ))}
          </div>

          <div
            className="flex items-center justify-center gap-4 p-3 rounded-xl"
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            {['common', 'uncommon', 'rare', 'legendary', 'mythic'].map((r) => {
              const count = revealCards.filter(c => c.card.rarity === r).length;
              if (count === 0) return null;
              return (
                <div key={r} className="flex items-center gap-1.5">
                  <span className="text-sm font-bold font-mono" style={{ color: RARITY_CONFIG[r as keyof typeof RARITY_CONFIG].color }}>
                    {count}×
                  </span>
                  <RarityBadge rarity={r as any} size="sm" />
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { endReveal(); setLocation('/vault'); }}
              className="px-4 py-3 rounded-xl font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
              }}
            >
              ←
            </button>
            {revealPackMeta?.showRipAnother && (
              <button
                onClick={handleBuyAnother}
                disabled={isRepurchasing || !revealPackMeta?.size}
                className="flex-1 py-3 rounded-xl font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-neon-purple)',
                  color: 'var(--color-text-primary)',
                  opacity: (isRepurchasing || !revealPackMeta?.size) ? 0.5 : 1,
                }}
              >
                {isRepurchasing ? 'RIPPING...' : 'RIP ANOTHER'}
              </button>
            )}
            <button
              onClick={handleDone}
              className="flex-1 py-3 rounded-xl font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, var(--color-neon-yellow), var(--color-neon-cyan))',
                color: 'var(--color-void-black)',
              }}
            >
              {revealPackMeta?.category === 'daily_claim' || revealPackMeta?.redirectPath === '/tutorial' ? (
                <>Start PIM <ArrowRight size={16} /></>
              ) : (
                <>Collection <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        </motion.div>
      )}

      <UltraRewardModal
        isOpen={ultraModalOpen}
        onClose={() => setUltraModalOpen(false)}
        isFreshFind
      />
    </div>
  );
}
