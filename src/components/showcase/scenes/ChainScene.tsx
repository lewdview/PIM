import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SceneProps } from '../sceneKit';
import { useSceneScript } from '../sceneKit';
import { CHAIN_HOPS, SONGS } from '../showcaseData';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const bare = (w: string) => w.toLowerCase().replace(/[^a-z']/g, '');

/** Word chain: a lit word in one lyric jumps to the next song that sings it. */
export default function ChainScene({ active }: SceneProps) {
  const [step, setStep] = useState(0);
  const [picking, setPicking] = useState(false);

  useSceneScript(active, async wait => {
    for (let i = 0; i < CHAIN_HOPS.length; i++) {
      setStep(i);
      setPicking(false);
      await wait(1300);
      if (!CHAIN_HOPS[i].hop) break;
      setPicking(true);
      await wait(900);
    }
    await wait(2200);
  }, () => { setStep(0); setPicking(false); });

  const hop = CHAIN_HOPS[step];
  const song = SONGS[hop.day];
  const lit = new Set(hop.lit.map(bare));

  return (
    <div className="sc-chain">
      <div className="sc-chain-now">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="sc-chain-card"
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -24, filter: 'blur(6px)' }}
            transition={{ duration: 0.4 }}
          >
            <div className="sc-chain-src">
              <img src={song.cover} alt="" />
              <span><b>{song.title}</b>DAY {song.day} · {fmt(hop.time)}</span>
            </div>
            <p className="sc-chain-line">
              {hop.line.split(' ').map((w, i) => {
                const isLit = lit.has(bare(w));
                const isHop = picking && hop.hop && bare(w) === bare(hop.hop);
                return <span key={i} className={isHop ? 'hop' : isLit ? 'lit' : ''}>{w} </span>;
              })}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="sc-chain-poem">
        <small>YOUR FOUND POEM</small>
        {CHAIN_HOPS.slice(0, step + 1).map((h, i) => (
          <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            {h.line}
            <em>— {SONGS[h.day].title}</em>
          </motion.p>
        ))}
      </div>
    </div>
  );
}
