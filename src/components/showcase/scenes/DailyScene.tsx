import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SceneProps } from '../sceneKit';
import { DemoCard, useSceneScript } from '../sceneKit';
import { SONGS } from '../showcaseData';
import { getCurrentDay } from '../../../utils/dayCalc';

// Month lengths for the 365 grid's light/dark banding.
const MONTH_ENDS = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
const monthOf = (d: number) => MONTH_ENDS.findIndex(end => d <= end);

/** 365 days light up to today; today's card rises out of its tile. */
export default function DailyScene({ active }: SceneProps) {
  const today = Math.min(365, Math.max(1, getCurrentDay()));
  const song = SONGS[today] ?? SONGS[311];
  const [lit, setLit] = useState(0);
  const [card, setCard] = useState(false);

  useSceneScript(active, async wait => {
    const steps = 22;
    for (let s = 1; s <= steps; s++) { setLit(Math.round((today * s) / steps)); await wait(55); }
    await wait(450);
    setCard(true);
    await wait(3600);
  }, () => { setLit(0); setCard(false); });

  return (
    <div className="sc-daily">
      <div className="sc-daily-grid" aria-hidden>
        {Array.from({ length: 365 }, (_, i) => {
          const d = i + 1;
          const cls = d === today && lit >= today ? 'today' : d <= lit ? (monthOf(d) % 2 ? 'on-b' : 'on-a') : d > today ? 'future' : '';
          return <i key={d} className={cls} />;
        })}
      </div>
      <div className="sc-daily-count">
        <b>{String(lit).padStart(3, '0')}</b><span>/ 365</span>
      </div>
      <AnimatePresence>
        {card && (
          <motion.div
            className="sc-daily-card"
            initial={{ y: 80, opacity: 0, rotate: -6, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, rotate: -3, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 16 }}
          >
            <span className="sc-daily-free">TODAY · FREE</span>
            <DemoCard day={song.day} title={song.title} cover={song.cover} rarity="common" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
