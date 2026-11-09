-- Reconciles #212 with merged #247 and claw payments. Apply before either edge function.
-- No historical reward is revoked or reissued here. See docs/reward-payment-rollout.md.
begin;

create table if not exists public.vault_fulfillments (
  operation_key text primary key,
  owner_id uuid not null references auth.users(id),
  kind text not null check (kind in ('stripe', 'claw', 'run_reward', 'campaign_reward', 'restitution_reward')),
  category text not null,
  size text not null,
  details jsonb not null,
  lease uuid not null default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb
);
alter table public.vault_fulfillments enable row level security;
revoke all on public.vault_fulfillments from public, anon, authenticated;
grant all on public.vault_fulfillments to service_role;

-- Operators must confirm each historical loss; the inferred backfill is not proof.
create table if not exists public.reward_restitution_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id), song_id text not null, tier text not null,
  reason text not null, evidence jsonb not null, previous_ledger jsonb not null,
  approved_at timestamptz not null default now(), fulfilled_at timestamptz,
  unique(user_id,song_id,tier)
);
alter table public.reward_restitution_approvals enable row level security;
revoke all on public.reward_restitution_approvals from public,anon,authenticated;
grant all on public.reward_restitution_approvals to service_role;
create or replace function public.approve_reward_restitution(
  p_user uuid,p_song text,p_tier text,p_reason text,p_evidence jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_id uuid; v_old jsonb;
begin
  if length(btrim(coalesce(p_reason,''))) < 15 or p_evidence is null
    or jsonb_typeof(p_evidence)<>'object' or p_evidence='{}'::jsonb then
    raise exception 'A confirmed loss reason and evidence references are required';
  end if;
  select to_jsonb(p) into v_old from public.gameplay_reward_payouts p
    where user_id=p_user and song_id=public.normalize_song_id(p_song) and tier=p_tier and record_id is null;
  if not found then raise exception 'Only inferred legacy payouts qualify for this restitution path'; end if;
  if exists(select 1 from public.vault_fulfillments where operation_key=
    'run:'||p_user||':'||public.normalize_song_id(p_song)||':'||p_tier and completed_at is not null) then
    raise exception 'A confirmed paid receipt already exists';
  end if;
  insert into public.reward_restitution_approvals(user_id,song_id,tier,reason,evidence,previous_ledger)
    values(p_user,public.normalize_song_id(p_song),p_tier,btrim(p_reason),p_evidence,v_old)
    on conflict(user_id,song_id,tier) do nothing returning id into v_id;
  if v_id is null then select id into v_id from public.reward_restitution_approvals
    where user_id=p_user and song_id=public.normalize_song_id(p_song) and tier=p_tier; end if;
  return v_id;
end $$;

-- Cap actual inserted Ultra awards, not reservations that can expire while minting.
-- The advisory transaction lock covers every insertion path, including Stripe and claw.
create or replace function public.enforce_ultra_reward_cap()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_cap integer := 5; v_cfg jsonb; v_count integer;
begin
  if not public.has_ultra_reward(new.ultra_reward) then return new; end if;
  if tg_op='UPDATE' and public.has_ultra_reward(old.ultra_reward) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('pim:ultra-reward-cap', 0));
  select coalesce(to_jsonb(a)->'config', to_jsonb(a)->'value') into v_cfg
    from public.admin_config a
    where to_jsonb(a)->>'id' = '1' or to_jsonb(a)->>'key' = 'global'
    order by (to_jsonb(a)->>'id' = '1') desc nulls last limit 1;
  if v_cfg->>'ultraRewardMax' ~ '^[0-9]+$' then
    v_cap := least((v_cfg->>'ultraRewardMax')::numeric, 2147483647)::integer;
  end if;
  select count(*) into v_count from public.vault_collections v
    where public.has_ultra_reward(v.ultra_reward) and (tg_op = 'INSERT' or v.id <> new.id);
  if v_count >= v_cap then new.ultra_reward := null; end if;
  return new;
end $$;
drop trigger if exists enforce_ultra_reward_cap on public.vault_collections;
create trigger enforce_ultra_reward_cap before insert or update of ultra_reward
  on public.vault_collections for each row execute function public.enforce_ultra_reward_cap();

create or replace function public.begin_vault_fulfillment(
  p_key text, p_owner uuid, p_kind text, p_category text, p_size text, p_details jsonb
) returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_op public.vault_fulfillments%rowtype; v_rec public.gameplay_records%rowtype;
  v_song text; v_rank integer; v_earned integer; v_month integer; v_milestone integer;
  v_start date; v_regular integer; v_need integer; v_cleared integer; v_prior boolean; v_day integer;
  v_ladder text[] := array['free','taste','special_picks','alpha','prophecy'];
begin
  if p_owner is null or length(p_key) not between 1 and 240 then raise exception 'Invalid fulfillment'; end if;
  -- Serialize both the initial claim and lease renewal for this operation.
  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
  select * into v_op from public.vault_fulfillments where operation_key = p_key for update;
  if found then
    if v_op.owner_id <> p_owner or v_op.kind <> p_kind then raise exception 'Fulfillment owner or kind mismatch'; end if;
    if v_op.completed_at is not null then return jsonb_build_object('status','completed','result',v_op.result); end if;
    if v_op.started_at > now() - interval '5 minutes' then return jsonb_build_object('status','busy'); end if;
    -- An older worker's lease can no longer commit after this renewal.
    update public.vault_fulfillments set lease = gen_random_uuid(), started_at = now()
      where operation_key = p_key returning * into v_op;
    return jsonb_build_object('status','reserved','key',p_key,'lease',v_op.lease,
      'category',v_op.category,'size',v_op.size,'details',v_op.details);
  end if;

  if p_kind = 'run_reward' then
    v_rank := array_position(v_ladder, p_category);
    if v_rank is null or p_size <> 'single' then raise exception 'Invalid run reward tier'; end if;
    select * into v_rec from public.gameplay_records where id::text = p_details->>'recordId';
    if not found or v_rec.user_id <> p_owner then raise exception 'Run record not found'; end if;
    if v_rec.timestamp is null or v_rec.accuracy is null or v_rec.timestamp < now() - interval '30 minutes' or v_rec.timestamp > now() + interval '30 seconds' then
      raise exception 'Run is outside the claim window';
    end if;
    if v_rec.medal is null or v_rec.medal not in ('BRONZE','SILVER','GOLD','PLATINUM') then raise exception 'Run did not clear'; end if;
    v_earned := case when v_rec.accuracy >= 97 then 5 when v_rec.accuracy >= 93 then 4
      when v_rec.accuracy >= 80 then 3 when v_rec.accuracy >= 60 then 2 else 1 end;
    if (v_rec.medal = 'PLATINUM' and v_rank > v_earned) or
       (v_rec.medal <> 'PLATINUM' and v_rank <> v_earned) then raise exception 'Unearned reward tier'; end if;
    v_song := public.normalize_song_id(v_rec.song_id);
    if v_song !~ '^day-[0-9]{3}(_deluxe)?$' then raise exception 'Unsupported reward song'; end if;
    v_day := substring(v_song from 5 for 3)::integer;
    if not exists(select 1 from public.vault_collections where owner_id=p_owner
      and card_id in ('card-'||v_day,'bombshell-'||v_day,'day-'||lpad(v_day::text,3,'0')))
      and not exists(select 1 from public.user_fragments where user_id=p_owner and amount >= 10
        and fragment_id in ('card-'||v_day,'bombshell-'||v_day,'day-'||v_day,'day-'||lpad(v_day::text,3,'0'))) then
      raise exception 'Song ownership or Award Play unlock required';
    end if;
    if p_key <> 'run:' || p_owner || ':' || v_song || ':' || p_category then raise exception 'Invalid run receipt key'; end if;
    if exists(select 1 from public.gameplay_reward_payouts
      where user_id = p_owner and song_id = v_song and tier = p_category) then raise exception 'Reward already paid'; end if;
    if to_regclass('public.gameplay_reward_grants') is not null then
      execute 'select exists(select 1 from public.gameplay_reward_grants where user_id=$1 and reward_key=$2)'
        into v_prior using p_owner,'song:'||v_song||':'||p_category;
      if v_prior then raise exception 'Legacy reward already paid'; end if;
    end if;
    p_details := jsonb_build_object('recordId',v_rec.id::text,'songId',v_song);

  elsif p_kind = 'campaign_reward' then
    v_month := (p_details->>'month')::integer; v_milestone := (p_details->>'milestone')::integer;
    if v_month is null or v_month not between 1 and 12 or v_milestone is null or v_milestone not between 1 and 3
      or p_size <> 'single' or (v_milestone = 1 and p_category <> 'taste')
      or (v_milestone > 1 and p_category not in ('light','dark')) then raise exception 'Invalid campaign reward'; end if;
    if p_key <> 'campaign:' || p_owner || ':' || v_month || ':' || v_milestone then raise exception 'Invalid campaign key'; end if;
    if to_regclass('public.campaign_milestone_claims') is not null then
      execute 'select exists(select 1 from public.campaign_milestone_claims c where to_jsonb(c)->>''user_id''=$1
        and coalesce(to_jsonb(c)->>''month_num'',to_jsonb(c)->>''chapter'')=$2
        and coalesce(to_jsonb(c)->>''milestone_num'',to_jsonb(c)->>''milestone_index'')=$3)'
        into v_prior using p_owner::text,v_month::text,v_milestone::text;
      if v_prior then raise exception 'Campaign reward already paid'; end if;
    end if;
    v_start := make_date(2026,v_month,1);
    -- Count full-month regular entries; do not move the milestone on each release day.
    v_regular := extract(day from (v_start + interval '1 month - 1 day'))::integer - 5;
    v_need := case v_milestone when 1 then 5 when 2 then 15 else v_regular end;
    select count(*) into v_cleared from public.campaign_clears c
      where c.user_id = p_owner and c.medal <> 'NONE' and c.song_id ~ '^day-[0-9]{3}$'
      and (date '2026-01-01' + substring(c.song_id from 5)::integer - 1) between v_start and v_start + v_regular - 1
      -- campaign_clears alone is client-writable through its RPC: require a submitted clear too.
      and exists(select 1 from public.gameplay_records g where g.user_id = p_owner
        and public.normalize_song_id(g.song_id) = c.song_id and g.medal in ('BRONZE','SILVER','GOLD','PLATINUM'));
    if v_cleared < v_need then raise exception 'Campaign milestone not earned'; end if;

  elsif p_kind = 'restitution_reward' then
    if p_size<>'single' or array_position(v_ladder,p_category) is null then raise exception 'Invalid restitution tier'; end if;
    if p_key <> 'restore:'||(p_details->>'approvalId') then raise exception 'Invalid restitution key'; end if;
    perform 1 from public.reward_restitution_approvals where id::text=p_details->>'approvalId'
      and user_id=p_owner and tier=p_category and fulfilled_at is null for update;
    if not found then raise exception 'No unfulfilled restitution approval'; end if;
  elsif p_kind = 'claw' then
    if p_key !~ ('^claw:' || p_owner || ':[0-9a-f-]{36}$') then raise exception 'Invalid claw request ID'; end if;
    if coalesce((select credits from public.claw_credits where owner_id=p_owner),0) < 1 then raise exception 'NO_CLAW_CREDITS'; end if;
  elsif p_kind = 'stripe' then
    if p_key <> 'stripe:' || (p_details->>'sessionId') or p_details->>'sessionId' !~ '^cs_' then raise exception 'Invalid Stripe key'; end if;
  else raise exception 'Invalid fulfillment kind';
  end if;
  insert into public.vault_fulfillments(operation_key,owner_id,kind,category,size,details)
    values(p_key,p_owner,p_kind,p_category,p_size,p_details) returning * into v_op;
  return jsonb_build_object('status','reserved','key',p_key,'lease',v_op.lease,
    'category',v_op.category,'size',v_op.size,'details',v_op.details);
end $$;

create or replace function public.complete_vault_fulfillment(p_key text, p_lease uuid, p_cards jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  v_op public.vault_fulfillments%rowtype; v_card jsonb; v_row public.vault_collections%rowtype;
  v_cards jsonb := '[]'; v_result jsonb; v_left integer; v_tokens integer; v_amount integer;
  v_edition integer; v_db_tier text; v_tiers text[] := array['none','common','enhanced','rare','epic','legendary'];
begin
  select * into v_op from public.vault_fulfillments where operation_key = p_key for update;
  if not found or p_lease is null or v_op.lease <> p_lease then raise exception 'Stale fulfillment lease'; end if;
  if v_op.completed_at is not null then return v_op.result; end if;
  if p_cards is null or jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) > 100 then raise exception 'Invalid card batch'; end if;
  if (v_op.kind in ('run_reward','campaign_reward','restitution_reward') or
      (v_op.kind='stripe' and v_op.category not in ('token_bundle','claw_pull')) or
      (v_op.kind='claw' and (v_op.details->>'won')::boolean)) and jsonb_array_length(p_cards)=0 then
    raise exception 'Earned cards cannot be empty';
  end if;
  if v_op.kind='stripe' and v_op.category in ('token_bundle','claw_pull') and jsonb_array_length(p_cards)<>0 then
    raise exception 'Credit purchases cannot mint cards';
  end if;
  -- Lock one profile before card/supply work, so concurrent settlements never lose increments.
  perform 1 from public.profiles where id=v_op.owner_id for update;
  if not found then raise exception 'Profile not found'; end if;

  if v_op.kind = 'claw' then
    v_left := public.spend_claw_credit(v_op.owner_id);
    if v_left < 0 then raise exception 'NO_CLAW_CREDITS'; end if;
    if not (v_op.details->>'won')::boolean and jsonb_array_length(p_cards) <> 0 then raise exception 'Slip cannot mint cards'; end if;
  elsif v_op.kind = 'run_reward' then
    insert into public.gameplay_reward_payouts(user_id,song_id,tier,record_id)
      values(v_op.owner_id,v_op.details->>'songId',v_op.category,v_op.details->>'recordId');
  elsif v_op.kind = 'restitution_reward' then
    update public.reward_restitution_approvals set fulfilled_at=now()
      where id::text=v_op.details->>'approvalId' and user_id=v_op.owner_id and fulfilled_at is null;
    if not found then raise exception 'Restitution was already paid'; end if;
  end if;

  for v_card in select value from jsonb_array_elements(p_cards) loop
    if (v_card->>'owner_id') is distinct from v_op.owner_id::text then raise exception 'Card owner mismatch'; end if;
    -- Allocation and echo consumption roll back with the entire settlement on any failure.
    if v_card ? '_echo_id' then
      delete from public.echo_pool where id::text = v_card->>'_echo_id';
      if not found then raise exception 'Echo was claimed by another pack; retry'; end if;
    end if;
    v_edition := public.increment_supply(v_card->>'_supply_key',(v_card->>'max_supply')::integer);
    if v_edition is null then raise exception 'Supply allocation failed'; end if;
    if v_edition < 1 then raise exception 'Supply exhausted; retry the same request'; end if;
    v_card := v_card || jsonb_build_object('edition',v_edition);
    -- Populate the actual table type to preserve deployed column types and defaults.
    v_row := jsonb_populate_record(null::public.vault_collections, v_card);
    insert into public.vault_collections(owner_id,card_id,rarity,source,is_echo,echo_generation,
      echo_source_day,edition,max_supply,proof,ultra_reward,claimed_at,fingerprint)
      values(v_op.owner_id,v_row.card_id,v_row.rarity,v_row.source,v_row.is_echo,v_row.echo_generation,
        v_row.echo_source_day,v_row.edition,v_row.max_supply,v_row.proof,v_row.ultra_reward,v_row.claimed_at,v_row.fingerprint)
      returning * into v_row;
    v_cards := v_cards || jsonb_build_array(to_jsonb(v_row));
    update public.profiles set total_pulls=coalesce(total_pulls,0)+1,
      pulls_since_rare_plus=case when v_row.rarity in ('rare','legendary','mythic') then 0 else coalesce(pulls_since_rare_plus,0)+1 end,
      pity_counter=case when v_row.rarity in ('rare','legendary','mythic') then 0 else coalesce(pity_counter,0)+1 end
      where id=v_op.owner_id;
  end loop;
  v_result := jsonb_build_object('success',true,'cards',v_cards);

  if v_op.kind = 'stripe' then
    v_amount := coalesce((v_op.details->>'tokenAmount')::integer,0);
    if v_amount < 0 then raise exception 'Invalid tokens'; end if;
    if v_op.category = 'claw_pull' then
      v_left := public.grant_claw_purchase(v_op.owner_id,v_op.details->>'sessionId',1);
      if v_left is null then select credits into v_left from public.claw_credits where owner_id=v_op.owner_id; end if;
      v_result := v_result || jsonb_build_object('isClawPull',true,'credits',v_left);
    elsif v_op.category = 'token_bundle' then
      perform set_config('app.allow_token_update','true',true);
      update public.profiles set tokens=coalesce(tokens,0)+v_amount,
        tokens_earned_total=coalesce(tokens_earned_total,0)+v_amount
        where id=v_op.owner_id returning tokens into v_tokens;
      v_result := v_result || jsonb_build_object('isTokenBundle',true,'tokenAmount',v_amount,'newBalance',v_tokens);
    end if;
    insert into public.stripe_orders(user_id,stripe_session_id,pack_category,pack_size,amount_cents,currency,status,cards_minted,completed_at)
      values(v_op.owner_id,v_op.details->>'sessionId',v_op.category,v_op.size,
        (v_op.details->>'amountCents')::integer,v_op.details->>'currency','completed',v_cards,now())
      on conflict(stripe_session_id) do update set status='completed',cards_minted=excluded.cards_minted,completed_at=now();
  elsif v_op.kind = 'claw' then
    insert into public.claw_pulls(owner_id,category,size,won,card_count)
      values(v_op.owner_id,v_op.category,v_op.size,(v_op.details->>'won')::boolean,jsonb_array_length(v_cards));
    v_result := v_result || jsonb_build_object('won',(v_op.details->>'won')::boolean,'credits',v_left,
      'prize',jsonb_build_object('packType',v_op.category,'size',v_op.size,'cardCount',jsonb_array_length(v_cards)));
  elsif v_op.kind = 'run_reward' then
    v_db_tier := case v_op.category when 'free' then 'common' when 'taste' then 'enhanced'
      when 'special_picks' then 'rare' when 'alpha' then 'epic' when 'prophecy' then 'legendary' end;
    update public.gameplay_records set pack_rewarded=true,
      reward_tier=case when coalesce(array_position(v_tiers,reward_tier),1) >= array_position(v_tiers,v_db_tier)
        then reward_tier else v_db_tier end where id::text=v_op.details->>'recordId';
    v_result := v_result || jsonb_build_object('verifiedReward',true,'tokenCost',0);
  elsif v_op.kind = 'campaign_reward' then
    v_result := v_result || jsonb_build_object('verifiedReward',true,'tokenCost',0);
  end if;
  update public.vault_fulfillments set result=v_result,completed_at=now() where operation_key=p_key;
  return v_result;
end $$;

create or replace function public.release_vault_fulfillment(p_key text,p_lease uuid)
returns void language sql security definer set search_path = public, pg_catalog as $$
  delete from public.vault_fulfillments where operation_key=p_key and lease=p_lease and completed_at is null;
$$;

do $$ declare f text; begin
  foreach f in array array[
    'public.approve_reward_restitution(uuid,text,text,text,jsonb)',
    'public.begin_vault_fulfillment(text,uuid,text,text,text,jsonb)',
    'public.complete_vault_fulfillment(text,uuid,jsonb)',
    'public.release_vault_fulfillment(text,uuid)'
  ] loop
    execute format('revoke all on function %s from public,anon,authenticated',f);
    execute format('grant execute on function %s to service_role',f);
  end loop;
end $$;
commit;
