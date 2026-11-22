-- Score caps for the two Beyond 365 tracks uploaded 2026-11-17, so runs on
-- them can be submitted and ranked. Same rule as
-- 20261109090000_audius_beyond_365_scores.sql: 40,000 points per second of
-- audio (deadly 296s, don't fuck with yourself 163s).

begin;

insert into public.song_max_scores (song_id, max_score, computed_from) values
  ('audius-deadly', 11840000, 'audius-runtime-v6'),
  ('audius-dont-fuck-with-yourself', 6520000, 'audius-runtime-v6')
on conflict (song_id) do update
  set max_score = excluded.max_score, computed_from = excluded.computed_from, updated_at = now();

commit;
