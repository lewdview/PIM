-- Bombshell month rewards (2026-11-02).
--
-- Before: /bombshells advertised V⚡ rewards for completing months (1,000 / 2,500 / 10,000)
-- but nothing paid them. Progress was read from bombshell shards, not from owned cards,
-- and "Month Mastered" asked for a light AND a dark variant of every day, which no day
-- has (each 365 day is either light or dark).
--
-- After:
--   * Progress counts bombshell cards the player owns in vault_collections.
--   * Month Complete (1,000 V⚡): own a bombshell variant of every day in the month.
--   * Month Mastered (2,500 V⚡): own both cuts, full-frame and letterbox ("lb day ..."),
--     of every day in the month. Days that only ship one cut need that cut.
--   * Full Year (10,000 V⚡): Month Complete on all 12 months. Paid once, on top.
--   * bombshell_reward_claims: one row per reward a player has been paid.
--   * get_bombshell_reward_status(): the caller's per-month progress and claimed rewards.
--   * claim_bombshell_reward(key): checks progress server-side and pays the sparks once.
--     Keys: 'month-<1..12>-complete', 'month-<1..12>-mastered', 'year'.
--
-- A bombshell row is recognised the way the client's isBombshellCard() does it: card_set
-- 'bombshell', a card_id/source mentioning bombshell, or a "day NNN"/"lb day NNN" cover
-- file. Optional columns are read through to_jsonb() so the function works whichever of
-- cover_artwork / card_set / fingerprint a deployment has. 2026 is not a leap year.
--
-- Apply via the Supabase SQL editor. Idempotent.

begin;

create table if not exists public.bombshell_reward_claims (
  owner_id uuid not null references auth.users (id) on delete cascade,
  reward_key text not null,
  sparks integer not null,
  claimed_at timestamptz not null default now(),
  primary key (owner_id, reward_key)
);

alter table public.bombshell_reward_claims enable row level security;

drop policy if exists "bombshell_reward_claims_read_own" on public.bombshell_reward_claims;
create policy "bombshell_reward_claims_read_own" on public.bombshell_reward_claims
  for select using (auth.uid() = owner_id);
drop policy if exists "bombshell_reward_claims_read_admin" on public.bombshell_reward_claims;
create policy "bombshell_reward_claims_read_admin" on public.bombshell_reward_claims
  for select to authenticated using (public.is_admin());

-- ── Per-day ownership of the caller's bombshell cuts ───────────────────────────────
-- One row per 365 day the user owns a bombshell for: has_full / has_lb say which cuts.
create or replace function public.bombshell_owned_days(p_uid uuid)
returns table (day integer, has_full boolean, has_lb boolean)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with rows as (
    select
      j->>'card_id' as card_id,
      coalesce(j->>'source', '') as source,
      coalesce(j->>'card_set', '') as card_set,
      coalesce(
        nullif(j->>'cover_artwork', ''),
        nullif(j->'proof'->>'cover_artwork', ''),
        nullif(j->>'fingerprint', ''),
        ''
      ) as cover
    from public.vault_collections v,
         lateral to_jsonb(v) as j
    where v.owner_id = p_uid
  ),
  bombshells as (
    select
      coalesce(
        nullif(substring(cover from '(?i)day\s*0*([0-9]+)'), '')::integer,
        nullif(substring(card_id from '([0-9]+)$'), '')::integer
      ) as day,
      cover ~* '^\s*lb' as is_lb,
      cover ~* '^\s*(lb\s*)?day\s*[0-9]+' as has_cover
    from rows
    where lower(card_set) = 'bombshell'
       or card_id ilike 'bombshell%'
       or source ilike '%bombshell%'
       or cover ~* '^\s*(lb\s*)?day\s*[0-9]+'
  )
  select
    b.day,
    bool_or(b.has_cover and not b.is_lb) as has_full,
    bool_or(b.is_lb) as has_lb
  from bombshells b
  where b.day between 1 and 365
  group by b.day;
$$;

-- Days that ship only one cut (src/game/bombshell_covers_map.json): Mastered needs that cut.
create or replace function public.bombshell_day_mastered(p_day integer, p_full boolean, p_lb boolean)
returns boolean
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case
    when p_day in (203, 363, 364) then coalesce(p_full, false)  -- no letterbox cut
    when p_day in (11, 210, 337) then coalesce(p_lb, false)     -- no full-frame cut
    else coalesce(p_full, false) and coalesce(p_lb, false)
  end;
$$;

-- ── Progress + claims for the caller ───────────────────────────────────────────────
create or replace function public.get_bombshell_reward_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_months jsonb;
  v_claimed jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  with owned as (
    select * from public.bombshell_owned_days(v_uid)
  ),
  days as (
    select d as day,
           extract(month from date '2026-01-01' + (d - 1))::integer as month
    from generate_series(1, 365) d
  )
  select jsonb_agg(jsonb_build_object(
           'month', m.month,
           'days', m.days,
           'owned', m.owned,
           'mastered', m.mastered
         ) order by m.month)
    into v_months
  from (
    select d.month,
           count(*) as days,
           count(o.day) as owned,
           count(*) filter (where public.bombshell_day_mastered(d.day, o.has_full, o.has_lb)) as mastered
    from days d
    left join owned o on o.day = d.day
    group by d.month
  ) m;

  select coalesce(jsonb_agg(c.reward_key), '[]'::jsonb) into v_claimed
  from public.bombshell_reward_claims c
  where c.owner_id = v_uid;

  return jsonb_build_object('months', v_months, 'claimed', v_claimed);
end;
$$;

-- ── Claim one reward ───────────────────────────────────────────────────────────────
create or replace function public.claim_bombshell_reward(p_reward_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_key text := lower(trim(coalesce(p_reward_key, '')));
  v_month integer;
  v_kind text;
  v_sparks integer;
  v_days integer;
  v_done integer;
  v_tokens integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if v_key = 'year' then
    v_kind := 'year';
    v_sparks := 10000;
  elsif v_key ~ '^month-([1-9]|1[0-2])-(complete|mastered)$' then
    v_month := substring(v_key from '^month-([0-9]+)-')::integer;
    v_kind := substring(v_key from '-(complete|mastered)$');
    v_sparks := case v_kind when 'complete' then 1000 else 2500 end;
  else
    return jsonb_build_object('success', false, 'error', 'UNKNOWN_REWARD');
  end if;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;
  -- Serialise this player's claims so a double tap can't pay twice.
  perform 1 from public.profiles p where p.id = v_uid for update;

  if exists (select 1 from public.bombshell_reward_claims c
             where c.owner_id = v_uid and c.reward_key = v_key) then
    return jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  end if;

  with owned as (
    select * from public.bombshell_owned_days(v_uid)
  ),
  days as (
    select d as day,
           extract(month from date '2026-01-01' + (d - 1))::integer as month
    from generate_series(1, 365) d
  )
  select count(*),
         case v_kind
           when 'mastered' then count(*) filter (where public.bombshell_day_mastered(d.day, o.has_full, o.has_lb))
           else count(o.day)
         end
    into v_days, v_done
  from days d
  left join owned o on o.day = d.day
  where v_month is null or d.month = v_month;

  if v_done < v_days then
    return jsonb_build_object('success', false, 'error', 'NOT_COMPLETE',
                              'done', v_done, 'needed', v_days);
  end if;

  insert into public.bombshell_reward_claims (owner_id, reward_key, sparks)
  values (v_uid, v_key, v_sparks);

  perform set_config('app.allow_token_update', 'true', true);
  update public.profiles p
     set tokens = coalesce(p.tokens, 0) + v_sparks,
         tokens_earned_total = coalesce(p.tokens_earned_total, 0) + v_sparks
   where p.id = v_uid
  returning p.tokens into v_tokens;

  return jsonb_build_object('success', true, 'reward_key', v_key,
                            'sparks', v_sparks, 'tokens', v_tokens);
end;
$$;

revoke all on function public.bombshell_owned_days(uuid) from public, anon, authenticated;
revoke all on function public.get_bombshell_reward_status() from public, anon;
grant execute on function public.get_bombshell_reward_status() to authenticated;
revoke all on function public.claim_bombshell_reward(text) from public, anon;
grant execute on function public.claim_bombshell_reward(text) to authenticated;

commit;
