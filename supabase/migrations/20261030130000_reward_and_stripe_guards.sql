-- Close three payment holes in vault-engine.
--
-- 1. purchasePack trusted a client flag (isGameplayReward) and handed out any reward pack,
--    Prophecy and Alpha included, with no proof the player earned it. claim_gameplay_reward
--    now checks the server's own records and grants each reward once:
--      * song rewards: the player's best accuracy in gameplay_records (written only by
--        submit_score) must reach the pack's tier, once per (song, tier);
--      * campaign milestones: campaign_clears for that month must reach 5 / 15 / all
--        regular songs, once per (month, milestone).
-- 2. verifyStripeSession could run twice for one paid session and mint twice.
--    claim_stripe_fulfillment lets one request fulfil a session at a time.
--
-- Both functions are service-role only; vault-engine calls them.

begin;

-- ── Gameplay rewards ─────────────────────────────────────────────────────────────────
create table if not exists public.gameplay_reward_grants (
  user_id    uuid not null references auth.users (id) on delete cascade,
  reward_key text not null,
  pack_type  text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, reward_key)
);
alter table public.gameplay_reward_grants enable row level security;
revoke all on public.gameplay_reward_grants from anon, authenticated;

-- Tiers match GameResults.getTierForAccuracy.
create or replace function public.gameplay_reward_min_accuracy(p_pack text)
returns numeric
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case p_pack
    when 'free' then 0
    when 'taste' then 60
    when 'special_picks' then 80
    when 'alpha' then 93
    when 'prophecy' then 97
  end;
$$;

create or replace function public.claim_gameplay_reward(
  p_user_id   uuid,
  p_pack      text,
  p_song_id   text default null,
  p_month     integer default null,
  p_milestone integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_key text;
  v_best numeric;
  v_min numeric;
  v_month_start date;
  v_days integer;
  v_regular integer;
  v_need integer;
  v_cleared integer;
begin
  if p_user_id is null or p_pack is null then
    return false;
  end if;

  if p_song_id is not null then
    v_min := public.gameplay_reward_min_accuracy(p_pack);
    if v_min is null then
      return false;
    end if;
    select max(g.accuracy::numeric) into v_best
    from public.gameplay_records g
    where g.user_id = p_user_id and g.song_id = left(p_song_id, 100);
    if v_best is null or v_best < v_min then
      return false;
    end if;
    v_key := 'song:' || left(p_song_id, 100) || ':' || p_pack;

  elsif p_month between 1 and 12 and p_milestone between 1 and 3 then
    -- Milestone 1 grants Taste; 2 and 3 grant a Light or Dark pack (Chapter.tsx).
    if (p_milestone = 1 and p_pack <> 'taste')
       or (p_milestone > 1 and p_pack not in ('light', 'dark')) then
      return false;
    end if;

    -- Song day-N is 2026-01-01 + (N - 1); each month's last 5 songs are bonus stages.
    -- A month still in progress only counts the days released so far.
    v_month_start := make_date(2026, p_month, 1);
    v_days := least(
      extract(day from (v_month_start + interval '1 month' - interval '1 day'))::integer,
      (current_date - v_month_start) + 1
    );
    if v_days < 1 then
      return false;
    end if;
    v_regular := case when v_days > 5 then v_days - 5 else v_days end;
    v_need := case p_milestone when 1 then 5 when 2 then 15 else v_regular end;

    select count(*) into v_cleared
    from public.campaign_clears c
    where c.user_id = p_user_id
      and c.song_id ~ '^day-[0-9]{3}$'
      and (date '2026-01-01' + (substring(c.song_id from 5)::integer - 1))
          between v_month_start and v_month_start + v_regular - 1;
    if v_cleared < v_need then
      return false;
    end if;
    v_key := 'campaign:' || p_month || ':' || p_milestone;

  else
    return false;
  end if;

  insert into public.gameplay_reward_grants (user_id, reward_key, pack_type)
  values (p_user_id, v_key, p_pack)
  on conflict (user_id, reward_key) do nothing;
  return found;
end;
$$;

-- Lets vault-engine hand a reward back if minting fails after the grant.
create or replace function public.release_gameplay_reward(p_user_id uuid, p_reward_key text)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  delete from public.gameplay_reward_grants where user_id = p_user_id and reward_key = p_reward_key;
$$;

-- ── Stripe fulfilment lock ───────────────────────────────────────────────────────────
create table if not exists public.stripe_fulfillment_locks (
  stripe_session_id text primary key,
  locked_at timestamptz not null default now()
);
alter table public.stripe_fulfillment_locks enable row level security;
revoke all on public.stripe_fulfillment_locks from anon, authenticated;

-- True when this caller may fulfil the session. A lock older than 5 minutes is treated as
-- abandoned (the request that took it crashed), so the order can still be fulfilled.
create or replace function public.claim_stripe_fulfillment(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.stripe_fulfillment_locks (stripe_session_id) values (p_session_id)
  on conflict (stripe_session_id) do update
    set locked_at = now()
    where public.stripe_fulfillment_locks.locked_at < now() - interval '5 minutes';
  return found;
end;
$$;

create or replace function public.release_stripe_fulfillment(p_session_id text)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  delete from public.stripe_fulfillment_locks where stripe_session_id = p_session_id;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.claim_gameplay_reward(uuid, text, text, integer, integer)',
    'public.release_gameplay_reward(uuid, text)',
    'public.claim_stripe_fulfillment(text)',
    'public.release_stripe_fulfillment(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
