import { getCurrentDay } from '../utils/dayCalc';
import {
  type Rarity, type ProofType, type UltraReward, type PackCategory, type PackSize,
} from '../utils/rarity';
import {
  getAdminConfig,
} from '../utils/adminConfig';
import { type BurnResult } from '../utils/echoSystem';
import { supabase } from './supabaseClient';
import dayFileMap from '../game/day_file_map.json';

// ===== TYPES =====
export interface VaultCard {
  id: string;
  day: number;
  title: string;
  storageTitle: string;
  mood: 'light' | 'dark';
  rarity: Rarity;
  energy: number;
  valence: number;
  tempo: number;
  genre: string[];
  tags: string[];
  coverUrl: string;
  holographicUrl?: string;
  audioUrl: string;
  description: string;
  claimedCount: number;
  maxSupply: number;
}

// Helper to resolve supabase / local paths based on day_file_map
function resolveUrls(r: Partial<ReleaseItem>): { audioUrl: string; coverUrl: string } {
  const useLocal = (typeof localStorage !== 'undefined' && (localStorage.getItem('opt_useLocalFiles') === 'true' || localStorage.getItem('useLocalFiles') === 'true')) || 
                   (import.meta.env && import.meta.env.VITE_USE_LOCAL_FILES === 'true');

  const dayNum = typeof r.day === 'string' ? parseInt(r.day, 10) : (r.day || 1);
  const dayStr = String(dayNum);
  const mapped = (dayFileMap as any)[dayStr];

  let audioUrl = r.storedAudioUrl || '';
  let coverUrl = r.coverArt || '';
  if (coverUrl) {
    coverUrl = coverUrl.replace(/\.png$/i, '.jpg');
  }

  const SUPABASE_BASE = 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/';
  const LOCAL_BASE = '/@fs/Volumes/extremeUno/th3scr1b3-365-warp/365-releases/';

  if (useLocal) {
    if (mapped && mapped.audio) {
      audioUrl = LOCAL_BASE + mapped.audio;
    } else {
      const raw = r as any;
      if (raw.manifestAudioPath) {
        audioUrl = LOCAL_BASE + decodeURIComponent(raw.manifestAudioPath);
      } else if (raw.fileName && raw.date) {
        const parts = raw.date.split('-');
        const monthNum = parseInt(parts[1], 10);
        const months = [
          'january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'
        ];
        const monthStr = months[monthNum - 1];
        audioUrl = LOCAL_BASE + `audio/${monthStr}/${decodeURIComponent(raw.fileName)}`;
      }
    }

    if (mapped && mapped.cover) {
      coverUrl = LOCAL_BASE + mapped.cover;
    } else {
      if (coverUrl && coverUrl.includes('/releaseready/')) {
        const parts = coverUrl.split('/releaseready/');
        if (parts.length > 1) {
          coverUrl = LOCAL_BASE + decodeURIComponent(parts[1]);
        }
      }
    }
  } else {
    // Online mode: Correct URLs using database-storage mappings
    if (mapped) {
      if (mapped.audio) {
        audioUrl = SUPABASE_BASE + encodeURIComponent(mapped.audio).replace(/%2F/g, '/');
      }
      if (mapped.cover) {
        // Use verified path from day_file_map (most reliable)
        coverUrl = SUPABASE_BASE + encodeURIComponent(mapped.cover).replace(/%2F/g, '/');
      }
      // If mapped.cover is null, fall through and keep coverUrl from DB/static JSON
      // (it gets .png→.jpg normalized above)
    }
  }

  return { audioUrl, coverUrl };
}

export function getSafeFallbackCard(cardId: string, rarity: Rarity): VaultCard {
  const dayMatch = cardId?.match(/(\d+)/);
  const dayNum = dayMatch ? parseInt(dayMatch[1], 10) : 1;
  const { audioUrl, coverUrl } = resolveUrls({
    day: dayNum,
    title: `Card ${cardId}`,
    storageTitle: `card-${cardId}`,
    mood: 'dark'
  });
  return {
    id: cardId || 'unknown-card',
    day: dayNum || 1,
    title: `Card ${cardId || 'Unknown'}`,
    storageTitle: `card-${cardId || 'unknown'}`,
    mood: 'dark',
    rarity: rarity || 'common',
    energy: 0.5,
    valence: 0.5,
    tempo: 120,
    genre: [],
    tags: [],
    coverUrl,
    audioUrl,
    description: `Fallback representation for card ${cardId}`,
    claimedCount: 0,
    maxSupply: 100,
  };
}

export function findCardWithFallback(pool: VaultCard[], cardId: string, rarity: Rarity): VaultCard {
  if (!pool || pool.length === 0) {
    return getSafeFallbackCard(cardId, rarity);
  }
  const found = pool.find(p => p.id === cardId);
  if (found) return found;
  if (pool[0]) return pool[0];
  return getSafeFallbackCard(cardId, rarity);
}


export interface OwnedCard {
  id: string;
  cardId: string;
  card: VaultCard;
  source: string;
  claimedAt: string;
  /** Special proof type if this pull was a proof */
  proof?: ProofType;
  /** Ultra hidden reward — revealed only on card back flip */
  ultraReward?: UltraReward;
  /** Blockchain tracking fields */
  blockchainStatus?: 'off-chain' | 'pending' | 'minted';
  mintHash?: string;
  fingerprint?: string;
  edition?: number;
  maxSupply?: number;
  /** Echo System fields */
  isEcho?: boolean;
  echoGeneration?: number;      // 0 = original, 1+ = echo
  echoSourceDay?: number;       // Day of the card that was burned to create this echo
}

/** Generate NFT-compatible metadata (OpenSea standard) */
export function generateCardMetadata(owned: OwnedCard) {
  const { card } = owned;
  const currentWorldDay = getCurrentDay();

  // 🔥 ORIGIN SYSTEM (NEW CORE)
  const isDailyDrop = owned.source === 'daily_claim';
  const releaseState = isDailyDrop ? "on_time" : "delayed";

  // 🔮 PROPHECY SUPPORT
  const timelineStatus = currentWorldDay >= card.day ? "resolved" : "pending";

  return {
    name: `th3scr1b3's 365 Days of Light and Dark - PIM : th3v4ult - Day ${String(card.day).padStart(3, '0')} : ${card.title}`,
    description: card.description || `TH3V4ULT Gen 0 Archive - Day ${card.day} of 365.`,
    image: card.coverUrl,
    animation_url: card.audioUrl,
    external_url: `https://vault.th3scr1b3.art/card/${owned.id}`,
    attributes: [
      { trait_type: 'Day', value: card.day, display_type: 'number' },
      { trait_type: 'Rarity', value: card.rarity },
      { trait_type: 'Mood', value: card.mood },
      { trait_type: 'Energy', value: Math.round(card.energy * 100), display_type: "boost_percentage" },
      { trait_type: 'Valence', value: Math.round(card.valence * 100), display_type: "boost_percentage" },
      { trait_type: 'Tempo', value: card.tempo, display_type: "number" },

      // Origin
      { trait_type: 'Origin', value: isDailyDrop ? "daily_drop" : "pack_rip" },
      { trait_type: 'Release State', value: releaseState },

      // Prophecy
      { trait_type: 'Timeline Status', value: timelineStatus },

      // Lifecycle
      { trait_type: 'Lifecycle', value: owned.isEcho ? 'echo' : 'original' },
      { trait_type: 'Echo Generation', value: owned.echoGeneration ?? 0, display_type: "number" },
      ...(owned.isEcho && owned.echoSourceDay ? [{ trait_type: 'Echo Source Day', value: owned.echoSourceDay, display_type: 'number' }] : []),

      // Source
      { trait_type: 'Source', value: owned.source },

      // Proof System
      { trait_type: 'Proof', value: owned.proof || 'none' },

      // Hidden Reward Flag
      { trait_type: 'Hidden Reward', value: owned.ultraReward ? owned.ultraReward.type : "none" },

      // Edition Tracking
      { trait_type: 'Edition', value: owned.edition || 1, display_type: "number" },
      { trait_type: 'Max Supply', value: owned.maxSupply || 50, display_type: "number" }
    ]
  };
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalCards: number;
  uniqueCards: number;
  rarityScore: number;
  rank: number;
}

// ===== RELEASE DATA TYPES (from th3scr1b3) =====
interface ReleaseItem {
  day: number | string;
  title: string;
  canonicalTitle?: string;
  storageTitle: string;
  mood: 'light' | 'dark';
  coverArt?: string;
  storedAudioUrl?: string;
  energy?: number | string;
  valence?: number | string;
  tempo?: number | string;
  genre?: string[] | string;
  tags?: string[] | string;
  description?: string;
}

interface ContentOverride {
  title?: string;
  info?: string;
}

// ===== CARD CACHE =====
let cardCache: VaultCard[] | null = null;

// Deterministic seeded RNG for consistent card traits
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Fetch all cards from release data (live th3scr1b3.art → local fallback → generated)
 */
export async function fetchAllCards(): Promise<VaultCard[]> {
  if (cardCache) return cardCache;

  try {
    const res = await fetch('/data/card_catalog.json');
    if (!res.ok) throw new Error('Failed to fetch card catalog');
    const catalog: any[] = await res.json();
    
    // Resolve URLs dynamically
    const cards: VaultCard[] = catalog.map(c => {
      const { audioUrl, coverUrl } = resolveUrls({
        day: c.day,
        title: c.title,
        storageTitle: c.storageTitle,
        mood: c.mood,
        coverArt: c.coverUrl,
        storedAudioUrl: c.audioUrl
      });
      return {
        ...c,
        audioUrl,
        coverUrl
      };
    });
    
    cardCache = cards;
    return cards;
  } catch (err) {
    console.error('[Vault] Failed to load card catalog:', err);
    return [];
  }
}

// ===== CARD QUERIES =====

export async function getCardByDay(day: number): Promise<VaultCard | null> {
  const all = await fetchAllCards();
  return all.find(c => c.day === day) || null;
}

/** Get only past cards (up to today) */
export async function getPastCards(): Promise<VaultCard[]> {
  const all = await fetchAllCards();
  const today = getCurrentDay();
  return all.filter(c => c.day <= today);
}

/** Get only future cards (after today) */
export async function getFutureCards(): Promise<VaultCard[]> {
  const all = await fetchAllCards();
  const today = getCurrentDay();
  return all.filter(c => c.day > today);
}

/** Get cards filtered by mood */
export async function getCardsByMood(mood: 'light' | 'dark'): Promise<VaultCard[]> {
  const past = await getPastCards();
  return past.filter(c => c.mood === mood);
}

/** Get cards for a specific month (1-indexed) */
export async function getCardsByMonth(month: number): Promise<VaultCard[]> {
  const past = await getPastCards();
  // Month 1 = Days 1-31, Month 2 = Days 32-59, etc.
  const monthStarts = [0, 1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 336];
  const monthEnds   = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 335, 365];
  const start = monthStarts[month] || 1;
  const end = monthEnds[month] || 31;
  return past.filter(c => c.day >= start && c.day <= end);
}

/** Get completed months (all days in the month have passed) */
export function getCompletedMonths(): number[] {
  const today = getCurrentDay();
  const monthEnds = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 335, 365];
  const completed: number[] = [];
  for (let i = 0; i < monthEnds.length; i++) {
    if (today >= monthEnds[i]) completed.push(i + 1);
  }
  return completed;
}

const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function getMonthName(month: number): string {
  return MONTH_NAMES[month] || `M${month}`;
}

/** Get unclaimed past day cards */
export async function getMissedCards(): Promise<VaultCard[]> {
  const past = await getPastCards();
  return past;
}

// ===== DAILY CLAIM =====

export async function hasClaimedToday(day: number): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return false;
  const { data: profile } = await supabase.from('profiles').select('last_claim_day').eq('id', data.user.id).single();
  return (profile?.last_claim_day || 0) >= day;
}

export async function hasClaimedFreePackToday(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return false;
    const { data: profile } = await supabase.from('profiles').select('last_free_pack_day').eq('id', data.user.id).single();
    const today = getCurrentDay();
    return (profile?.last_free_pack_day || 0) >= today;
  } catch { return false; }
}

export async function claimDailyCard(day: number): Promise<OwnedCard | null> {
  try {
    const { data: result, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'claimDailyDrop', payload: { day } }
    });
    if (error || !result?.success) return null;

    const pool = await fetchAllCards();
    const parent = findCardWithFallback(pool, result.card.card_id, result.card.rarity);

    return {
      id: crypto.randomUUID(),
      cardId: parent.id,
      card: { ...parent, rarity: result.card.rarity },
      source: 'daily_claim',
      claimedAt: new Date().toISOString(),
      edition: result.card.edition,
      maxSupply: result.card.max_supply,
      proof: result.card.proof,
      ultraReward: result.card.ultra_reward,
      blockchainStatus: result.card.blockchain_status,
      fingerprint: result.card.fingerprint
    };
  } catch {
    return null;
  }
}

// ===== PACK PURCHASE =====
export async function purchasePack(category: PackCategory, size: PackSize = 'single', sessionId?: string, txHash?: string, isGameplayReward?: boolean): Promise<OwnedCard[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data: result, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'purchasePack', payload: { packType: category, size, sessionId, txHash, isGameplayReward } },
    });

    if (error || !result?.success) {
      let detailedError = error?.message;
      if (error && typeof error === 'object' && 'context' in error) {
        try {
          const res = error.context as Response;
          if (res && res.json) {
            const body = await res.json();
            if (body && body.error) detailedError = body.error;
          }
        } catch (e) {
          console.error("Failed to parse edge function error response", e);
        }
      }

      const errMsg = detailedError || result?.error || 'Unknown Crash';
      console.error('================================================');
      console.error('🔥 SUPABASE EDGE FUNCTION ERROR 🔥');
      console.error(errMsg);
      console.error('================================================');
      alert(`Backend Error: ${errMsg}`);
      return [];
    }

    const rawCards = result.cards || [];
    const pool = await fetchAllCards();

    return rawCards.map((c: any) => {
      const parent = findCardWithFallback(pool, c.card_id, c.rarity);
      return {
        id: crypto.randomUUID(),
        cardId: parent.id,
        card: { ...parent, rarity: c.rarity },
        source: c.source,
        claimedAt: c.claimed_at,
        edition: c.edition,
        maxSupply: c.max_supply,
        isEcho: c.is_echo,
        echoGeneration: c.echo_generation,
        echoSourceDay: c.echo_source_day,
        proof: c.proof,
        ultraReward: c.ultra_reward,
        blockchainStatus: c.blockchain_status,
        fingerprint: c.fingerprint
      };
    });
  } catch (e) {
    console.error('Purchase error:', e);
    return [];
  }
}

async function extractDetailedError(error: any) {
  if (!error) return null;
  if (typeof error === 'object' && 'context' in error) {
    try {
      const res = error.context as Response;
      if (res && res.json) {
        const body = await res.json();
        if (body && body.error) return body.error;
      }
    } catch {}
  }
  return error.message;
}

// ===== TOKEN SYSTEM =====

export async function sellCard(ownedCard: OwnedCard): Promise<BurnResult> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: {
        action: 'burnCard',
        payload: {
          cardOwnedId: ownedCard.id,
          sourceTitle: ownedCard.card.title,
          sourceMood: ownedCard.card.mood,
          energy: ownedCard.card.energy,
          valence: ownedCard.card.valence,
          tempo: ownedCard.card.tempo
        }
      }
    });

    if (error || !data?.success) {
      console.error('Burn failed:', error?.message || data?.error);
      return { tokensEarned: 0, echoCreated: false };
    }

    return {
      tokensEarned: data.tokensEarned || 0,
      echoCreated: data.willEcho || false,
      echoGeneration: data.echoGen || undefined
    };
  } catch (e) {
    console.error('Burn error:', e);
    return { tokensEarned: 0, echoCreated: false };
  }
}

/** Batch burn multiple cards sequentially. Max 50 per batch. */
export async function sellCards(
  cards: OwnedCard[],
  onProgress?: (completed: number, total: number, result: BurnResult) => void
): Promise<{ results: BurnResult[]; totalTokens: number; totalEchoes: number; failed: number }> {
  const batch = cards.slice(0, 50); // Cap at 50
  const results: BurnResult[] = [];
  let totalTokens = 0;
  let totalEchoes = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const result = await sellCard(batch[i]);
    results.push(result);
    totalTokens += result.tokensEarned;
    if (result.echoCreated) totalEchoes++;
    if (result.tokensEarned === 0) failed++;
    onProgress?.(i + 1, batch.length, result);
  }

  return { results, totalTokens, totalEchoes, failed };
}

/** Buy a Vault Pack using tokens (cost from admin config) */
export async function buyTokenPack(): Promise<OwnedCard[] | 'insufficient'> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'purchasePack', payload: { packType: 'vault_token' } }
    });

    if (error || !data?.success) {
      const detailedError = await extractDetailedError(error) || data?.error;
      if (detailedError === 'Insufficient V⚡' || detailedError?.includes?.('Insufficient')) return 'insufficient';

      console.error('================================================');
      console.error('🔥 VAULT TOKEN PACK ERROR 🔥');
      console.error(detailedError || 'Unknown error');
      console.error('================================================');
      return [];
    }

    const rawCards = data.cards || [];
    const pool = await fetchAllCards();

    return rawCards.map((c: any) => {
      const parent = findCardWithFallback(pool, c.card_id, c.rarity);
      return {
        id: crypto.randomUUID(),
        cardId: parent.id,
        card: { ...parent, rarity: c.rarity },
        source: c.source || 'vault_token',
        claimedAt: c.claimed_at || new Date().toISOString(),
        edition: c.edition || 1,
        maxSupply: c.max_supply || 100,
        isEcho: c.is_echo,
        echoGeneration: c.echo_generation,
        echoSourceDay: c.echo_source_day,
        proof: c.proof,
        ultraReward: c.ultra_reward,
        blockchainStatus: c.blockchain_status,
        fingerprint: c.fingerprint
      };
    });
  } catch (e) {
    console.error('Purchase error:', e);
    return [];
  }
}

export function getTokenPackCost(): number {
  return getAdminConfig().tokenPackCost ?? 275;
}

// ===== V2 TOKEN SINKS =====

/** Targeted Pull — choose a specific day, costs 500 V⚡ */
export async function targetedPull(day: number): Promise<OwnedCard | null> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'targetedPull', payload: { day } }
    });
    if (error || !data?.success) {
      console.error('Targeted pull failed:', data?.error);
      if (data?.error) alert(`Error: ${data.error}`);
      return null;
    }
    const pool = await fetchAllCards();
    const parent = findCardWithFallback(pool, data.card.card_id, data.card.rarity);
    return {
      id: crypto.randomUUID(), cardId: parent.id,
      card: { ...parent, rarity: data.card.rarity },
      source: 'targeted_pull', claimedAt: data.card.claimed_at,
      edition: data.card.edition, maxSupply: data.card.max_supply,
      proof: data.card.proof,
      blockchainStatus: data.card.blockchain_status,
      fingerprint: data.card.fingerprint
    };
  } catch (e) { console.error('Targeted pull error:', e); return null; }
}

/** Rarity Upgrade — upgrade +1 tier, costs 150 V⚡ */
export async function upgradeRarity(cardOwnedId: string): Promise<{ success: boolean; oldRarity?: string; newRarity?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'rarityUpgrade', payload: { cardOwnedId } }
    });
    if (error || !data?.success) {
      if (data?.error) alert(`Error: ${data.error}`);
      return { success: false };
    }
    return { success: true, oldRarity: data.oldRarity, newRarity: data.newRarity };
  } catch (e) { console.error('Upgrade error:', e); return { success: false }; }
}

/** Duplicate Fusion — combine 3 identical cards into 1 upgraded */
export async function fuseDuplicates(cardIds: string[]): Promise<OwnedCard | null> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'duplicateFusion', payload: { cardIds } }
    });
    if (error || !data?.success) {
      if (data?.error) alert(`Error: ${data.error}`);
      return null;
    }
    const pool = await fetchAllCards();
    const parent = findCardWithFallback(pool, data.fusedCard.card_id, data.fusedCard.rarity);
    return {
      id: crypto.randomUUID(), cardId: parent.id,
      card: { ...parent, rarity: data.fusedCard.rarity },
      source: 'fusion', claimedAt: data.fusedCard.claimed_at,
      edition: data.fusedCard.edition, maxSupply: data.fusedCard.max_supply,
      blockchainStatus: data.fusedCard.blockchain_status,
      fingerprint: data.fusedCard.fingerprint
    };
  } catch (e) { console.error('Fusion error:', e); return null; }
}

/** Redeem an invite code (RC1) */
export async function redeemInviteCode(code: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'redeemInviteCode', payload: { code } }
    });
    return !error && data?.valid === true;
  } catch { return false; }
}

/** Redeem a bonus/promo code */
export async function redeemBonusCode(code: string): Promise<{ success: boolean; rewardType?: string; rewardValue?: string; result?: any; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'redeemBonusCode', payload: { code } }
    });
    if (error || !data?.success) {
      const detailedError = await extractDetailedError(error) || data?.error || 'Unknown validation failure';
      return { success: false, error: detailedError };
    }
    return { 
      success: true, 
      rewardType: data.rewardType, 
      rewardValue: data.rewardValue,
      result: data.result
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Unknown network error' };
  }
}

/** Get player debug stats (RC1) */
export async function getDebugStats(): Promise<any> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'getDebugStats', payload: {} }
    });
    if (error || !data?.success) return null;
    return data.stats;
  } catch { return null; }
}

/** Request NFT mint */
export async function requestNftMint(cardOwnedId: string): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'requestNftMint', payload: { cardOwnedId } }
    });
    if (error || !data?.success) return { success: false, error: data?.error || 'Unknown error' };
    return { success: true, txHash: data.txHash };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ===== DAILY PURCHASE LIMITS =====

export interface DailyLimits {
  day: number;
  standardCardsPulled: number;
  premiumCardsPulled: number;
}

export async function getClaimedCountForDay(day: number): Promise<number> {
  try {
    const { data } = await supabase
      .from('global_supply')
      .select('supply')
      .like('card_id_rarity', `${day}-%`);

    if (data) {
      return data.reduce((sum: number, row: any) => sum + (row.supply || 0), 0);
    }
  } catch (e) {
    console.error("Failed to fetch global supply", e);
  }
  return 0;
}

/** Fetch the claimed/minted count for a specific card day + rarity tier. */
export async function getClaimedCountForRarity(day: number, rarity: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('global_supply')
      .select('supply')
      .eq('card_id_rarity', `${day}-${rarity}`)
      .maybeSingle();
    return data?.supply || 0;
  } catch (e) {
    console.error('Failed to fetch rarity supply', e);
  }
  return 0;
}

export async function getPackRipCount(category: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('vault_collections')
      .select('*', { count: 'exact', head: true })
      .eq('source', `pack_${category}`);
    return count || 0;
  } catch (e) {
    console.error("Failed to fetch pack rip count", e);
  }
  return 0;
}
