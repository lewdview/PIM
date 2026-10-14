-- Activity tracking: only record activity from the live th3scr1b3.art sites.
--
-- About a third of the first site_visits rows came from localhost, Vercel previews and Netlify
-- deploys, which skewed the user hub's per-layer time stats. record_site_visit and
-- record_play_event now silently ignore any call whose site isn't th3scr1b3.art or a
-- *.th3scr1b3.art subdomain (after lowercasing and dropping any scheme, path and :port).
--
-- record_play_event still accepts a missing p_site and falls back to the platform default, as
-- before, so older callers that don't send it keep working. The browser clients also skip
-- tracking off the live domains; this is the server-side guard.
--
-- Same signatures as 20261013090000_activity_tracking.sql, so existing grants carry over;
-- they're re-applied at the end anyway.

begin;

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
  v_site    text := nullif(lower(trim(coalesce(p_site, ''))), '');
begin
  if v_release is null or (v_uid is null and v_session is null) then
    return;  -- nothing to attribute it to
  end if;

  if v_site is not null then
    -- Bare host: drop scheme, path and port.
    v_site := regexp_replace(split_part(regexp_replace(v_site, '^[a-z][a-z0-9+.-]*://', ''), '/', 1),
                             ':[0-9]*$', '');
    if v_site !~ '^([a-z0-9-]+\.)*th3scr1b3\.art$' then
      return;  -- not a live site (localhost, preview deploys, ...)
    end if;
  end if;

  v_site := left(coalesce(v_site,
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
  v_site    text := lower(trim(coalesce(p_site, '')));
  v_id      uuid;
begin
  -- Bare host: drop scheme, path and port.
  v_site := regexp_replace(split_part(regexp_replace(v_site, '^[a-z][a-z0-9+.-]*://', ''), '/', 1),
                           ':[0-9]*$', '');
  if v_session is null or v_site !~ '^([a-z0-9-]+\.)*th3scr1b3\.art$' then
    return null;  -- no visitor, or not a live site (localhost, preview deploys, ...)
  end if;
  v_site := left(v_site, 100);

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

-- ── Access (unchanged: anyone may log plays and visits) ──────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.record_play_event(text, integer, text, text, text, numeric, text, text, text, text, numeric)',
    'public.record_site_visit(text, text, uuid, text, integer, text)'
  ] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end $$;

commit;

-- ── Optional one-off cleanup (run by hand after checking the counts) ─────────────────
-- Visits from non-live hosts recorded before this migration:
--
--   select site, count(*) from public.site_visits
--   where split_part(lower(site), ':', 1) !~ '^([a-z0-9-]+\.)*th3scr1b3\.art$'
--   group by 1 order by 2 desc;
--
--   delete from public.site_visits
--   where split_part(lower(site), ':', 1) !~ '^([a-z0-9-]+\.)*th3scr1b3\.art$';
--
-- Plays with a non-live site (the main site didn't send p_site before, so its localhost plays
-- were stored as 'th3scr1b3.art' and can't be told apart here):
--
--   delete from public.play_events
--   where split_part(lower(site), ':', 1) !~ '^([a-z0-9-]+\.)*th3scr1b3\.art$';
