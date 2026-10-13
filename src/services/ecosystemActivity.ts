import { supabase } from './supabaseClient';

/**
 * Ecosystem-wide activity logging (play_events), shared with every th3scr1b3.art site.
 *
 * The visitor id comes from /ecosystem-bar.js (th3_sid cookie on .th3scr1b3.art), so a play
 * here and a listen on th3scr1b3.art belong to the same visitor; signing in on any layer links
 * them to the account via link_anonymous_plays.
 */

declare global {
  interface Window {
    th3Ecosystem?: { sessionId?: string };
  }
}

const SITE = 'pim.th3scr1b3.art';
const startedAt = new Map<string, number>();
let linkedForUser: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function sessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.th3Ecosystem?.sessionId || readCookie('th3_sid');
}

/** Same opt-outs as the ecosystem bar: GPC, Do Not Track, or a site-wide decline. */
function trackingDeclined(): boolean {
  if (typeof navigator !== 'undefined') {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.globalPrivacyControl === true || nav.doNotTrack === '1') return true;
  }
  return readCookie('th3_consent') === 'declined';
}

function dayFromSongId(songId: string): number | null {
  const m = String(songId).match(/(\d{1,3})$/);
  const day = m ? Number(m[1]) : NaN;
  return day >= 1 && day <= 366 ? day : null;
}

function recordPlay(songId: string, event: 'start' | 'complete' | 'skip', listenedSeconds?: number) {
  if (!songId || trackingDeclined()) return;
  void supabase
    .rpc('record_play_event', {
      p_release_id: songId,
      p_day: dayFromSongId(songId),
      p_source: 'pim_game',
      p_platform: 'pim',
      p_session_id: sessionId(),
      p_site: SITE,
      p_event: event,
      p_listened_seconds: listenedSeconds ?? null,
      p_referrer: typeof document === 'undefined' ? null : document.referrer || null,
      p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent || null,
    })
    .then(({ error }) => {
      if (error) console.warn('[Activity] play event not recorded:', error.message);
    });
}

/** Mirrors PIM's own game telemetry into the ecosystem play log. */
export function mirrorGameEvent(eventType: string, payload: Record<string, unknown> = {}) {
  const songId = typeof payload.songId === 'string' ? payload.songId : '';
  if (!songId) return;
  if (eventType === 'game_start') {
    startedAt.set(songId, Date.now());
    recordPlay(songId, 'start');
  } else if (eventType === 'game_end') {
    const started = startedAt.get(songId);
    startedAt.delete(songId);
    const seconds = started ? Math.round((Date.now() - started) / 1000) : undefined;
    recordPlay(songId, payload.completed === false ? 'skip' : 'complete', seconds);
  }
}

/** After sign-in: attach this browser's anonymous plays and visits (every layer) to the account. */
export function linkAnonymousActivity(userId: string) {
  const sid = sessionId();
  if (!sid || linkedForUser === userId) return;
  linkedForUser = userId;
  void supabase
    .rpc('link_anonymous_plays', { p_session_id: sid, p_user_id: userId })
    .then(({ error }) => {
      if (error) {
        linkedForUser = null;
        console.warn('[Activity] link failed:', error.message);
      }
    });
}
