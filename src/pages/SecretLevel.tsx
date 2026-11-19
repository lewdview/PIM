/**
 * SecretLevel — the hidden levels opened by warp notes.
 *
 *   /secret/shooter?from=<songId>&via=warp        SIGNAL SIEGE (instant warp;
 *                                                  the song resumes afterwards)
 *   /secret/runner?from=<songId>&via=warp-clear   ROOFTOP RUN  (warp on clear)
 *
 * Owns the canvas loop, input and music; the levels themselves live in
 * src/game/secret/.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { ArrowDown, ArrowUp, AudioLines, Gamepad2, Pause, Shield, Sword } from 'lucide-react';
import { BeatClock, SECRET_TRACKS } from '../game/secret/chiptune';
import { ShooterLevel } from '../game/secret/shooter';
import { RunnerLevel, SKIES } from '../game/secret/runner';
import { RUNNER_COURSES, RUNNER_STAGES, RUNNER_WHISTLES, parseRunnerStage, type RunnerStage, type RunnerWhistleId } from '../game/secret/runnerCourses';
import { drawRunnerSprite, prepareRunnerSprites } from '../game/secret/runnerSprites';
import {
  drawWarpIntro, drawWarpReveal, playWarpStinger, prefersReducedMotion,
  INTRO_LOOKS, INTRO_OUTRO_S, INTRO_READY_AT, INTRO_REVEAL_S, type IntroOptions,
} from '../game/secret/intro';
import { sendGameplayMessage } from '@/platform';
import { PLAYGAMA_MONTH } from '@/platform/playgama/month';
import { markSecretLevelCleared, type SecretLevelId } from '../game/secret/warp';
import { findRunnerWhistle, readRunnerProgress, runnerArcadePath, runnerMapPath } from '../game/secret/runnerProgress';
import { warpResumePath } from '../game/secret/warpResume';
import type { SecretGame, SecretInput } from '../game/secret/types';
import { drawRunnerHud } from '../game/secret/runnerHud';
import { useRunnerGamepad } from '../game/secret/useRunnerGamepad';
import './SecretRunner.css';
import { t, t as tr } from '@/i18n';

type Phase = 'intro' | 'playing' | 'paused' | 'over';
type LevelResult = { won: boolean; score: number; newWhistle: RunnerWhistleId | null };

const COUNT_IN = 4; // beats of countdown before the level starts
const RUNNER_ACTIONS = [
  { kind: 'taunt', key: 'T', label: 'Taunt', icon: AudioLines, pad: 'taunt' },
  { kind: 'block', key: 'C', label: 'Block', icon: Shield, pad: 'block' },
  { kind: 'attack', key: 'X', label: 'Slash', icon: Sword, pad: 'attack' },
] as const;
const TOUCH_MOVEMENT = [
  { kind: 'jump', label: 'Jump', icon: ArrowUp },
  { kind: 'duck', label: 'Slide', icon: ArrowDown },
] as const;

const STICK = 0.5; // stick deflection that counts as a press

type PadAction = SecretInput['kind'] | 'start' | 'back' | 'retry' | 'next';

/** Which actions the first connected gamepad is holding right now (standard mapping). */
function readPad(level: SecretLevelId): Set<PadAction> | null {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp: Gamepad | null = null;
  for (const g of pads) if (g) { gp = g; break; }
  if (!gp) return null;
  const b = (i: number) => !!gp!.buttons[i]?.pressed;
  const ax = gp.axes[0] ?? 0;
  const ay = gp.axes[1] ?? 0;
  const held = new Set<PadAction>();
  if (level === 'runner') {
    // Ⓐ / ↑ jump (press again in midair to double jump), Ⓑ / ↓ slide, Ⓧ / RT slash, LB / RB / LT block, Ⓨ taunt
    if (b(0) || b(12) || ay < -STICK) held.add('jump');
    if (b(1) || b(13) || ay > STICK) held.add('duck');
    if (b(2) || b(7)) held.add('attack');
    if (b(4) || b(5) || b(6)) held.add('block');
    if (b(3)) held.add('taunt');
  } else {
    if (b(14) || ax < -STICK) held.add('left');
    if (b(15) || ax > STICK) held.add('right');
    if (b(0) || b(2) || b(5) || b(7)) held.add('fire');
  }
  if (b(0) || b(9)) held.add('start');
  if (b(1) || b(8)) held.add('back');
  if (b(3)) held.add('retry');
  if (b(2)) held.add('next');
  return held;
}

function makeLevel(id: SecretLevelId, stage: RunnerStage, recovering = false): SecretGame {
  return id === 'runner' ? new RunnerLevel(stage, recovering) : new ShooterLevel();
}

function canvasFrame(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

export default function SecretLevel() {
  const params = useParams<{ level: string }>();
  const levelId: SecretLevelId = params.level === 'runner' ? 'runner' : 'shooter';
  const query = new URLSearchParams(useSearch());
  const stage = parseRunnerStage(query.get('stage')) ?? 1;
  const progress = levelId === 'runner' ? readRunnerProgress() : null;
  if (progress && !progress.available.includes(stage)) {
    return <RunnerGate hasEntry={progress.hasEntry} stage={stage} />;
  }
  return <SecretLevelGame key={`${levelId}:${stage}`} levelId={levelId} stage={stage} query={query} />;
}

function RunnerGate({ hasEntry, stage }: { hasEntry: boolean; stage: RunnerStage }) {
  const [, setLocation] = useLocation();
  const backTo = hasEntry ? runnerMapPath(stage) : PLAYGAMA_MONTH > 0 ? `/chapter/${PLAYGAMA_MONTH}` : '/warp';
  const pad = useRunnerGamepad(true, pressed => {
    if (pressed.includes('back') || pressed.includes('confirm')) setLocation(backTo);
  });
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#100b27] px-6 text-center text-white font-mono">
      <h1 className="text-3xl font-black">BEAT RUNNER</h1>
      <p className="text-sm text-purple-200">
        {t(hasEntry ? 'Clear the previous course or open a shortcut with a Warp Whistle.' : 'Hit a warp note during a song to earn the Warp Whistle.')}
      </p>
      <Link href={backTo} className="mt-2 rounded-full bg-fuchsia-500 px-6 py-3 font-bold">
        {t(hasEntry ? 'WORLD MAP' : PLAYGAMA_MONTH > 0 ? 'CHAPTER' : 'WARP ZONE')} {pad && <kbd className="runner-pad-key">{pad.back}</kbd>}
      </Link>
    </div>
  );
}

type DebugWindow = Window & { render_game_to_text?: () => string; advanceTime?: (ms: number) => void };

function SecretLevelGame({ levelId, stage, query }: { levelId: SecretLevelId; stage: RunnerStage; query: URLSearchParams }) {
  const [location, setLocation] = useLocation();
  const fromSong = query.get('from');
  const via = query.get('via');
  const stepRunner = import.meta.env.DEV && levelId === 'runner' && query.get('step') === '1';
  // An instant warp left the song mid-transmission: send the player back into it
  const [resumePath] = useState(() => (via === 'warp' && fromSong ? warpResumePath(fromSong) : null));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SecretGame | null>(null);
  const game = gameRef.current ?? (gameRef.current = makeLevel(levelId, stage));
  const clockRef = useRef<BeatClock | null>(null);
  const stepBeat = useRef(-COUNT_IN);
  const drawnBeat = useRef(-COUNT_IN);
  const rafRef = useRef(0);
  const processedWhistle = useRef(false);
  const newWhistle = useRef<RunnerWhistleId | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [result, setResult] = useState<LevelResult | null>(null);
  const nextCourse = RUNNER_STAGES[RUNNER_STAGES.indexOf(stage) + 1];
  const [padConnected, setPadConnected] = useState(false);
  // Motion intro: clock origin (ms), whether the START card is up, and when START was pressed.
  // The step-through test harness skips straight to the card.
  const [reduced] = useState(prefersReducedMotion);
  const introT0Ref = useRef(performance.now());
  const [introReady, setIntroReady] = useState(stepRunner);
  const outroAtRef = useRef<number | null>(null);
  const [introOpts] = useState<IntroOptions>(() => ({
    reduced,
    header: levelId === 'runner' && (!via || via === 'arcade') ? ['BEAT RUNNER', t('LEVEL {n}', { n: `0${stage}` })] : undefined,
    runnerSprite: drawRunnerSprite,
    sky: levelId === 'runner' ? SKIES[stage] : undefined,
  }));

  const send = useCallback((a: SecretInput) => {
    const clock = clockRef.current;
    if (!clock) return;
    gameRef.current?.input(a, stepRunner ? stepBeat.current : clock.beat() - COUNT_IN);
  }, [stepRunner]);

  const start = useCallback(async (controller = false) => {
    if (clockRef.current) return;
    // Before the card is up, the first press only fast-forwards the intro
    if (phase === 'intro' && !introReady) {
      introT0Ref.current = performance.now() - INTRO_READY_AT * 1000;
      setIntroReady(true);
      return;
    }
    outroAtRef.current = phase === 'intro' && !stepRunner ? performance.now() : null;
    gameRef.current = makeLevel(levelId, stage, result?.won === false);
    stepBeat.current = -COUNT_IN;
    drawnBeat.current = -COUNT_IN;
    processedWhistle.current = false;
    newWhistle.current = null;
    setResult(null);
    const clock = new BeatClock(SECRET_TRACKS[levelId]);
    clockRef.current = clock;
    if (!stepRunner) await clock.start(controller);
    if (clockRef.current === clock) {
      sendGameplayMessage('gameplay_started');
      setPhase('playing');
    }
  }, [levelId, result, stage, stepRunner, phase, introReady]);

  const togglePause = useCallback(() => {
    if (phase === 'playing') {
      clockRef.current?.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      clockRef.current?.resume();
      setPhase('playing');
    }
  }, [phase]);

  // Intro loop: tunnel → flash → title slam → level diorama, then the START card
  useEffect(() => {
    if (phase !== 'intro') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (levelId === 'runner') void prepareRunnerSprites().catch(() => undefined);
    let raf = 0;
    const frame = (now: number) => {
      const { w, h } = canvasFrame(canvas, ctx);
      const t = (now - introT0Ref.current) / 1000;
      drawWarpIntro(ctx, w, h, t, levelId, tr(game.title), introOpts);
      if (t >= (reduced ? 0.6 : INTRO_READY_AT)) setIntroReady(true);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game, levelId, phase, reduced, introOpts]);

  // Stinger plays once, in time with the intro
  useEffect(() => {
    if (stepRunner) return;
    return playWarpStinger(levelId, reduced);
  }, [levelId, reduced, stepRunner]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const debug = window as DebugWindow;
    const snapshot = () => game instanceof RunnerLevel
      ? JSON.stringify({ phase, ...game.snapshot(drawnBeat.current, canvas.clientWidth, canvas.clientHeight) })
      : '';
    const currentBeat = () => stepRunner ? stepBeat.current : (clockRef.current?.beat() ?? 0) - COUNT_IN;
    if (import.meta.env.DEV && game instanceof RunnerLevel) debug.render_game_to_text = snapshot;
    if (phase !== 'playing') {
      return () => { if (debug.render_game_to_text === snapshot) delete debug.render_game_to_text; };
    }
    let last = performance.now();
    const drawFrame = (beat: number, dt: number) => {
      drawnBeat.current = beat;
      if (beat >= 0) game.update(beat, dt);
      if (game instanceof RunnerLevel && game.foundWhistle && !processedWhistle.current) {
        processedWhistle.current = true;
        if (findRunnerWhistle(game.foundWhistle)) newWhistle.current = game.foundWhistle;
      }
      const { w, h } = canvasFrame(canvas, ctx);
      game.draw(ctx, w, h, beat);
      if (game instanceof RunnerLevel) drawRunnerHud(ctx, w, h, game, beat);
      else drawHud(ctx, w, h, game, beat);

      // Leaving the intro: the card collapses into the tunnel, then the level irises open
      const outroAt = outroAtRef.current;
      if (outroAt !== null && !reduced) {
        const now = performance.now();
        const since = (now - outroAt) / 1000;
        if (since < INTRO_OUTRO_S) {
          drawWarpIntro(ctx, w, h, (now - introT0Ref.current) / 1000, levelId, tr(game.title), { ...introOpts, outro: since / INTRO_OUTRO_S });
        } else if (since < INTRO_OUTRO_S + INTRO_REVEAL_S) {
          drawWarpReveal(ctx, w, h, (since - INTRO_OUTRO_S) / INTRO_REVEAL_S, now / 1000);
        } else {
          outroAtRef.current = null;
        }
      }

      if (game.done) {
        clockRef.current?.stop();
        sendGameplayMessage('gameplay_stopped');
        clockRef.current = null;
        if (game.won) markSecretLevelCleared(levelId === 'runner' ? RUNNER_COURSES[stage].clearId : levelId, game.score);
        setResult({ won: game.won, score: game.score, newWhistle: newWhistle.current });
        setPhase('over');
      }
    };
    const frame = (now: number) => {
      drawFrame(currentBeat(), Math.min(0.05, (now - last) / 1000));
      last = now;
      if (!game.done) rafRef.current = requestAnimationFrame(frame);
    };
    const advanceTime = (ms: number) => {
      const frames = Math.min(600, Math.max(1, Math.round(ms / (1000 / 60))));
      for (let i = 0; i < frames && !game.done; i++) {
        stepBeat.current += SECRET_TRACKS.runner.bpm / 3600;
        drawFrame(stepBeat.current, 1 / 60);
      }
    };
    if (stepRunner) {
      debug.advanceTime = advanceTime;
      drawFrame(stepBeat.current, 0);
    } else {
      rafRef.current = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (debug.render_game_to_text === snapshot) delete debug.render_game_to_text;
      if (debug.advanceTime === advanceTime) delete debug.advanceTime;
    };
  }, [game, phase, levelId, stage, stepRunner, reduced, introOpts]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (levelId === 'runner' && (k.toLowerCase() === 'p' || (k === 'Escape' && !document.fullscreenElement))) {
        if (phase === 'playing' || phase === 'paused') {
          e.preventDefault();
          togglePause();
        }
        return;
      }
      if (k.toLowerCase() === 'f' && levelId === 'runner') {
        const toggle = document.fullscreenElement
          ? document.exitFullscreen()
          : canvasRef.current?.parentElement?.requestFullscreen?.();
        void toggle?.catch(() => undefined);
        return;
      }
      let a: SecretInput['kind'] | null = null;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') a = 'left';
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') a = 'right';
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') a = 'jump';
      else if (k === 'ArrowDown' || k === 's' || k === 'S') a = 'duck';
      else if (k === ' ' || k === 'Enter') a = 'fire';
      else if (levelId === 'runner') a = RUNNER_ACTIONS.find(action => action.key === k.toUpperCase())?.kind ?? null;
      if (!a) return;
      if (a === 'fire' && e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (phase === 'intro' && (a === 'fire' || a === 'jump')) {
        void start();
        return;
      }
      if (phase === 'playing') {
        if (e.isTrusted) void clockRef.current?.unlockSound();
        send({ kind: a } as SecretInput);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [levelId, phase, send, start, togglePause]);

  // Gamepad: see readPad for the in-level buttons. On the menus Ⓐ or Start starts and
  // continues, Ⓧ goes to the next course, Ⓨ retries, Ⓑ or Select leaves.
  const leaveRef = useRef<() => void>(() => {});
  const nextRef = useRef<() => void>(() => {});
  useEffect(() => {
    // Beat Runner reads the controller through useRunnerGamepad below.
    if (levelId === 'runner') return;
    let raf = 0;
    let prev = new Set<PadAction>();
    let connected = false;
    const poll = () => {
      const held = readPad(levelId);
      if (!!held !== connected) {
        connected = !!held;
        setPadConnected(connected);
      }
      if (held) {
        const pressed = (a: PadAction) => held.has(a) && !prev.has(a);
        if (phase === 'playing') {
          (['left', 'right', 'jump', 'duck', 'fire', 'attack', 'block', 'taunt'] as const).forEach((a) => {
            if (pressed(a)) send({ kind: a });
          });
        } else if (phase === 'intro') {
          if (pressed('start')) void start();
          else if (pressed('back')) leaveRef.current();
        } else if (phase === 'over') {
          if (pressed('retry')) void start();
          else if (pressed('next')) nextRef.current();
          else if (pressed('start') || pressed('back')) leaveRef.current();
        }
        prev = held;
      } else {
        prev = new Set();
      }
      raf = requestAnimationFrame(poll);
    };
    // Buttons held while the menu changes phase must be let go before they count again.
    prev = readPad(levelId) ?? new Set();
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [levelId, phase, send, start]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    clockRef.current?.stop();
    clockRef.current = null;
  }, []);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing' || (levelId === 'runner' && e.button !== 0)) return;
    const r = e.currentTarget.getBoundingClientRect();
    send({ kind: 'pointer', x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
  };

  const mapStage = result?.newWhistle ? RUNNER_WHISTLES[result.newWhistle].to : result?.won ? nextCourse ?? stage : stage;
  const songResults = via && fromSong && hasResult(fromSong) ? `/results/${fromSong}` : null;
  const leave = () => {
    clockRef.current?.stop();
    if (resumePath) setLocation(resumePath);
    else if (songResults) setLocation(songResults);
    else if (levelId === 'runner') setLocation(runnerMapPath(mapStage));
    // The monthly Playgama build has no song list: otherwise return to the chapter.
    else setLocation(PLAYGAMA_MONTH > 0 ? `/chapter/${PLAYGAMA_MONTH}` : '/songs');
  };
  leaveRef.current = leave;

  const nextStage = () => {
    if (!nextCourse) return;
    if (!fromSong || !via) {
      setLocation(runnerArcadePath(nextCourse) + (stepRunner ? '&step=1' : ''));
      return;
    }
    const next = new URLSearchParams(query);
    next.set('stage', String(nextCourse));
    setLocation(`${location}?${next}`);
  };
  nextRef.current = () => { if (result?.won && nextCourse) nextStage(); };

  const pad = useRunnerGamepad(levelId === 'runner', pressed => {
    const confirm = pressed.includes('confirm');
    const back = pressed.includes('back');
    const menu = pressed.includes('menu');
    if (phase === 'intro') {
      if (back) leave();
      else if (confirm || menu) void start(true);
    } else if (phase === 'paused') {
      if (back) leave();
      else if (confirm || menu) togglePause();
    } else if (phase === 'over') {
      if (back) leave();
      else if (pressed.includes('attack')) void start(true);
      else if (confirm || menu) {
        if (result?.won && nextCourse) nextStage();
        else if (result?.won) leave();
        else void start(true);
      }
    } else if (menu) togglePause();
    else if (confirm || pressed.includes('up')) send({ kind: 'jump' });
    else if (back || pressed.includes('down')) send({ kind: 'duck' });
    else if (pressed.includes('block')) send({ kind: 'block' });
    else if (pressed.includes('attack')) send({ kind: 'attack' });
    else if (pressed.includes('taunt')) send({ kind: 'taunt' });
  });

  const actionPress = (kind: 'jump' | 'duck' | 'attack' | 'block' | 'taunt') => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      send({ kind });
    },
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) send({ kind }); // Keyboard and assistive technology activation.
    },
  });

  return (
    <div
      className="fixed inset-0 bg-black text-white select-none"
      style={{ touchAction: 'none' }}
      onPointerDownCapture={(event) => {
        if (event.isTrusted && phase === 'playing') void clockRef.current?.unlockSound();
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={onPointer}
      />

      {phase === 'intro' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-end gap-4 px-6 text-center"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8dvh)' }}
          onPointerDown={() => { if (!introReady) void start(); }}
        >
          {/* The title is drawn on the canvas; this keeps it readable for screen readers */}
          <h1 className="sr-only">
            {levelId === 'runner' && (!via || via === 'arcade') ? t('Beat Runner level {n}', { n: stage }) : t('Warp zone, secret level found')}: {t(game.title)}
          </h1>
          <div
            className="flex flex-col items-center gap-3 transition-all duration-500 ease-out"
            style={{
              opacity: introReady ? 1 : 0,
              transform: introReady ? 'translateY(0)' : 'translateY(16px)',
              pointerEvents: introReady ? 'auto' : 'none',
            }}
          >
            <div
              className="max-w-md rounded-xl border px-4 py-2.5 font-mono"
              style={{ background: 'rgba(5,1,15,0.72)', borderColor: `${INTRO_LOOKS[levelId].accent}55` }}
            >
              {levelId === 'runner' && <p className="mb-1 text-sm text-violet-100">{t(RUNNER_COURSES[stage].brief)}</p>}
              <p className="text-xs sm:text-sm text-zinc-300">
                {t(game.hint)}
                {levelId === 'runner' && (
                  <span className="mt-1 block text-zinc-400">
                    <span className="hidden sm:inline">{t('Press jump again in midair to double jump.')}</span>
                    <span className="sm:hidden">{t('Tap high to jump, again in midair to double jump, or low to slide.')}</span>
                  </span>
                )}
              </p>
            </div>
            {levelId === 'runner' ? pad && (
              <p className="runner-pad-legend">
                <Gamepad2 size={17} aria-hidden />
                {pad.confirm} {t('jump')} · {pad.back} {t('slide')} · {pad.attack} {t('slash')} · {pad.block} {t('block')} · {pad.taunt} {t('taunt')} · {pad.menu} {t('pause')}
              </p>
            ) : padConnected && <p className="max-w-md text-xs text-fuchsia-200 font-mono">{t(game.padHint)}</p>}
            <button
              id={levelId === 'runner' ? 'runner-start' : undefined}
              onClick={() => void start()}
              className="warp-start mt-1 px-10 py-3 rounded-full font-black font-mono tracking-[0.3em] text-white"
              style={{
                background: `linear-gradient(90deg, ${INTRO_LOOKS[levelId].accent2}, ${INTRO_LOOKS[levelId].accent})`,
                boxShadow: `0 0 24px ${INTRO_LOOKS[levelId].accent}`,
              }}
            >
              {t('START')}
            </button>
            <button onClick={leave} className="text-xs text-zinc-300 font-mono underline">
              {t(resumePath || songResults ? 'back to the song' : levelId === 'runner' ? 'back to world map' : 'skip')}
            </button>
            {levelId === 'runner'
              ? pad && <div className="text-xs text-zinc-400 font-mono">{pad.confirm} {t('start')} · {pad.back} {t('back')}</div>
              : padConnected && <div className="text-xs text-zinc-400 font-mono">Ⓐ {t('start')} · Ⓑ {t('back')}</div>}
          </div>
          {!introReady && (
            <div className="absolute bottom-4 right-4 text-[10px] tracking-[0.3em] text-zinc-400 font-mono">{t('TAP TO SKIP')} ▸▸</div>
          )}
          <style>{`
            @keyframes warpStartPulse { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.06); filter: brightness(1.25); } }
            .warp-start { animation: warpStartPulse ${(60 / SECRET_TRACKS[levelId].bpm) * 2}s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .warp-start { animation: none; } }
          `}</style>
        </div>
      )}

      {phase === 'playing' && levelId === 'runner' && (
        <>
          <button className="runner-pause" type="button" onClick={togglePause} aria-label={t('Pause')} aria-keyshortcuts="P Escape">
            <Pause size={18} aria-hidden />
          </button>
          <div className="runner-controls">
            <div className="runner-controls-movement">
              {TOUCH_MOVEMENT.map(({ kind, label, icon: Icon }) => (
                <button type="button" key={kind} className="runner-control" {...actionPress(kind)}>
                  <Icon size={16} aria-hidden /> {t(label)}
                </button>
              ))}
            </div>
            <div className="runner-controls-actions">
              {RUNNER_ACTIONS.map(({ kind, key, label, icon: Icon, pad: padKey }) => (
                <button
                  type="button"
                  key={kind}
                  aria-keyshortcuts={key}
                  className={`runner-control runner-control--${kind}`}
                  {...actionPress(kind)}
                >
                  <Icon size={16} aria-hidden /> {t(label)} <kbd className="runner-control-key">{pad?.[padKey] ?? key}</kbd>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {phase === 'paused' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#0b0916]/85 px-6 text-center">
          <h2 className="runner-screen-title">{t('Paused')}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={togglePause} className="rounded-full bg-fuchsia-500 px-6 py-3 font-mono font-black">
              {t('Resume')} {pad && <kbd className="runner-pad-key">{pad.confirm}</kbd>}
            </button>
            <button onClick={leave} className="rounded-full border border-fuchsia-400 px-6 py-3 font-mono font-bold">
              {t(songResults ? 'Back to the song' : 'World Map')} {pad && <kbd className="runner-pad-key">{pad.back}</kbd>}
            </button>
          </div>
        </div>
      )}

      {phase === 'over' && result && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black/80">
          <div className="text-xs tracking-[0.4em] font-mono text-fuchsia-300">{t(game.title)}</div>
          <h2 className={levelId === 'runner' ? 'runner-screen-title' : 'text-4xl sm:text-5xl font-black font-mono'} style={{ color: result.won ? '#7CFFCB' : '#FF3B6B' }}>
            {t(result.won ? 'LEVEL CLEAR' : 'SIGNAL LOST')}
          </h2>
          <div className="text-2xl font-mono">{result.score.toLocaleString()}</div>
          {result.newWhistle && <p className="flex items-center gap-2 text-sm font-bold text-amber-200"><AudioLines size={17} aria-hidden /> {t('{name} found', { name: t(RUNNER_WHISTLES[result.newWhistle].name) })}</p>}
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            <button
              onClick={() => void start()}
              className="px-6 py-3 rounded-full border border-fuchsia-400 font-black font-mono tracking-widest"
            >
              {t('RETRY')}
              {pad && <kbd className="runner-pad-key">{result.won ? pad.attack : `${pad.confirm} / ${pad.attack}`}</kbd>}
            </button>
            {levelId === 'runner' && nextCourse && result.won && (
              <button onClick={nextStage} className="px-6 py-3 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 font-black font-mono tracking-widest">
                {t('NEXT LEVEL')}
                {pad && <kbd className="runner-pad-key">{pad.confirm}</kbd>}
              </button>
            )}
            <button
              onClick={leave}
              className={`px-6 py-3 rounded-full font-black font-mono tracking-widest ${levelId === 'runner' && nextCourse && result.won ? 'border border-fuchsia-400' : 'bg-fuchsia-500 hover:bg-fuchsia-400'}`}
            >
              {t(resumePath ? 'RESUME SONG' : songResults || levelId === 'shooter' ? 'CONTINUE' : 'WORLD MAP')}
              {pad && <kbd className="runner-pad-key">{result.won && !nextCourse ? `${pad.confirm} / ${pad.back}` : pad.back}</kbd>}
            </button>
          </div>
          {levelId !== 'runner' && padConnected && (
            <div className="text-xs text-zinc-400 font-mono">
              Ⓨ {t('retry')} · Ⓐ {t('continue')}
            </div>
          )}
          {levelId === 'runner' && songResults && (
            <Link href={runnerMapPath(mapStage)} className="text-sm text-fuchsia-200 underline">{t('World Map')}</Link>
          )}
        </div>
      )}
    </div>
  );
}

function hasResult(songId: string): boolean {
  try {
    return sessionStorage.getItem(`result_${songId}`) !== null;
  } catch {
    return false;
  }
}

function drawHud(ctx: CanvasRenderingContext2D, w: number, _h: number, game: SecretGame, beat: number) {
  ctx.save();
  ctx.font = '900 16px "Space Mono", monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(game.score.toLocaleString(), 16, 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FF3B6B';
  ctx.fillText('♥'.repeat(Math.max(0, game.lives)), w - 16, 16);
  // Progress along the level
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(16, 42, w - 32, 4);
  ctx.fillStyle = '#B967FF';
  ctx.fillRect(16, 42, (w - 32) * Math.max(0, Math.min(1, beat / game.totalBeats)), 4);
  if (beat < 0) {
    const n = Math.ceil(-beat);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 72px "Space Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 1 - ((-beat) % 1) * 0.6;
    ctx.fillText(n > 0 ? String(n) : 'GO', w / 2, _h * 0.45);
  }
  ctx.restore();
}
