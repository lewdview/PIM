import { useMemo, useRef, useState } from 'react';
import { motion, animate, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import type { SceneProps } from '../sceneKit';
import '../../../styles/vaultShop.css';
import { useSceneScript } from '../sceneKit';
import { CartoonClaw } from '../../../pages/vaultShop/ClawEvent';
import { MysteryPack, MYSTERY_ACCENTS, PackToken } from '../../../pages/vaultShop/PackToken';
import { clawPrizePacks } from '../../../pages/vaultShop/clawPits';

const TILTS = [-10, 6, -4, 9, -7, 3, -9];

/** Bonus claw on autoplay: one drop slips, the next one holds and wins a real pack. */
export default function ClawScene({ active }: SceneProps) {
  const prize = useMemo(() => clawPrizePacks('dark').find(p => p.category === 'dark' && p.size === 'triple') ?? clawPrizePacks('dark')[0], []);
  const glassRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0.62);
  const drop = useMotionValue(0);
  const left = useTransform(x, v => `${v * 100}%`);
  const cable = useTransform(drop, v => 18 + v);
  const [open, setOpen] = useState(true);
  const [carry, setCarry] = useState<number | null>(null);
  const [gone, setGone] = useState<number | null>(null);
  const [tryNo, setTryNo] = useState(1);
  const [shout, setShout] = useState<string | null>(null);
  const [won, setWon] = useState(false);

  useSceneScript(active, async wait => {
    // Reach down until the prongs sit over the top half of a pack (measured at rest).
    const glass = glassRef.current;
    const head = glass?.querySelector('.sc-claw-head svg')?.getBoundingClientRect();
    const pack = glass?.querySelector('.sc-claw-pile span')?.getBoundingClientRect();
    const depth = head && pack ? Math.max(40, pack.top + pack.height * 0.4 - head.bottom) : 150;
    const grab = async (target: number, slot: number, holds: boolean) => {
      await animate(x, [x.get(), 0.86, 0.2, target], { duration: 1.3, ease: 'easeInOut' });
      await animate(drop, depth, { duration: 0.45, ease: 'easeIn' });
      setOpen(false); setCarry(slot);
      await wait(220);
      await animate(drop, holds ? 0 : 60, { duration: holds ? 0.5 : 0.3, ease: 'easeOut' });
      if (!holds) {
        setCarry(null); setOpen(true); setShout('SO CLOSE!');
        await animate(drop, 0, { duration: 0.35 });
        await wait(450); setShout(null);
        return;
      }
      setGone(slot);
      await animate(x, 0.1, { duration: 0.7, ease: 'easeInOut' });
      setOpen(true); setCarry(null);
      await wait(260);
      setWon(true);
    };
    setTryNo(1);
    await grab(0.56, 3, false);
    setTryNo(2);
    await grab(0.38, 2, true);
    await wait(2300);
  }, () => {
    x.set(0.62); drop.set(0); setOpen(true); setCarry(null); setGone(null); setShout(null); setWon(false); setTryNo(1);
  });

  return (
    <div className="sc-claw">
      <div className="sc-claw-marquee"><span>BONUS</span> CLAW</div>
      <div className="sc-claw-glass" ref={glassRef}>
        <div className="sc-claw-rays" aria-hidden />
        <div className="sc-claw-rail" aria-hidden />
        <div className="sc-claw-tries" aria-hidden>
          {[1, 2, 3].map(n => <i key={n} className={n < tryNo ? 'used' : n === tryNo ? 'now' : ''}>{n}</i>)}
        </div>
        <div className="sc-claw-chute" aria-hidden>PRIZE</div>
        <motion.div className="sc-claw-rig" style={{ left }}>
          <motion.div className="sc-claw-cable" style={{ height: cable }} />
          <motion.div className="sc-claw-head">
            <CartoonClaw open={open} />
            {carry !== null && <span className="sc-claw-held"><MysteryPack accent={MYSTERY_ACCENTS[carry]} /></span>}
          </motion.div>
        </motion.div>
        <div className="sc-claw-pile" aria-hidden>
          {TILTS.map((tilt, i) => (
            <span key={i} style={{ rotate: `${tilt}deg`, opacity: gone === i || carry === i ? 0 : 1 }}>
              <MysteryPack accent={MYSTERY_ACCENTS[i]} />
            </span>
          ))}
        </div>
        <AnimatePresence>
          {shout && (
            <motion.p key="shout" className="sc-claw-shout" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
              {shout}
            </motion.p>
          )}
          {won && (
            <motion.div key="won" className="sc-claw-won" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="sc-claw-won-pack" initial={{ scale: 0.3, rotate: -14 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                <PackToken pack={prize} hidePrice />
              </motion.div>
              <p><b>YOU WON</b> {prize.label} · {prize.cardCount} cards</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
