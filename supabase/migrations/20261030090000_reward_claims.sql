-- Record custom song (Ultra reward) claims and Mythic stem downloads on the server.
--
-- Before: the Redeem Rewards page kept "claimed" in localStorage and showed a hard-coded
-- "0 / 5 found", so nobody (players or th3scr1b3) could see how many custom song awards
-- were out there or claimed. Mythic cards linked straight to files.th3scr1b3.art/stems/<day>
-- with no ownership check.
--
-- After:
--   * ultra_reward_claims: one row per Ultra card a player has submitted a claim for.
--   * mythic_stem_claims: one row per Mythic card whose stems the owner has claimed
--     (download_count / last_downloaded_at track repeat downloads).
--   * get_ultra_reward_stats(): public counts for the rewards page (found / claimed / cap).
--   * claim_ultra_reward(card ids): records a claim for cards the caller owns.
--   * claim_mythic_stems(card id): checks the caller owns that Mythic card, records the
--     claim and returns its day; /api/stems uses it before handing out the download.
--
-- ultra_reward on vault_collections has been written as a boolean and as a jsonb object
-- by different code paths, so "has an Ultra reward" is tested on its text form.

begin;

create or replace function public.has_ultra_reward(p_value anyelement)
returns boolean
language sql
immutable
set search_path = public, pg_catalog
as $$
  select p_value is not null and p_value::text not in ('false', 'null', '', '{}');
$$;

create table if not exists public.ultra_reward_claims (
  collection_id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  status text not null default 'submitted' check (status in ('submitted', 'in_progress', 'delivered')),
  claimed_at timestamptz not null default now()
);

create table if not exists public.mythic_stem_claims (
  collection_id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  day integer not null,
  claimed_at timestamptz not null default now(),
  last_downloaded_at timestamptz not null default now(),
  download_count integer not null default 1
);

alter table public.ultra_reward_claims enable row level security;
alter table public.mythic_stem_claims enable row level security;

create policy "ultra_reward_claims_read_own" on public.ultra_reward_claims
  for select using (auth.uid() = owner_id);
create policy "ultra_reward_claims_admin" on public.ultra_reward_claims
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "mythic_stem_claims_read_own" on public.mythic_stem_claims
  for select using (auth.uid() = owner_id);
create policy "mythic_stem_claims_read_admin" on public.mythic_stem_claims
  for select to authenticated using (public.is_admin());

-- ── Public counts for the rewards page ──────────────────────────────────────────────
-- max comes from admin_config.ultraRewardMax when it is set (the Admin page writes it);
-- the client falls back to its own default when it is null.
create or replace function public.get_ultra_reward_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'found',   (select count(*) from public.vault_collections v where public.has_ultra_reward(v.ultra_reward)),
    'claimed', (select count(*) from public.ultra_reward_claims c
                 join public.vault_collections v on v.id = c.collection_id
                 where public.has_ultra_reward(v.ultra_reward)),
    'mythic_stems_claimed', (select count(*) from public.mythic_stem_claims)
  );
$$;

-- ── Custom song claim ───────────────────────────────────────────────────────────────
-- Records a claim for each listed card the caller owns that carries an Ultra reward.
-- Returns the ids that are now claimed (new and previously claimed).
create or replace function public.claim_ultra_reward(p_collection_ids uuid[])
returns uuid[]
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
begin
  if v_uid is null then
    raise exception 'sign in to claim' using errcode = '28000';
  end if;

  insert into public.ultra_reward_claims (collection_id, owner_id, card_id)
  select v.id, v_uid, v.card_id
  from public.vault_collections v
  where v.id = any(p_collection_ids[1:50])
    and v.owner_id = v_uid
    and public.has_ultra_reward(v.ultra_reward)
  on conflict (collection_id) do nothing;

  select coalesce(array_agg(c.collection_id), '{}') into v_ids
  from public.ultra_reward_claims c
  where c.owner_id = v_uid and c.collection_id = any(p_collection_ids[1:50]);
  return v_ids;
end;
$$;

-- ── Mythic stems claim ──────────────────────────────────────────────────────────────
-- Raises unless the caller owns the card and it is Mythic. Returns the card's day
-- (card ids are "card-<day>" or "<day>"), which picks the stems archive.
create or replace function public.claim_mythic_stems(p_collection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_card record;
  v_day integer;
begin
  if v_uid is null then
    raise exception 'sign in to claim stems' using errcode = '28000';
  end if;

  select v.id, v.card_id, v.rarity into v_card
  from public.vault_collections v
  where v.id = p_collection_id and v.owner_id = v_uid;

  if not found then
    raise exception 'card not in your vault' using errcode = '42501';
  end if;
  if lower(v_card.rarity) <> 'mythic' then
    raise exception 'stems unlock on Mythic cards only' using errcode = '42501';
  end if;

  v_day := nullif(substring(v_card.card_id from '([0-9]+)$'), '')::integer;
  if v_day is null then
    raise exception 'no stems for this card' using errcode = 'P0002';
  end if;

  insert into public.mythic_stem_claims (collection_id, owner_id, card_id, day)
  values (v_card.id, v_uid, v_card.card_id, v_day)
  on conflict (collection_id) do update
    set owner_id = excluded.owner_id,
        last_downloaded_at = now(),
        download_count = public.mythic_stem_claims.download_count + 1;

  return jsonb_build_object('day', v_day, 'card_id', v_card.card_id);
end;
$$;

revoke execute on function public.get_ultra_reward_stats() from public;
grant execute on function public.get_ultra_reward_stats() to anon, authenticated, service_role;
revoke execute on function public.claim_ultra_reward(uuid[]) from public;
grant execute on function public.claim_ultra_reward(uuid[]) to authenticated, service_role;
revoke execute on function public.claim_mythic_stems(uuid) from public;
grant execute on function public.claim_mythic_stems(uuid) to authenticated, service_role;

commit;
