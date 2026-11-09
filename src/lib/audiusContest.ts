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
    throw new Error(res?.error || error?.message || 'Could not load this week’s contest');
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

/**
 * A playable song for a contest id. It has no baked notes, so gameplay forges
 * a Chart Master chart from the Audius stream on load.
 */
export async function getContestGameSong(id: string): Promise<GameSong | null> {
  if (!isContestSongId(id)) return null;
  const trackId = id.slice(SONG_PREFIX.length);
  if (!/^[A-Za-z0-9]{1,32}$/.test(trackId)) return null;

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

  return {
    id,
    day: 0,
    date: '',
    title: t.title,
    artist: t.artist,
    bpm: 120,
    duration: t.duration,
    mood: 'dark',
    valence: 0.5,
    moodTags: t.genre ? [t.genre.toLowerCase()] : [],
    description: `Audius weekly top 5 · ${t.artist}`,
    audioUrl: streamUrl(trackId),
    coverArt: t.artwork,
    notes: [],
    key: '',
    genre: t.genre ? [t.genre] : [],
    difficultyLevel: 5,
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
