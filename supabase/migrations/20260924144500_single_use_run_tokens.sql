-- Single-use run tokens (2026-09-24).
--
-- Context: phase-2 run tokens were read-but-never-consumed, so a captured
-- token could be replayed for different scores until its 30-minute expiry.
-- This migration makes submit_score atomically consume the token
-- (DELETE ... RETURNING): each token is good for exactly one submission.
-- If any later check or the insert fails, the transaction rolls back and
-- the token is NOT consumed, so a legitimate client can retry the same
-- submission with the same token.
--
-- Client impact: the two results-screen submission paths (high-score sync
-- and pack-claim record) must each use their own token. GameResults mints a
-- fresh token for the pack-claim path; the high-score path keeps the
-- countdown-time token.
--
-- Also revokes direct EXECUTE on the validate_gameplay_score trigger
-- function from all client roles. PostgreSQL checks EXECUTE on a trigger
-- function at CREATE TRIGGER time, not at fire time, so this cannot break
-- the existing trigger; it only blocks direct invocation.
--
-- Apply via the Supabase SQL editor. Idempotent.

create or replace function public.submit_score(
  p_song_id text,
  p_score integer,
  p_accuracy numeric,
  p_max_combo integer,
  p_medal text,
  p_pack_rewarded boolean default false,
  p_reward_tier text default 'none'::text,
  p_telemetry jsonb default null::jsonb,
  p_run_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_cap integer;
  v_medal text;
  v_accuracy numeric;
  v_tier text;
  v_record jsonb;
  v_consumed uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_song_id is null or char_length(p_song_id) = 0 or char_length(p_song_id) > 64 then
    raise exception 'Invalid song ID';
  end if;

  -- Normalize FIRST: tokens are minted against the canonical id, so the
  -- binding check below compares canonical to canonical.
  p_song_id := public.normalize_song_id(p_song_id);

  -- Single-use run token: atomically consume it. Binds this submission to
  -- a run started by this user for this song within the last 30 minutes.
  -- One token, one submission: defeats replay of captured tokens, not
  -- just replay of captured requests.
  if p_run_token is null then
    raise exception 'Run token required';
  end if;
  delete from public.gameplay_run_tokens
  where id = p_run_token
    and user_id = v_user_id
    and song_id = p_song_id
    and expires_at > now()
  returning id into v_consumed;
  if v_consumed is null then
    raise exception 'Invalid, expired, or already-used run token';
  end if;

  -- Unknown songs are rejected outright (no permissive fallback).
  select max_score into v_cap
    from public.song_max_scores
    where song_id = p_song_id;
  if v_cap is null then
    raise exception 'Unknown song: %', p_song_id;
  end if;

  if p_score is null or p_score <= 0 or p_score > v_cap then
    raise exception 'Score out of valid bounds (1 - %)', v_cap;
  end if;

  v_accuracy := round(p_accuracy::numeric, 2);
  if v_accuracy is null or v_accuracy < 0 or v_accuracy > 100 then
    raise exception 'Accuracy out of valid bounds (0.00 - 100.00)';
  end if;

  if p_max_combo is null or p_max_combo < 0 or p_max_combo > 100000 then
    raise exception 'Invalid max combo';
  end if;

  v_medal := upper(trim(coalesce(p_medal, 'NONE')));
  if v_medal not in ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM') then
    raise exception 'Invalid medal value';
  end if;
  if v_medal = 'PLATINUM' and v_accuracy < 93 then
    raise exception 'Plausibility violation: PLATINUM requires >= 93%% accuracy';
  elsif v_medal = 'GOLD' and v_accuracy < 80 then
    raise exception 'Plausibility violation: GOLD requires >= 80%% accuracy';
  elsif v_medal = 'SILVER' and v_accuracy < 60 then
    raise exception 'Plausibility violation: SILVER requires >= 60%% accuracy';
  elsif v_medal = 'BRONZE' and v_accuracy < 40 then
    raise exception 'Plausibility violation: BRONZE requires >= 40%% accuracy';
  end if;

  v_tier := lower(trim(coalesce(p_reward_tier, 'none')));
  if v_tier not in ('none', 'common', 'enhanced', 'rare', 'epic', 'legendary', 'mythic') then
    v_tier := 'none';
  end if;

  insert into public.gameplay_records
    (user_id, song_id, score, accuracy, max_combo, medal, pack_rewarded, reward_tier, telemetry)
  values
    (v_user_id, p_song_id, p_score, v_accuracy, p_max_combo, v_medal,
     coalesce(p_pack_rewarded, false), v_tier, p_telemetry)
  returning jsonb_build_object(
    'id', id, 'score', score, 'medal', medal,
    'accuracy', accuracy, 'timestamp', "timestamp")
  into v_record;

  return jsonb_build_object('success', true, 'record', v_record);
end
$function$;

revoke all on function public.submit_score(
  text, integer, numeric, integer, text, boolean, text, jsonb, uuid
) from public, anon;
grant execute on function public.submit_score(
  text, integer, numeric, integer, text, boolean, text, jsonb, uuid
) to authenticated;

-- Trigger function: no direct client execution (trigger firing unaffected).
revoke all on function public.validate_gameplay_score() from public, anon, authenticated;
