// The monthly build's endings (rules in src/platform/playgama/endings.ts). Each
// is a short sequence of full-screen scenes over one of the month's songs,
// written from the chapter story: the act words and their lyric lines, the
// epilogue, the covers, and for the last two the credits. Scenes advance on
// their own or with a tap; Skip leaves at any time. Watching marks it seen.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useParams } from 'wouter';
import { Lock, MessageCircle } from 'lucide-react';
import { loadCatalog, type GameSong } from '@/game/api';
import { CHAPTERS } from '@/game/campaign';
import { getMedalForSong } from '@/game/progress';
import { chapterProgress, getMonthStory, songsForMonth, type ChapterProgress, type MonthStory } from '@/game/chapterStory';
import { audioManager } from '@/game/audio';
import { PLAYGAMA_MONTH } from '@/platform/playgama/month';
import { externalLinksAllowed } from '@/platform/playgama/bridge';
import {
  ENDING_INFO, ENDING_ORDER, endingStates, finalPiecePath, markEndingSeen, type EndingId,
} from '@/platform/playgama/endings';
import { hideBroken } from '@/pages/campaign/hideBroken';
import { SlamTitle } from '@/pages/campaign/arcade';
import { bombshellArtFor } from './startRun';
import '@/styles/campaignArcade.css';
import '@/styles/monthEnding.css';

const HOME = `/chapter/${PLAYGAMA_MONTH}`;
const DISCORD_INVITE = 'https://discord.gg/x3wSdrpJeV';
const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#FFC21A', SILVER: '#C9D3E6', BRONZE: '#E08A45',
};
const pad = (n: number) => String(n).padStart(2, '0');
const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];

export interface Scene {
  key: string;
  /** Milliseconds before moving on; the last scene waits for the player. */
  ms: number;
  body: ReactNode;
}

interface Data {
  songs: GameSong[];
  progress: ChapterProgress;
  story: MonthStory | undefined;
}

export default function MonthEnding() {
  const { id = '' } = useParams<{ id: string }>();
  const ending = (ENDING_ORDER as string[]).includes(id) ? (id as EndingId) : null;
  const [, setLocation] = useLocation();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    if (!ending) { setLocation(HOME, { replace: true }); return; }
    let alive = true;
    loadCatalog().then((catalog) => {
      if (!alive) return;
      const songs = songsForMonth(catalog, PLAYGAMA_MONTH);
      const progress = chapterProgress(songs, meta);
      // Only an earned ending plays (replays come from the Endings panel, which lists earned ones).
      if (!endingStates(songs, progress).find((e) => e.id === ending)?.earned) {
        setLocation(HOME, { replace: true });
        return;
      }
      markEndingSeen(ending);
      setData({ songs, progress, story: getMonthStory(PLAYGAMA_MONTH) });
    }).catch(() => setLocation(HOME, { replace: true }));
    return () => { alive = false; };
  }, [ending, setLocation]);

  if (!ending || !data) return <div className="me-root" />;
  return <EndingPlayer ending={ending} data={data} onDone={() => setLocation(HOME)} />;
}

function EndingPlayer({ ending, data, onDone }: { ending: EndingId; data: Data; onDone: () => void }) {
  const scenes = useMemo(() => buildScenes(ending, data), [ending, data]);
  return (
    <ScenePlayer scenes={scenes} music={musicFor(ending, data)} kind={ending}
      tone={ending === 'bombshell' ? '#ff1493' : meta.dc} onDone={onDone} />
  );
}

/**
 * Full-screen scenes over one of the month's songs: each advances on its own
 * or with a tap, Skip leaves at any time, and the last waits for the player.
 * The endings and the story scenes (MonthStoryScene.tsx) both play through it.
 */
export function ScenePlayer({ scenes, music, kind, tone, doneLabel = 'Continue', onDone }: {
  scenes: Scene[];
  music: GameSong | undefined;
  /** data-ending on the root, for per-sequence styling. */
  kind: string;
  tone: string;
  doneLabel?: string;
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const last = idx >= scenes.length - 1;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicUrl = music?.audioUrl;

  // The month's music under the sequence, faded in and out.
  useEffect(() => {
    if (!musicUrl) return;
    const a = new Audio(musicUrl);
    a.volume = 0;
    a.loop = true;
    audioRef.current = a;
    a.play().catch(() => {});
    const fade = window.setInterval(() => {
      if (a.volume < 0.5) a.volume = Math.min(0.5, a.volume + 0.02);
      else clearInterval(fade);
    }, 80);
    return () => {
      clearInterval(fade);
      a.pause();
      a.removeAttribute('src');
      try { a.load(); } catch { /* ignore */ }
    };
  }, [musicUrl]);

  useEffect(() => {
    if (last) return;
    const t = window.setTimeout(() => setIdx((i) => Math.min(i + 1, scenes.length - 1)), scenes[idx].ms);
    return () => clearTimeout(t);
  }, [idx, last, scenes]);

  const next = useCallback(() => {
    if (!last) { audioManager.playSfx('tap_nav', 0.15); setIdx((i) => i + 1); }
  }, [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); if (last) onDone(); else next(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, next, onDone]);

  const scene = scenes[idx];
  return (
    <div className="me-root" data-ending={kind} style={{ ['--ch' as string]: tone } as CSSProperties} onClick={next}>
      <div className="me-bg" aria-hidden="true" />
      <div key={scene.key} className="me-scene">{scene.body}</div>
      <div className="me-foot" onClick={(e) => e.stopPropagation()}>
        <div className="me-dots" aria-hidden="true">
          {scenes.map((s, i) => <span key={s.key} data-on={i <= idx || undefined} />)}
        </div>
        {last
          ? <button type="button" className="btn-3d" onClick={onDone}>{doneLabel}</button>
          : <button type="button" className="me-skip" onClick={onDone}>Skip ▸▸</button>}
      </div>
    </div>
  );
}

/** Which of the month's songs plays under an ending. */
function musicFor(ending: EndingId, { songs, progress, story }: Data): GameSong | undefined {
  const byDay = (day?: number) => (day ? songs.find((s) => s.day === day) : undefined);
  if (ending === 'clear') return progress.regular[progress.regular.length - 1];
  if (ending === 'epilogue') return byDay(story?.epilogue?.close?.day) ?? songs[songs.length - 1];
  if (ending === 'true') return byDay(story?.prologue.day) ?? songs[0];
  return byDay(story?.epilogue?.open.day) ?? songs[0];
}

function buildScenes(ending: EndingId, { songs, progress, story }: Data): Scene[] {
  const titleOf = (day?: number) => songs.find((s) => s.day === day)?.title;
  const chapterChip = <div className="ca-hud me-hud"><span className="ca-chip" data-tone="hot">Chapter {pad(meta.month)}</span><span className="ca-chip">{meta.name}</span></div>;
  const intro: Scene = {
    key: 'intro',
    ms: 3800,
    body: <>{chapterChip}<SlamTitle text={ENDING_INFO[ending].title} className="ca-title--ch me-title" /></>,
  };
  const acts = story?.acts ?? [];
  const epilogue = story?.epilogue ?? null;
  const plats = songs.filter((s) => getMedalForSong(s.id) === 'PLATINUM').length;

  if (ending === 'clear') {
    return [
      intro,
      ...acts.map((a): Scene => {
        const beat = a.close ?? a.open;
        return {
          key: `act-${a.act}`,
          ms: 6000,
          body: (
            <>
              <div className="ca-hud me-hud"><span className="ca-chip" data-tone="hot">Act {a.act}</span></div>
              <SlamTitle text={a.word} className="ca-title--ch me-word" />
              <Line text={beat.line} />
              <Cite day={beat.day} title={titleOf(beat.day)} />
            </>
          ),
        };
      }),
      {
        key: 'board',
        ms: 6000,
        body: (
          <>
            <p className="me-kicker">{progress.regular.length} tracks. Your run.</p>
            <CoverGrid songs={progress.regular} medals />
          </>
        ),
      },
      {
        key: 'cliff',
        ms: 0,
        body: (
          <>
            <div className="me-locked">
              {progress.bonus.map((s) => <span key={s.id}><Lock size={18} /></span>)}
            </div>
            <h2 className="me-redacted">Epilogue · <span>{'█'.repeat(Math.max(4, epilogue?.word.length ?? 6))}</span></h2>
            <p className="me-line">The year isn't done with you.</p>
            <p className="me-hint">
              {progress.bonusUnlocked
                ? `The ${progress.bonus.length} bonus tracks are open. Clear them to finish the story.`
                : `Earn ${meta.platNeeded} platinum medals to open the ${progress.bonus.length} bonus tracks (${progress.platinums} so far), or unlock them from the chapter.`}
            </p>
          </>
        ),
      },
    ];
  }

  if (ending === 'epilogue') {
    return [
      intro,
      {
        key: 'reveal',
        ms: 4500,
        body: (
          <>
            <h2 className="me-redacted me-reveal">
              <span className="me-bar">{'█'.repeat(Math.max(4, epilogue?.word.length ?? 6))}</span>
              <span className="me-word-in">{epilogue?.word ?? 'Epilogue'}</span>
            </h2>
          </>
        ),
      },
      ...(epilogue ? [epilogue.open, epilogue.close].filter(Boolean).map((b, i): Scene => ({
        key: `line-${i}`,
        ms: 6500,
        body: <><Line text={b!.line} /><Cite day={b!.day} title={titleOf(b!.day)} /></>,
      })) : []),
      {
        key: 'mosaic',
        ms: 0,
        body: (
          <>
            <CoverGrid songs={songs} />
            <p className="me-line">{songs.length} tracks. {plats} of {songs.length} platinum.</p>
            {plats < songs.length && <p className="me-hint">th3scr1b3 didn't stop at good enough.</p>}
          </>
        ),
      },
    ];
  }

  if (ending === 'true') {
    return [
      intro,
      ...(story ? [{
        key: 'prologue',
        ms: 6000,
        body: <><div className="ca-hud me-hud"><span className="ca-chip">Prologue</span></div><Line text={story.prologue.line} /><Cite day={story.prologue.day} title={titleOf(story.prologue.day)} /></>,
      }] : []),
      ...acts.map((a): Scene => ({
        key: `act-${a.act}`,
        ms: 5500,
        body: (
          <>
            <div className="ca-hud me-hud"><span className="ca-chip" data-tone="hot">Act {a.act}</span></div>
            <SlamTitle text={a.word} className="ca-title--ch me-word" />
            <Line text={a.open.line} />
          </>
        ),
      })),
      ...(epilogue ? [{
        key: 'epilogue',
        ms: 6000,
        body: (
          <>
            <div className="ca-hud me-hud"><span className="ca-chip" data-tone="hot">Epilogue</span></div>
            <SlamTitle text={epilogue.word} className="ca-title--ch me-word" />
            {epilogue.close && <Line text={epilogue.close.line} />}
          </>
        ),
      }] : []),
      {
        key: 'credit-card',
        ms: 7000,
        body: (
          <div className="me-credit-card">
            <p className="me-credit-head">PIM: Poetry in Motion</p>
            <p>Chapter {pad(meta.month)} · {meta.name}</p>
            <p className="me-credit-gap">Music by</p>
            <p className="me-credit-big">th3scr1b3</p>
            <p className="me-credit-big">th3scr1b3 is Bryan Meason</p>
          </div>
        ),
      },
      { key: 'credits', ms: 26000, body: <Credits songs={songs} /> },
      {
        key: 'next',
        ms: 0,
        body: (
          <>
            <SlamTitle text={`Chapter ${pad(meta.month)} complete`} className="ca-title--ch me-word" />
            <p className="me-line">{meta.month < 12 ? `${12 - meta.month} to go.` : 'The year is complete.'}</p>
            <p className="me-hint">Listening mode unlocked: every song of {meta.name.toLowerCase()} with its lyrics, on the chapter screen.</p>
            <p className="me-hint">One more ending is hidden here: platinum every Deluxe chart.</p>
          </>
        ),
      },
    ];
  }

  // bombshell
  const art = songs.map((s) => ({ s, url: bombshellArtFor(s) })).filter((x) => !!x.url);
  return [
    intro,
    {
      key: 'gallery',
      ms: Math.max(7000, art.length * 220 + 3500),
      body: (
        <div className="me-gallery">
          {art.map(({ s, url }, i) => (
            <img key={s.id} src={url!} alt="" style={{ ['--i' as string]: i } as CSSProperties} onError={hideBroken} />
          ))}
        </div>
      ),
    },
    { key: 'final', ms: 9000, body: <FinalPiece /> },
    {
      key: 'count',
      ms: 6000,
      body: (
        <>
          <SlamTitle text={`${songs.length * 2} platinums`} className="ca-title--gold me-word" />
          <p className="me-line">You heard every one.</p>
        </>
      ),
    },
    {
      key: 'thanks',
      ms: 0,
      body: (
        <>
          <p className="me-credit-big">th3scr1b3 is Bryan Meason</p>
          <p className="me-line">Thank you for playing every note of {meta.name.toLowerCase()}.</p>
          {externalLinksAllowed() && (
            <a className="btn-3d" data-tone="quiet" href={DISCORD_INVITE} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
              <MessageCircle size={16} /> Join the Discord
            </a>
          )}
        </>
      ),
    },
  ];
}

export function Line({ text }: { text: string }) {
  return <p className="me-lyric">“{text}”</p>;
}

export function Cite({ day, title }: { day: number; title?: string }) {
  return <p className="me-cite">Day {day}{title ? ` · ${title}` : ''}</p>;
}

function CoverGrid({ songs, medals }: { songs: GameSong[]; medals?: boolean }) {
  return (
    <div className="me-grid" style={{ ['--n' as string]: songs.length } as CSSProperties}>
      {songs.map((s, i) => {
        const medal = getMedalForSong(s.id);
        return (
          <span key={s.id} style={{ ['--i' as string]: i } as CSSProperties}>
            {s.coverArt && <img src={s.coverArt} alt="" onError={hideBroken} />}
            {medals && <i style={{ background: MEDAL_COLOR[medal] ?? 'transparent' }} />}
          </span>
        );
      })}
    </div>
  );
}

function Credits({ songs }: { songs: GameSong[] }) {
  return (
    <div className="me-credits">
      <div className="me-credits-roll">
        <p className="me-credit-gap">365 Days of Light and Dark</p>
        <p>One song a day for a year</p>
        <p className="me-credit-gap">Tracks</p>
        {songs.map((s) => <p key={s.id}>Day {s.day} · {s.title}</p>)}
        <p className="me-credit-gap me-credit-big">Thank you for playing</p>
      </div>
    </div>
  );
}

/** The month's one-off Bombshell piece; without one, the gallery is the reward. */
function FinalPiece() {
  const [missing, setMissing] = useState(false);
  return missing ? (
    <>
      <SlamTitle text="The full gallery" className="ca-title--gold me-word" />
      <p className="me-line">Every Bombshell piece of {meta.name.toLowerCase()} is yours.</p>
    </>
  ) : (
    <div className="me-final">
      <img src={finalPiecePath()} alt={`${meta.name} final Bombshell piece`} onError={() => setMissing(true)} />
    </div>
  );
}
