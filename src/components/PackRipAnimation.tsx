import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RevealPackMeta } from '../store/useVaultStore';

interface Props {
  meta: RevealPackMeta;
  onComplete: () => void;
}

type Phase = 'idle' | 'shaking' | 'ripping' | 'flashing';

/** Renders the pack bag artwork — reused for both halves of the rip */
function PackBagArt({ meta }: { meta: RevealPackMeta }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: meta.gradient, overflow: 'hidden' }}>
      {/* Base glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${meta.accent}50, transparent 60%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 85%, ${meta.accent}30, transparent 50%)` }} />

      {/* Diagonal stripe texture */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="rip-stripe" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect x="0" y="0" width="10" height="20" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rip-stripe)" />
      </svg>

      {/* Notch bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '32px',
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: `1px solid ${meta.accent}20`,
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.9)',
            border: '1.5px solid rgba(255,255,255,0.15)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
          }} />
        ))}
      </div>

      {/* Center: icon + label */}
      <div style={{
        position: 'absolute', inset: '40px 0 70px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '10px',
      }}>
        <div style={{ fontSize: '52px', lineHeight: 1, filter: `drop-shadow(0 0 16px ${meta.accent}90)` }}>
          {meta.icon}
        </div>
        <div style={{
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: '20px', fontWeight: 900,
          textTransform: 'uppercase', letterSpacing: '-0.5px',
          color: '#fff',
          textShadow: `0 0 24px ${meta.accent}99, 2px 2px 0 rgba(0,0,0,0.9)`,
          textAlign: 'center', padding: '0 12px',
        }}>
          {meta.label}
        </div>
        <div style={{
          width: '60px', height: '1.5px',
          background: `linear-gradient(90deg, transparent, ${meta.accent}, transparent)`,
          opacity: 0.6,
        }} />
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '8px', fontWeight: 700,
          letterSpacing: '0.2em',
          color: 'rgba(255,255,255,0.35)',
        }}>
          PIM : th3v4ult · GEN 0
        </div>
      </div>

      {/* Price stamp — top left */}
      <div style={{
        position: 'absolute', top: '44px', left: '12px',
        transform: 'rotate(-2.5deg)',
        background: '#faf5e8', border: '2px solid #000',
        padding: '4px 10px',
        boxShadow: '3px 3px 0 #000',
      }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '6px', fontWeight: 900, textTransform: 'uppercase', opacity: 0.5, lineHeight: 1 }}>PRICE</div>
        <div style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '22px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1 }}>
          {meta.price === 'FREE' ? 'FREE' : meta.price}
        </div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '6px', opacity: 0.4, textTransform: 'uppercase', lineHeight: 1, marginTop: '2px' }}>
          {meta.price === 'FREE' ? 'no cost' : 'per pack'}
        </div>
      </div>

      {/* Card count stamp — bottom right */}
      <div style={{
        position: 'absolute', bottom: '74px', right: '12px',
        transform: 'rotate(1.5deg)',
        background: '#faf5e8', border: '2px solid #000',
        padding: '3px 10px',
        boxShadow: '3px 3px 0 #000',
        minWidth: '54px', textAlign: 'center',
      }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '6px', fontWeight: 900, textTransform: 'uppercase', opacity: 0.5, lineHeight: 1 }}>CARDS</div>
        <div style={{ fontFamily: '"Impact", "Arial Black", sans-serif', fontSize: '18px', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1 }}>
          {meta.cardCount}{meta.cardCount > 1 ? '×' : ''}
        </div>
      </div>

      {/* Barcode strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '64px',
        background: 'rgba(0,0,0,0.75)',
        borderTop: `1.5px solid ${meta.accent}35`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '5px',
        padding: '8px 16px',
      }}>
        {/* Barcode lines */}
        <div style={{ display: 'flex', gap: '1.5px', height: '22px', alignItems: 'stretch' }}>
          {Array.from({ length: 28 }, (_, i) => (
            <div key={i} style={{
              width: `${[2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1][i % 14] ?? 1}px`,
              background: i % 5 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)',
              flexShrink: 0,
            }} />
          ))}
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '7px', fontWeight: 700,
          letterSpacing: '0.3em', textTransform: 'uppercase',
          color: `${meta.accent}`, opacity: 0.45,
        }}>
          {meta.category.toUpperCase().replace('_', '-')}
        </div>
      </div>

      {/* Border overlay */}
      <div style={{ position: 'absolute', inset: 0, border: `1.5px solid rgba(255,255,255,0.07)`, borderRadius: '4px', pointerEvents: 'none' }} />
    </div>
  );
}

/** Shake animation keyframes for the bag wrapper */
const shakeTransition = { duration: 0.55, ease: [0.36, 0.07, 0.19, 0.97] as const };

export default function PackRipAnimation({ meta, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');

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

        {/* ── INTACT PACK (idle / shaking) ── */}
        <AnimatePresence>
          {!isRipping && (
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
              <PackBagArt meta={meta} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RIPPED HALVES ── */}
        <AnimatePresence>
          {isRipping && (
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
                <PackBagArt meta={meta} />
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
                <PackBagArt meta={meta} />
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
              TAP TO RIP OPEN
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
              background: '#ffffff',
              zIndex: 200, pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
