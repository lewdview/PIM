import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, Lock, CheckCircle, Check, Filter, Play, Pause, Search, Sparkles, 
  X, Eye, Flame, Disc, Layers, Download, Maximize2, ChevronLeft, ChevronRight, ExternalLink, Loader2 
} from 'lucide-react';
import PrizeRibbonSvg from '../components/ui/PrizeRibbonSvg';
import { useLocation } from 'wouter';
import { fetchAllCards, type VaultCard, type OwnedCard } from '../services/vaultService';
import { useVaultStore } from '../store/useVaultStore';
import { useGlobalPlayer } from '../store/useGlobalPlayer';
import { RARITY_CONFIG, type Rarity } from '../utils/rarity';
import { getCoverUrlForRarity, useSmartCoverArt } from '../utils/rarityArtwork';
import { getCurrentDay } from '../utils/dayCalc';
import {
  getBombshellDayCovers,
  getBombshellCoverUrl,
  getBombshellHiResPngUrl,
  downloadBombshellHiResArtwork,
  getBombshellUnlockedCoversForDay,
  getBombshellCollectionStats,
  isBombshellCard,
  getCustomBombshellCover,
  setCustomBombshellCover,
  getActiveBombshellCover,
  type BombshellDayCovers
} from '../utils/bombshellCards';

// Duration limits for non-owned cards (preview only)
const PREVIEW_DURATION: Record<string, number> = {
  common: 15,
  uncommon: 60,
  rare: 0,
  legendary: 0,
  mythic: 0,
};

// Check if all 5 vault gift packs (Free, Taste, Special Picks, Alpha, Prophecy) have been claimed
export function checkHasClaimedAllPrizes(
  day: number,
  cardId?: string,
  claimedRewards: Record<string, any> = {}
): boolean {
  const cardKey = `card-${day}`;
  const dayPadKey = `day-${String(day).padStart(3, '0')}`;
  const dayKey = `day-${day}`;
  const rawKey = String(day);
  const keys = [cardKey, dayPadKey, dayKey, rawKey, ...(cardId ? [cardId] : [])];

  for (const k of keys) {
    if (claimedRewards[k]?.includes('prophecy') || (Array.isArray(claimedRewards[k]) && claimedRewards[k].length >= 5)) {
      return true;
    }
    if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem(`reward_tier_${k}`);
      if (local === 'prophecy') return true;
    }
  }
  return false;
}

type DeckTab = 'gen-0' | 'bombshell';
type FilterMode = 'all' | 'owned' | 'missing' | 'beyond' | 'mastered';
type SortMode = 'day-asc' | 'day-desc' | 'rarity' | 'covers-unlocked';

const PAGE_SIZE = 30;

// ── GEN-0 GRID CARD ITEM ───────────────────────────────────────────────────
interface CodexGridCardItemProps {
  card: VaultCard;
  owned?: any;
  isFuture: boolean;
  today: number;
  useAltArtwork: boolean;
  currentTrack: any;
  isPlaying: boolean;
  claimedRewards: Record<string, any>;
  handlePlay: (card: VaultCard) => void;
  getFragmentsForDay: (day: number) => number;
  stop: () => void;
  setLocation: (url: string) => void;
}

function CodexGridCardItem({
  card,
  owned,
  isFuture,
  today,
  useAltArtwork,
  currentTrack,
  isPlaying,
  claimedRewards,
  handlePlay,
  getFragmentsForDay,
  stop,
  setLocation,
}: CodexGridCardItemProps) {
  const isOwned = !!owned;
  const isBeyondOwned = isFuture && isOwned;
  const sourceLabel = isBeyondOwned
    ? (owned.source.includes('targeted') ? '🎯' : '🔮')
    : null;
  const displayRarity = owned?.rarity || card.rarity;
  const rc = RARITY_CONFIG[displayRarity as Rarity] || RARITY_CONFIG.common;

  const { src: displayCoverUrl, handleError: handleCodexImgError } = useSmartCoverArt(
    card.coverUrl,
    useAltArtwork ? displayRarity : 'common'
  );
  const hasAltArtActive = useAltArtwork && displayCoverUrl !== card.coverUrl;

  const isCurrentlyPlaying = currentTrack?.audioUrl === card.audioUrl && currentTrack?.day === card.day && isPlaying;
  const isDailyClaim = owned?.source === 'daily_claim';
  const maxDuration = isDailyClaim ? 0 : (owned ? PREVIEW_DURATION[owned.rarity] : (PREVIEW_DURATION[card.rarity] ?? 15));
  const isFullSong = maxDuration === 0;
  const hasClaimedAll = checkHasClaimedAllPrizes(card.day, (card as any).id, claimedRewards);

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
        transition: 'all 0.25s ease',
      }}
    >
      {/* Cover art */}
      <img
        src={displayCoverUrl}
        alt={card.title}
        loading="lazy"
        onError={handleCodexImgError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isOwned ? 1 : 0.4,
          filter: isOwned ? 'none' : 'grayscale(0.7) brightness(0.7)',
          transition: 'all 0.25s ease',
        }}
      />

      {/* Alt Art Badge */}
      {hasAltArtActive && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          right: '6px',
          padding: '2px 5px',
          background: 'rgba(255,215,0,0.25)',
          border: '1px solid rgba(255,215,0,0.6)',
          backdropFilter: 'blur(4px)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '8px',
          fontWeight: 800,
          color: '#ffd700',
          borderRadius: '3px',
          zIndex: 40,
          pointerEvents: 'none',
        }}>
          ✨ ALT ART
        </div>
      )}

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
        zIndex: 40,
        pointerEvents: 'none',
      }}>
        {sourceLabel ? `${sourceLabel} ` : ''}#{String(card.day).padStart(3, '0')}
      </div>

      {/* Ownership / lock badge & 5/5 gifts medal */}
      <div 
        className="transition-all duration-200 group-hover:scale-125 group-hover:brightness-125"
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          zIndex: 40,
        }}
      >
        {hasClaimedAll && (
          <div title="5/5 Vault Gifts Obtained (Prophecy Tier)">
            <PrizeRibbonSvg size={15} isClaimed={true} tier="prophecy" style={{ filter: 'drop-shadow(0 0 6px rgba(255,115,0,0.7))' }} />
          </div>
        )}
        {isOwned ? (
          <CheckCircle size={14} style={{ color: rc.color, filter: `drop-shadow(0 0 4px ${rc.color}80)` }} />
        ) : (
          <Lock size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
        )}
      </div>

      {/* Playing indicator */}
      {isCurrentlyPlaying && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 40,
          pointerEvents: 'none',
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
        opacity: isOwned ? 1 : 0.6,
        transition: 'all 0.25s ease',
        zIndex: 40,
        pointerEvents: 'none',
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
        {/* Shard & Gifts Progress Bar */}
        {(() => {
          const fragCount = getFragmentsForDay(card.day);
          return (
            <div style={{ marginTop: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '7px', fontFamily: '"JetBrains Mono", monospace', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Shards</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {hasClaimedAll && (
                    <span title="5/5 Vault Gifts Obtained" style={{ color: '#f97316', fontWeight: 800, letterSpacing: '0.02em' }}>
                      5/5 🎁
                    </span>
                  )}
                  <span style={{ color: isOwned ? '#39FF14' : fragCount > 0 ? '#ffd700' : 'rgba(255,255,255,0.2)', fontWeight: 'bold' }}>
                    {isOwned ? 'Unlocked' : `${fragCount} / 10`}
                  </span>
                </div>
              </div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                <div
                  style={{
                    height: '100%',
                    background: isOwned ? '#39FF14' : '#ffd700',
                    width: isOwned ? '100%' : `${Math.min(10, fragCount) * 10}%`,
                    boxShadow: isOwned ? '0 0 6px rgba(57,255,20,0.6)' : fragCount > 0 ? '0 0 6px rgba(255,215,0,0.6)' : 'none',
                  }}
                />
              </div>
            </div>
          );
        })()}
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
          zIndex: 40,
          pointerEvents: 'none',
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
                const cover = card.coverUrl;
                sessionStorage.setItem(`active_cover_url_card-${card.day}`, cover);
                sessionStorage.setItem('active_game_cover', cover);
                stop();
                setLocation(`/play/card-${card.day}`);
              }}
              className="w-full py-2 rounded bg-[rgba(0,240,255,0.15)] border border-neon-cyan text-neon-cyan text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-[rgba(0,240,255,0.25)] hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-1"
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
}

// ── BOMBSHELL GRID CARD ITEM ───────────────────────────────────────────────
interface BombshellGridCardItemProps {
  card: VaultCard;
  dayCovers: BombshellDayCovers;
  unlockedCovers: Set<string>;
  latestUnlockedCard?: OwnedCard;
  currentTrack: any;
  isPlaying: boolean;
  onInspectCovers: (day: number) => void;
  handlePlay: (card: VaultCard) => void;
  stop: () => void;
  setLocation: (url: string) => void;
}

function BombshellGridCardItem({
  card,
  dayCovers,
  unlockedCovers,
  latestUnlockedCard,
  currentTrack,
  isPlaying,
  onInspectCovers,
  handlePlay,
  stop,
  setLocation,
}: BombshellGridCardItemProps) {
  const totalCovers = dayCovers.totalCovers;
  const unlockedCount = unlockedCovers.size;
  const isUnlocked = unlockedCount > 0;
  const isMastered = totalCovers > 0 && unlockedCount >= totalCovers;
  const percentUnlocked = totalCovers > 0 ? Math.round((unlockedCount / totalCovers) * 100) : 0;

  // Determine cover image to display (honoring custom preference, owned card, or fallback)
  const activeCover = getActiveBombshellCover(card.day, unlockedCovers, latestUnlockedCard);
  const coverUrl = activeCover.coverUrl;
  const isLB = activeCover.isLB;
  const isCurrentlyPlaying = currentTrack?.audioUrl === card.audioUrl && currentTrack?.day === card.day && isPlaying;

  const displayRarity = latestUnlockedCard?.card?.rarity || (isUnlocked ? 'rare' : 'common');
  const rc = RARITY_CONFIG[displayRarity as Rarity] || RARITY_CONFIG.common;

  return (
    <motion.div
      key={`bombshell-${card.day}`}
      className="group"
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onInspectCovers(card.day)}
      style={{
        position: 'relative',
        aspectRatio: '3 / 4',
        borderRadius: '6px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: isCurrentlyPlaying
          ? '2px solid #FF1493'
          : isMastered
            ? '1px solid rgba(255, 20, 147, 0.7)'
            : isUnlocked
              ? '1px solid rgba(255, 20, 147, 0.35)'
              : '1px solid rgba(255,255,255,0.05)',
        boxShadow: isCurrentlyPlaying
          ? '0 0 22px rgba(255, 20, 147, 0.5), inset 0 0 20px rgba(255, 20, 147, 0.15)'
          : isMastered
            ? '0 0 16px rgba(255, 20, 147, 0.3), inset 0 0 10px rgba(255, 20, 147, 0.08)'
            : isUnlocked ? '0 4px 14px rgba(0,0,0,0.4)' : 'none',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Cover Image */}
      <img
        src={coverUrl}
        alt={card.title}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isUnlocked ? 1 : 0.35,
          filter: isUnlocked ? 'none' : 'grayscale(0.85) brightness(0.65)',
          transition: 'all 0.25s ease',
        }}
      />

      {/* Gradient Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(20,4,14,0.4) 50%, rgba(10,2,7,0.92) 100%)',
      }} />

      {/* Day & Set Badge */}
      <div style={{
        position: 'absolute',
        top: '6px',
        left: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        zIndex: 40,
        pointerEvents: 'none',
      }}>
        <div style={{
          padding: '2px 6px',
          background: isUnlocked ? 'rgba(255, 20, 147, 0.3)' : 'rgba(0,0,0,0.7)',
          border: isUnlocked ? '1px solid rgba(255, 20, 147, 0.5)' : '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(4px)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '9px',
          fontWeight: 700,
          color: isUnlocked ? '#ff69b4' : 'rgba(255,255,255,0.5)',
          letterSpacing: '0.05em',
        }}>
          #{String(card.day).padStart(3, '0')}
        </div>
        <div style={{
          padding: '2px 4px',
          background: 'rgba(0,0,0,0.6)',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '7.5px',
          fontWeight: 800,
          color: '#FF1493',
          letterSpacing: '0.05em',
          border: '1px solid rgba(255, 20, 147, 0.25)',
        }}>
          BOMBSHELL
        </div>
        {isLB && (
          <div style={{
            padding: '2px 4px',
            background: 'rgba(0, 229, 255, 0.25)',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '7.5px',
            fontWeight: 800,
            color: '#00E5FF',
            letterSpacing: '0.05em',
            border: '1px solid rgba(0, 229, 255, 0.4)',
            backdropFilter: 'blur(4px)',
          }}>
            LB
          </div>
        )}
      </div>

      {/* Mastered / Unlocked Status Badge */}
      <div style={{
        position: 'absolute',
        top: '6px',
        right: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        zIndex: 40,
      }}>
        {isMastered ? (
          <div title="All covers unlocked for this day!" style={{
            padding: '2px 5px',
            background: 'rgba(255, 20, 147, 0.25)',
            border: '1px solid #FF1493',
            color: '#FF1493',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '8px',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}>
            <Sparkles size={9} /> 100%
          </div>
        ) : isUnlocked ? (
          <CheckCircle size={14} style={{ color: '#FF1493', filter: 'drop-shadow(0 0 4px rgba(255,20,147,0.8))' }} />
        ) : (
          <Lock size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
        )}
      </div>

      {/* Playing indicator */}
      {isCurrentlyPlaying && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 40,
          pointerEvents: 'none',
        }}>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 20, 147, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(255, 20, 147, 0.8)',
            }}
          >
            <Pause size={18} style={{ color: '#fff' }} />
          </motion.div>
        </div>
      )}

      {/* Bottom Info: Title, Unlock Count & Progress */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px',
        opacity: isUnlocked ? 1 : 0.7,
        transition: 'all 0.25s ease',
        zIndex: 40,
        pointerEvents: 'none',
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

        {/* Cover Unlock Tracker */}
        <div style={{ marginTop: '5px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '8px',
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>Covers</span>
            <span style={{
              color: isMastered ? '#FF1493' : isUnlocked ? '#ff85c0' : 'rgba(255,255,255,0.3)',
              fontWeight: 800,
            }}>
              {unlockedCount} / {totalCovers} UNLOCKED
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{
            height: '4px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '3px',
          }}>
            <div
              style={{
                height: '100%',
                background: isMastered
                  ? 'linear-gradient(90deg, #FF1493, #ff85c0)'
                  : isUnlocked
                    ? 'linear-gradient(90deg, #b00b60, #FF1493)'
                    : 'rgba(255,255,255,0.1)',
                width: `${percentUnlocked}%`,
                boxShadow: isUnlocked ? '0 0 8px rgba(255,20,147,0.7)' : 'none',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Bombshell Pink Accent Line */}
      {isUnlocked && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: isMastered ? '3px' : '2px',
          background: 'linear-gradient(90deg, #FF1493, #ff69b4, #FF1493)',
          boxShadow: '0 0 8px rgba(255, 20, 147, 0.6)',
          zIndex: 40,
          pointerEvents: 'none',
        }} />
      )}

      {/* Hover Action Overlay */}
      <div 
        className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 z-30 p-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInspectCovers(card.day);
          }}
          className="w-full py-2 rounded bg-[#FF1493] text-white text-[10px] font-mono font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(255,20,147,0.5)]"
        >
          <Layers size={11} /> Inspect Covers ({unlockedCount}/{totalCovers})
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            sessionStorage.setItem(`active_cover_url_card-${card.day}`, coverUrl);
            sessionStorage.setItem('active_game_cover', coverUrl);
            stop();
            setLocation(`/play/card-${card.day}`);
          }}
          className="w-full py-1.5 rounded bg-[rgba(255,20,147,0.25)] border border-[#FF1493] text-[#ff85c0] text-[9.5px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-[rgba(255,20,147,0.4)] hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-1 shadow-[0_0_10px_rgba(255,20,147,0.3)] cursor-pointer"
        >
          PLAY PIM
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePlay({
              ...card,
              coverUrl,
              cardSet: 'bombshell',
            });
          }}
          className="w-full py-1.5 rounded bg-white/10 border border-white/20 text-white text-[9.5px] font-mono font-bold uppercase tracking-wider transition-all hover:bg-white/20 hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-1 cursor-pointer"
        >
          {isCurrentlyPlaying ? <Pause size={9} /> : <Play size={9} />}
          {isCurrentlyPlaying ? 'Pause Audio' : 'Play Audio'}
        </button>
      </div>
    </motion.div>
  );
}

// ── BOMBSHELL FULLSCREEN LIGHTBOX MODAL ──────────────────────────────────────
interface BombshellLightboxModalProps {
  day: number;
  card: VaultCard;
  covers: string[];
  initialIndex: number;
  unlockedCovers: Set<string>;
  collection: OwnedCard[];
  activeCoverName?: string;
  onSelectCover?: (fileName: string) => void;
  onClose: () => void;
  onPlayTrack: (card: VaultCard, coverUrl: string) => void;
}

function BombshellLightboxModal({
  day,
  card,
  covers,
  initialIndex,
  unlockedCovers,
  collection,
  activeCoverName,
  onSelectCover,
  onClose,
  onPlayTrack,
}: BombshellLightboxModalProps) {
  const [index, setIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const currentFileName = covers[index] || covers[0];
  const isUnlocked = unlockedCovers.has(currentFileName);
  const isLB = currentFileName.toLowerCase().startsWith('lb');
  const isActiveCover = activeCoverName === currentFileName;

  // Find owned card details for active filename
  const ownedMatch = collection.find(c => {
    if (!c || !c.card || c.card.day !== day) return false;
    const art = (c as any).coverArtwork || (c.card as any).coverArtwork;
    if (art === currentFileName) return true;
    const url = c.card.coverUrl || '';
    return url.includes(encodeURIComponent(currentFileName)) || url.includes(currentFileName);
  });

  const rarity = ownedMatch?.card?.rarity || (isLB ? 'common' : 'rare');
  const rc = RARITY_CONFIG[rarity as Rarity] || RARITY_CONFIG.common;

  const previewCoverUrl = getBombshellCoverUrl(day, currentFileName);
  const hiResPngUrl = getBombshellHiResPngUrl(day, currentFileName);
  const hiResPngFileName = currentFileName.replace(/\.jpe?g$/i, '.png');

  const handlePrev = useCallback(() => {
    setIndex((prev) => (prev > 0 ? prev - 1 : covers.length - 1));
  }, [covers.length]);

  const handleNext = useCallback(() => {
    setIndex((prev) => (prev < covers.length - 1 ? prev + 1 : 0));
  }, [covers.length]);

  // Keyboard navigation (Arrows + ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadBombshellHiResArtwork(day, currentFileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (e) {
      console.error('Hi-res download failed:', e);
      window.open(hiResPngUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-black/95 backdrop-blur-2xl p-4 md:p-6 select-none"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div 
        className="w-full max-w-6xl flex items-center justify-between z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 bg-[#FF1493]/20 border border-[#FF1493]/60 text-[#FF1493] text-[10px] font-mono font-bold uppercase tracking-wider">
            DAY #{String(day).padStart(3, '0')} • FULLSCREEN MASTER
          </span>
          <span className="text-white font-mono font-bold text-xs uppercase hidden sm:inline">
            {card.title}
          </span>
          <span className="px-2 py-0.5 rounded bg-white/10 text-white/70 font-mono text-[9px] uppercase">
            {index + 1} / {covers.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(hiResPngUrl, '_blank')}
            title="Open direct file in new browser window"
            className="p-2 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 transition-all flex items-center gap-1 text-[10px] font-mono cursor-pointer"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={onClose}
            title="Close Fullscreen View"
            className="p-2 rounded-full bg-white/10 hover:bg-[#FF1493] hover:text-white border border-white/20 text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Center Image Stage */}
      <div 
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev Button */}
        {covers.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-2 md:left-4 z-20 p-3 rounded-full bg-black/60 hover:bg-[#FF1493] hover:scale-110 text-white border border-white/20 transition-all shadow-[0_0_15px_rgba(0,0,0,0.8)] cursor-pointer"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Master Image Frame */}
        <div className={`relative max-h-[72vh] max-w-[85vw] aspect-[3/4] rounded-lg overflow-hidden border-2 shadow-[0_0_50px_rgba(255,20,147,0.35)] bg-black/90 ${
          isActiveCover ? 'border-emerald-500 ring-2 ring-emerald-400/50' : 'border-[#FF1493]/40'
        }`}>
          <img
            src={previewCoverUrl}
            alt={currentFileName}
            className={`w-full h-full object-contain ${isUnlocked ? '' : 'brightness-90'}`}
          />

          {isActiveCover && (
            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-emerald-500/90 text-black font-mono text-[10px] font-black uppercase tracking-wider rounded shadow-[0_0_15px_rgba(16,185,129,0.8)]">
              <Check size={12} strokeWidth={3} /> ACTIVE CARD COVER
            </div>
          )}

          {!isUnlocked && !isActiveCover && (
            <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-black/80 border border-white/20 rounded font-mono text-[10px] text-white/70">
              <Lock size={12} className="text-white/50" /> Locked Cover (Pull from Bombshell Pack)
            </div>
          )}
        </div>

        {/* Next Button */}
        {covers.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-2 md:right-4 z-20 p-3 rounded-full bg-black/60 hover:bg-[#FF1493] hover:scale-110 text-white border border-white/20 transition-all shadow-[0_0_15px_rgba(0,0,0,0.8)] cursor-pointer"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Bottom Command Bar */}
      <div 
        className="w-full max-w-4xl bg-[#0e0712] border border-[#FF1493]/40 rounded-xl p-4 shadow-[0_0_30px_rgba(255,20,147,0.25)] flex flex-col md:flex-row items-center justify-between gap-4 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
            <span className="text-[12px] font-mono font-black text-white">
              {hiResPngFileName}
            </span>
            <span 
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase"
              style={{
                background: isLB ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 20, 147, 0.2)',
                color: isLB ? '#00E5FF' : '#FF1493',
                border: isLB ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid rgba(255, 20, 147, 0.4)',
              }}
            >
              {isLB ? '✧ Letterbox (LB)' : '★ Full Frame (Standard)'}
            </span>
            {isActiveCover && (
              <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                <Check size={9} strokeWidth={3} /> ACTIVE
              </span>
            )}
          </div>
          <div className="text-[9px] font-mono text-white/50 uppercase">
            Vault Asset: rare_covers/day {day}/hi res/{hiResPngFileName}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-center flex-wrap">
          {onSelectCover && (
            <button
              onClick={() => onSelectCover(currentFileName)}
              className={`px-4 py-2.5 rounded font-mono text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                isActiveCover
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                  : 'bg-[#FF1493]/20 hover:bg-[#FF1493]/35 text-white border border-[#FF1493]/50 active:scale-95'
              }`}
            >
              {isActiveCover ? (
                <>
                  <CheckCircle size={13} className="text-emerald-300" /> ACTIVE CARD COVER
                </>
              ) : (
                <>
                  <Sparkles size={13} className="text-[#FF1493]" /> SET AS ACTIVE COVER
                </>
              )}
            </button>
          )}

          <button
            onClick={() => onPlayTrack(card, previewCoverUrl)}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-[10px] font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Play size={12} /> Play Audio
          </button>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-5 py-2.5 bg-gradient-to-r from-[#FF1493] to-[#ff4081] hover:from-[#ff2b9e] hover:to-[#ff5c97] text-white font-mono text-[10px] font-black uppercase tracking-wider rounded transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,20,147,0.5)] active:scale-95 cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> DOWNLOADING...
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle size={13} /> DOWNLOAD COMPLETE!
              </>
            ) : (
              <>
                <Download size={13} /> DOWNLOAD HI-RES PNG
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BOMBSHELL DAY COVERS GALLERY MODAL ─────────────────────────────────────
interface BombshellDayModalProps {
  day: number | null;
  card: VaultCard | null;
  dayCovers: BombshellDayCovers | null;
  unlockedCovers: Set<string>;
  collection: OwnedCard[];
  onClose: () => void;
  onPlayTrack: (card: VaultCard, coverUrl: string) => void;
}

function BombshellDayModal({
  day,
  card,
  dayCovers,
  unlockedCovers,
  collection,
  onClose,
  onPlayTrack,
}: BombshellDayModalProps) {
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const setPreferredCardCover = useVaultStore(s => s.setPreferredCardCover);

  if (!day || !card || !dayCovers) return null;

  const totalCovers = dayCovers.totalCovers;
  const unlockedCount = unlockedCovers.size;
  const percentUnlocked = totalCovers > 0 ? Math.round((unlockedCount / totalCovers) * 100) : 0;

  // Master list of all cover filenames for lightbox navigation
  const allDayCoverFiles = [...dayCovers.lbFiles, ...dayCovers.normalFiles];
  const activeCoverInfo = getActiveBombshellCover(day, unlockedCovers);
  const activeCoverName = activeCoverInfo.fileName;

  // Find owned card details for each unlocked filename
  const getCoverDetails = (fileName: string) => {
    const isUnlocked = unlockedCovers.has(fileName);
    const ownedMatch = collection.find(c => {
      if (!c || !c.card || c.card.day !== day) return false;
      const art = (c as any).coverArtwork || (c.card as any).coverArtwork;
      if (art === fileName) return true;
      const url = c.card.coverUrl || '';
      return url.includes(encodeURIComponent(fileName)) || url.includes(fileName);
    });

    return {
      isUnlocked,
      rarity: ownedMatch?.card?.rarity || 'common',
      claimedAt: ownedMatch?.claimedAt || null,
      source: ownedMatch?.source || 'Bombshell Pack',
    };
  };

  return (
    <>
      <AnimatePresence>
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl bg-[#0d0710] border border-[#FF1493]/40 rounded-lg p-6 shadow-[0_0_40px_rgba(255,20,147,0.25)] my-8"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10 pr-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-[#FF1493]/20 border border-[#FF1493]/50 text-[#FF1493] text-[10px] font-mono font-bold uppercase tracking-wider">
                    DAY #{String(day).padStart(3, '0')} BOMBSHELL GALLERY
                  </span>
                  <span className="text-[10px] font-mono text-white/40 uppercase">
                    {card.mood} Mood
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black font-['Impact'] uppercase tracking-tight text-white m-0">
                  {card.title}
                </h2>
                <p className="text-[10px] font-mono text-white/40 mt-1 uppercase">
                  Click any picture for Full-Screen Master View & Hi-Res Download, or choose your active card cover.
                </p>
              </div>

              {/* Stats Badge */}
              <div className="flex items-center gap-4 bg-black/60 border border-white/10 p-3 rounded">
                <div>
                  <div className="text-[9px] font-mono text-white/40 uppercase">Cover Progress</div>
                  <div className="text-xl font-mono font-black text-[#FF1493]">
                    {unlockedCount} / {totalCovers} <span className="text-xs text-white/50">({percentUnlocked}%)</span>
                  </div>
                </div>
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#FF1493] to-[#ff85c0] shadow-[0_0_8px_#FF1493]"
                    style={{ width: `${percentUnlocked}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Cover Category Sections */}
            <div className="space-y-8 mt-6">
              {/* 1. LB (Letterbox) Covers */}
              {dayCovers.lbFiles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono font-bold uppercase text-[#00E5FF] tracking-wider">
                      ✧ Letterbox (LB) Covers ({dayCovers.lbFiles.length})
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      — 16:9 / Letterboxed Art Variants
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {dayCovers.lbFiles.map((fileName, idx) => {
                      const { isUnlocked, rarity } = getCoverDetails(fileName);
                      const coverUrl = getBombshellCoverUrl(day, fileName);
                      const rc = RARITY_CONFIG[rarity as Rarity] || RARITY_CONFIG.common;
                      const globalIdx = idx;
                      const isActive = fileName === activeCoverName;

                      return (
                        <div
                          key={fileName}
                          onClick={() => setFullscreenIndex(globalIdx)}
                          className={`group relative rounded border overflow-hidden transition-all cursor-pointer hover:scale-105 ${
                            isActive
                              ? 'border-emerald-400 bg-black/70 shadow-[0_0_16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400'
                              : isUnlocked
                                ? 'border-[#00E5FF]/40 bg-black/60 shadow-[0_0_12px_rgba(0,229,255,0.15)] hover:border-[#00E5FF]'
                                : 'border-white/5 bg-black/40 opacity-50 hover:opacity-75'
                          }`}
                        >
                          <div className="aspect-[3/4] relative">
                            <img
                              src={coverUrl}
                              alt={fileName}
                              loading="lazy"
                              className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${isUnlocked ? '' : 'grayscale brightness-60'}`}
                            />
                            
                            {/* Active Badge */}
                            {isActive && (
                              <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-emerald-500 text-black font-mono text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.8)] z-10">
                                <Check size={9} strokeWidth={3} /> ACTIVE
                              </div>
                            )}

                            {/* Hover Fullscreen Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                              <span className="px-2 py-1 bg-black/80 border border-white/20 rounded text-[8.5px] font-mono text-white flex items-center gap-1">
                                <Maximize2 size={10} /> Fullscreen
                              </span>
                            </div>

                            {!isUnlocked && !isActive && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-2 text-center pointer-events-none">
                                <Lock size={16} className="text-white/40 mb-1" />
                                <span className="text-[8px] font-mono text-white/40 uppercase">Locked</span>
                              </div>
                            )}
                          </div>

                          <div className="p-2 border-t border-white/5 bg-black/80">
                            <div className="text-[9px] font-mono font-bold text-white truncate">
                              LB Variant #{idx + 1}
                            </div>
                            <div className="flex justify-between items-center mt-1.5 gap-1">
                              {isUnlocked ? (
                                <span className="text-[8px] font-mono font-bold uppercase shrink-0" style={{ color: rc.color }}>
                                  {rarity}
                                </span>
                              ) : (
                                <span className="text-[7.5px] font-mono text-white/30 uppercase truncate">Bombshell</span>
                              )}

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreferredCardCover(day, fileName);
                                  }}
                                  title="Set this cover as active artwork for this day's card"
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-all flex items-center gap-0.5 cursor-pointer ${
                                    isActive
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                      : 'bg-white/10 text-white/70 hover:bg-[#00E5FF]/30 hover:text-[#00E5FF] border border-white/10'
                                  }`}
                                >
                                  {isActive ? '✓ Active' : 'Use'}
                                </button>
                                {isUnlocked && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPlayTrack(card, coverUrl);
                                    }}
                                    className="p-1 rounded bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/40 text-[8px] font-mono flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Play size={8} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Normal Covers - Full Frame Tier */}
              {dayCovers.normalFiles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono font-bold uppercase text-[#FF1493] tracking-wider">
                      ★ Full Frame (Standard) Covers ({dayCovers.normalFiles.length})
                    </span>
                    <span className="text-[10px] font-mono text-white/40">
                      — Full-Frame Art Variants
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {dayCovers.normalFiles.map((fileName, idx) => {
                      const { isUnlocked, rarity } = getCoverDetails(fileName);
                      const coverUrl = getBombshellCoverUrl(day, fileName);
                      const rc = RARITY_CONFIG[rarity as Rarity] || RARITY_CONFIG.rare;
                      const globalIdx = dayCovers.lbFiles.length + idx;
                      const isActive = fileName === activeCoverName;

                      return (
                        <div
                          key={fileName}
                          onClick={() => setFullscreenIndex(globalIdx)}
                          className={`group relative rounded border overflow-hidden transition-all cursor-pointer hover:scale-105 ${
                            isActive
                              ? 'border-emerald-400 bg-black/70 shadow-[0_0_16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400'
                              : isUnlocked
                                ? 'border-[#FF1493]/50 bg-black/60 shadow-[0_0_14px_rgba(255,20,147,0.2)] hover:border-[#FF1493]'
                                : 'border-white/5 bg-black/40 opacity-50 hover:opacity-75'
                          }`}
                        >
                          <div className="aspect-[3/4] relative">
                            <img
                              src={coverUrl}
                              alt={fileName}
                              loading="lazy"
                              className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${isUnlocked ? '' : 'grayscale brightness-60'}`}
                            />

                            {/* Active Badge */}
                            {isActive && (
                              <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-emerald-500 text-black font-mono text-[8px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.8)] z-10">
                                <Check size={9} strokeWidth={3} /> ACTIVE
                              </div>
                            )}

                            {/* Hover Fullscreen Overlay */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                              <span className="px-2 py-1 bg-black/80 border border-white/20 rounded text-[8.5px] font-mono text-white flex items-center gap-1">
                                <Maximize2 size={10} /> Fullscreen
                              </span>
                            </div>

                            {!isUnlocked && !isActive && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-2 text-center pointer-events-none">
                                <Lock size={16} className="text-white/40 mb-1" />
                                <span className="text-[8px] font-mono text-white/40 uppercase">Locked</span>
                              </div>
                            )}
                          </div>

                          <div className="p-2 border-t border-white/5 bg-black/80">
                            <div className="text-[9px] font-mono font-bold text-white truncate">
                              Cover #{idx + 1}
                            </div>
                            <div className="flex justify-between items-center mt-1.5 gap-1">
                              {isUnlocked ? (
                                <span className="text-[8px] font-mono font-bold uppercase shrink-0" style={{ color: rc.color }}>
                                  {rarity}
                                </span>
                              ) : (
                                <span className="text-[7.5px] font-mono text-white/30 uppercase truncate">Bombshell</span>
                              )}

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreferredCardCover(day, fileName);
                                  }}
                                  title="Set this cover as active artwork for this day's card"
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-all flex items-center gap-0.5 cursor-pointer ${
                                    isActive
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                      : 'bg-white/10 text-white/70 hover:bg-[#FF1493]/30 hover:text-[#FF1493] border border-white/10'
                                  }`}
                                >
                                  {isActive ? '✓ Active' : 'Use'}
                                </button>
                                {isUnlocked && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPlayTrack(card, coverUrl);
                                    }}
                                    className="p-1 rounded bg-[#FF1493]/20 text-[#FF1493] hover:bg-[#FF1493]/40 text-[8px] font-mono flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Play size={8} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Interactive Fullscreen Master Lightbox */}
      {fullscreenIndex !== null && (
        <BombshellLightboxModal
          day={day}
          card={card}
          covers={allDayCoverFiles}
          initialIndex={fullscreenIndex}
          unlockedCovers={unlockedCovers}
          collection={collection}
          activeCoverName={activeCoverName}
          onSelectCover={(fName) => setPreferredCardCover(day, fName)}
          onClose={() => setFullscreenIndex(null)}
          onPlayTrack={onPlayTrack}
        />
      )}
    </>
  );
}

// ── MAIN CODEX PAGE ────────────────────────────────────────────────────────
export default function CodexPage() {
  const [, setLocation] = useLocation();
  const [activeDeck, setActiveDeck] = useState<DeckTab>('gen-0');
  const [allCards, setAllCards] = useState<VaultCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('day-asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedBombshellDay, setSelectedBombshellDay] = useState<number | null>(null);

  const [useAltArtwork, setUseAltArtwork] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('opt_useAltArtwork');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const collection = useVaultStore(s => s.collection);
  const claimedRewards = useVaultStore(s => s.claimedRewards);
  const fragments = useVaultStore(s => s.fragments);
  const { currentTrack, isPlaying, play, pause, stop } = useGlobalPlayer();

  const today = getCurrentDay();

  const getFragmentsForDay = useCallback((day: number) => {
    const cardKey = `card-${day}`;
    const dayKey = `day-${String(day).padStart(3, '0')}`;
    const dayKeyRaw = `day-${day}`;
    return (
      fragments[cardKey] ??
      fragments[dayKey] ??
      fragments[dayKeyRaw] ??
      0
    );
  }, [fragments]);

  // Owned Gen-0 card IDs for quick lookup
  const ownedDays = useMemo(() => {
    const map = new Map<number, { rarity: string; source: string }>();
    for (const c of collection) {
      if (isBombshellCard(c)) continue; // Gen-0 map only
      const existing = map.get(c.card.day);
      const rarityOrder = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
      if (!existing || rarityOrder.indexOf(c.card.rarity) > rarityOrder.indexOf(existing.rarity)) {
        map.set(c.card.day, { rarity: c.card.rarity, source: c.source });
      }
    }
    return map;
  }, [collection]);

  // Bombshell collection lookup per day: Set of unlocked files + latest owned card
  const bombshellDataByDay = useMemo(() => {
    const data = new Map<number, { unlockedCovers: Set<string>; latestCard?: OwnedCard }>();
    for (let d = 1; d <= 365; d++) {
      const unlocked = getBombshellUnlockedCoversForDay(collection, d);
      const ownedMatches = collection.filter(c => c && c.card && c.card.day === d && isBombshellCard(c));
      const latest = ownedMatches[ownedMatches.length - 1];
      data.set(d, { unlockedCovers: unlocked, latestCard: latest });
    }
    return data;
  }, [collection]);

  // Bombshell Global Stats
  const bombshellStats = useMemo(() => {
    return getBombshellCollectionStats(collection);
  }, [collection]);

  // Owned future days for quick lookup
  const ownedFutureDays = useMemo(() => {
    const s = new Set<number>();
    for (const c of collection) {
      if (c.card.day > today) s.add(c.card.day);
    }
    return s;
  }, [collection, today]);

  // Load cards
  useEffect(() => {
    fetchAllCards().then(cards => {
      setAllCards(cards);
      setLoading(false);
    });
  }, []);

  // Visible cards: past cards + owned future cards
  const visibleCards = useMemo(() => {
    return allCards.filter(c => c.day <= today || ownedFutureDays.has(c.day));
  }, [allCards, today, ownedFutureDays]);

  // Beyond count
  const beyondCount = useMemo(() => {
    return visibleCards.filter(c => c.day > today && ownedDays.has(c.day)).length;
  }, [visibleCards, today, ownedDays]);

  // Filtered + sorted cards for Active Deck
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

    if (activeDeck === 'gen-0') {
      // Gen-0 Filters
      if (filter === 'owned') {
        cards = cards.filter(c => ownedDays.has(c.day));
      } else if (filter === 'missing') {
        cards = cards.filter(c => !ownedDays.has(c.day) && c.day <= today);
      } else if (filter === 'beyond') {
        cards = cards.filter(c => c.day > today && ownedDays.has(c.day));
      }

      // Gen-0 Sort
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
    } else {
      // Bombshell Filters
      if (filter === 'owned') {
        cards = cards.filter(c => (bombshellDataByDay.get(c.day)?.unlockedCovers.size || 0) > 0);
      } else if (filter === 'missing') {
        cards = cards.filter(c => (bombshellDataByDay.get(c.day)?.unlockedCovers.size || 0) === 0);
      } else if (filter === 'mastered') {
        cards = cards.filter(c => {
          const dayCovers = getBombshellDayCovers(c.day);
          const unlocked = bombshellDataByDay.get(c.day)?.unlockedCovers.size || 0;
          return dayCovers.totalCovers > 0 && unlocked >= dayCovers.totalCovers;
        });
      }

      // Bombshell Sort
      if (sort === 'day-desc') {
        cards.sort((a, b) => b.day - a.day);
      } else if (sort === 'covers-unlocked') {
        cards.sort((a, b) => {
          const aCount = bombshellDataByDay.get(a.day)?.unlockedCovers.size || 0;
          const bCount = bombshellDataByDay.get(b.day)?.unlockedCovers.size || 0;
          return bCount - aCount;
        });
      } else {
        cards.sort((a, b) => a.day - b.day);
      }
    }

    return cards;
  }, [visibleCards, activeDeck, filter, sort, search, ownedDays, bombshellDataByDay, today]);

  // Pagination
  const totalPages = Math.ceil(filteredCards.length / PAGE_SIZE);
  const pagedCards = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredCards.slice(start, start + PAGE_SIZE);
  }, [filteredCards, page]);

  // Reset page on filter or deck change
  useEffect(() => { setPage(1); }, [activeDeck, filter, sort, search]);

  const gen0Stats = useMemo(() => {
    const pastTotal = allCards.filter(c => c.day <= today).length;
    let giftsAllClaimedCount = 0;
    for (const c of allCards) {
      if (checkHasClaimedAllPrizes(c.day, (c as any).id, claimedRewards)) {
        giftsAllClaimedCount++;
      }
    }
    return {
      total: pastTotal,
      owned: ownedDays.size,
      pct: pastTotal > 0 ? Math.round((ownedDays.size / pastTotal) * 100) : 0,
      giftsClaimed: giftsAllClaimedCount,
    };
  }, [allCards, ownedDays, today, claimedRewards]);

  const handlePlay = useCallback((card: VaultCard) => {
    const isBombshell = isBombshellCard(card);
    const owned = ownedDays.get(card.day);
    const isDailyClaim = owned?.source === 'daily_claim';
    const maxDuration = isDailyClaim ? 0 : (owned ? 0 : (PREVIEW_DURATION[card.rarity] ?? 15));
    const activeRarity = owned?.rarity || card.rarity;
    const resolvedCoverUrl = isBombshell
      ? card.coverUrl
      : (useAltArtwork ? getCoverUrlForRarity(card.coverUrl, activeRarity) : card.coverUrl);

    if (currentTrack?.audioUrl === card.audioUrl && currentTrack?.day === card.day) {
      if (isPlaying) {
        pause();
      } else {
        play({
          title: card.title,
          audioUrl: card.audioUrl,
          coverUrl: resolvedCoverUrl,
          day: card.day,
          rarity: activeRarity,
          isDailyClaim,
          maxDuration,
        });
      }
    } else {
      play({
        title: card.title,
        audioUrl: card.audioUrl,
        coverUrl: resolvedCoverUrl,
        day: card.day,
        rarity: activeRarity,
        isDailyClaim,
        maxDuration,
      });
    }
  }, [ownedDays, currentTrack, isPlaying, play, pause, useAltArtwork]);

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

  const selectedBombshellCard = selectedBombshellDay ? allCards.find(c => c.day === selectedBombshellDay) || null : null;
  const selectedDayCovers = selectedBombshellDay ? getBombshellDayCovers(selectedBombshellDay) : null;
  const selectedUnlockedCovers = selectedBombshellDay ? (bombshellDataByDay.get(selectedBombshellDay)?.unlockedCovers || new Set<string>()) : new Set<string>();

  return (
    <div className="flex-1 w-full min-h-screen">
      {/* ═══ HEADER ═══ */}
      <section style={{
        padding: '32px 16px 24px',
        background: activeDeck === 'bombshell'
          ? 'linear-gradient(180deg, rgba(255,20,147,0.08), transparent)'
          : 'linear-gradient(180deg, rgba(255,56,0,0.04), transparent)',
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

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 style={{
                fontFamily: '"Impact", "Arial Black", sans-serif',
                fontSize: 'clamp(36px, 8vw, 56px)',
                textTransform: 'uppercase',
                letterSpacing: '-0.02em',
                background: activeDeck === 'bombshell'
                  ? 'linear-gradient(135deg, #FF1493, #ff85c0)'
                  : 'linear-gradient(135deg, #ff3800, #ff9900)',
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
                {activeDeck === 'bombshell'
                  ? 'The Bombshell Series. Rotate and collect all 1,168 covers across 365 days.'
                  : 'Your complete card checklist. Track every drop, play every song.'}
              </p>
            </div>

            {/* ═══ DECK SWITCHER TABS ═══ */}
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '4px',
              background: '#0a0a0e',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
            }}>
              <button
                onClick={() => {
                  setActiveDeck('gen-0');
                  setFilter('all');
                }}
                style={{
                  padding: '10px 18px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  background: activeDeck === 'gen-0' ? '#ff3800' : 'transparent',
                  color: activeDeck === 'gen-0' ? '#000' : 'rgba(255,255,255,0.5)',
                  boxShadow: activeDeck === 'gen-0' ? '0 0 16px rgba(255,56,0,0.5)' : 'none',
                }}
              >
                01 // GEN-0 DECK ({gen0Stats.owned}/{gen0Stats.total})
              </button>

              <button
                onClick={() => {
                  setActiveDeck('bombshell');
                  setFilter('all');
                }}
                style={{
                  padding: '10px 18px',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  background: activeDeck === 'bombshell' ? '#FF1493' : 'transparent',
                  color: activeDeck === 'bombshell' ? '#fff' : 'rgba(255,255,255,0.5)',
                  boxShadow: activeDeck === 'bombshell' ? '0 0 16px rgba(255,20,147,0.6)' : 'none',
                }}
              >
                🔥 02 // BOMBSHELLS ({bombshellStats.totalUnlockedCovers}/{bombshellStats.totalAvailableCovers})
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginTop: '20px',
            flexWrap: 'wrap',
          }}>
            {activeDeck === 'gen-0' ? (
              <>
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
                    {gen0Stats.owned}<span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>/{gen0Stats.total}</span>
                  </div>
                </div>

                {/* 5/5 Gifts Mastered Pill */}
                <div style={{
                  padding: '8px 16px',
                  border: '2px solid #000',
                  background: '#0d0d0d',
                  boxShadow: '3px 3px 0 #000',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: 'rgba(255,255,255,0.3)',
                    }}>5/5 Gifts Claimed</div>
                    <div style={{
                      fontFamily: '"Impact", "Arial Black", sans-serif',
                      fontSize: '24px',
                      color: '#f97316',
                      letterSpacing: '-1px',
                      lineHeight: 1,
                    }}>
                      {gen0Stats.giftsClaimed}<span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>/{gen0Stats.total}</span>
                    </div>
                  </div>
                  <PrizeRibbonSvg size={22} isClaimed={gen0Stats.giftsClaimed > 0} tier="prophecy" style={{ filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.6))' }} />
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
                      width: `${gen0Stats.pct}%`,
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
                    {gen0Stats.pct}% COMPLETE
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Bombshell Stats */}
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
                  }}>Covers Unlocked</div>
                  <div style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '24px',
                    color: '#FF1493',
                    letterSpacing: '-1px',
                    lineHeight: 1,
                  }}>
                    {bombshellStats.totalUnlockedCovers}<span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>/{bombshellStats.totalAvailableCovers}</span>
                  </div>
                </div>

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
                  }}>Days Unlocked</div>
                  <div style={{
                    fontFamily: '"Impact", "Arial Black", sans-serif',
                    fontSize: '24px',
                    color: '#ff85c0',
                    letterSpacing: '-1px',
                    lineHeight: 1,
                  }}>
                    {bombshellStats.daysWithAtLeastOne}<span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>/365</span>
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
                      width: `${bombshellStats.percentComplete}%`,
                      background: 'linear-gradient(90deg, #b00b60, #FF1493, #ff85c0)',
                      boxShadow: '0 0 8px rgba(255,20,147,0.5)',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.3)',
                    marginTop: '4px',
                  }}>
                    {bombshellStats.percentComplete}% COVERS MASTERED
                  </div>
                </div>
              </>
            )}

            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px',
              padding: '4px 10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase',
              marginLeft: 'auto',
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

          {/* Filter toggle (for Gen-0) */}
          {activeDeck === 'gen-0' && (
            <>
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

              {/* ALT Artwork on/off toggle */}
              <button
                onClick={() => {
                  const next = !useAltArtwork;
                  setUseAltArtwork(next);
                  try {
                    localStorage.setItem('opt_useAltArtwork', String(next));
                  } catch {}
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: useAltArtwork ? 'rgba(255,56,0,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${useAltArtwork ? 'rgba(255,56,0,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: useAltArtwork ? '#ff3800' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  boxShadow: useAltArtwork ? '0 0 12px rgba(255,56,0,0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
                title="Toggle between standard common artwork and rarity-specific ALT artwork on Gen-0 cards"
              >
                <Sparkles size={11} className={useAltArtwork ? 'text-[#ff3800]' : 'text-white/40'} />
                ALT ART: <span style={{ color: useAltArtwork ? '#fff' : 'rgba(255,255,255,0.35)' }}>{useAltArtwork ? 'ON' : 'OFF'}</span>
              </button>
            </>
          )}

          {/* Quick filter pills */}
          {activeDeck === 'gen-0' ? (
            (['all', 'owned', 'missing', ...(beyondCount > 0 ? ['beyond'] : [])] as FilterMode[]).map(f => {
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
                   f === 'owned' ? `Owned (${gen0Stats.owned})` :
                   f === 'beyond' ? `🔮 Beyond (${beyondCount})` :
                   `Missing (${gen0Stats.total - gen0Stats.owned})`}
                </button>
              );
            })
          ) : (
            (['all', 'owned', 'missing', 'mastered'] as FilterMode[]).map(f => {
              const activeColor = '#FF1493';
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
                    color: filter === f ? '#fff' : 'rgba(255,255,255,0.4)',
                    background: filter === f ? activeColor : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${filter === f ? activeColor : 'rgba(255,255,255,0.06)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {f === 'all' ? `All (${visibleCards.length})` :
                   f === 'owned' ? `Unlocked (${bombshellStats.daysWithAtLeastOne})` :
                   f === 'mastered' ? 'Mastered 100%' :
                   `Missing (${visibleCards.length - bombshellStats.daysWithAtLeastOne})`}
                </button>
              );
            })
          )}

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
            {activeDeck === 'gen-0' ? (
              <option value="rarity" style={{ background: '#111' }}>By Rarity</option>
            ) : (
              <option value="covers-unlocked" style={{ background: '#111' }}>Covers Unlocked ↓</option>
            )}
          </select>
        </div>
      </section>

      {/* ═══ CARD GRID ═══ */}
      <section className="max-w-6xl mx-auto px-4 py-6">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '12px',
        }}>
          {activeDeck === 'gen-0' ? (
            pagedCards.map(card => (
              <CodexGridCardItem
                key={card.day}
                card={card}
                owned={ownedDays.get(card.day)}
                isFuture={card.day > today}
                today={today}
                useAltArtwork={useAltArtwork}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                claimedRewards={claimedRewards}
                handlePlay={handlePlay}
                getFragmentsForDay={getFragmentsForDay}
                stop={stop}
                setLocation={setLocation}
              />
            ))
          ) : (
            pagedCards.map(card => {
              const dayCovers = getBombshellDayCovers(card.day);
              const bData = bombshellDataByDay.get(card.day);
              const unlockedCovers = bData?.unlockedCovers || new Set<string>();

              return (
                <BombshellGridCardItem
                  key={`bombshell-${card.day}`}
                  card={card}
                  dayCovers={dayCovers}
                  unlockedCovers={unlockedCovers}
                  latestUnlockedCard={bData?.latestCard}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  onInspectCovers={(day) => setSelectedBombshellDay(day)}
                  handlePlay={handlePlay}
                  stop={stop}
                  setLocation={setLocation}
                />
              );
            })
          )}
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
                background: page === 1 ? 'rgba(255,255,255,0.02)' : (activeDeck === 'bombshell' ? 'rgba(255,20,147,0.15)' : 'rgba(255,56,0,0.1)'),
                border: `1px solid ${page === 1 ? 'rgba(255,255,255,0.04)' : (activeDeck === 'bombshell' ? 'rgba(255,20,147,0.4)' : 'rgba(255,56,0,0.3)')}`,
                color: page === 1 ? 'rgba(255,255,255,0.15)' : (activeDeck === 'bombshell' ? '#FF1493' : '#ff3800'),
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
                background: page === totalPages ? 'rgba(255,255,255,0.02)' : (activeDeck === 'bombshell' ? 'rgba(255,20,147,0.15)' : 'rgba(255,56,0,0.1)'),
                border: `1px solid ${page === totalPages ? 'rgba(255,255,255,0.04)' : (activeDeck === 'bombshell' ? 'rgba(255,20,147,0.4)' : 'rgba(255,56,0,0.3)')}`,
                color: page === totalPages ? 'rgba(255,255,255,0.15)' : (activeDeck === 'bombshell' ? '#FF1493' : '#ff3800'),
                cursor: page === totalPages ? 'default' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </section>

      {/* ═══ BOMBSHELL DAY COVERS GALLERY MODAL ═══ */}
      <BombshellDayModal
        day={selectedBombshellDay}
        card={selectedBombshellCard}
        dayCovers={selectedDayCovers}
        unlockedCovers={selectedUnlockedCovers}
        collection={collection}
        onClose={() => setSelectedBombshellDay(null)}
        onPlayTrack={(c, cUrl) => {
          handlePlay({
            ...c,
            coverUrl: cUrl,
            cardSet: 'bombshell',
          });
        }}
      />
    </div>
  );
}
