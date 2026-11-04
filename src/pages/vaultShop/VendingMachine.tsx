import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { X } from 'lucide-react';
import { audioManager } from '../../game/audio';
import { PackToken } from './ClawCabinet';
import type { PitPack, VendSlot } from './clawPits';

type Phase = 'idle' | 'paying' | 'vending' | 'dropped';

export interface VendingMachineProps {
  rows: VendSlot[][];
  lockedIds?: Set<string>;
  credit: number;
  /** Charge for the pack. Resolve true once paid (the coil then turns), false if not. */
  onVend: (pack: PitPack) => Promise<boolean>;
  /** Called when the pack lands behind the flap. */
  onDropped: (pack: PitPack) => void;
  trayPacks: PitPack[];
  trayCards: number;
  onOpenTray: () => void;
  busy?: boolean;
}

const ROW_LETTERS = 'ABCDE';

export default function VendingMachine({ rows, lockedIds, credit, onVend, onDropped, trayPacks, trayCards, onOpenTray, busy }: VendingMachineProps) {
  const glassRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [selected, setSelected] = useState<VendSlot | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [keyBuffer, setKeyBuffer] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [falling, setFalling] = useState<{ pack: PitPack; x: number; y: number; w: number; h: number; drop: number } | null>(null);

  const slotByCode = useMemo(() => {
    const m: Record<string, VendSlot> = {};
    rows.flat().forEach(s => { m[s.code] = s; });
    return m;
  }, [rows]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2600);
    return () => clearTimeout(t);
  }, [message]);

  const choose = useCallback((slot: VendSlot) => {
    if (phase === 'paying' || phase === 'vending') return;
    audioManager.playSfx('tap_nav', 0.2);
    setKeyBuffer('');
    setPhase('idle');
    if (!slot.pack) { setSelected(null); setMessage(`${slot.code} IS EMPTY`); return; }
    if (lockedIds?.has(slot.pack.id)) { setSelected(slot); setMessage('SOLD OUT · BACK TOMORROW'); return; }
    setSelected(slot);
    setMessage(null);
    setZoomed(true);
  }, [phase, lockedIds]);

  // Esc closes the close-up.
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  const pressKey = useCallback((k: string) => {
    if (phase === 'paying' || phase === 'vending') return;
    audioManager.playSfx('tap_nav', 0.15);
    if (ROW_LETTERS.includes(k)) { setKeyBuffer(k); setSelected(null); return; }
    if (keyBuffer.length === 1) {
      const slot = slotByCode[`${keyBuffer}${k}`];
      setKeyBuffer('');
      if (slot) choose(slot);
      return;
    }
    setMessage('PICK A ROW FIRST (A–E)');
  }, [phase, keyBuffer, slotByCode, choose]);

  const clear = () => { setKeyBuffer(''); setSelected(null); setZoomed(false); setMessage(null); if (phase === 'dropped') setPhase('idle'); };

  const vend = useCallback(async () => {
    const slot = selected;
    const pack = slot?.pack;
    if (!slot || !pack || phase === 'paying' || phase === 'vending' || busy) return;
    if (lockedIds?.has(pack.id)) { audioManager.playSfx('locked_out', 0.5); setMessage('SOLD OUT · BACK TOMORROW'); return; }

    if (zoomed) {
      // Let the close-up fly back onto its coil before the machine runs.
      setZoomed(false);
      await new Promise(r => setTimeout(r, 380));
    }
    setPhase('paying');
    const paid = await onVend(pack);
    if (!paid) { setPhase('idle'); return; }

    // Coil turns, pack tips off the shelf and drops to the flap.
    setPhase('vending');
    setSpinning(slot.code);
    audioManager.playSfx('open_case', 0.7);
    await new Promise(r => setTimeout(r, 650));

    const glass = glassRef.current?.getBoundingClientRect();
    const el = slotRefs.current[slot.code]?.querySelector('.vend-pack');
    const r = el?.getBoundingClientRect();
    if (glass && r) {
      setFalling({ pack, x: r.left - glass.left, y: r.top - glass.top, w: r.width, h: r.height, drop: glass.height - (r.top - glass.top) + 10 });
    }
    await new Promise(r2 => setTimeout(r2, 560));
    audioManager.playSfx('cas_slam_down', 0.5);
    setFalling(null);
    setSpinning(null);
    onDropped(pack);
    setPhase('dropped');
    setSelected(null);
  }, [selected, phase, busy, lockedIds, onVend, onDropped, zoomed]);

  const sel = selected?.pack;
  const display = message
    ?? (phase === 'paying' ? 'CHECKING PAYMENT…'
      : phase === 'vending' ? 'VENDING…'
      : phase === 'dropped' ? 'TAKE YOUR PACK ↓'
      : keyBuffer ? `ROW ${keyBuffer} · PICK 1–6`
      : sel ? null
      : 'MAKE A SELECTION');

  const vendLabel = !sel ? 'VEND'
    : sel.currency === 'free' ? 'VEND · FREE'
    : `VEND · ${sel.price}`;

  return (
    <LayoutGroup>
    <div className="vend-cabinet">
      <div className="vend-body">
        {/* Glass front */}
        <div className="vend-window">
          <div className="vend-glass" ref={glassRef}>
            {rows.map((row, r) => (
              <div key={r} className="vend-shelf">
                <div className="vend-shelf-slots">
                  {row.map(slot => {
                    const locked = !!slot.pack && lockedIds?.has(slot.pack.id);
                    const isSel = selected?.code === slot.code;
                    const isFalling = falling && spinning === slot.code;
                    return (
                      <button
                        key={slot.code}
                        ref={el => { slotRefs.current[slot.code] = el; }}
                        type="button"
                        className={`vend-slot${isSel ? ' is-sel' : ''}${locked ? ' is-locked' : ''}${!slot.pack ? ' is-empty' : ''}`}
                        onClick={() => choose(slot)}
                        aria-label={slot.pack ? `${slot.code}: ${slot.pack.label}, ${slot.pack.cardCount} cards, ${slot.pack.price}` : `${slot.code}: empty`}
                      >
                        <span className="vend-slot-pack">
                          {slot.pack && (
                            <motion.span
                              className="vend-pack"
                              layoutId={zoomed && isSel ? undefined : `vend-pack-${slot.code}`}
                              animate={spinning === slot.code ? { y: [0, -3, 2], rotateX: [0, -14, 0] } : { y: 0 }}
                              transition={{ duration: 0.6 }}
                              style={{ opacity: isFalling ? 0 : 1 }}
                            >
                              <PackToken pack={slot.pack} locked={locked} />
                            </motion.span>
                          )}
                        </span>
                        <span className={`vend-coil${spinning === slot.code ? ' is-spinning' : ''}`} aria-hidden />
                      </button>
                    );
                  })}
                </div>
                <div className="vend-shelf-tags" aria-hidden>
                  {row.map(slot => (
                    <span key={slot.code} className={selected?.code === slot.code ? 'is-sel' : ''}>
                      <b>{slot.code}</b>{slot.pack ? (lockedIds?.has(slot.pack.id) ? 'SOLD' : slot.pack.price.replace(' V⚡', '⚡')) : '—'}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            <AnimatePresence>
              {falling && (
                <motion.span
                  key="falling"
                  className="vend-falling"
                  style={{ left: falling.x, top: falling.y, width: falling.w, height: falling.h }}
                  initial={{ y: 0, rotate: 0 }}
                  animate={{ y: falling.drop, rotate: 18 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.55, 0, 1, 0.7] }}
                >
                  <PackToken pack={falling.pack} />
                </motion.span>
              )}
            </AnimatePresence>
            <div className="vend-glass-glare" aria-hidden />
          </div>

          <AnimatePresence>
            {zoomed && sel && selected && (
              <motion.div
                key="zoom"
                className="vend-zoom"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={(e) => { if (e.target === e.currentTarget) setZoomed(false); }}
              >
                <button type="button" className="vend-zoom-close" aria-label="Back to the machine" onClick={() => setZoomed(false)}>
                  <X size={18} />
                </button>
                <motion.div
                  className="vend-zoom-pack"
                  layoutId={`vend-pack-${selected.code}`}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                  onPointerMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 18, y: ((e.clientY - r.top) / r.height - 0.5) * -18 });
                  }}
                  onPointerLeave={() => setTilt({ x: 0, y: 0 })}
                  style={{ rotateY: tilt.x, rotateX: tilt.y }}
                >
                  <PackToken pack={sel} locked={lockedIds?.has(sel.id)} />
                  <span className="vend-zoom-sheen" aria-hidden />
                </motion.div>
                <motion.div
                  className="vend-zoom-info"
                  initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { delay: 0.12 } }} exit={{ y: 10, opacity: 0 }}
                >
                  <span className="vend-zoom-code">{selected.code}</span>
                  <h3>{sel.label}</h3>
                  <p>{sel.description}</p>
                  <p className="vend-zoom-meta">{sel.cardCount} card{sel.cardCount === 1 ? '' : 's'} · <b>{sel.price}</b></p>
                  <div className="vend-zoom-actions">
                    <button
                      type="button" className="vend-go"
                      disabled={phase === 'paying' || phase === 'vending' || busy || lockedIds?.has(sel.id)}
                      onClick={vend}
                    >
                      {lockedIds?.has(sel.id) ? 'SOLD OUT' : vendLabel}
                    </button>
                    <button type="button" className="vend-zoom-back" onClick={() => setZoomed(false)}>Back</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Control panel */}
        <div className="vend-panel">
          <div className="vend-display" aria-live="polite">
            {display ? (
              <span className="vend-display-line">{display}</span>
            ) : sel && (
              <>
                <span className="vend-display-code">{selected?.code}</span>
                <span className="vend-display-line">{sel.label}</span>
                <span className="vend-display-sub">{sel.cardCount} card{sel.cardCount === 1 ? '' : 's'} · {sel.price}</span>
              </>
            )}
            <span className="vend-display-credit">CREDIT {credit.toLocaleString()} V⚡</span>
          </div>

          <div className="vend-keypad" role="group" aria-label="Keypad">
            {[...ROW_LETTERS].map(k => (
              <button key={k} type="button" className={`vend-key vend-key-letter${keyBuffer === k ? ' is-on' : ''}`} onClick={() => pressKey(k)}>{k}</button>
            ))}
            <button type="button" className="vend-key vend-key-clr" onClick={clear}>CLR</button>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} type="button" className="vend-key" onClick={() => pressKey(String(n))}>{n}</button>
            ))}
          </div>

          <button type="button" className="vend-go" disabled={!sel || phase === 'paying' || phase === 'vending' || busy} onClick={vend}>
            {phase === 'paying' ? 'PAYING…' : phase === 'vending' ? 'VENDING…' : vendLabel}
          </button>

          <div className="vend-slots-hw" aria-hidden>
            <span className="vend-coin"><i /></span>
            <span className="vend-card"><i /></span>
          </div>
          <span className="vend-panel-note">Cards · crypto · V⚡</span>
          <span className="vend-decal" aria-hidden><b>NEW</b> DROPS<br />DAILY</span>
        </div>
      </div>

      {/* Pickup flap */}
      <div className="vend-base">
        <button
          type="button"
          className={`vend-flap${trayPacks.length ? ' has-items' : ''}`}
          onClick={onOpenTray}
          disabled={!trayPacks.length}
          aria-label={trayPacks.length ? `Open ${trayPacks.length} packs` : 'Pickup tray is empty'}
        >
          <span className="vend-flap-items">
            <AnimatePresence>
              {trayPacks.slice(-6).map((p, i) => (
                <motion.span
                  key={`${p.id}-${i}-${trayPacks.length}`}
                  className="vend-flap-pack"
                  initial={{ y: -40, rotate: -20, opacity: 0 }}
                  animate={{ y: 0, rotate: (i % 2 ? 8 : -8), opacity: 1 }}
                >
                  <PackToken pack={p} />
                </motion.span>
              ))}
            </AnimatePresence>
          </span>
          <span className="vend-flap-door">
            {trayPacks.length ? `PUSH · OPEN ${trayPacks.length} PACK${trayPacks.length === 1 ? '' : 'S'} · ${trayCards} CARDS` : 'PUSH'}
          </span>
        </button>
        <span className="vend-brand">PIM · TH3V4ULT</span>
      </div>
    </div>
    </LayoutGroup>
  );
}
