import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SceneProps } from '../sceneKit';
import '../../../styles/vaultShop.css';
import { DemoCard, useSceneScript } from '../sceneKit';
import { SONGS, RARITY_SUPPLY, RARITY_STYLE } from '../showcaseData';
import { PackToken } from '../../../pages/vaultShop/PackToken';
import { clawPrizePacks } from '../../../pages/vaultShop/clawPits';
import type { Rarity } from '../../../utils/rarity';

// Dark Pack (5 cards): four regular pulls, then the big one.
const PULL: Array<{ day: number; rarity: Rarity }> = [
  { day: 85, rarity: 'common' },
  { day: 213, rarity: 'common' },
  { day: 114, rarity: 'uncommon' },
  { day: 280, rarity: 'rare' },
  { day: 250, rarity: 'legendary' },
];
const LAST = PULL.length - 1;

/** A three-card pack shakes, bursts and deals its cards, the last one a big pull. */
export default function PackScene({ active }: SceneProps) {
  const pack = useMemo(() => clawPrizePacks('dark').find(p => p.category === 'dark' && p.size === 'triple') ?? clawPrizePacks('dark')[0], []);
  const [phase, setPhase] = useState<'pack' | 'shake' | 'burst' | 'deal'>('pack');
  const [shown, setShown] = useState(0);

  useSceneScript(active, async wait => {
    await wait(700);
    setPhase('shake');
    await wait(900);
    setPhase('burst');
    await wait(260);
    setPhase('deal');
    for (let i = 1; i <= PULL.length; i++) { await wait(i === PULL.length ? 950 : 420); setShown(i); }
    await wait(2600);
  }, () => { setPhase('pack'); setShown(0); });

  const top = shown ? PULL[shown - 1].rarity : null;

  return (
    <div className="sc-pack">
      <div className="sc-pack-stage">
        <AnimatePresence>
          {(phase === 'pack' || phase === 'shake') && (
            <motion.div
              key="pack"
              className={`sc-pack-token ${phase === 'shake' ? 'is-shaking' : ''}`}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0, filter: 'brightness(3)' }}
              transition={{ duration: 0.3 }}
            >
              <PackToken pack={pack} hidePrice />
            </motion.div>
          )}
        </AnimatePresence>
        {phase === 'burst' && <div className="sc-flash" aria-hidden />}
        {phase === 'deal' && (
          <div className="sc-pack-fan">
            {PULL.map((c, i) => {
              const s = SONGS[c.day];
              return (
                <motion.div
                  key={c.day}
                  className="sc-pack-slot"
                  initial={{ y: 40, opacity: 0, rotate: 0 }}
                  animate={{ y: Math.abs(i - LAST / 2) * 6, opacity: 1, rotate: (i - LAST / 2) * 6 }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 18 }}
                >
                  <DemoCard day={s.day} title={s.title} cover={s.cover} rarity={c.rarity} flipped={i >= shown} className={i === LAST && shown === PULL.length ? 'is-hero' : ''} />
                </motion.div>
              );
            })}
            {shown === PULL.length && <div className="sc-ring" style={{ ['--rc' as string]: RARITY_STYLE.legendary.color }} aria-hidden />}
          </div>
        )}
      </div>
      <ol className="sc-ladder" aria-label="Rarity tiers and copies per card">
        {RARITY_SUPPLY.map(([r, cap]) => (
          <li key={r} className={top === r ? 'on' : ''} style={{ ['--r' as string]: RARITY_STYLE[r].color }}>
            <b>{RARITY_STYLE[r].label}</b>
            <span>{cap} {cap === '1' ? 'copy' : 'copies'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
