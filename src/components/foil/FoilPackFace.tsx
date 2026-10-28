import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { subscribeGyro, gyroAvailable } from '../../lib/holoGyro';
import '../../styles/foilPack.css';

export interface FoilPackFaceProps {
  accent: string;
  label: string;
  coverUrl?: string;
  /** Used when coverUrl fails to load. */
  fallbackCoverUrl?: string;
  price?: string;
  cardCount: number;
  tagline?: string;
  /** Small line printed above the art window. */
  brand?: string;
  /** Small line printed above the bottom seal. */
  footer?: ReactNode;
  /** Bombshell packs: the art is the whole wrapper instead of a window. */
  fullArt?: boolean;
  /** Inactive packs (off-centre in the carousel) stop animating. */
  active?: boolean;
  /** Pointer and gyro tilt with a light-tracking holo. */
  interactive?: boolean;
  hideStickers?: boolean;
  className?: string;
  style?: CSSProperties;
}

const MAX_TILT = 14;

/**
 * The holo foil booster pack. Fills its positioned parent; give the parent the
 * pack's size (the shop uses 280×420, the openers 220×300).
 */
export default function FoilPackFace({
  accent,
  label,
  coverUrl,
  fallbackCoverUrl,
  price,
  cardCount,
  tagline,
  brand = 'PIM : th3v4ult · 365 DAYS OF LIGHT & DARK',
  footer,
  fullArt = false,
  active = true,
  interactive = false,
  hideStickers = false,
  className,
  style,
}: FoilPackFaceProps) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const [tracking, setTracking] = useState(false);

  const apply = (nx: number, ny: number) => {
    // nx, ny in -1..1
    const tilt = tiltRef.current;
    const face = faceRef.current;
    if (!tilt || !face) return;
    tilt.style.transform = `perspective(800px) rotateX(${(-ny * MAX_TILT).toFixed(2)}deg) rotateY(${(nx * MAX_TILT).toFixed(2)}deg)`;
    face.style.setProperty('--fp-x', `${(50 + nx * 45).toFixed(1)}%`);
    face.style.setProperty('--fp-y', `${(50 + ny * 45).toFixed(1)}%`);
  };

  const reset = () => {
    setTracking(false);
    const tilt = tiltRef.current;
    const face = faceRef.current;
    if (tilt) tilt.style.transform = '';
    if (face) {
      face.style.removeProperty('--fp-x');
      face.style.removeProperty('--fp-y');
    }
  };

  // Phones: let the foil follow the device tilt while the pack is in focus.
  useEffect(() => {
    if (!interactive || !active || !gyroAvailable()) return;
    if (typeof window !== 'undefined' && !window.matchMedia?.('(pointer: coarse)').matches) return;
    let moved = false;
    const unsub = subscribeGyro((x, y) => {
      if (!moved && (Math.abs(x) > 0.05 || Math.abs(y) > 0.05)) {
        moved = true;
        setTracking(true);
      }
      if (moved) apply(x, y);
    });
    return () => {
      unsub();
      reset();
    };
  }, [interactive, active]);

  const onPointerMove = interactive && active
    ? (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'touch') return;
        const r = e.currentTarget.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        if (!tracking) setTracking(true);
        apply(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)));
      }
    : undefined;

  const titleClass = label.length > 18 ? 'fp-title is-xlong' : label.length > 12 ? 'fp-title is-long' : 'fp-title';
  const isFree = price === 'FREE';

  return (
    <div
      ref={tiltRef}
      className={`fp-tilt${tracking ? ' is-tracking' : ''}${active ? '' : ' is-dim'}${className ? ` ${className}` : ''}`}
      style={{ '--fp-accent': accent, ...style } as CSSProperties}
      onPointerMove={onPointerMove}
      onPointerLeave={interactive ? reset : undefined}
    >
      <div ref={faceRef} className={`foilpack${active && !tracking ? ' is-idle' : ''}`}>
        <div className="fp-metal" />
        {coverUrl && !fullArt && <img className="fp-metal-art" src={coverUrl} alt="" draggable={false} />}

        {fullArt && coverUrl ? (
          <>
            <img
              className="fp-fullart"
              src={coverUrl}
              alt=""
              draggable={false}
              onError={fallbackCoverUrl ? (e) => { (e.currentTarget as HTMLImageElement).src = fallbackCoverUrl; } : undefined}
            />
            <div className="fp-fullart-shade" />
          </>
        ) : (
          <div className="fp-window">
            {coverUrl && (
              <img
                src={coverUrl}
                alt=""
                draggable={false}
                onError={fallbackCoverUrl ? (e) => { (e.currentTarget as HTMLImageElement).src = fallbackCoverUrl; } : undefined}
              />
            )}
          </div>
        )}

        <div className="fp-holo" style={{ opacity: fullArt ? 0.38 : undefined }} />
        {active && <div className="fp-glitter" />}
        <div className="fp-pillow" />
        <div className="fp-crinkle" />
        {!fullArt && <div className="fp-window-glass" />}
        <div className="fp-glare" />
        {active && <div className="fp-sweep" />}

        <div className="fp-seal fp-seal--top" />
        <div className="fp-seal fp-seal--bottom" />
        <div className="fp-tear" />
        <div className="fp-notch fp-notch--l" />
        <div className="fp-notch fp-notch--r" />
        <div className="fp-tear-label">TEAR ▸</div>
        <div className="fp-brand">{brand}</div>

        {!fullArt && <div className="fp-seal365"><b>365</b></div>}

        <div className={titleClass}>{label}</div>
        {tagline && <div className="fp-tagline"><span>{tagline}</span></div>}
        {footer && <div className="fp-foot">{footer}</div>}

        {!hideStickers && price && (
          <div className="fp-sticker fp-sticker--price">
            <small>{isFree ? 'Daily' : 'Price'}</small>
            <strong>{price}</strong>
          </div>
        )}
        {!hideStickers && (
          <div className="fp-sticker fp-sticker--count">
            <small>{cardCount === 1 ? 'Card' : 'Cards'}</small>
            <strong>{cardCount}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
