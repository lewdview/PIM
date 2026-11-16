-- Audius contest cards: allow the same track in multiple contest weeks.
-- card_id was globally UNIQUE, so a track repeating in a later week's
-- contest (Brooke Evers "Murder She Wrote", J7Xb000, weeks 2026-11-09 and
-- 2026-11-16) made build_audius_contest_cards fail with 23505 and left the
-- repeat week with no claimable card rows (claims select by week_start).
-- The primary key (week_start, track_id, kind) already prevents duplicates
-- within a week. Applied live 2026-11-16; week 2026-11-16 backfilled.
alter table public.audius_contest_cards
  drop constraint if exists audius_contest_cards_card_id_key;
