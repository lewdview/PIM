import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SceneProps } from '../sceneKit';
import { useSceneScript } from '../sceneKit';
import { SONGS, BOMBSHELL_ART } from '../showcaseData';
import { BOMBSHELL_REWARD_SPARKS } from '../../../utils/bombshellRewards';

const DAYS_IN_MONTH = 28;
const OFFICIAL = SONGS[33];

/** A day's official cover flips to its bombshell variant; the month tracker fills to a reward. */
export default function BombshellScene({ active }: SceneProps) {
  const [variant, setVariant] = useState(-1);
  const [filled, setFilled] = useState(0);
  const [done, setDone] = useState(false);

  useSceneScript(active, async wait => {
    await wait(900);
    for (let i = 0; i < BOMBSHELL_ART.length; i++) {
      setVariant(i);
      setFilled(f => Math.min(DAYS_IN_MONTH - 1, f + 4));
      await wait(i === 0 ? 1100 : 560);
    }
    setFilled(DAYS_IN_MONTH);
    await wait(250);
    setDone(true);
    await wait(2400);
  }, () => { setVariant(-1); setFilled(0); setDone(false); });

  const src = variant < 0 ? OFFICIAL.cover : BOMBSHELL_ART[variant];

  return (
    <div className="sc-bomb">
      <div className="sc-bomb-stack">
        {BOMBSHELL_ART.slice(0, Math.max(0, variant)).map((a, i) => (
          <img key={a} src={a} alt="" className="sc-bomb-under" style={{ rotate: `${(i % 2 ? 1 : -1) * (4 + i * 2)}deg`, translate: `${(i % 2 ? 1 : -1) * (10 + i * 5)}% ${i * 1.5}%` }} />
        ))}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={src}
            className="sc-bomb-cover"
            initial={{ rotateY: -90, opacity: 0.4 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <img src={src} alt="" />
            <span className="sc-bomb-tag">{variant < 0 ? 'OFFICIAL COVER' : `BOMBSHELL VARIANT`}</span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="sc-bomb-month">
        <div className="sc-bomb-month-head">
          <b>FEBRUARY</b>
          <span>{Math.min(filled, DAYS_IN_MONTH)} / {DAYS_IN_MONTH} days</span>
        </div>
        <div className="sc-bomb-grid">
          {Array.from({ length: DAYS_IN_MONTH }, (_, i) => <i key={i} className={i < filled ? 'on' : ''} />)}
        </div>
        <AnimatePresence>
          {done && (
            <motion.p className="sc-bomb-reward" initial={{ y: 12, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              MONTH COMPLETE <b>+{BOMBSHELL_REWARD_SPARKS.complete.toLocaleString()} V⚡</b>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
