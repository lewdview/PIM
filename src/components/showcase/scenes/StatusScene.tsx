import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown } from 'lucide-react';
import type { SceneProps } from '../sceneKit';
import { DemoCard, useSceneScript } from '../sceneKit';
import { SONGS } from '../showcaseData';
import { MEDAL_STOPS } from '../../../pages/GamePlay/constants';

const SONG = SONGS[250];

/** Accuracy climbs through the medals to Platinum, and the First Discoverer stamp lands. */
export default function StatusScene({ active }: SceneProps) {
  const [acc, setAcc] = useState(0);
  const [stamp, setStamp] = useState(false);

  useSceneScript(active, async wait => {
    await wait(500);
    for (let a = 0; a <= 96; a += 3) { setAcc(a); await wait(42); }
    await wait(300);
    setStamp(true);
    await wait(3400);
  }, () => { setAcc(0); setStamp(false); });

  const medal = [...MEDAL_STOPS].reverse().find(m => acc >= m.acc);

  return (
    <div className={`sc-status ${stamp ? 'is-stamped' : ''}`}>
      <div className="sc-status-card">
        <DemoCard
          day={SONG.day}
          title={SONG.title}
          cover={SONG.cover}
          rarity="legendary"
          className={stamp ? 'is-hero' : ''}
          stamp={
            <AnimatePresence>
              {stamp && (
                <motion.div
                  className="sc-stamp"
                  initial={{ scale: 3, opacity: 0, rotate: -30 }}
                  animate={{ scale: 1, opacity: 1, rotate: -14 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                >
                  <Crown size={16} />
                  <b>FIRST DISCOVERER</b>
                  <span>1 OF 1</span>
                </motion.div>
              )}
            </AnimatePresence>
          }
        />
      </div>
      <div className="sc-status-meter">
        <div className="sc-status-acc">
          <b>{acc}%</b>
          <span style={{ color: medal?.color ?? '#71717a' }}>{medal?.name ?? 'NO MEDAL'}</span>
        </div>
        <div className="sc-status-bar">
          <i style={{ width: `${acc}%` }} />
          {MEDAL_STOPS.map(m => (
            <span key={m.name} style={{ left: `${m.acc}%`, ['--m' as string]: m.color }} className={acc >= m.acc ? 'on' : ''}>
              <em>{m.name}</em>
            </span>
          ))}
        </div>
        <p>First player to Platinum a song gets its 1-of-1, stamped in gold.</p>
      </div>
    </div>
  );
}
