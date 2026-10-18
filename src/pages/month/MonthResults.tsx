// Results screen of the monthly Playgama build, ported from the web game's
// arcade campaign results (CampaignResults on main). Every run here is a
// chapter run, so this replaces the regular results screen outright.
//
// Presentation is the 90s CPS-2 arcade victory screen: the title slams in, the
// stage portrait sweeps across, the tally board counts up row by row, then the
// rank stamp lands. A failed run gets the K.O. treatment and a CONTINUE?
// countdown. One step timeline drives it, and every sound on the screen fires
// from that timeline. Tap or press any key to skip to the end.
//
// Playgama differences from the web screen: the interstitial plays first and
// the sequence waits for it to close; replays are always open (there are no
// cards); the next bonus stage can be opened right here with a rewarded ad or
// the month's bundle; and a first platinum calls out the Bombshell art it
// unlocks. There's no next chapter: one month is the whole game.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Film, Gift, Lock, Play, RotateCcw } from 'lucide-react';
import { getSongById, loadCatalog, type GameSong } from '@/game/api';
import { CHAPTERS, levelToTier } from '@/game/campaign';
import { getHighScore } from '@/game/progress';
import {
  chapterProgress, hasClearedSong, isStageUnlocked, songsForMonth, type ChapterProgress,
} from '@/game/chapterStory';
import { audioManager, type SfxName } from '@/game/audio';
import { sendGameplayMessage, sfxUrl, showInterstitialAndWait } from '@/platform';
import {
  PLAYGAMA_MONTH, BONUS_PRODUCT_ID, BONUS_UNLOCK_EVENT,
  isBonusSongBought, canUnlockWithAd, canBuyBundle, unlockSongWithAd, buyBonusBundle,
} from '@/platform/playgama/month';
import { getProductPrice } from '@/platform/playgama/bridge';
import { monthTotal } from '@/platform/playgama/monthLeaderboard';
import { hideBroken } from '@/pages/campaign/hideBroken';
import { bombshellArtFor, monthStageLevel, prepareMonthRun } from './startRun';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';
import '@/styles/campaignResults.css';
import '@/styles/monthResults.css';

const HOME = `/chapter/${PLAYGAMA_MONTH}`;

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

const rankFor = (acc: number) =>
  acc >= 97 ? 'SS' : acc >= 93 ? 'S' : acc >= 80 ? 'A' : acc >= 60 ? 'B' : acc >= 40 ? 'C' : 'D';

// Timeline steps. Each reveal is gated on `step >= S.x`.
const S = {
  title: 1, portrait: 2, score: 3, acc: 4, combo: 5, judge: 6,
  stamp: 7, // passed: rank stamp lands · failed: CONTINUE? countdown starts
  record: 8, banner: 9, actions: 10,
} as const;
const FINAL = S.actions;

interface MonthResultData {
  score: number;
  maxCombo: number;
  medal: string;
  total: number;
  failed?: boolean;
  perfectPlus?: number;
  perfects?: number;
  goods?: number;
  misses?: number;
  coverUrl?: string;
  /** Set by GameplayCore in a monthly build, read before the run was saved. */
  firstClear?: boolean;
  firstPlatinum?: boolean;
}

interface Stage {
  songs: GameSong[];
  progress: ChapterProgress;
  idx: number;
  isBonus: boolean;
  level: number;
}

type NextStep =
  | { kind: 'play'; song: GameSong; idx: number; level: number; isBonus: boolean }
  | { kind: 'bonus-gate'; song: GameSong; idx: number; need: number; have: number }
  | { kind: 'chapter-complete' }
  | { kind: 'done' };

const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];

export default function MonthResults() {
  const { songId = '' } = useParams<{ songId: string }>();
  // A new song is a new run: remount so the timeline and the result start over.
  return <RunResults key={songId} songId={songId} />;
}

function RunResults({ songId }: { songId: string }) {
  const [, setLocation] = useLocation();
  const [result] = useState<MonthResultData | null>(() => {
    try {
      const raw = sessionStorage.getItem(`result_${songId}`);
      if (!raw) return null;
      const data = JSON.parse(raw) as MonthResultData;
      if (!data.medal) data.medal = 'NONE';
      return data;
    } catch { return null; }
  });
  const [song, setSong] = useState<GameSong | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  // Bumped when a bonus song is unlocked from this screen, to re-read the next step.
  const [unlockRev, setUnlockRev] = useState(0);
  const [unlocking, setUnlocking] = useState(false);
  const [bundlePrice, setBundlePrice] = useState<string | null>(null);

  useEffect(() => {
    if (!result) setLocation(HOME, { replace: true });
  }, [result, setLocation]);

  // Re-read the chapter after the run so progress reflects this result.
  useEffect(() => {
    if (!result) return;
    let alive = true;
    Promise.all([getSongById(songId), loadCatalog()]).then(([s, catalog]) => {
      if (!alive) return;
      const cover = result.coverUrl || sessionStorage.getItem(`active_cover_url_${songId}`);
      if (s && cover) s.coverArt = cover;
      setSong(s);
      const songs = songsForMonth(catalog, PLAYGAMA_MONTH);
      const idx = songs.findIndex((x) => x.id === songId);
      if (idx === -1) return;
      const progress = chapterProgress(songs, meta);
      setStage({ songs, progress, idx, isBonus: idx >= progress.regular.length, level: monthStageLevel(meta.month, idx, progress) });
    }).catch(() => {});
    return () => { alive = false; };
  }, [songId, result, unlockRev]);

  useEffect(() => {
    const onUnlock = () => setUnlockRev((n) => n + 1);
    window.addEventListener(BONUS_UNLOCK_EVENT, onUnlock);
    if (canBuyBundle()) getProductPrice(BONUS_PRODUCT_ID).then(setBundlePrice).catch(() => {});
    return () => window.removeEventListener(BONUS_UNLOCK_EVENT, onUnlock);
  }, []);

  const passed = !!result && !result.failed;
  const total = result?.total || 1;
  const accuracy = result
    ? (((result.perfectPlus ?? 0) * 1.0 + (result.perfects ?? 0) * 0.9 + (result.goods ?? 0) * 0.5) / total) * 100
    : 0;
  const firstClear = passed && !!result?.firstClear;
  const best = getHighScore(songId);
  // The best is saved before this screen mounts, so a matching score means this run set it.
  const newRecord = passed && !firstClear && !!result && result.score > 0 && best === result.score;
  const fullCombo = passed && result?.goods === 0 && result?.misses === 0;
  const medal = result?.medal && result.medal !== 'NONE' ? result.medal : '';
  const medalColor = MEDAL_COLOR[medal] ?? meta.dc;
  const rank = rankFor(accuracy);
  const bombshellNow = passed && !!result?.firstPlatinum && !!song && !!bombshellArtFor(song);

  const next = useMemo<NextStep | null>(() => {
    if (!stage || !passed) return null;
    const { songs, progress, idx } = stage;
    const n = idx + 1;
    if (n < songs.length) {
      const nextSong = songs[n];
      const isBonus = n >= progress.regular.length;
      const bought = isBonus && isBonusSongBought(nextSong.id);
      if (isBonus && !progress.bonusUnlocked && !bought) {
        return { kind: 'bonus-gate', song: nextSong, idx: n, need: meta.platNeeded, have: progress.platinums };
      }
      if (isStageUnlocked(n, progress) || bought) {
        return { kind: 'play', song: nextSong, idx: n, level: monthStageLevel(meta.month, n, progress), isBonus };
      }
    }
    if (progress.complete && progress.bonus.every((b) => hasClearedSong(b))) return { kind: 'chapter-complete' };
    return { kind: 'done' };
  // unlockRev: a bonus song bought or ad-unlocked on this screen opens the next stage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, passed, unlockRev]);

  const banners = useMemo(() => {
    if (!passed || !stage) return [];
    const out: { head: string; sub: string; tone?: string }[] = [];
    const { progress, isBonus } = stage;
    const bonusJustOpened = !!result?.firstPlatinum && !isBonus && progress.bonus.length > 0
      && progress.platinums === meta.platNeeded;
    if (firstClear && !isBonus && progress.complete && progress.cleared === progress.regular.length && stage.idx === progress.regular.length - 1) {
      out.push({ head: 'Chapter clear!', sub: `${meta.name} · ALL ${progress.regular.length} STAGES` });
    }
    if (bonusJustOpened) out.push({ head: 'Bonus stages unlocked!', sub: `${progress.bonus.length} BONUS SONGS OPEN` });
    else if (firstClear && next?.kind === 'play') {
      out.push({ head: 'Here comes a new stage!', sub: next.isBonus ? 'BONUS STAGE UNLOCKED' : `TRACK ${next.idx + 1} UNLOCKED` });
    }
    if (bombshellNow) out.push({ head: 'Bombshell art unlocked!', sub: 'IT PLAYS BEHIND THIS TRACK', tone: 'bombshell' });
    return out;
  }, [passed, stage, result, firstClear, next, bombshellNow]);
  const bannerRef = useRef(banners);
  bannerRef.current = banners;

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

  // Playgama: the results screen is the natural break between songs, so the
  // interstitial goes first and the victory sequence starts once it's closed.
  useEffect(() => {
    if (!result) return;
    PRELOAD.forEach((n) => { audioManager.loadSfx(n); });
    sendGameplayMessage('gameplay_stopped');
    let alive = true;
    let ambient: HTMLAudioElement | null = null;
    let fade = 0;

    showInterstitialAndWait('song_complete').then(() => {
      if (!alive) return;
      const hasExtra = passed && (newRecord || firstClear);
      const at = passed
        ? [
            [S.title, 140], [S.portrait, 440], [S.score, 1000], [S.acc, 2000], [S.combo, 2600],
            [S.judge, 3100], [S.stamp, 3500],
            ...(hasExtra ? [[S.record, 4500]] : []),
            [S.banner, hasExtra ? 5100 : 4500],
            [S.actions, hasExtra ? 5900 : 5300],
          ]
        : [
            [S.title, 140], [S.portrait, 440], [S.score, 1000], [S.acc, 1900], [S.combo, 2400],
            [S.judge, 2900], [S.stamp, 3300], [S.actions, 3900],
          ];
      timers.current.push(...at.map(([s, ms]) => window.setTimeout(() => setStep((cur) => Math.max(cur, s)), ms)));
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        skippedRef.current = true;
        setSkipped(true);
        setStep(FINAL);
        if (passed) timers.current.push(window.setTimeout(() => audioManager.playSfx(MEDAL_VOICE[medal] ?? 'reveal', 0.85), 400));
      }

      // Results music under the sequence, faded in gently.
      // Only 'results' ships; the web build's 'results2' isn't in the repo.
      ambient = new Audio(sfxUrl('results'));
      ambient.loop = true;
      ambient.volume = 0;
      ambient.play().catch(() => {});
      fade = window.setInterval(() => {
        if (!ambient) return;
        if (ambient.volume < 0.14) ambient.volume += 0.02;
        else { ambient.volume = 0.15; clearInterval(fade); }
      }, 60);
    });

    const list = timers.current;
    return () => {
      alive = false;
      list.forEach(clearTimeout);
      clearInterval(fade);
      if (ambient) {
        ambient.pause();
        ambient.removeAttribute('src');
        try { ambient.load(); } catch { /* ignore */ }
      }
    };
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
        if (bannerRef.current.length) { audioManager.playSfx('new_modes_available', 0.7); impact(0.6, meta.dc); }
        break;
      case S.actions: audioManager.playSfx('swipe', 0.3); break;
    }
  }, [step, passed, impact, playStamp, medalColor]);

  const skip = useCallback(() => {
    if (skippedRef.current || step >= FINAL || step === 0) return;
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

  const launch = (target: GameSong, idx: number, level: number) => {
    audioManager.playSfx('tap_nav', 0.4);
    sessionStorage.removeItem(`result_${songId}`);
    setLocation(prepareMonthRun(target, { month: meta.month, level, idx, cleared: hasClearedSong(target) }));
  };
  const go = (path: string) => { audioManager.playSfx('tap_nav', 0.15); setLocation(path); };

  const unlockByAd = async (target: GameSong) => {
    if (unlocking) return;
    setUnlocking(true);
    try { await unlockSongWithAd(target.id); } finally { setUnlocking(false); }
  };
  const buyBundle = async () => {
    if (unlocking) return;
    setUnlocking(true);
    try { await buyBonusBundle(); } finally { setUnlocking(false); }
  };

  if (!result) return null;

  const stageLabel = stage
    ? stage.isBonus
      ? `Bonus ${stage.idx - stage.progress.regular.length + 1}/${stage.progress.bonus.length}`
      : `Stage ${stage.idx + 1}/${stage.progress.regular.length}`
    : 'Stage';
  const level = stage?.level ?? 1;
  const coverUrl = song?.coverArt ?? result.coverUrl ?? null;

  const on = (s: number) => (step >= s ? ' is-on' : '');
  const locked = (s: number) => (step > s ? ' is-locked' : '');
  const titleWords = passed ? ['Stage', 'Clear!'] : ['K.O.'];
  let li = 0;

  return (
    <div
      ref={rootRef}
      className="cs-page cr-root"
      data-result={passed ? 'win' : 'lose'}
      data-skipped={skipped ? 'true' : undefined}
      onPointerDown={step > 0 && step < FINAL ? skip : undefined}
      style={{ ['--ch' as string]: passed ? meta.dc : '#ff2a4f', ['--medal' as string]: medalColor, maxWidth: 980 } as CSSProperties}
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

      <nav className="cr-hud" aria-label="Chapter">
        <button type="button" className="cs-chip-btn" onClick={() => go(HOME)}>
          <ArrowLeft size={16} /> {meta.name}
        </button>
        <div className="cr-hud-right">
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

      {banners.map((b) => (
        <div key={b.head} className={`cr-banner cr-in${on(S.banner)}`} role="note"
          style={b.tone === 'bombshell' ? ({ ['--ch' as string]: '#FF1493' } as CSSProperties) : undefined}>
          <div className="cr-banner-head">{b.head}</div>
          <div className="cr-banner-sub">{b.sub}</div>
        </div>
      ))}

      <section className={`cr-actions cr-in${on(S.actions)}`} aria-label="What's next">
        {!passed && (
          <div className="cr-card" data-tone="lose">
            <div className="cr-card-tab">Continue?</div>
            <div className="cr-continue">
              {count > 0
                ? <span key={count} className="cr-count">{count}</span>
                : <span className="cr-gameover">Game over</span>}
            </div>
            <p className="cs-hook">The next track stays locked until you pass this one. Retry as many times as you need.</p>
            {song && stage && (
              <div className="cs-detail-actions">
                <button type="button" className="btn-3d" onClick={() => launch(song, stage.idx, stage.level)}>
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
                <NextTrack song={next.song} level={next.level} isBonus={next.isBonus} />
                <div className="cs-detail-actions">
                  <button type="button" className="btn-3d" onClick={() => launch(next.song, next.idx, next.level)}>
                    <Play size={16} fill="currentColor" /> Play next
                  </button>
                  <span className="cr-blink">Press start</span>
                </div>
              </>
            )}
            {next?.kind === 'bonus-gate' && (
              <>
                <div className="cs-lock-note">
                  <Lock size={14} style={{ verticalAlign: '-2px' }} /> All tracks cleared. The bonus songs open at {next.need} platinum
                  medals ({next.have} so far), or unlock one now.
                </div>
                {(canUnlockWithAd() || canBuyBundle()) && (
                  <div className="cs-detail-actions">
                    {canUnlockWithAd() && (
                      <button type="button" className="btn-3d" data-tone="quiet" disabled={unlocking} onClick={() => unlockByAd(next.song)}>
                        <Film size={16} /> Watch an ad
                      </button>
                    )}
                    {canBuyBundle() && (
                      <button type="button" className="btn-3d" data-tone="gold" disabled={unlocking} onClick={buyBundle}>
                        <Gift size={16} /> All {stage?.progress.bonus.length ?? 5} bonus{bundlePrice ? ` · ${bundlePrice}` : ''}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {next?.kind === 'chapter-complete' && (
              <p className="cs-hook">Every track in {meta.name.toLowerCase()} is cleared. Chase platinum medals to raise your chapter total.</p>
            )}
            {next?.kind === 'done' && <p className="cs-hook">That's the last open track for now.</p>}
            {stage && (
              <div className="cs-muted" style={{ fontSize: 12, marginTop: 8 }}>
                Chapter total {monthTotal(stage.songs).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </section>

      <div className={`cr-foot cr-in${on(S.actions)}`}>
        {passed && song && stage && (
          <button type="button" className="btn-3d" data-tone="quiet" onClick={() => launch(song, stage.idx, stage.level)}>
            <RotateCcw size={16} /> Replay
          </button>
        )}
        <button type="button" className="btn-3d" data-tone="ghost" onClick={() => go(HOME)}>
          Back to chapter
        </button>
      </div>

      {step > 0 && step < FINAL && (
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

function NextTrack({ song, level, isBonus }: { song: GameSong; level: number; isBonus: boolean }) {
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
