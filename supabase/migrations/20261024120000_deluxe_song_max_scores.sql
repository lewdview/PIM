-- Let Deluxe chart runs (song id day-XXX_deluxe) submit scores.
--
-- request_run_token and submit_score only accept song ids listed in
-- public.song_max_scores, and Deluxe ids were not listed, so a finished
-- Deluxe run could not be recorded. Deluxe scores stay separate from the
-- standard chart's because the id differs.
--
-- Deluxe charts (Chart Master Deluxe) carry roughly 1.4-1.7x the notes of the
-- standard chart and play 2 difficulty levels higher, which raises the combo
-- multiplier cap. The cap here is 2.5x the standard chart's max: a plausibility
-- bound, like the existing rows, not an exact simulation.

begin;

insert into public.song_max_scores (song_id, max_score, computed_from)
select song_id || '_deluxe', least(2147483647, ceil(max_score * 2.5))::integer, 'deluxe-2.5x'
from public.song_max_scores
where song_id ~ '^day-[0-9]{3}$'
on conflict (song_id) do update
  set max_score = excluded.max_score, computed_from = excluded.computed_from, updated_at = now();

commit;
