-- Audius weekly contest cards (2026-11-09).
--
-- Every week's 5 contest tracks get two collectible cards, built server-side by
-- build_audius_contest_cards() (the Monday 00:05 UTC pipeline calls it once the
-- week's contest is locked):
--
--   standard   card_id 'aud-<track id>'           rarity 'rare'
--              earned ONLY by clearing the track that week (a gameplay_records
--              run with medal <> 'NONE' on song 'aud-<track id>').
--   bombshell  card_id 'bombshell-aud-<track id>' rarity 'legendary'
--              earned ONLY by clearing the track's Deluxe chart that week
--              (song 'aud-<track id>_deluxe').
--
-- Claimed cards are ordinary vault_collections rows (source 'audius_contest' /
-- 'audius_contest_deluxe'); nothing about them is purchasable or pack-rollable.
-- Claims are backed by the player's own recorded run, one card per player per
-- track per kind, in the pattern of gameplay_reward_payouts / the contest
-- prize claim. No 30-minute claim window: a clear earns its card for good.
--
-- The build also lists each track's Deluxe id in song_max_scores at 2.5x the
-- standard cap (the established Deluxe bound from
-- 20261024120000_deluxe_song_max_scores.sql) — without it submit_score rejects
-- Deluxe runs of contest songs, so no Deluxe clear could ever be recorded.
--
-- Tables
--   audius_contest_cards         one row per (week, track, kind). Readable by all.
--   audius_contest_card_claims   one row per (week, track, kind, player). Read-own.
--
-- Functions
--   build_audius_contest_cards(week)          locks a week's 10 cards (service role).
--   get_audius_contest_card_status(week)      per-card cleared/claimed for the caller.
--   claim_audius_contest_card(week, track, kind)  grants the caller's earned card.
--
-- Apply via the Supabase SQL editor. Idempotent.

begin;

-- ── Tables ───────────────────────────────────────────────────────────────────
create table if not exists public.audius_contest_cards (
  week_start date not null references public.audius_weekly_contests (week_start) on delete cascade,
  track_id text not null,
  kind text not null check (kind in ('standard', 'bombshell')),
  card_id text not null unique,
  title text not null,
  artist text not null,
  handle text not null,
  permalink text not null,
  artwork text,
  genre text,
  duration integer not null,
  built_at timestamptz not null default now(),
  primary key (week_start, track_id, kind)
);

create table if not exists public.audius_contest_card_claims (
  week_start date not null references public.audius_weekly_contests (week_start) on delete cascade,
  track_id text not null,
  kind text not null check (kind in ('standard', 'bombshell')),
  owner_id uuid not null references auth.users (id) on delete cascade,
  record_id text not null,
  card_row_id uuid references public.vault_collections (id) on delete set null,
  claimed_at timestamptz not null default now(),
  primary key (week_start, track_id, kind, owner_id)
);

alter table public.audius_contest_cards enable row level security;
alter table public.audius_contest_card_claims enable row level security;

drop policy if exists "audius_contest_cards_read_all" on public.audius_contest_cards;
create policy "audius_contest_cards_read_all" on public.audius_contest_cards
  for select using (true);

drop policy if exists "audius_contest_card_claims_read_own" on public.audius_contest_card_claims;
create policy "audius_contest_card_claims_read_own" on public.audius_contest_card_claims
  for select using (auth.uid() = owner_id);
drop policy if exists "audius_contest_card_claims_read_admin" on public.audius_contest_card_claims;
create policy "audius_contest_card_claims_read_admin" on public.audius_contest_card_claims
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.audius_contest_cards from anon, authenticated;
revoke insert, update, delete on public.audius_contest_card_claims from anon, authenticated;

-- ── Card maker ───────────────────────────────────────────────────────────────
-- Builds the week's 10 cards from the locked contest row (idempotent), and
-- lists the week's Deluxe song ids so Deluxe clears can be recorded at all.
create or replace function public.build_audius_contest_cards(p_week date)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_built integer := 0;
  v_n integer;
begin
  if not exists (select 1 from public.audius_weekly_contests where week_start = p_week) then
    raise exception 'no audius contest locked for week %', p_week;
  end if;

  insert into public.audius_contest_cards
    (week_start, track_id, kind, card_id, title, artist, handle, permalink, artwork, genre, duration)
  select p_week,
         t->>'id',
         k.kind,
         case k.kind when 'standard' then 'aud-' || (t->>'id')
                     else 'bombshell-aud-' || (t->>'id') end,
         t->>'title', t->>'artist', t->>'handle', t->>'permalink',
         t->>'artwork', t->>'genre', coalesce((t->>'duration')::integer, 0)
  from public.audius_weekly_contests c, jsonb_array_elements(c.tracks) t
  cross join (values ('standard'), ('bombshell')) as k(kind)
  where c.week_start = p_week
  on conflict (week_start, track_id, kind) do nothing;
  get diagnostics v_n = row_count;
  v_built := v_built + v_n;

  insert into public.song_max_scores (song_id, max_score, computed_from)
  select s.song_id || '_deluxe',
         least(2147483647, ceil(s.max_score * 2.5))::integer,
         'deluxe-2.5x'
  from public.song_max_scores s
  join public.audius_weekly_contests c on c.week_start = p_week
  where s.song_id in (select 'aud-' || (t->>'id')
                      from jsonb_array_elements(c.tracks) t)
  on conflict (song_id) do nothing;

  return v_built;
end;
$$;

-- ── Per-card status for the caller ───────────────────────────────────────────
create or replace function public.get_audius_contest_card_status(p_week date)
returns table (track_id text, kind text, card_id text, cleared boolean, claimed boolean)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select c.track_id, c.kind, c.card_id,
    exists (
      select 1 from public.gameplay_records g
      where g.user_id = auth.uid()
        and g.song_id = case c.kind when 'standard' then 'aud-' || c.track_id
                                    else 'aud-' || c.track_id || '_deluxe' end
        and upper(coalesce(g.medal, 'NONE')) <> 'NONE'
        and g."timestamp" >= p_week::timestamp at time zone 'utc'
        and g."timestamp" <  (p_week + 7)::timestamp at time zone 'utc'
    ) as cleared,
    exists (
      select 1 from public.audius_contest_card_claims cl
      where cl.week_start = p_week and cl.track_id = c.track_id
        and cl.kind = c.kind and cl.owner_id = auth.uid()
    ) as claimed
  from public.audius_contest_cards c
  where c.week_start = p_week
  order by c.track_id, c.kind;
$$;

-- ── Claim ────────────────────────────────────────────────────────────────────
-- Grants the card the caller's recorded clear earned. The claim row is the
-- ledger (one per player/track/kind); the card lands in vault_collections.
create or replace function public.claim_audius_contest_card(p_week date, p_track_id text, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_card public.audius_contest_cards%rowtype;
  v_song text;
  v_record text;
  v_row_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'NOT_SIGNED_IN');
  end if;
  if p_kind not in ('standard', 'bombshell') then
    return jsonb_build_object('success', false, 'error', 'BAD_KIND');
  end if;

  select * into v_card from public.audius_contest_cards
  where week_start = p_week and track_id = p_track_id and kind = p_kind;
  if not found then
    return jsonb_build_object('success', false, 'error', 'NO_CARD');
  end if;

  if exists (select 1 from public.audius_contest_card_claims
             where week_start = p_week and track_id = p_track_id
               and kind = p_kind and owner_id = v_uid) then
    return jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  end if;

  v_song := case p_kind when 'standard' then 'aud-' || p_track_id
                        else 'aud-' || p_track_id || '_deluxe' end;

  select g.id::text into v_record
  from public.gameplay_records g
  where g.user_id = v_uid and g.song_id = v_song
    and upper(coalesce(g.medal, 'NONE')) <> 'NONE'
    and g."timestamp" >= p_week::timestamp at time zone 'utc'
    and g."timestamp" <  (p_week + 7)::timestamp at time zone 'utc'
  order by g.score desc
  limit 1;
  if v_record is null then
    return jsonb_build_object('success', false, 'error',
      case p_kind when 'standard' then 'NO_CLEAR' else 'NO_DELUXE_CLEAR' end);
  end if;

  begin
    insert into public.audius_contest_card_claims
      (week_start, track_id, kind, owner_id, record_id)
    values (p_week, p_track_id, p_kind, v_uid, v_record);
  exception when unique_violation then
    return jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  end;

  insert into public.vault_collections
    (owner_id, card_id, rarity, source, fingerprint, claimed_at)
  values (
    v_uid,
    v_card.card_id,
    case p_kind when 'standard' then 'rare' else 'legendary' end,
    case p_kind when 'standard' then 'audius_contest' else 'audius_contest_deluxe' end,
    case p_kind when 'bombshell' then v_card.artwork else null end,
    now()
  )
  returning id into v_row_id;

  update public.audius_contest_card_claims
  set card_row_id = v_row_id
  where week_start = p_week and track_id = p_track_id
    and kind = p_kind and owner_id = v_uid;

  return jsonb_build_object('success', true, 'card_id', v_card.card_id,
                            'kind', p_kind, 'card_row_id', v_row_id);
end;
$$;

revoke all on function public.build_audius_contest_cards(date) from public, anon, authenticated;
grant execute on function public.build_audius_contest_cards(date) to service_role;
revoke all on function public.get_audius_contest_card_status(date) from public;
grant execute on function public.get_audius_contest_card_status(date) to authenticated;
revoke all on function public.claim_audius_contest_card(date, text, text) from public, anon;
grant execute on function public.claim_audius_contest_card(date, text, text) to authenticated;

commit;
