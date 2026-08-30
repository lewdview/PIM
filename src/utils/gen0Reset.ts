/**
 * PIM : th3v4ult — Public Gen 0 Reset Utility
 * 
 * Defines the clean boundary between immutable game assets & rules
 * versus mutable player state.
 */

export const GEN0_RESET_SQL = `-- ============================================================================
-- PIM : th3v4ult — PUBLIC GEN 0 RESET BOUNDARY SCRIPT
-- ============================================================================
BEGIN;

-- 1. ADD ISOLATION & IDENTITY COLUMNS
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_alpha BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS season_tag TEXT DEFAULT 'gen_0';

ALTER TABLE public.gameplay_records 
  ADD COLUMN IF NOT EXISTS is_alpha BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS season_tag TEXT DEFAULT 'gen_0';

-- 2. RESET MUTABLE PLAYER CARD OWNERSHIP & RECYCLING POOLS
TRUNCATE TABLE public.vault_collections CASCADE;
TRUNCATE TABLE public.user_cards CASCADE;
TRUNCATE TABLE public.echo_pool CASCADE;
TRUNCATE TABLE public.nft_mint_requests CASCADE;
TRUNCATE TABLE public.global_supply CASCADE;

-- 3. RESET GAMEPLAY RECORDS, LEADERBOARDS & MILESTONES
TRUNCATE TABLE public.gameplay_records CASCADE;
TRUNCATE TABLE public.user_fragments CASCADE;
TRUNCATE TABLE public.campaign_milestone_claims CASCADE;
TRUNCATE TABLE public.telemetry_events CASCADE;
TRUNCATE TABLE public.play_events CASCADE;
TRUNCATE TABLE public.play_events_universal CASCADE;
TRUNCATE TABLE public.bonus_code_redemptions CASCADE;

-- 4. ARCHIVE CORE CREATOR / QA PROFILES
UPDATE public.profiles
SET is_alpha = TRUE, season_tag = 'alpha'
WHERE 
  COALESCE(display_name, '') ILIKE ANY (ARRAY['%th3scr1b3%', '%admin%', '%qa%'])
  OR COALESCE(username, '') ILIKE ANY (ARRAY['%th3scr1b3%', '%admin%', '%qa%']);

-- 5. RESET ALL NON-ARCHIVED PROFILES TO GEN 0 BASELINE
UPDATE public.profiles
SET 
  tokens = 0,
  tokens_earned_total = 0,
  tokens_spent_total = 0,
  total_pulls = 0,
  pulls_since_rare_plus = 0,
  pity_counter = 0,
  streak_count = 0,
  last_claim_day = 0,
  last_free_pack_day = 0,
  daily_standard_claims = 0,
  daily_premium_claims = 0,
  daily_standard_purchased = 0,
  daily_premium_purchased = 0,
  last_purchase_day = 0,
  total_burns = 0,
  daily_burns = 0,
  echo_pulls_received = 0,
  progression = '{"tutorialCompleted": false, "seenWelcomeModal": false, "noteGenerationSource": "manual"}'::jsonb,
  unlocked_cheats = '{"noclip": false, "iddqd": false}'::jsonb
WHERE is_alpha IS DISTINCT FROM TRUE;

-- 6. PUBLIC LEADERBOARD VIEW
CREATE OR REPLACE VIEW public.public_leaderboards AS
SELECT 
  gr.id,
  gr.user_id,
  COALESCE(p.display_name, p.username, 'ANON_' || SUBSTRING(gr.user_id::text, 1, 6)) AS display_name,
  p.avatar_url,
  p.wallet_address,
  gr.song_id,
  gr.score,
  gr.accuracy,
  gr.max_combo,
  gr.medal,
  gr.timestamp
FROM public.gameplay_records gr
JOIN public.profiles p ON gr.user_id = p.id
WHERE p.is_alpha = FALSE 
  AND gr.is_alpha = FALSE
  AND (gr.season_tag = 'gen_0' OR gr.season_tag IS NULL)
ORDER BY gr.score DESC;

COMMIT;`;

/**
 * Purges all development, test, and guest economy state from localStorage
 * while strictly preserving player hardware, audio, and visual preferences.
 */
export function purgeClientGen0State(): { cleanedKeys: number; preservedKeys: number } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { cleanedKeys: 0, preservedKeys: 0 };
  }

  // 1. Snapshot hardware & accessibility preferences to preserve
  const preservedPreferences: Record<string, string | null> = {
    opt_audioOffset: localStorage.getItem('opt_audioOffset'),
    opt_laneKey_0: localStorage.getItem('opt_laneKey_0'),
    opt_laneKey_1: localStorage.getItem('opt_laneKey_1'),
    opt_laneKey_2: localStorage.getItem('opt_laneKey_2'),
    opt_laneColor_0: localStorage.getItem('opt_laneColor_0'),
    opt_laneColor_1: localStorage.getItem('opt_laneColor_1'),
    opt_laneColor_2: localStorage.getItem('opt_laneColor_2'),
    opt_sfxVolume: localStorage.getItem('opt_sfxVolume'),
    opt_musicVolume: localStorage.getItem('opt_musicVolume'),
    opt_sfxEnabled: localStorage.getItem('opt_sfxEnabled'),
    opt_bgMusic: localStorage.getItem('opt_bgMusic'),
    opt_renderResolution: localStorage.getItem('opt_renderResolution'),
    opt_gfxLevel: localStorage.getItem('opt_gfxLevel'),
    opt_fpsTarget: localStorage.getItem('opt_fpsTarget'),
    opt_particleDensity: localStorage.getItem('opt_particleDensity'),
    opt_bloomGlow: localStorage.getItem('opt_bloomGlow'),
    opt_bgAnimation: localStorage.getItem('opt_bgAnimation'),
    opt_legacyGraphics: localStorage.getItem('opt_legacyGraphics'),
    opt_noteTheme: localStorage.getItem('opt_noteTheme'),
    opt_cardSkin: localStorage.getItem('opt_cardSkin'),
    opt_cardBack: localStorage.getItem('opt_cardBack'),
    opt_gameBackground: localStorage.getItem('opt_gameBackground'),
    opt_gameTrack: localStorage.getItem('opt_gameTrack'),
    opt_povMode: localStorage.getItem('opt_povMode'),
    opt_stagePovSwitch: localStorage.getItem('opt_stagePovSwitch'),
  };

  // 2. Identify keys to remove
  const keysToRemove: string[] = [
    'guest_wallet_address',
    'guest_vault_collection',
    'pim_tutorial_completed',
    'has_onboarded',
    'rc2_seen_key',
    'th3vault_dev_mode',
    'opt_unlocked_noclip',
    'opt_unlocked_iddqd',
    'opt_unlocked_pov',
  ];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('guest_daily_claimed_') ||
      key.startsWith('reward_tier_') ||
      key.startsWith('song_best_') ||
      key.startsWith('high_score_') ||
      key.startsWith('test_')
    )) {
      keysToRemove.push(key);
    }
  }

  // 3. Remove identified keys
  let removedCount = 0;
  keysToRemove.forEach((k) => {
    if (localStorage.getItem(k) !== null) {
      localStorage.removeItem(k);
      removedCount++;
    }
  });

  // 4. Restore preserved preferences
  let preservedCount = 0;
  Object.entries(preservedPreferences).forEach(([k, v]) => {
    if (v !== null) {
      localStorage.setItem(k, v);
      preservedCount++;
    }
  });

  console.log(`[Public Gen 0] Reset complete: ${removedCount} test keys removed, ${preservedCount} preferences preserved.`);
  return { cleanedKeys: removedCount, preservedKeys: preservedCount };
}

/**
 * Health check on current client storage state.
 */
export function getClientGen0Health() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { isClean: true, testKeys: [] };
  }

  const suspiciousKeys: string[] = [];
  const targetCheck = [
    'guest_wallet_address',
    'guest_vault_collection',
    'pim_tutorial_completed',
    'th3vault_dev_mode',
  ];

  targetCheck.forEach((k) => {
    if (localStorage.getItem(k) !== null) suspiciousKeys.push(k);
  });

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('guest_daily_claimed_') || k.startsWith('reward_tier_'))) {
      suspiciousKeys.push(k);
    }
  }

  return {
    isClean: suspiciousKeys.length === 0,
    testKeys: suspiciousKeys,
  };
}
