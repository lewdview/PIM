/**
 * useTrackDetail — everything the universal track/card detail view knows
 * about one day of the 365 archive, in one place.
 *
 * Song (catalog), vault card (card registry), the player's copies of that
 * day, their local stats, and the bombshell artwork state all come from here
 * so every entry point (collection, codex, daily drop, archive, campaign,
 * award play, search) shows the same thing.
 */
import { useEffect, useMemo, useState } from 'react';
import { getSongById, type GameSong } from '@/game/api';
import { getHighScore, getMedalForSong, getScoreHistory } from '@/game/progress';
import { getCardByDay, type OwnedCard, type VaultCard } from '../../services/vaultService';
import { useVaultStore, getHighestOwnedCard } from '../../store/useVaultStore';
import {
  getBombshellDayCovers,
  getBombshellUnlockedCoversForDay,
  getCustomBombshellCover,
} from '../../utils/bombshellCards';
import { getCurrentDay } from '../../utils/dayCalc';
import { RARITY_CONFIG, type Rarity } from '../../utils/rarity';

export const songIdForDay = (day: number) => `day-${String(day).padStart(3, '0')}`;

/** Pull the day out of any id the app uses: day-005, card-5, bombshell-5, 5. */
export function parseDayFromId(id: string | undefined | null): number | null {
  if (!id) return null;
  const m = String(id).match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const rarityRank = (r: string | undefined) => {
  const order: Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
  const i = order.indexOf(String(r || 'common').toLowerCase() as Rarity);
  return i < 0 ? 0 : i;
};

export function useTrackDetail(day: number, songIdHint?: string) {
  const [song, setSong] = useState<GameSong | null>(null);
  const [vaultCard, setVaultCard] = useState<VaultCard | null>(null);
  const [loading, setLoading] = useState(true);

  const collection = useVaultStore((s) => s.collection);
  const hasLoadedData = useVaultStore((s) => s.hasLoadedData);
  const loadVaultData = useVaultStore((s) => s.loadVaultData);
  // Re-read local stats whenever the store's copies change (a run just finished, etc.)
  const highScores = useVaultStore((s) => s.highScores);
  const medals = useVaultStore((s) => s.medals);
  const claimedRewards = useVaultStore((s) => s.claimedRewards);
  const progression = useVaultStore((s) => s.progression);

  useEffect(() => {
    if (!hasLoadedData && (!collection || collection.length === 0)) {
      loadVaultData().catch((err) => console.warn('[TrackDetail] vault load failed', err));
    }
  }, [hasLoadedData, collection, loadVaultData]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getSongById(songIdHint || songIdForDay(day)).catch(() => null),
      getCardByDay(day).catch(() => null),
    ]).then(([s, c]) => {
      if (!active) return;
      setSong(s);
      setVaultCard(c);
      setLoading(false);
    });
    return () => { active = false; };
  }, [day, songIdHint]);

  const songId = song?.id || songIdForDay(day);

  /** Every copy of this day the player owns, best first. */
  const ownedCopies = useMemo<OwnedCard[]>(() => {
    if (!Array.isArray(collection)) return [];
    return collection
      .filter((c) => c && (c.card?.day === day || c.cardId === `card-${day}`))
      .sort((a, b) => rarityRank(b.card?.rarity) - rarityRank(a.card?.rarity) || (a.edition || 9999) - (b.edition || 9999));
  }, [collection, day]);

  const bestOwned = useMemo(() => getHighestOwnedCard(collection, day), [collection, day]);
  const isOwned = ownedCopies.length > 0;

  const dayCovers = useMemo(() => getBombshellDayCovers(day), [day]);
  const unlockedCovers = useMemo(
    () => getBombshellUnlockedCoversForDay(Array.isArray(collection) ? collection : [], day),
    [collection, day],
  );

  // Scores are saved under the catalog id (day-005); prizes can sit under either
  // the catalog id or the route id the run started from (card-5).
  const aliasIds = useMemo(() => Array.from(new Set([songId, `card-${day}`, songIdForDay(day)])), [songId, day]);

  const stats = useMemo(() => {
    const medal = getMedalForSong(songId);
    const highScore = getHighScore(songId);
    const history = getScoreHistory(songId);
    const best = history.length > 0 ? Math.max(...history, highScore) : highScore;
    const rewardTiers = progression?.rewardTiers || {};
    const allPrizes = aliasIds.some(
      (id) => claimedRewards[id]?.includes('prophecy') || rewardTiers[id] === 'prophecy' || localStorage.getItem(`reward_tier_${id}`) === 'prophecy',
    );
    return { medal, highScore, history, best, isCleared: best > 0 || !!medal, allPrizes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, highScores, medals, claimedRewards, progression, aliasIds]);

  const preferredCover = getCustomBombshellCover(day);
  const today = getCurrentDay();

  return {
    day,
    today,
    isFuture: day > today,
    loading,
    song,
    songId,
    aliasIds,
    vaultCard,
    title: song?.title || vaultCard?.title || `Day ${day}`,
    artist: song?.artist || 'TH3SCR1B3',
    mood: (song?.mood || vaultCard?.mood || 'dark') as 'light' | 'dark',
    ownedCopies,
    bestOwned,
    isOwned,
    dayCovers,
    unlockedCovers,
    preferredCover,
    stats,
    rarityColor: RARITY_CONFIG[(bestOwned?.card.rarity || 'common') as Rarity]?.color || '#ffffff',
  };
}

export type TrackDetailData = ReturnType<typeof useTrackDetail>;
