/**
 * Custom song (Ultra reward) claims and Mythic stem downloads.
 * Server side: supabase/migrations/20261030090000_reward_claims.sql and api/stems.ts.
 */
import { supabase } from './supabaseClient';
import { getAdminConfig } from '../utils/adminConfig';

export interface UltraRewardStats {
  /** Ultra (custom song) cards that exist in any vault. */
  found: number;
  /** Of those, how many owners have submitted a claim. */
  claimed: number;
  /** Most custom song awards that can drop (admin config). */
  max: number;
  mythicStemsClaimed: number;
}

export async function getUltraRewardStats(): Promise<UltraRewardStats | null> {
  const max = getAdminConfig().ultraRewardMax;
  const { data, error } = await supabase.rpc('get_ultra_reward_stats');
  if (!error && data) {
    const d = data as { found?: number; claimed?: number; mythic_stems_claimed?: number };
    return { found: Number(d.found) || 0, claimed: Number(d.claimed) || 0, max, mythicStemsClaimed: Number(d.mythic_stems_claimed) || 0 };
  }

  // Before the migration is applied: vault_collections is publicly readable, so count
  // found directly. Claims were only kept in each player's browser, so claimed is unknown.
  const { count, error: countError } = await supabase
    .from('vault_collections')
    .select('id', { count: 'exact', head: true })
    .not('ultra_reward', 'is', null)
    .neq('ultra_reward', false);
  if (countError || count === null) return null;
  return { found: count, claimed: 0, max, mythicStemsClaimed: 0 };
}

/** Record claims for the caller's Ultra cards. Returns the ids now claimed, or null if the server could not record them. */
export async function claimUltraRewards(collectionIds: string[]): Promise<string[] | null> {
  const { data, error } = await supabase.rpc('claim_ultra_reward', { p_collection_ids: collectionIds });
  if (error) {
    console.warn('[rewardClaims] claim_ultra_reward failed:', error.message);
    return null;
  }
  return (data as string[]) || [];
}

/** Ids of the caller's Ultra cards that already have a claim on record. */
export async function fetchClaimedUltraIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('ultra_reward_claims').select('collection_id');
  if (error || !data) return new Set();
  return new Set(data.map((r: { collection_id: string }) => r.collection_id));
}

export interface StemsClaimResult { ok: boolean; url?: string; day?: number; error?: string }

/** Claim the stems for one Mythic card in the caller's vault and get its download link. */
export async function claimMythicStems(collectionId: string): Promise<StemsClaimResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: 'Sign in to claim stems.' };
  try {
    const res = await fetch('/api/stems', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ cardId: collectionId }),
    });
    const body = await res.json().catch(() => null) as { url?: string; day?: number; error?: string } | null;
    if (!res.ok || !body?.url) return { ok: false, error: body?.error || 'Could not claim stems. Try again.' };
    return { ok: true, url: body.url, day: body.day ?? 0 };
  } catch {
    return { ok: false, error: 'Could not reach the vault. Try again.' };
  }
}
