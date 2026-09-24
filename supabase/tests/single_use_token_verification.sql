-- Single-use run token verification (Supabase SQL editor, run steps in order).
-- Replace <YOUR_USER_UUID> with your app user id
--   (find it: select id from auth.users where email = '<you>';)
-- Copy each minted token UUID into the T1/T2/T3 slots as you go.

-- STEP 0: impersonate your app user (editor runs as postgres; auth.uid() is null there)
select set_config('request.jwt.claim.sub', '<YOUR_USER_UUID>', false);

-- STEP 1: mint a token for day-092  → copy the UUID as T1
select public.request_run_token('day-092');

-- STEP 2: token row exists?  (expect 1)
select count(*) from public.gameplay_run_tokens where id = 'T1';

-- STEP 3: valid submit — consumes T1  (expect {"success": true, ...}; note the record id)
select public.submit_score('day-092', 100000, 85.00, 500, 'GOLD', false, 'none', null, 'T1');

-- STEP 4: token row gone? — the single-use proof  (expect 0)
select count(*) from public.gameplay_run_tokens where id = 'T1';

-- STEP 5: replay the same token  (expect ERROR: Invalid, expired, or already-used run token)
select public.submit_score('day-092', 100001, 85.00, 500, 'GOLD', false, 'none', null, 'T1');

-- STEP 6: mint T2, then submit it for the WRONG song.
-- expect ERROR, and the token must SURVIVE (rollback restores it) — expect count = 1 after.
select public.request_run_token('day-092');  -- → T2
select public.submit_score('day-093', 100000, 85.00, 500, 'GOLD', false, 'none', null, 'T2');
select count(*) from public.gameplay_run_tokens where id = 'T2';

-- STEP 7: expire T2 manually, then submit  (expect ERROR)
update public.gameplay_run_tokens set expires_at = now() - interval '1 minute' where id = 'T2';
select public.submit_score('day-092', 100000, 85.00, 500, 'GOLD', false, 'none', null, 'T2');

-- STEP 8: missing token  (expect ERROR: Run token required)
select public.submit_score('day-092', 100000, 85.00, 500, 'GOLD', false, 'none', null, null);

-- STEP 9 (optional): cross-user — mint T3 as yourself, then impersonate a
-- second user and submit. Expect ERROR.
--   select public.request_run_token('day-092');  -- → T3
--   select set_config('request.jwt.claim.sub', '<SECOND_USER_UUID>', false);
--   select public.submit_score('day-092', 100000, 85.00, 500, 'GOLD', false, 'none', null, 'T3');
--   select set_config('request.jwt.claim.sub', '<YOUR_USER_UUID>', false);

-- STEP 10: cleanup — remove the test row(s) and tokens, drop impersonation
-- (replace <RECORD_ID> with the id from step 3's output)
delete from public.gameplay_records where id = '<RECORD_ID>';
delete from public.gameplay_run_tokens where user_id = '<YOUR_USER_UUID>';
reset request.jwt.claim.sub;

-- NOTE: the unknown-song branch is defense-in-depth and not directly
-- testable: request_run_token itself rejects unknown songs, so no token can
-- ever be minted for one. It only fires if a song is retired from
-- song_max_scores between mint and submit.
