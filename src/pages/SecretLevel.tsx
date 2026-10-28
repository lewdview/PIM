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
import { useLocation, useParams } from 'wouter';
import { BeatClock, SECRET_TRACKS } from '../game/secret/chiptune';
import { ShooterLevel } from '../game/secret/shooter';
import { RunnerLevel } from '../game/secret/runner';
import { markSecretLevelCleared, type SecretLevelId } from '../game/secret/warp';
import { warpResumePath } from '../game/secret/warpResume';
import type { SecretGame, SecretInput } from '../game/secret/types';

type Phase = 'intro' | 'playing' | 'over';

const COUNT_IN = 4; // beats of countdown before the level starts

function makeLevel(id: SecretLevelId): SecretGame {
  return id === 'runner' ? new RunnerLevel(SECRET_TRACKS.runner.bpm) : new ShooterLevel();
}

export default function SecretLevel() {
  const params = useParams<{ level: string }>();
  const [, setLocation] = useLocation();
  const levelId: SecretLevelId = params.level === 'runner' ? 'runner' : 'shooter';
  const query = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const fromSong = query.get('from');
  const via = query.get('via');
  // An instant warp left the song mid-transmission: send the player back into it
  const [resumePath] = useState(() => (via === 'warp' && fromSong ? warpResumePath(fromSong) : null));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<SecretGame>(makeLevel(levelId));
  const clockRef = useRef<BeatClock | null>(null);
  const rafRef = useRef(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [result, setResult] = useState<{ won: boolean; score: number } | null>(null);

  const send = useCallback((a: SecretInput) => {
    const clock = clockRef.current;
    if (!clock) return;
    gameRef.current.input(a, clock.beat() - COUNT_IN);
  }, []);

  const start = useCallback(async () => {
    gameRef.current = makeLevel(levelId);
    setResult(null);
    clockRef.current?.stop();
    const clock = new BeatClock(SECRET_TRACKS[levelId]);
    clockRef.current = clock;
    await clock.start();
    setPhase('playing');
  }, [levelId]);

  // Render loop
  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const game = gameRef.current;
      const beat = (clockRef.current?.beat() ?? 0) - COUNT_IN;
      if (beat >= 0) game.update(beat, dt);
      game.draw(ctx, w, h, beat);
      drawHud(ctx, w, h, game, beat);

      if (game.done) {
        clockRef.current?.stop();
        if (game.won) markSecretLevelCleared(levelId, game.score);
        setResult({ won: game.won, score: game.score });
        setPhase('over');
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, levelId]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key;
      let a: SecretInput['kind'] | null = null;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') a = 'left';
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') a = 'right';
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') a = 'jump';
      else if (k === 'ArrowDown' || k === 's' || k === 'S') a = 'duck';
      else if (k === ' ' || k === 'Enter') a = 'fire';
      if (!a) return;
      e.preventDefault();
      if (phase === 'intro' && (a === 'fire' || a === 'jump')) {
        void start();
        return;
      }
      if (phase === 'playing') send({ kind: a } as SecretInput);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, send, start]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    clockRef.current?.stop();
  }, []);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing') return;
    const r = e.currentTarget.getBoundingClientRect();
    send({ kind: 'pointer', x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
  };

  const leave = () => {
    clockRef.current?.stop();
    if (resumePath) setLocation(resumePath);
    else if (via && fromSong && hasResult(fromSong)) setLocation(`/results/${fromSong}`);
    else setLocation('/songs');
  };

  const game = gameRef.current;

  return (
    <div className="fixed inset-0 bg-black text-white select-none" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={onPointer}
      />

      {phase === 'intro' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center bg-black/80">
          <div className="text-xs tracking-[0.4em] text-fuchsia-300 font-mono">★ WARP ZONE ★ SECRET LEVEL FOUND</div>
          <h1 className="text-4xl sm:text-6xl font-black font-mono" style={{ textShadow: '0 0 24px #B967FF' }}>
            {game.title}
          </h1>
          <p className="max-w-md text-sm text-zinc-300 font-mono">{game.hint}</p>
          <button
            onClick={() => void start()}
            className="mt-2 px-8 py-3 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 font-black font-mono tracking-widest"
          >
            START
          </button>
          <button onClick={leave} className="text-xs text-zinc-500 font-mono underline">
            {resumePath ? 'skip · back to the song' : 'skip'}
          </button>
        </div>
      )}

      {phase === 'over' && result && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black/80">
          <div className="text-xs tracking-[0.4em] font-mono text-fuchsia-300">{game.title}</div>
          <h2 className="text-4xl sm:text-5xl font-black font-mono" style={{ color: result.won ? '#7CFFCB' : '#FF3B6B' }}>
            {result.won ? 'LEVEL CLEAR' : 'SIGNAL LOST'}
          </h2>
          <div className="text-2xl font-mono">{result.score.toLocaleString()}</div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => void start()}
              className="px-6 py-3 rounded-full border border-fuchsia-400 font-black font-mono tracking-widest"
            >
              RETRY
            </button>
            <button
              onClick={leave}
              className="px-6 py-3 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 font-black font-mono tracking-widest"
            >
              {resumePath ? 'RESUME SONG' : 'CONTINUE'}
            </button>
          </div>
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
