import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Filter, Grid3X3, List, Flame } from 'lucide-react';
import { useLocation } from 'wouter';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import Card from '../components/Card';
import RarityBadge from '../components/RarityBadge';
import UltraRewardModal from '../components/UltraRewardModal';
import CardDetailModal from '../components/CardDetailModal';
import FusionAnimation from '../components/FusionAnimation';
import { type OwnedCard, fuseDuplicates, sellCard } from '../services/vaultService';
import { useVaultStore } from '../store/useVaultStore';
import { useLoadingToast } from '../store/useLoadingToast';
import { RARITIES, RARITY_CONFIG, getSupplyCap, type Rarity } from '../utils/rarity';

type SortBy = 'day' | 'rarity' | 'recent';
type FilterRarity = Rarity | 'all';

export default function CollectionPage() {
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [filterRarity, setFilterRarity] = useState<FilterRarity>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const [ultraModalOpen, setUltraModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<OwnedCard | null>(null);
  const [page, setPage] = useState(1);
  const CARDS_PER_PAGE = 24;

  const collection = useVaultStore((s) => s.collection);
  const supplyMap = useVaultStore((s) => s.supplyMap);
  const streakCount = useVaultStore((s) => s.streakCount);
  const echoPrestigeScore = useVaultStore((s) => s.echoPrestigeScore);
  const { addToCollection, removeFromCollection, loadVaultData } = useVaultStore();

  const [, setLocation] = useLocation();
  const stop = useGlobalPlayer((s) => s.stop);

  // Fusion state
  const [fusionLoading, setFusionLoading] = useState(false);
  const [fusionResult, setFusionResult] = useState<{ sourceCards: OwnedCard[]; resultCard: OwnedCard } | null>(null);

  const getCardSupplyCount = (day: number, rarity?: Rarity) => {
    // Mimic the backend supply counting logic safely reading from map:
    if (rarity) return supplyMap[`card-${day}-${rarity}`] || 0;
    return ['common', 'uncommon', 'rare', 'legendary', 'mythic'].reduce((sum, r) => {
      return sum + (supplyMap[`card-${day}-${r}`] || 0);
    }, 0);
  };

  const filtered = useMemo(() => {
    // Filter out invalid items defensively
    let cards = collection.filter(c => c && c.card);

    if (filterRarity !== 'all') {
      cards = cards.filter(c => c.card.rarity === filterRarity);
    }

    switch (sortBy) {
      case 'day':
        cards.sort((a, b) => (a.card.day || 0) - (b.card.day || 0));
        break;
      case 'rarity':
        cards.sort((a, b) => RARITIES.indexOf(b.card.rarity) - RARITIES.indexOf(a.card.rarity));
        break;
      case 'recent':
      default:
        cards.sort((a, b) => new Date(b.claimedAt || 0).getTime() - new Date(a.claimedAt || 0).getTime());
        break;
    }

    return cards;
  }, [collection, sortBy, filterRarity]);

  const groupedFiltered = useMemo(() => {
    // Group duplicates by cardId + rarity (same logic as Forge fusableGroups)
    // Cards of different rarities for the same day are separate entries
    const groups: Record<string, OwnedCard[]> = {};
    const order: string[] = [];
    
    for (const c of filtered) {
      if (!c.card) continue;
      const key = `${c.cardId}-${c.card.rarity}`;
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(c);
    }
    
    return order.map(key => groups[key]);
  }, [filtered]);

  // Paginate
  const totalPages = Math.ceil(groupedFiltered.length / CARDS_PER_PAGE);
  const pagedGroups = useMemo(() => {
    const start = (page - 1) * CARDS_PER_PAGE;
    return groupedFiltered.slice(start, start + CARDS_PER_PAGE);
  }, [groupedFiltered, page]);

  // Reset page on filter/sort change
  useMemo(() => { setPage(1); }, [sortBy, filterRarity]);

  const stats = useMemo(() => {
    const validCollection = collection.filter(c => c && c.card);
    const unique = new Set(validCollection.map(c => c.cardId)).size;
    const byRarity: Record<string, number> = {};
    let score = 0;
    for (const c of validCollection) {
      byRarity[c.card.rarity] = (byRarity[c.card.rarity] || 0) + 1;
      score += RARITY_CONFIG[c.card.rarity]?.points || 1;
    }
    return { total: validCollection.length, unique, byRarity, score };
  }, [collection]);

  // Fuse handler
  const handleFuse = useCallback(async (group: OwnedCard[]) => {
    if (group.length < 3 || fusionLoading) return;
    const cardsToFuse = group.slice(0, 3);
    setFusionLoading(true);
    useLoadingToast.getState().show('Fusing cards…');
    const sourceSnapshot = [...cardsToFuse];
    const result = await fuseDuplicates(cardsToFuse.map(c => c.id));
    if (result) {
      addToCollection([result]);
      setFusionResult({ sourceCards: sourceSnapshot, resultCard: result });
    }
    await loadVaultData();
    setFusionLoading(false);
    useLoadingToast.getState().hide();
  }, [fusionLoading, addToCollection, loadVaultData]);

  // Burn handler
  const handleBurn = useCallback(async (ownedCard: OwnedCard) => {
    if (fusionLoading) return;
    const confirm = window.confirm(`Burn this sold-out card for V⚡ tokens?`);
    if (!confirm) return;

    useLoadingToast.getState().show('Burning card…');
    try {
      const result = await sellCard(ownedCard);
      if (result.tokensEarned > 0) {
        removeFromCollection(ownedCard.id);
        useLoadingToast.getState().show(`Burned! +${result.tokensEarned} V⚡`);
        setTimeout(() => useLoadingToast.getState().hide(), 2000);
      } else {
        useLoadingToast.getState().show('Burn failed');
        setTimeout(() => useLoadingToast.getState().hide(), 2000);
      }
    } catch (err) {
      console.error(err);
      useLoadingToast.getState().show('Error burning card');
      setTimeout(() => useLoadingToast.getState().hide(), 2000);
    } finally {
      await loadVaultData();
    }
  }, [fusionLoading, removeFromCollection, loadVaultData]);

  return (
    <div className="flex-1 px-4 md:px-8 py-10 max-w-7xl mx-auto w-full space-y-10 etching-bg bg-opacity-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex flex-col">
          <h1 className="text-5xl brutalist-title mb-4" style={{ '--neon-accent': 'var(--color-neon-purple)' } as any}>
            My Collection
          </h1>
          <div className="flex items-center gap-4">
            <div className="sticker-gun-tag sticker-slits" style={{ background: '#fdfdfd', '--slit-color': 'rgba(0,0,0,0.1)', transform: 'rotate(-1deg)', padding: '4px 10px' } as any}>
              <span className="text-[11px] font-black tracking-tighter uppercase">
                {stats.unique} / 365 UNIQUE
              </span>
            </div>
            <div className="sticker-gun-tag sticker-slits" style={{ background: 'var(--color-neon-gold)', '--slit-color': 'rgba(0,0,0,0.2)', transform: 'rotate(2deg)', padding: '4px 10px' } as any}>
              <span className="text-[11px] font-black tracking-tighter uppercase flex items-center gap-1">
                ⚡ {echoPrestigeScore} ECHO SCORE
              </span>
            </div>
            {streakCount > 0 && (
              <div className="sticker-gun-tag sticker-slits animate-pulse" style={{ background: 'var(--color-neon-cyan)', '--slit-color': 'rgba(0,0,0,0.15)', transform: 'rotate(-2deg)', padding: '4px 10px' } as any}>
                <span className="text-[11px] font-black tracking-tighter uppercase text-black">
                  🔥 {streakCount} DAY STREAK
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Progress bar */}
      <div className="space-y-3 bg-black/40 p-4 rounded border border-white/5 shadow-inner">
        <div className="h-4 rounded-sm overflow-hidden bg-black/60 border border-white/10 relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(stats.unique / 365) * 100}%` }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            className="h-full relative overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, var(--color-neon-cyan), var(--color-neon-purple), var(--color-neon-gold))',
              boxShadow: '0 0 15px rgba(0, 240, 255, 0.4)',
            }}
          >
             <div className="absolute inset-0 scanlines opacity-30" />
          </motion.div>
        </div>
        <div className="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] opacity-40">
          <span>{Math.round((stats.unique / 365) * 100)}% COLLECTION COMPLETION</span>
          <span>{365 - stats.unique} REMAINING</span>
        </div>
      </div>

      {/* Rarity breakdown */}
      <div className="flex flex-wrap gap-2">
        {RARITIES.map((r) => {
          const count = stats.byRarity[r] || 0;
          return (
            <button
              key={r}
              onClick={() => setFilterRarity(filterRarity === r ? 'all' : r)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs"
              style={{
                background: filterRarity === r ? `${RARITY_CONFIG[r].color}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filterRarity === r ? `${RARITY_CONFIG[r].color}40` : 'var(--color-border-subtle)'}`,
              }}
            >
              <RarityBadge rarity={r} size="sm" />
              <span className="font-mono font-bold" style={{ color: count > 0 ? RARITY_CONFIG[r].color : 'var(--color-text-muted)' }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
          <select
            title="Sort collection"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-xs font-mono px-2 py-1 rounded"
            style={{
              background: 'var(--color-void-gray)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <option value="recent">Recent</option>
            <option value="day">By Day</option>
            <option value="rarity">By Rarity</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          {[
            { mode: 'grid' as const, icon: Grid3X3 },
            { mode: 'compact' as const, icon: List },
          ].map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              title={`Switch to ${mode} view`}
              onClick={() => setViewMode(mode)}
              className="p-1.5 rounded transition-colors"
              style={{
                background: viewMode === mode ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: viewMode === mode ? 'var(--color-neon-yellow)' : 'var(--color-text-muted)',
              }}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl"
          style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border-subtle)' }}
        >
          <p className="text-lg mb-2" style={{ color: 'var(--color-text-muted)' }}>No cards yet</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {filterRarity !== 'all' ? 'No cards with this rarity.' : 'Claim your daily card or open a pack to start collecting.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="collection-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-2 py-4">
          {pagedGroups.map((group, i) => {
            const count = group.length;
            const mainCard = group[0];
            
            const rarity = mainCard.card.rarity;
            const isDailyClaim = mainCard.source === 'daily_claim';
            const DURATION_LIMITS: Record<string, number> = {
              common: 15,
              uncommon: 60,
              rare: 0,
              legendary: 0,
              mythic: 0,
            };
            const maxDuration = isDailyClaim ? 0 : (DURATION_LIMITS[rarity] ?? 15);
            const isFullSong = maxDuration === 0;
            
            return (
              <div key={`${mainCard.cardId}-${mainCard.card.rarity}`} className="relative group">
                {/* Visual back stacks */}
                {count > 2 && (
                  <div className="absolute inset-0 opacity-30 z-0 pointer-events-none" style={{ transform: 'translate(12px, 12px)' }}>
                    <Card card={mainCard.card} interactive={false} />
                  </div>
                )}
                {count > 1 && (
                  <div className="absolute inset-0 opacity-60 z-10 pointer-events-none" style={{ transform: 'translate(6px, 6px)' }}>
                    <Card card={mainCard.card} interactive={false} />
                  </div>
                )}
                
                {/* Ultra reward info button */}
                {mainCard.ultraReward && (
                  <button
                    onClick={e => { e.stopPropagation(); setUltraModalOpen(true); }}
                    title="Ultra Reward — tap to learn more"
                    style={{
                      position: 'absolute', top: '1.5px', left: '1.5px', zIndex: 31,
                      width: '22px', height: '22px', borderRadius: '999px',
                      background: 'linear-gradient(135deg, #ffd700, #ff9900)',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', lineHeight: 1,
                      boxShadow: '0 2px 8px rgba(255,180,0,0.5), 0 0 0 1.5px rgba(0,0,0,0.3)',
                      animation: 'pulse-glow 2.5s ease-in-out infinite',
                    }}
                  >
                    ✦
                  </button>
                )}
                {/* Card wrapper — single click flips, double-click opens detail */}
                <div 
                  className="relative z-20 transition-transform duration-300 group-hover:-translate-y-2 group-hover:-translate-x-2"
                  onDoubleClick={() => setSelectedCard(mainCard)}
                >
                  <Card 
                    card={mainCard.card} 
                    delay={i} 
                    showAudio 
                    isDailyOrigin={mainCard.source === 'daily_claim' || mainCard.source === 'pack_miss_out'} 
                    ultraReward={mainCard.ultraReward} 
                    isEcho={mainCard.isEcho} 
                    echoGeneration={mainCard.echoGeneration}
                    onBurn={getCardSupplyCount(mainCard.card.day, mainCard.card.rarity as Rarity) >= (mainCard.maxSupply || getSupplyCap(mainCard.card.rarity as Rarity)) ? () => handleBurn(mainCard) : undefined}
                    proof={mainCard.proof}
                  />
                  
                  {/* Edition Status — rarity-specific supply */}
                  <div className="absolute bottom-1 right-1 z-30 pointer-events-none">
                    {getCardSupplyCount(mainCard.card.day, mainCard.card.rarity as Rarity) >= (mainCard.maxSupply || getSupplyCap(mainCard.card.rarity as Rarity)) ? (
                      <div className="px-1.5 py-0.5 bg-black/80 border border-white/20 text-[7px] font-black uppercase tracking-tighter text-white">
                        SOLD OUT
                      </div>
                    ) : (
                      <div className="px-1.5 py-0.5 bg-white/10 backdrop-blur-sm border border-white/10 text-[7px] font-black uppercase tracking-tighter text-white/40">
                        ED. {mainCard.edition || '?'}/{mainCard.maxSupply || getSupplyCap(mainCard.card.rarity as Rarity)}
                      </div>
                    )}
                  </div>

                  {/* Details button — visible on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedCard(mainCard); }}
                    className={`absolute ${isFullSong ? 'bottom-12' : 'bottom-8'} left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95`}
                    style={{
                      padding: '5px 14px',
                      background: 'rgba(0,0,0,0.85)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '8px', fontWeight: 700,
                      letterSpacing: '0.15em', textTransform: 'uppercase' as const,
                      color: 'rgba(255,255,255,0.8)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                  >
                    DETAILS
                  </button>

                  {/* Play PIM button — visible on hover for full songs */}
                  {isFullSong && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        stop();
                        setLocation(`/play/card-${mainCard.card.day}`);
                      }}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 active:scale-95"
                      style={{
                        padding: '5px 14px',
                        background: 'rgba(0,240,255,0.15)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid var(--color-neon-cyan, #00f0ff)',
                        borderRadius: '6px',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '8px', fontWeight: 700,
                        letterSpacing: '0.15em', textTransform: 'uppercase' as const,
                        color: 'var(--color-neon-cyan, #00f0ff)',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0, 240, 255, 0.25)',
                      }}
                    >
                      PLAY PIM
                    </button>
                  )}
                </div>
                
                {/* Count Badge — compact corner pill */}
                {count > 1 && (
                  <div
                    className="absolute top-1.5 right-1.5 z-30 flex items-center justify-center shadow-lg"
                    style={{
                      background: 'var(--color-neon-yellow)',
                      color: '#000',
                      borderRadius: '999px',
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 5px',
                      fontSize: '10px',
                      fontWeight: 900,
                      fontFamily: '"JetBrains Mono", monospace',
                      letterSpacing: '-0.3px',
                      lineHeight: 1,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5), 0 0 0 1.5px rgba(0,0,0,0.25)',
                    }}
                  >
                    ×{count}
                  </div>
                )}

                {/* Fuse button — appears on groups with 3+ duplicates */}
                {count >= 3 && !['legendary', 'mythic'].includes(mainCard.card.rarity) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleFuse(group); }}
                    disabled={fusionLoading}
                    className="absolute z-30 transition-all duration-200 hover:scale-110 active:scale-95 flex flex-col items-center justify-center"
                    style={{
                      top: '50%',
                      left: '-8px', // Popped out to the left
                      transform: 'translateY(-50%)',
                      padding: '6px 8px',
                      background: 'linear-gradient(135deg, #ff3800, #ff6600)',
                      border: '2.5px solid #000',
                      borderRadius: '4px',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '8px',
                      fontWeight: 900,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase' as const,
                      color: '#fff',
                      cursor: fusionLoading ? 'wait' : 'pointer',
                      boxShadow: '4px 4px 0 #000, 0 0 15px rgba(255,56,0,0.6)',
                      gap: '1px',
                    }}
                  >
                    <Flame size={12} fill="#fff" />
                    <span style={{ fontSize: '9px', lineHeight: 1 }}>FUSE</span>
                    <span style={{ opacity: 0.8, fontSize: '7px' }}>3 → 1</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {pagedGroups.map((group, i) => {
            const count = group.length;
            const mainCard = group[0];
            
            const rarity = mainCard.card.rarity;
            const isDailyClaim = mainCard.source === 'daily_claim';
            const DURATION_LIMITS: Record<string, number> = {
              common: 15,
              uncommon: 60,
              rare: 0,
              legendary: 0,
              mythic: 0,
            };
            const maxDuration = isDailyClaim ? 0 : (DURATION_LIMITS[rarity] ?? 15);
            const isFullSong = maxDuration === 0;

            return (
              <motion.div
                key={`${mainCard.cardId}-${mainCard.card.rarity}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-3 rounded-lg glass glass-hover"
              >
                <div
                  className={`w-10 h-12 rounded overflow-hidden flex-shrink-0 ${RARITY_CONFIG[mainCard.card.rarity].cssClass}`}
                >
                  <img
                    src={mainCard.card.coverUrl}
                    alt={mainCard.card.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedCard(mainCard)}>
                  <h4 className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {mainCard.card.title}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                      DAY {mainCard.card.day}
                    </span>
                    <span className="text-[8px] font-mono opacity-30">
                      ED. {mainCard.edition || '?'}/{mainCard.maxSupply || 100}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {isFullSong && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        stop();
                        setLocation(`/play/card-${mainCard.card.day}`);
                      }}
                      className="px-2.5 py-1 rounded bg-[rgba(0,240,255,0.1)] border border-neon-cyan text-neon-cyan text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-[rgba(0,240,255,0.2)] active:scale-95"
                      style={{
                        borderColor: 'var(--color-neon-cyan, #00f0ff)',
                        color: 'var(--color-neon-cyan, #00f0ff)',
                      }}
                    >
                      Play PIM
                    </button>
                  )}
                  <div className="flex flex-col items-end gap-1">
                    <RarityBadge rarity={mainCard.card.rarity} size="sm" />
                    {count > 1 && (
                      <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--color-neon-yellow)' }}>
                        x{count} OWNED
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          paddingBottom: '160px',
        }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '6px 14px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              background: page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(160,100,255,0.1)',
              border: `1px solid ${page === 1 ? 'rgba(255,255,255,0.04)' : 'rgba(160,100,255,0.3)'}`,
              color: page === 1 ? 'rgba(255,255,255,0.15)' : 'var(--color-neon-purple)',
              cursor: page === 1 ? 'default' : 'pointer',
            }}
          >
            ← Prev
          </button>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.3)',
            padding: '0 8px',
          }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '6px 14px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              background: page === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(160,100,255,0.1)',
              border: `1px solid ${page === totalPages ? 'rgba(255,255,255,0.04)' : 'rgba(160,100,255,0.3)'}`,
              color: page === totalPages ? 'rgba(255,255,255,0.15)' : 'var(--color-neon-purple)',
              cursor: page === totalPages ? 'default' : 'pointer',
            }}
          >
            Next →
          </button>
        </div>
      )}

      <UltraRewardModal
        isOpen={ultraModalOpen}
        onClose={() => setUltraModalOpen(false)}
      />

      <CardDetailModal 
        card={selectedCard}
        isOpen={selectedCard !== null}
        onClose={() => setSelectedCard(null)}
        onBurn={handleBurn}
      />

      {/* Fusion animation overlay */}
      {fusionResult && (
        <FusionAnimation
          sourceCards={fusionResult.sourceCards}
          resultCard={fusionResult.resultCard}
          closeLabel="✨ Back to Collection"
          onClose={() => setFusionResult(null)}
        />
      )}
    </div>
  );
}
