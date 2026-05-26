import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Lock, CheckCircle, Filter, Play, Pause, Search } from 'lucide-react';
import { useLocation } from 'wouter';
import { fetchAllCards, type VaultCard } from '../services/vaultService';
import { useVaultStore } from '../store/useVaultStore';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { RARITY_CONFIG, type Rarity } from '../utils/rarity';
import { getCurrentDay } from '../utils/dayCalc';

// Duration limits for non-owned cards (preview only)
const PREVIEW_DURATION: Record<string, number> = {
  common: 15,
  uncommon: 60,
  rare: 0,
  legendary: 0,
  mythic: 0,
};

type FilterMode = 'all' | 'owned' | 'missing' | 'beyond';
type SortMode = 'day-asc' | 'day-desc' | 'rarity';

const PAGE_SIZE = 30;

export default function CodexPage() {
  const [, setLocation] = useLocation();
  const [allCards, setAllCards] = useState<VaultCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('day-asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const collection = useVaultStore(s => s.collection);
  const { currentTrack, isPlaying, play, pause, stop } = useGlobalPlayer();

  const today = getCurrentDay();

  // Owned card IDs for quick lookup
  const ownedDays = useMemo(() => {
    const map = new Map<number, { rarity: string; source: string }>();
    for (const c of collection) {
      // Keep highest rarity if multiple
      const existing = map.get(c.card.day);
      const rarityOrder = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
      if (!existing || rarityOrder.indexOf(c.card.rarity) > rarityOrder.indexOf(existing.rarity)) {
        map.set(c.card.day, { rarity: c.card.rarity, source: c.source });
      }
    }
    return map;
  }, [collection]);

  // Owned future days for quick lookup
  const ownedFutureDays = useMemo(() => {
    const s = new Set<number>();
    for (const c of collection) {
      if (c.card.day > today) s.add(c.card.day);
    }
    return s;
  }, [collection, today]);

  // Load cards — fetch ALL (including future) so prophecy/targeted pulls can appear
  useEffect(() => {
    fetchAllCards().then(cards => {
      setAllCards(cards);
      setLoading(false);
    });
  }, []);

  // Visible cards: past cards + owned future cards (hide unowned future cards)
  const visibleCards = useMemo(() => {
    return allCards.filter(c => c.day <= today || ownedFutureDays.has(c.day));
  }, [allCards, today, ownedFutureDays]);

  // Beyond count
  const beyondCount = useMemo(() => {
    return visibleCards.filter(c => c.day > today && ownedDays.has(c.day)).length;
  }, [visibleCards, today, ownedDays]);

  // Filtered + sorted cards
  const filteredCards = useMemo(() => {
    let cards = [...visibleCards];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      cards = cards.filter(c =>
        c.title.toLowerCase().includes(q) ||
        String(c.day).includes(q) ||
        c.mood.includes(q)
      );
    }

    // Filter
    if (filter === 'owned') {
      cards = cards.filter(c => ownedDays.has(c.day));
    } else if (filter === 'missing') {
      cards = cards.filter(c => !ownedDays.has(c.day) && c.day <= today);
    } else if (filter === 'beyond') {
      cards = cards.filter(c => c.day > today && ownedDays.has(c.day));
    }

    // Sort
    if (sort === 'day-desc') {
      cards.sort((a, b) => b.day - a.day);
    } else if (sort === 'rarity') {
      const order = ['mythic', 'legendary', 'rare', 'uncommon', 'common'];
      cards.sort((a, b) => {
        const aOwned = ownedDays.get(a.day);
        const bOwned = ownedDays.get(b.day);
        const aRank = aOwned ? order.indexOf(aOwned.rarity) : 99;
        const bRank = bOwned ? order.indexOf(bOwned.rarity) : 99;
        return aRank - bRank;
      });
    } else {
      cards.sort((a, b) => a.day - b.day);
    }

    return cards;
  }, [visibleCards, filter, sort, search, ownedDays, today]);

  // Pagination
  const totalPages = Math.ceil(filteredCards.length / PAGE_SIZE);
  const pagedCards = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredCards.slice(start, start + PAGE_SIZE);
  }, [filteredCards, page]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [filter, sort, search]);

  const stats = useMemo(() => {
    const pastTotal = allCards.filter(c => c.day <= today).length;
    return {
      total: pastTotal,
      owned: ownedDays.size,
      pct: pastTotal > 0 ? Math.round((ownedDays.size / pastTotal) * 100) : 0,
    };
  }, [allCards, ownedDays, today]);

  const handlePlay = useCallback((card: VaultCard) => {
    const owned = ownedDays.get(card.day);
    const isDailyClaim = owned?.source === 'daily_claim';
    const maxDuration = isDailyClaim ? 0 : (owned ? 0 : (PREVIEW_DURATION[card.rarity] ?? 15));

    if (currentTrack?.audioUrl === card.audioUrl && currentTrack?.day === card.day) {
      if (isPlaying) {
        pause();
      } else {
        play({
          title: card.title,
          audioUrl: card.audioUrl,
          coverUrl: card.coverUrl,
          day: card.day,
          rarity: owned?.rarity || card.rarity,
          isDailyClaim,
          maxDuration,
        });
      }
    } else {
      play({
        title: card.title,
        audioUrl: card.audioUrl,
        coverUrl: card.coverUrl,
        day: card.day,
        rarity: owned?.rarity || card.rarity,
        isDailyClaim,
        maxDuration,
      });
    }
  }, [ownedDays, currentTrack, isPlaying, play, pause]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          style={{
            width: '48px', height: '48px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#ff3800',
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full min-h-screen">
      {/* ═══ HEADER ═══ */}
      <section style={{
        padding: '32px 16px 24px',
        background: 'linear-gradient(180deg, rgba(255,56,0,0.04), transparent)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div className="max-w-6xl mx-auto">
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.25)',
            marginBottom: '8px',
          }}>
            TH3V4ULT // 365 DAYS OF DARK AND LIGHT
          </div>
          <h1 style={{
            fontFamily: '"Impact", "Arial Black", sans-serif',
            fontSize: 'clamp(36px, 8vw, 56px)',
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #ff3800, #ff9900)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            lineHeight: 0.9,
          }}>
            CODEX
          </h1>
          <p style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.4)',
            marginTop: '8px',
            letterSpacing: '0.05em',
          }}>
            Your complete card checklist. Track every drop, play every song.
          </p>

          {/* Stats bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginTop: '20px',
            flexWrap: 'wrap',
          }}>
            <div style={{
              padding: '8px 16px',
              border: '2px solid #000',
              background: '#0d0d0d',
              boxShadow: '3px 3px 0 #000',
            }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.3)',
              }}>Collected</div>
              <div style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: '24px',
                color: '#ff3800',
                letterSpacing: '-1px',
                lineHeight: 1,
              }}>
                {stats.owned}<span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>/{stats.total}</span>
              </div>
            </div>

            <div style={{
              flex: 1,
              maxWidth: '200px',
              minWidth: '120px',
            }}>
              <div style={{
                height: '6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.04)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${stats.pct}%`,
                  background: 'linear-gradient(90deg, #ff3800, #ff9900)',
                  boxShadow: '0 0 8px rgba(255,56,0,0.4)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '9px',
                color: 'rgba(255,255,255,0.3)',
                marginTop: '4px',
              }}>
                {stats.pct}% COMPLETE
              </div>
            </div>

            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase',
            }}>
              Day {today}/365
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FILTERS ═══ */}
      <section style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        position: 'sticky',
        top: '56px',
        zIndex: 30,
        background: 'rgba(8,6,4,0.95)',
        backdropFilter: 'blur(16px)',
      }}>
        <div className="max-w-6xl mx-auto" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            flex: '1',
            minWidth: '150px',
            maxWidth: '300px',
          }}>
            <Search size={12} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or day..."
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '11px',
                color: '#fff',
                width: '100%',
              }}
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              background: filtersOpen ? 'rgba(255,56,0,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filtersOpen ? 'rgba(255,56,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '10px',
              color: filtersOpen ? '#ff3800' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <Filter size={10} /> Filters
          </button>

          {/* Quick filter pills */}
          {(['all', 'owned', 'missing', ...(beyondCount > 0 ? ['beyond'] : [])] as FilterMode[]).map(f => {
            const beyondActive = f === 'beyond';
            const activeColor = beyondActive ? '#b44dff' : '#ff3800';
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  fontWeight: filter === f ? 700 : 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: filter === f ? '#000' : (beyondActive ? 'rgba(180,77,255,0.5)' : 'rgba(255,255,255,0.35)'),
                  background: filter === f ? activeColor : (beyondActive ? 'rgba(180,77,255,0.06)' : 'rgba(255,255,255,0.03)'),
                  border: `1px solid ${filter === f ? activeColor : (beyondActive ? 'rgba(180,77,255,0.15)' : 'rgba(255,255,255,0.06)')}`,
                  cursor: 'pointer',
                }}
              >
                {f === 'all' ? `All (${visibleCards.length})` :
                 f === 'owned' ? `Owned (${stats.owned})` :
                 f === 'beyond' ? `🔮 Beyond (${beyondCount})` :
                 `Missing (${stats.total - stats.owned})`}
              </button>
            );
          })}

          {/* Sort */}
          <select
            aria-label="Sort cards"
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            style={{
              padding: '5px 8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              color: 'rgba(255,255,255,0.5)',
              outline: 'none',
              cursor: 'pointer',
              textTransform: 'uppercase',
              marginLeft: 'auto',
            }}
          >
            <option value="day-asc" style={{ background: '#111' }}>Day ↑</option>
            <option value="day-desc" style={{ background: '#111' }}>Day ↓</option>
            <option value="rarity" style={{ background: '#111' }}>By Rarity</option>
          </select>
        </div>

        {/* Extended filters */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="max-w-6xl mx-auto"
              style={{ overflow: 'hidden', marginTop: '8px' }}
            >
              <div style={{
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                padding: '8px 0',
              }}>
                {(['common', 'uncommon', 'rare', 'legendary', 'mythic'] as Rarity[]).map(r => {
                  const rc = RARITY_CONFIG[r];
                  const count = allCards.filter(c => {
                    const owned = ownedDays.get(c.day);
                    return owned?.rarity === r;
                  }).length;
                  return (
                    <div key={r} style={{
                      padding: '4px 10px',
                      background: `${rc.color}10`,
                      border: `1px solid ${rc.color}30`,
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '9px',
                      color: rc.color,
                      textTransform: 'uppercase',
                    }}>
                      {r}: {count}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ═══ CARD GRID ═══ */}
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '12px',
        }}>
          {pagedCards.map(card => {
            const owned = ownedDays.get(card.day);
            const isOwned = !!owned;
            const isFuture = card.day > today;
            const isBeyondOwned = isFuture && isOwned;
            const sourceLabel = isBeyondOwned
              ? (owned.source.includes('targeted') ? '🎯' : '🔮')
              : null;
            const displayRarity = owned?.rarity || card.rarity;
            const rc = RARITY_CONFIG[displayRarity as Rarity] || RARITY_CONFIG.common;
            const isCurrentlyPlaying = currentTrack?.audioUrl === card.audioUrl && currentTrack?.day === card.day && isPlaying;
            const maxDuration = isDailyClaim ? 0 : (owned ? PREVIEW_DURATION[owned.rarity] : (PREVIEW_DURATION[card.rarity] ?? 15));
            const isFullSong = maxDuration === 0;

            return (
              <motion.div
                key={card.day}
                className="group"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePlay(card)}
                style={{
                  position: 'relative',
                  aspectRatio: '3 / 4',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isCurrentlyPlaying
                    ? `2px solid ${rc.color}`
                    : isBeyondOwned
                      ? `1px solid rgba(180,77,255,0.4)`
                      : `1px solid ${isOwned ? `${rc.color}30` : 'rgba(255,255,255,0.04)'}`,
                  boxShadow: isCurrentlyPlaying
                    ? `0 0 20px ${rc.color}40, inset 0 0 20px ${rc.color}10`
                    : isBeyondOwned
                      ? `0 0 18px rgba(180,77,255,0.25), inset 0 0 12px rgba(180,77,255,0.08)`
                      : isOwned ? `0 4px 12px rgba(0,0,0,0.3)` : 'none',
                  opacity: isOwned ? 1 : 0.4,
                  filter: isOwned ? 'none' : 'grayscale(0.7) brightness(0.7)',
                  transition: 'all 0.25s ease',
                }}
              >
                {/* Cover art */}
                <img
                  src={card.coverUrl}
                  alt={card.title}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {/* Gradient overlay */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.85) 100%)',
                }} />

                {/* Day badge */}
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  padding: '2px 6px',
                  background: isBeyondOwned ? 'rgba(180,77,255,0.25)' : 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(4px)',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: isBeyondOwned ? '#d4a0ff' : 'rgba(255,255,255,0.6)',
                  letterSpacing: '0.05em',
                  border: isBeyondOwned ? '1px solid rgba(180,77,255,0.3)' : 'none',
                }}>
                  {sourceLabel ? `${sourceLabel} ` : ''}#{String(card.day).padStart(3, '0')}
                </div>

                {/* Ownership / lock badge */}
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                }}>
                  {isOwned ? (
                    <CheckCircle size={14} style={{ color: rc.color, filter: `drop-shadow(0 0 4px ${rc.color}80)` }} />
                  ) : (
                    <Lock size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  )}
                </div>

                {/* Playing indicator */}
                {isCurrentlyPlaying && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}>
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: `${rc.color}cc`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 0 20px ${rc.color}80`,
                      }}
                    >
                      <Pause size={18} style={{ color: '#000' }} />
                    </motion.div>
                  </div>
                )}

                {/* Bottom info */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '8px',
                }}>
                  <div style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.02em',
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                  }}>
                    {card.title}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '3px',
                  }}>
                    {isOwned ? (
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '8px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: rc.color,
                        letterSpacing: '0.05em',
                      }}>
                        {displayRarity}
                      </span>
                    ) : (
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '8px',
                        color: 'rgba(255,255,255,0.2)',
                        textTransform: 'uppercase',
                      }}>
                        Not owned
                      </span>
                    )}
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: isCurrentlyPlaying ? rc.color : 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isCurrentlyPlaying ? (
                        <Pause size={7} style={{ color: '#000' }} />
                      ) : (
                        <Play size={7} style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '1px' }} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Rarity accent line */}
                {isOwned && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: isBeyondOwned ? '3px' : '2px',
                    background: isBeyondOwned
                      ? 'linear-gradient(90deg, #b44dff, #7c3aed, #b44dff)'
                      : `linear-gradient(90deg, ${rc.color}, ${rc.color}60)`,
                    boxShadow: isBeyondOwned
                      ? '0 0 10px rgba(180,77,255,0.5)'
                      : `0 0 6px ${rc.color}40`,
                  }} />
                )}

                {/* Hover Play Menu for Owned Cards */}
                {isOwned && (
                  <div 
                    className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 z-30 p-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlay(card);
                      }}
                      className="w-full py-2 rounded bg-white text-black text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-1.5"
                    >
                      {isCurrentlyPlaying ? <Pause size={10} /> : <Play size={10} />}
                      {isCurrentlyPlaying ? 'Pause' : 'Play Audio'}
                    </button>
                    {isFullSong && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          stop();
                          setLocation(`/play/card-${card.day}`);
                        }}
                        className="w-full py-2 rounded bg-[rgba(0,240,255,0.15)] border border-neon-cyan text-neon-cyan text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-[rgba(0,240,255,0.25)] hover:scale-105 active:scale-95 text-center"
                        style={{
                          borderColor: 'var(--color-neon-cyan, #00f0ff)',
                          color: 'var(--color-neon-cyan, #00f0ff)',
                        }}
                      >
                        PLAY PIM
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredCards.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
          }}>
            <Music size={32} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
            <p style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.25)',
            }}>
              No cards match your filters.
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '32px',
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
                background: page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,56,0,0.1)',
                border: `1px solid ${page === 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255,56,0,0.3)'}`,
                color: page === 1 ? 'rgba(255,255,255,0.15)' : '#ff3800',
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
                background: page === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,56,0,0.1)',
                border: `1px solid ${page === totalPages ? 'rgba(255,255,255,0.04)' : 'rgba(255,56,0,0.3)'}`,
                color: page === totalPages ? 'rgba(255,255,255,0.15)' : '#ff3800',
                cursor: page === totalPages ? 'default' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
