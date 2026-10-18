// Results for a monthly Playgama build: the web game's arcade campaign results
// screen (src/pages/campaign/CampaignResults.tsx on main), ported to the
// monthly rules. Every song ships with the game, so there are no release
// dates, replays need no card, and the chapter is the whole game: after the
// last stage the chapter is complete. A platinum run announces its Bombshell
// art; a stage that leads into locked bonus songs says how to open them.
//
// Presentation is a 90s CPS-2 arcade victory screen: the title slams in, the
// stage portrait sweeps across, the tally board counts up row by row, then the
// rank stamp lands. A failed run gets the K.O. treatment and a CONTINUE?
// countdown. The whole sequence is driven by one step timeline below; every
// sound on this screen is fired from that timeline, so nothing plays that the
// player can't see. Tap or press any key to skip to the end.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Lock, Play, RotateCcw } from 'lucide-react';
import { loadCatalog, type GameSong } from '@/game/api';
import { CHAPTERS, levelToTier } from '@/game/campaign';
import { getHighScore } from '@/game/progress';
import { songsForMonth } from '@/game/chapterStory';
import { audioManager, type SfxName } from '@/game/audio';
import { sendGameplayMessage, showInterstitial } from '@/platform';
import { MONTH_BOMBSHELL, PLAYGAMA_MONTH, canBuyBundle, canUnlockWithAd } from '@/platform/playgama/month';
import { hideBroken } from '../campaign/hideBroken';
import { bombshellArtFor, monthProgress, monthStageAt, runBefore, startMonthRun, type MonthStage } from './monthRun';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';
import '@/styles/campaignResults.css';
import '@/styles/monthResults.css';

const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#FFC21A', SILVER: '#C9D3E6', BRONZE: '#E08A45',
};
const MEDAL_VOICE: Record<string, SfxName> = {
  PLATINUM: 'platinum_get', GOLD: 'gold_get', SILVER: 'silver_get', BRONZE: 'bronze_get',
};
const PRELOAD: SfxName[] = [
  'cas_slam_down', 'swipe', 'tap_nav', 'tap_perfect', 'open_chest', 'perfect',
  'platinum_get', 'gold_get', 'silver_get', 'bronze_get', 'reveal',
  'hidden_secret_found', 'new_modes_available', 'gmeover',
];
const pad = (n: number) => String(n).padStart(2, '0');

const rankFor = (acc: number) =>
  acc >= 97 ? 'SS' : acc >= 93 ? 'S' : acc >= 80 ? 'A' : acc >= 60 ? 'B' : acc >= 40 ? 'C' : 'D';

// Timeline steps. Each reveal is gated on `step >= S.x`.
const S = {
  title: 1, portrait: 2, score: 3, acc: 4, combo: 5, judge: 6,
  stamp: 7, // passed: rank stamp lands · failed: CONTINUE? countdown starts
  record: 8, banner: 9, actions: 10,
} as const;
const FINAL = S.actions;

export interface MonthResultData {
  score: number;
  maxCombo: number;
  medal: string;
  failed?: boolean;
  perfectPlus?: number;
  perfects?: number;
  goods?: number;
  misses?: number;
}

type NextStep =
  | { kind: 'play'; stage: MonthStage }
  | { kind: 'bonus-gate'; need: number; have: number }
  | { kind: 'done' };

interface StageInfo {
  songs: GameSong[];
  progress: ReturnType<typeof monthProgress>;
  stage: MonthStage;
}

const month = PLAYGAMA_MONTH;
const chapterPath = `/chapter/${month}`;

export default function MonthResults({ songId, song, result, accuracy, coverUrl }: {
  songId: string;
  song: GameSong | null;
  result: MonthResultData;
  accuracy: number;
  coverUrl?: string | null;
}) {
  const [, setLocation] = useLocation();
  const meta = CHAPTERS.find((c) => c.month === month) ?? CHAPTERS[0];
  const [info, setInfo] = useState<StageInfo | null>(null);

  // Read the chapter after the run so progress reflects this result.
  useEffect(() => {
    let alive = true;
    loadCatalog().then((catalog) => {
      if (!alive) return;
      const songs = songsForMonth(catalog, month);
      const idx = songs.findIndex((s) => s.id === songId);
      if (idx === -1) return;
      const progress = monthProgress(songs, meta);
      setInfo({ songs, progress, stage: monthStageAt(songs, meta, progress, idx) });
    }).catch(() => {});
    return () => { alive = false; };
  }, [songId, meta]);

  // The results screen is the break between songs: the portal's interstitial goes here.
  useEffect(() => {
    sendGameplayMessage('gameplay_stopped');
    const t = window.setTimeout(() => showInterstitial('song_complete'), 300);
    return () => clearTimeout(t);
  }, []);

  const stage = info?.stage ?? null;
  const passed = !result.failed;
  const level = stage?.level ?? 1;
  const before = useMemo(() => runBefore(songId), [songId]);
  const best = getHighScore(songId) || 0;
  const firstClear = passed && !!before && !before.cleared;
  const newRecord = passed && !firstClear && !!before && result.score > before.best;
  const bombshellNow = passed && result.medal === 'PLATINUM' && !before?.platinum && !!song && !!bombshellArtFor(song);
  const fullCombo = passed && result.goods === 0 && result.misses === 0;
  const medal = result.medal && result.medal !== 'NONE' ? result.medal : '';
  const medalColor = MEDAL_COLOR[medal] ?? meta.dc;
  const rank = rankFor(accuracy);

  const next = useMemo<NextStep | null>(() => {
    if (!info || !passed) return null;
    const { songs, progress, stage: st } = info;
    // The next stage that can be played, skipping bonus songs that are still locked.
    for (let n = st.idx + 1; n < songs.length; n++) {
      const ns = monthStageAt(songs, meta, progress, n);
      if (ns.open) return { kind: 'play', stage: ns };
      if (!ns.bonusLocked) break;
    }
    if (progress.bonus.length && !progress.bonusUnlocked && st.idx >= progress.regular.length - 1) {
      const anyLocked = songs.some((_, i) => monthStageAt(songs, meta, progress, i).bonusLocked);
      if (anyLocked) return { kind: 'bonus-gate', need: meta.platNeeded, have: progress.platinums };
    }
    return { kind: 'done' };
  }, [info, passed, meta]);

  const banner = useMemo(() => {
    if (!passed || !next || !info) return null;
    if (bombshellNow) return { head: 'Perfect run!', sub: 'BOMBSHELL ART UNLOCKED' };
    if (next.kind === 'done' && info.progress.complete && firstClear) return { head: 'Chapter complete!', sub: `${meta.name} CLEARED` };
    if (!firstClear) return null;
    if (next.kind === 'play') return { head: 'Here comes a new stage!', sub: `DAY ${next.stage.song.day} UNLOCKED` };
    return null;
  }, [passed, next, info, firstClear, bombshellNow, meta.name]);
  const bannerRef = useRef(banner);
  bannerRef.current = banner;

  // ── Timeline ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const skippedRef = useRef(false);
  const timers = useRef<number[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  const impact = useCallback((strength: number, color = '#fff') => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (flashRef.current) {
      flashRef.current.style.background = color;
      flashRef.current.animate([{ opacity: 0.85 * strength }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
    }
    if (!reduce && rootRef.current) {
      const a = 9 * strength;
      rootRef.current.animate([
        { transform: 'translate(0,0)' },
        { transform: `translate(${-a}px, ${a * 0.6}px)` },
        { transform: `translate(${a * 0.8}px, ${-a * 0.5}px)` },
        { transform: `translate(${-a * 0.5}px, ${-a * 0.3}px)` },
        { transform: `translate(${a * 0.3}px, ${a * 0.2}px)` },
        { transform: 'translate(0,0)' },
      ], { duration: 380, easing: 'linear' });
    }
  }, []);

  const playStamp = useCallback(() => {
    audioManager.playSfx('open_chest', 0.7);
    const voice = MEDAL_VOICE[medal];
    timers.current.push(window.setTimeout(() => {
      audioManager.playSfx(voice ?? 'reveal', 0.85);
      if (fullCombo) audioManager.playSfx('perfect', 0.9);
    }, 260));
  }, [medal, fullCombo]);

  useEffect(() => {
    PRELOAD.forEach((n) => { audioManager.loadSfx(n); });
    const at = passed
      ? [
          [S.title, 140], [S.portrait, 440], [S.score, 1000], [S.acc, 2000], [S.combo, 2600],
          [S.judge, 3100], [S.stamp, 3500],
          ...(newRecord || firstClear ? [[S.record, 4500]] : []),
          [S.banner, newRecord || firstClear ? 5100 : 4500],
          [S.actions, newRecord || firstClear ? 5900 : 5300],
        ]
      : [
          [S.title, 140], [S.portrait, 440], [S.score, 1000], [S.acc, 1900], [S.combo, 2400],
          [S.judge, 2900], [S.stamp, 3300], [S.actions, 3900],
        ];
    timers.current = at.map(([s, ms]) => window.setTimeout(() => setStep((cur) => Math.max(cur, s)), ms));
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      skippedRef.current = true;
      setSkipped(true);
      setStep(FINAL);
      // Give the preload a moment; playSfx skips buffers that aren't decoded.
      if (passed) timers.current.push(window.setTimeout(() => audioManager.playSfx(MEDAL_VOICE[medal] ?? 'reveal', 0.85), 400));
    }
    const list = timers.current;
    return () => { list.forEach(clearTimeout); timers.current.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sounds + impacts, fired as each step is reached (not when skipped past).
  useEffect(() => {
    if (skippedRef.current || step === 0) return;
    switch (step) {
      case S.title:
        audioManager.playSfx('cas_slam_down', 0.75);
        impact(1, passed ? '#fff3c4' : '#ff2a4f');
        break;
      case S.portrait: audioManager.playSfx('swipe', 0.5); break;
      case S.acc: case S.combo: case S.judge: audioManager.playSfx('tap_perfect', 0.45); break;
      case S.stamp:
        if (passed) { playStamp(); impact(1.2, medalColor); }
        break;
      case S.record: audioManager.playSfx('hidden_secret_found', 0.55); break;
      case S.banner:
        if (bannerRef.current) { audioManager.playSfx('new_modes_available', 0.7); impact(0.6, meta.dc); }
        break;
      case S.actions: audioManager.playSfx('swipe', 0.3); break;
    }
  }, [step, passed, impact, playStamp, medalColor, meta.dc]);

  const skip = useCallback(() => {
    if (skippedRef.current || step >= FINAL) return;
    skippedRef.current = true;
    timers.current.forEach(clearTimeout);
    // The stamp is the payoff: still give it its sound if we jumped past it.
    if (passed && step < S.stamp) { playStamp(); impact(0.8, medalColor); }
    setSkipped(true);
    setStep(FINAL);
  }, [step, passed, playStamp, impact, medalColor]);

  useEffect(() => {
    if (step >= FINAL) return;
    const onKey = (e: KeyboardEvent) => { if (!e.metaKey && !e.ctrlKey && !e.altKey) skip(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, skip]);

  // ── Failed: CONTINUE? 9 → 0 ─────────────────────────────────────────────
  const [count, setCount] = useState(9);
  useEffect(() => {
    if (passed || step < S.stamp || count <= 0) return;
    const t = window.setTimeout(() => {
      const n = count - 1;
      setCount(n);
      audioManager.playSfx(n === 0 ? 'gmeover' : 'tap_nav', n === 0 ? 0.6 : 0.3);
    }, 1000);
    return () => clearTimeout(t);
  }, [passed, step, count]);

  const launch = (target: MonthStage) => {
    audioManager.playSfx('tap_nav', 0.4);
    sessionStorage.removeItem(`result_${songId}`);
    startMonthRun(target.song, target.idx, target.level, month, setLocation);
  };
  const go = (path: string) => { audioManager.playSfx('tap_nav', 0.15); setLocation(path); };

  const stageLabel = info
    ? info.stage.isBonus
      ? `Bonus ${info.stage.idx - info.progress.regular.length + 1}/${info.progress.bonus.length}`
      : `Stage ${info.stage.idx + 1}/${info.progress.regular.length}`
    : 'Stage';
  const canUnlockBonus = canUnlockWithAd() || canBuyBundle();

  const on = (s: number) => (step >= s ? ' is-on' : '');
  const locked = (s: number) => (step > s ? ' is-locked' : '');
  const titleWords = passed ? ['Stage', 'Clear!'] : ['K.O.'];
  let li = 0;

  return (
    <div
      ref={rootRef}
      className="cs-page cr-root mr-fit"
      data-result={passed ? 'win' : 'lose'}
      data-skipped={skipped ? 'true' : undefined}
      onPointerDown={step < FINAL ? skip : undefined}
      style={{ ['--ch' as string]: passed ? meta.dc : '#ff2a4f', ['--medal' as string]: medalColor } as CSSProperties}
    >
      <div className="cr-bg" aria-hidden="true">
        {coverUrl && <img className="cr-bg-art" src={coverUrl} alt="" onError={hideBroken} />}
        <div className="cr-rays" />
        <div className="cr-dither" />
      </div>
      <div className="cr-wipe" aria-hidden="true" />
      <div className="cr-crt" aria-hidden="true" />
      <div ref={flashRef} className="cr-flash" aria-hidden="true" />

      <p className="cr-sr" role="status">
        {passed
          ? `Stage clear. Score ${result.score.toLocaleString()}, accuracy ${Math.round(accuracy)} percent, ${medal ? `${medal.toLowerCase()} medal` : 'cleared'}.`
          : `Stage failed. Score ${result.score.toLocaleString()}, accuracy ${Math.round(accuracy)} percent.`}
      </p>

      <nav className="cr-hud" aria-label="Campaign">
        <button type="button" className="cs-chip-btn" onClick={() => go(chapterPath)}>
          <ArrowLeft size={16} /> Chapter {pad(month)}
        </button>
        <div className="cr-hud-right">
          <span className="cr-chip">{meta.name}</span>
          <span className="cr-chip">{stageLabel}</span>
          <span className="cr-chip" data-tone="hot">Lv {level} · {levelToTier(level)}</span>
        </div>
      </nav>

      <h1 className={`cr-title cr-in${on(S.title)}`} aria-hidden="true">
        {titleWords.map((w) => (
          <span key={w} className="cr-word">
            {[...w].map((ch, i) => (
              <span key={i} className="cr-l" style={{ ['--i' as string]: li++ } as CSSProperties}>{ch}</span>
            ))}
          </span>
        ))}
      </h1>
      <div className={`cr-subtitle cr-in${on(S.title)}`}>
        {passed ? (fullCombo ? 'Full combo · flawless transmission' : 'Transmission decoded') : 'Signal lost · transmission not decoded'}
      </div>

      <section className="cr-hero">
        <div className={`cr-portrait-wrap cr-in${on(S.portrait)}`}>
          <div className="cr-portrait">
            <div className="cr-portrait-inner">
              {coverUrl && <img src={coverUrl} alt="" onError={hideBroken} />}
            </div>
            <div className="cr-portrait-shine" />
            {!passed && <div className="cr-tape">Fail</div>}
          </div>
          <div className="cr-plate">
            <span>Day {song?.day ?? '—'}</span>
            <b>{song?.title ?? 'Transmission'}</b>
          </div>

          {passed && (
            <div className={`cr-stamp cr-in${on(S.stamp)}`} aria-hidden="true">
              <div className="cr-stamp-rays" />
              <div className="cr-stamp-disc">
                <span className="cr-stamp-rank">{rank}</span>
                <span className="cr-stamp-name">{medal ? medal : 'Clear'}</span>
              </div>
              {step >= S.stamp && <Sparks />}
            </div>
          )}
        </div>

        <div className="cr-board">
          <div className="cr-board-tab">{passed ? 'Result' : 'Damage report'}</div>
          <TallyRow className={on(S.score) + locked(S.score)} label="Score"
            to={result.score} run={step >= S.score} done={skipped || step > S.score} ms={900}
            fmt={(v) => Math.round(v).toLocaleString()} />
          <TallyRow className={on(S.acc) + locked(S.acc)} label="Accuracy"
            to={accuracy} run={step >= S.acc} done={skipped || step > S.acc} ms={520}
            fmt={(v) => `${v.toFixed(1)}%`} />
          <TallyRow className={on(S.combo) + locked(S.combo)} label="Max combo"
            to={result.maxCombo} run={step >= S.combo} done={skipped || step > S.combo} ms={420}
            fmt={(v) => `${Math.round(v)}x`} />
          <div className={`cr-judge cr-in${on(S.judge)}`}>
            <span data-j="pp">P+ {result.perfectPlus ?? 0}</span>
            <span data-j="p">P {result.perfects ?? 0}</span>
            <span data-j="g">G {result.goods ?? 0}</span>
            <span data-j="m">Miss {result.misses ?? 0}</span>
          </div>

          {passed && (
            <div className={`cr-record cr-in${on(S.record)}`}>
              {newRecord ? <b className="cr-rainbow">New record!!</b>
                : firstClear ? <b className="cr-rainbow">First clear!</b>
                : best > result.score ? <span>Best {best.toLocaleString()}</span>
                : null}
            </div>
          )}
        </div>
      </section>

      {banner && (
        <div className={`cr-banner cr-in${on(S.banner)}`} role="note">
          <div className="cr-banner-head">{banner.head}</div>
          <div className="cr-banner-sub">{banner.sub}</div>
        </div>
      )}

      <section className={`cr-actions cr-in${on(S.actions)}`} aria-label="What's next">
        {!passed && (
          <div className="cr-card" data-tone="lose">
            <div className="cr-card-tab">Continue?</div>
            <div className="cr-continue">
              {count > 0
                ? <span key={count} className="cr-count">{count}</span>
                : <span className="cr-gameover">Game over</span>}
            </div>
            <p className="cs-hook">The next stage stays locked until you pass this one. Retry as many times as you need.</p>
            {stage && (
              <div className="cs-detail-actions">
                <button type="button" className="btn-3d" onClick={() => launch(stage)}>
                  <RotateCcw size={16} /> Retry stage
                </button>
                <span className="cr-blink">Insert coin</span>
              </div>
            )}
          </div>
        )}

        {passed && (
          <div className="cr-card">
            <div className="cr-card-tab">{firstClear ? 'Unlocked' : 'Up next'}</div>
            {!next && <p className="cs-hook">Checking the next stage…</p>}
            {next?.kind === 'play' && (
              <>
                <NextTrack stage={next.stage} />
                <div className="cs-detail-actions">
                  <button type="button" className="btn-3d" onClick={() => launch(next.stage)}>
                    <Play size={16} fill="currentColor" /> Play day {next.stage.song.day}
                  </button>
                  <span className="cr-blink">Press start</span>
                </div>
              </>
            )}
            {next?.kind === 'bonus-gate' && (
              <>
                <div className="cs-lock-note">
                  <Lock size={14} style={{ verticalAlign: '-2px' }} /> The bonus songs open at {next.need} platinum
                  medals in this chapter ({next.have} so far){canUnlockBonus ? ', or unlock them from the chapter now.' : '.'}
                </div>
                <div className="cs-detail-actions">
                  <button type="button" className="btn-3d" onClick={() => go(chapterPath)}>
                    {canUnlockBonus ? 'Unlock bonus songs' : 'Back to chapter'}
                  </button>
                </div>
              </>
            )}
            {next?.kind === 'done' && (
              <p className="cs-hook">
                {info?.progress.complete ? `${meta.name} is cleared.${MONTH_BOMBSHELL ? ' Chase platinum medals for the Bombshell art.' : ''}` : 'Pick your next stage from the chapter.'}
              </p>
            )}
          </div>
        )}

        {passed && (
          <div className="cr-card" data-tone="quiet">
            <div className="cr-card-tab">Replay</div>
            <p className="cs-hook">
              {result.medal === 'PLATINUM' ? 'Platinum. Run it again any time.' : `Run it again for a better medal.${MONTH_BOMBSHELL ? ' A platinum run unlocks its Bombshell art.' : ''}`}
            </p>
            <div className="cs-detail-actions">
              {stage && (
                <button type="button" className="btn-3d" data-tone="quiet" onClick={() => launch(stage)}>
                  <RotateCcw size={16} /> Replay stage
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <div className={`cr-foot cr-in${on(S.actions)}`}>
        <button type="button" className="btn-3d" data-tone="ghost" onClick={() => go(chapterPath)}>
          Back to chapter
        </button>
      </div>

      {step < FINAL && (
        <button type="button" className="cr-skip" onClick={skip}>Tap to skip ▸▸</button>
      )}
    </div>
  );
}

function TallyRow({ className, label, to, run, done, ms, fmt }: {
  className: string; label: string; to: number; run: boolean; done: boolean; ms: number;
  fmt: (v: number) => string;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (done) { setV(to); return; }
    if (!run) return;
    let raf = 0;
    let lastTick = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(to * (1 - Math.pow(1 - p, 3)));
      // Arcade tally beeps while the number is rolling.
      if (p < 1 && to > 0 && now - lastTick > 55) { lastTick = now; audioManager.playSfx('tap_nav', 0.06); }
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [run, done, to, ms]);
  return (
    <div className={`cr-row cr-in${className}`}>
      <span className="cr-row-label">{label}</span>
      <span className="cr-row-dots" />
      <span className="cr-row-val">{fmt(v)}</span>
    </div>
  );
}

// Pixel sparks thrown off the rank stamp. Deterministic spread, no RNG.
function Sparks() {
  return (
    <div className="cr-sparks">
      {Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.21;
        const d = 70 + ((i * 37) % 60);
        return (
          <i key={i} style={{
            ['--dx' as string]: `${Math.cos(a) * d}px`,
            ['--dy' as string]: `${Math.sin(a) * d}px`,
            ['--s' as string]: `${4 + (i % 4) * 2}px`,
            ['--d' as string]: `${(i % 5) * 30}ms`,
          } as CSSProperties} data-white={i % 3 === 0 ? 'true' : undefined} />
        );
      })}
    </div>
  );
}

function NextTrack({ stage }: { stage: MonthStage }) {
  const { song, level, isBonus } = stage;
  return (
    <div className="cr-next">
      <div className="cr-next-art">
        {song.coverArt && <img src={song.coverArt} alt="" onError={hideBroken} />}
        <span className="cr-vs">VS</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="cs-eyebrow">Day {song.day} · {isBonus ? 'Bonus · ' : ''}Lv {level}</div>
        <div className="cr-next-title">{song.title}</div>
      </div>
    </div>
  );
}

/** /results/:songId in a monthly build: the run saved by gameplay, or back to the chapter. */
export function MonthResultsRoute({ params }: { params: { songId: string } }) {
  const { songId } = params;
  const [, setLocation] = useLocation();
  const [song, setSong] = useState<GameSong | null>(null);
  const raw = useMemo(() => {
    try {
      const s = sessionStorage.getItem(`result_${songId}`);
      return s ? (JSON.parse(s) as MonthResultData & { total?: number; coverUrl?: string }) : null;
    } catch {
      return null;
    }
  }, [songId]);
  useEffect(() => {
    if (!raw) { setLocation(chapterPath, { replace: true }); return; }
    let alive = true;
    loadCatalog().then((c) => { if (alive) setSong(c.find((s) => s.id === songId) ?? null); }).catch(() => {});
    return () => { alive = false; };
  }, [raw, songId, setLocation]);
  if (!raw) return null;
  const total = raw.total || 1;
  const accuracy = ((raw.perfectPlus ?? 0) + (raw.perfects ?? 0) * 0.9 + (raw.goods ?? 0) * 0.5) / total * 100;
  const cover = raw.coverUrl || sessionStorage.getItem(`active_cover_url_${songId}`) || song?.coverArt || null;
  return <MonthResults key={songId} songId={songId} song={song} result={raw} accuracy={accuracy} coverUrl={cover} />;
}
