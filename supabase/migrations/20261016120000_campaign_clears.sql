-- Campaign clears: one row per (player, stage song) for stages passed from a campaign run.
--
-- Campaign progress is kept apart from on-demand plays (collection, codex, award play,
-- search). Until now it lived only in localStorage (campaign_clear_<songId>), so a player
-- who cleared a stage on one device saw it locked on another. The client now records each
-- clear here and hydrates localStorage from it in loadVaultData.
--
-- Rows are readable only by their owner. Writes go through record_campaign_clear, which
-- merges monotonically (best medal, highest score), so a stale device can never downgrade
-- a clear another device recorded.

begin;

create table if not exists public.campaign_clears (
  user_id    uuid not null references auth.users(id) on delete cascade,
  song_id    text not null check (length(song_id) between 1 and 100),
  medal      text not null default 'NONE'
               check (medal in ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
  score      integer not null default 0 check (score >= 0),
  cleared_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

alter table public.campaign_clears enable row level security;

drop policy if exists "campaign_clears_read_own" on public.campaign_clears;
create policy "campaign_clears_read_own" on public.campaign_clears
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.campaign_clears from anon, authenticated;
grant select on public.campaign_clears to authenticated;

create or replace function public.record_campaign_clear(
  p_song_id text,
  p_medal   text,
  p_score   integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid   uuid := auth.uid();
  v_song  text := nullif(left(trim(coalesce(p_song_id, '')), 100), '');
  v_medal text := upper(coalesce(nullif(trim(p_medal), ''), 'NONE'));
  v_score integer := greatest(coalesce(p_score, 0), 0);
begin
  if v_uid is null or v_song is null then
    return;
  end if;
  if v_medal not in ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM') then
    v_medal := 'NONE';
  end if;

  insert into public.campaign_clears as c (user_id, song_id, medal, score)
  values (v_uid, v_song, v_medal, v_score)
  on conflict (user_id, song_id) do update
    set medal = case
                  when array_position(array['NONE','BRONZE','SILVER','GOLD','PLATINUM'], excluded.medal)
                     > array_position(array['NONE','BRONZE','SILVER','GOLD','PLATINUM'], c.medal)
                  then excluded.medal else c.medal
                end,
        score = greatest(c.score, excluded.score),
        updated_at = now();
end;
$$;

revoke execute on function public.record_campaign_clear(text, text, integer) from public, anon;
grant execute on function public.record_campaign_clear(text, text, integer) to authenticated, service_role;

commit;
