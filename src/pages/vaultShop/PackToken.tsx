import type { PitPack } from './clawPits';

/** A foil pack, used by the vending coils, the claw and the tray. */
export function PackToken({ pack, locked, hidePrice }: { pack: PitPack; locked?: boolean; hidePrice?: boolean }) {
  return (
    <span
      className="claw-pack"
      style={{
        ['--pack-accent' as string]: pack.accent,
        backgroundImage: pack.coverImage
          ? `linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.85)), url("${pack.coverImage}")`
          : undefined,
      }}
    >
      {!pack.coverImage && <span className="claw-pack-icon">{pack.icon}</span>}
      <span className="claw-pack-count">{pack.cardCount}<small>{pack.cardCount === 1 ? 'card' : 'cards'}</small></span>
      {!hidePrice && <span className="claw-pack-price">{locked ? 'TAKEN' : pack.price}</span>}
    </span>
  );
}
