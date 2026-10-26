/**
 * HoloSheen — layered holographic foil overlay for cards.
 *
 * Drop it inside a card face (position: relative / absolute, overflow hidden)
 * and drive it with useHoloTilt. Layers, bottom to top:
 *   foil    — iridescent rainbow bands crossed with diagonal etching, colour-dodged
 *   sparkle — glitter that only catches where the light is, with slight parallax
 *   grain   — fine static noise so the foil reads as a printed surface
 *   glare   — a soft light spot that follows the pointer / phone tilt
 *   edge    — a bright rim catching the light on the side facing it
 *
 * The wrapper does not create a stacking context, so each layer blends with
 * the card art underneath and slots into the face's own z-order via
 * --holo-foil-z (under text drawers) and --holo-glare-z (over everything).
 */

import { forwardRef, type CSSProperties } from 'react';
import '../styles/holo.css';

export type HoloVariant = 'gloss' | 'holo' | 'prism' | 'cosmic';

interface HoloSheenProps {
  variant?: HoloVariant;
  /** Accent colour for the rim light and tinted glare. */
  tint?: string;
  foilZ?: number;
  glareZ?: number;
  className?: string;
}

const HoloSheen = forwardRef<HTMLDivElement, HoloSheenProps>(function HoloSheen(
  { variant = 'holo', tint, foilZ, glareZ, className = '' },
  ref,
) {
  const style = {
    ...(tint ? { '--holo-tint': tint } : null),
    ...(foilZ !== undefined ? { '--holo-foil-z': foilZ } : null),
    ...(glareZ !== undefined ? { '--holo-glare-z': glareZ } : null),
  } as CSSProperties;
  const hasFoil = variant !== 'gloss';
  const hasSparkle = variant === 'prism' || variant === 'cosmic';

  return (
    <div ref={ref} className={`holo-sheen holo-sheen--${variant} ${className}`} style={style} aria-hidden="true">
      {hasFoil && <div className="holo-layer holo-foil" />}
      {hasSparkle && <div className="holo-layer holo-sparkle" />}
      <div className="holo-layer holo-grain" />
      <div className="holo-layer holo-glare" />
      <div className="holo-layer holo-edge" />
    </div>
  );
});

export default HoloSheen;
