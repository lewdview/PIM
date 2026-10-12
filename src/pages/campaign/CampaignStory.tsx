// Campaign: the year as twelve monthly chapters. Each card shows the words
// the month's tracks keep coming back to and the shape of its mood arc; the
// top card picks up the chapter in progress. Phone first, normal page flow.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Lock, CheckCircle2, Play } from 'lucide-react';
import { loadCatalog, type GameSong } from '@/game/api';
import { CHAPTERS, type ChapterMeta } from '@/game/campaign';
import { getTotalScore, getTotalPlatinums, getTotalCleared } from '@/game/progress';
import { audioManager } from '@/game/audio';
import { chapterProgress, getMonthStory, songsForMonth, type ChapterProgress } from '@/game/chapterStory';
import { ArcSpark, Highlighted, WordChips } from './storyParts';
import { hideBroken } from './hideBroken';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';

interface ChapterRow {
  meta: ChapterMeta;
  songs: GameSong[];
  progress: ChapterProgress;
  unlocked: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const tap = () => audioManager.playSfx('tap_nav', 0.12);

export default function CampaignStory() {
  const [rows, setRows] = useState<ChapterRow[] | null>(null);
  const totals = useMemo(() => ({ score: getTotalScore(), platinums: getTotalPlatinums(), cleared: getTotalCleared() }), []);

  useEffect(() => {
    let alive = true;
    loadCatalog().then((catalog) => {
      if (!alive) return;
      const data = CHAPTERS.map((meta) => {
        const songs = songsForMonth(catalog, meta.month);
        return { meta, songs, progress: chapterProgress(songs, meta), unlocked: false };
      });
      // Chapter 1 is always open; chapter N opens when N-1's regular tracks are
      // all cleared, or when the player already has clears in N.
      data.forEach((row, i) => {
        row.unlocked = i === 0 || data[i - 1].progress.complete || row.progress.cleared > 0;
      });
      setRows(data);
    });
    return () => { alive = false; };
  }, []);

  if (!rows) {
    return <div className="cs-page"><div className="cs-empty">Loading campaign…</div></div>;
  }

  const current = rows.find((r) => r.unlocked && !r.progress.complete) ?? rows[rows.length - 1];
  const story = getMonthStory(current.meta.month);
  const pct = (p: ChapterProgress) => (p.regular.length ? Math.round((p.cleared / p.regular.length) * 100) : 0);

  return (
    <div className="cs-page">
      <header className="cs-head">
        <div className="cs-eyebrow">Campaign · 365 tracks · 12 chapters</div>
        <h1 className="cs-display">The year, told in tracks</h1>
        <div className="cs-stats">
          <span><b>{totals.cleared}</b> cleared</span>
          <span><b>✦ {totals.platinums}</b> platinum</span>
          <span><b>{totals.score.toLocaleString()}</b> score</span>
        </div>
      </header>

      <Link
        href={`/chapter/${current.meta.month}`}
        onClick={tap}
        className="cs-now"
        style={{ ['--ch' as string]: current.meta.dc }}
      >
        <div className="cs-now-body">
          <div className="cs-eyebrow" style={{ color: current.meta.dc }}>
            {current.progress.cleared > 0 ? 'Continue' : 'Start'} · Chapter {pad(current.meta.month)} · {current.meta.sub}
          </div>
          <h2 className="cs-display">{current.meta.name}</h2>
          {story && (
            <p className="cs-quote">“<Highlighted line={story.prologue.line} words={story.words} />”</p>
          )}
          {story && <WordChips words={story.words.slice(0, 5)} />}
          <div className="cs-ch-foot">
            <div><span>{current.progress.cleared} / {current.progress.regular.length} tracks</span><span>{pct(current.progress)}%</span></div>
            <div className="cs-bar"><span style={{ width: `${pct(current.progress)}%` }} /></div>
          </div>
          <span className="btn-3d" style={{ justifySelf: 'start' }}>
            <Play size={16} fill="currentColor" /> {current.progress.cleared > 0 ? 'Continue chapter' : 'Begin chapter'}
          </span>
        </div>
        <div className="cs-mosaic" aria-hidden="true">
          {current.songs.slice(0, 9).map((s) => (s.coverArt ? <img key={s.id} src={s.coverArt} alt="" loading="lazy" onError={hideBroken} /> : <span key={s.id} />))}
        </div>
      </Link>

      <section aria-label="Chapters" className="cs-grid">
        {rows.map((row) => {
          const st = getMonthStory(row.meta.month);
          const { progress: p } = row;
          const locked = !row.unlocked;
          const prevName = CHAPTERS[row.meta.month - 2]?.name;
          const body = (
            <>
              <div className="cs-ch-top">
                <div className="cs-ch-num">{pad(row.meta.month)}</div>
                <div className="cs-ch-title">
                  <div className="cs-ch-name">{row.meta.name}</div>
                  <div className="cs-ch-sub">{row.meta.sub}</div>
                </div>
                {locked ? (
                  <span className="cs-badge"><Lock size={11} /> Locked</span>
                ) : p.complete ? (
                  <span className="cs-badge" data-tone="done"><CheckCircle2 size={11} /> Done</span>
                ) : row === current ? (
                  <span className="cs-badge" data-tone="live">Now</span>
                ) : (
                  <span className="cs-badge">{row.meta.diff.toLowerCase()}</span>
                )}
              </div>
              {st && <WordChips words={st.words.slice(0, 4)} redacted={locked} small />}
              <ArcSpark songs={row.songs} color={locked ? 'rgba(250,240,216,0.25)' : row.meta.dc} />
              <div className="cs-ch-foot">
                {locked ? (
                  <div><span>Finish {prevName?.toLowerCase() ?? 'the previous chapter'} to unlock</span></div>
                ) : (
                  <>
                    <div><span>{p.cleared} / {p.regular.length} tracks</span><span>✦ {p.platinums}/{row.meta.platNeeded}</span></div>
                    <div className="cs-bar"><span style={{ width: `${pct(p)}%` }} /></div>
                  </>
                )}
              </div>
            </>
          );
          return locked ? (
            <div key={row.meta.month} className="cs-ch" data-locked="true" style={{ ['--ch' as string]: row.meta.dc }} aria-disabled="true">
              {body}
            </div>
          ) : (
            <Link
              key={row.meta.month}
              href={`/chapter/${row.meta.month}`}
              onClick={tap}
              className="cs-ch"
              style={{ ['--ch' as string]: row.meta.dc }}
              aria-label={`Chapter ${row.meta.month}, ${row.meta.name}`}
            >
              {body}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
