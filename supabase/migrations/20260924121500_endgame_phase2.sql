-- ═══════════════════════════════════════════════════════════════════
-- PIM leaderboard endgame, phase 2 (2026-09-24)
--
-- 1. song_max_scores: enable RLS, read-only for authenticated users.
--    (The client never queries this table directly; caps are enforced
--    server-side. SECURITY DEFINER functions bypass RLS for their reads.)
-- 2. gameplay_run_tokens: time-bound run tokens binding a score
--    submission to a run started by that user for that song within the
--    last 30 minutes. Kills blind replay of captured submit requests.
-- 3. request_run_token RPC: mints a token. Authenticated only, song must
--    exist in song_max_scores, issuance rate-limited (20/hour/user).
-- 4. validate_gameplay_score trigger: rewritten as SECURITY DEFINER so it
--    binds EVERY writer — including service_role (edge functions bypass
--    RLS but cannot bypass triggers). Enforces: positive score, known
--    song, per-song cap, accuracy bounds, combo bounds, medal set +
--    accuracy plausibility, reward-tier normalization, pack_rewarded
--    null-coercion, and the existing 10-writes/minute rate limit.
-- 5. submit_score: DROP + recreate (signature change). Unknown songs are
--    now REJECTED instead of falling back to a 10,000,000 cap. A valid
--    run token (p_run_token) is REQUIRED.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. song_max_scores: RLS on, read-only ─────────────────────────────
alter table public.song_max_scores enable row level security;
drop policy if exists "song_max_scores readable" on public.song_max_scores;
create policy "song_max_scores readable"
  on public.song_max_scores
  for select
  to authenticated
  using (true);
-- No insert/update/delete policies: direct writes are denied.


-- ── 2. Run-token table ────────────────────────────────────────────────
create table if not exists public.gameplay_run_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  song_id text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);
create index if not exists gameplay_run_tokens_user_song_idx
  on public.gameplay_run_tokens (user_id, song_id, expires_at);

alter table public.gameplay_run_tokens enable row level security;
-- No policies: only SECURITY DEFINER functions read/write this table.


-- ── 3. request_run_token RPC ──────────────────────────────────────────
create or replace function public.request_run_token(p_song_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_recent int;
  v_tok uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_song_id is null or char_length(p_song_id) = 0 or char_length(p_song_id) > 64 then
    raise exception 'Invalid song ID';
  end if;

  if not exists (select 1 from public.song_max_scores where song_id = p_song_id) then
    raise exception 'Unknown song: %', p_song_id;
  end if;

  select count(*) into v_recent
    from public.gameplay_run_tokens
    where user_id = v_user_id
      and issued_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Too many run tokens requested';
  end if;

  -- Opportunistic cleanup of long-expired tokens.
  delete from public.gameplay_run_tokens
    where expires_at < now() - interval '2 hours';

  insert into public.gameplay_run_tokens (user_id, song_id)
    values (v_user_id, p_song_id)
    returning id into v_tok;

  return v_tok;
end
$function$;

revoke all on function public.request_run_token(text) from public, anon;
grant execute on function public.request_run_token(text) to authenticated;


-- ── 4. Hardened trigger: binds every writer, including service_role ────
create or replace function public.validate_gameplay_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cap integer;
  v_recent int;
  v_medal text;
  v_accuracy numeric;
  v_tier text;
begin
  -- Positive score (existing rule).
  if NEW.score is null or NEW.score <= 0 then
    raise exception 'gameplay_records: score must be positive (got %)', NEW.score;
  end if;

  -- Known song + per-song cap. The old trigger only enforced a global
  -- 72.3M ceiling; service_role writes bypass RLS but not this trigger,
  -- so caps now hold for every insert path.
  select max_score into v_cap
    from public.song_max_scores
    where song_id = NEW.song_id;
  if v_cap is null then
    raise exception 'gameplay_records: unknown song_id %', NEW.song_id;
  end if;
  if NEW.score > v_cap then
    raise exception 'gameplay_records: score % exceeds cap % for song %',
      NEW.score, v_cap, NEW.song_id;
  end if;

  -- Accuracy bounds (mirrors submit_score).
  v_accuracy := round(NEW.accuracy::numeric, 2);
  if v_accuracy is null or v_accuracy < 0 or v_accuracy > 100 then
    raise exception 'gameplay_records: accuracy out of valid bounds (0.00 - 100.00)';
  end if;
  NEW.accuracy := v_accuracy;

  -- Max-combo bounds (mirrors submit_score).
  if NEW.max_combo is null or NEW.max_combo < 0 or NEW.max_combo > 100000 then
    raise exception 'gameplay_records: invalid max combo';
  end if;

  -- Medal set + accuracy plausibility (mirrors submit_score).
  v_medal := upper(trim(coalesce(NEW.medal, 'NONE')));
  if v_medal not in ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM') then
    raise exception 'gameplay_records: invalid medal value';
  end if;
  if v_medal = 'PLATINUM' and v_accuracy < 93 then
    raise exception 'gameplay_records: plausibility violation: PLATINUM requires >= 93%% accuracy';
  elsif v_medal = 'GOLD' and v_accuracy < 80 then
    raise exception 'gameplay_records: plausibility violation: GOLD requires >= 80%% accuracy';
  elsif v_medal = 'SILVER' and v_accuracy < 60 then
    raise exception 'gameplay_records: plausibility violation: SILVER requires >= 60%% accuracy';
  elsif v_medal = 'BRONZE' and v_accuracy < 40 then
    raise exception 'gameplay_records: plausibility violation: BRONZE requires >= 40%% accuracy';
  end if;
  NEW.medal := v_medal;

  -- Reward-tier normalization (mirrors submit_score).
  v_tier := lower(trim(coalesce(NEW.reward_tier, 'none')));
  if v_tier not in ('none', 'common', 'enhanced', 'rare', 'epic', 'legendary', 'mythic') then
    v_tier := 'none';
  end if;
  NEW.reward_tier := v_tier;

  -- pack_rewarded null-coercion (mirrors submit_score).
  NEW.pack_rewarded := coalesce(NEW.pack_rewarded, false);

  -- Rate limit: 10 writes per user per minute (existing rule, unchanged).
  select count(*) into v_recent
    from public.gameplay_records
    where user_id = NEW.user_id
      and "timestamp" > now() - interval '1 minute';
  if v_recent >= 10 then
    raise exception 'gameplay_records: rate limit exceeded';
  end if;

  return NEW;
end
$function$;
-- (Trigger bindings are unchanged: BEFORE INSERT OR UPDATE on gameplay_records.)


-- ── 5. submit_score: unknown songs rejected, run token required ─────────
-- Signature change (new p_run_token param) requires DROP + CREATE:
-- CREATE OR REPLACE cannot alter a function's parameter list.
drop function if exists public.submit_score(
  text, integer, numeric, integer, text, boolean, text, jsonb
);

create function public.submit_score(
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
  v_tok_user uuid;
  v_tok_song text;
  v_tok_exp timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_song_id is null or char_length(p_song_id) = 0 or char_length(p_song_id) > 64 then
    raise exception 'Invalid song ID';
  end if;

  -- Run token: binds this submission to a run started by this user for
  -- this song within the last 30 minutes. Defeats blind replay of
  -- captured submit requests.
  if p_run_token is null then
    raise exception 'Run token required';
  end if;
  select user_id, song_id, expires_at
    into v_tok_user, v_tok_song, v_tok_exp
    from public.gameplay_run_tokens
    where id = p_run_token;
  if v_tok_user is null then
    raise exception 'Invalid run token';
  end if;
  if v_tok_user != v_user_id then
    raise exception 'Run token belongs to a different user';
  end if;
  if v_tok_song != p_song_id then
    raise exception 'Run token is for a different song';
  end if;
  if v_tok_exp < now() then
    raise exception 'Run token expired';
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

-- DROP removed the original grants; re-apply authenticated-only execution.
revoke all on function public.submit_score(
  text, integer, numeric, integer, text, boolean, text, jsonb, uuid
) from public, anon;
grant execute on function public.submit_score(
  text, integer, numeric, integer, text, boolean, text, jsonb, uuid
) to authenticated;
