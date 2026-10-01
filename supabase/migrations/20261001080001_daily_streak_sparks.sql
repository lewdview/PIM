-- Daily spark streak (2026-10-01). Replaces the Earn page's fake client-side
-- token grants (simulated ads / surveys / minigame calling addTokens) with a
-- server-authoritative daily check-in.
--
-- Reward math (per Bryan 2026-10-01):
--   day 1 = 10 sparks, +2 sparks per consecutive day, capped at 50/day
--   milestone bonus: +100 sparks at exactly 7 days, +300 at exactly 30 days
--   missing a day resets the streak to day 1
--
-- Security model (same pattern as public.submit_score):
--   * The client NEVER writes streak/tokens columns directly. It calls
--     public.claim_daily_streak(), which is SECURITY DEFINER and does all
--     math and writes server-side.
--   * Day boundaries are UTC, computed from the server clock
--     ((extract(epoch from now()) / 86400)::integer) — client clocks are
--     never trusted.
--   * Double-claims are impossible: the caller's profile row is locked with
--     SELECT ... FOR UPDATE, so concurrent claims serialize and the second
--     one sees last_spark_streak_day = today → ALREADY_CLAIMED.
--   * Anonymous (guest) sessions have auth.uid() + a profiles row (created by
--     the on_auth_user_created trigger), so guests streak exactly like
--     signed-in users. Fully signed-out callers get 'Not authenticated' and
--     the Earn page shows the identity wall instead.
--   * EXECUTE is granted to `authenticated` only (anon users via Supabase
--     anonymous sign-in hold the authenticated role).
--
-- Apply via the Supabase SQL editor. Idempotent.

alter table public.profiles
  add column if not exists spark_streak_count integer not null default 0,
  add column if not exists last_spark_streak_day integer not null default 0;

create or replace function public.claim_daily_streak(p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_today integer;
  v_streak integer;
  v_last_day integer;
  v_new_streak integer;
  v_base integer;
  v_milestone integer;
  v_reward integer;
  v_tokens integer;
  v_can_claim boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- UTC day number (days since unix epoch). Never trust client clocks.
  v_today := (extract(epoch from now()) / 86400)::integer;

  -- Profiles rows are created by the on_auth_user_created trigger, but stay
  -- defensive for accounts that predate it.
  insert into public.profiles (id) values (v_user_id)
  on conflict (id) do nothing;

  select p.spark_streak_count, p.last_spark_streak_day
    into v_streak, v_last_day
    from public.profiles p
   where p.id = v_user_id
   for update;

  v_can_claim := (v_last_day < v_today);

  if v_last_day >= v_today then
    -- Already claimed today: streak and reward describe the banked state.
    v_new_streak := v_streak;
  elsif v_last_day = v_today - 1 then
    -- Consecutive UTC day: streak continues.
    v_new_streak := v_streak + 1;
  else
    -- Missed a day (or first ever claim): reset to day 1.
    v_new_streak := 1;
  end if;

  -- Reward math: 10 on day 1, +2 per day, capped at 50. Milestones stack.
  v_base := least(10 + 2 * (v_new_streak - 1), 50);
  v_milestone := 0;
  if v_new_streak = 7 then
    v_milestone := 100;
  elsif v_new_streak = 30 then
    v_milestone := 300;
  end if;
  v_reward := v_base + v_milestone;

  if p_dry_run then
    return jsonb_build_object(
      'success', true,
      'dry_run', true,
      'can_claim', v_can_claim,
      'streak', v_new_streak,
      'base_reward', v_base,
      'milestone_bonus', v_milestone,
      'reward', v_reward,
      'today', v_today
    );
  end if;

  if not v_can_claim then
    return jsonb_build_object(
      'success', false,
      'error', 'ALREADY_CLAIMED',
      'streak', v_streak,
      'today', v_today
    );
  end if;

  update public.profiles p
     set spark_streak_count = v_new_streak,
         last_spark_streak_day = v_today,
         tokens = p.tokens + v_reward,
         tokens_earned_total = coalesce(p.tokens_earned_total, 0) + v_reward
   where p.id = v_user_id
  returning p.tokens into v_tokens;

  return jsonb_build_object(
    'success', true,
    'streak', v_new_streak,
    'base_reward', v_base,
    'milestone_bonus', v_milestone,
    'reward', v_reward,
    'tokens', v_tokens,
    'today', v_today
  );
end
$function$;

revoke all on function public.claim_daily_streak(boolean) from public, anon;
grant execute on function public.claim_daily_streak(boolean) to authenticated;
