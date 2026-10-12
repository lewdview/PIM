// ════════════════════════════════════════════════════════════════════════════════
// StageHome.tsx — The player's hub in the "Stage" shell.
// Today's song as the hero (real cover art) with its card claim and buy right on it,
// then the free pack, the spark streak, vault progress, songs to keep playing and
// the play modes.
// ════════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Flame, Gift, Headphones, Package, Play, Zap } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { getCurrentDay, formatDate, getTimeUntilNextDay } from '../utils/dayCalc';
import staticSongCatalog from '../data/song_catalog.json';
import { NAV_SECTIONS } from '../components/nav/navConfig';
import { useDailyRewards, sparksForStreakDay } from '../hooks/useDailyRewards';
import '../styles/stageShell.css';
import '../styles/stageHome.css';

interface CatalogSong {
  id: string;
  day: number;
  title: string;
  bpm?: number;
  duration?: number;
  mood?: string;
  genre?: string[];
  difficultyLevel?: number;
  coverArt?: string;
}

const catalog = (Array.isArray(staticSongCatalog) ? staticSongCatalog : []) as CatalogSong[];
const songId = (s: CatalogSong) => s.id || `day-${String(s.day).padStart(3, '0')}`;
const fmtDur = (s = 0) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
const MEDAL_STARS: Record<string, number> = { BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 3 };

function fallbackGradient(day: number, mood?: string) {
  const h = Math.abs(Math.sin(day * 12.9898) * 43758.5453) % 1;
  const light = mood !== 'dark';
  const a = light ? `hsl(${330 + h * 50} 95% 55%)` : `hsl(${250 + h * 40} 80% 45%)`;
  const b = light ? `hsl(${20 + h * 30} 100% 45%)` : `hsl(${200 + h * 60} 85% 20%)`;
  return `radial-gradient(120% 90% at ${20 + h * 60}% 0%, ${a}, transparent 60%), linear-gradient(${Math.round(h * 360)}deg, ${b}, #0b0710)`;
}

/** Cover art with a generated gradient underneath for missing or slow images. */
function Cover({ song, className, numberSize }: { song: CatalogSong; className?: string; numberSize: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`sh-cover ${className ?? ''}`} style={{ background: fallbackGradient(song.day, song.mood) }}>
      <span className="sh-cover-num" style={{ fontSize: numberSize }}>{song.day}</span>
      {song.coverArt && !failed && (
        <img src={song.coverArt} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function Pips({ n }: { n: number }) {
  return (
    <span className="pim-pips" aria-label={`Difficulty ${n} of 10`}>
      {Array.from({ length: 10 }, (_, i) => <i key={i} data-on={i < n} />)}
    </span>
  );
}

export default function StageHome() {
  const currentDay = getCurrentDay();
  const collection = useVaultStore((s) => s.collection);
  const medals = useVaultStore((s) => s.medals);
  const highScores = useVaultStore((s) => s.highScores);

  const today = catalog.find((s) => s.day === currentDay) ?? catalog[catalog.length - 1];
  const todayId = today ? songId(today) : `day-${currentDay}`;
  const t = getTimeUntilNextDay();
  const nextIn = `${t.hours}h ${String(t.minutes).padStart(2, '0')}m`;
  const daily = useDailyRewards(today?.day ?? currentDay);

  const uniqueDays = useMemo(() => new Set(collection.map((c) => c.card?.day).filter(Boolean)).size, [collection]);

  // Songs you've cleared come first (newest day first); fill with the latest releases.
  const keepPlaying = useMemo(() => {
    const released = catalog.filter((s) => s.day <= currentDay && s.day !== currentDay);
    const played = released.filter((s) => (highScores[songId(s)] ?? 0) > 0 || medals[songId(s)]);
    const rest = released.filter((s) => !played.includes(s));
    return [...played.sort((a, b) => b.day - a.day), ...rest.sort((a, b) => b.day - a.day)].slice(0, 10);
  }, [currentDay, highScores, medals]);

  const modes = NAV_SECTIONS[0].items.filter((i) => ['arcade', 'campaign', 'timeline', 'awards'].includes(i.id));

  // Spark streak: the dry run reports the streak today's check-in would make (or
  // the banked one once collected). Show the 7-day stretch that contains today.
  const sparkStreak = daily.streak;
  const banked = sparkStreak ? (sparkStreak.canClaim ? sparkStreak.streak - 1 : sparkStreak.streak) : 0;
  const todaySlot = sparkStreak?.canClaim ? banked + 1 : Math.max(banked, 1);
  const weekStart = Math.floor((todaySlot - 1) / 7) * 7 + 1;

  if (!today) return null;

  return (
    <div className="sh-page">
      <section className="sh-hero">
        <div className="sh-drop">
          <Cover song={today} className="sh-drop-art" numberSize={320} />
          <div className="sh-drop-body">
            <div className="sh-eyebrow">Today's drop · Day {today.day} of 365 · {formatDate(today.day)}</div>
            <h1>{today.title}</h1>
            <div className="sh-meta">
              <span className="pim-mood" data-mood={today.mood === 'dark' ? 'dark' : 'light'}>{today.mood === 'dark' ? 'Dark' : 'Light'}</span>
              {today.bpm ? <span>{today.bpm} BPM</span> : null}
              {today.duration ? <span>{fmtDur(today.duration)}</span> : null}
              {today.difficultyLevel ? <Pips n={today.difficultyLevel} /> : null}
            </div>
            <div className="sh-cta">
              <Link to={`/play/day-${String(today.day).padStart(3, '0')}`} className="btn-3d">
                <Play size={17} fill="currentColor" /> Play now
              </Link>
              <Link to={`/listen/${todayId}`} className="btn-3d" data-tone="ghost">
                <Headphones size={17} /> Listen
              </Link>
            </div>

            <div className="sh-daycard">
              <div className="sh-daycard-text">
                <b>{daily.hasClaimed ? `Day ${today.day} card is yours` : `Day ${today.day} card · free today`}</b>
                <small>
                  {daily.hasClaimed
                    ? `Pull another copy for ${daily.buyCost} sparks · next drop in ${nextIn}`
                    : `Rarity rolls when you claim · ${nextIn} left`}
                </small>
              </div>
              <div className="sh-daycard-actions">
                {!daily.hasClaimed && (
                  <button type="button" className="btn-3d" data-tone="gold" data-size="sm" onClick={daily.claimCard} disabled={!!daily.busy}>
                    <Gift size={15} /> Claim free
                  </button>
                )}
                <button
                  type="button"
                  className="btn-3d"
                  data-tone={daily.hasClaimed ? 'gold' : 'quiet'}
                  data-size="sm"
                  onClick={daily.buyCard}
                  disabled={!!daily.busy}
                  title={daily.canAffordBuy ? undefined : 'Not enough sparks yet'}
                >
                  <Zap size={15} /> {daily.signedIn && !daily.canAffordBuy ? 'Earn sparks' : `Buy · ${daily.buyCost}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sh-side">
          <div className={`sh-card sh-claim${daily.freePackClaimed ? ' is-done' : ''}`}>
            <span className="sh-claim-icon"><Package size={20} /></span>
            <div>
              <b>{daily.freePackClaimed ? 'Free pack opened' : 'Free pack'}</b>
              <small>{daily.freePackClaimed ? `A new one in ${nextIn}` : 'One on the house every day'}</small>
            </div>
            {daily.freePackClaimed ? (
              <Link to="/vault/collection" className="btn-3d" data-tone="quiet" data-size="sm">View</Link>
            ) : (
              <button type="button" className="btn-3d" data-tone="gold" data-size="sm" onClick={daily.openFreePack} disabled={!!daily.busy}>
                Open
              </button>
            )}
          </div>

          <div className="sh-card">
            <div className="sh-label">
              <h3>{banked > 0 ? `${banked}-day streak` : 'Start a streak'}</h3>
              <span className="sh-note">sparks every day you check in</span>
            </div>
            <div className="sh-streak" aria-label={`${banked} day spark streak`}>
              {Array.from({ length: 7 }, (_, i) => {
                const n = weekStart + i;
                const state = n <= banked ? 'on' : n === todaySlot && sparkStreak?.canClaim ? 'now' : 'off';
                return (
                  <span key={n} data-state={state}>
                    <i />
                    <small>+{sparksForStreakDay(n)}</small>
                  </span>
                );
              })}
            </div>
            <div className="sh-streak-foot">
              {!daily.signedIn ? (
                <button type="button" className="btn-3d" data-tone="quiet" data-size="sm" onClick={daily.claimStreak}>
                  <Flame size={15} /> Sign in to start
                </button>
              ) : sparkStreak?.canClaim ? (
                <button type="button" className="btn-3d" data-tone="gold" data-size="sm" onClick={daily.claimStreak} disabled={!!daily.busy}>
                  <Zap size={15} /> Collect +{sparkStreak.reward}
                </button>
              ) : (
                <span className="sh-note">{sparkStreak ? 'Collected today · come back tomorrow' : 'Streak unavailable right now'}</span>
              )}
              {sparkStreak && banked < 7 && <span className="sh-note">7 days: +100 bonus</span>}
              {sparkStreak && banked >= 7 && banked < 30 && <span className="sh-note">30 days: +300 bonus</span>}
            </div>
          </div>

          <div className="sh-card sh-vault">
            <div className="sh-label">
              <h3>Vault</h3>
              <Link to="/vault" className="sh-link">Open</Link>
            </div>
            <div className="sh-row"><span>Cards</span><b>{collection.length.toLocaleString()}</b></div>
            <div className="sh-row"><span>Unique days</span><b>{uniqueDays} / 365</b></div>
            <div className="sh-bar"><i style={{ width: `${(uniqueDays / 365) * 100}%` }} /></div>
          </div>
        </div>
      </section>

      <section className="sh-section">
        <div className="sh-label">
          <h2>Keep playing</h2>
          <Link to="/365" className="sh-link">All songs</Link>
        </div>
        <div className="sh-tiles">
          {keepPlaying.map((s) => {
            const stars = MEDAL_STARS[medals[songId(s)] ?? ''] ?? 0;
            return (
              <Link key={s.day} to={`/play/day-${String(s.day).padStart(3, '0')}`} className="sh-tile">
                <Cover song={s} numberSize={110} />
                <span className="sh-tile-shade" />
                {stars > 0 && (
                  <span className="sh-stars" aria-label={`${stars} of 3 stars`}>
                    {'★'.repeat(stars)}<span>{'★'.repeat(3 - stars)}</span>
                  </span>
                )}
                <span className="sh-tile-text">
                  <b>{s.title}</b>
                  <small>Day {s.day}{s.bpm ? ` · ${s.bpm} BPM` : ''}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="sh-section">
        <div className="sh-label"><h2>Modes</h2></div>
        <div className="sh-modes">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.id} to={m.to!} className="sh-mode">
                <span className="sh-mode-icon"><Icon size={20} /></span>
                <span><b>{m.label}</b><small>{m.desc}</small></span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
