import type { PitPack } from './clawPits';

const isBombshellPack = (p: PitPack) => p.category === 'bombshell' || p.category === 'bombshell_token';

/** Hex emblem from the pack shop's cartridge, flattened so it scales to any pack size. */
function HexCore({ accent, glyph }: { accent: string; glyph: string }) {
  return (
    <svg viewBox="0 0 100 100" className="pk-core" aria-hidden>
      <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="rgba(0,0,0,0.55)" stroke={accent} strokeWidth="3" strokeDasharray="9 5" />
      <polygon points="50,17 79,33 79,67 50,83 21,67 21,33" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <text
        x="50" y="62" textAnchor="middle"
        fontFamily='Impact, "Arial Black", sans-serif' fontSize={glyph.length > 1 ? 34 : 46} fill="#fff"
        stroke="#000" strokeWidth="2" paintOrder="stroke"
        style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
      >
        {glyph}
      </text>
    </svg>
  );
}

/**
 * A pack as a mini version of the pack shop's cyber cartridge: gold bus pins, neon rails,
 * real cover art, the pack name and its card count. Used by the vending coils and the claw.
 */
export function PackToken({ pack, locked, hidePrice }: { pack: PitPack; locked?: boolean; hidePrice?: boolean }) {
  const bomb = isBombshellPack(pack);
  return (
    <span className={`claw-pack pk${bomb ? ' pk-bomb' : ''}`} style={{ ['--pack-accent' as string]: pack.accent }}>
      {pack.coverImage && (
        <img
          className="pk-art" src={pack.coverImage} alt="" loading="lazy" draggable={false}
          onError={e => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <span className="pk-shade" aria-hidden />
      {bomb && <span className="pk-holo" aria-hidden />}
      <span className="pk-pins pk-pins-top" aria-hidden />
      <span className="pk-pins pk-pins-bot" aria-hidden />
      <span className="pk-rail pk-rail-l" aria-hidden />
      <span className="pk-rail pk-rail-r" aria-hidden />
      <span className="pk-body">
        <span className="pk-name">{pack.label}</span>
        {!bomb && <HexCore accent={pack.accent} glyph="365" />}
      </span>
      <span className="pk-cap">{pack.cardCount}×</span>
      {!hidePrice && <span className="claw-pack-price">{locked ? 'TAKEN' : pack.price}</span>}
    </span>
  );
}

/** Mystery accents for covered claw packs. Purely decorative: they say nothing about the prize. */
// eslint-disable-next-line react-refresh/only-export-components
export const MYSTERY_ACCENTS = ['#ff1493', '#22d3ee', '#a855f7', '#facc15', '#34d399', '#fb7185', '#60a5fa', '#f97316'];

/** A covered cartridge: same shell as a real pack, but the contents are hidden. */
export function MysteryPack({ accent }: { accent: string }) {
  return (
    <span className="claw-pack pk pk-mystery" style={{ ['--pack-accent' as string]: accent }}>
      <span className="pk-holo" aria-hidden />
      <span className="pk-pins pk-pins-top" aria-hidden />
      <span className="pk-pins pk-pins-bot" aria-hidden />
      <span className="pk-rail pk-rail-l" aria-hidden />
      <span className="pk-rail pk-rail-r" aria-hidden />
      <span className="pk-body">
        <span className="pk-name">MYSTERY</span>
        <HexCore accent={accent} glyph="?" />
      </span>
      <span className="pk-cap">??</span>
    </span>
  );
}
