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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { ArrowDown, ArrowUp, AudioLines, Gamepad2, Pause, Send, Shield, Sword } from 'lucide-react';
import { BeatClock, SECRET_TRACKS } from '../game/secret/chiptune';
import { ShooterLevel } from '../game/secret/shooter';
import { RunnerLevel, SKIES } from '../game/secret/runner';
import { RUNNER_COURSES, RUNNER_STAGES, RUNNER_WHISTLES, parseRunnerStage, type RunnerStage, type RunnerWhistleId } from '../game/secret/runnerCourses';
import {
  drawRunnerSprite, prepareRunnerSprites, readRunnerAppearance, RUNNER_FRAMES, RUNNER_SKINS, runnerEmotes, saveRunnerAppearance,
  type RunnerAppearance, type RunnerPose, type RunnerSkin,
} from '../game/secret/runnerSprites';
import {
  drawWarpIntro, drawWarpReveal, playWarpStinger, prefersReducedMotion,
  INTRO_READY_AT, INTRO_OUTRO_S, INTRO_REVEAL_S, type IntroOptions,
} from '../game/secret/intro';
import { markSecretLevelCleared, type SecretLevelId } from '../game/secret/warp';
import { findRunnerWhistle, readRunnerProgress, runnerArcadePath, runnerMapPath } from '../game/secret/runnerProgress';
import { warpResumePath } from '../game/secret/warpResume';
import type { SecretGame, SecretInput } from '../game/secret/types';
import { drawRunnerHud } from '../game/secret/runnerHud';
import { useRunnerGamepad } from '../game/secret/useRunnerGamepad';
import RunnerLoadout from './RunnerLoadout';
import './SecretRunner.css';

type Phase = 'intro' | 'playing' | 'paused' | 'over';
type LevelResult = { won: boolean; score: number; newWhistle: RunnerWhistleId | null };

const COUNT_IN = 4; // beats of countdown before the level starts
const RUNNER_ACTIONS = [
  { kind: 'taunt', key: 'T', label: 'Taunt', icon: AudioLines, pad: 'taunt' },
  { kind: 'throw', key: 'Z', label: 'Throw', icon: Send, pad: 'throw' },
  { kind: 'block', key: 'C', label: 'Block', icon: Shield, pad: 'block' },
  { kind: 'attack', key: 'X', label: 'Slash', icon: Sword, pad: 'attack' },
] as const;
const TOUCH_MOVEMENT = [
  { kind: 'jump', label: 'Jump', icon: ArrowUp },
  { kind: 'duck', label: 'Slide', icon: ArrowDown },
] as const;

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
  const backTo = hasEntry ? runnerMapPath(stage) : '/warp';
  const pad = useRunnerGamepad(true, pressed => {
    if (pressed.includes('back') || pressed.includes('confirm')) setLocation(backTo);
  });
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#100b27] px-6 text-center text-white font-mono">
      <h1 className="text-3xl font-black">BEAT RUNNER</h1>
      <p className="text-sm text-purple-200">
        {hasEntry ? 'Clear the previous course or open a shortcut with a Warp Whistle.' : 'Hit a warp note during a song to earn the Warp Whistle.'}
      </p>
      <Link href={backTo} className="mt-2 rounded-full bg-fuchsia-500 px-6 py-3 font-bold">
        {hasEntry ? 'WORLD MAP' : 'WARP ZONE'} {pad && <kbd className="runner-pad-key">{pad.back}</kbd>}
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
  const [appearance, setAppearance] = useState(readRunnerAppearance);
  const [previewPose, setPreviewPose] = useState<RunnerPose>('idle');
  const preview = useRef<{ pose: RunnerPose; frame: number } | null>(null);
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
  const [reduced] = useState(prefersReducedMotion);
  const introT0 = useRef(performance.now() - (stepRunner ? INTRO_READY_AT * 1000 : 0));
  const introTime = useRef(stepRunner ? INTRO_READY_AT : 0);
  const [introReady, setIntroReady] = useState(stepRunner);
  const revealIntro = useRef(false);
  const stopStinger = useRef<() => void>(() => {});
  const introOpts = useMemo<IntroOptions>(() => ({
    reduced,
    header: levelId === 'runner' ? [via?.startsWith('warp') ? '★ WARP ZONE ★' : 'BEAT RUNNER', `LEVEL 0${stage}${via?.startsWith('warp') ? ' / SECRET LEVEL FOUND' : ''}`] : undefined,
    runnerSprite: (ctx, pose, frame, x, feet, size) => drawRunnerSprite(ctx, pose, frame, x, feet, size, appearance.skin),
    sky: levelId === 'runner' ? SKIES[stage] : undefined,
    previewPose: previewPose === 'idle' ? undefined : previewPose,
  }), [appearance.skin, levelId, previewPose, reduced, stage, via]);

  const changeAppearance = (next: RunnerAppearance) => {
    saveRunnerAppearance(next);
    setAppearance(next);
    setPreviewPose(next.skin === appearance.skin ? next.emote : 'idle');
  };
  const cycleAppearance = (outfit: boolean) => {
    const skins = Object.keys(RUNNER_SKINS) as RunnerSkin[];
    const skin = outfit ? skins[(skins.indexOf(appearance.skin) + 1) % skins.length] : appearance.skin;
    const emotes = runnerEmotes(skin);
    const emote = outfit ? 'taunt' : emotes[(emotes.indexOf(appearance.emote) + 1) % emotes.length];
    changeAppearance({ skin, emote });
  };

  useEffect(() => {
    if (game instanceof RunnerLevel) game.setAppearance(appearance);
    if (levelId === 'runner') void prepareRunnerSprites(appearance.skin).catch(() => undefined);
  }, [game, appearance, levelId]);

  const send = useCallback((a: SecretInput) => {
    const clock = clockRef.current;
    if (!clock) return;
    gameRef.current?.input(a, stepRunner ? stepBeat.current : clock.beat() - COUNT_IN);
  }, [stepRunner]);

  const start = useCallback(async (controller = false) => {
    if (clockRef.current) return;
    if (phase === 'intro' && !introReady) {
      introT0.current = performance.now() - INTRO_READY_AT * 1000;
      introTime.current = INTRO_READY_AT;
      stopStinger.current();
      setIntroReady(true);
      return;
    }
    stopStinger.current();
    revealIntro.current = phase === 'intro';
    gameRef.current = makeLevel(levelId, stage, result?.won === false);
    if (gameRef.current instanceof RunnerLevel) gameRef.current.setAppearance(appearance);
    stepBeat.current = -COUNT_IN;
    drawnBeat.current = -COUNT_IN;
    processedWhistle.current = false;
    newWhistle.current = null;
    setResult(null);
    const clock = new BeatClock(SECRET_TRACKS[levelId]);
    clockRef.current = clock;
    if (!stepRunner) await clock.start(controller);
    if (clockRef.current === clock) setPhase('playing');
  }, [levelId, result, stage, stepRunner, appearance, phase, introReady]);

  const togglePause = useCallback(() => {
    if (phase === 'playing') {
      clockRef.current?.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      clockRef.current?.resume();
      setPhase('playing');
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'intro' || phase === 'playing' || !(game instanceof RunnerLevel)) {
      preview.current = null;
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let active = true;
    let frame = 0;
    let previousDraw = 0;
    const startedAt = performance.now();
    const drawPreview = () => {
      if (!active) return;
      const { w, h } = canvasFrame(canvas, ctx);
      const elapsed = (performance.now() - startedAt) / 1000;
      const emotes = runnerEmotes(appearance.skin);
      const pose = phase === 'over'
        ? result?.won ? emotes[Math.floor(elapsed / 1.6) % emotes.length] : 'death'
        : previewPose;
      const index = phase === 'over' && !result?.won ? RUNNER_FRAMES - 1 : Math.floor(elapsed * 12.5) % RUNNER_FRAMES;
      preview.current = { pose, frame: index };
      game.draw(ctx, w, h, drawnBeat.current, preview.current);
      if (phase === 'paused') drawRunnerHud(ctx, w, h, game, Math.max(0, drawnBeat.current));
    };
    const animate = (now: number) => {
      if (now - previousDraw >= 80) {
        drawPreview();
        previousDraw = now;
      }
      frame = requestAnimationFrame(animate);
    };
    const observer = new ResizeObserver(drawPreview);
    observer.observe(canvas);
    void prepareRunnerSprites(appearance.skin).then(drawPreview, drawPreview);
    frame = requestAnimationFrame(animate);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [game, phase, appearance, previewPose, result]);

  // PR #271's warp tunnel, title slam and live diorama, with the v5 loadout.
  useEffect(() => {
    if (phase !== 'intro') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const frame = (now: number) => {
      const { w, h } = canvasFrame(canvas, ctx);
      const t = (now - introT0.current) / 1000;
      introTime.current = t;
      preview.current = drawWarpIntro(ctx, w, h, t, levelId, game.title, introOpts);
      if (t >= (reduced ? 0.6 : INTRO_READY_AT)) setIntroReady(true);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game, introOpts, levelId, phase, reduced]);

  useEffect(() => {
    if (stepRunner || phase !== 'intro') return;
    const stop = playWarpStinger(levelId, reduced);
    stopStinger.current = stop;
    return stop;
  }, [levelId, phase, reduced, stepRunner]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const debug = window as DebugWindow;
    const snapshot = () => game instanceof RunnerLevel
      ? JSON.stringify({ phase, ...game.snapshot(drawnBeat.current, canvas.clientWidth, canvas.clientHeight), ...(phase === 'playing' ? {} : preview.current), intro: { ready: introReady, seconds: introTime.current, revealing: revealIntro.current } })
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

      // Use the beat clock for the iris so pausing also freezes the transition.
      if (revealIntro.current && !reduced) {
        const since = (beat + COUNT_IN) * 60 / SECRET_TRACKS[levelId].bpm;
        if (since < INTRO_OUTRO_S) {
          drawWarpIntro(ctx, w, h, introTime.current + since, levelId, game.title, { ...introOpts, outro: since / INTRO_OUTRO_S });
        } else if (since < INTRO_OUTRO_S + INTRO_REVEAL_S) {
          drawWarpReveal(ctx, w, h, (since - INTRO_OUTRO_S) / INTRO_REVEAL_S, since);
        } else revealIntro.current = false;
      } else revealIntro.current = false;

      if (game.done) {
        clockRef.current?.stop();
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
  }, [game, phase, levelId, stage, stepRunner, introOpts, introReady, reduced]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('select, input, textarea')) return;
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
    else setLocation('/songs');
  };

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

  const pad = useRunnerGamepad(levelId === 'runner', pressed => {
    const confirm = pressed.includes('confirm');
    const back = pressed.includes('back');
    const menu = pressed.includes('menu');
    if (phase === 'intro') {
      if (back) leave();
      else if (confirm || menu) void start(true);
      else if (pressed.includes('throw')) cycleAppearance(true);
      else if (pressed.includes('taunt')) cycleAppearance(false);
    } else if (phase === 'paused') {
      if (back) leave();
      else if (confirm || menu) togglePause();
      else if (pressed.includes('throw')) cycleAppearance(true);
      else if (pressed.includes('taunt')) cycleAppearance(false);
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
    else if (pressed.includes('left')) send({ kind: 'left' });
    else if (pressed.includes('right')) send({ kind: 'right' });
    else if (pressed.includes('block')) send({ kind: 'block' });
    else if (pressed.includes('throw')) send({ kind: 'throw' });
    else if (pressed.includes('attack')) send({ kind: 'attack' });
    else if (pressed.includes('taunt')) send({ kind: 'taunt' });
  });

  const actionPress = (kind: 'jump' | 'duck' | 'attack' | 'block' | 'taunt' | 'throw') => ({
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
        <div className="warp-intro absolute inset-0 text-center" onPointerDown={() => { if (!introReady) void start(); }}>
          <h1 className="sr-only">{game.title}</h1>
          <p className="sr-only">{levelId === 'runner' ? `Beat Runner, level ${stage}` : 'Warp zone, secret level found'}</p>
          <div className="warp-intro-card" inert={!introReady} style={{ opacity: introReady ? 1 : 0 }}>
          {levelId === 'runner' && <p className="max-w-md text-base text-violet-100">{RUNNER_COURSES[stage].brief}</p>}
          <p className="max-w-lg text-sm text-zinc-300 font-mono">
            {game.hint}
            {levelId === 'runner' && (
              <span className="mt-1 block text-zinc-300">
                <span className="hidden sm:inline">Press jump again in midair to double jump.</span>
                <span className="sm:hidden">Tap high to jump, again in midair to double jump, or low to slide.</span>
              </span>
            )}
          </p>
          {pad && (
            <p className="runner-pad-legend">
              <Gamepad2 size={17} aria-hidden />
              {pad.confirm} jump · {pad.back} slide · {pad.attack} slash · {pad.throw} throw · {pad.block} block · {pad.taunt} taunt · D-pad ← / → face · {pad.menu} pause
            </p>
          )}
          {levelId === 'runner' && <RunnerLoadout value={appearance} onChange={changeAppearance} controllerHint={pad ? `${pad.throw} outfit · ${pad.taunt} preview next taunt` : undefined} />}
          <button
            id={levelId === 'runner' ? 'runner-start' : undefined}
            onClick={() => void start()}
            className="warp-start mt-2 px-8 py-3 rounded-full font-black font-mono tracking-widest"
            style={{ animationDuration: `${120 / SECRET_TRACKS[levelId].bpm}s` }}
          >
            START
          </button>
          <button onClick={leave} className="text-xs text-zinc-300 font-mono underline">
            {resumePath || songResults ? 'back to the song' : levelId === 'runner' ? 'back to world map' : 'skip'}
          </button>
          </div>
          {!introReady && <span className="absolute bottom-5 right-5 text-xs font-mono tracking-widest text-zinc-300">TAP TO SKIP ▸▸</span>}
        </div>
      )}

      {phase === 'playing' && levelId === 'runner' && (
        <>
          <button className="runner-pause" type="button" onClick={togglePause} aria-label="Pause" aria-keyshortcuts="P Escape">
            <Pause size={18} aria-hidden />
          </button>
          <div className="runner-controls">
            <div className="runner-controls-movement">
              {TOUCH_MOVEMENT.map(({ kind, label, icon: Icon }) => (
                <button type="button" key={kind} className="runner-control" {...actionPress(kind)}>
                  <Icon size={16} aria-hidden /> {label}
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
                  <Icon size={16} aria-hidden /> {label} <kbd className="runner-control-key">{pad?.[padKey] ?? key}</kbd>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {phase === 'paused' && (
        <div className="runner-preview-overlay absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <h2 className="runner-screen-title">Paused</h2>
          <RunnerLoadout value={appearance} onChange={changeAppearance} controllerHint={pad ? `${pad.throw} outfit · ${pad.taunt} preview next taunt` : undefined} />
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={togglePause} className="rounded-full bg-fuchsia-500 px-6 py-3 font-mono font-black">
              Resume {pad && <kbd className="runner-pad-key">{pad.confirm}</kbd>}
            </button>
            <button onClick={leave} className="rounded-full border border-fuchsia-400 px-6 py-3 font-mono font-bold">
              {songResults ? 'Back to the song' : 'World Map'} {pad && <kbd className="runner-pad-key">{pad.back}</kbd>}
            </button>
          </div>
        </div>
      )}

      {phase === 'over' && result && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center ${levelId === 'runner' ? 'runner-preview-overlay' : 'bg-black/80'}`}>
          <div className="text-xs tracking-[0.4em] font-mono text-fuchsia-300">{game.title}</div>
          <h2 className={levelId === 'runner' ? 'runner-screen-title' : 'text-4xl sm:text-5xl font-black font-mono'} style={{ color: result.won ? '#7CFFCB' : '#FF3B6B' }}>
            {result.won ? 'LEVEL CLEAR' : 'SIGNAL LOST'}
          </h2>
          <div className="text-2xl font-mono">{result.score.toLocaleString()}</div>
          {result.newWhistle && <p className="flex items-center gap-2 text-sm font-bold text-amber-200"><AudioLines size={17} aria-hidden /> {RUNNER_WHISTLES[result.newWhistle].name} found</p>}
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            <button
              onClick={() => void start()}
              className="px-6 py-3 rounded-full border border-fuchsia-400 font-black font-mono tracking-widest"
            >
              RETRY
              {pad && <kbd className="runner-pad-key">{result.won ? pad.attack : `${pad.confirm} / ${pad.attack}`}</kbd>}
            </button>
            {levelId === 'runner' && nextCourse && result.won && (
              <button onClick={nextStage} className="px-6 py-3 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 font-black font-mono tracking-widest">
                NEXT LEVEL
                {pad && <kbd className="runner-pad-key">{pad.confirm}</kbd>}
              </button>
            )}
            <button
              onClick={leave}
              className={`px-6 py-3 rounded-full font-black font-mono tracking-widest ${levelId === 'runner' && nextCourse && result.won ? 'border border-fuchsia-400' : 'bg-fuchsia-500 hover:bg-fuchsia-400'}`}
            >
              {resumePath ? 'RESUME SONG' : songResults || levelId === 'shooter' ? 'CONTINUE' : 'WORLD MAP'}
              {pad && <kbd className="runner-pad-key">{result.won && !nextCourse ? `${pad.confirm} / ${pad.back}` : pad.back}</kbd>}
            </button>
          </div>
          {levelId === 'runner' && songResults && (
            <Link href={runnerMapPath(mapStage)} className="text-sm text-fuchsia-200 underline">World Map</Link>
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
