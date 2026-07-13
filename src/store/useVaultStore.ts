import { create } from 'zustand';
import type { VaultCard, OwnedCard } from '../services/vaultService';
import { supabase } from '../services/supabaseClient';


export interface ProfileSettings {
  audioOffset: number;
  laneKeys: [string, string, string];
  laneColors: [string, string, string];
  noteTheme: string;
  cardSkin: string;
  cardBack: string;
  gameBackground: string;
  gameTrack?: string;
  backgroundBlur: number;
  hudMisses: boolean;
  comboDisplay: boolean;
  judgmentText: boolean;
  bgMusic: boolean;
  haptics: boolean;
  missSystem: boolean;
  slideshowThreshold?: number;
  slideshowIsolate?: boolean;
  slideshowBrackets?: boolean;
  slideshowMode?: 'coco' | 'contour';
}

export interface ProfileProgression {
  tutorialCompleted: boolean;
  seenWelcomeModal: boolean;
  noteGenerationSource: 'auto' | 'lyrics' | 'bpm';
}

export interface ProfileCheats {
  noclip: boolean;
  iddqd: boolean;
}

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
  hasLoadedData: boolean;

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

  settings: ProfileSettings;
  progression: ProfileProgression;
  unlockedCheats: ProfileCheats;

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
  addTokens: (amount: number) => Promise<void>;
  setEquippedCardId: (id: string | null) => void;
  loadVaultData: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  unlockSkin: (skinId: string, cost: number) => Promise<boolean>;
  optionsModalOpen: boolean;
  setOptionsModalOpen: (open: boolean) => void;
  updateSettings: (settings: Partial<ProfileSettings>) => Promise<void>;
  updateProgression: (progression: Partial<ProfileProgression>) => Promise<void>;
  updateCheats: (cheats: Partial<ProfileCheats>) => Promise<void>;

  // Database Sync Actions
  syncHighScore: (songId: string, score: number, accuracy: number, maxCombo: number, medal: string, telemetry?: any) => Promise<void>;
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
  hasLoadedData: false,
  tokenBalance: 0,
  supplyMap: {},
  dailyLimits: { standard: 0, premium: 0 },
  hasOnboarded: null,
  streakCount: 0,
  totalPulls: 0,
  pullsSinceRarePlus: 0,
  equippedCardId: null,
  unlockedSkins: JSON.parse(localStorage.getItem('local_unlocked_skins') || '["original", "glitch", "glass"]'),
  displayName: null,
  avatarUrl: null,
  optionsModalOpen: false,

  settings: {
    audioOffset: parseFloat(localStorage.getItem("opt_audioOffset") ?? "0") || 0,
    laneKeys: [
      localStorage.getItem("opt_laneKey_0") ?? "a",
      localStorage.getItem("opt_laneKey_1") ?? "s",
      localStorage.getItem("opt_laneKey_2") ?? "d",
    ],
    laneColors: [
      localStorage.getItem("opt_laneColor_0") ?? "#FF1493",
      localStorage.getItem("opt_laneColor_1") ?? "#00E5FF",
      localStorage.getItem("opt_laneColor_2") ?? "#39FF14",
    ],
    noteTheme: localStorage.getItem("opt_noteTheme") ?? "classic",
    cardSkin: localStorage.getItem("opt_cardSkin") ?? "original",
    cardBack: localStorage.getItem("opt_cardBack") ?? "classic",
    gameBackground: localStorage.getItem("opt_gameBackground") ?? "cover_blur",
    gameTrack: localStorage.getItem("opt_gameTrack") ?? "classic",
    backgroundBlur: parseFloat(localStorage.getItem("opt_backgroundBlur") ?? "10") || 10,
    hudMisses: localStorage.getItem("opt_hudMisses") !== "false",
    comboDisplay: localStorage.getItem("opt_comboDisplay") !== "false",
    judgmentText: localStorage.getItem("opt_judgmentText") !== "false",
    bgMusic: localStorage.getItem("opt_bgMusic") === "true",
    haptics: localStorage.getItem("opt_haptics") !== "false",
    missSystem: localStorage.getItem("opt_missSystem") !== "false",
    slideshowThreshold: parseInt(localStorage.getItem("opt_slideshowThreshold") ?? "38") || 38,
    slideshowIsolate: localStorage.getItem("opt_slideshowIsolate") === "true",
    slideshowBrackets: localStorage.getItem("opt_slideshowBrackets") === "true",
    slideshowMode: (localStorage.getItem("opt_slideshowMode") as any) ?? "coco",
  },
  progression: {
    tutorialCompleted: localStorage.getItem("pim_tutorial_completed") === "true",
    seenWelcomeModal: localStorage.getItem("opt_seen_welcome_modal") === "true" || localStorage.getItem("rc2_seen_key") === "1",
    noteGenerationSource: (localStorage.getItem("opt_noteGenerationSource") as any) || "auto",
  },
  unlockedCheats: {
    noclip: localStorage.getItem("opt_unlocked_noclip") === "true",
    iddqd: localStorage.getItem("opt_unlocked_iddqd") === "true",
  },

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
  setOptionsModalOpen: (open) => set({ optionsModalOpen: open }),
  loadVaultData: async () => {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    if (!userId) {
      set({ hasLoadedData: false });
      return;
    }
    if (get().hasLoadedData) return;

    set({ isLoading: true });
    try {
      const { getCurrentDay } = await import('../utils/dayCalc');
      const { initAdminConfig } = await import('../utils/adminConfig');
      
      const today = getCurrentDay();
      
      // Initialize global admin configuration settings from the database
      await initAdminConfig();

      let profileRes: any;
      try {
        profileRes = await supabase.from('profiles').select('tokens, daily_standard_purchased, daily_premium_purchased, last_purchase_day, has_onboarded, streak_count, total_pulls, pulls_since_rare_plus, unlocked_skins, display_name, avatar_url, settings, progression, unlocked_cheats').eq('id', userId).single();
        if (profileRes.error && profileRes.error.message.includes('column')) {
          throw new Error('Fallback');
        }
      } catch {
        console.warn("[Sync] New profile columns not found, falling back to legacy profile columns");
        profileRes = await supabase.from('profiles').select('tokens, daily_standard_purchased, daily_premium_purchased, last_purchase_day, has_onboarded, streak_count, total_pulls, pulls_since_rare_plus, unlocked_skins, display_name, avatar_url').eq('id', userId).single();
      }

      const [
        vaultRes, 
        supplyRes,
        gameplayRes,
        fragmentsRes,
        milestonesRes
      ] = await Promise.all([
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

        // Merge Settings
        const localSettings = get().settings;
        const dbSettings = (profile as any).settings || {};
        const mergedSettings = { ...localSettings, ...dbSettings };

        // Merge Progression
        const localProgression = get().progression;
        const dbProgression = (profile as any).progression || {};
        const mergedProgression = { ...localProgression, ...dbProgression };

        // Merge Cheats
        const localCheats = get().unlockedCheats;
        const dbCheats = (profile as any).unlocked_cheats || {};
        const mergedCheats = { ...localCheats, ...dbCheats };

        // Check if database needs an initial push from local cache
        const hasDbSettings = (profile as any).settings && Object.keys((profile as any).settings).length > 0;
        const hasDbProgression = (profile as any).progression && Object.keys((profile as any).progression).length > 0;
        const hasDbCheats = (profile as any).unlocked_cheats && Object.keys((profile as any).unlocked_cheats).length > 0;

        const needsSettingsSync = !hasDbSettings && Object.keys(localSettings).length > 0;
        const needsProgressionSync = !hasDbProgression && Object.keys(localProgression).length > 0;
        const needsCheatsSync = !hasDbCheats && Object.keys(localCheats).length > 0;

        if ((needsSettingsSync || needsProgressionSync || needsCheatsSync) && !profileRes.error) {
          const updates: any = {};
          if (needsSettingsSync) updates.settings = mergedSettings;
          if (needsProgressionSync) updates.progression = mergedProgression;
          if (needsCheatsSync) updates.unlocked_cheats = mergedCheats;

          supabase.from('profiles').update(updates).eq('id', userId).then(({ error }) => {
            if (error) console.error("[Sync] Error backing up local settings/progression to DB:", error.message);
          });
        }

        // Cache back to localStorage
        localStorage.setItem("opt_audioOffset", String(mergedSettings.audioOffset));
        localStorage.setItem("opt_laneKey_0", mergedSettings.laneKeys[0]);
        localStorage.setItem("opt_laneKey_1", mergedSettings.laneKeys[1]);
        localStorage.setItem("opt_laneKey_2", mergedSettings.laneKeys[2]);
        localStorage.setItem("opt_laneColor_0", mergedSettings.laneColors[0]);
        localStorage.setItem("opt_laneColor_1", mergedSettings.laneColors[1]);
        localStorage.setItem("opt_laneColor_2", mergedSettings.laneColors[2]);
        localStorage.setItem("opt_noteTheme", mergedSettings.noteTheme);
        localStorage.setItem("opt_cardSkin", mergedSettings.cardSkin);
        localStorage.setItem("opt_cardBack", mergedSettings.cardBack);
        localStorage.setItem("opt_gameBackground", mergedSettings.gameBackground);
        if (mergedSettings.gameTrack) localStorage.setItem("opt_gameTrack", mergedSettings.gameTrack);
        localStorage.setItem("opt_backgroundBlur", String(mergedSettings.backgroundBlur));
        localStorage.setItem("opt_hudMisses", String(mergedSettings.hudMisses));
        localStorage.setItem("opt_comboDisplay", String(mergedSettings.comboDisplay));
        localStorage.setItem("opt_judgmentText", String(mergedSettings.judgmentText));
        localStorage.setItem("opt_bgMusic", String(mergedSettings.bgMusic));
        localStorage.setItem("opt_haptics", String(mergedSettings.haptics));
        localStorage.setItem("opt_missSystem", String(mergedSettings.missSystem));

        localStorage.setItem("pim_tutorial_completed", String(mergedProgression.tutorialCompleted));
        localStorage.setItem("rc2_seen_key", mergedProgression.seenWelcomeModal ? "1" : "0");
        localStorage.setItem("opt_noteGenerationSource", mergedProgression.noteGenerationSource);

        localStorage.setItem("opt_unlocked_noclip", String(mergedCheats.noclip));
        localStorage.setItem("opt_unlocked_iddqd", String(mergedCheats.iddqd));

        set({ 
          tokenBalance: profile.tokens,
          hasOnboarded: profile.has_onboarded ?? false,
          streakCount: currentStreak,
          totalPulls: currentPulls,
          pullsSinceRarePlus: profile.pulls_since_rare_plus || 0,
          unlockedSkins: profile.unlocked_skins || [],
          displayName: profile.display_name || null,
          avatarUrl: profile.avatar_url || null,
          settings: mergedSettings,
          progression: mergedProgression,
          unlockedCheats: mergedCheats,
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
      set({ isLoading: false, hasLoadedData: true });
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

  updateSettings: async (newSettings) => {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    const currentSettings = get().settings;
    const merged = { ...currentSettings, ...newSettings };

    set({ settings: merged });

    // Update LocalStorage cache
    if (newSettings.audioOffset !== undefined) localStorage.setItem("opt_audioOffset", String(merged.audioOffset));
    if (newSettings.laneKeys !== undefined) {
      localStorage.setItem("opt_laneKey_0", merged.laneKeys[0]);
      localStorage.setItem("opt_laneKey_1", merged.laneKeys[1]);
      localStorage.setItem("opt_laneKey_2", merged.laneKeys[2]);
    }
    if (newSettings.laneColors !== undefined) {
      localStorage.setItem("opt_laneColor_0", merged.laneColors[0]);
      localStorage.setItem("opt_laneColor_1", merged.laneColors[1]);
      localStorage.setItem("opt_laneColor_2", merged.laneColors[2]);
    }
    if (newSettings.noteTheme !== undefined) localStorage.setItem("opt_noteTheme", merged.noteTheme);
    if (newSettings.cardSkin !== undefined) localStorage.setItem("opt_cardSkin", merged.cardSkin);
    if (newSettings.cardBack !== undefined) localStorage.setItem("opt_cardBack", merged.cardBack);
    if (newSettings.gameBackground !== undefined) localStorage.setItem("opt_gameBackground", merged.gameBackground);
    if (newSettings.gameTrack !== undefined && merged.gameTrack) localStorage.setItem("opt_gameTrack", merged.gameTrack);
    if (newSettings.backgroundBlur !== undefined) localStorage.setItem("opt_backgroundBlur", String(merged.backgroundBlur));
    if (newSettings.hudMisses !== undefined) localStorage.setItem("opt_hudMisses", String(merged.hudMisses));
    if (newSettings.comboDisplay !== undefined) localStorage.setItem("opt_comboDisplay", String(merged.comboDisplay));
    if (newSettings.judgmentText !== undefined) localStorage.setItem("opt_judgmentText", String(merged.judgmentText));
    if (newSettings.bgMusic !== undefined) localStorage.setItem("opt_bgMusic", String(merged.bgMusic));
    if (newSettings.haptics !== undefined) localStorage.setItem("opt_haptics", String(merged.haptics));
    if (newSettings.missSystem !== undefined) localStorage.setItem("opt_missSystem", String(merged.missSystem));
    if (newSettings.slideshowThreshold !== undefined) localStorage.setItem("opt_slideshowThreshold", String(merged.slideshowThreshold));
    if (newSettings.slideshowIsolate !== undefined) localStorage.setItem("opt_slideshowIsolate", String(merged.slideshowIsolate));
    if (newSettings.slideshowBrackets !== undefined) localStorage.setItem("opt_slideshowBrackets", String(merged.slideshowBrackets));
    if (newSettings.slideshowMode !== undefined) localStorage.setItem("opt_slideshowMode", String(merged.slideshowMode));

    if (userId) {
      const { error } = await supabase.from('profiles').update({ settings: merged }).eq('id', userId);
      if (error) console.error("[Sync] Error updating settings in Supabase:", error.message);
    }
  },

  updateProgression: async (newProgression) => {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    const currentProgression = get().progression;
    const merged = { ...currentProgression, ...newProgression };

    set({ progression: merged });

    // Update LocalStorage cache
    if (newProgression.tutorialCompleted !== undefined) localStorage.setItem("pim_tutorial_completed", String(merged.tutorialCompleted));
    if (newProgression.seenWelcomeModal !== undefined) localStorage.setItem("rc2_seen_key", merged.seenWelcomeModal ? "1" : "0");
    if (newProgression.noteGenerationSource !== undefined) localStorage.setItem("opt_noteGenerationSource", merged.noteGenerationSource);

    if (userId) {
      const { error } = await supabase.from('profiles').update({ progression: merged }).eq('id', userId);
      if (error) console.error("[Sync] Error updating progression in Supabase:", error.message);
    }
  },

  updateCheats: async (newCheats) => {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    const currentCheats = get().unlockedCheats;
    const merged = { ...currentCheats, ...newCheats };

    set({ unlockedCheats: merged });

    // Update LocalStorage cache
    if (newCheats.noclip !== undefined) localStorage.setItem("opt_unlocked_noclip", String(merged.noclip));
    if (newCheats.iddqd !== undefined) localStorage.setItem("opt_unlocked_iddqd", String(merged.iddqd));

    if (userId) {
      const { error } = await supabase.from('profiles').update({ unlocked_cheats: merged }).eq('id', userId);
      if (error) console.error("[Sync] Error updating cheats in Supabase:", error.message);
    }
  },

  syncHighScore: async (songId, score, accuracy, maxCombo, medal, telemetry) => {
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
          reward_tier: 'none',
          telemetry: telemetry || null
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

  unlockSkin: async (skinId, cost) => {
    const state = get();
    if (state.tokenBalance < cost) {
      alert(`Insufficient Vault Tokens! Need ${cost} V⚡, but you only have ${state.tokenBalance} V⚡.`);
      return false;
    }
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    if (!userId) {
      // Local storage fallback for guest/unauthenticated users
      const localUnlocked = JSON.parse(localStorage.getItem('local_unlocked_skins') || '["original", "glitch", "glass"]');
      if (!localUnlocked.includes(skinId)) {
        localUnlocked.push(skinId);
        localStorage.setItem('local_unlocked_skins', JSON.stringify(localUnlocked));
      }
      set((state) => ({
        tokenBalance: state.tokenBalance - cost,
        unlockedSkins: localUnlocked,
      }));
      return true;
    }

    const nextSkins = [...state.unlockedSkins, skinId];
    const nextTokens = state.tokenBalance - cost;

    const { error } = await supabase
      .from('profiles')
      .update({
        unlocked_skins: nextSkins,
        tokens: nextTokens,
      })
      .eq('id', userId);

    if (error) {
      console.error("Error unlocking skin in db:", error);
      alert("Failed to unlock skin. Please try again.");
      return false;
    }

    set({
      unlockedSkins: nextSkins,
      tokenBalance: nextTokens,
    });
    return true;
  },

  addTokens: async (amount: number) => {
    const state = get();
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    const nextTokens = state.tokenBalance + amount;

    set({ tokenBalance: nextTokens });

    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .update({ tokens: nextTokens })
        .eq('id', userId);
      if (error) {
        console.error('[Sync] Error adding tokens to Supabase:', error.message);
      }
    }
  },
}));
