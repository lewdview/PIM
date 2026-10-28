import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVaultStore, type RevealPackMeta } from '../store/useVaultStore';
import FoilPackFace from './foil/FoilPackFace';
import { FOIL_TEAR_Y, FOIL_STRIP_CLIP, FOIL_BODY_CLIP, FOIL_CONFETTI } from './foil/foilTear';
import { get365CardVariantStyle, getPackCoverFallback } from '../utils/cardVariants';

interface Props {
  meta: RevealPackMeta;
  onComplete: () => void;
}

type Phase = 'idle' | 'shaking' | 'ripping' | 'flashing';

/** Renders the cyber cartridge artwork */
function CyberPackBagArt({ meta }: { meta: RevealPackMeta }) {
  return (
    <div className="cyber-cartridge-frame" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(175deg, #07070d 0%, #0d0e17 40%, #05060a 100%)', overflow: 'hidden', border: `1.5px solid ${meta.accent}50` }}>
      <div className="cyber-carbon-weave absolute inset-0 opacity-40 pointer-events-none" />
      {meta.coverImage && (
        <img
          src={meta.coverImage}
          alt={meta.label}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, mixBlendMode: 'luminosity' }}
        />
      )}
      <div className="cyber-bus-pins-top absolute inset-x-0 top-0 h-[14px] z-10" />
      <div className="cyber-bus-pins-bottom absolute inset-x-0 bottom-0 h-[14px] z-10" />
      <div className="cyber-light-conduit-left" style={{ '--conduit-accent': meta.accent } as any} />
      <div className="cyber-light-conduit-right" style={{ '--conduit-accent': meta.accent } as any} />

      {/* Center Hex Core */}
      <div style={{
        position: 'absolute', inset: '28px 0 36px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '8px',
      }}>
        <div style={{ fontSize: '42px', lineHeight: 1, filter: `drop-shadow(0 0 16px ${meta.accent}90)` }}>
          {meta.icon}
        </div>
        <div style={{
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: '18px', fontWeight: 900,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          color: '#fff',
          textShadow: `0 0 20px ${meta.accent}, 2px 2px 0 rgba(0,0,0,0.9)`,
          textAlign: 'center', padding: '0 12px',
        }}>
          {meta.label}
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '7px', fontWeight: 700,
          letterSpacing: '0.25em',
          color: meta.accent,
          background: 'rgba(0,0,0,0.7)',
          padding: '2px 8px',
          borderRadius: '3px',
          border: `1px solid ${meta.accent}40`,
        }}>
          DATA CORE // ENCRYPTED
        </div>
      </div>

      {/* Laser Stamp Price - Top Left */}
      <div className="cyber-laser-stamp" style={{ position: 'absolute', top: '22px', left: '10px', '--stamp-accent': meta.accent, '--stamp-accent-glow': `${meta.accent}40` } as any}>
        <div style={{ fontSize: '5px', opacity: 0.6, textTransform: 'uppercase' }}>PRICE</div>
        <div style={{ fontSize: '15px', fontWeight: 900, lineHeight: 1 }}>
          {meta.price === 'FREE' ? 'FREE' : meta.price}
        </div>
      </div>

      {/* Laser Capacity Stamp - Bottom Right */}
      <div className="cyber-laser-stamp" style={{ position: 'absolute', bottom: '22px', right: '10px', '--stamp-accent': meta.accent, '--stamp-accent-glow': `${meta.accent}40` } as any}>
        <div style={{ fontSize: '5px', opacity: 0.6, textTransform: 'uppercase' }}>CAPACITY</div>
        <div style={{ fontSize: '14px', fontWeight: 900, lineHeight: 1 }}>
          {meta.cardCount}×
        </div>
      </div>
    </div>
  );
}

/** Holo foil pack: the strip tears off along the printed tear line */
function FoilRipPack({ meta, phase }: { meta: RevealPackMeta; phase: Phase }) {
  const isRipping = phase === 'ripping' || phase === 'flashing';
  const isBombshell = meta.category === 'bombshell' || meta.category === 'bombshell_token' || meta.label?.toLowerCase().includes('bombshell');
  const face = (
    <FoilPackFace
      accent={meta.accent}
      label={meta.label}
      coverUrl={meta.coverImage || (isBombshell ? undefined : getPackCoverFallback(meta.category))}
      fullArt={isBombshell && !!meta.coverImage}
      price={meta.price}
      cardCount={meta.cardCount}
      tagline={get365CardVariantStyle(meta.category || meta.label).tagline}
      active={!isRipping}
      interactive={phase === 'idle'}
    />
  );

  return (
    <>
      <motion.div
        initial={false}
        animate={isRipping ? { y: 240, rotate: 6, opacity: 0 } : { y: 0, rotate: 0, opacity: 1 }}
        transition={isRipping ? { duration: 0.55, delay: 0.08, ease: [0.5, 0, 0.75, 0] } : { duration: 0.2 }}
        style={{ position: 'absolute', inset: 0, clipPath: FOIL_BODY_CLIP }}
      >
        {face}
      </motion.div>
      <motion.div
        initial={false}
        animate={
          isRipping
            ? { x: 90, y: -170, rotate: 42, opacity: 0 }
            : phase === 'shaking'
            ? { y: [0, -3, -8], rotate: [0, -3, -8] }
            : { x: 0, y: 0, rotate: 0, opacity: 1 }
        }
        transition={isRipping ? { duration: 0.5, ease: [0.3, 0.6, 0.4, 1] } : { duration: 0.5 }}
        style={{ position: 'absolute', inset: 0, clipPath: FOIL_STRIP_CLIP, transformOrigin: '100% 12%', zIndex: 2 }}
      >
        {face}
      </motion.div>

      {/* Light bursting from the opening */}
      <AnimatePresence>
        {isRipping && (
          <motion.div
            key="foil-burst"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 0], scale: [0.3, 1.6, 2.4] }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              position: 'absolute', left: '-30%', right: '-30%', top: `calc(${FOIL_TEAR_Y}% - 80px)`, height: 160,
              background: `radial-gradient(50% 50% at 50% 50%, #fff 0%, ${meta.accent} 35%, transparent 70%)`,
              filter: 'blur(8px)', mixBlendMode: 'screen', pointerEvents: 'none', zIndex: 3,
            }}
          />
        )}
      </AnimatePresence>

      {isRipping && FOIL_CONFETTI.map((c, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: c.dx * 1.6, y: [0, c.dy * 1.4, c.dy * 1.4 + 200], rotate: c.rot, opacity: [1, 1, 0] }}
          transition={{ duration: 1, delay: c.delay, ease: 'easeOut' }}
          style={{
            position: 'absolute', left: `${c.x}%`, top: `${FOIL_TEAR_Y}%`,
            width: c.w + 1, height: c.h + 1, borderRadius: 1,
            background: `linear-gradient(135deg, hsl(${c.hue} 100% 80%), ${meta.accent}, hsl(${(c.hue + 120) % 360} 100% 70%))`,
            boxShadow: `0 0 6px ${meta.accent}`,
            pointerEvents: 'none', zIndex: 4,
          }}
        />
      ))}
    </>
  );
}

/** Shake animation keyframes for the bag wrapper */
const shakeTransition = { duration: 0.55, ease: [0.36, 0.07, 0.19, 0.97] as const };

export default function PackRipAnimation({ meta, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const packDesignStyle = useVaultStore((s) => s.packDesignStyle);
  const isCyber = packDesignStyle === 'cyber_cartridge';

  const handleTap = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('shaking');
    setTimeout(() => {
      setPhase('ripping');
      setTimeout(() => {
        setPhase('flashing');
        setTimeout(() => {
          onComplete();
        }, 350);
      }, 480);
    }, 560);
  }, [phase, onComplete]);

  const isRipping = phase === 'ripping' || phase === 'flashing';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80,
      background: '#050402',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '28px',
    }}>
      {/* Background ambient glow */}
      <motion.div
        animate={{ opacity: [0.3, 0.55, 0.3], scale: [1, 1.1, 1] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          width: 'min(500px, 150vw)', height: 'min(500px, 150vw)',
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${meta.accent}25, transparent 70%)`,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Pack container — 3:4 aspect 220×293 */}
      <motion.div
        animate={phase === 'shaking'
          ? { x: [-10, 10, -10, 10, -6, 6, -3, 3, 0], rotate: [-2, 2, -2, 2, -1, 1, 0] }
          : { x: 0, rotate: 0 }
        }
        transition={shakeTransition}
        style={{ position: 'relative', width: '220px', height: '293px', cursor: phase === 'idle' ? 'pointer' : 'default' }}
        onClick={handleTap}
      >
        {/* Outer glow halo */}
        <motion.div
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: '-16px', borderRadius: '12px',
            background: `radial-gradient(ellipse, ${meta.accent}30, transparent 70%)`,
            filter: 'blur(16px)', pointerEvents: 'none',
          }}
        />

        {!isCyber && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, y: isRipping ? 0 : [0, -7, 0] }}
            transition={{
              scale: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.4 },
              y: isRipping ? { duration: 0.1 } : { repeat: Infinity, duration: 3.2, ease: 'easeInOut' },
            }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <FoilRipPack meta={meta} phase={phase} />
          </motion.div>
        )}

        {/* ── INTACT CARTRIDGE (idle / shaking) ── */}
        <AnimatePresence>
          {isCyber && !isRipping && (
            <motion.div
              key="intact"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, y: [0, -7, 0] }}
              exit={{ opacity: 0 }}
              transition={{
                scale: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.4 },
                y: { repeat: Infinity, duration: 3.2, ease: 'easeInOut' },
              }}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: '4px', overflow: 'hidden',
                boxShadow: `6px 6px 0 #000, 12px 12px 0 rgba(0,0,0,0.35), 0 0 50px ${meta.accent}20`,
                border: '2px solid rgba(255,255,255,0.07)',
              }}
            >
              <CyberPackBagArt meta={meta} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RIPPED CARTRIDGE HALVES ── */}
        <AnimatePresence>
          {isCyber && isRipping && (
            <>
              {/* Top half */}
              <motion.div
                key="top"
                initial={{ y: 0, rotate: 0, opacity: 1 }}
                animate={{ y: -220, rotate: -14, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.6, 1] }}
                style={{
                  position: 'absolute', inset: 0,
                  clipPath: 'polygon(0 0, 100% 0, 100% 50%, 2% 47%)',
                  borderRadius: '4px', overflow: 'hidden',
                  boxShadow: `6px 6px 0 #000`,
                  border: '2px solid rgba(255,255,255,0.07)',
                }}
              >
                <CyberPackBagArt meta={meta} />
              </motion.div>

              {/* Bottom half */}
              <motion.div
                key="bottom"
                initial={{ y: 0, rotate: 0, opacity: 1 }}
                animate={{ y: 220, rotate: 10, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.6, 1] }}
                style={{
                  position: 'absolute', inset: 0,
                  clipPath: 'polygon(0 47%, 100% 50%, 100% 100%, 0 100%)',
                  borderRadius: '4px', overflow: 'hidden',
                  boxShadow: `6px 6px 0 #000`,
                  border: '2px solid rgba(255,255,255,0.07)',
                }}
              >
                <CyberPackBagArt meta={meta} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Tap prompt */}
      <AnimatePresence>
        {phase === 'idle' && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.4 }}
            style={{ textAlign: 'center', pointerEvents: 'none' }}
          >
            <motion.p
              animate={{ opacity: [0.45, 1, 0.45] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '11px', fontWeight: 700,
                letterSpacing: '0.35em', textTransform: 'uppercase',
                color: meta.accent,
              }}
            >
              {isCyber ? 'TAP TO BREACH MATRIX' : 'TAP TO RIP OPEN'}
            </motion.p>
            <p style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '9px', letterSpacing: '0.15em',
              marginTop: '5px', opacity: 0.25,
              color: '#fff', textTransform: 'uppercase',
            }}>
              {meta.cardCount} card{meta.cardCount > 1 ? 's' : ''} inside
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* White flash */}
      <AnimatePresence>
        {phase === 'flashing' && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.35 }}
            style={{
              position: 'fixed', inset: 0,
              background: isCyber ? '#ffffff' : `radial-gradient(circle at 50% 45%, #ffffff 0%, ${meta.accent} 55%, #050402 100%)`,
              zIndex: 200, pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
