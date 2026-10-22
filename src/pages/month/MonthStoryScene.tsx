// Story scenes of the monthly build (rules in src/platform/playgama/storyScenes.ts):
// the prologue when the chapter first opens, and an act's title card before
// the first run of its opening track. They play through the endings' scene
// player, so they look and skip the same way. With ?next=/play/... the last
// scene's button starts that run; otherwise it goes back to the chapter.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useParams, useSearch } from 'wouter';
import { loadCatalog, type GameSong } from '@/game/api';
import { CHAPTERS } from '@/game/campaign';
import { getMonthStory, MOOD_LABEL, songsForMonth, splitChapter, type MonthStory, type StoryBeat } from '@/game/chapterStory';
import { PLAYGAMA_MONTH } from '@/platform/playgama/month';
import { markStorySeen, type StorySceneId } from '@/platform/playgama/storyScenes';
import { SlamTitle } from '@/pages/campaign/arcade';
import { Cite, Line, ScenePlayer, type Scene } from './MonthEnding';
import '@/styles/campaignArcade.css';
import '@/styles/monthEnding.css';

const HOME = `/chapter/${PLAYGAMA_MONTH}`;
const pad = (n: number) => String(n).padStart(2, '0');
const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];

export default function MonthStoryScene() {
  const { id = '' } = useParams<{ id: string }>();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const story = getMonthStory(PLAYGAMA_MONTH);
  const [songs, setSongs] = useState<GameSong[] | null>(null);

  // Only a run of this game is a place to go next.
  const nextPath = useMemo(() => {
    const next = new URLSearchParams(search).get('next');
    return next && next.startsWith('/play/') ? next : null;
  }, [search]);
  const valid = !!story && (id === 'prologue' || story.acts.some((a) => `act-${a.act}` === id));

  useEffect(() => {
    if (!valid) { setLocation(nextPath ?? HOME, { replace: true }); return; }
    markStorySeen(id as StorySceneId);
    let alive = true;
    loadCatalog()
      .then((catalog) => { if (alive) setSongs(songsForMonth(catalog, PLAYGAMA_MONTH)); })
      .catch(() => { if (alive) setSongs([]); });
    return () => { alive = false; };
  }, [id, valid, nextPath, setLocation]);

  const built = useMemo(
    () => (valid && story && songs ? buildScenes(id, story, songs, !!nextPath) : null),
    [id, valid, story, songs, nextPath],
  );

  if (!built) return <div className="me-root" />;
  return (
    <ScenePlayer
      scenes={built.scenes}
      music={built.music}
      kind="story"
      tone={meta.dc}
      doneLabel={nextPath ? 'Play' : 'Continue'}
      onDone={() => setLocation(nextPath ?? HOME, { replace: !!nextPath })}
    />
  );
}

function buildScenes(id: string, story: MonthStory, songs: GameSong[], toRun: boolean): { scenes: Scene[]; music?: GameSong } {
  const byDay = (day?: number) => (day ? songs.find((s) => s.day === day) : undefined);
  const chapterChip = (extra?: ReactNode) => (
    <div className="ca-hud me-hud">
      <span className="ca-chip" data-tone="hot">Chapter {pad(meta.month)}</span>
      {extra}
    </div>
  );
  const { regular, bonus } = splitChapter(songs);

  if (id === 'prologue') {
    const p = story.prologue;
    const scenes: Scene[] = [
      { key: 'title', ms: 3800, body: <>{chapterChip(<span className="ca-chip">Prologue</span>)}<SlamTitle text={meta.name} className="ca-title--ch me-title" /></> },
      {
        key: 'line',
        ms: 6500,
        body: p.lyric
          ? <><Line text={p.line} /><Cite day={p.day} title={byDay(p.day)?.title} /></>
          : <p className="me-line">{p.line}</p>,
      },
    ];
    if (story.words.length) {
      scenes.push({
        key: 'words',
        ms: 6000,
        body: (
          <>
            <p className="me-kicker">This month is about</p>
            <ul className="me-words">
              {story.words.slice(0, 8).map((w, i) => <li key={w} style={{ ['--i' as string]: i } as CSSProperties}>{w}</li>)}
            </ul>
          </>
        ),
      });
    }
    scenes.push({
      key: 'acts',
      ms: 0,
      body: (
        <>
          <p className="me-kicker">{regular.length} tracks in {story.acts.length} acts{bonus.length ? `, then an epilogue of ${bonus.length}` : ''}</p>
          <ol className="me-acts">
            {story.acts.map((a) => (
              <li key={a.act}><small>Act {a.act}</small><b>{a.word}</b></li>
            ))}
          </ol>
          <p className="me-hint">Each act opens with its own scene. Replay any of them from Story on the chapter screen.</p>
        </>
      ),
    });
    return { scenes, music: byDay(p.day) ?? songs[0] };
  }

  const act = story.acts.find((a) => `act-${a.act}` === id)!;
  const opener = regular.find((s) => s.day >= act.fromDay && s.day <= act.toDay);
  const beats: { key: string; label: string; beat: StoryBeat }[] = [
    { key: 'open', label: 'Opens', beat: act.open },
    ...(act.turn ? [{ key: 'turn', label: act.turn.dir === 'lifts' ? 'The mood lifts' : 'The mood drops', beat: act.turn }] : []),
    ...(act.close ? [{ key: 'close', label: 'Lands', beat: act.close }] : []),
  ].filter((b) => !!b.beat.line);
  // The last scene waits for the player and says where the act runs.
  const where = (
    <p className="me-hint">
      Days {act.fromDay}–{act.toDay}{opener ? ` · ${toRun ? 'starting with' : 'opens with'} ${opener.title}` : ''}
    </p>
  );
  const scenes: Scene[] = [
    {
      key: 'title',
      ms: beats.length ? 4200 : 0,
      body: (
        <>
          {chapterChip(<><span className="ca-chip">Act {act.act}</span>{MOOD_LABEL[act.mood] && <span className="ca-chip">{MOOD_LABEL[act.mood]}</span>}</>)}
          <SlamTitle text={act.word} className="ca-title--ch me-word" />
          {act.themes.length > 0 && <p className="me-cite">{act.themes.join(' · ')}</p>}
          {!beats.length && where}
        </>
      ),
    },
    ...beats.map(({ key, label, beat }, i): Scene => ({
      key,
      ms: i === beats.length - 1 ? 0 : 6000,
      body: (
        <>
          <div className="ca-hud me-hud"><span className="ca-chip">Act {act.act}</span><span className="ca-chip" data-tone="hot">{label}</span></div>
          <Line text={beat.line!} />
          <Cite day={beat.day} title={byDay(beat.day)?.title} />
          {i === beats.length - 1 && where}
        </>
      ),
    })),
  ];
  // Music from inside the act, not the track that's about to play.
  const music = byDay(act.turn?.day) ?? byDay(act.close?.day) ?? opener;
  return { scenes, music };
}
