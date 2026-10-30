-- Make the custom song (Ultra reward) cap airtight.
--
-- vault-engine rolled the 0.3% chance with no cap at all, so 7 custom songs dropped
-- against a cap of 5. Counting rows before inserting is not enough on its own: two
-- packs opened at the same moment both see the same count. reserve_ultra_reward()
-- hands out slots one at a time under a row lock, so vault-engine only marks a card
-- as a custom song after it holds a slot.
--
-- awarded tracks slots handed out, including ones whose card insert is still in flight.
-- After 5 quiet minutes it resyncs to the real count in vault_collections, so clearing
-- an award by hand (setting ultra_reward to null) frees its slot, and a slot reserved
-- for a pack whose insert failed is not lost for good.

begin;

create table if not exists public.ultra_reward_slots (
  id integer primary key default 1 check (id = 1),
  awarded integer not null default 0,
  last_reserved_at timestamptz not null default 'epoch'
);
insert into public.ultra_reward_slots (id) values (1) on conflict (id) do nothing;

alter table public.ultra_reward_slots enable row level security;
revoke all on public.ultra_reward_slots from anon, authenticated;

create or replace function public.reserve_ultra_reward(p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_slots public.ultra_reward_slots%rowtype;
  v_actual integer;
  v_base integer;
begin
  select * into v_slots from public.ultra_reward_slots where id = 1 for update;

  select count(*) into v_actual from public.vault_collections v
  where public.has_ultra_reward(v.ultra_reward);

  v_base := case when v_slots.last_reserved_at < now() - interval '5 minutes'
                 then v_actual
                 else greatest(v_actual, v_slots.awarded) end;

  if v_base >= coalesce(p_max, 0) then
    update public.ultra_reward_slots set awarded = v_base where id = 1;
    return false;
  end if;

  update public.ultra_reward_slots set awarded = v_base + 1, last_reserved_at = now() where id = 1;
  return true;
end;
$$;

-- Only vault-engine (service role) reserves slots.
revoke execute on function public.reserve_ultra_reward(integer) from public, anon, authenticated;
grant execute on function public.reserve_ultra_reward(integer) to service_role;

commit;
