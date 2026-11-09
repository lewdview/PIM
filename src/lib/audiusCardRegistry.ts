/**
 * Weekly Audius contest cards in the vault.
 *
 * Clearing a contest song in its week earns that song's card (see
 * supabase/migrations/20261109170000_audius_contest_cards.sql):
 *   'aud-<track id>'            standard card, from a clear of the standard chart
 *   'bombshell-aud-<track id>'  Deluxe card, from a clear of the Deluxe chart
 *
 * These cards are not 365 days, so the day-based card pool can't draw them.
 * Their title, artist and art come from audius_contest_cards (plus Wren's art
 * in audius_contest_art) and are registered here before the collection is
 * mapped; findCardWithFallback reads them synchronously.
 *
 * This module has no imports so vaultService can use it without a cycle.
 */

export interface AudiusCardInfo {
  cardId: string;
  trackId: string;
  deluxe: boolean;
  title: string;
  artist: string;
  coverUrl: string;
  permalink: string;
  genre: string | null;
  weekStart: string;
}

const registry = new Map<string, AudiusCardInfo>();

const CARD_RE = /^(bombshell-)?aud-([A-Za-z0-9]{1,32})$/;

/** Parses a contest card id, or null when it isn't one. */
export function parseAudiusCardId(cardId: string | null | undefined): { trackId: string; deluxe: boolean } | null {
  const m = (cardId || '').match(CARD_RE);
  return m ? { trackId: m[2], deluxe: !!m[1] } : null;
}

export function isAudiusCardId(cardId: string | null | undefined): boolean {
  return parseAudiusCardId(cardId) !== null;
}

/** Card id of a contest song's card: standard for 'aud-X', Deluxe for 'aud-X_deluxe'. */
export function audiusCardIdForSong(trackId: string, deluxe: boolean): string {
  return deluxe ? `bombshell-aud-${trackId}` : `aud-${trackId}`;
}

export function registerAudiusCards(cards: AudiusCardInfo[]) {
  for (const c of cards) registry.set(c.cardId, c);
}

export function getAudiusCard(cardId: string): AudiusCardInfo | undefined {
  return registry.get(cardId);
}

/** Card ids in the list that are contest cards not registered yet. */
export function unregisteredAudiusCardIds(cardIds: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const id of cardIds) if (id && isAudiusCardId(id) && !registry.has(id)) out.add(id);
  return [...out];
}

/** True for an owned card (or its row) that is a weekly Audius card. */
export function isAudiusCard(c: { cardId?: string; card_id?: string; card?: { id?: string } } | null | undefined): boolean {
  return !!c && (isAudiusCardId(c.cardId) || isAudiusCardId(c.card_id) || isAudiusCardId(c.card?.id));
}
