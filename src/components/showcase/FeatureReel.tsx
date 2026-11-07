import { Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FEATURES } from './features';
import { prefersReducedMotion } from './sceneKit';
import '../../styles/showcase.css';

const DURATION: Record<string, number> = { play: 15000 };
const DEFAULT_MS = 9000;

/**
 * The splash screen's attract mode: a cabinet-style reel of live gameplay demos, one per
 * feature, with the copy that explains it. Tabs jump; anything else falls through to the
 * splash's own "press start" handler.
 */
export default function FeatureReel({ startLabel = 'PRESS START' }: { startLabel?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const f = FEATURES[index];
  const ms = DURATION[f.id] ?? DEFAULT_MS;
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setIndex(i => (i + 1) % FEATURES.length), ms);
    return () => clearTimeout(id);
  }, [index, ms, paused]);

  const go = (i: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i + FEATURES.length) % FEATURES.length);
  };

  return (
    <div className="sc-reel" style={{ ['--accent' as string]: f.accent }}>
      <div className="sc-reel-copy">
        <nav className="sc-reel-rail" aria-label="Features">
          {FEATURES.map((ft, i) => (
            <button
              key={ft.id}
              type="button"
              onClick={go(i)}
              className={i === index ? 'on' : ''}
              style={{ ['--a' as string]: ft.accent }}
              aria-current={i === index}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              {ft.tab}
              {i === index && !paused && (
                <motion.i key={`${index}`} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: ms / 1000, ease: 'linear' }} />
              )}
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={f.id}
            className="sc-reel-text"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -18 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="sc-kicker"><b>{String(index + 1).padStart(2, '0')}</b> / {String(FEATURES.length).padStart(2, '0')} · {f.name}</p>
            <h2 className="sc-reel-h">{f.headline}</h2>
            <p className="sc-reel-body">{f.body}</p>
            <ul className="sc-points">
              {f.points.map(p => <li key={p}>{p}</li>)}
            </ul>
          </motion.div>
        </AnimatePresence>

        <div className="sc-reel-foot">
          <span className="sc-reel-start">{startLabel}</span>
          <span className="sc-reel-ctrls">
            <button type="button" onClick={go(index - 1)} aria-label="Previous feature">◀</button>
            <button type="button" onClick={e => { e.stopPropagation(); setPaused(p => !p); }} aria-label={paused ? 'Resume the reel' : 'Pause the reel'}>
              {paused ? '▶' : 'II'}
            </button>
            <button type="button" onClick={go(index + 1)} aria-label="Next feature">▶</button>
          </span>
        </div>
      </div>

      <div className="sc-screen" onClick={e => e.stopPropagation()} role="presentation">
        <div className="sc-screen-bezel">
          <span className="sc-screen-live"><i /> LIVE DEMO</span>
          <span className="sc-screen-id">{f.tab}</span>
        </div>
        <div className="sc-screen-glass">
          <AnimatePresence mode="wait">
            <motion.div
              key={f.id}
              className="sc-screen-scene"
              initial={reduced ? { opacity: 0 } : { opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
              animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, clipPath: 'inset(100% 0 0 0)' }}
              transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
            >
              <Suspense fallback={<div className="sc-scene-loading" />}>
                <f.Scene active />
              </Suspense>
            </motion.div>
          </AnimatePresence>
          <div className="sc-screen-scan" aria-hidden />
        </div>
      </div>
    </div>
  );
}
