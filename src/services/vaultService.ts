import { getCurrentDay } from '../utils/dayCalc';
import {
  type Rarity, type ProofType, type UltraReward, type PackCategory, type PackSize,
} from '../utils/rarity';
import { getCoverUrlForRarity } from '../utils/rarityArtwork';
import {
  getBombshellCoverUrl, pickBombshellArtwork, isBombshellCard,
} from '../utils/bombshellCards';
import {
  getAdminConfig,
} from '../utils/adminConfig';
import { type BurnResult } from '../utils/echoSystem';
import { supabase, STORAGE_BASE } from './supabaseClient';
import dayFileMap from '../game/day_file_map.json';
import { sanitizeMediaUrl } from '../game/api';
import { useVaultStore } from '../store/useVaultStore';

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
  cardSet?: 'gen-0' | 'bombshell';
  coverArtwork?: string;
}

// Helper to resolve supabase / local paths based on day_file_map
function resolveUrls(r: Partial<ReleaseItem>, rarity?: Rarity | string): { audioUrl: string; coverUrl: string } {
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

  const SUPABASE_BASE = STORAGE_BASE;
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

  // Apply custom artwork routing by rarity (e.g. rare -> alternate-covers/*.png)
  const effectiveRarity = rarity || (r as any).rarity;
  if (effectiveRarity) {
    coverUrl = getCoverUrlForRarity(coverUrl, effectiveRarity);
  }

  return { 
    audioUrl: sanitizeMediaUrl(audioUrl), 
    coverUrl: sanitizeMediaUrl(coverUrl) 
  };
}

export function getSafeFallbackCard(cardId: string, rarity: Rarity): VaultCard {
  const dayMatch = cardId?.match(/(\d+)/);
  const dayNum = dayMatch ? parseInt(dayMatch[1], 10) : 1;
  const { audioUrl, coverUrl } = resolveUrls({
    day: dayNum,
    title: `Card ${cardId}`,
    storageTitle: `card-${cardId}`,
    mood: 'dark'
  }, rarity);
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
    coverUrl: getCoverUrlForRarity(coverUrl, rarity),
    audioUrl,
    description: `Fallback representation for card ${cardId}`,
    claimedCount: 0,
    maxSupply: 100,
  };
}

export function findCardWithFallback(
  pool: VaultCard[], 
  cardId: string, 
  rarity?: Rarity | string,
  isBombshell?: boolean,
  coverArtwork?: string
): VaultCard {
  if (!pool || pool.length === 0) {
    return getSafeFallbackCard(cardId, (rarity as Rarity) || 'common');
  }

  const normalizedId = cardId.replace(/^bombshell-/, 'card-');
  let found = pool.find(p => p.id === cardId || p.id === normalizedId);
  if (!found) {
    const dayMatch = cardId?.match(/(\d+)/);
    if (dayMatch) {
      const dNum = parseInt(dayMatch[1], 10);
      found = pool.find(p => p.day === dNum);
    }
  }

  const targetRarity = ((rarity as Rarity) || (found ? found.rarity : 'common')) as Rarity;
  const baseCard = found || pool[0] || getSafeFallbackCard(cardId, targetRarity);

  const isBombshellEffective = isBombshell || 
    cardId.startsWith('bombshell-') || 
    Boolean(coverArtwork && (coverArtwork.startsWith('lb day') || coverArtwork.startsWith('day '))) ||
    Boolean(coverArtwork);

  if (isBombshellEffective) {
    let resolvedCoverUrl = '';
    let resolvedArtworkFile = coverArtwork || '';

    if (resolvedArtworkFile) {
      resolvedCoverUrl = getBombshellCoverUrl(baseCard.day, resolvedArtworkFile);
    } else {
      const picked = pickBombshellArtwork(baseCard.day, targetRarity);
      resolvedCoverUrl = picked.coverUrl;
      resolvedArtworkFile = picked.fileName;
    }

    return {
      ...baseCard,
      id: cardId.startsWith('bombshell-') ? cardId : `bombshell-${baseCard.day}`,
      rarity: targetRarity,
      cardSet: 'bombshell',
      coverArtwork: resolvedArtworkFile,
      coverUrl: resolvedCoverUrl,
    };
  }

  return {
    ...baseCard,
    rarity: targetRarity,
    cardSet: 'gen-0',
    coverUrl: getCoverUrlForRarity(baseCard.coverUrl, targetRarity),
  };
}


export interface OwnedCard {
  id: string;
  cardId: string;
  card: VaultCard;
  source: string;
  claimedAt: string;
  cardSet?: 'gen-0' | 'bombshell';
  coverArtwork?: string;
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

  const isBombshell = isBombshellCard(owned);
  const activeArtwork = owned.coverArtwork || card.coverArtwork || null;

  return {
    name: `th3scr1b3's 365 Days of Light and Dark - PIM : th3v4ult - Day ${String(card.day).padStart(3, '0')} : ${card.title}${isBombshell ? ' [BOMBSHELL]' : ''}`,
    description: card.description || `TH3V4ULT ${isBombshell ? 'Bombshell Collection' : 'Gen 0 Archive'} - Day ${card.day} of 365.`,
    image: card.coverUrl,
    animation_url: card.audioUrl,
    external_url: `https://vault.th3scr1b3.art/card/${owned.id}`,
    attributes: [
      { trait_type: 'Day', value: card.day, display_type: 'number' },
      { trait_type: 'Rarity', value: card.rarity },
      { trait_type: 'Mood', value: card.mood },
      { trait_type: 'Card Set', value: isBombshell ? 'Bombshell' : 'Gen-0' },
      ...(activeArtwork ? [{ trait_type: 'Cover Variant', value: activeArtwork }] : []),
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
        storedAudioUrl: c.audioUrl,
      }, c.rarity);
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
      id: result.card.id || crypto.randomUUID(),
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

// ===== SILENT GUEST DAILY CARD CLAIM (For Hero Funnel & Unauthenticated Users) =====
export async function silentClaimGuestDailyCard(day: number): Promise<OwnedCard | null> {
  try {
    // 1. Spun up / temp guest wallet address
    let guestAddress = localStorage.getItem('guest_wallet_address');
    const isNewGuest = !guestAddress;
    if (!guestAddress) {
      guestAddress = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('guest_wallet_address', guestAddress);
    }

    // Always check off tutorial and onboarding for guests playing today's drop / using temp wallet
    localStorage.setItem('pim_tutorial_completed', 'true');
    localStorage.setItem('has_onboarded', 'true');
    useVaultStore.getState().updateProgression({ tutorialCompleted: true }).catch(() => {});
    useVaultStore.getState().completeOnboarding().catch(() => {});

    const claimKey = `guest_daily_claimed_day_${day}`;
    const localCollection: OwnedCard[] = JSON.parse(localStorage.getItem('guest_vault_collection') || '[]');
    
    // Check if card for this day was already claimed or exists in guest collection
    const existing = localCollection.find(c => c && (c.cardId === `day_${day}` || (c.card && c.card.day === day) || c.id.includes(`day_${day}`)));
    if (existing || localStorage.getItem(claimKey) === 'true') {
      console.log(`[Silent Claim] Day ${day} card already owned in temp wallet (${guestAddress}). Skipping duplicate mint.`);
      return existing || null;
    }

    // 2. Fetch card pool metadata for Day level
    const pool = await fetchAllCards();
    const parent = findCardWithFallback(pool, `day_${day}`, 'common');

    const guestCard: OwnedCard = {
      id: `guest_card_day_${day}_${Date.now()}`,
      cardId: parent.id,
      card: { ...parent, rarity: 'common' },
      source: 'daily_claim',
      claimedAt: new Date().toISOString(),
      edition: 1,
      maxSupply: 100,
      proof: null,
      ultraReward: null,
      blockchainStatus: 'off-chain',
      fingerprint: `0xGUEST_${day}_${Date.now()}`
    };

    localCollection.push(guestCard);
    localStorage.setItem('guest_vault_collection', JSON.stringify(localCollection));
    localStorage.setItem(claimKey, 'true');

    console.log(`[Silent Claim] Successfully claimed Day ${day} card into temp guest wallet (${guestAddress}):`, parent.title);
    return guestCard;
  } catch (err) {
    console.warn(`[Silent Claim] Error claiming Day ${day} guest card:`, err);
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
      console.warn('[purchasePack] Edge Function returned error:', errMsg);
      return [];
    }

    if (typeof result?.remainingTokens === 'number') {
      try {
        localStorage.setItem('pim_token_balance', String(result.remainingTokens));
        const { useVaultStore } = await import('../store/useVaultStore');
        useVaultStore.setState({ tokenBalance: result.remainingTokens });
      } catch {}
    }

    const rawCards = result.cards || [];
    const pool = await fetchAllCards();

    return rawCards.map((c: any) => {
      const isBombshell = isBombshellCard(c) || (typeof category === 'string' && category.toLowerCase().includes('bombshell'));
      const coverArtwork = c.cover_artwork || c.coverArtwork || c.fingerprint || (c.proof && typeof c.proof === 'object' ? c.proof.cover_artwork : undefined);
      const parent = findCardWithFallback(pool, c.card_id, c.rarity, isBombshell, coverArtwork);
      const sanitizedProof = (typeof c.proof === 'string' && (c.proof === 'proof_of_first' || c.proof === 'proof_of_listen')) ? c.proof : null;

      return {
        id: c.id || crypto.randomUUID(),
        cardId: parent.id,
        card: { ...parent, rarity: c.rarity, cardSet: isBombshell ? 'bombshell' : 'gen-0' },
        source: c.source || `pack_${category}`,
        cardSet: isBombshell ? 'bombshell' : 'gen-0',
        coverArtwork: parent.coverArtwork,
        claimedAt: c.claimed_at || new Date().toISOString(),
        edition: c.edition,
        maxSupply: c.max_supply,
        isEcho: c.is_echo,
        echoGeneration: c.echo_generation,
        echoSourceDay: c.echo_source_day,
        proof: sanitizedProof,
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

// ===== STRIPE CHECKOUT =====

export async function createStripeCheckoutSession(
  category: PackCategory,
  size: PackSize = 'single'
): Promise<{ success: boolean; checkoutUrl?: string; sessionId?: string; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required: Please connect or sign in first');

    const { data: result, error } = await supabase.functions.invoke('vault-engine', {
      body: {
        action: 'createStripeCheckoutSession',
        payload: {
          category,
          size,
          origin: window.location.origin,
        },
      },
    });

    if (error || !result?.success) {
      const errMsg = (await extractDetailedError(error)) || result?.error || 'Failed to create Stripe Checkout session';
      console.error('Stripe Checkout Error:', errMsg);
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
    };
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return { success: false, error: err.message || 'Payment initiation failed' };
  }
}

export interface StripeVerificationOutcome {
  success: boolean;
  isTokenBundle?: boolean;
  tokenAmount?: number;
  newBalance?: number;
  cards: OwnedCard[];
}

export async function verifyStripeSessionDetailed(
  sessionId: string,
  category?: PackCategory,
  size?: PackSize
): Promise<StripeVerificationOutcome> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data: result, error } = await supabase.functions.invoke('vault-engine', {
      body: {
        action: 'verifyStripeSession',
        payload: { sessionId, category, size },
      },
    });

    if (error || !result?.success) {
      const errMsg = (await extractDetailedError(error)) || result?.error || 'Failed to verify payment';
      console.error('Stripe Verification Error:', errMsg);
      return { success: false, cards: [] };
    }

    if (result.isTokenBundle) {
      return {
        success: true,
        isTokenBundle: true,
        tokenAmount: result.tokenAmount,
        newBalance: result.newBalance,
        cards: [],
      };
    }

    const rawCards = result.cards || [];
    const pool = await fetchAllCards();

    const cards = rawCards.map((c: any) => {
      const isBombshell = isBombshellCard(c);
      const coverArtwork = c.cover_artwork || c.coverArtwork || (c.proof && typeof c.proof === 'object' ? c.proof.cover_artwork : undefined) || c.fingerprint;
      const parent = findCardWithFallback(pool, c.card_id, c.rarity, isBombshell, coverArtwork);
      return {
        id: c.id || crypto.randomUUID(),
        cardId: parent.id,
        card: { ...parent, rarity: c.rarity, cardSet: isBombshell ? 'bombshell' : 'gen-0' },
        source: c.source,
        cardSet: isBombshell ? 'bombshell' : 'gen-0',
        coverArtwork: parent.coverArtwork,
        claimedAt: c.claimed_at,
        edition: c.edition,
        maxSupply: c.max_supply,
        isEcho: c.is_echo,
        echoGeneration: c.echo_generation,
        echoSourceDay: c.echo_source_day,
        proof: c.proof,
        ultraReward: c.ultra_reward,
        blockchainStatus: c.blockchain_status,
        fingerprint: c.fingerprint,
      };
    });

    return {
      success: true,
      cards,
    };
  } catch (err) {
    console.error('Stripe session verification error:', err);
    return { success: false, cards: [] };
  }
}

export async function verifyStripeSession(
  sessionId: string,
  category?: PackCategory,
  size?: PackSize
): Promise<OwnedCard[]> {
  const res = await verifyStripeSessionDetailed(sessionId, category, size);
  return res.cards;
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

    if (!error && data?.success) {
      const tokensEarned = data.tokensEarned || 0;
      if (tokensEarned > 0) {
        const { useVaultStore } = await import('../store/useVaultStore');
        await useVaultStore.getState().addTokens(tokensEarned);
      }
      return {
        tokensEarned,
        echoCreated: data.willEcho || false,
        echoGeneration: data.echoGen || undefined
      };
    }
  } catch (e) {
    console.warn('Backend burn failed, using client burn fallback:', e);
  }

  // Client Fallback for Temporary Wallets / Guest Users / Offline / Mock Cards
  const rarity = ownedCard.card.rarity || 'common';
  const baseBurnValues: Record<string, number> = {
    common: 3,
    uncommon: 10,
    rare: 30,
    legendary: 80,
    mythic: 200
  };
  let tokensEarned = baseBurnValues[rarity] || 3;
  if (ownedCard.isEcho) {
    tokensEarned = Math.ceil(tokensEarned * 1.15);
  }

  try {
    const { useVaultStore } = await import('../store/useVaultStore');
    await useVaultStore.getState().addTokens(tokensEarned);
    useVaultStore.getState().removeFromCollection(ownedCard.id);
  } catch (err) {
    console.error('Error applying client fallback burn tokens:', err);
  }

  return {
    tokensEarned,
    echoCreated: false
  };
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

/** Buy a Vault Pack (or Bombshell Pack) using tokens (cost from admin config) */
export async function buyTokenPack(packType: 'vault_token' | 'bombshell_token' = 'vault_token'): Promise<OwnedCard[] | 'insufficient'> {
  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'purchasePack', payload: { packType } }
    });

    if (error || !data?.success) {
      const detailedError = await extractDetailedError(error) || data?.error;
      if (detailedError === 'Insufficient V⚡' || detailedError?.includes?.('Insufficient')) return 'insufficient';

      console.error('================================================');
      console.error(`🔥 TOKEN PACK ERROR [${packType}] 🔥`);
      console.error(detailedError || 'Unknown error');
      console.error('================================================');
      return [];
    }

    if (typeof data?.remainingTokens === 'number') {
      try {
        localStorage.setItem('pim_token_balance', String(data.remainingTokens));
        const { useVaultStore } = await import('../store/useVaultStore');
        useVaultStore.setState({ tokenBalance: data.remainingTokens });
      } catch {}
    }

    const rawCards = data.cards || [];
    const pool = await fetchAllCards();

    return rawCards.map((c: any) => {
      const isBombshell = isBombshellCard(c) || packType === 'bombshell_token';
      const coverArtwork = c.cover_artwork || c.coverArtwork || c.fingerprint || (c.proof && typeof c.proof === 'object' ? c.proof.cover_artwork : undefined);
      const parent = findCardWithFallback(pool, c.card_id, c.rarity, isBombshell, coverArtwork);
      const sanitizedProof = (typeof c.proof === 'string' && (c.proof === 'proof_of_first' || c.proof === 'proof_of_listen')) ? c.proof : null;
      return {
        id: c.id || crypto.randomUUID(),
        cardId: parent.id,
        card: { ...parent, rarity: c.rarity, cardSet: isBombshell ? 'bombshell' : 'gen-0' },
        source: c.source || packType,
        cardSet: isBombshell ? 'bombshell' : 'gen-0',
        coverArtwork: parent.coverArtwork,
        claimedAt: c.claimed_at || new Date().toISOString(),
        edition: c.edition || 1,
        maxSupply: c.max_supply || 100,
        isEcho: c.is_echo,
        echoGeneration: c.echo_generation,
        echoSourceDay: c.echo_source_day,
        proof: sanitizedProof,
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

/** Buy a 3-Card Bombshell Pack using tokens (275 V⚡ • 3% Mythic chance) */
export async function buyBombshellTokenPack(): Promise<OwnedCard[] | 'insufficient'> {
  return buyTokenPack('bombshell_token');
}

export function getTokenPackCost(): number {
  return getAdminConfig().tokenPackCost ?? 275;
}

/** Purchase a V⚡ Token Bundle via Coinbase Smart Wallet / Base crypto */
export async function buyTokenBundleWithCrypto(
  size: PackSize,
  tokenAmount: number,
  txHash: string
): Promise<{ success: boolean; tokenAmount: number }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: {
        action: 'creditCryptoTokenBundle',
        payload: { size, tokenAmount, txHash },
      },
    });

    if (error || !data?.success) {
      const errMsg = (await extractDetailedError(error)) || data?.error || 'Failed to credit token bundle';
      throw new Error(errMsg);
    }

    return { success: true, tokenAmount: data.tokenAmount || tokenAmount };
  } catch (err: any) {
    console.error('buyTokenBundleWithCrypto error:', err);
    throw err;
  }
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
      id: data.card.id || crypto.randomUUID(), cardId: parent.id,
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
      id: data.fusedCard.id || crypto.randomUUID(), cardId: parent.id,
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
  const cleanCode = code.trim().toLowerCase();
  if (cleanCode === 'idnoclip' || cleanCode === 'iddqd') {
    const key = cleanCode === 'idnoclip' ? 'opt_unlocked_iddqd' : 'opt_unlocked_noclip';
    localStorage.setItem(key, 'true');
    window.dispatchEvent(new Event('cheat_code_activated'));
    return {
      success: true,
      rewardType: 'cheat_code',
      rewardValue: cleanCode,
      result: { success: true }
    };
  }

  if (cleanCode === 'stunnerofthemonthunlock' || cleanCode === 'freebstella') {
    return {
      success: true,
      rewardType: 'age_gate_required',
      rewardValue: cleanCode,
      result: { success: true }
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('vault-engine', {
      body: { action: 'redeemBonusCode', payload: { code } }
    });
    if (error || !data?.success) {
      const detailedError = await extractDetailedError(error) || data?.error || 'Unknown validation failure';
      return { success: false, error: detailedError };
    }
    if (data?.success) {
      try {
        const { useVaultStore } = await import('../store/useVaultStore');
        const store = useVaultStore.getState();

        if (data.rewardType === 'tokens') {
          const tokenAmt = parseInt(data.rewardValue, 10) || 0;
          if (tokenAmt > 0) {
            await store.addTokens(tokenAmt);
          }
        } else if (data.rewardType === 'background_skin') {
          if (data.rewardValue) {
            await store.unlockSkin(data.rewardValue, 0);
          }
        } else if (data.rewardType === 'card' && data.result?.card) {
          const pool = await fetchAllCards();
          const c = data.result.card;
          const isBombshell = isBombshellCard(c);
          const coverArtwork = c.cover_artwork || c.coverArtwork || (c.proof && typeof c.proof === 'object' ? c.proof.cover_artwork : undefined) || c.fingerprint;
          const parent = findCardWithFallback(pool, c.card_id, c.rarity, isBombshell, coverArtwork);
          const mappedCard: OwnedCard = {
            id: c.id || crypto.randomUUID(),
            cardId: parent.id,
            card: { ...parent, rarity: c.rarity, cardSet: isBombshell ? 'bombshell' : 'gen-0' },
            cardSet: isBombshell ? 'bombshell' : 'gen-0',
            coverArtwork: parent.coverArtwork,
            source: c.source || 'promo_code',
            claimedAt: c.claimed_at || new Date().toISOString(),
            edition: c.edition || 1,
            maxSupply: c.max_supply || 1000,
            isEcho: !!c.is_echo,
            echoGeneration: c.echo_generation,
            echoSourceDay: c.echo_source_day,
            proof: c.proof,
            ultraReward: c.ultra_reward,
            blockchainStatus: c.blockchain_status || 'offchain',
            fingerprint: c.fingerprint
          };
          store.addToCollection([mappedCard]);
        } else if (data.rewardType === 'pack' && data.result?.cards) {
          const pool = await fetchAllCards();
          const mappedCards: OwnedCard[] = data.result.cards.map((c: any) => {
            const isBombshell = isBombshellCard(c);
            const coverArtwork = c.cover_artwork || c.coverArtwork || (c.proof && typeof c.proof === 'object' ? c.proof.cover_artwork : undefined) || c.fingerprint;
            const parent = findCardWithFallback(pool, c.card_id, c.rarity, isBombshell, coverArtwork);
            return {
              id: c.id || crypto.randomUUID(),
              cardId: parent.id,
              card: { ...parent, rarity: c.rarity, cardSet: isBombshell ? 'bombshell' : 'gen-0' },
              cardSet: isBombshell ? 'bombshell' : 'gen-0',
              coverArtwork: parent.coverArtwork,
              source: c.source || 'promo_code',
              claimedAt: c.claimed_at || new Date().toISOString(),
              edition: c.edition || 1,
              maxSupply: c.max_supply || 1000,
              isEcho: !!c.is_echo,
              echoGeneration: c.echo_generation,
              echoSourceDay: c.echo_source_day,
              proof: c.proof,
              ultraReward: c.ultra_reward,
              blockchainStatus: c.blockchain_status || 'offchain',
              fingerprint: c.fingerprint
            };
          });
          if (mappedCards.length > 0) {
            store.addToCollection(mappedCards);
          }
        }
      } catch (applyErr) {
        console.warn('Failed to immediately apply bonus code state to store:', applyErr);
      }

      return { 
        success: true, 
        rewardType: data.rewardType, 
        rewardValue: data.rewardValue,
        result: data.result
      };
    }
    return { success: false, error: 'Unknown validation failure' };
  } catch (e: any) {
    // Offline/guest fallback for Chunky promo code
    if (cleanCode === 'chunkybitch') {
      try {
        const parent = await getCardByDay(291);
        if (parent) {
          const pool = await fetchAllCards();
          const p = findCardWithFallback(pool, parent.id, 'uncommon');
          const realCard: OwnedCard = {
            id: crypto.randomUUID(),
            cardId: p.id,
            card: { ...p, rarity: 'uncommon', cardSet: 'gen-0' },
            cardSet: 'gen-0',
            source: 'promo_code',
            claimedAt: new Date().toISOString(),
            edition: 1,
            maxSupply: p.maxSupply || 100,
            isEcho: false,
            blockchainStatus: 'off-chain',
            coverArtwork: p.coverUrl,
          };
          const { useVaultStore } = await import('../store/useVaultStore');
          const store = useVaultStore.getState();
          if (store) {
            store.addToCollection([realCard]);
          }
          return {
            success: true,
            rewardType: 'card',
            rewardValue: 'card-291-uncommon',
            result: { card: { ...realCard, card_id: p.id, rarity: 'uncommon', claimed_at: realCard.claimedAt } }
          };
        }
      } catch (fallbackErr) {
        console.warn('Offline fallback for chunkybitch failed:', fallbackErr);
      }
    }
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
