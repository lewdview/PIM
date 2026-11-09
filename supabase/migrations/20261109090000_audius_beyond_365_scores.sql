-- Let Beyond 365 tracks (Audius uploads that aren't a 365 day) be played
-- and ranked in PIM.
--
-- request_run_token and submit_score only accept song ids listed in
-- public.song_max_scores. Beyond 365 tracks use the id "audius-<slug>", from
-- the track's Audius permalink (/th3Scr1b3/success -> audius-success); see
-- src/lib/audius.ts. They have no baked chart: gameplay forges a Chart Master
-- chart from the Audius stream, so there is no chart to simulate a perfect
-- run against. The cap is 40,000 points per second of audio, about 1.25x the
-- densest 365 chart (31.7K/s, day caps vs catalog durations). Like the other
-- rows, it is a plausibility bound, not an exact maximum.
--
-- Generated from src/data/audius_map.json (status "beyond"). When a new
-- Beyond 365 track is added there, add its row here in a new migration.

begin;

insert into public.song_max_scores (song_id, max_score, computed_from) values
  ('audius-christ-conciousness', 10480000, 'audius-runtime-v6'),
  ('audius-timezone-kisses', 8120000, 'audius-runtime-v6'),
  ('audius-letters-of-you', 8200000, 'audius-runtime-v6'),
  ('audius-th3scr1b3-phloeasy-present-crazy-inside-a-remix-of-uproar', 15560000, 'audius-runtime-v6'),
  ('audius-burning-it-down-feat-zillick', 11080000, 'audius-runtime-v6'),
  ('audius-success', 6880000, 'audius-runtime-v6'),
  ('audius-get-inside-another-day-2', 7080000, 'audius-runtime-v6'),
  ('audius-hiding_p-lace-2', 6640000, 'audius-runtime-v6'),
  ('audius-l-like-mud-2', 6400000, 'audius-runtime-v6'),
  ('audius-fuck-my-mind_av-2', 5440000, 'audius-runtime-v6'),
  ('audius-make-me-believe-2', 5800000, 'audius-runtime-v6'),
  ('audius-take-you-home-2', 5400000, 'audius-runtime-v6')
on conflict (song_id) do update
  set max_score = excluded.max_score, computed_from = excluded.computed_from, updated_at = now();

commit;
