-- Audius weekly top-5 contest (2026-11-09).
--
-- Each week (Monday 00:00 UTC to the next Monday) PIM features the week's top 5
-- trending tracks on Audius by other artists. Players chart them in PIM; a player's
-- weekly score is the sum of their best run on each of the 5 songs, counting runs
-- made during that week. When the week is over, the top 10 claim claw pulls:
--   1st 5 pulls · 2nd 3 · 3rd 2 · 4th-10th 1 each.
--
-- Contest songs use the game id "aud-<audius track id>". The week's 5 are picked and
-- locked by vault-engine (getAudiusWeeklyContest), which fetches Audius trending
-- server-side and calls create_audius_weekly_contest(); clients cannot choose them.
-- That function also lists each song in song_max_scores so request_run_token /
-- submit_score accept its runs (same run tokens and caps as every other song).
--
-- Tables
--   audius_weekly_contests        one row per week: the 5 locked tracks. Readable by all.
--   audius_contest_prize_claims   one row per (week, player) paid. Read-own.
--
-- Functions
--   audius_week_start(ts)                   Monday (UTC) of the week holding ts.
--   get_audius_contest_board(week, limit)   weekly ranking (anyone).
--   claim_audius_contest_prize(week)        pays the caller's pulls once (authenticated).
--   create_audius_weekly_contest(week, tracks)  locks a week's songs (service role).
--
-- Apply via the Supabase SQL editor. Idempotent.

begin;

-- ── Tables ─────────────────────────────────────────────────────────────────────────
create table if not exists public.audius_weekly_contests (
  week_start date primary key,
  -- [{ id, title, artist, handle, permalink, duration, artwork, genre }]
  tracks jsonb not null check (jsonb_typeof(tracks) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.audius_contest_prize_claims (
  week_start date not null references public.audius_weekly_contests (week_start) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  rank integer not null,
  pulls integer not null check (pulls > 0),
  claimed_at timestamptz not null default now(),
  primary key (week_start, owner_id)
);

alter table public.audius_weekly_contests enable row level security;
alter table public.audius_contest_prize_claims enable row level security;

drop policy if exists "audius_weekly_contests_read_all" on public.audius_weekly_contests;
create policy "audius_weekly_contests_read_all" on public.audius_weekly_contests
  for select using (true);

drop policy if exists "audius_contest_prize_claims_read_own" on public.audius_contest_prize_claims;
create policy "audius_contest_prize_claims_read_own" on public.audius_contest_prize_claims
  for select using (auth.uid() = owner_id);
drop policy if exists "audius_contest_prize_claims_read_admin" on public.audius_contest_prize_claims;
create policy "audius_contest_prize_claims_read_admin" on public.audius_contest_prize_claims
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.audius_weekly_contests from anon, authenticated;
revoke insert, update, delete on public.audius_contest_prize_claims from anon, authenticated;

-- ── Helpers ────────────────────────────────────────────────────────────────────────
create or replace function public.audius_week_start(p_at timestamptz default now())
returns date
language sql
immutable
set search_path = public, pg_catalog
as $$
  select date_trunc('week', p_at at time zone 'utc')::date;
$$;

create or replace function public.audius_contest_pulls(p_rank integer)
returns integer
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case
    when p_rank = 1 then 5
    when p_rank = 2 then 3
    when p_rank = 3 then 2
    when p_rank between 4 and 10 then 1
    else 0
  end;
$$;

-- ── Weekly ranking ─────────────────────────────────────────────────────────────────
-- Best run per (player, song) made during the week, summed over the week's 5 songs.
-- Ties go to whoever reached their total first.
create or replace function public.get_audius_contest_board(p_week date, p_limit integer default 50)
returns table (rank integer, user_id uuid, total_score bigint, songs_played integer,
               reached_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with contest as (
    select array_agg('aud-' || (t->>'id')) as song_ids
    from public.audius_weekly_contests c, jsonb_array_elements(c.tracks) t
    where c.week_start = p_week
  ),
  best as (
    select distinct on (g.user_id, g.song_id)
           g.user_id, g.song_id, g.score, g."timestamp"
    from public.gameplay_records g, contest
    where g.song_id = any(contest.song_ids)
      and g.score > 0 and g.user_id is not null
      and g."timestamp" >= p_week::timestamp at time zone 'utc'
      and g."timestamp" <  (p_week + 7)::timestamp at time zone 'utc'
    order by g.user_id, g.song_id, g.score desc, g."timestamp" asc
  ),
  totals as (
    select b.user_id, sum(b.score)::bigint as total_score, count(*)::integer as songs_played,
           max(b."timestamp") as reached_at
    from best b
    group by b.user_id
  )
  select (row_number() over (order by t.total_score desc, t.reached_at asc))::integer as rank,
         t.user_id, t.total_score, t.songs_played, t.reached_at
  from totals t
  order by rank
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ── Prize claim ────────────────────────────────────────────────────────────────────
create or replace function public.claim_audius_contest_prize(p_week date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_rank integer;
  v_pulls integer;
  v_credits integer;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'NOT_SIGNED_IN');
  end if;
  if not exists (select 1 from public.audius_weekly_contests where week_start = p_week) then
    return jsonb_build_object('success', false, 'error', 'NO_CONTEST');
  end if;
  if now() < (p_week + 7)::timestamp at time zone 'utc' then
    return jsonb_build_object('success', false, 'error', 'WEEK_NOT_OVER');
  end if;

  select b.rank into v_rank
  from public.get_audius_contest_board(p_week, 10) b
  where b.user_id = v_uid;

  v_pulls := public.audius_contest_pulls(coalesce(v_rank, 0));
  if v_pulls <= 0 then
    return jsonb_build_object('success', false, 'error', 'NOT_A_WINNER');
  end if;

  begin
    insert into public.audius_contest_prize_claims (week_start, owner_id, rank, pulls)
    values (p_week, v_uid, v_rank, v_pulls);
  exception when unique_violation then
    return jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  end;

  insert into public.claw_credits (owner_id, credits) values (v_uid, v_pulls)
  on conflict (owner_id) do update
    set credits = public.claw_credits.credits + excluded.credits, updated_at = now()
  returning credits into v_credits;

  return jsonb_build_object('success', true, 'rank', v_rank, 'pulls', v_pulls, 'credits', v_credits);
end;
$$;

-- ── Locking a week's songs (vault-engine) ──────────────────────────────────────────
-- Inserts the week once; a second call for the same week returns the locked row.
-- Lists each song in song_max_scores at 40,000 points per second of audio, the same
-- bound as the Beyond 365 tracks (runtime Chart Master charts, ~1.25x the densest
-- 365 chart).
create or replace function public.create_audius_weekly_contest(p_week date, p_tracks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row public.audius_weekly_contests%rowtype;
begin
  if jsonb_typeof(p_tracks) <> 'array' or jsonb_array_length(p_tracks) < 1
     or jsonb_array_length(p_tracks) > 10 then
    raise exception 'tracks must be an array of 1-10 tracks';
  end if;

  insert into public.audius_weekly_contests (week_start, tracks)
  values (p_week, p_tracks)
  on conflict (week_start) do nothing;

  select * into v_row from public.audius_weekly_contests where week_start = p_week;

  insert into public.song_max_scores (song_id, max_score, computed_from)
  select 'aud-' || (t->>'id'),
         least(2147483647, ceil(greatest(coalesce((t->>'duration')::numeric, 0), 60) * 40000))::integer,
         'audius-contest-runtime-v6'
  from jsonb_array_elements(v_row.tracks) t
  where coalesce(t->>'id', '') ~ '^[A-Za-z0-9]{1,32}$'
  on conflict (song_id) do nothing;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.get_audius_contest_board(date, integer) from public;
grant execute on function public.get_audius_contest_board(date, integer) to anon, authenticated;
revoke all on function public.claim_audius_contest_prize(date) from public, anon;
grant execute on function public.claim_audius_contest_prize(date) to authenticated;
revoke all on function public.create_audius_weekly_contest(date, jsonb) from public, anon, authenticated;
grant execute on function public.create_audius_weekly_contest(date, jsonb) to service_role;

commit;
