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
import { AudioLines, Shield, Sword } from 'lucide-react';
import { BeatClock, SECRET_TRACKS } from '../game/secret/chiptune';
import { ShooterLevel } from '../game/secret/shooter';
import { RunnerLevel } from '../game/secret/runner';
import { RUNNER_COURSES, RUNNER_STAGES, RUNNER_WHISTLES, parseRunnerStage, type RunnerStage, type RunnerWhistleId } from '../game/secret/runnerCourses';
import { prepareRunnerSprites } from '../game/secret/runnerSprites';
import { markSecretLevelCleared, type SecretLevelId } from '../game/secret/warp';
import { findRunnerWhistle, readRunnerProgress, runnerArcadePath, runnerMapPath } from '../game/secret/runnerProgress';
import { warpResumePath } from '../game/secret/warpResume';
import type { SecretGame, SecretInput } from '../game/secret/types';

type Phase = 'intro' | 'playing' | 'over';
type LevelResult = { won: boolean; score: number; newWhistle: RunnerWhistleId | null };

const COUNT_IN = 4; // beats of countdown before the level starts
const RUNNER_ACTIONS = [
  { kind: 'taunt', key: 'T', label: 'Taunt', icon: AudioLines },
  { kind: 'block', key: 'C', label: 'Block', icon: Shield },
  { kind: 'attack', key: 'X', label: 'Slash', icon: Sword },
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
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#100b27] px-6 text-center text-white font-mono">
        <h1 className="text-3xl font-black">BEAT RUNNER</h1>
        <p className="text-sm text-purple-200">
          {progress.hasEntry ? 'Clear the previous course or open a shortcut with a Warp Whistle.' : 'Hit a warp note during a song to earn the Warp Whistle.'}
        </p>
        <Link href={progress.hasEntry ? runnerMapPath(stage) : '/warp'} className="mt-2 rounded-full bg-fuchsia-500 px-6 py-3 font-bold">
          {progress.hasEntry ? 'WORLD MAP' : 'WARP ZONE'}
        </Link>
      </div>
    );
  }
  return <SecretLevelGame key={`${levelId}:${stage}`} levelId={levelId} stage={stage} query={query} />;
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
  const [phase, setPhase] = useState<Phase>('intro');
  const [result, setResult] = useState<LevelResult | null>(null);
  const nextCourse = RUNNER_STAGES[RUNNER_STAGES.indexOf(stage) + 1];

  const send = useCallback((a: SecretInput) => {
    const clock = clockRef.current;
    if (!clock) return;
    gameRef.current?.input(a, stepRunner ? stepBeat.current : clock.beat() - COUNT_IN);
  }, [stepRunner]);

  const start = useCallback(async () => {
    if (clockRef.current) return;
    gameRef.current = makeLevel(levelId, stage, result?.won === false);
    stepBeat.current = -COUNT_IN;
    drawnBeat.current = -COUNT_IN;
    setResult(null);
    const clock = new BeatClock(SECRET_TRACKS[levelId]);
    clockRef.current = clock;
    if (!stepRunner) await clock.start();
    if (clockRef.current === clock) setPhase('playing');
  }, [levelId, result, stage, stepRunner]);

  useEffect(() => {
    if (phase !== 'intro' || levelId !== 'runner') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let active = true;
    const drawPreview = () => {
      if (!active) return;
      const { w, h } = canvasFrame(canvas, ctx);
      game.draw(ctx, w, h, -COUNT_IN);
    };
    const observer = new ResizeObserver(drawPreview);
    observer.observe(canvas);
    void prepareRunnerSprites().then(drawPreview, drawPreview);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [game, levelId, phase]);

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
    let processedWhistle = false;
    let newWhistle: RunnerWhistleId | null = null;
    const drawFrame = (beat: number, dt: number) => {
      drawnBeat.current = beat;
      if (beat >= 0) game.update(beat, dt);
      if (game instanceof RunnerLevel && game.foundWhistle && !processedWhistle) {
        processedWhistle = true;
        if (findRunnerWhistle(game.foundWhistle)) newWhistle = game.foundWhistle;
      }
      const { w, h } = canvasFrame(canvas, ctx);
      game.draw(ctx, w, h, beat);
      drawHud(ctx, w, h, game, beat);

      if (game.done) {
        clockRef.current?.stop();
        clockRef.current = null;
        if (game.won) markSecretLevelCleared(levelId === 'runner' ? RUNNER_COURSES[stage].clearId : levelId, game.score);
        setResult({ won: game.won, score: game.score, newWhistle });
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
  }, [game, phase, levelId, stage, stepRunner]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
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
      if (phase === 'playing') send({ kind: a } as SecretInput);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [levelId, phase, send, start]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    clockRef.current?.stop();
    clockRef.current = null;
  }, []);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing') return;
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

  return (
    <div className="fixed inset-0 bg-black text-white select-none" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={onPointer}
      />

      {phase === 'intro' && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center ${levelId === 'runner' ? 'bg-gradient-to-b from-[#0c071a]/90 via-[#0c071a]/75 to-[#0c071a]/15 pb-[10dvh]' : 'bg-black/80'}`}>
          <div className="text-xs tracking-[0.24em] text-fuchsia-300 font-mono">
            {levelId === 'runner' ? `BEAT RUNNER / LEVEL 0${stage}` : '★ WARP ZONE ★ SECRET LEVEL FOUND'}
          </div>
          <h1 className="text-4xl sm:text-6xl font-black font-mono" style={{ textShadow: '0 0 24px #B967FF' }}>
            {game.title}
          </h1>
          {levelId === 'runner' && <p className="max-w-md text-base text-violet-100">{RUNNER_COURSES[stage].brief}</p>}
          <p className="max-w-md text-sm text-zinc-300 font-mono">
            {game.hint}
            {levelId === 'runner' && (
              <span className="mt-1 block text-zinc-300">
                <span className="hidden sm:inline">Press jump again in midair to double jump.</span>
                <span className="sm:hidden">Tap high to jump, again in midair to double jump, or low to slide.</span>
              </span>
            )}
          </p>
          <button
            id={levelId === 'runner' ? 'runner-start' : undefined}
            onClick={() => void start()}
            className="mt-2 px-8 py-3 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 font-black font-mono tracking-widest"
          >
            START
          </button>
          <button onClick={leave} className="text-xs text-zinc-300 font-mono underline">
            {resumePath || songResults ? 'back to the song' : levelId === 'runner' ? 'back to world map' : 'skip'}
          </button>
        </div>
      )}

      {phase === 'playing' && levelId === 'runner' && (
        <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] flex gap-1.5 sm:gap-2">
          {RUNNER_ACTIONS.map(({ kind, key, label, icon: Icon }) => (
            <button
              type="button"
              key={kind}
              onClick={(event) => {
                send({ kind });
                if (event.detail > 0) event.currentTarget.blur();
              }}
              aria-keyshortcuts={key}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2.5 font-mono text-xs font-black uppercase active:brightness-150 sm:px-4 ${kind === 'block' ? 'border-cyan-200/65 bg-[#103142]/90 text-cyan-50' : 'border-fuchsia-300/65 bg-[#28123b]/90 text-fuchsia-50'}`}
            >
              <Icon size={14} aria-hidden />
              {label} <kbd className="hidden text-white/60 sm:inline">{key}</kbd>
            </button>
          ))}
        </div>
      )}

      {phase === 'over' && result && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black/80">
          <div className="text-xs tracking-[0.4em] font-mono text-fuchsia-300">{game.title}</div>
          <h2 className="text-4xl sm:text-5xl font-black font-mono" style={{ color: result.won ? '#7CFFCB' : '#FF3B6B' }}>
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
            </button>
            {levelId === 'runner' && nextCourse && result.won && (
              <button onClick={nextStage} className="px-6 py-3 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 font-black font-mono tracking-widest">
                NEXT LEVEL
              </button>
            )}
            <button
              onClick={leave}
              className={`px-6 py-3 rounded-full font-black font-mono tracking-widest ${levelId === 'runner' && nextCourse && result.won ? 'border border-fuchsia-400' : 'bg-fuchsia-500 hover:bg-fuchsia-400'}`}
            >
              {resumePath ? 'RESUME SONG' : songResults || levelId === 'shooter' ? 'CONTINUE' : 'WORLD MAP'}
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
