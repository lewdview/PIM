// On-demand results (collection, codex, award play, search): the same 90s
// CPS-2 arcade sequence as the campaign screen (CampaignResults), with the
// on-demand payload — the prize claim, the song leaderboard, score casting and
// the hub grid. GameResults owns all the data and reward logic and hands it in;
// this file only presents it.
//
// One step timeline drives every reveal and every sound, so nothing plays that
// the player can't see. Tap or press any key to skip to the end.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, Film, Home, Lock, Play, RotateCcw, Share2 } from 'lucide-react';
import type { GameSong } from '@/game/api';
import { audioManager, type SfxName } from '@/game/audio';
import { PACK_CONFIGS } from '@/utils/rarity';
import SongLeaderboard from '@/components/SongLeaderboard';
import { hideBroken } from '../campaign/hideBroken';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';
import { primeGameCover, resolvePreferredCover } from '@/utils/gameCover';
import '@/styles/campaignResults.css';
import '@/styles/onDemandResults.css';

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
const LANES = [
  { label: 'Bass', color: '#00F5D4' },
  { label: 'Mid', color: '#FF007F' },
  { label: 'Treble', color: '#A855F7' },
];

const rankFor = (acc: number) =>
  acc >= 97 ? 'SS' : acc >= 93 ? 'S' : acc >= 80 ? 'A' : acc >= 60 ? 'B' : acc >= 40 ? 'C' : 'D';

// Timeline steps. Each reveal is gated on `step >= S.x`.
const S = {
  title: 1, portrait: 2, score: 3, acc: 4, combo: 5, judge: 6,
  stamp: 7, // cleared: rank stamp lands · failed: CONTINUE? countdown starts
  record: 8, banner: 9, actions: 10,
} as const;
const FINAL = S.actions;

export interface OnDemandResultData {
  score: number; maxCombo: number; perfectPlus: number;
  perfects: number; goods: number; misses: number; medal: string; total: number;
  failed?: boolean; continuesUsed?: number;
  laneTelemetry?: Record<number, { hits: number; perfectPlus: number; perfects: number; goods: number; misses: number }>;
}

export type ClaimStatus = 'idle' | 'checking' | 'ready' | 'claiming' | 'claimed' | 'failed';

export interface OnDemandResultsProps {
  songId: string;
  song: GameSong | null;
  result: OnDemandResultData;
  accuracy: number;
  coverUrl?: string | null;
  theme: 'classic' | 'avant';
  medalMessage: string;
  isNewBest: boolean;
  isPractice: boolean;
  fromFreePlay: boolean;
  backRoute: string;
  backLabel: string;
  nextSong: GameSong | null;
  reward: {
    eligible: boolean;
    /** Why the prize is disabled, when not eligible. */
    blockedReason: string;
    status: ClaimStatus;
    tiers: string[];
    currentTier: string;
    onClaim: () => void;
  };
  account: {
    state: 'guest' | 'needs-username' | 'ready';
    username: string;
    onConnect: () => void;
    onClaimUsername: () => void;
  };
  onCast: () => void;
  onShare: () => Promise<'shared' | 'copied' | 'failed'>;
  onNavigate: (path: string) => void;
  quickReturn: ReactNode;
}

export default function OnDemandResults(p: OnDemandResultsProps) {
  const { songId, song, result, accuracy, coverUrl, theme, reward, account } = p;
  const passed = !result.failed;
  const [shareNote, setShareNote] = useState('');
  const medal = result.medal && result.medal !== 'NONE' ? result.medal : '';
  const accent = theme === 'avant'
    ? (passed ? '#39FF14' : '#FF1493')
    : (passed ? (MEDAL_COLOR[medal] ?? '#ff1e8c') : '#ff2a4f');
  const medalColor = MEDAL_COLOR[medal] ?? accent;
  const rank = rankFor(accuracy);
  const fullCombo = passed && result.goods === 0 && result.misses === 0;
  const hasPrize = passed && !!medal;
  const showRecord = passed && (p.isNewBest || (result.continuesUsed ?? 0) > 0);
  const prizeLabel = (t: string) => PACK_CONFIGS[t]?.label || t.toUpperCase();
  const bannerOn = hasPrize && reward.eligible && reward.status === 'ready';
  const bannerRef = useRef(bannerOn);
  bannerRef.current = bannerOn;

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
    timers.current.push(window.setTimeout(() => {
      audioManager.playSfx(MEDAL_VOICE[medal] ?? 'reveal', 0.85);
      if (fullCombo) audioManager.playSfx('perfect', 0.9);
    }, 260));
  }, [medal, fullCombo]);

  useEffect(() => {
    PRELOAD.forEach((n) => { audioManager.loadSfx(n); });
    const after = showRecord ? 600 : 0;
    const at: number[][] = passed
      ? [
          [S.title, 140], [S.portrait, 440], [S.score, 1000], [S.acc, 2000], [S.combo, 2600],
          [S.judge, 3100], [S.stamp, 3500],
          ...(showRecord ? [[S.record, 4500]] : []),
          [S.banner, 4500 + after], [S.actions, 5100 + after],
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
    return () => { timers.current.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sounds + impacts, fired as each step is reached (not when skipped past).
  useEffect(() => {
    if (skippedRef.current || step === 0) return;
    switch (step) {
      case S.title:
        audioManager.playSfx('cas_slam_down', 0.75);
        impact(1, passed ? '#fff3c4' : accent);
        break;
      case S.portrait: audioManager.playSfx('swipe', 0.5); break;
      case S.acc: case S.combo: case S.judge: audioManager.playSfx('tap_perfect', 0.45); break;
      case S.stamp:
        if (passed) { playStamp(); impact(1.2, medalColor); }
        break;
      case S.record: audioManager.playSfx('hidden_secret_found', 0.55); break;
      case S.banner:
        if (bannerRef.current) { audioManager.playSfx('new_modes_available', 0.7); impact(0.6, '#ffd23f'); }
        break;
      case S.actions: audioManager.playSfx('swipe', 0.3); break;
    }
  }, [step, passed, impact, playStamp, medalColor, accent]);

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

  const go = (path: string) => { audioManager.playSfx('tap_nav', 0.15); p.onNavigate(path); };
  // Replays keep the art this run was played with; "up next" uses the player's saved cover.
  const retry = () => { primeGameCover(song?.day, coverUrl); go(`/play/${songId}`); };

  const on = (s: number) => (step >= s ? ' is-on' : '');
  const locked = (s: number) => (step > s ? ' is-locked' : '');
  const titleWords = passed ? ['Stage', 'Clear!'] : ['K.O.'];
  let li = 0;

  const lanes = result.laneTelemetry
    ? LANES.map((lane, i) => {
        const d = result.laneTelemetry?.[i];
        if (!d || d.hits <= 0) return null;
        return { ...lane, acc: Math.round(((d.perfectPlus + d.perfects * 0.9 + d.goods * 0.5) / d.hits) * 100) };
      })
    : [];
  const hasLanes = lanes.some(Boolean);

  return (
    <div
      ref={rootRef}
      className="cs-page cr-root cr-od"
      data-result={passed ? 'win' : 'lose'}
      data-theme={theme}
      data-skipped={skipped ? 'true' : undefined}
      onPointerDown={step < FINAL ? skip : undefined}
      style={{ ['--ch' as string]: accent, ['--medal' as string]: medalColor, maxWidth: 980 } as CSSProperties}
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
          ? `Stage clear. Score ${result.score.toLocaleString()}, accuracy ${Math.round(accuracy)} percent, ${medal ? `${medal.toLowerCase()} medal` : 'no medal'}.`
          : `Stage failed. Score ${result.score.toLocaleString()}, accuracy ${Math.round(accuracy)} percent.`}
      </p>

      <nav className="cr-hud" aria-label="Results">
        <button type="button" className="cs-chip-btn" onClick={() => go(p.backRoute)}>
          <ArrowLeft size={16} /> {p.backLabel.toLowerCase()}
        </button>
        <div className="cr-hud-right">
          {p.isPractice && <span className="cr-chip" data-tone="warn">Practice mode</span>}
          <span className="cr-chip">{p.fromFreePlay ? 'Award play' : 'Free play'}</span>
          {song && <span className="cr-chip" data-tone="hot">Day {song.day} · {song.bpm} bpm</span>}
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
        {passed ? (fullCombo ? 'Full combo · ' + p.medalMessage : p.medalMessage) : 'No medal · out of continues'}
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
            <span>th3scr1b3 · Day {song?.day ?? '—'}</span>
            <b>{song?.title ?? `Transmission ${songId}`}</b>
          </div>

          {passed && (
            <div className={`cr-stamp cr-in${on(S.stamp)}`} aria-hidden="true">
              <div className="cr-stamp-rays" />
              <div className="cr-stamp-disc">
                <span className="cr-stamp-rank">{rank}</span>
                <span className="cr-stamp-name">{medal || 'No medal'}</span>
              </div>
              {step >= S.stamp && <Sparks />}
            </div>
          )}
        </div>

        <div className="cr-board">
          <div className="cr-board-tab">{passed ? 'Result' : 'Damage report'}</div>
          <TallyRow className={on(S.score) + locked(S.score)} label="Score"
            to={result.score} run={step >= S.score} done={skipped || step > S.score} ms={900}
            fmt={(v) => Math.round(v).toLocaleString()} testId="text-final-score" />
          <TallyRow className={on(S.acc) + locked(S.acc)} label="Accuracy"
            to={accuracy} run={step >= S.acc} done={skipped || step > S.acc} ms={520}
            fmt={(v) => `${v.toFixed(1)}%`} />
          <TallyRow className={on(S.combo) + locked(S.combo)} label="Max combo"
            to={result.maxCombo} run={step >= S.combo} done={skipped || step > S.combo} ms={420}
            fmt={(v) => `${Math.round(v)}x`} />
          <div className={`cr-judge cr-in${on(S.judge)}`}>
            <span data-j="pp">P+ {result.perfectPlus}</span>
            <span data-j="p">P {result.perfects}</span>
            <span data-j="g">G {result.goods}</span>
            <span data-j="m">Miss {result.misses}</span>
          </div>
          {hasLanes && (
            <div className={`cr-lanes cr-in${on(S.judge)}`}>
              {lanes.map((l, i) => l && (
                <div key={i} className="cr-lane" style={{ ['--lane' as string]: l.color } as CSSProperties}>
                  <span>{l.label}</span>
                  <i style={{ width: `${l.acc}%` }} />
                  <b>{l.acc}%</b>
                </div>
              ))}
            </div>
          )}

          {passed && (
            <div className={`cr-record cr-in${on(S.record)}`}>
              {p.isNewBest && <b className="cr-rainbow">New best!!</b>}
              {(result.continuesUsed ?? 0) > 0 && (
                <span className="cr-continues">
                  {result.continuesUsed} {result.continuesUsed === 1 ? 'continue' : 'continues'} used
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {bannerOn && (
        <div className={`cr-banner cr-in${on(S.banner)}`} role="note">
          <div className="cr-banner-head">{reward.tiers.length > 1 ? 'Platinum bundle!' : 'Prize unlocked!'}</div>
          <div className="cr-banner-sub">
            {reward.tiers.length > 1 ? `${reward.tiers.length} PRIZES READY TO CLAIM` : `${prizeLabel(reward.tiers[0] || reward.currentTier)} READY TO CLAIM`}
          </div>
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
            <p className="cs-hook">Finish the song to earn a medal.</p>
            <div className="cs-detail-actions">
              <button type="button" className="btn-3d" data-testid="button-retry" onClick={retry}>
                <RotateCcw size={16} /> Retry
              </button>
              <span className="cr-blink">Insert coin</span>
            </div>
          </div>
        )}

        {hasPrize && (
          <div className="cr-card" data-tone="prize">
            <div className="cr-card-tab">Prize</div>
            {!reward.eligible ? (
              <div className="cs-lock-note">
                <Lock size={14} style={{ verticalAlign: '-2px' }} /> {reward.blockedReason}
              </div>
            ) : reward.status === 'ready' ? (
              <>
                <button type="button" className="btn-3d cr-claim" data-tone="gold" onClick={reward.onClaim}>
                  {reward.tiers.length > 1
                    ? `Claim platinum bundle (${reward.tiers.length})`
                    : `Claim ${prizeLabel(reward.tiers[0] || reward.currentTier)}`}
                </button>
                {reward.tiers.length > 1 && (
                  <div className="cr-bundle">
                    {reward.tiers.map((t) => (
                      <span key={t} style={{ ['--tier' as string]: PACK_CONFIGS[t]?.accent || '#ff1493' } as CSSProperties}>
                        {PACK_CONFIGS[t]?.icon || '🎁'} {prizeLabel(t)}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : reward.status === 'claiming' ? (
              <button type="button" className="btn-3d cr-claim" data-tone="quiet" disabled>
                <span className="cr-spin" /> Claiming reward…
              </button>
            ) : reward.status === 'claimed' ? (
              <button type="button" className="btn-3d cr-claim" data-tone="quiet" disabled>✓ Reward claimed</button>
            ) : reward.status === 'failed' ? (
              <button type="button" className="btn-3d cr-claim" data-tone="vermilion" onClick={reward.onClaim}>
                Claim failed · tap to retry
              </button>
            ) : (
              <p className="cs-hook">Checking your prize…</p>
            )}
          </div>
        )}

        {passed && (
          <div className="cr-card">
            <div className="cr-card-tab">{p.fromFreePlay && p.nextSong ? 'Up next' : 'Continue'}</div>
            {p.fromFreePlay && p.nextSong ? (
              <>
                <div className="cr-next">
                  <div className="cr-next-art">
                    {resolvePreferredCover(p.nextSong) && <img src={resolvePreferredCover(p.nextSong)!} alt="" onError={hideBroken} />}
                    <span className="cr-vs">VS</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cs-eyebrow">Day {p.nextSong.day}</div>
                    <div className="cr-next-title">{p.nextSong.title}</div>
                  </div>
                </div>
                <div className="cs-detail-actions">
                  <button type="button" className="btn-3d" onClick={() => go(`/play/${p.nextSong!.id}`)}>
                    <Play size={16} fill="currentColor" /> Play day {p.nextSong.day}
                  </button>
                  <span className="cr-blink">Press start</span>
                </div>
              </>
            ) : (
              <div className="cs-detail-actions">
                <button type="button" className="btn-3d" onClick={() => go(p.backRoute)}>
                  <ArrowLeft size={16} /> Back to {p.backLabel.toLowerCase()}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="cr-card" data-tone="quiet">
          <div className="cr-card-tab">Your score</div>
          {account.state === 'guest' ? (
            <>
              <p className="cs-hook"><b>Sign in to save this score.</b> Sign in to keep this run and post it to the global rankings. Your high score stays on this device until then.</p>
              <div className="cs-detail-actions">
                <button type="button" className="btn-3d" onClick={account.onConnect}>Sign in</button>
              </div>
            </>
          ) : account.state === 'needs-username' ? (
            <>
              <p className="cs-hook"><b>Pick a @username to post scores.</b> Your username and avatar show on the leaderboards.</p>
              <div className="cs-detail-actions">
                <button type="button" className="btn-3d" data-tone="gold" onClick={account.onClaimUsername}>Claim @username & avatar</button>
              </div>
            </>
          ) : (
            <div className="cr-live"><i /> Posting scores as <b>@{account.username}</b></div>
          )}
          <div className="cs-detail-actions">
            <button type="button" className="btn-3d cr-cast" data-tone="quiet" data-testid="button-cast-score" onClick={p.onCast}>
              <Share2 size={15} /> Cast score
            </button>
            {passed && (
              <button type="button" className="btn-3d" data-tone="quiet" onClick={() => { void p.onShare().then((r) => setShareNote(r === 'copied' ? 'Link copied' : '')); }}>
                <Share2 size={15} /> {shareNote || 'Share link'}
              </button>
            )}
          </div>
        </div>

        {passed && (
          <div className="cr-card cr-board-card" data-span="full">
            <div className="cr-card-tab">High scores</div>
            <SongLeaderboard
              songId={songId}
              currentScore={result.score}
              currentAccuracy={Math.round(accuracy)}
              currentMaxCombo={result.maxCombo}
              currentMedal={result.medal}
              defaultLimit={5}
            />
          </div>
        )}
      </section>

      <div className={`cr-foot cr-in${on(S.actions)}`}>
        {passed && (
          <button type="button" className="btn-3d" data-tone="quiet" data-testid="button-retry" onClick={retry}>
            <RotateCcw size={16} /> Retry
          </button>
        )}
        {!passed && (
          <button type="button" className="btn-3d" data-tone="ghost" onClick={() => go(p.backRoute)}>
            <ArrowLeft size={16} /> Back to {p.backLabel.toLowerCase()}
          </button>
        )}
        <button type="button" className="btn-3d" data-tone="ghost" data-testid="button-select-song"
          onClick={() => go(p.fromFreePlay ? '/songs' : '/campaign')}>
          <Home size={16} /> {p.fromFreePlay ? 'Award play' : 'Campaign'}
        </button>
        {import.meta.env.DEV && passed && (
          <button type="button" className="btn-3d" data-tone="ghost"
            title="Export frame-perfect 100% PERFECT+ run video (DEV ONLY)"
            onClick={() => { sessionStorage.setItem(`export_video_${songId}`, 'true'); p.onNavigate(`/play/${songId}`); }}>
            <Film size={16} /> Export video
          </button>
        )}
      </div>
      <div className={`cr-quick cr-in${on(S.actions)}`}>{p.quickReturn}</div>

      {step < FINAL && (
        <button type="button" className="cr-skip" onClick={skip}>Tap to skip ▸▸</button>
      )}
    </div>
  );
}

function TallyRow({ className, label, to, run, done, ms, fmt, testId }: {
  className: string; label: string; to: number; run: boolean; done: boolean; ms: number;
  fmt: (v: number) => string; testId?: string;
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
      <span className="cr-row-val" data-testid={testId}>{fmt(v)}</span>
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
