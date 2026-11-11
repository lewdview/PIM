/**
 * Audius weekly top-5 contest.
 *
 * Each week (Monday 00:00 UTC) the server locks the week's top 5 trending
 * Audius tracks by other artists (vault-engine getAudiusWeeklyContest). They
 * play in PIM as "aud-<audius track id>", streamed from Audius with a Chart
 * Master chart forged from the audio. A player's weekly score is the sum of
 * their best run on each song that week; the top 10 claim claw pulls once the
 * week is over. See supabase/migrations/20261109120000_audius_weekly_contest.sql.
 */
import { supabase } from '@/services/supabaseClient';
import type { GameSong } from '@/game/api';
import { streamUrl } from '@/lib/audius';

const API = 'https://api.audius.co/v1';
const SONG_PREFIX = 'aud-';
const DELUXE_SUFFIX = '_deluxe';

/** Claw pulls by final rank. Mirrors public.audius_contest_pulls(). */
export function contestPulls(rank: number): number {
  if (rank === 1) return 5;
  if (rank === 2) return 3;
  if (rank === 3) return 2;
  if (rank >= 4 && rank <= 10) return 1;
  return 0;
}

export interface ContestTrack {
  id: string;
  title: string;
  artist: string;
  handle: string;
  permalink: string;
  duration: number;
  artwork: string | null;
  genre: string | null;
}

export interface WeeklyContest {
  week_start: string;
  tracks: ContestTrack[];
}

export interface BoardRow {
  rank: number;
  userId: string;
  total: number;
  songsPlayed: number;
  name: string;
  avatarUrl: string | null;
}

export function isContestSongId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith(SONG_PREFIX));
}

export function contestSongId(trackId: string): string {
  return SONG_PREFIX + trackId;
}

export function trackUrl(t: Pick<ContestTrack, 'permalink'>): string {
  return `https://audius.co${t.permalink}`;
}

export function artistUrl(t: Pick<ContestTrack, 'handle'>): string {
  return `https://audius.co/${t.handle}`;
}

/** Monday (UTC) of the week holding `at`, as YYYY-MM-DD. Matches the server. */
export function weekStart(at = new Date()): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDays(week: string, days: number): string {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** When the week starting `week` ends (next Monday 00:00 UTC). */
export function weekEnd(week: string): Date {
  return new Date(`${addDays(week, 7)}T00:00:00Z`);
}

/** This week's contest, locking it on the server if nobody has opened it yet. */
export async function fetchCurrentContest(): Promise<WeeklyContest | null> {
  const week = weekStart();
  const { data } = await supabase
    .from('audius_weekly_contests')
    .select('week_start, tracks')
    .eq('week_start', week)
    .maybeSingle();
  if (data) return data as WeeklyContest;

  const { data: res, error } = await supabase.functions.invoke('vault-engine', {
    body: { action: 'getAudiusWeeklyContest', payload: {} },
  });
  if (error || !res?.success || !res.contest) {
    // A non-2xx reply hides the function's own message in error.context.
    let detail: string | undefined = res?.error;
    const ctx = (error as { context?: Response } | null)?.context;
    if (!detail && ctx && typeof ctx.json === 'function') {
      detail = await ctx.json().then((b: any) => b?.error, () => undefined);
    }
    throw new Error(detail || error?.message || 'Could not load this week’s contest');
  }
  return res.contest as WeeklyContest;
}

export async function fetchContest(week: string): Promise<WeeklyContest | null> {
  const { data } = await supabase
    .from('audius_weekly_contests')
    .select('week_start, tracks')
    .eq('week_start', week)
    .maybeSingle();
  return (data as WeeklyContest) ?? null;
}

/** The contest that holds a given song id, newest first. */
async function findContestTrack(trackId: string): Promise<ContestTrack | null> {
  const { data } = await supabase
    .from('audius_weekly_contests')
    .select('week_start, tracks')
    .order('week_start', { ascending: false })
    .limit(8);
  for (const c of (data as WeeklyContest[] | null) ?? []) {
    const t = c.tracks.find((x) => x.id === trackId);
    if (t) return t;
  }
  return null;
}

interface BakedChart {
  notes: GameSong['notes'];
  stages: NonNullable<GameSong['stages']>;
  chartVersion: string;
  duration: number;
}

/** The chart baked for a contest song id (standard or _deluxe), if there is one. */
async function fetchBakedChart(id: string): Promise<BakedChart | null> {
  const { data } = await supabase
    .from('audius_contest_charts')
    .select('chart')
    .eq('song_id', id)
    .maybeSingle();
  const chart = (data as { chart?: BakedChart } | null)?.chart;
  return chart && Array.isArray(chart.notes) && chart.notes.length > 0 ? chart : null;
}

/** Card art made for a contest song id (standard or _deluxe), if there is any. */
async function fetchSongArt(id: string): Promise<string | null> {
  const { data } = await supabase
    .from('audius_contest_art')
    .select('cover_url')
    .eq('song_id', id)
    .maybeSingle();
  return (data as { cover_url?: string } | null)?.cover_url || null;
}

/** Card art for a week's songs, keyed by song id ("aud-<id>" and "aud-<id>_deluxe"). */
export async function fetchContestArt(week: string): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('audius_contest_art')
    .select('song_id, cover_url')
    .eq('week_start', week);
  const out: Record<string, string> = {};
  for (const r of (data as { song_id: string; cover_url: string }[] | null) ?? []) out[r.song_id] = r.cover_url;
  return out;
}

/**
 * A playable song for a contest id ("aud-<id>" or "aud-<id>_deluxe").
 *
 * Every player gets the chart baked for the week (scripts/audius/
 * bake_contest_charts.ts), so everyone plays the same notes. When no chart is
 * baked yet, notes stay empty and gameplay forges one from the Audius stream.
 */
export async function getContestGameSong(id: string): Promise<GameSong | null> {
  if (!isContestSongId(id)) return null;
  const deluxe = id.endsWith(DELUXE_SUFFIX);
  const trackId = id.slice(SONG_PREFIX.length, deluxe ? -DELUXE_SUFFIX.length : undefined);
  if (!/^[A-Za-z0-9]{1,32}$/.test(trackId)) return null;
  const baked = fetchBakedChart(id).catch(() => null);
  const art = fetchSongArt(id).catch(() => null);

  let t = await findContestTrack(trackId).catch(() => null);
  if (!t) {
    // Not in a recent contest: read it from Audius so the link still plays.
    const res = await fetch(`${API}/tracks/${trackId}?app_name=PIM`);
    if (!res.ok) return null;
    const { data } = await res.json();
    if (!data) return null;
    t = {
      id: trackId,
      title: data.title,
      artist: data.user?.name || data.user?.handle || 'Audius artist',
      handle: data.user?.handle || '',
      permalink: data.permalink || '',
      duration: data.duration || 0,
      artwork: data.artwork?.['480x480'] ?? null,
      genre: data.genre ?? null,
    };
  }

  const [chart, cover] = await Promise.all([baked, art]);
  return {
    id,
    day: 0,
    date: '',
    title: deluxe ? `${t.title} (Deluxe)` : t.title,
    artist: t.artist,
    bpm: 120,
    duration: chart?.duration || t.duration,
    mood: 'dark',
    valence: 0.5,
    moodTags: t.genre ? [t.genre.toLowerCase()] : [],
    description: `th3scr1b3 × Audius · Weekly Top 5 · ${t.artist}`,
    audioUrl: streamUrl(trackId),
    coverArt: cover || t.artwork,
    notes: chart?.notes ?? [],
    ...(chart ? { stages: chart.stages, chartVersion: chart.chartVersion } : {}),
    key: '',
    genre: t.genre ? [t.genre] : [],
    // Deluxe: two levels up with elite timing, like the 365 Deluxe charts. With no
    // baked Deluxe chart, gameplay forges the standard chart then the Deluxe one.
    ...(deluxe ? { deluxe: true, timingProfile: 'elite' as const, difficultyLevel: 7 } : { difficultyLevel: 5 }),
  };
}

export async function fetchBoard(week: string, limit = 25): Promise<BoardRow[]> {
  const { data, error } = await supabase.rpc('get_audius_contest_board', { p_week: week, p_limit: limit });
  if (error) throw error;
  const rows = (data as any[]) ?? [];
  const ids = rows.map((r) => r.user_id);
  const names: Record<string, { name: string; avatarUrl: string | null }> = {};
  if (ids.length) {
    const { data: profs } = await supabase.rpc('get_public_profiles', { p_ids: ids });
    for (const p of (profs as any[]) ?? []) {
      const name = p.username
        ? `@${p.username}`
        : p.display_name || (p.wallet_address ? `${p.wallet_address.slice(0, 6)}…${p.wallet_address.slice(-4)}` : '');
      names[p.id] = { name, avatarUrl: p.avatar_url || null };
    }
  }
  return rows.map((r) => ({
    rank: r.rank,
    userId: r.user_id,
    total: Number(r.total_score) || 0,
    songsPlayed: r.songs_played,
    name: names[r.user_id]?.name || 'Player',
    avatarUrl: names[r.user_id]?.avatarUrl ?? null,
  }));
}

export async function fetchMyClaim(week: string): Promise<{ rank: number; pulls: number } | null> {
  const { data } = await supabase
    .from('audius_contest_prize_claims')
    .select('rank, pulls')
    .eq('week_start', week)
    .maybeSingle();
  return (data as { rank: number; pulls: number }) ?? null;
}

const CLAIM_ERRORS: Record<string, string> = {
  NOT_SIGNED_IN: 'Sign in to claim your prize.',
  NO_CONTEST: 'There was no contest that week.',
  WEEK_NOT_OVER: 'The week isn’t over yet.',
  NOT_A_WINNER: 'You didn’t finish in the top 10 that week.',
  ALREADY_CLAIMED: 'You already claimed this prize.',
};

export async function claimPrize(week: string): Promise<{ pulls: number; credits: number }> {
  const { data, error } = await supabase.rpc('claim_audius_contest_prize', { p_week: week });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(CLAIM_ERRORS[data?.error] || 'Could not claim the prize.');
  return { pulls: data.pulls, credits: data.credits };
}
