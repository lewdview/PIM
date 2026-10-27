-- Read-only preview for 20261013120000_quarantine_implausible_scores.sql.
-- Run this first in the SQL editor; it changes nothing.

-- 1. Rows that break the medal rules submit_score enforces today (these would be quarantined).
select medal,
       count(*)                          as rows,
       count(distinct user_id)           as players,
       min("timestamp")                  as earliest,
       max("timestamp")                  as latest,
       round(avg(accuracy), 2)           as avg_accuracy,
       max(score)                        as top_score
from public.gameplay_records
where (medal = 'PLATINUM' and accuracy < 93)
   or (medal = 'GOLD'     and accuracy < 80)
   or (medal = 'SILVER'   and accuracy < 60)
   or (medal = 'BRONZE'   and accuracy < 40)
group by medal
order by rows desc;

-- 2. For context only (NOT quarantined): positive scores with 0 accuracy or 0 combo and no medal.
--    Old game versions may simply not have sent these numbers.
select count(*) filter (where accuracy = 0)  as zero_accuracy,
       count(*) filter (where max_combo = 0) as zero_combo,
       min("timestamp") as earliest, max("timestamp") as latest
from public.gameplay_records
where score > 0 and medal = 'NONE' and (accuracy = 0 or max_combo = 0);

-- 3. Anything implausible submitted AFTER the score rules shipped (should be 0).
select count(*) as after_rules
from public.gameplay_records
where "timestamp" >= '2026-09-24'
  and ((medal = 'PLATINUM' and accuracy < 93) or (medal = 'GOLD' and accuracy < 80)
    or (medal = 'SILVER' and accuracy < 60) or (medal = 'BRONZE' and accuracy < 40));
