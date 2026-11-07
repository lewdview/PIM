import { useEffect, useRef } from 'react';
import type { Rarity } from '../../utils/rarity';
import { RARITY_STYLE } from './showcaseData';

/** Every demo scene takes these. `active` is false while off screen, so the scene idles. */
export interface SceneProps {
  active: boolean;
}

const CANCELLED = Symbol('scene-cancelled');

/**
 * Runs `script` over and over while `active`. The script awaits `wait(ms)` between beats;
 * going inactive or unmounting cancels it at the next wait, and `reset` runs before each pass.
 */
export function useSceneScript(
  active: boolean,
  script: (wait: (ms: number) => Promise<void>) => Promise<void>,
  reset?: () => void,
) {
  const scriptRef = useRef(script);
  scriptRef.current = script;
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const wait = (ms: number) => new Promise<void>((resolve, reject) => {
      const id = setTimeout(() => { timers.delete(id); if (alive) resolve(); else reject(CANCELLED); }, ms);
      timers.add(id);
    });
    (async () => {
      try {
        while (alive) {
          resetRef.current?.();
          await scriptRef.current(wait);
        }
      } catch (err) {
        if (err !== CANCELLED) console.warn('[showcase] scene stopped:', err);
      }
    })();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [active]);
}

export function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** A collectible card face (or its back), drawn the same way in every demo. */
export function DemoCard({
  day, title, cover, rarity, flipped = false, className = '', stamp,
}: {
  day: number; title: string; cover: string; rarity: Rarity;
  flipped?: boolean; className?: string; stamp?: React.ReactNode;
}) {
  const r = RARITY_STYLE[rarity];
  return (
    <div
      className={`sc-card ${flipped ? 'is-flipped' : ''} ${className}`}
      data-rarity={rarity}
      style={{ ['--r' as string]: r.color, ['--rg' as string]: r.glow }}
    >
      <div className="sc-card-inner">
        <div className="sc-card-face">
          <div className="sc-card-art"><img src={cover} alt="" loading="lazy" decoding="async" /></div>
          <div className="sc-card-foil" aria-hidden />
          <div className="sc-card-meta">
            <span>DAY {String(day).padStart(3, '0')}</span>
            <span className="sc-card-rarity">{r.label}</span>
          </div>
          <div className="sc-card-title">{title}</div>
          {stamp}
        </div>
        <div className="sc-card-back" aria-hidden>
          <span>PIM</span>
          <small>th3v4ult</small>
        </div>
      </div>
    </div>
  );
}
