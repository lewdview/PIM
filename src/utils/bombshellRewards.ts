// Bombshell month rewards — progress from owned bombshell cards and the server claim.
// Server side: supabase/migrations/20261102090000_bombshell_month_rewards.sql
// (get_bombshell_reward_status / claim_bombshell_reward). Keep the rules here in step
// with that file: the server re-checks everything before paying.
import type { OwnedCard } from '../services/vaultService';
import { supabase } from '../services/supabaseClient';
import { getBombshellDayCovers, getBombshellUnlockedCoversForDay } from './bombshellCards';

// 2026, not a leap year.
export const BOMBSHELL_MONTHS = [
  { month: 1, name: 'January', start: 1, end: 31 },
  { month: 2, name: 'February', start: 32, end: 59 },
  { month: 3, name: 'March', start: 60, end: 90 },
  { month: 4, name: 'April', start: 91, end: 120 },
  { month: 5, name: 'May', start: 121, end: 151 },
  { month: 6, name: 'June', start: 152, end: 181 },
  { month: 7, name: 'July', start: 182, end: 212 },
  { month: 8, name: 'August', start: 213, end: 243 },
  { month: 9, name: 'September', start: 244, end: 273 },
  { month: 10, name: 'October', start: 274, end: 304 },
  { month: 11, name: 'November', start: 305, end: 334 },
  { month: 12, name: 'December', start: 335, end: 365 },
];

// Calibrated against the economy: a bombshell single pull costs 100 V⚡,
// a standard token pack 275 V⚡, daily streaks pay 10–50 V⚡/day.
export const BOMBSHELL_REWARD_SPARKS = { complete: 1000, mastered: 2500, year: 10000 } as const;

export type BombshellRewardKey = `month-${number}-complete` | `month-${number}-mastered` | 'year';

export const monthRewardKey = (month: number, kind: 'complete' | 'mastered'): BombshellRewardKey =>
  `month-${month}-${kind}`;

export interface BombshellMonthProgress {
  month: number;
  name: string;
  days: number;
  /** Days with at least one owned bombshell variant. */
  owned: number;
  /** Days with every cut the day ships (full-frame + letterbox). */
  mastered: number;
  covers: number;
  unlockedCovers: number;
  complete: boolean;
  isMastered: boolean;
}

/** A day is mastered when the player owns each cut the day ships: full-frame and letterbox. */
function isDayMastered(day: number, unlocked: Set<string>): boolean {
  const covers = getBombshellDayCovers(day);
  let full = false;
  let lb = false;
  unlocked.forEach((f) => {
    if (/^\s*lb/i.test(f)) lb = true;
    else full = true;
  });
  const needFull = covers.normalFiles.length > 0;
  const needLb = covers.lbFiles.length > 0;
  return (!needFull || full) && (!needLb || lb) && (full || lb);
}

export function getBombshellMonthProgress(collection: OwnedCard[]): BombshellMonthProgress[] {
  return BOMBSHELL_MONTHS.map((m) => {
    let owned = 0;
    let mastered = 0;
    let covers = 0;
    let unlockedCovers = 0;
    for (let d = m.start; d <= m.end; d++) {
      const unlocked = getBombshellUnlockedCoversForDay(collection, d);
      covers += getBombshellDayCovers(d).totalCovers || 0;
      unlockedCovers += unlocked.size;
      if (unlocked.size > 0) owned += 1;
      if (isDayMastered(d, unlocked)) mastered += 1;
    }
    const days = m.end - m.start + 1;
    return {
      month: m.month, name: m.name, days, owned, mastered, covers, unlockedCovers,
      complete: owned >= days,
      isMastered: mastered >= days,
    };
  });
}

// ── Server ──────────────────────────────────────────────────────────────────────

export async function fetchBombshellClaims(): Promise<Set<string> | null> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return null;
  const { data, error } = await supabase.rpc('get_bombshell_reward_status');
  if (error) {
    console.warn('[Bombshells] reward status unavailable:', error.message);
    return null;
  }
  const claimed = (data as { claimed?: string[] } | null)?.claimed;
  return new Set(Array.isArray(claimed) ? claimed : []);
}

export type ClaimResult =
  | { ok: true; sparks: number; tokens?: number }
  | { ok: false; message: string };

export async function claimBombshellReward(key: BombshellRewardKey): Promise<ClaimResult> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) return { ok: false, message: 'Sign in to claim rewards.' };
  const { data, error } = await supabase.rpc('claim_bombshell_reward', { p_reward_key: key });
  if (error) {
    console.error('[Bombshells] claim failed:', error.message);
    return { ok: false, message: "Couldn't reach the vault. Try again in a moment." };
  }
  const r = (data ?? {}) as { success?: boolean; error?: string; sparks?: number; tokens?: number; done?: number; needed?: number };
  if (r.success) return { ok: true, sparks: Number(r.sparks) || 0, tokens: typeof r.tokens === 'number' ? r.tokens : undefined };
  if (r.error === 'ALREADY_CLAIMED') return { ok: false, message: 'Already claimed.' };
  if (r.error === 'NOT_COMPLETE') return { ok: false, message: `The vault counts ${r.done ?? 0}/${r.needed ?? '?'} days. Your collection may still be syncing.` };
  return { ok: false, message: "Couldn't claim this reward." };
}
