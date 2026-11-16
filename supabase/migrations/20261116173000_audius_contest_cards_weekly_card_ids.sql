-- Audius contest cards: weekly editions (Bryan's call, 2026-11-16).
-- A track returning in a later contest week is a SEPARATE card, clearly
-- defined by its week. card_id becomes week-scoped:
--   standard   'aud-<track id>-<week_start>'           rarity 'rare'
--   bombshell  'bombshell-aud-<track id>-<week_start>' rarity 'legendary'
-- Existing definition rows are renamed in place; already-granted
-- vault_collections rows follow via audius_contest_card_claims.card_row_id
-- (the exact grant link recorded at claim time). The global UNIQUE on
-- card_id is restored at the end: with the week inside the id, uniqueness
-- is the correct invariant again.
-- Applied live 2026-11-16 via the Management API; keep in repo so a fresh
-- environment rebuild matches production.

begin;

-- 1. Card maker: week-scoped ids (only the card_id expression changes).
create or replace function public.build_audius_contest_cards(p_week date)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_built integer := 0;
  v_n integer;
begin
  if not exists (select 1 from public.audius_weekly_contests where week_start = p_week) then
    raise exception 'no audius contest locked for week %', p_week;
  end if;

  insert into public.audius_contest_cards
    (week_start, track_id, kind, card_id, title, artist, handle, permalink, artwork, genre, duration)
  select p_week,
         t->>'id',
         k.kind,
         case k.kind when 'standard' then 'aud-' || (t->>'id') || '-' || p_week::text
                     else 'bombshell-aud-' || (t->>'id') || '-' || p_week::text end,
         t->>'title', t->>'artist', t->>'handle', t->>'permalink',
         t->>'artwork', t->>'genre', coalesce((t->>'duration')::integer, 0)
  from public.audius_weekly_contests c, jsonb_array_elements(c.tracks) t
  cross join (values ('standard'), ('bombshell')) as k(kind)
  where c.week_start = p_week
  on conflict (week_start, track_id, kind) do nothing;
  get diagnostics v_n = row_count;
  v_built := v_built + v_n;

  insert into public.song_max_scores (song_id, max_score, computed_from)
  select s.song_id || '_deluxe',
         least(2147483647, ceil(s.max_score * 2.5))::integer,
         'deluxe-2.5x'
  from public.song_max_scores s
  join public.audius_weekly_contests c on c.week_start = p_week
  where s.song_id in (select 'aud-' || (t->>'id')
                      from jsonb_array_elements(c.tracks) t)
  on conflict (song_id) do nothing;

  return v_built;
end;
$$;

-- 2. Rename existing definition rows to week-scoped ids.
update public.audius_contest_cards
set card_id = card_id || '-' || week_start::text
where card_id not like '%-____-__-__';

-- 3. Already-granted cards follow their claim's week (exact link).
update public.vault_collections v
set card_id = v.card_id || '-' || cl.week_start::text
from public.audius_contest_card_claims cl
where cl.card_row_id = v.id
  and v.source in ('audius_contest', 'audius_contest_deluxe')
  and v.card_id not like '%-____-__-__';

-- 4. Uniqueness is correct again with the week inside the id.
alter table public.audius_contest_cards
  add constraint audius_contest_cards_card_id_key unique (card_id);

commit;
