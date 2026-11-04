-- Bonus claw pulls (2026-11-04).
--
-- The bonus claw on /next-vault no longer sells packs. A drop costs one claw pull, and a
-- pull grabs any pack in the machine (every vending pack, lying along the bottom).
-- A player gets pulls two ways:
--   * a bonus code (claw_codes), redeemed with redeem_claw_code(code);
--   * a 99¢ Stripe checkout, created and fulfilled by vault-engine
--     (createClawPullCheckout / verifyClawPullCheckout, plus the stripe-webhook).
--
-- Tables
--   claw_credits            pulls each player has banked. Read-own; never written by clients.
--   claw_codes              bonus codes that grant pulls. Managed in the SQL editor.
--   claw_code_redemptions   one row per (code, player).
--   claw_purchases          one row per paid Stripe session, so a session credits once.
--   claw_pulls              log of every pull: what was grabbed and whether the grip held.
--   claw_prize_odds         optional per-pack chance the grip holds (default 1 = always).
--
-- Functions
--   get_claw_credits()                 caller's banked pulls (authenticated).
--   redeem_claw_code(code)             grants a code's pulls once per player (authenticated).
--   spend_claw_credit(uid)             takes one pull, -1 if none (service role: vault-engine).
--   refund_claw_credit(uid)            gives one back if minting failed (service role).
--   grant_claw_purchase(uid, session, pulls)  credits a paid session once (service role).
--
-- Apply via the Supabase SQL editor. Idempotent.

begin;

-- ── Tables ─────────────────────────────────────────────────────────────────────────
create table if not exists public.claw_credits (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.claw_codes (
  code text primary key check (code = lower(code)),
  pulls integer not null default 1 check (pulls > 0),
  max_uses integer,              -- null = unlimited
  uses integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.claw_code_redemptions (
  code text not null references public.claw_codes (code) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  pulls integer not null,
  redeemed_at timestamptz not null default now(),
  primary key (code, owner_id)
);

create table if not exists public.claw_purchases (
  stripe_session_id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  pulls integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.claw_pulls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  size text not null,
  won boolean not null,
  card_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists claw_pulls_owner_idx on public.claw_pulls (owner_id, created_at desc);

create table if not exists public.claw_prize_odds (
  category text not null,
  size text not null,
  hold_chance numeric not null default 1 check (hold_chance >= 0 and hold_chance <= 1),
  primary key (category, size)
);

alter table public.claw_credits enable row level security;
alter table public.claw_codes enable row level security;
alter table public.claw_code_redemptions enable row level security;
alter table public.claw_purchases enable row level security;
alter table public.claw_pulls enable row level security;
alter table public.claw_prize_odds enable row level security;

drop policy if exists "claw_credits_read_own" on public.claw_credits;
create policy "claw_credits_read_own" on public.claw_credits
  for select using (auth.uid() = owner_id);
drop policy if exists "claw_pulls_read_own" on public.claw_pulls;
create policy "claw_pulls_read_own" on public.claw_pulls
  for select using (auth.uid() = owner_id);
drop policy if exists "claw_code_redemptions_read_own" on public.claw_code_redemptions;
create policy "claw_code_redemptions_read_own" on public.claw_code_redemptions
  for select using (auth.uid() = owner_id);
drop policy if exists "claw_prize_odds_read_all" on public.claw_prize_odds;
create policy "claw_prize_odds_read_all" on public.claw_prize_odds
  for select using (true);

drop policy if exists "claw_codes_admin" on public.claw_codes;
create policy "claw_codes_admin" on public.claw_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "claw_pulls_read_admin" on public.claw_pulls;
create policy "claw_pulls_read_admin" on public.claw_pulls
  for select to authenticated using (public.is_admin());
drop policy if exists "claw_purchases_read_admin" on public.claw_purchases;
create policy "claw_purchases_read_admin" on public.claw_purchases
  for select to authenticated using (public.is_admin());

-- ── Player functions ───────────────────────────────────────────────────────────────
create or replace function public.get_claw_credits()
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce((select credits from public.claw_credits where owner_id = auth.uid()), 0);
$$;

create or replace function public.redeem_claw_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_row public.claw_codes%rowtype;
  v_credits integer;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'NOT_SIGNED_IN');
  end if;

  select * into v_row from public.claw_codes where code = v_code for update;
  if not found or not v_row.active then
    return jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'EXPIRED');
  end if;
  if v_row.max_uses is not null and v_row.uses >= v_row.max_uses then
    return jsonb_build_object('success', false, 'error', 'USED_UP');
  end if;

  begin
    insert into public.claw_code_redemptions (code, owner_id, pulls)
    values (v_code, v_uid, v_row.pulls);
  exception when unique_violation then
    return jsonb_build_object('success', false, 'error', 'ALREADY_REDEEMED');
  end;

  update public.claw_codes set uses = uses + 1 where code = v_code;

  insert into public.claw_credits (owner_id, credits) values (v_uid, v_row.pulls)
  on conflict (owner_id) do update
    set credits = public.claw_credits.credits + excluded.credits, updated_at = now()
  returning credits into v_credits;

  return jsonb_build_object('success', true, 'pulls', v_row.pulls, 'credits', v_credits);
end;
$$;

-- ── Server functions (vault-engine, service role) ──────────────────────────────────
create or replace function public.spend_claw_credit(p_uid uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_left integer;
begin
  update public.claw_credits
     set credits = credits - 1, updated_at = now()
   where owner_id = p_uid and credits > 0
  returning credits into v_left;
  return coalesce(v_left, -1);
end;
$$;

create or replace function public.refund_claw_credit(p_uid uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_credits integer;
begin
  insert into public.claw_credits (owner_id, credits) values (p_uid, 1)
  on conflict (owner_id) do update
    set credits = public.claw_credits.credits + 1, updated_at = now()
  returning credits into v_credits;
  return v_credits;
end;
$$;

-- Returns the new balance, or null if this session was already credited.
create or replace function public.grant_claw_purchase(p_uid uuid, p_session text, p_pulls integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_credits integer;
begin
  begin
    insert into public.claw_purchases (stripe_session_id, owner_id, pulls)
    values (p_session, p_uid, p_pulls);
  exception when unique_violation then
    return null;
  end;
  insert into public.claw_credits (owner_id, credits) values (p_uid, p_pulls)
  on conflict (owner_id) do update
    set credits = public.claw_credits.credits + excluded.credits, updated_at = now()
  returning credits into v_credits;
  return v_credits;
end;
$$;

revoke all on function public.get_claw_credits() from public, anon;
grant execute on function public.get_claw_credits() to authenticated;
revoke all on function public.redeem_claw_code(text) from public, anon;
grant execute on function public.redeem_claw_code(text) to authenticated;
revoke all on function public.spend_claw_credit(uuid) from public, anon, authenticated;
grant execute on function public.spend_claw_credit(uuid) to service_role;
revoke all on function public.refund_claw_credit(uuid) from public, anon, authenticated;
grant execute on function public.refund_claw_credit(uuid) to service_role;
revoke all on function public.grant_claw_purchase(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.grant_claw_purchase(uuid, text, integer) to service_role;

-- ── Starter code ───────────────────────────────────────────────────────────────────
-- One free pull per player. Add more codes the same way:
--   insert into public.claw_codes (code, pulls, max_uses, expires_at, note)
--   values ('mycode', 3, 500, '2026-12-31', 'holiday promo');
insert into public.claw_codes (code, pulls, max_uses, note)
values ('freeclaw', 1, 1000, 'Launch code: one free claw pull')
on conflict (code) do nothing;

commit;
