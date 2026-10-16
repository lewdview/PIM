// Opening of a monthly Playgama build: a short animated intro (presenter card,
// the PIM logo, then the month slamming in over its cover art), then a
// press-start screen. Any tap, key or gamepad button skips the intro; the
// start press is also the first user gesture, so game audio can play after it.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { loadCatalog } from '@/game/api';
import { CHAPTERS } from '@/game/campaign';
import { songsForMonth } from '@/game/chapterStory';
import { audioManager } from '@/game/audio';
import { PLAYGAMA_MONTH } from '@/platform/playgama/month';
import '@/styles/stageShell.css';
import '@/styles/monthTitle.css';

const INTRO_MS = 5200;
const LOGO = '/data/logos/logo_1.png';

/** Fires `onPress` once for a tap, a key or a gamepad button. */
function usePress(onPress: () => void, delayMs = 0) {
  const cb = useRef(onPress);
  cb.current = onPress;
  useEffect(() => {
    let done = false;
    const armedAt = performance.now() + delayMs;
    const fire = () => {
      if (done || performance.now() < armedAt) return;
      done = true;
      cb.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      fire();
    };
    window.addEventListener('pointerdown', fire);
    window.addEventListener('keydown', onKey);
    let raf = 0;
    // Buttons already held when the screen opens don't count until released.
    let held = true;
    const poll = () => {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
      const pressed = pads.some((gp) => gp?.buttons.some((b) => b.pressed));
      if (!pressed) held = false;
      else if (!held) fire();
      if (!done) raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => {
      done = true;
      window.removeEventListener('pointerdown', fire);
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    };
  }, [delayMs]);
}

function useMonthCovers(): { covers: string[]; count: number } {
  const [state, setState] = useState({ covers: [] as string[], count: 0 });
  useEffect(() => {
    let alive = true;
    loadCatalog().then((catalog) => {
      if (!alive) return;
      const songs = songsForMonth(catalog, PLAYGAMA_MONTH);
      setState({ covers: songs.map((s) => s.coverArt).filter((c): c is string => !!c), count: songs.length });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return state;
}

function CoverWall({ covers, className }: { covers: string[]; className: string }) {
  if (!covers.length) return null;
  // Enough tiles to fill a wide screen, repeating the month's covers.
  const tiles = Array.from({ length: 40 }, (_, i) => covers[(i * 7) % covers.length]);
  return (
    <div className={className} aria-hidden="true">
      {tiles.map((src, i) => <img key={i} src={src} alt="" style={{ ['--d' as string]: `${(i % 10) * 70}ms` }} />)}
    </div>
  );
}

export default function TitleScreens({ onStart }: { onStart: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'start'>('intro');
  const { covers, count } = useMonthCovers();
  const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];
  const style = { ['--ch' as string]: meta.dc };

  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => setPhase('start'), INTRO_MS);
    return () => clearTimeout(t);
  }, [phase]);

  return phase === 'intro'
    ? <Intro key="intro" style={style} covers={covers} name={meta.name} onSkip={() => setPhase('start')} />
    : <PressStart key="start" style={style} covers={covers} name={meta.name} sub={meta.sub} count={count} onStart={onStart} />;
}

function Intro({ style, covers, name, onSkip }: { style: CSSProperties; covers: string[]; name: string; onSkip: () => void }) {
  usePress(onSkip, 250);
  return (
    <div className="mt-screen mt-intro" style={style} role="presentation">
      <div className="mt-present">
        <span>th3scr1b3</span>
        <small>presents</small>
      </div>
      <img className="mt-intro-logo" src={LOGO} alt="PIM: Poetry in Motion" />
      <CoverWall covers={covers} className="mt-intro-wall" />
      <div className="mt-intro-month">
        <small>Chapter {String(PLAYGAMA_MONTH).padStart(2, '0')}</small>
        <b>{name}</b>
      </div>
      <div className="mt-flash" />
      <div className="mt-skip">Tap to skip</div>
    </div>
  );
}

function PressStart({ style, covers, name, sub, count, onStart }: {
  style: CSSProperties; covers: string[]; name: string; sub: string; count: number; onStart: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  usePress(() => {
    audioManager.playSfx('tap_nav', 0.5);
    setLeaving(true);
    setTimeout(onStart, 380);
  }, 300);
  return (
    <div className="mt-screen mt-start" data-leaving={leaving || undefined} style={style}>
      <CoverWall covers={covers} className="mt-start-wall" />
      <div className="mt-start-body">
        <img className="mt-start-logo" src={LOGO} alt="PIM: Poetry in Motion" />
        <div className="mt-start-month">
          <b>{name}</b>
          <small>{sub}{count ? ` · ${count} tracks` : ''}</small>
        </div>
        <div className="mt-press" role="button" aria-label="Start game">{touch ? 'Tap to start' : 'Press start'}</div>
      </div>
      <div className="mt-start-foot">© th3scr1b3 · 365 days of light and dark</div>
    </div>
  );
}
