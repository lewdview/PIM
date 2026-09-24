-- Quarantine abandoned gameplay runs (2026-09-24).
--
-- Context: after the card-alias backfill (20260924140000), 680 rows remain
-- live with score null or <= 0 (all accuracy 0, max_combo 0 -- runs where no
-- gameplay happened). The "score must be positive" rule predates every
-- trigger version, so these are invalid data, not history. They sit at the
-- bottom of every leaderboard (score 0) and are harmless, but they fail the
-- live validator and should not be in the live table.
--
-- Quarantine, not delete (same policy as 20260924133500).
-- Apply via the Supabase SQL editor. Idempotent.

-- Ensure the quarantine table exists.
create table if not exists public.gameplay_records_quarantine (
  like public.gameplay_records including all
);
alter table public.gameplay_records_quarantine
  add column if not exists quarantined_at timestamptz not null default now();
alter table public.gameplay_records_quarantine enable row level security;

insert into public.gameplay_records_quarantine
select gr.*, now()
from public.gameplay_records gr
where (gr.score is null or gr.score <= 0)
  and not exists (
    select 1 from public.gameplay_records_quarantine q where q.id = gr.id
  );

delete from public.gameplay_records
where (score is null or score <= 0);

-- Report.
select
  (select count(*) from public.gameplay_records
     where score is null or score <= 0) as remaining_bad_scores,
  (select count(*) from public.gameplay_records_quarantine) as quarantined_total;
-- Expect: remaining_bad_scores = 0.
