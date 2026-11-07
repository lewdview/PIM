import { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Zap } from 'lucide-react';
import type { SceneProps } from '../sceneKit';
import { DemoCard, useSceneScript } from '../sceneKit';
import { SONGS, RARITY_STYLE } from '../showcaseData';

const SONG = SONGS[31];

/** Fusion lab: three copies of one card slam together into the next rarity. */
export default function ForgeScene({ active }: SceneProps) {
  const [phase, setPhase] = useState<'spread' | 'pull' | 'fuse' | 'done'>('spread');

  useSceneScript(active, async wait => {
    await wait(1100);
    setPhase('pull');
    await wait(650);
    setPhase('fuse');
    await wait(320);
    setPhase('done');
    await wait(3200);
  }, () => setPhase('spread'));

  const spots = [-1, 0, 1];
  const together = phase !== 'spread';

  return (
    <div className="sc-forge">
      <div className="sc-forge-core" aria-hidden><span /><span /><span /></div>
      <div className="sc-forge-stage">
        {phase !== 'done' && spots.map((s, i) => (
          <motion.div
            key={i}
            className="sc-forge-slot"
            initial={false}
            animate={{
              x: together ? 0 : `${s * 112}%`,
              rotate: together ? s * 3 : s * 8,
              y: together ? 0 : Math.abs(s) * 14,
              scale: phase === 'fuse' ? 0.86 : 1,
            }}
            transition={{ duration: together ? 0.55 : 0.4, ease: [0.7, 0, 0.84, 0] }}
          >
            <DemoCard day={SONG.day} title={SONG.title} cover={SONG.cover} rarity="uncommon" />
          </motion.div>
        ))}
        {phase === 'fuse' && <div className="sc-flash" aria-hidden />}
        {phase === 'done' && (
          <>
            <motion.div
              className="sc-forge-slot"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1.08, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 12 }}
            >
              <DemoCard day={SONG.day} title={SONG.title} cover={SONG.cover} rarity="rare" className="is-hero" />
            </motion.div>
            <div className="sc-ring" style={{ ['--rc' as string]: RARITY_STYLE.rare.color }} aria-hidden />
          </>
        )}
      </div>
      <div className="sc-forge-recipe">
        <span style={{ color: RARITY_STYLE.uncommon.color }}>3 × Uncommon</span>
        <i>→</i>
        <span style={{ color: RARITY_STYLE.rare.color }} className={phase === 'done' ? 'on' : ''}>1 × Rare</span>
      </div>
      <div className="sc-chips">
        <span><Flame size={13} /> Burn spares for V⚡</span>
        <span><Zap size={13} /> 150 V⚡ upgrades a tier</span>
      </div>
    </div>
  );
}
