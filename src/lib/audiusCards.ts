/**
 * Weekly Audius contest cards: status, claiming, and loading card details.
 *
 * Clearing a contest song (any medal) during its week earns that song's card;
 * clearing its Deluxe chart earns the Deluxe card. Cards are only earnable that
 * week, and players keep them for good. The server checks the player's own
 * recorded run (get_audius_contest_card_status / claim_audius_contest_card in
 * supabase/migrations/20261109170000_audius_contest_cards.sql).
 */
import { supabase } from '@/services/supabaseClient';
import {
  registerAudiusCards,
  unregisteredAudiusCardIds,
  type AudiusCardInfo,
} from '@/lib/audiusCardRegistry';

export type ContestCardKind = 'standard' | 'bombshell';

export interface ContestCardStatus {
  trackId: string;
  kind: ContestCardKind;
  cardId: string;
  cleared: boolean;
  claimed: boolean;
}

export type ClaimResult =
  | { ok: true; cardId: string }
  | { ok: false; error: string; message: string };

const MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: 'Sign in to collect weekly cards.',
  NO_CARD: 'This week’s cards aren’t out yet. Check back soon.',
  ALREADY_CLAIMED: 'Already in your collection.',
  NO_CLEAR: 'Clear this song this week to earn its card.',
  NO_DELUXE_CLEAR: 'Clear the Deluxe chart this week to earn the Deluxe card.',
};

export function claimErrorMessage(code: string): string {
  return MESSAGES[code] || code || 'Could not claim the card.';
}

/** Track id and card kind for a contest song id ('aud-X' or 'aud-X_deluxe'). */
export function contestCardForSong(songId: string | null | undefined): { trackId: string; kind: ContestCardKind } | null {
  const m = (songId || '').match(/^aud-([A-Za-z0-9]{1,32})(_deluxe)?$/);
  return m ? { trackId: m[1], kind: m[2] ? 'bombshell' : 'standard' } : null;
}

/** The caller's cleared/claimed state for each of the week's cards (empty for guests). */
export async function fetchContestCardStatus(week: string): Promise<ContestCardStatus[]> {
  const { data, error } = await supabase.rpc('get_audius_contest_card_status', { p_week: week });
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    trackId: r.track_id,
    kind: r.kind,
    cardId: r.card_id,
    cleared: !!r.cleared,
    claimed: !!r.claimed,
  }));
}

/** Claims the caller's earned card. ALREADY_CLAIMED counts as success. */
export async function claimContestCard(week: string, trackId: string, kind: ContestCardKind): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_audius_contest_card', {
    p_week: week,
    p_track_id: trackId,
    p_kind: kind,
  });
  if (error) return { ok: false, error: 'RPC', message: error.message };
  const res = data as { success?: boolean; error?: string; card_id?: string } | null;
  if (res?.success) return { ok: true, cardId: res.card_id || '' };
  const code = res?.error || 'UNKNOWN';
  if (code === 'ALREADY_CLAIMED') {
    return { ok: true, cardId: kind === 'bombshell' ? `bombshell-aud-${trackId}` : `aud-${trackId}` };
  }
  return { ok: false, error: code, message: claimErrorMessage(code) };
}

/**
 * Claims the card a just-finished run earned. The run's record may still be
 * saving, so a missing clear is retried a few times before giving up.
 */
export async function claimCardForRun(week: string, trackId: string, kind: ContestCardKind): Promise<ClaimResult> {
  let last: ClaimResult = { ok: false, error: 'UNKNOWN', message: claimErrorMessage('UNKNOWN') };
  for (const wait of [0, 2500, 5000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = await claimContestCard(week, trackId, kind);
    if (last.ok || (last.error !== 'NO_CLEAR' && last.error !== 'NO_DELUXE_CLEAR')) return last;
  }
  return last;
}

interface CardRow {
  week_start: string;
  track_id: string;
  kind: ContestCardKind;
  card_id: string;
  title: string;
  artist: string;
  permalink: string;
  artwork: string | null;
  genre: string | null;
}

/**
 * Loads title, artist and art for contest cards in a collection so the vault
 * can show them. Wren's art (audius_contest_art) wins over the Audius artwork.
 */
export async function loadAudiusCardDetails(cardIds: (string | null | undefined)[]): Promise<void> {
  const ids = unregisteredAudiusCardIds(cardIds);
  if (ids.length === 0) return;
  const { data } = await supabase
    .from('audius_contest_cards')
    .select('week_start, track_id, kind, card_id, title, artist, permalink, artwork, genre')
    .in('card_id', ids);
  const rows = (data as CardRow[] | null) ?? [];
  if (rows.length === 0) return;

  const artIds = rows.map((r) => (r.kind === 'bombshell' ? `aud-${r.track_id}_deluxe` : `aud-${r.track_id}`));
  const { data: artRows } = await supabase
    .from('audius_contest_art')
    .select('song_id, cover_url')
    .in('song_id', artIds);
  const art: Record<string, string> = {};
  for (const a of (artRows as { song_id: string; cover_url: string }[] | null) ?? []) art[a.song_id] = a.cover_url;

  const cards: AudiusCardInfo[] = rows.map((r) => {
    const deluxe = r.kind === 'bombshell';
    return {
      cardId: r.card_id,
      trackId: r.track_id,
      deluxe,
      title: r.title,
      artist: r.artist,
      coverUrl: art[deluxe ? `aud-${r.track_id}_deluxe` : `aud-${r.track_id}`] || r.artwork || '',
      permalink: r.permalink,
      genre: r.genre,
      weekStart: r.week_start,
    };
  });
  registerAudiusCards(cards);
}
