/**
 * Guest → account migration.
 *
 * When an anonymous guest signs in and the auth upgrade does NOT happen
 * in-place (email+password sign-up, wallet sign-in, or the
 * identity_already_exists → direct sign-in fallback), the guest's progress
 * lives under the abandoned anonymous user id. This module moves it.
 *
 * Flow:
 *   1. Before any anon→real auth transition, call stashGuestSessionForMigration().
 *      It snapshots the anonymous session's tokens into sessionStorage (no-op
 *      unless the current user is actually anonymous).
 *   2. After the new session is established, maybeMigrateGuestData() merges the
 *      guest's progress into the real account. Merge semantics are deliberately
 *      farm-safe: counters take MAX (never SUM), cards dedupe, tokens take MAX.
 *   3. Card rows live in vault_collections, which only the vault-engine edge
 *      function (service role) can write. If the engine doesn't know the
 *      migrateGuestCollection action yet (not deployed), the guest token is
 *      parked and retried on later boots until it succeeds.
 *
 * Every step is idempotent, so a crash or retry can never double-apply.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';
import { transmission } from '../store/useTransmissionStore';

const STASH_KEY = 'pim_guest_migration_stash';
const PENDING_CARDS_KEY = 'pim_guest_cards_pending';
const STASH_TTL_MS = 1000 * 60 * 60 * 6; // 6h — enough to survive the OAuth dance

export interface GuestStash {
  access_token: string;
  refresh_token: string;
  user_id: string;
  stashed_at: number;
}

export interface MigrationResult {
  attempted: boolean;
  cardsMigrated?: number;
  cardsPendingEngineDeploy?: boolean;
  error?: string;
}

let migrationInFlight = false;

const isAnonUser = (u: any): boolean =>
  !!u && (u.is_anonymous === true || u?.app_metadata?.provider === 'anonymous');

/**
 * Snapshot the current anonymous session so a later sign-in can migrate its
 * progress. Safe to call from every sign-in entry point — no-ops unless the
 * current user is anonymous.
 */
export async function stashGuestSessionForMigration(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session || !isAnonUser(session.user)) return;
    const stash: GuestStash = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user_id: session.user.id,
      stashed_at: Date.now(),
    };
    sessionStorage.setItem(STASH_KEY, JSON.stringify(stash));
    console.log('[GuestMigration] Stashed guest session for', stash.user_id.slice(0, 8));
  } catch (err) {
    console.warn('[GuestMigration] Failed to stash guest session:', err);
  }
}

export function peekGuestStash(): GuestStash | null {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const stash = JSON.parse(raw) as GuestStash;
    if (!stash?.access_token || !stash?.user_id) return null;
    if (Date.now() - (stash.stashed_at || 0) > STASH_TTL_MS) {
      sessionStorage.removeItem(STASH_KEY);
      return null;
    }
    return stash;
  } catch {
    return null;
  }
}

export function clearGuestStash(): void {
  try { sessionStorage.removeItem(STASH_KEY); } catch { /* noop */ }
}

/** Non-persisting client authenticated as the guest, for reading guest rows. */
async function getGuestClient(stash: GuestStash): Promise<SupabaseClient | null> {
  try {
    const guest = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await guest.auth.setSession({
      access_token: stash.access_token,
      refresh_token: stash.refresh_token,
    });
    if (error || !data.session || data.session.user.id !== stash.user_id) {
      console.warn('[GuestMigration] Guest session invalid/expired:', error?.message);
      return null;
    }
    return guest;
  } catch (err) {
    console.warn('[GuestMigration] Could not establish guest client:', err);
    return null;
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const isBlankName = (n: unknown): boolean =>
  !n || (typeof n === 'string' && (/^anon_/i.test(n) || /^user_[0-9a-f-]{6,}/i.test(n)));

function mergeProfiles(guest: any, own: any): Record<string, unknown> {
  const g = guest || {};
  const o = own || {};
  const merged: Record<string, unknown> = {
    // Farm-safe: counters take the best of either side, never summed.
    tokens: Math.max(num(g.tokens), num(o.tokens)),
    streak_count: Math.max(num(g.streak_count), num(o.streak_count)),
    total_pulls: Math.max(num(g.total_pulls), num(o.total_pulls)),
    pulls_since_rare_plus: Math.max(num(g.pulls_since_rare_plus), num(o.pulls_since_rare_plus)),
    total_burns: Math.max(num(g.total_burns), num(o.total_burns)),
    // last_claim_day gates the free daily drop — MAX so a day the guest
    // already claimed can't be claimed again on the account.
    last_claim_day: Math.max(num(g.last_claim_day), num(o.last_claim_day)),
    has_onboarded: Boolean(g.has_onboarded || o.has_onboarded),
    unlocked_skins: [...new Set([...(o.unlocked_skins || []), ...(g.unlocked_skins || [])])],
    // JSON blobs: account wins on conflicts, guest fills gaps. Tutorial
    // completion is monotonic — once done anywhere, it stays done.
    settings: { ...(g.settings || {}), ...(o.settings || {}) },
    progression: {
      ...(g.progression || {}),
      ...(o.progression || {}),
      tutorialCompleted: Boolean(g.progression?.tutorialCompleted || o.progression?.tutorialCompleted),
    },
    unlocked_cheats: { ...(g.unlocked_cheats || {}), ...(o.unlocked_cheats || {}) },
  };
  // Identity fields: keep the account's unless it's blank/anon-generated.
  if (isBlankName(o.username) && !isBlankName(g.username)) merged.username = g.username;
  if (!o.display_name && g.display_name) merged.display_name = g.display_name;
  if (!o.avatar_url && g.avatar_url) merged.avatar_url = g.avatar_url;
  // Never touched: wallet_address (would orphan on-chain assets), daily
  // purchase counters (tied to stripe_orders, which don't migrate), id.
  return merged;
}

async function migrateProfiles(guest: SupabaseClient, guestId: string, userId: string): Promise<void> {
  const { data: guestProfile } = await guest.from('profiles').select('*').eq('id', guestId).maybeSingle();
  if (!guestProfile) {
    console.log('[GuestMigration] No guest profile row — skipping profile merge.');
    return;
  }
  const { data: ownProfile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  const merged = mergeProfiles(guestProfile, ownProfile);
  if (ownProfile) {
    const { error } = await supabase.from('profiles').update(merged).eq('id', userId);
    if (error) throw new Error(`profile update: ${error.message}`);
  } else {
    const { error } = await supabase.from('profiles').insert({ id: userId, ...merged });
    if (error) {
      // Lost the race with ensureProfileAndWallet's own insert — fall back to update.
      if (/duplicate|conflict|already exists/i.test(error.message)) {
        const { error: updateErr } = await supabase.from('profiles').update(merged).eq('id', userId);
        if (updateErr) throw new Error(`profile update: ${updateErr.message}`);
      } else {
        throw new Error(`profile insert: ${error.message}`);
      }
    }
  }
  console.log('[GuestMigration] Profile merged.');
}

async function migrateFragments(guest: SupabaseClient, guestId: string, userId: string): Promise<void> {
  const { data: guestRows } = await guest.from('user_fragments').select('fragment_id, amount').eq('user_id', guestId);
  if (!guestRows?.length) return;
  for (const row of guestRows) {
    try {
      const { data: own } = await supabase
        .from('user_fragments')
        .select('id, amount')
        .eq('user_id', userId)
        .eq('fragment_id', row.fragment_id)
        .maybeSingle();
      const best = Math.max(num(row.amount), num((own as any)?.amount));
      if ((own as any)?.id) {
        await supabase.from('user_fragments').update({ amount: best }).eq('id', (own as any).id);
      } else {
        await supabase.from('user_fragments').insert({
          user_id: userId,
          fragment_id: row.fragment_id,
          amount: best,
          acquired_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[GuestMigration] Fragment merge skipped for', row.fragment_id, err);
    }
  }
  console.log(`[GuestMigration] Merged ${guestRows.length} fragment rows.`);
}

async function migrateMilestoneClaims(guest: SupabaseClient, guestId: string, userId: string): Promise<void> {
  const { data: guestRows } = await guest
    .from('campaign_milestone_claims')
    .select('chapter, milestone_index')
    .eq('user_id', guestId);
  if (!guestRows?.length) return;
  const { data: ownRows } = await supabase
    .from('campaign_milestone_claims')
    .select('chapter, milestone_index')
    .eq('user_id', userId);
  const ownKeys = new Set((ownRows || []).map((r: any) => `${r.chapter}:${r.milestone_index}`));
  let added = 0;
  for (const row of guestRows as any[]) {
    const key = `${row.chapter}:${row.milestone_index}`;
    if (ownKeys.has(key)) continue;
    try {
      const { error } = await supabase.from('campaign_milestone_claims').insert({
        user_id: userId,
        chapter: row.chapter,
        milestone_index: row.milestone_index,
      });
      if (!error) { added++; ownKeys.add(key); }
    } catch (err) {
      console.warn('[GuestMigration] Milestone claim insert skipped:', err);
    }
  }
  console.log(`[GuestMigration] Migrated ${added} milestone claims.`);
}

async function migrateNotificationReads(guest: SupabaseClient, guestId: string, userId: string): Promise<void> {
  const { data: guestRows } = await guest
    .from('user_notification_reads')
    .select('announcement_id, read_at, dismissed')
    .eq('user_id', guestId);
  if (!guestRows?.length) return;
  try {
    const upserts = (guestRows as any[]).map((r) => ({
      user_id: userId,
      announcement_id: r.announcement_id,
      read_at: r.read_at || new Date().toISOString(),
      dismissed: !!r.dismissed,
    }));
    const { error } = await supabase
      .from('user_notification_reads')
      .upsert(upserts, { onConflict: 'user_id,announcement_id' });
    if (error) throw new Error(error.message);
    console.log(`[GuestMigration] Migrated ${upserts.length} notification reads.`);
  } catch (err) {
    console.warn('[GuestMigration] Notification reads migration skipped:', err);
  }
}

async function migrateGameplayRecords(guest: SupabaseClient, guestId: string, userId: string): Promise<void> {
  // Best-effort: gameplay_rows are server-authoritative (submit_score RPC), so
  // direct inserts may be RLS-blocked. A failure here is non-fatal — the merged
  // high scores still show from localStorage until the next real session.
  const { data: guestRows, error: readErr } = await guest
    .from('gameplay_records')
    .select('*')
    .eq('user_id', guestId)
    .range(0, 4999);
  if (readErr || !guestRows?.length) return;
  let moved = 0;
  for (const row of guestRows as any[]) {
    try {
      const copy: Record<string, unknown> = { ...row };
      delete copy.id;
      copy.user_id = userId;
      const { error } = await supabase.from('gameplay_records').insert(copy);
      if (!error) moved++;
      else break; // RLS-blocked — stop trying, stay quiet
    } catch {
      break;
    }
  }
  console.log(`[GuestMigration] Migrated ${moved}/${guestRows.length} gameplay records.`);
}

/**
 * Card migration goes through the vault-engine edge function (service role is
 * the only writer to vault_collections). The guest client refreshes the access
 * token first, so the engine always sees a live token.
 */
type CardMigrationOutcome =
  | { status: 'ok'; migrated: number }
  | { status: 'not_deployed' }
  | { status: 'rate_limited' };

async function migrateCardsViaEngine(guest: SupabaseClient): Promise<CardMigrationOutcome> {
  const { data: { session } } = await guest.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Guest session has no access token');
  const { data, error } = await supabase.functions.invoke('vault-engine', {
    body: {
      action: 'migrateGuestCollection',
      payload: { guest_access_token: token },
    },
  });
  if (error) {
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('unknown action')) return { status: 'not_deployed' }; // engine predates the action
    throw new Error(`card migration: ${error.message}`);
  }
  if ((data as any)?.error) throw new Error(`card migration: ${(data as any).error}`);
  if ((data as any)?.rateLimited) return { status: 'rate_limited' };
  return { status: 'ok', migrated: num((data as any)?.migrated) };
}

function parkGuestCardsForRetry(stash: GuestStash): void {
  try { sessionStorage.setItem(PENDING_CARDS_KEY, JSON.stringify(stash)); } catch { /* noop */ }
}

export function peekPendingGuestCards(): GuestStash | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CARDS_KEY);
    if (!raw) return null;
    const stash = JSON.parse(raw) as GuestStash;
    if (!stash?.access_token || !stash?.user_id) return null;
    if (Date.now() - (stash.stashed_at || 0) > STASH_TTL_MS) {
      sessionStorage.removeItem(PENDING_CARDS_KEY);
      return null;
    }
    return stash;
  } catch {
    return null;
  }
}

/** Retry a parked card migration (runs on boot while a real user is signed in). */
export async function maybeMigratePendingGuestCards(): Promise<void> {
  const stash = peekPendingGuestCards();
  if (!stash || migrationInFlight) return;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || isAnonUser(user) || user.id === stash.user_id) return;
  migrationInFlight = true;
  try {
    const guest = await getGuestClient(stash);
    if (!guest) {
      // Guest session (including refresh token) is truly gone — stop retrying.
      try { sessionStorage.removeItem(PENDING_CARDS_KEY); } catch { /* noop */ }
      console.warn('[GuestMigration] Parked guest session expired; dropping card retry.');
      return;
    }
    let outcome: CardMigrationOutcome;
    try {
      outcome = await migrateCardsViaEngine(guest);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/invalid or expired guest session|not a guest/i.test(msg)) {
        try { sessionStorage.removeItem(PENDING_CARDS_KEY); } catch { /* noop */ }
        console.warn('[GuestMigration] Parked guest session rejected; dropping card retry.');
        return;
      }
      throw err;
    }
    if (outcome.status !== 'ok') return; // not deployed or rate-limited — keep parked
    sessionStorage.removeItem(PENDING_CARDS_KEY);
    try {
      const { useVaultStore } = await import('../store/useVaultStore');
      await useVaultStore.getState().loadVaultData(true);
    } catch { /* noop */ }
    transmission.success(
      'GUEST CARDS ARRIVED',
      outcome.migrated > 0 ? `${outcome.migrated} card${outcome.migrated === 1 ? '' : 's'} moved into your collection.` : 'Your guest collection is now on this account.',
      { duration: 8000 }
    );
    console.log(`[GuestMigration] Parked card migration completed: ${outcome.migrated} cards.`);
  } catch (err) {
    console.warn('[GuestMigration] Parked card migration failed, will retry:', err instanceof Error ? err.message : String(err));
  } finally {
    migrationInFlight = false;
  }
}

/**
 * Main entry: if a guest session was stashed and the current user is a
 * *different, real* user, merge the guest's progress into this account.
 * Idempotent; safe to call from initialize() and onAuthStateChange.
 */
export async function maybeMigrateGuestData(): Promise<MigrationResult> {
  const stash = peekGuestStash();
  if (!stash || migrationInFlight) return { attempted: false };
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || isAnonUser(user) || user.id === stash.user_id) {
    if (user && user.id === stash.user_id) clearGuestStash();
    return { attempted: false };
  }

  migrationInFlight = true;
  const summary: string[] = [];
  let cardsMigrated: number | undefined;
  let cardsPendingEngineDeploy = false;
  try {
    console.log('[GuestMigration] Migrating guest', stash.user_id.slice(0, 8), '→', user.id.slice(0, 8));
    const guest = await getGuestClient(stash);
    if (!guest) {
      return { attempted: true, error: 'Guest session expired before migration.' };
    }

    await migrateProfiles(guest, stash.user_id, user.id);
    summary.push('profile');
    await migrateFragments(guest, stash.user_id, user.id);
    await migrateMilestoneClaims(guest, stash.user_id, user.id);
    await migrateNotificationReads(guest, stash.user_id, user.id);
    await migrateGameplayRecords(guest, stash.user_id, user.id);

    // Cards need the edge function. Park the token if the engine isn't there
    // yet (or rate-limited) so a later boot can finish the job.
    try {
      const outcome = await migrateCardsViaEngine(guest);
      if (outcome.status === 'not_deployed') {
        cardsPendingEngineDeploy = true;
        parkGuestCardsForRetry(stash);
        console.warn('[GuestMigration] vault-engine predates migrateGuestCollection — cards parked for retry.');
      } else if (outcome.status === 'rate_limited') {
        parkGuestCardsForRetry(stash);
        summary.push('cards delayed');
        console.warn('[GuestMigration] Card migration rate-limited — parked for retry after 24h.');
      } else {
        cardsMigrated = outcome.migrated;
        summary.push(`${outcome.migrated} cards`);
      }
    } catch (err) {
      console.warn('[GuestMigration] Card migration failed (non-fatal):', err);
      summary.push('cards skipped');
    }

    // Refresh the vault view so merged state shows immediately.
    try {
      const { useVaultStore } = await import('../store/useVaultStore');
      await useVaultStore.getState().loadVaultData(true);
    } catch (err) {
      console.warn('[GuestMigration] Post-migration reload failed:', err);
    }

    transmission.success(
      'PROGRESS MERGED',
      cardsPendingEngineDeploy
        ? 'Streaks, scores and settings moved to your account. Cards will follow once the engine update is deployed.'
        : `Your guest progress (${summary.join(', ')}) is now on this account.`,
      { duration: 9000 }
    );
    return { attempted: true, cardsMigrated, cardsPendingEngineDeploy };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GuestMigration] Migration failed:', msg);
    return { attempted: true, error: msg };
  } finally {
    clearGuestStash();
    migrationInFlight = false;
  }
}
