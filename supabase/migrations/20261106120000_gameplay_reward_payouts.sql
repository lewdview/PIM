-- Gameplay reward payouts ledger
--
-- One row per (player, song, tier) the vault-engine has paid out as a gameplay
-- reward. vault-engine inserts the row BEFORE minting (the primary key makes a
-- second payout of the same tier for the same song impossible) and deletes it
-- again if minting fails.
--
-- Rewards backed by a verified run (a gameplay_records row written through the
-- token-checked submit_score RPC) skip the daily pack caps; this ledger is what
-- keeps that safe.

create table if not exists public.gameplay_reward_payouts (
  user_id   uuid not null references auth.users (id) on delete cascade,
  song_id   text not null,
  tier      text not null check (tier in ('free', 'taste', 'special_picks', 'alpha', 'prophecy')),
  record_id text,
  paid_at   timestamptz not null default now(),
  primary key (user_id, song_id, tier)
);

alter table public.gameplay_reward_payouts enable row level security;

drop policy if exists "gameplay_reward_payouts_read_own" on public.gameplay_reward_payouts;
create policy "gameplay_reward_payouts_read_own" on public.gameplay_reward_payouts
  for select to authenticated using (user_id = auth.uid());

-- Only the edge function (service role) writes.
revoke insert, update, delete on public.gameplay_reward_payouts from anon, authenticated;

-- Backfill from past claims so tiers already paid can't be claimed again.
-- gameplay_records keeps one row per claim with the highest tier
-- (common/enhanced/rare/epic/legendary). A PLATINUM claim paid every tier up to
-- that one (the Platinum bundle); any other claim paid just that tier.
with ladder(tier, db_tier, rank) as (
  values ('free', 'common', 1), ('taste', 'enhanced', 2), ('special_picks', 'rare', 3),
         ('alpha', 'epic', 4), ('prophecy', 'legendary', 5)
),
claims as (
  select gr.user_id, public.normalize_song_id(gr.song_id) as song_id, gr.medal, l.rank
  from public.gameplay_records gr
  join ladder l on l.db_tier = gr.reward_tier
  where gr.pack_rewarded
)
insert into public.gameplay_reward_payouts (user_id, song_id, tier)
select distinct c.user_id, c.song_id, l.tier
from claims c
join ladder l on l.rank = c.rank or (c.medal = 'PLATINUM' and l.rank < c.rank)
on conflict do nothing;
