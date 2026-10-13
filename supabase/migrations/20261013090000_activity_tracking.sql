-- Ecosystem activity tracking: one play log and one visit log for every th3scr1b3.art site,
-- plus the per-user summary behind the user hub dashboard.
--
-- The main site (365LandD) already calls record_play_event, get_play_history,
-- link_anonymous_plays, get_play_counter_public and get_play_counter_snapshot with these
-- exact names/parameters; they existed on the old 365 project but not here, so every play
-- since the migration was dropped. Defining them here turns that logging back on with no
-- front-end change.
--
-- Privacy: rows are readable only by their owner (and admins). Writes go through the
-- functions below. Anonymous activity is keyed by a random session id and attached to the
-- account by link_anonymous_plays after sign-in.

begin;

-- ── Tables ───────────────────────────────────────────────────────────────────────────
create table if not exists public.play_events (
  id               bigint generated always as identity primary key,
  user_id          uuid references auth.users(id) on delete set null,
  session_id       text,
  release_id       text not null,
  day              integer,
  site             text not null,
  source           text,
  platform         text,
  event            text not null default 'start'
                     check (event in ('start', 'progress', 'complete', 'skip')),
  position_seconds numeric,
  listened_seconds numeric,
  referrer         text,
  user_agent       text,
  played_at        timestamptz not null default now()
);
create index if not exists play_events_user_idx    on public.play_events (user_id, played_at desc) where user_id is not null;
create index if not exists play_events_session_idx on public.play_events (session_id, played_at desc) where user_id is null;
create index if not exists play_events_time_idx    on public.play_events (played_at desc);
create index if not exists play_events_release_idx on public.play_events (release_id, played_at desc);

create table if not exists public.site_visits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  session_id     text not null,
  site           text not null,
  path           text,
  referrer       text,
  started_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  active_seconds integer not null default 0 check (active_seconds >= 0)
);
create index if not exists site_visits_user_idx    on public.site_visits (user_id, started_at desc) where user_id is not null;
create index if not exists site_visits_session_idx on public.site_visits (session_id, started_at desc);

alter table public.play_events enable row level security;
alter table public.site_visits enable row level security;

drop policy if exists "play_events_read_own"   on public.play_events;
drop policy if exists "play_events_read_admin" on public.play_events;
create policy "play_events_read_own"   on public.play_events for select using (auth.uid() = user_id);
create policy "play_events_read_admin" on public.play_events for select to authenticated using (public.is_admin());

drop policy if exists "site_visits_read_own"   on public.site_visits;
drop policy if exists "site_visits_read_admin" on public.site_visits;
create policy "site_visits_read_own"   on public.site_visits for select using (auth.uid() = user_id);
create policy "site_visits_read_admin" on public.site_visits for select to authenticated using (public.is_admin());
-- No insert/update/delete policies: writes only through the SECURITY DEFINER functions.

-- ── Writes ───────────────────────────────────────────────────────────────────────────
create or replace function public.record_play_event(
  p_release_id       text,
  p_day              integer default null,
  p_source           text    default null,
  p_platform         text    default null,
  p_session_id       text    default null,
  p_position_seconds numeric default null,
  p_referrer         text    default null,
  p_user_agent       text    default null,
  p_site             text    default null,
  p_event            text    default 'start',
  p_listened_seconds numeric default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid     uuid := auth.uid();
  v_session text := nullif(left(trim(coalesce(p_session_id, '')), 100), '');
  v_release text := nullif(left(trim(coalesce(p_release_id, '')), 100), '');
  v_event   text := case when p_event in ('start', 'progress', 'complete', 'skip') then p_event else 'start' end;
  v_site    text;
begin
  if v_release is null or (v_uid is null and v_session is null) then
    return;  -- nothing to attribute it to
  end if;

  v_site := left(coalesce(nullif(trim(p_site), ''),
                          case p_platform
                            when 'base_mini_app' then 'base.th3scr1b3.art'
                            when 'pim'           then 'pim.th3scr1b3.art'
                            else 'th3scr1b3.art'
                          end), 100);

  -- Same listener + song + event within 15s is one event (double-fired players, retries).
  if exists (
    select 1 from public.play_events e
    where e.release_id = v_release and e.event = v_event
      and e.played_at > now() - interval '15 seconds'
      and ((v_uid is not null and e.user_id = v_uid) or (v_uid is null and e.session_id = v_session))
  ) then
    return;
  end if;

  insert into public.play_events (user_id, session_id, release_id, day, site, source, platform, event,
                                  position_seconds, listened_seconds, referrer, user_agent)
  values (v_uid, v_session, v_release,
          case when p_day between 1 and 366 then p_day end,
          v_site, left(p_source, 60), left(p_platform, 60), v_event,
          case when p_position_seconds between 0 and 86400 then p_position_seconds end,
          case when p_listened_seconds between 0 and 86400 then p_listened_seconds end,
          left(p_referrer, 500), left(p_user_agent, 400));
end;
$$;

-- Start a visit (no p_visit_id) or extend one (heartbeat). Returns the visit id to reuse.
create or replace function public.record_site_visit(
  p_site           text,
  p_session_id     text,
  p_visit_id       uuid    default null,
  p_path           text    default null,
  p_active_seconds integer default 0,
  p_referrer       text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid     uuid := auth.uid();
  v_session text := nullif(left(trim(coalesce(p_session_id, '')), 100), '');
  v_site    text := nullif(left(lower(trim(coalesce(p_site, ''))), 100), '');
  v_id      uuid;
begin
  if v_session is null or v_site is null then
    return null;
  end if;

  if p_visit_id is not null then
    -- Active time can't exceed wall-clock time since the visit started (plus slack).
    update public.site_visits v
       set last_seen_at   = now(),
           active_seconds = least(greatest(v.active_seconds, coalesce(p_active_seconds, 0)),
                                  extract(epoch from (now() - v.started_at))::integer + 60),
           path           = coalesce(left(p_path, 300), v.path),
           user_id        = coalesce(v.user_id, v_uid)
     where v.id = p_visit_id
       and v.session_id = v_session
       and v.site = v_site
       and v.last_seen_at > now() - interval '30 minutes'
    returning v.id into v_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.site_visits (user_id, session_id, site, path, referrer)
  values (v_uid, v_session, v_site, left(p_path, 300), left(p_referrer, 500))
  returning id into v_id;
  return v_id;
end;
$$;

-- After sign-in: attach this browser's anonymous plays and visits to the account.
create or replace function public.link_anonymous_plays(p_session_id text, p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid     uuid := auth.uid();
  v_session text := nullif(left(trim(coalesce(p_session_id, '')), 100), '');
  v_plays   integer;
  v_visits  integer;
begin
  if v_uid is null or v_session is null then
    return 0;
  end if;
  if p_user_id is not null and p_user_id <> v_uid then
    raise exception 'Can only link plays to your own account' using errcode = '42501';
  end if;

  update public.play_events set user_id = v_uid where session_id = v_session and user_id is null;
  get diagnostics v_plays = row_count;
  update public.site_visits set user_id = v_uid where session_id = v_session and user_id is null;
  get diagnostics v_visits = row_count;
  return v_plays + v_visits;
end;
$$;

-- ── Reads ────────────────────────────────────────────────────────────────────────────
-- The caller's own play starts: signed in -> their account (p_user_id is ignored unless it's
-- theirs); anonymous -> that session's unlinked plays.
create or replace function public.get_play_history(p_user_id uuid default null, p_session_id text default null)
returns table (played_at timestamptz, day integer, release_id text, site text, listened_seconds numeric)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select e.played_at, e.day, e.release_id, e.site, e.listened_seconds
  from public.play_events e
  where e.event = 'start'
    and (
      (auth.uid() is not null and e.user_id = auth.uid())
      or (auth.uid() is null and p_session_id is not null and e.user_id is null and e.session_id = p_session_id)
    )
  order by e.played_at desc
  limit 5000;
$$;

-- Public totals (play starts) for the whole catalog and optionally one release/day.
create or replace function public.get_play_counter_public(p_release_id text default null, p_day integer default null)
returns table (global_total bigint, global_today bigint, global_last_7d bigint,
               release_total bigint, release_today bigint, release_last_7d bigint)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with s as (
    select e.played_at,
           ((p_release_id is not null and e.release_id = p_release_id) or (p_day is not null and e.day = p_day)) as is_release
    from public.play_events e
    where e.event = 'start'
  )
  select count(*),
         count(*) filter (where played_at >= date_trunc('day', now())),
         count(*) filter (where played_at >= now() - interval '7 days'),
         count(*) filter (where is_release),
         count(*) filter (where is_release and played_at >= date_trunc('day', now())),
         count(*) filter (where is_release and played_at >= now() - interval '7 days')
  from s;
$$;

-- Public analytics snapshot in the shape src/services/playCounter.ts expects.
create or replace function public.get_play_counter_snapshot(p_days integer default 30, p_top integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with starts as (
    select e.played_at, e.release_id, e.day, coalesce(e.source, 'unknown') as source,
           coalesce(e.platform, 'unknown') as platform
    from public.play_events e
    where e.event = 'start'
  ),
  params as (
    select least(greatest(coalesce(p_days, 30), 1), 400) as days,
           least(greatest(coalesce(p_top, 10), 1), 50)  as top
  ),
  day_series as (
    select generate_series(date_trunc('day', now()) - ((p.days - 1) || ' days')::interval,
                           date_trunc('day', now()), interval '1 day') as d
    from params p
  ),
  day_counts as (
    select date_trunc('day', played_at) as d, count(*) as n from starts group by 1
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'globalTotal', (select count(*) from starts),
      'todayTotal',  (select count(*) from starts where played_at >= date_trunc('day', now())),
      'last7dTotal', (select count(*) from starts where played_at >= now() - interval '7 days')
    ),
    'byDay', coalesce((
      select jsonb_agg(jsonb_build_object('date', s.d::date::text, 'totalPlays', coalesce(c.n, 0)) order by s.d)
      from day_series s
      left join day_counts c on c.d = s.d
    ), '[]'::jsonb),
    'bySource', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'platform', platform, 'totalPlays', n) order by n desc)
      from (select source, platform, count(*) as n from starts, params
            where played_at >= now() - (params.days || ' days')::interval group by 1, 2) x
    ), '[]'::jsonb),
    'bySourceToday', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'platform', platform, 'totalPlays', n) order by n desc)
      from (select source, platform, count(*) as n from starts
            where played_at >= date_trunc('day', now()) group by 1, 2) x
    ), '[]'::jsonb),
    'topSongsAllTime', coalesce((
      select jsonb_agg(jsonb_build_object('releaseId', release_id, 'day', day, 'totalPlays', n) order by n desc)
      from (select release_id, max(day) as day, count(*) as n from starts group by 1
            order by 3 desc limit (select top from params)) x
    ), '[]'::jsonb),
    'topSongsLast7d', coalesce((
      select jsonb_agg(jsonb_build_object('releaseId', release_id, 'day', day, 'totalPlays', n) order by n desc)
      from (select release_id, max(day) as day, count(*) as n from starts
            where played_at >= now() - interval '7 days' group by 1
            order by 3 desc limit (select top from params)) x
    ), '[]'::jsonb)
  );
$$;

-- Everything the user hub dashboard shows, for the signed-in user only.
create or replace function public.get_my_activity_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  with
  starts as (
    select * from public.play_events where user_id = v_uid and event = 'start'
  ),
  listen_days as (
    select distinct (played_at at time zone 'utc')::date as d from starts
  ),
  visits as (
    select * from public.site_visits where user_id = v_uid
  ),
  runs as (
    select * from public.gameplay_records where user_id = v_uid
  ),
  cards as (
    select * from public.vault_collections where owner_id = v_uid
  ),
  prof as (
    select * from public.profiles where id = v_uid
  )
  select jsonb_build_object(
    'listening', jsonb_build_object(
      'plays',           (select count(*) from starts),
      'completions',     (select count(*) from public.play_events where user_id = v_uid and event = 'complete'),
      'uniqueSongs',     (select count(distinct release_id) from starts),
      'daysListened',    (select count(*) from listen_days),
      'listenedSeconds', (select coalesce(sum(listened_seconds), 0) from public.play_events
                          where user_id = v_uid and event in ('complete', 'skip', 'progress')),
      'firstPlayAt',     (select min(played_at) from starts),
      'lastPlayAt',      (select max(played_at) from starts),
      'bySite',  coalesce((select jsonb_object_agg(site, n) from
                   (select site, count(*) as n from starts group by 1) x), '{}'::jsonb),
      'topSongs', coalesce((select jsonb_agg(jsonb_build_object('releaseId', release_id, 'day', day, 'plays', n) order by n desc)
                   from (select release_id, max(day) as day, count(*) as n from starts group by 1
                         order by 3 desc limit 10) x), '[]'::jsonb),
      'recent',   coalesce((select jsonb_agg(jsonb_build_object('releaseId', release_id, 'day', day, 'site', site,
                                                            'playedAt', played_at) order by played_at desc)
                   from (select * from starts order by played_at desc limit 20) x), '[]'::jsonb),
      'calendar', coalesce((select jsonb_agg(jsonb_build_object('date', d::text, 'plays', n) order by d)
                   from (select (played_at at time zone 'utc')::date as d, count(*) as n from starts
                         where played_at >= now() - interval '366 days' group by 1) x), '[]'::jsonb)
    ),
    'time', jsonb_build_object(
      'visits',        (select count(*) from visits),
      'activeSeconds', (select coalesce(sum(active_seconds), 0) from visits),
      'bySite', coalesce((select jsonb_object_agg(site, jsonb_build_object('visits', v, 'activeSeconds', s, 'lastSeenAt', l))
                 from (select site, count(*) as v, sum(active_seconds) as s, max(last_seen_at) as l
                       from visits group by 1) x), '{}'::jsonb)
    ),
    'game', jsonb_build_object(
      'runs',         (select count(*) from runs),
      'songsPlayed',  (select count(distinct song_id) from runs),
      'bestScore',    (select coalesce(max(score), 0) from runs),
      'avgAccuracy',  (select round(coalesce(avg(accuracy), 0), 2) from runs),
      'bestCombo',    (select coalesce(max(max_combo), 0) from runs),
      'medals', coalesce((select jsonb_object_agg(coalesce(medal, 'NONE'), n)
                 from (select medal, count(*) as n from runs group by 1) x), '{}'::jsonb),
      'recent', coalesce((select jsonb_agg(jsonb_build_object('songId', song_id, 'score', score, 'accuracy', accuracy,
                                                          'medal', medal, 'playedAt', "timestamp") order by "timestamp" desc)
                 from (select * from runs order by "timestamp" desc limit 10) x), '[]'::jsonb)
    ),
    'campaign', jsonb_build_object(
      'milestonesClaimed', (select count(*) from public.campaign_milestone_claims m where m.user_id = v_uid),
      'chaptersTouched',   (select count(distinct coalesce(to_jsonb(m) ->> 'month_num', to_jsonb(m) ->> 'chapter'))
                            from public.campaign_milestone_claims m where m.user_id = v_uid)
    ),
    'cards', jsonb_build_object(
      'owned',     (select count(*) from cards),
      'packRips',  (select count(*) from cards where source like 'pack\_%' or source = 'targeted_pull'),
      'echoes',    (select count(*) from cards where is_echo),
      'byRarity',  coalesce((select jsonb_object_agg(rarity, n) from
                    (select coalesce(rarity, 'unknown') as rarity, count(*) as n from cards group by 1) x), '{}'::jsonb),
      'bySource',  coalesce((select jsonb_object_agg(source, n) from
                    (select coalesce(source, 'unknown') as source, count(*) as n from cards group by 1) x), '{}'::jsonb),
      'totalPulls', (select coalesce(total_pulls, 0) from prof)
    ),
    'sparks', jsonb_build_object(
      'balance',      (select coalesce(tokens, 0) from prof),
      'earnedTotal',  (select coalesce(tokens_earned_total, 0) from prof),
      'spentTotal',   (select coalesce(tokens_spent_total, 0) from prof),
      'dailyStreak',  (select coalesce(streak_count, 0) from prof),
      'sparkStreak',  (select coalesce(spark_streak_count, 0) from prof),
      'burns',        (select coalesce(total_burns, 0) from prof)
    )
  ) into v_result;

  -- Listening streak: consecutive UTC days with a play, ending today or yesterday.
  v_result := jsonb_set(v_result, '{listening,streakDays}', to_jsonb((
    with days as (
      select distinct (played_at at time zone 'utc')::date as d
      from public.play_events where user_id = v_uid and event = 'start'
    ),
    ranked as (
      select d, d + (row_number() over (order by d desc))::integer as anchor from days
    ),
    latest as (select max(d) as d from days)
    select coalesce(count(*), 0)
    from ranked, latest
    where latest.d >= (now() at time zone 'utc')::date - 1
      and ranked.anchor = (select d + 1 from latest)
  )));

  return v_result;
end;
$$;

-- ── Access ───────────────────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  -- Callable by anyone (anonymous listeners log plays and visits; counters are public).
  foreach f in array array[
    'public.record_play_event(text, integer, text, text, text, numeric, text, text, text, text, numeric)',
    'public.record_site_visit(text, text, uuid, text, integer, text)',
    'public.get_play_history(uuid, text)',
    'public.get_play_counter_public(text, integer)',
    'public.get_play_counter_snapshot(integer, integer)'
  ] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
  -- Signed-in only.
  foreach f in array array[
    'public.link_anonymous_plays(text, uuid)',
    'public.get_my_activity_summary()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

commit;
