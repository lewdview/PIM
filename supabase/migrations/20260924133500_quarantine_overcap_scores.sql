-- Quarantine fabricated over-cap leaderboard rows (2026-09-24).
--
-- Context: 1,231 historical gameplay_records rows exceed their per-song cap in
-- song_max_scores. Forensics showed they are fabricated direct submissions, not
-- real play: constant score 7,230,650 (exactly 1/10 of the retired 72,306,500
-- global trigger ceiling), accuracy 0, max_combo 0, null telemetry, submitted
-- seconds/milliseconds apart, and no chart in the game (all 2,572 charts across
-- v1-v5 + canonical + deluxe) has a theoretical max anywhere near that value.
-- Per Bryan's decision: quarantine (preserve), do not delete.
--
-- Strategy: move the rows to gameplay_records_quarantine and delete them from
-- the live table. Leaderboards read gameplay_records, so this cleans them with
-- no view or client changes. Fully reversible: re-insert from the quarantine
-- table to restore.
--
-- Apply via the Supabase SQL editor (service role bypasses RLS). Idempotent:
-- re-running moves zero additional rows.

-- 1. Quarantine table mirrors gameplay_records, plus an audit timestamp.
create table if not exists public.gameplay_records_quarantine (
  like public.gameplay_records including all
);
alter table public.gameplay_records_quarantine
  add column if not exists quarantined_at timestamptz not null default now();

-- No direct client access: readable/writable only via service_role / dashboard.
alter table public.gameplay_records_quarantine enable row level security;

-- 2. Snapshot the over-cap rows before removing them.
insert into public.gameplay_records_quarantine
select gr.*, now()
from public.gameplay_records gr
join public.song_max_scores sm on sm.song_id = gr.song_id
where gr.score > sm.max_score
  and not exists (
    select 1 from public.gameplay_records_quarantine q where q.id = gr.id
  );

-- 3. Remove them from the live leaderboard table.
delete from public.gameplay_records gr
using public.song_max_scores sm
where sm.song_id = gr.song_id
  and gr.score > sm.max_score;

-- 4. Report: expect quarantined_rows = 1231, remaining_over_cap = 0.
select
  (select count(*) from public.gameplay_records_quarantine) as quarantined_rows,
  (select count(*) from public.gameplay_records gr
     join public.song_max_scores sm on sm.song_id = gr.song_id
    where gr.score > sm.max_score) as remaining_over_cap;

-- 5. Diagnostic only (no changes): rows for songs with no known cap.
--    Phase-2 submit_score rejects unknown songs going forward; these are
--    historical leftovers for Bryan to decide on separately.
select gr.song_id, count(*) as rows, max(gr.score) as max_score
from public.gameplay_records gr
where not exists (select 1 from public.song_max_scores sm where sm.song_id = gr.song_id)
group by gr.song_id
order by rows desc;
