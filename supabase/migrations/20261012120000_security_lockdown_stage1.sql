-- Security lockdown, stage 1: close writes that need no login at all.
--
-- Several policies named "Service role can manage …" were granted to PUBLIC with
-- USING (true) and no WITH CHECK. Combined with Supabase's default table grants, that let
-- anyone holding the public anon key insert, update or delete any row. The service role
-- bypasses RLS, so these policies were never needed for the Edge Functions.
--
-- Every change below was checked against browser code in PIM, the user hub, the main site
-- and the mini app (2026-10-12). Public reads that the apps rely on are kept.
-- Not in this stage (needs app changes first): client-side token writes on profiles,
-- public reads of gameplay_records / telemetry_events / profiles.

begin;

-- ── vault_collections ────────────────────────────────────────────────────────────────
-- Anyone could mint, edit or delete any player's cards.
drop policy if exists "Service role can manage collections" on public.vault_collections;

-- Owners could insert any card at any rarity into their own collection. Cards are granted by
-- vault-engine / stripe-webhook (service role); no browser code writes this table.
drop policy if exists "vault_own" on public.vault_collections;
create policy "vault_own_read" on public.vault_collections
  for select using (auth.uid() = owner_id);
-- ("Vault collections are publicly readable for leaderboards" still provides public reads.)

-- ── global_supply ────────────────────────────────────────────────────────────────────
-- Anyone could rewrite edition counters and supply caps. PIM reads supply for display.
drop policy if exists "Service role can manage supply" on public.global_supply;
create policy "global_supply_public_read" on public.global_supply
  for select using (true);

-- ── echo_pool ────────────────────────────────────────────────────────────────────────
-- Anyone could add, edit or remove pending echo cards. Writes go through vault-engine;
-- admins keep "echo_pool_admin_manage" (is_admin()). PIM reads the pool.
drop policy if exists "Service role can manage echo pool" on public.echo_pool;
create policy "echo_pool_public_read" on public.echo_pool
  for select using (true);

-- ── museum_videos ────────────────────────────────────────────────────────────────────
-- Was open for every operation to everyone. PIM inserts a row after a signed-in player
-- exports a video and reads them on the hero landing page; nothing updates or deletes.
drop policy if exists "Allow insert museum videos" on public.museum_videos;
create policy "museum_videos_public_read" on public.museum_videos
  for select using (true);
create policy "museum_videos_insert_signed_in" on public.museum_videos
  for insert to authenticated with check (true);

-- ── farcaster_notification_tokens ────────────────────────────────────────────────────
-- Anyone could insert or overwrite notification tokens (redirecting another user's
-- notifications). Only the farcaster-webhook Edge Function (service role) writes them.
drop policy if exists "client_insert_farcaster_tokens" on public.farcaster_notification_tokens;
drop policy if exists "client_update_farcaster_tokens" on public.farcaster_notification_tokens;

commit;
