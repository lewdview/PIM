-- Normalize card-alias song IDs (2026-09-24).
--
-- Context: the client accepts /play/card-N URLs (getSongById extracts the day
-- digits) but submits scores under the raw alias, e.g. song_id = 'card-92'.
-- song_max_scores only carries canonical 'day-NNN' keys, so phase-2's
-- unknown-song rejection silently broke every score played via a card link:
-- request_run_token refused to mint, and submit_score refused to accept.
-- ~8,824 legitimate historical rows sit under card-* aliases.
--
-- Fix:
--   1. public.normalize_song_id(): 'card-92' / 'CARD-92' / 'day-92' -> 'day-092'.
--      Anything else (UUIDs, tutorial ids) passes through untouched.
--   2. request_run_token, submit_score, and the validate_gameplay_score
--      trigger all normalize before validation, so aliases work everywhere
--      and tokens bind to the canonical id on both mint and redeem.
--   3. Backfill historical card-* rows to day-NNN. Genuinely invalid rows
--      (non-positive score, unknown alias, over day-cap) are quarantined
--      first; the trigger is temporarily swapped for a backfill-permissive
--      version (normalization + caps only -- plausibility rules are new and
--      history predates them), then the strict validator is restored.
--
-- Apply via the Supabase SQL editor. Idempotent: re-running normalizes zero
-- additional rows.

-- ── 1. Canonicalizer ──────────────────────────────────────────────────
create or replace function public.normalize_song_id(p_song_id text)
returns text
language plpgsql
immutable
set search_path = public
as $function$
declare
  v text := btrim(coalesce(p_song_id, ''));
  m text[];
  n int;
begin
  m := regexp_match(v, '^(card|day)-([0-9]{1,3})$', 'i');
  if m is not null then
    n := m[2]::int;
    if n between 1 and 365 then
      return 'day-' || lpad(m[2], 3, '0');
    end if;
  end if;
  return v;
end
$function$;


-- ── 2. request_run_token: normalize before the known-song check ───────
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

  -- Card aliases (card-92) and unpadded day ids resolve to canonical day-NNN.
  p_song_id := public.normalize_song_id(p_song_id);

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


-- ── 3. submit_score: normalize before token binding + validation ──────
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

  -- Normalize FIRST: tokens are minted against the canonical id, so the
  -- binding check below compares canonical to canonical.
  p_song_id := public.normalize_song_id(p_song_id);

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

revoke all on function public.submit_score(
  text, integer, numeric, integer, text, boolean, text, jsonb, uuid
) from public, anon;
grant execute on function public.submit_score(
  text, integer, numeric, integer, text, boolean, text, jsonb, uuid
) to authenticated;


-- ── 4. Backfill-permissive trigger ────────────────────────────────────
-- Temporarily replaces the strict validator during the backfill below.
-- Historical rows predate the medal/accuracy-plausibility rules (phase 2),
-- so the backfill must not be judged by them; normalization, positive
-- scores, known songs, and per-song caps still hold. The strict validator
-- is restored in step 6.
create or replace function public.validate_gameplay_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cap integer;
begin
  NEW.song_id := public.normalize_song_id(NEW.song_id);

  if NEW.score is null or NEW.score <= 0 then
    raise exception 'gameplay_records: score must be positive (got %)', NEW.score;
  end if;

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

  return NEW;
end
$function$;
-- (Trigger bindings are unchanged: BEFORE INSERT OR UPDATE on gameplay_records.)


-- ── 5. Backfill: rewrite historical card-* rows to day-NNN ─────────────
-- Ensure the quarantine table exists even if 20260924133500 hasn't been
-- applied yet.
create table if not exists public.gameplay_records_quarantine (
  like public.gameplay_records including all
);
alter table public.gameplay_records_quarantine
  add column if not exists quarantined_at timestamptz not null default now();
alter table public.gameplay_records_quarantine enable row level security;

-- Quarantine rows must survive user deletion: drop the FK constraints that
-- LIKE ... INCLUDING ALL copied over (audit trail must not cascade).
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.gameplay_records_quarantine'::regclass
      and contype = 'f'
  loop
    execute format(
      'alter table public.gameplay_records_quarantine drop constraint %I',
      r.conname
    );
  end loop;
end
$$;

-- 5a. Pre-quarantine card-alias rows that are invalid even under the
-- permissive trigger: non-positive scores (abandoned runs), aliases with no
-- known day-cap, and scores over their day-cap. Genuinely bad data, not
-- history. (Medal/accuracy-plausibility violations are NOT quarantined: those
-- rules are new, and history predates them.)
create temp table bad_alias_rows as
select gr.id
from public.gameplay_records gr
left join public.song_max_scores sm
  on sm.song_id = public.normalize_song_id(gr.song_id)
where public.normalize_song_id(gr.song_id) != gr.song_id
  and (
    gr.score is null or gr.score <= 0
    or sm.song_id is null
    or gr.score > sm.max_score
  );

insert into public.gameplay_records_quarantine
select gr.*, now()
from public.gameplay_records gr
join bad_alias_rows b on b.id = gr.id
where not exists (
  select 1 from public.gameplay_records_quarantine q where q.id = gr.id
);

delete from public.gameplay_records gr
using bad_alias_rows b
where gr.id = b.id;

drop table bad_alias_rows;

-- 5b. Rewrite the remaining aliases. The permissive trigger (step 4)
-- normalizes and enforces caps; every remaining row passes it.
with moved as (
  update public.gameplay_records
  set song_id = public.normalize_song_id(song_id)
  where public.normalize_song_id(song_id) != song_id
  returning id
)
select count(*) as normalized_rows from moved;

-- Quarantine anything over-cap after normalization (same policy as the
-- fabricated-submission quarantine: preserved, out of live leaderboards).
insert into public.gameplay_records_quarantine
select gr.*, now()
from public.gameplay_records gr
join public.song_max_scores sm on sm.song_id = gr.song_id
where gr.score > sm.max_score
  and not exists (
    select 1 from public.gameplay_records_quarantine q where q.id = gr.id
  );

delete from public.gameplay_records gr
using public.song_max_scores sm
where sm.song_id = gr.song_id
  and gr.score > sm.max_score;


-- ── 6. Restore the strict trigger ───────────────────────────────────
-- Backfill done: reinstall the full validator (identical body to step 4
-- of 20260924121500_endgame_phase2, plus alias normalization).
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
  -- Canonicalize card aliases before any validation.
  NEW.song_id := public.normalize_song_id(NEW.song_id);

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
    raise exception 'Plausibility violation: PLATINUM requires >= 93%% accuracy';
  elsif v_medal = 'GOLD' and v_accuracy < 80 then
    raise exception 'Plausibility violation: GOLD requires >= 80%% accuracy';
  elsif v_medal = 'SILVER' and v_accuracy < 60 then
    raise exception 'Plausibility violation: SILVER requires >= 60%% accuracy';
  elsif v_medal = 'BRONZE' and v_accuracy < 40 then
    raise exception 'Plausibility violation: BRONZE requires >= 40%% accuracy';
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

-- ── 7. Final report ───────────────────────────────────────────────────
select
  (select count(*) from public.gameplay_records
     where public.normalize_song_id(song_id) != song_id) as remaining_alias_rows,
  (select count(*) from public.gameplay_records_quarantine) as quarantined_total,
  (select count(*) from public.gameplay_records gr
     join public.song_max_scores sm on sm.song_id = gr.song_id
    where gr.score > sm.max_score) as remaining_over_cap;
-- Expect: remaining_alias_rows = 0, remaining_over_cap = 0.
