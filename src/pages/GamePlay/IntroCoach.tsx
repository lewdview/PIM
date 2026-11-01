// In-song tips for a monthly build's first run (spec section 3, "Embedded
// teaching"): one short prompt at a time, near the top of the highway, naming
// the controls the player is actually using. Tap first; the hold tip only
// shortly before the first long note. "Hide tips" turns them all off.

import { useEffect, useState, type MutableRefObject } from 'react';
import { keyLabel } from '@/lib/options';

const OFF_KEY = 'pg_coach_off';
const GAMEPAD_GLYPHS = ['□ X', '△ Y', '○ B'];

interface CoachNote {
  time: number;
  hold: boolean;
}

export interface IntroCoachProps {
  /** Current song time in seconds. */
  getT: () => number;
  /** The run's notes (read once the song is loaded). */
  notes: () => CoachNote[];
  /** Notes hit so far. */
  hits: () => number;
  laneKeys: MutableRefObject<[string, string, string]>;
  modality: MutableRefObject<'touch' | 'mouse' | 'key' | 'gamepad'>;
  gamepad: MutableRefObject<boolean>;
}

type Tip = 'tap' | 'hold' | null;

function readOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function IntroCoach({ getT, notes, hits, laneKeys, modality, gamepad }: IntroCoachProps) {
  const [off, setOff] = useState(readOff);
  const [tip, setTip] = useState<Tip>(null);
  const [controls, setControls] = useState('');

  useEffect(() => {
    if (off) return;
    let tapDone = false;
    let holdDone = false;
    const id = window.setInterval(() => {
      const list = notes();
      if (!list.length) return;
      const t = getT();
      const firstTap = list.reduce((m, n) => Math.min(m, n.time), Infinity);
      const firstHold = list.find((n) => n.hold)?.time ?? Infinity;
      if (!tapDone && (hits() >= 4 || t > firstTap + 14)) tapDone = true;
      if (!holdDone && t > firstHold + 1.5) holdDone = true;
      let next: Tip = null;
      if (!holdDone && t >= firstHold - 2.5) next = 'hold';
      else if (!tapDone && t >= firstTap - 4) next = 'tap';
      setTip(next);
      setControls(
        gamepad.current || modality.current === 'gamepad'
          ? GAMEPAD_GLYPHS.join('  ')
          : modality.current === 'touch'
            ? ''
            : laneKeys.current.map((k) => keyLabel(k)).join('  '),
      );
      if (tapDone && holdDone) window.clearInterval(id);
    }, 200);
    return () => window.clearInterval(id);
  }, [off, getT, notes, hits, laneKeys, modality, gamepad]);

  if (off || !tip) return null;

  const hide = () => {
    try {
      localStorage.setItem(OFF_KEY, 'true');
    } catch { /* storage blocked */ }
    setOff(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 84px)' }} role="status" aria-live="polite">
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border border-white/20 bg-black/75 px-4 py-2.5 text-white shadow-lg backdrop-blur">
        <div className="min-w-0 text-sm leading-snug">
          {tip === 'tap' && (
            controls
              ? <>Press <b className="font-mono text-[#39FF14]">{controls}</b> as each note reaches the line.</>
              : <>Tap a lane as its note reaches the line.</>
          )}
          {tip === 'hold' && <>Long note coming: <b className="text-[#FFD700]">hold</b> until its tail ends.</>}
        </div>
        <button type="button" onClick={hide}
          className="shrink-0 rounded-md border border-white/25 px-2 py-1 text-[11px] uppercase tracking-wider text-white/80 hover:text-white">
          Hide tips
        </button>
      </div>
    </div>
  );
}
