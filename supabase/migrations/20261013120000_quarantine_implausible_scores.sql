-- Quarantine leaderboard rows that break the medal rules submit_score has enforced since
-- 2026-09-24 (PLATINUM >= 93% accuracy, GOLD >= 80, SILVER >= 60, BRONZE >= 40).
--
-- These predate the score authority (they were written straight into gameplay_records) and
-- stayed under each song's max-score cap, so the earlier over-cap / zero-score quarantines
-- didn't catch them — e.g. 1,203,225 PLATINUM runs with 0% accuracy and 0 combo.
--
-- Rows are MOVED to gameplay_records_quarantine (same pattern as the earlier quarantine
-- migrations), not destroyed. To restore one:
--   insert into public.gameplay_records
--   select (jsonb_populate_record(null::public.gameplay_records, to_jsonb(q))).*
--   from public.gameplay_records_quarantine q where q.id = '<id>';
-- Preview first with supabase/queries/preview_implausible_scores.sql.

begin;

create table if not exists public.gameplay_records_quarantine (
  like public.gameplay_records including all
);
alter table public.gameplay_records_quarantine
  add column if not exists quarantined_at timestamptz not null default now();
alter table public.gameplay_records_quarantine
  add column if not exists quarantine_reason text;
alter table public.gameplay_records_quarantine enable row level security;

-- Bring the quarantine table up to date with any columns gameplay_records gained since it was
-- created, so nothing is lost in the copy.
do $$
declare c record;
begin
  for c in
    select a.attname, format_type(a.atttypid, a.atttypmod) as typ
    from pg_attribute a
    where a.attrelid = 'public.gameplay_records'::regclass and a.attnum > 0 and not a.attisdropped
      and not exists (
        select 1 from pg_attribute q
        where q.attrelid = 'public.gameplay_records_quarantine'::regclass
          and q.attname = a.attname and not q.attisdropped)
  loop
    execute format('alter table public.gameplay_records_quarantine add column %I %s', c.attname, c.typ);
  end loop;
end $$;

with implausible as (
  select gr.*
  from public.gameplay_records gr
  where (gr.medal = 'PLATINUM' and gr.accuracy < 93)
     or (gr.medal = 'GOLD'     and gr.accuracy < 80)
     or (gr.medal = 'SILVER'   and gr.accuracy < 60)
     or (gr.medal = 'BRONZE'   and gr.accuracy < 40)
)
-- Copy by column name (to_jsonb/jsonb_populate_record), so it still works if gameplay_records
-- has gained columns since the quarantine table was created.
insert into public.gameplay_records_quarantine
select (jsonb_populate_record(
          null::public.gameplay_records_quarantine,
          to_jsonb(i) || jsonb_build_object(
            'quarantined_at', now(),
            'quarantine_reason', 'medal/accuracy implausible (pre score-authority)'))).*
from implausible i
where not exists (select 1 from public.gameplay_records_quarantine q where q.id = i.id);

delete from public.gameplay_records gr
where (gr.medal = 'PLATINUM' and gr.accuracy < 93)
   or (gr.medal = 'GOLD'     and gr.accuracy < 80)
   or (gr.medal = 'SILVER'   and gr.accuracy < 60)
   or (gr.medal = 'BRONZE'   and gr.accuracy < 40);

commit;

-- Result check
select
  (select count(*) from public.gameplay_records_quarantine
    where quarantine_reason = 'medal/accuracy implausible (pre score-authority)') as quarantined_now,
  (select count(*) from public.gameplay_records
    where (medal = 'PLATINUM' and accuracy < 93) or (medal = 'GOLD' and accuracy < 80)
       or (medal = 'SILVER' and accuracy < 60) or (medal = 'BRONZE' and accuracy < 40)) as remaining;
