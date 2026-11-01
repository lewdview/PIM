// Opening of a monthly Playgama build: a short animated intro (presenter card,
// the PIM logo, then the month slamming in over its cover art), then the entry
// screen: one primary Play that goes straight into a song (the opener for a new
// player, the next unfinished entry for a returning one), plus Choose Entry and
// Settings. Any tap, key or gamepad button skips the intro; the Play press is
// also the first user gesture, so game audio can play after it.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { loadCatalog, type GameSong } from '@/game/api';
import { CHAPTERS } from '@/game/campaign';
import { chapterProgress, hasClearedSong, songsForMonth, type ChapterProgress } from '@/game/chapterStory';
import { Play, ListMusic, Settings } from 'lucide-react';
import { hasFirstFinish } from '@/platform/playgama/runMode';
import { routeThroughStory } from '@/platform/playgama/storyScenes';
import { track, sinceLaunch } from '@/platform/playgama/funnel';
import { monthStageLevel, prepareMonthRun } from './startRun';
import { playTarget, type EntryPick } from './nextEntry';
import { useVaultStore } from '@/store/useVaultStore';
import { audioManager } from '@/game/audio';
import { BUILD_VERSION, PLAYGAMA_MONTH } from '@/platform/playgama/month';
import { externalLinksAllowed } from '@/platform/playgama/bridge';
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

interface MonthState {
  covers: string[];
  count: number;
  songs: GameSong[];
  progress: ChapterProgress | null;
}

function useMonthCovers(): MonthState {
  const [state, setState] = useState<MonthState>({ covers: [], count: 0, songs: [], progress: null });
  useEffect(() => {
    let alive = true;
    loadCatalog().then((catalog) => {
      if (!alive) return;
      const songs = songsForMonth(catalog, PLAYGAMA_MONTH);
      const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];
      setState({
        covers: songs.map((s) => s.coverArt).filter((c): c is string => !!c),
        count: songs.length,
        songs,
        progress: songs.length ? chapterProgress(songs, meta) : null,
      });
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

/**
 * onStart(path): leave the title for `path`, the chapter (Choose Entry) or a run (Play).
 * onSettings: open Options over the title.
 */
export default function TitleScreens({ onStart, onSettings }: { onStart: (path: string | null) => void; onSettings: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'start'>('intro');
  const { covers, count, songs, progress } = useMonthCovers();
  const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];
  const style = { ['--ch' as string]: meta.dc };

  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => setPhase('start'), INTRO_MS);
    return () => clearTimeout(t);
  }, [phase]);

  return phase === 'intro'
    ? <Intro key="intro" style={style} covers={covers} name={meta.name} onSkip={() => setPhase('start')} />
    : <PressStart key="start" style={style} covers={covers} name={meta.name} sub={meta.sub} count={count}
        songs={songs} progress={progress} onStart={onStart} onSettings={onSettings} />;
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

function PressStart({ style, covers, name, sub, count, songs, progress, onStart, onSettings }: {
  style: CSSProperties; covers: string[]; name: string; sub: string; count: number;
  songs: GameSong[]; progress: ChapterProgress | null;
  onStart: (path: string | null) => void; onSettings: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [focus, setFocus] = useState(0);
  const pick: EntryPick | null = progress ? playTarget(songs, progress) : null;
  const firstTime = !hasFirstFinish();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    track('interactive_ready', { since_launch_ms: sinceLaunch(), screen: 'entry' }, 'interactive_ready');
  }, []);

  const leave = (path: string | null, how: string) => {
    if (leaving) return;
    audioManager.playSfx('tap_nav', 0.5);
    setLeaving(true);
    if (how === 'choose') track('choose_entry_pressed', { from: 'entry_screen' });
    setTimeout(() => onStart(path), 280);
  };
  const play = () => {
    if (!pick || !progress) { leave(null, 'choose'); return; }
    const level = monthStageLevel(PLAYGAMA_MONTH, pick.idx, progress);
    const run = prepareMonthRun(pick.song, {
      month: PLAYGAMA_MONTH, level, idx: pick.idx, cleared: hasClearedSong(pick.song), source: 'entry_screen',
    });
    leave(routeThroughStory(pick.song, run, progress.regular), 'play');
  };
  const actions = [play, () => leave(null, 'choose'), () => { audioManager.playSfx('tap_nav', 0.3); onSettings(); }];
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Keyboard: arrows move, Enter/Space presses. Gamepad: d-pad/stick moves, A or Start presses.
  useEffect(() => {
    buttons.current[0]?.focus({ preventScroll: true });
    const optionsOpen = () => useVaultStore.getState().optionsModalOpen;
    const onKey = (e: KeyboardEvent) => {
      if (optionsOpen()) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); setFocus((f) => Math.min(2, f + 1)); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); setFocus((f) => Math.max(0, f - 1)); }
    };
    window.addEventListener('keydown', onKey);
    let raf = 0;
    let held = true;
    let lastMove = 0;
    const poll = () => {
      const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(Boolean) : null;
      if (gp && !optionsOpen()) {
        const press = gp.buttons[0]?.pressed || gp.buttons[9]?.pressed;
        const any = gp.buttons.some((b) => b.pressed);
        const y = gp.axes[1] ?? 0;
        const down = gp.buttons[13]?.pressed || y > 0.6;
        const up = gp.buttons[12]?.pressed || y < -0.6;
        if (!any && Math.abs(y) < 0.3) held = false;
        const now = performance.now();
        if (!held && (down || up) && now - lastMove > 220) {
          lastMove = now;
          setFocus((f) => (down ? Math.min(2, f + 1) : Math.max(0, f - 1)));
        }
        if (!held && press) {
          held = true;
          const el = document.activeElement as HTMLButtonElement | null;
          const idx = buttons.current.findIndex((b) => b === el);
          actionsRef.current[idx === -1 ? 0 : idx]();
        }
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => { buttons.current[focus]?.focus({ preventScroll: true }); }, [focus]);

  const playSub = pick
    ? `${pick.goal ? 'Replay · ' : ''}Day ${pick.song.day} · ${pick.song.title}${firstTime ? ' · gentle start' : ''}`
    : '';

  return (
    <div className="mt-screen mt-start" data-leaving={leaving || undefined} style={style}>
      <CoverWall covers={covers} className="mt-start-wall" />
      <div className="mt-start-body">
        <img className="mt-start-logo" src={LOGO} alt="PIM: Poetry in Motion" />
        <div className="mt-start-month">
          <b>{name}</b>
          <small>{sub}{count ? ` · ${count} tracks` : ''}</small>
        </div>
        <div className="mt-menu">
          <button ref={(el) => { buttons.current[0] = el; }} type="button" className="mt-play" onClick={actions[0]} onFocus={() => setFocus(0)}
            aria-label={pick ? `Play ${pick.song.title}` : 'Play'}>
            <span className="mt-play-label"><Play size={20} fill="currentColor" /> Play</span>
            {playSub && <small>{playSub}</small>}
          </button>
          <div className="mt-menu-row">
            <button ref={(el) => { buttons.current[1] = el; }} type="button" className="mt-sub" onClick={actions[1]} onFocus={() => setFocus(1)}>
              <ListMusic size={16} /> Choose entry
            </button>
            <button ref={(el) => { buttons.current[2] = el; }} type="button" className="mt-sub" onClick={actions[2]} onFocus={() => setFocus(2)}>
              <Settings size={16} /> Settings
            </button>
          </div>
        </div>
      </div>
      <div className="mt-start-foot">
        © th3scr1b3 · 365 days of light and dark
        {externalLinksAllowed() && (
          <> · <a href="https://th3scr1b3.art" target="_blank" rel="noopener" onPointerDown={(e) => e.stopPropagation()}>th3scr1b3.art</a></>
        )}
        {' · '}<span className="mt-version">v {BUILD_VERSION}</span>
      </div>
    </div>
  );
}
