import { Suspense, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FEATURES, type Feature } from './features';
import '../../styles/showcase.css';

/**
 * Scroll tour of every feature. On wide screens the demo screen stays pinned while the
 * chapters scroll past it; on phones each chapter carries its own demo. Only the demo in
 * view runs.
 */
export default function FeatureTour({ highlight, onChapterView }: { highlight?: string; onChapterView?: (id: string) => void }) {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLElement | null>>([]);
  const seen = useRef(new Set<string>());
  const wide = useWide();

  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const i = Number((e.target as HTMLElement).dataset.i);
        setActive(i);
        const id = FEATURES[i].id;
        if (!seen.current.has(id)) { seen.current.add(id); onChapterView?.(id); }
      }
    }, { rootMargin: '-45% 0px -45% 0px' });
    refs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, [onChapterView]);

  const f = FEATURES[active];

  return (
    <div className="sc-tour" style={{ ['--accent' as string]: f.accent }}>
      <div className="sc-tour-chapters">
        {FEATURES.map((ft, i) => (
          <section
            key={ft.id}
            ref={el => { refs.current[i] = el; }}
            data-i={i}
            className={`sc-chapter ${i === active ? 'on' : ''}`}
            style={{ ['--a' as string]: ft.accent }}
            aria-labelledby={`sc-ch-${ft.id}`}
          >
            <p className="sc-kicker"><b>{String(i + 1).padStart(2, '0')}</b> · {ft.name}{ft.id === highlight && <em className="sc-here">You’re here</em>}</p>
            <h3 id={`sc-ch-${ft.id}`} className="sc-chapter-h">{ft.headline}</h3>
            <p className="sc-chapter-body">{ft.body}</p>
            <ul className="sc-points">{ft.points.map(p => <li key={p}>{p}</li>)}</ul>
            {!wide && <InlineScreen feature={ft} active={i === active} />}
          </section>
        ))}
      </div>
      {wide && (
        <div className="sc-tour-pin">
          <div className="sc-screen">
            <div className="sc-screen-bezel">
              <span className="sc-screen-live"><i /> LIVE DEMO</span>
              <span className="sc-screen-id">{String(active + 1).padStart(2, '0')} · {f.tab}</span>
            </div>
            <div className="sc-screen-glass">
              <AnimatePresence mode="wait">
                <motion.div
                  key={f.id}
                  className="sc-screen-scene"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.35 }}
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
      )}
    </div>
  );
}

function InlineScreen({ feature, active }: { feature: Feature; active: boolean }) {
  const S = feature.Scene;
  return (
    <div className="sc-screen sc-screen-inline">
      <div className="sc-screen-glass">
        <div className="sc-screen-scene">
          <Suspense fallback={<div className="sc-scene-loading" />}>
            <S active={active} />
          </Suspense>
        </div>
        <div className="sc-screen-scan" aria-hidden />
      </div>
    </div>
  );
}

function useWide() {
  const q = '(min-width: 960px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}
