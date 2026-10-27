// Campaign: the year as twelve monthly chapters. Each card shows the words
// the month's tracks keep coming back to, its three acts and the shape of its
// mood arc; the top card picks up the chapter (and act) in progress. Phone first, normal page flow.
// Dressed as an arcade chapter select in the results screens' style
// (campaignArcade.css): the title slams in, the counters roll up and the
// chapter tiles drop into the grid one after another.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { Lock, CheckCircle2, Play } from 'lucide-react';
import { loadCatalog, type GameSong } from '@/game/api';
import { CHAPTERS, type ChapterMeta } from '@/game/campaign';
import { getTotalScore, getTotalPlatinums, getTotalCleared } from '@/game/progress';
import { audioManager } from '@/game/audio';
import { chapterProgress, getMonthStory, hasClearedSong, songsForMonth, type ChapterProgress } from '@/game/chapterStory';
import { ArcSpark, Highlighted, WordChips } from './storyParts';
import { hideBroken } from './hideBroken';
import { ArcadeBackdrop, CountUp, SlamTitle, StageWipe } from './arcade';
import '@/styles/stageShell.css';
import '@/styles/campaignStory.css';
import '@/styles/campaignArcade.css';

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
    return <div className="cs-page ca-root"><div className="cs-empty ca-loading">Loading campaign…</div></div>;
  }

  const current = rows.find((r) => r.unlocked && !r.progress.complete) ?? rows[rows.length - 1];
  const story = getMonthStory(current.meta.month);
  // The act the player is in: the one holding their next uncleared track.
  const nextSong = current.progress.regular.find((s) => !hasClearedSong(s));
  const nowAct = story && nextSong ? story.acts.find((a) => nextSong.day >= a.fromDay && nextSong.day <= a.toDay) : undefined;
  const pct = (p: ChapterProgress) => (p.regular.length ? Math.round((p.cleared / p.regular.length) * 100) : 0);

  return (
    <div className="cs-page ca-root" style={{ ['--ch' as string]: current.meta.dc }}>
      <StageWipe />
      <header className="cs-head ca-head">
        <ArcadeBackdrop />
        <div className="ca-hud">
          <span className="ca-chip" data-tone="hot">1P</span>
          <span className="ca-chip">365 tracks</span>
          <span className="ca-chip">12 chapters</span>
        </div>
        <SlamTitle text="Campaign" className="ca-title--gold" />
        <div className="ca-sub">The year, told in tracks</div>
        <div className="ca-scores" aria-label="Your campaign totals">
          <div><small>Cleared</small><b><CountUp to={totals.cleared} delay={500} /></b></div>
          <div><small>Platinum</small><b>✦ <CountUp to={totals.platinums} delay={650} /></b></div>
          <div><small>Score</small><b><CountUp to={totals.score} delay={800} ms={1200} /></b></div>
        </div>
      </header>

      <Link
        href={`/chapter/${current.meta.month}`}
        onClick={tap}
        className="cs-now ca-now"
        style={{ ['--ch' as string]: current.meta.dc }}
      >
        <span className="ca-tab">{current.progress.cleared > 0 ? 'Continue' : 'Player 1 start'}</span>
        <div className="cs-now-body">
          <div className="cs-eyebrow" style={{ color: current.meta.dc }}>
            {current.progress.cleared > 0 ? 'Continue' : 'Start'} · Chapter {pad(current.meta.month)} · {current.meta.sub}
          </div>
          <h2 className="cs-display">{current.meta.name}</h2>
          {story && (
            story.prologue.lyric
              ? <p className="cs-quote">“<Highlighted line={story.prologue.line} words={story.words} />”</p>
              : <p className="cs-quote" data-plain="true">{story.prologue.line}</p>
          )}
          {story && <WordChips words={story.words.slice(0, 5)} />}
          {nowAct && (
            <div className="cs-now-act">
              <small>Act {nowAct.act} · {nowAct.word}</small>
              {nextSong && <span>Up next: {nextSong.title}</span>}
            </div>
          )}
          <div className="cs-ch-foot">
            <div><span>{current.progress.cleared} / {current.progress.regular.length} tracks</span><span>{pct(current.progress)}%</span></div>
            <div className="cs-bar"><span style={{ width: `${pct(current.progress)}%` }} /></div>
          </div>
          <div className="ca-start">
            <span className="btn-3d">
              <Play size={16} fill="currentColor" /> {current.progress.cleared > 0 ? 'Continue chapter' : 'Begin chapter'}
            </span>
            <span className="ca-blink" aria-hidden="true">Press start</span>
          </div>
        </div>
        <div className="cs-mosaic" aria-hidden="true">
          {current.songs.slice(0, 9).map((s) => (s.coverArt ? <img key={s.id} src={s.coverArt} alt="" loading="lazy" onError={hideBroken} /> : <span key={s.id} />))}
        </div>
      </Link>

      <div className="ca-section-tab" aria-hidden="true">Select chapter</div>
      <section aria-label="Chapters" className="cs-grid ca-grid">
        {rows.map((row, i) => {
          const st = getMonthStory(row.meta.month);
          const { progress: p } = row;
          const locked = !row.unlocked;
          const prevName = CHAPTERS[row.meta.month - 2]?.name;
          const tileStyle = { ['--ch' as string]: row.meta.dc, ['--i' as string]: i } as CSSProperties;
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
                  <span className="cs-badge" data-tone="live"><span className="ca-cursor" aria-hidden="true">▶</span>Now</span>
                ) : (
                  <span className="cs-badge">{row.meta.diff.toLowerCase()}</span>
                )}
              </div>
              {st && <WordChips words={st.words.slice(0, 4)} redacted={locked} small />}
              {st && st.acts.length > 0 && (
                <ol className="cs-ch-acts" aria-label="The chapter's acts">
                  {st.acts.map((a) => <li key={a.act}><small>{a.act}</small>{locked ? a.word.replace(/./g, '•') : a.word}</li>)}
                </ol>
              )}
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
            <div key={row.meta.month} className="cs-ch" data-locked="true" style={tileStyle} aria-disabled="true">
              {body}
            </div>
          ) : (
            <Link
              key={row.meta.month}
              href={`/chapter/${row.meta.month}`}
              onClick={tap}
              className="cs-ch"
              data-now={row === current || undefined}
              style={tileStyle}
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
