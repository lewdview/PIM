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
  displayName: string | null;
  avatarUrl: string | null;

  // User Progress Database Sync State
  highScores: Record<string, number>;
  medals: Record<string, string>;
  fragments: Record<string, number>;
  milestoneClaims: Record<string, boolean>;
  claimedRewards: Record<string, string[]>;

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

  // Database Sync Actions
  syncHighScore: (songId: string, score: number, accuracy: number, maxCombo: number, medal: string) => Promise<void>;
  syncMedal: (songId: string, medal: string) => Promise<void>;
  syncFragments: (songId: string, count: number) => Promise<void>;
  syncMilestoneClaim: (monthNum: number, milestoneNum: number) => Promise<void>;
  syncClaimedRewards: (songId: string, tiers: string[]) => void;
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

export const useVaultStore = create<VaultState>((set, get) => ({
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
  displayName: null,
  avatarUrl: null,

  // Initial Sync State
  highScores: {},
  medals: {},
  fragments: {},
  milestoneClaims: {},
  claimedRewards: {},

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
        supplyRes,
        gameplayRes,
        fragmentsRes,
        milestonesRes
      ] = await Promise.all([
        supabase.from('profiles').select('tokens, daily_standard_purchased, daily_premium_purchased, last_purchase_day, has_onboarded, streak_count, total_pulls, pulls_since_rare_plus, unlocked_skins, display_name, avatar_url').eq('id', userId).single(),
        supabase.from('vault_collections').select('*').eq('owner_id', userId),
        supabase.from('global_supply').select('*'),
        supabase.from('gameplay_records').select('*').eq('user_id', userId),
        supabase.from('user_fragments').select('*').eq('user_id', userId),
        supabase.from('campaign_milestone_claims').select('*').eq('user_id', userId),
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
          displayName: profile.display_name || null,
          avatarUrl: profile.avatar_url || null,
        });
        if (profile.last_purchase_day === today) {
          set({ dailyLimits: { standard: profile.daily_standard_purchased || 0, premium: profile.daily_premium_purchased || 0 } });
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

      // --- USER PROGRESS MERGING & MIGRATION ---
      const MEDAL_ORDER = ['', 'NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
      const TIER_ORDER: Record<string, number> = {
        none: 0, free: 1, taste: 2, special_picks: 3, alpha: 4, prophecy: 5
      };
      const dbHighScores: Record<string, number> = {};
      const dbMedals: Record<string, string> = {};
      const dbFragments: Record<string, number> = {};
      const dbMilestoneClaims: Record<string, boolean> = {};
      const dbClaimedRewards: Record<string, string[]> = {};

      if (gameplayRes.data) {
        for (const row of gameplayRes.data) {
          const songId = row.song_id;
          if (row.score > (dbHighScores[songId] || 0)) {
            dbHighScores[songId] = row.score;
          }
          const currentMedal = dbMedals[songId] || '';
          if (MEDAL_ORDER.indexOf(row.medal as any) > MEDAL_ORDER.indexOf(currentMedal as any)) {
            dbMedals[songId] = row.medal;
          }
          if (row.pack_rewarded && row.reward_tier && row.reward_tier !== 'none') {
            if (!dbClaimedRewards[songId]) {
              dbClaimedRewards[songId] = [];
            }
            const DB_TO_APP_TIER: Record<string, string> = {
              common: 'free',
              enhanced: 'taste',
              rare: 'special_picks',
              epic: 'alpha',
              legendary: 'prophecy'
            };
            const mappedTier = DB_TO_APP_TIER[row.reward_tier] || row.reward_tier;
            if (!dbClaimedRewards[songId].includes(mappedTier)) {
              dbClaimedRewards[songId].push(mappedTier);
            }
          }
        }
      }

      if (fragmentsRes.data) {
        for (const row of fragmentsRes.data) {
          dbFragments[row.song_id] = row.count;
        }
      }

      if (milestonesRes.data) {
        for (const row of milestonesRes.data) {
          const claimKey = `campaign_claimed_${row.month_num}_${row.milestone_num}`;
          dbMilestoneClaims[claimKey] = true;
        }
      }

      const finalHighScores = { ...dbHighScores };
      const finalMedals = { ...dbMedals };
      const finalFragments = { ...dbFragments };
      const finalMilestoneClaims = { ...dbMilestoneClaims };
      const finalClaimedRewards = { ...dbClaimedRewards };

      // Scan local storage for migration to DB
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (key.startsWith('hs_')) {
          const songId = key.substring(3);
          const localScore = parseInt(localStorage.getItem(key) || '0', 10);
          const dbScore = dbHighScores[songId] || 0;
          if (localScore > dbScore) {
            finalHighScores[songId] = localScore;
            supabase.from('gameplay_records').insert({
              user_id: userId,
              song_id: songId,
              score: localScore,
              accuracy: 0,
              max_combo: 0,
              medal: finalMedals[songId] || 'NONE',
              pack_rewarded: false,
              reward_tier: 'none'
            }).then(({ error }) => {
              if (error) console.warn(`[Migrate] Failed to sync score for ${songId}:`, error.message);
            });
          }
        } else if (key.startsWith('medal_')) {
          const songId = key.substring(6);
          const localMedal = localStorage.getItem(key) || '';
          const dbMedal = dbMedals[songId] || '';
          if (MEDAL_ORDER.indexOf(localMedal as any) > MEDAL_ORDER.indexOf(dbMedal as any)) {
            finalMedals[songId] = localMedal;
            supabase.from('gameplay_records').insert({
              user_id: userId,
              song_id: songId,
              score: finalHighScores[songId] || 0,
              accuracy: 0,
              max_combo: 0,
              medal: localMedal,
              pack_rewarded: false,
              reward_tier: 'none'
            }).then(({ error }) => {
              if (error) console.warn(`[Migrate] Failed to sync medal for ${songId}:`, error.message);
            });
          }
        } else if (key.startsWith('fragments_')) {
          const songId = key.substring(10);
          const localCount = parseInt(localStorage.getItem(key) || '0', 10);
          const dbCount = dbFragments[songId] || 0;
          if (localCount > dbCount) {
            finalFragments[songId] = localCount;
            supabase.from('user_fragments').upsert({
              user_id: userId,
              song_id: songId,
              count: localCount,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,song_id' }).then(({ error }) => {
              if (error) console.warn(`[Migrate] Failed to sync fragments for ${songId}:`, error.message);
            });
          }
        } else if (key.startsWith('reward_tier_')) {
          const songId = key.substring(12);
          const localTier = localStorage.getItem(key) || '';
          if (localTier && localTier !== 'none') {
            if (!finalClaimedRewards[songId]) {
              finalClaimedRewards[songId] = [];
            }
            const valLimit = TIER_ORDER[localTier] ?? 0;
            const TIERS = ['free', 'taste', 'special_picks', 'alpha', 'prophecy'];
            for (const t of TIERS) {
              if (TIER_ORDER[t] <= valLimit) {
                if (!finalClaimedRewards[songId].includes(t)) {
                  finalClaimedRewards[songId].push(t);
                }
              }
            }
          }
        } else if (key.startsWith('campaign_claimed_')) {
          const parts = key.split('_');
          if (parts.length === 4) {
            const monthNum = parseInt(parts[2], 10);
            const milestoneNum = parseInt(parts[3], 10);
            if (localStorage.getItem(key) === 'true' && !dbMilestoneClaims[key]) {
              finalMilestoneClaims[key] = true;
              supabase.from('campaign_milestone_claims').upsert({
                user_id: userId,
                month_num: monthNum,
                milestone_num: milestoneNum,
                claimed_at: new Date().toISOString()
              }, { onConflict: 'user_id,month_num,milestone_num' }).then(({ error }) => {
                if (error) console.warn(`[Migrate] Failed to sync milestone claim for ${key}:`, error.message);
              });
            }
          }
        }
      }

      // Keep localStorage in sync with merged database state
      Object.entries(finalHighScores).forEach(([songId, score]) => {
        localStorage.setItem(`hs_${songId}`, String(score));
      });
      Object.entries(finalMedals).forEach(([songId, medal]) => {
        localStorage.setItem(`medal_${songId}`, medal);
      });
      Object.entries(finalFragments).forEach(([songId, count]) => {
        localStorage.setItem(`fragments_${songId}`, String(count));
      });
      Object.entries(finalMilestoneClaims).forEach(([k, val]) => {
        if (val) localStorage.setItem(k, 'true');
      });

      set({
        highScores: finalHighScores,
        medals: finalMedals,
        fragments: finalFragments,
        milestoneClaims: finalMilestoneClaims,
        claimedRewards: finalClaimedRewards,
      });

    } finally {
      set({ isLoading: false });
    }
  },

  completeOnboarding: async () => {
    // Set local state synchronously first to instantly transition away from the onboarding flow
    set({ hasOnboarded: true });

    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (userId) {
        const { error } = await supabase.from('profiles').update({ has_onboarded: true }).eq('id', userId);
        if (error) {
          console.warn('[completeOnboarding] Failed to update has_onboarded in DB:', error.message);
        }
      }
    } catch (err) {
      console.warn('[completeOnboarding] Error during Supabase update:', err);
    }
  },

  syncHighScore: async (songId, score, accuracy, maxCombo, medal) => {
    set((state) => {
      const current = state.highScores[songId] || 0;
      if (score > current) {
        return { highScores: { ...state.highScores, [songId]: score } };
      }
      return {};
    });

    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    if (userId) {
      try {
        await supabase.from('gameplay_records').insert({
          user_id: userId,
          song_id: songId,
          score,
          accuracy,
          max_combo: maxCombo,
          medal,
          pack_rewarded: false,
          reward_tier: 'none'
        });
      } catch (err) {
        console.warn('Failed to sync high score to database:', err);
      }
    }
  },

  syncMedal: async (songId, medal) => {
    const MEDAL_ORDER = ['', 'NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
    set((state) => {
      const current = state.medals[songId] || '';
      if (MEDAL_ORDER.indexOf(medal as any) > MEDAL_ORDER.indexOf(current as any)) {
        return { medals: { ...state.medals, [songId]: medal } };
      }
      return {};
    });

    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    if (userId) {
      try {
        const currentScore = get().highScores[songId] || 0;
        await supabase.from('gameplay_records').insert({
          user_id: userId,
          song_id: songId,
          score: currentScore,
          accuracy: 0,
          max_combo: 0,
          medal,
          pack_rewarded: false,
          reward_tier: 'none'
        });
      } catch (err) {
        console.warn('Failed to sync medal to database:', err);
      }
    }
  },

  syncFragments: async (songId, count) => {
    set((state) => ({
      fragments: { ...state.fragments, [songId]: count }
    }));

    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    if (userId) {
      try {
        await supabase.from('user_fragments').upsert({
          user_id: userId,
          song_id: songId,
          count,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,song_id' });
      } catch (err) {
        console.warn('Failed to sync fragments to database:', err);
      }
    }
  },

  syncMilestoneClaim: async (monthNum, milestoneNum) => {
    const claimKey = `campaign_claimed_${monthNum}_${milestoneNum}`;
    set((state) => ({
      milestoneClaims: { ...state.milestoneClaims, [claimKey]: true }
    }));

    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    if (userId) {
      try {
        await supabase.from('campaign_milestone_claims').upsert({
          user_id: userId,
          month_num: monthNum,
          milestone_num: milestoneNum,
          claimed_at: new Date().toISOString()
        }, { onConflict: 'user_id,month_num,milestone_num' });
      } catch (err) {
        console.warn('Failed to sync milestone claim to database:', err);
      }
    }
  },

  syncClaimedRewards: (songId, tiers) => {
    set((state) => {
      const current = state.claimedRewards[songId] || [];
      const next = Array.from(new Set([...current, ...tiers]));
      return {
        claimedRewards: { ...state.claimedRewards, [songId]: next }
      };
    });
  },
}));
