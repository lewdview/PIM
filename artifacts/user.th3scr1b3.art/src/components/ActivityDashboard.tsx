'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock, Disc3, Gamepad2, Layers, Sparkles, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import styles from './ActivityDashboard.module.css';

/** Shape returned by the get_my_activity_summary() database function. */
interface ActivitySummary {
  listening: {
    plays: number;
    completions: number;
    uniqueSongs: number;
    daysListened: number;
    listenedSeconds: number;
    streakDays: number;
    firstPlayAt: string | null;
    lastPlayAt: string | null;
    bySite: Record<string, number>;
    topSongs: { releaseId: string; day: number | null; plays: number }[];
    recent: { releaseId: string; day: number | null; site: string; playedAt: string }[];
    calendar: { date: string; plays: number }[];
  };
  time: {
    visits: number;
    activeSeconds: number;
    bySite: Record<string, { visits: number; activeSeconds: number; lastSeenAt: string }>;
  };
  game: {
    runs: number;
    songsPlayed: number;
    bestScore: number;
    avgAccuracy: number;
    bestCombo: number;
    medals: Record<string, number>;
    recent: { songId: string; score: number; accuracy: number; medal: string; playedAt: string }[];
  };
  campaign: { milestonesClaimed: number; chaptersTouched: number };
  cards: {
    owned: number;
    packRips: number;
    echoes: number;
    totalPulls: number;
    byRarity: Record<string, number>;
  };
  sparks: { balance: number; earnedTotal: number; spentTotal: number; dailyStreak: number; sparkStreak: number; burns: number };
}

const MONTH_OFFSETS: Record<string, number> = {
  january: 0, february: 31, march: 59, april: 90, may: 120, june: 151,
  july: 181, august: 212, september: 243, october: 273, november: 304, december: 334,
};
const RARITY_ORDER = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
const MEDAL_ORDER = ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'NONE'];

const fmtDuration = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};
const fmtNumber = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n || 0));
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const siteLabel = (host: string) => host.replace(/\.th3scr1b3\.art$/, '').replace(/^th3scr1b3\.art$/, '365') || host;
const dayFromId = (id: string) => {
  const m = id.match(/(\d{1,3})$/);
  return m ? Number(m[1]) : null;
};

/** Day number -> song title, from the main site's release manifest (88 KB, CORS-open). */
function useSongTitles() {
  const [titles, setTitles] = useState<Record<number, string>>({});
  useEffect(() => {
    let cancelled = false;
    fetch('https://th3scr1b3.art/release-manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (cancelled || !Array.isArray(m?.items)) return;
        const out: Record<number, string> = {};
        for (const it of m.items) {
          const offset = MONTH_OFFSETS[String(it.month || '').toLowerCase()];
          if (offset === undefined) continue;
          out[offset + Number(it.index || 0)] = it.storageTitle;
        }
        setTitles(out);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return titles;
}

/** 26-week listening heatmap, Sunday-first columns, oldest on the left. */
function ListeningCalendar({ calendar }: { calendar: ActivitySummary['listening']['calendar'] }) {
  const cells = useMemo(() => {
    const byDate = new Map(calendar.map((c) => [c.date, c.plays]));
    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (7 * 26 - 1) - end.getUTCDay());
    const max = Math.max(1, ...calendar.map((c) => c.plays));
    const out: { date: string; plays: number; level: number }[] = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const plays = byDate.get(key) || 0;
      out.push({ date: key, plays, level: plays === 0 ? 0 : Math.min(4, Math.ceil((plays / max) * 4)) });
    }
    return out;
  }, [calendar]);

  return (
    <div className={styles.calendar} role="img" aria-label="Listening activity over the last 26 weeks">
      {cells.map((c) => (
        <span key={c.date} className={styles[`cal${c.level}`]} title={`${c.date}: ${c.plays} play${c.plays === 1 ? '' : 's'}`} />
      ))}
    </div>
  );
}

function Bars({ rows, format }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className={styles.empty}>Nothing yet.</p>;
  return (
    <ul className={styles.bars}>
      {rows.map((r) => (
        <li key={r.label}>
          <span className={styles.barLabel}>{r.label}</span>
          <span className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className={styles.barValue}>{format ? format(r.value) : fmtNumber(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ActivityDashboard() {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titles = useSongTitles();

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('get_my_activity_summary').then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) setError(rpcError.message);
      else setSummary(data as ActivitySummary);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const songName = (releaseId: string, day: number | null) => {
    const d = day ?? dayFromId(releaseId);
    return d && titles[d] ? titles[d] : d ? `Day ${d}` : releaseId;
  };

  if (error) {
    return (
      <section className={styles.panel}>
        <p className={styles.empty}>Couldn&apos;t load your activity: {error}</p>
      </section>
    );
  }
  if (!summary) {
    return (
      <section className={styles.panel} aria-busy="true">
        <p className={styles.empty}>Loading your activity…</p>
      </section>
    );
  }

  const { listening, time, game, campaign, cards, sparks } = summary;
  const tiles = [
    { icon: <Disc3 size={14} />, label: 'Song plays', value: fmtNumber(listening.plays), sub: `${fmtNumber(listening.uniqueSongs)} songs` },
    { icon: <Clock size={14} />, label: 'Time listening', value: fmtDuration(listening.listenedSeconds), sub: `${fmtNumber(listening.completions)} finished` },
    { icon: <Activity size={14} />, label: 'Listening streak', value: `${listening.streakDays}d`, sub: `${fmtNumber(listening.daysListened)} days total` },
    { icon: <Layers size={14} />, label: 'Time on th3scr1b3', value: fmtDuration(time.activeSeconds), sub: `${fmtNumber(time.visits)} visits` },
    { icon: <Gamepad2 size={14} />, label: 'PIM runs', value: fmtNumber(game.runs), sub: `best ${fmtNumber(game.bestScore)}` },
    { icon: <Trophy size={14} />, label: 'Chapters', value: fmtNumber(campaign.chaptersTouched), sub: `${fmtNumber(campaign.milestonesClaimed)} milestones` },
    { icon: <Layers size={14} />, label: 'Card rips', value: fmtNumber(cards.packRips), sub: `${fmtNumber(cards.owned)} cards owned` },
    { icon: <Sparkles size={14} />, label: 'Sparks', value: fmtNumber(sparks.balance), sub: `${fmtNumber(sparks.earnedTotal)} earned` },
  ];

  const siteTime = Object.entries(time.bySite)
    .map(([site, v]) => ({ label: siteLabel(site), value: v.activeSeconds }))
    .sort((a, b) => b.value - a.value);
  const rarity = RARITY_ORDER.filter((r) => cards.byRarity[r])
    .map((r) => ({ label: r, value: cards.byRarity[r] }));
  const medals = MEDAL_ORDER.filter((m) => game.medals[m])
    .map((m) => ({ label: m.toLowerCase(), value: game.medals[m] }));

  return (
    <section className={styles.panel} aria-labelledby="activity-title">
      <header className={styles.header}>
        <Activity size={16} className={styles.headerIcon} />
        <h2 id="activity-title">Your activity across th3scr1b3</h2>
      </header>

      <div className={styles.tiles}>
        {tiles.map((t) => (
          <div key={t.label} className={styles.tile}>
            <span className={styles.tileLabel}>{t.icon}{t.label}</span>
            <span className={styles.tileValue}>{t.value}</span>
            <span className={styles.tileSub}>{t.sub}</span>
          </div>
        ))}
      </div>

      <div className={styles.block}>
        <h3>Listening, last 26 weeks</h3>
        <ListeningCalendar calendar={listening.calendar} />
      </div>

      <div className={styles.columns}>
        <div className={styles.block}>
          <h3>Most played</h3>
          {listening.topSongs.length ? (
            <ol className={styles.list}>
              {listening.topSongs.map((s) => (
                <li key={s.releaseId}>
                  <span>{songName(s.releaseId, s.day)}</span>
                  <span className={styles.muted}>{fmtNumber(s.plays)}×</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>Play a song on any layer and it shows up here.</p>
          )}
        </div>
        <div className={styles.block}>
          <h3>Time by layer</h3>
          <Bars rows={siteTime} format={fmtDuration} />
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.block}>
          <h3>PIM: th3v4ult</h3>
          <dl className={styles.facts}>
            <div><dt>Avg accuracy</dt><dd>{game.avgAccuracy}%</dd></div>
            <div><dt>Best combo</dt><dd>{fmtNumber(game.bestCombo)}</dd></div>
            <div><dt>Songs played</dt><dd>{fmtNumber(game.songsPlayed)}</dd></div>
          </dl>
          <Bars rows={medals} />
        </div>
        <div className={styles.block}>
          <h3>Vault</h3>
          <dl className={styles.facts}>
            <div><dt>Total pulls</dt><dd>{fmtNumber(cards.totalPulls)}</dd></div>
            <div><dt>Echoes</dt><dd>{fmtNumber(cards.echoes)}</dd></div>
            <div><dt>Burns</dt><dd>{fmtNumber(sparks.burns)}</dd></div>
          </dl>
          <Bars rows={rarity} />
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.block}>
          <h3>Recent plays</h3>
          {listening.recent.length ? (
            <ul className={styles.list}>
              {listening.recent.slice(0, 8).map((p) => (
                <li key={`${p.releaseId}-${p.playedAt}`}>
                  <span>{songName(p.releaseId, p.day)}</span>
                  <span className={styles.muted}>{siteLabel(p.site)} · {fmtDate(p.playedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No plays yet.</p>
          )}
        </div>
        <div className={styles.block}>
          <h3>Recent runs</h3>
          {game.recent.length ? (
            <ul className={styles.list}>
              {game.recent.slice(0, 8).map((r) => (
                <li key={`${r.songId}-${r.playedAt}`}>
                  <span>{songName(r.songId, null)}</span>
                  <span className={styles.muted}>{fmtNumber(r.score)} · {r.medal?.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No PIM runs yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
