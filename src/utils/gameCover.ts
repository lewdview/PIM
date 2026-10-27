/**
 * gameCover.ts — single source of truth for which cover a PIM run uses.
 *
 * The cover chosen here feeds the "Song Artwork" lane-color picker in
 * GameplayCore and is saved into the run result, so GameResults shows the
 * same art the player just played against. See docs/covers.md.
 *
 * Launchers that let the player pick a specific cover (song select variant
 * pill, collection / codex / card modal play buttons) call primeGameCover()
 * right before navigating to /play/:songId. Every other entry point (campaign,
 * tutorial, deep links, archive, global player, ...) primes nothing, and
 * GameplayCore falls back to the player's saved cover preference for that day.
 *
 * The handoff is keyed by day, never read through a global "last cover" key,
 * so one song's art can no longer leak into the next song's run.
 */
import { getBombshellCoverUrl, getCustomBombshellCover } from './bombshellCards';

const LAUNCH_COVER_KEY = 'pim_launch_cover';
/** Last cover the player launched with. Menu backdrops only, never gameplay. */
export const LAST_GAME_COVER_KEY = 'active_game_cover';

interface LaunchCover {
  day: number;
  url: string;
}

function readLaunchCover(): LaunchCover | null {
  try {
    const raw = sessionStorage.getItem(LAUNCH_COVER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LaunchCover;
    return typeof parsed?.day === 'number' && typeof parsed?.url === 'string' && parsed.url ? parsed : null;
  } catch {
    return null;
  }
}

/** Record the cover the player picked for `day`, just before launching PIM. */
export function primeGameCover(day: number | null | undefined, url: string | null | undefined): void {
  if (typeof day !== 'number' || !url) return;
  try {
    sessionStorage.setItem(LAUNCH_COVER_KEY, JSON.stringify({ day, url } satisfies LaunchCover));
    sessionStorage.setItem(LAST_GAME_COVER_KEY, url);
  } catch {}
}

/** Drop a primed cover for `day` (its saved preference changed). */
export function clearPrimedGameCover(day: number): void {
  if (readLaunchCover()?.day !== day) return;
  try {
    sessionStorage.removeItem(LAUNCH_COVER_KEY);
  } catch {}
}

/** The player's saved cover for a song: bombshell preference, else catalog art. */
export function resolvePreferredCover(song: { id?: string; day?: number; coverArt?: string | null }): string | null {
  const day = song.day;
  if (typeof day === 'number' && day > 0) {
    let fileName = getCustomBombshellCover(day);
    if (!fileName && song.id) {
      try {
        fileName = localStorage.getItem(`preferred_cover_${song.id}`);
      } catch {}
    }
    if (fileName) {
      return /^(https?:)?\//.test(fileName) ? fileName : getBombshellCoverUrl(day, fileName);
    }
  }
  return song.coverArt || null;
}

/**
 * The cover a run of `song` should use: the cover primed for this day by the
 * launcher, else the player's saved preference, else the catalog cover.
 */
export function resolveGameCover(song: { id?: string; day?: number; coverArt?: string | null }): string | null {
  const primed = readLaunchCover();
  if (primed && typeof song.day === 'number' && primed.day === song.day) return primed.url;
  return resolvePreferredCover(song);
}
