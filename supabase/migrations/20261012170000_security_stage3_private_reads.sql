-- Security stage 3: stop publishing every player's raw rows.
--
-- Before: anyone with the anon key could read every row of gameplay_records,
-- telemetry_events and profiles (full wallet addresses, settings, progression,
-- telemetry_data), and every Farcaster notification token (usable to push notifications
-- to that user as the app).
--
-- After: players read their own rows; admins (is_admin()) read everything; public
-- features use the SECURITY DEFINER functions below, which return only what those
-- features display. Wallets are exposed as first-6 + last-4 characters, which is all the
-- UI ever shows ("0x1234…abcd").
--
-- Ships with PIM client changes (leaderboards, ticker, username checks) and a Discord bot
-- change. Apply this migration, then merge/deploy those right away.

begin;

-- ── Shared helpers ───────────────────────────────────────────────────────────────────
-- "0x12345678…" -> "0x1234" || "abcd": callers keep doing slice(0,6) + '...' + slice(-4).
create or replace function public.mask_wallet(p_wallet text)
returns text
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case when p_wallet is null or length(p_wallet) < 10 then p_wallet
              else left(p_wallet, 6) || right(p_wallet, 4) end;
$$;

-- ── Public profile cards ─────────────────────────────────────────────────────────────
create or replace function public.get_public_profiles(p_ids uuid[])
returns table (id uuid, display_name text, username text, avatar_url text, wallet_address text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p.id, p.display_name, p.username, p.avatar_url, public.mask_wallet(p.wallet_address)
  from public.profiles p
  where p.id = any(p_ids[1:500]);
$$;

-- Global prestige fallback (paged), same columns LeaderboardPage reads.
create or replace function public.get_public_profiles_page(p_offset integer default 0, p_limit integer default 1000)
returns table (id uuid, display_name text, username text, avatar_url text, wallet_address text,
               streak_count integer, total_pulls integer)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select p.id, p.display_name, p.username, p.avatar_url, public.mask_wallet(p.wallet_address),
         p.streak_count, p.total_pulls
  from public.profiles p
  order by p.created_at, p.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 1000);
$$;

create or replace function public.is_username_taken(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(p_username))
      and id is distinct from auth.uid()
  );
$$;

create or replace function public.get_public_counts()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'players', (select count(*) from public.profiles),
    'cards',   (select count(*) from public.vault_collections)
  );
$$;

-- ── Leaderboards ─────────────────────────────────────────────────────────────────────
-- Personal best per player for a song (all of its alias ids), positive scores only.
create or replace function public.get_song_scores(p_song_ids text[], p_limit integer default 200)
returns table (user_id uuid, score integer, accuracy numeric, max_combo integer, medal text,
               "timestamp" timestamptz)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select b.user_id, b.score, b.accuracy, b.max_combo, b.medal, b."timestamp"
  from (
    select distinct on (g.user_id)
           g.user_id, g.score, g.accuracy::numeric, g.max_combo, g.medal, g."timestamp"
    from public.gameplay_records g
    where g.song_id = any(p_song_ids[1:50]) and g.score > 0 and g.user_id is not null
    order by g.user_id, g.score desc, g.accuracy desc nulls last
  ) b
  order by b.score desc
  limit least(greatest(p_limit, 1), 500);
$$;

-- Raw daily records for the daily leaderboard (the page aggregates per player).
create or replace function public.get_daily_scores(p_since timestamptz)
returns table (user_id uuid, song_id text, score integer, "timestamp" timestamptz)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select g.user_id, g.song_id, g.score, g."timestamp"
  from public.gameplay_records g
  where g."timestamp" >= greatest(p_since, now() - interval '7 days') and g.user_id is not null
  order by g."timestamp" desc
  limit 5000;
$$;

-- Recent scores (Discord bot activity feed).
create or replace function public.get_recent_scores(p_limit integer default 10)
returns table (user_id uuid, song_id text, score integer, accuracy numeric, max_combo integer,
               medal text, "timestamp" timestamptz)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select g.user_id, g.song_id, g.score, g.accuracy::numeric, g.max_combo, g.medal, g."timestamp"
  from public.gameplay_records g
  where g.user_id is not null
  order by g."timestamp" desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ── Activity ticker ──────────────────────────────────────────────────────────────────
-- Recent events of the given types, payload reduced to the fields the ticker renders.
create or replace function public.get_recent_activity(p_types text[], p_limit integer default 20)
returns table (id uuid, event_type text, payload jsonb, created_at timestamptz, user_id uuid)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select t.id, t.event_type,
         coalesce((
           select jsonb_object_agg(k, v)
           from jsonb_each(coalesce(t.payload, '{}'::jsonb)) as e(k, v)
           where k = any (array['songId', 'score', 'accuracy', 'completed', 'medal', 'tokensEarned',
                                'rarity', 'packType', 'count', 'day', 'cardId', 'rewardType',
                                'to', 'from', 'title'])
         ), '{}'::jsonb),
         t.created_at, t.user_id
  from public.telemetry_events t
  where t.event_type = any (p_types[1:30])
  order by t.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Everyone may call the public functions; mask_wallet is an internal helper.
do $$
declare f text;
begin
  foreach f in array array[
    'public.get_public_profiles(uuid[])',
    'public.get_public_profiles_page(integer, integer)',
    'public.is_username_taken(text)',
    'public.get_public_counts()',
    'public.get_song_scores(text[], integer)',
    'public.get_daily_scores(timestamptz)',
    'public.get_recent_scores(integer)',
    'public.get_recent_activity(text[], integer)'
  ] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ── Close the raw reads ──────────────────────────────────────────────────────────────
drop policy if exists "gameplay_records_read_all" on public.gameplay_records;
create policy "gameplay_records_read_own" on public.gameplay_records
  for select using (auth.uid() = user_id);
create policy "gameplay_records_read_admin" on public.gameplay_records
  for select to authenticated using (public.is_admin());

drop policy if exists "Public read telemetry events" on public.telemetry_events;
create policy "telemetry_events_read_own" on public.telemetry_events
  for select using (auth.uid() = user_id);
create policy "telemetry_events_read_admin" on public.telemetry_events
  for select to authenticated using (public.is_admin());

-- Own profile stays readable through "profiles_own" (ALL, auth.uid() = id).
drop policy if exists "Profiles are publicly readable for leaderboards" on public.profiles;
create policy "profiles_read_admin" on public.profiles
  for select to authenticated using (public.is_admin());

-- Only the farcaster-webhook Edge Function (service role) needs these.
drop policy if exists "client_select_farcaster_tokens" on public.farcaster_notification_tokens;

commit;
