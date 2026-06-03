import { create } from 'zustand';
import type { VaultCard, OwnedCard } from '../services/vaultService';
import { supabase } from '../services/supabaseClient';


export interface RevealPackMeta {
  category: string;
  size?: string;
  label: string;
  icon: string;
  accent: string;
  gradient: string;
  price: string;
  cardCount: number;
  revealType: 'tap' | 'slide' | 'cinematic';
  redirectPath?: string;
  showRipAnother?: boolean;
}

interface VaultState {
  // Daily card
  dailyCard: VaultCard | null;
  hasClaimed: boolean;

  // Collection
  collection: OwnedCard[];

  // Echo Prestige Score
  echoPrestigeScore: number;

  // Pack reveal
  revealCards: OwnedCard[];
  isRevealing: boolean;
  revealPackMeta: RevealPackMeta | null;

  // Loading
  isLoading: boolean;

  // Token system
  tokenBalance: number;

  // Ecosystem state
  supplyMap: Record<string, number>;


  // Daily limits (from Supabase profile)
  dailyLimits: { standard: number; premium: number };
  hasOnboarded: boolean | null;

  // Stats
  streakCount: number;
  totalPulls: number;
  pullsSinceRarePlus: number;

  // Modifiers
  equippedCardId: string | null;
  unlockedSkins: string[];

  // Actions
  setDailyCard: (card: VaultCard | null) => void;
  setHasClaimed: (claimed: boolean) => void;
  setCollection: (cards: OwnedCard[]) => void;
  addToCollection: (cards: OwnedCard[]) => void;
  removeFromCollection: (ownedId: string) => void;
  startReveal: (cards: OwnedCard[], meta?: RevealPackMeta) => void;
  endReveal: () => void;
  setLoading: (loading: boolean) => void;
  setTokenBalance: (balance: number) => void;
  setEquippedCardId: (id: string | null) => void;
  loadVaultData: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export function calculateEchoPrestigeScore(
  collection: OwnedCard[],
  streakCount: number,
  totalPulls: number
): number {
  let score = 0;
  score += (streakCount || 0) * 120;
  score += (totalPulls || 0) * 15;

  for (const c of collection) {
    if (!c || !c.card) continue;
    const rarity = c.card.rarity;
    if (rarity === 'common') score += 10;
    else if (rarity === 'uncommon') score += 25;
    else if (rarity === 'rare') score += 60;
    else if (rarity === 'legendary') score += 350;
    else if (rarity === 'mythic') score += 800;

    if (c.edition === 1) score += 500;
    if (c.proof && c.proof !== 'none' as any) score += 200;
    if (c.isEcho) score += 400;
  }
  return score;
}

export const useVaultStore = create<VaultState>((set) => ({
  dailyCard: null,
  hasClaimed: false,
  collection: [],
  echoPrestigeScore: 0,
  revealCards: [],
  isRevealing: false,
  revealPackMeta: null,
  isLoading: false,
  tokenBalance: 0,
  supplyMap: {},
  dailyLimits: { standard: 0, premium: 0 },
  hasOnboarded: null,
  streakCount: 0,
  totalPulls: 0,
  pullsSinceRarePlus: 0,
  equippedCardId: null,
  unlockedSkins: [],

  setDailyCard: (card) => set({ dailyCard: card }),
  setHasClaimed: (claimed) => set({ hasClaimed: claimed }),
  setCollection: (cards) => set((state) => {
    const valid = cards.filter(c => c && c.card);
    return { 
      collection: valid,
      echoPrestigeScore: calculateEchoPrestigeScore(valid, state.streakCount, state.totalPulls)
    };
  }),
  addToCollection: (cards) => set((state) => {
    const valid = cards.filter(c => c && c.card);
    const nextCollection = [...state.collection, ...valid];
    return {
      collection: nextCollection,
      echoPrestigeScore: calculateEchoPrestigeScore(nextCollection, state.streakCount, state.totalPulls),
    };
  }),
  removeFromCollection: (ownedId) => set((state) => {
    const nextCollection = state.collection.filter(c => c && c.id !== ownedId && c.card);
    return {
      collection: nextCollection,
      echoPrestigeScore: calculateEchoPrestigeScore(nextCollection, state.streakCount, state.totalPulls),
    };
  }),
  startReveal: (cards, meta) => set({ revealCards: cards, isRevealing: true, revealPackMeta: meta ?? null }),
  endReveal: () => set({ isRevealing: false, revealPackMeta: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setTokenBalance: (balance) => set({ tokenBalance: balance }),
  setEquippedCardId: (id) => set({ equippedCardId: id }),
  loadVaultData: async () => {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    if (!userId) return;

    set({ isLoading: true });
    try {
      const { getCurrentDay } = await import('../utils/dayCalc');
      const { initAdminConfig } = await import('../utils/adminConfig');
      
      const today = getCurrentDay();
      
      // Initialize global admin configuration settings from the database
      await initAdminConfig();

      const [
        profileRes, 
        vaultRes, 
        supplyRes
      ] = await Promise.all([
        supabase.from('profiles').select('tokens, daily_standard_claims, daily_premium_claims, last_claim_day, has_onboarded, streak_count, total_pulls, pulls_since_rare_plus, unlocked_skins').eq('id', userId).single(),
        supabase.from('vault_collections').select('*').eq('owner_id', userId),
        supabase.from('global_supply').select('*')
      ]);
      
      const profile = profileRes.data;
      const vault = vaultRes.data;
      const supplyData = supplyRes.data;

      let currentStreak = 0;
      let currentPulls = 0;
      let mappedCards: OwnedCard[] = [];

      if (profile) {
        currentStreak = profile.streak_count || 0;
        currentPulls = profile.total_pulls || 0;
        set({ 
          tokenBalance: profile.tokens,
          hasOnboarded: profile.has_onboarded ?? false,
          streakCount: currentStreak,
          totalPulls: currentPulls,
          pullsSinceRarePlus: profile.pulls_since_rare_plus || 0,
          unlockedSkins: profile.unlocked_skins || [],
        });
        if (profile.last_claim_day === today) {
          set({ dailyLimits: { standard: profile.daily_standard_claims || 0, premium: profile.daily_premium_claims || 0 } });
        } else {
          set({ dailyLimits: { standard: 0, premium: 0 } });
        }
      }
      
      if (supplyData) {
        const supplyMap: Record<string, number> = {};
        for (const row of supplyData) {
          supplyMap[row.card_id_rarity] = row.supply;
        }
        set({ supplyMap });
      }

      if (vault) {
        const { fetchAllCards, findCardWithFallback } = await import('../services/vaultService');
        const pool = await fetchAllCards();
        mappedCards = vault.map(c => {
           const parent = findCardWithFallback(pool, c.card_id, c.rarity);
           return {
             id: c.id,
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
      }

      const validMappedCards = mappedCards.filter(c => c && c.card);
      // Single set to update collection and computed prestige score simultaneously
      set({ 
        collection: validMappedCards,
        echoPrestigeScore: calculateEchoPrestigeScore(validMappedCards, currentStreak, currentPulls)
      });

    } finally {
      set({ isLoading: false });
    }
  },

  completeOnboarding: async () => {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    if (userId) {
      await supabase.from('profiles').update({ has_onboarded: true }).eq('id', userId);
      set({ hasOnboarded: true });
    }
  },
}));
