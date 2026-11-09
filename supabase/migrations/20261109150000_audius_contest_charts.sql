-- Baked charts and card art for the Audius weekly top-5 contest (2026-11-09).
--
-- Every player in a week should play the same chart. Browsers decode MP3 slightly
-- differently, so a chart forged in each browser can differ by a few notes. A weekly
-- GitHub Action (.github/workflows/audius-contest-charts.yml) locks the week's songs,
-- bakes each chart with Chart Master (scripts/audius/bake_contest_charts.ts, same
-- generator as the game) and stores it here. The game loads the baked chart for an
-- "aud-<id>" song and only forges one in the browser when none exists.
--
-- Writes come from the Action with the service role key. Everyone can read.
--
-- Card art: public.audius_contest_art holds a cover image URL per song id, standard
-- and _deluxe, made each week at 00:05 UTC by the art job and written with the
-- service role key. The game and the Audius page use it when present and fall back
-- to the Audius artwork.
--
-- Deluxe: each contest song also has a Deluxe chart, "aud-<id>_deluxe", unlocked in
-- game by a 97% run of the standard chart. Deluxe runs keep their own per-song
-- leaderboard and do not count toward the weekly ranking. They need song_max_scores
-- rows to be submitted, at 2.5x the standard cap like the 365 Deluxe charts
-- (20261024120000_deluxe_song_max_scores.sql), so create_audius_weekly_contest now
-- lists both ids, and the weeks already locked are backfilled below.
--
-- Apply via the Supabase SQL editor. Idempotent.

begin;

create table if not exists public.audius_contest_charts (
  song_id text primary key check (song_id ~ '^aud-[A-Za-z0-9]{1,32}(_deluxe)?$'),
  week_start date not null references public.audius_weekly_contests (week_start) on delete cascade,
  -- { notes, stages, chartVersion, duration, bpm }
  chart jsonb not null check (jsonb_typeof(chart -> 'notes') = 'array'),
  created_at timestamptz not null default now()
);

alter table public.audius_contest_charts enable row level security;

drop policy if exists "audius_contest_charts_read_all" on public.audius_contest_charts;
create policy "audius_contest_charts_read_all" on public.audius_contest_charts
  for select using (true);

revoke insert, update, delete on public.audius_contest_charts from anon, authenticated;

create table if not exists public.audius_contest_art (
  song_id text primary key check (song_id ~ '^aud-[A-Za-z0-9]{1,32}(_deluxe)?$'),
  week_start date not null references public.audius_weekly_contests (week_start) on delete cascade,
  cover_url text not null check (cover_url ~ '^https://'),
  updated_at timestamptz not null default now()
);

alter table public.audius_contest_art enable row level security;

drop policy if exists "audius_contest_art_read_all" on public.audius_contest_art;
create policy "audius_contest_art_read_all" on public.audius_contest_art
  for select using (true);

revoke insert, update, delete on public.audius_contest_art from anon, authenticated;

-- Same as 20261109120000_audius_weekly_contest.sql, plus the _deluxe ids.
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
  select 'aud-' || (t->>'id') || e.suffix,
         least(2147483647, ceil(greatest(coalesce((t->>'duration')::numeric, 0), 60) * 40000 * e.factor))::integer,
         e.label
  from jsonb_array_elements(v_row.tracks) t
  cross join (values ('', 1.0, 'audius-contest-runtime-v6'),
                     ('_deluxe', 2.5, 'audius-contest-deluxe-2.5x')) as e(suffix, factor, label)
  where coalesce(t->>'id', '') ~ '^[A-Za-z0-9]{1,32}$'
  on conflict (song_id) do nothing;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.create_audius_weekly_contest(date, jsonb) from public, anon, authenticated;
grant execute on function public.create_audius_weekly_contest(date, jsonb) to service_role;

-- Deluxe caps for contest songs locked before this migration.
insert into public.song_max_scores (song_id, max_score, computed_from)
select song_id || '_deluxe', least(2147483647, ceil(max_score * 2.5))::integer, 'audius-contest-deluxe-2.5x'
from public.song_max_scores
where song_id ~ '^aud-[A-Za-z0-9]{1,32}$'
on conflict (song_id) do nothing;

commit;
