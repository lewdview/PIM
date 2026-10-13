-- Quarantine the bulk-synced score rows left after 20261013120000: positive scores with BOTH
-- 0 accuracy and 0 combo, written before the score authority shipped (2026-09-24).
--
-- Evidence (read-only, 2026-10-13): 25,293 rows, 25,289 of them from the same 19 accounts as
-- the medal/accuracy quarantine; written in bursts of up to ~200 rows per second between
-- 2026-08-29 and 2026-09-24; identical scores repeated across many accounts. Not human play —
-- an old client bulk-pushing local/seeded high scores. Genuine runs (accuracy > 0) are untouched.
--
-- Rows are MOVED to gameplay_records_quarantine, not destroyed. To restore one:
--   insert into public.gameplay_records
--   select (jsonb_populate_record(null::public.gameplay_records, to_jsonb(q))).*
--   from public.gameplay_records_quarantine q where q.id = '<id>';

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
  where gr.score > 0 and gr.accuracy = 0 and gr.max_combo = 0
    and gr."timestamp" < '2026-09-25'
)
-- Copy by column name (to_jsonb/jsonb_populate_record), so it still works if gameplay_records
-- has gained columns since the quarantine table was created.
insert into public.gameplay_records_quarantine
select (jsonb_populate_record(
          null::public.gameplay_records_quarantine,
          to_jsonb(i) || jsonb_build_object(
            'quarantined_at', now(),
            'quarantine_reason', 'bulk-synced, no accuracy/combo (pre score-authority)'))).*
from implausible i
where not exists (select 1 from public.gameplay_records_quarantine q where q.id = i.id);

delete from public.gameplay_records gr
where gr.score > 0 and gr.accuracy = 0 and gr.max_combo = 0
  and gr."timestamp" < '2026-09-25';

commit;

-- Result check
select
  (select count(*) from public.gameplay_records_quarantine
    where quarantine_reason = 'bulk-synced, no accuracy/combo (pre score-authority)') as quarantined_now,
  (select count(*) from public.gameplay_records
    where score > 0 and accuracy = 0 and max_combo = 0 and "timestamp" < '2026-09-25') as remaining,
  (select count(*) from public.gameplay_records) as runs_left;
