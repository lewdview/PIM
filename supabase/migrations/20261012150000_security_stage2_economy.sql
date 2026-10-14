-- Security stage 2: make the spark economy server-authoritative.
--
-- Findings (read-only audit, 2026-10-12):
--  1. increment_tokens, decrement_tokens, grant_daily_credits, increment_supply,
--     redeem_invite_code and log_telemetry_event are SECURITY DEFINER and were executable by
--     anon/authenticated. Anyone could call increment_tokens('<any user>', <any amount>).
--     Only Edge Functions (service role) call them; no browser code does.
--  2. protect_profiles_server_managed_columns() was SECURITY DEFINER, so inside it
--     current_user is the owner (postgres) and its "allow postgres" check let every update
--     through: players could set their own tokens via the REST API.
--  3. Players could set economy counters the server trusts (pity, pulls, streak, daily
--     claim/burn counters) and grant themselves skins.
--
-- Ships with PIM client changes (skins and the onboarding bonus go through the functions
-- below; burns refresh the balance from the server) and a vault-engine
-- `migrateGuestProfile` action. Apply this migration, then merge/deploy those.

begin;

-- ── 1. Money-moving functions: service role only ─────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('increment_tokens', 'decrement_tokens', 'grant_daily_credits',
                        'increment_supply', 'redeem_invite_code', 'log_telemetry_event')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ── 2. Profiles: server-managed columns, enforced for real ───────────────────────────
-- SECURITY INVOKER so current_user is the caller. Clients arrive as anon/authenticated and
-- are checked; service_role (Edge Functions) and SECURITY DEFINER functions owned by
-- postgres (claim_daily_streak, unlock_skin, …) pass.
create or replace function public.protect_profiles_server_managed_columns()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  c text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_protected constant text[] := array[
    'tokens', 'tokens_earned_total', 'tokens_spent_total',
    'total_pulls', 'pulls_since_rare_plus', 'pity_counter',
    'streak_count', 'last_claim_day', 'last_free_pack_day',
    'daily_standard_claims', 'daily_premium_claims',
    'daily_standard_purchased', 'daily_premium_purchased', 'last_purchase_day', 'daily_token_purchased',
    'total_burns', 'daily_burns', 'last_burn_day', 'echo_pulls_received',
    'spark_streak_count', 'last_spark_streak_day',
    'unlocked_skins', 'is_alpha', 'season_tag'
  ];
begin
  if current_setting('app.allow_token_update', true) = 'true' then
    return NEW;
  end if;
  if current_user in ('postgres', 'service_role', 'supabase_admin') or auth.role() = 'service_role' then
    return NEW;
  end if;
  foreach c in array v_protected loop
    if (v_old -> c) is distinct from (v_new -> c) then
      raise exception 'profiles: column "%" is server-managed and not client-writable', c
        using errcode = '42501';
    end if;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists tr_protect_profiles_server_managed_columns on public.profiles;
create trigger tr_protect_profiles_server_managed_columns
  before update on public.profiles
  for each row execute function public.protect_profiles_server_managed_columns();

-- Inserts: players may only set identity/preference columns. Profile rows are normally
-- created by handle_new_user (SECURITY DEFINER), which is unaffected.
revoke insert on public.profiles from anon, authenticated;
grant insert (id, username, display_name, avatar_url, wallet_address,
              settings, progression, unlocked_cheats, has_onboarded)
  on public.profiles to authenticated;

-- ── 3. Skins: server-priced unlocks ──────────────────────────────────────────────────
create table if not exists public.skin_catalog (
  skin_id text primary key,
  cost    integer not null check (cost >= 0)
);
alter table public.skin_catalog enable row level security;
drop policy if exists "skin_catalog_public_read" on public.skin_catalog;
create policy "skin_catalog_public_read" on public.skin_catalog for select using (true);

-- Mirrors FRONT_SKINS / BACK_SKINS in src/components/OptionsModal.tsx (backs are "back_<id>").
insert into public.skin_catalog (skin_id, cost) values
  ('original', 0), ('glitch', 0), ('glass', 0), ('arcade', 50), ('mtg', 100), ('poker', 50),
  ('duelist', 75), ('monster', 75), ('chrome', 100), ('fantasy', 120), ('cyberpunk', 120), ('anime', 150),
  ('back_glass', 0), ('back_glitch', 25), ('back_arcade', 40), ('back_mtg', 60), ('back_poker', 40),
  ('back_duelist', 50), ('back_monster', 50), ('back_chrome', 50), ('back_fantasy', 60),
  ('back_cyberpunk', 60), ('back_anime', 80)
on conflict (skin_id) do update set cost = excluded.cost;

create or replace function public.unlock_skin(p_skin_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid    uuid := auth.uid();
  v_cost   integer;
  v_tokens integer;
  v_skins  text[];
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select cost into v_cost from public.skin_catalog where skin_id = p_skin_id;
  if v_cost is null then
    raise exception 'Unknown skin: %', p_skin_id using errcode = '22023';
  end if;

  select coalesce(tokens, 0), coalesce(unlocked_skins, '{}')
    into v_tokens, v_skins
    from public.profiles where id = v_uid
    for update;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if p_skin_id = any(v_skins) then
    return jsonb_build_object('success', true, 'already', true,
                              'tokens', v_tokens, 'unlocked_skins', to_jsonb(v_skins));
  end if;
  if v_tokens < v_cost then
    raise exception 'Insufficient tokens: need %, have %', v_cost, v_tokens using errcode = 'P0001';
  end if;

  update public.profiles
     set tokens = coalesce(tokens, 0) - v_cost,
         tokens_spent_total = coalesce(tokens_spent_total, 0) + v_cost,
         unlocked_skins = array_append(v_skins, p_skin_id)
   where id = v_uid
  returning tokens, unlocked_skins into v_tokens, v_skins;

  return jsonb_build_object('success', true, 'tokens', v_tokens, 'unlocked_skins', to_jsonb(v_skins));
end;
$$;
revoke execute on function public.unlock_skin(text) from public, anon;
grant execute on function public.unlock_skin(text) to authenticated;

-- ── 4. One-time grants (onboarding bonus) ────────────────────────────────────────────
create table if not exists public.economy_grants (
  user_id    uuid not null references auth.users(id) on delete cascade,
  grant_key  text not null,
  amount     integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, grant_key)
);
alter table public.economy_grants enable row level security;
drop policy if exists "economy_grants_read_own" on public.economy_grants;
create policy "economy_grants_read_own" on public.economy_grants
  for select using (auth.uid() = user_id);

create or replace function public.claim_onboarding_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid    uuid := auth.uid();
  v_amount constant integer := 50;   -- matches OnboardingFlowModal's welcome pack award
  v_tokens integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.economy_grants (user_id, grant_key, amount)
  values (v_uid, 'onboarding_bonus', v_amount)
  on conflict do nothing;

  if not found then
    select coalesce(tokens, 0) into v_tokens from public.profiles where id = v_uid;
    return jsonb_build_object('success', true, 'granted', 0, 'tokens', v_tokens);
  end if;

  update public.profiles
     set tokens = coalesce(tokens, 0) + v_amount,
         tokens_earned_total = coalesce(tokens_earned_total, 0) + v_amount
   where id = v_uid
  returning tokens into v_tokens;

  return jsonb_build_object('success', true, 'granted', v_amount, 'tokens', v_tokens);
end;
$$;
revoke execute on function public.claim_onboarding_bonus() from public, anon;
grant execute on function public.claim_onboarding_bonus() to authenticated;

commit;
