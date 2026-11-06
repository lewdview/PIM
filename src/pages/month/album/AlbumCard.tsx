// One chapter card: the entry's cover inside a rarity frame. Rarity is also
// written out with a glyph (● Common, ◆ Uncommon, ★ Rare), never color alone.

import type { CSSProperties } from 'react';
import type { GameSong } from '@/game/api';
import { hideBroken } from '@/pages/campaign/hideBroken';
import { RARITY_GLYPH, RARITY_NAME, type Rarity } from '@/platform/playgama/album';

export function entryLabel(songs: GameSong[], regularCount: number, songId: string): string {
  const i = songs.findIndex((s) => s.id === songId);
  if (i < 0) return '';
  return i >= regularCount ? `★${i - regularCount + 1}` : String(i + 1);
}

export default function AlbumCard({ song, num, rarity, missing, faceDown, isNew, tag, style, className }: {
  song?: GameSong;
  num: string;
  rarity: Rarity;
  /** A slot the player doesn't own yet: title and number only, art dimmed. */
  missing?: boolean;
  /** The card back, before a reveal flips it. */
  faceDown?: boolean;
  isNew?: boolean;
  /** Small banner under the card, e.g. "New" or "Duplicate · +3 shards". */
  tag?: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={`al-card${className ? ` ${className}` : ''}`}
      data-r={missing ? undefined : rarity}
      data-missing={missing || undefined}
      data-down={faceDown || undefined}
      style={style}
      aria-label={faceDown ? 'Card, face down' : `${song?.title ?? 'Card'}, entry ${num}, ${missing ? 'not owned' : RARITY_NAME[rarity]}`}
    >
      <span className="al-card-inner">
        <span className="al-card-back" aria-hidden="true"><span>PIM</span></span>
        <span className="al-card-face" aria-hidden="true">
          {song?.coverArt && <img src={song.coverArt} alt="" loading="lazy" decoding="async" onError={hideBroken} />}
          <span className="al-card-num">{num}</span>
          {isNew && !missing && <span className="al-card-new">New</span>}
          <span className="al-card-foot">
            <span className="al-card-title">{song?.title ?? '???'}</span>
            <span className="al-card-r">{missing ? 'Not owned' : `${RARITY_GLYPH[rarity]} ${RARITY_NAME[rarity]}`}</span>
          </span>
        </span>
      </span>
      {tag && <span className="al-card-tag">{tag}</span>}
    </span>
  );
}
