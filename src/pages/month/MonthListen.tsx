// Listening mode, the True Ending's reward: the month's songs back to back
// with their synced lyrics (the bundled LRC files), the cover or its Bombshell
// art, and the track list. Space plays/pauses, left/right change track.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { loadCatalog, type GameSong } from '@/game/api';
import { CHAPTERS } from '@/game/campaign';
import { getMedalForSong } from '@/game/progress';
import { chapterProgress, getMonthStory, getTrackStory, songsForMonth } from '@/game/chapterStory';
import { loadLyricsForDay, type TimedLine } from '@/pages/GamePlay/trackLyrics';
import { PLAYGAMA_MONTH } from '@/platform/playgama/month';
import { endingStates } from '@/platform/playgama/endings';
import { hideBroken } from '@/pages/campaign/hideBroken';
import { bombshellArtFor } from './startRun';
import '@/styles/campaignArcade.css';
import '@/styles/monthListen.css';

const HOME = `/chapter/${PLAYGAMA_MONTH}`;
const meta = CHAPTERS.find((c) => c.month === PLAYGAMA_MONTH) ?? CHAPTERS[0];
const pad = (n: number) => String(n).padStart(2, '0');
const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}` : '0:00');

/** True once the month's True Ending is earned (platinum on every track). */
function isListeningUnlocked(songs: GameSong[]): boolean {
  return endingStates(songs, chapterProgress(songs, meta)).find((e) => e.id === 'true')?.earned ?? false;
}

export default function MonthListen() {
  const [, setLocation] = useLocation();
  const [songs, setSongs] = useState<GameSong[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadCatalog().then((catalog) => {
      if (!alive) return;
      const list = songsForMonth(catalog, PLAYGAMA_MONTH);
      if (!isListeningUnlocked(list)) { setLocation(HOME, { replace: true }); return; }
      setSongs(list);
    }).catch(() => setLocation(HOME, { replace: true }));
    return () => { alive = false; };
  }, [setLocation]);

  if (!songs) return <div className="ml-root" />;
  return <Player songs={songs} onBack={() => setLocation(HOME)} />;
}

function Player({ songs, onBack }: { songs: GameSong[]; onBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lines, setLines] = useState<TimedLine[]>([]);
  const [showBombshell, setShowBombshell] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const story = useMemo(() => getMonthStory(PLAYGAMA_MONTH), []);
  const song = songs[idx];
  const bombshell = getMedalForSong(song.id) === 'PLATINUM' ? bombshellArtFor(song) : null;
  const art = showBombshell && bombshell ? bombshell : song.coverArt;
  const act = story?.acts.find((a) => song.day >= a.fromDay && song.day <= a.toDay);

  // One audio element for the whole session; a new track swaps its source.
  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    audioRef.current = a;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.pause();
      a.removeAttribute('src');
      try { a.load(); } catch { /* ignore */ }
      audioRef.current = null;
    };
  }, []);

  // Next track when one ends, and back to the first after the last.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onEnded = () => setIdx((i) => (i + 1) % songs.length);
    a.addEventListener('ended', onEnded);
    return () => a.removeEventListener('ended', onEnded);
  }, [songs.length]);

  const startedRef = useRef(false);
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !song.audioUrl) return;
    setTime(0);
    setDuration(song.duration || 0);
    a.src = song.audioUrl;
    // Autoplay after the first track the player started themselves.
    if (startedRef.current) a.play().catch(() => {});
    let alive = true;
    setLines([]);
    loadLyricsForDay(song.day).then((l) => { if (alive) setLines(l); });
    // Scroll only the track list (scrollIntoView would also move the fixed page).
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    if (list && row) list.scrollTo({ top: row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2, behavior: 'smooth' });
    return () => { alive = false; };
  }, [song, idx]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { startedRef.current = true; a.play().catch(() => {}); }
    else a.pause();
  }, []);
  const go = useCallback((d: number) => {
    startedRef.current = startedRef.current || !!audioRef.current && !audioRef.current.paused;
    setIdx((i) => (i + d + songs.length) % songs.length);
  }, [songs.length]);
  const pick = (i: number) => { startedRef.current = true; setIdx(i); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, go, onBack]);

  const lineIdx = useMemo(() => {
    let k = -1;
    for (let i = 0; i < lines.length; i++) if (lines[i].start <= time + 0.05) k = i;
    return k;
  }, [lines, time]);
  const hook = getTrackStory(song.day);
  const total = duration || song.duration || 0;

  return (
    <div className="ml-root ca-root" style={{ ['--ch' as string]: meta.dc } as CSSProperties}>
      <div className="ml-bg" aria-hidden="true">{art && <img key={art} src={art} alt="" onError={hideBroken} />}</div>

      <header className="ml-head">
        <button type="button" className="cs-chip-btn" onClick={onBack}><ArrowLeft size={16} /> {meta.name}</button>
        <div className="ca-hud">
          <span className="ca-chip" data-tone="hot">Listening mode</span>
          <span className="ca-chip">{songs.length} tracks</span>
        </div>
      </header>

      <main className="ml-main">
        <section className="ml-now">
          <div className="ml-art">
            {art && <img key={art} src={art} alt="" onError={hideBroken} />}
            {bombshell && (
              <button type="button" className="ml-art-toggle" onClick={() => setShowBombshell((v) => !v)}>
                {showBombshell ? 'Cover' : 'Bombshell'}
              </button>
            )}
          </div>
          <div className="ml-meta">
            <div className="cs-eyebrow">Day {song.day}{act ? ` · Act ${act.act} · ${act.word}` : ''}</div>
            <h1 className="cs-display ml-title">{song.title}</h1>
          </div>
          <div className="ml-controls">
            <button type="button" className="ml-btn" onClick={() => go(-1)} aria-label="Previous track"><SkipBack size={20} /></button>
            <button type="button" className="ml-btn ml-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={26} /> : <Play size={26} fill="currentColor" />}
            </button>
            <button type="button" className="ml-btn" onClick={() => go(1)} aria-label="Next track"><SkipForward size={20} /></button>
          </div>
          <div className="ml-seek">
            <span>{clock(time)}</span>
            <input
              type="range" min={0} max={total || 1} step={0.5} value={Math.min(time, total || 1)}
              aria-label="Seek"
              onChange={(e) => { const a = audioRef.current; if (a) { a.currentTime = Number(e.target.value); setTime(a.currentTime); } }}
            />
            <span>{clock(total)}</span>
          </div>
        </section>

        <section className="ml-lyrics" aria-live="polite">
          {lines.length ? (
            <div className="ml-lines">
              {[-2, -1, 0, 1, 2].map((o) => {
                const l = lines[lineIdx + o];
                if (!l) return <p key={o} className="ml-line" data-o={o}>&nbsp;</p>;
                return (
                  <p key={`${lineIdx + o}`} className="ml-line" data-o={o}>
                    {l.words.map((w, i) => (
                      <span key={i} data-sung={(o < 0 || (o === 0 && w.start <= time)) || undefined}>{w.text} </span>
                    ))}
                  </p>
                );
              })}
            </div>
          ) : (
            <div className="ml-nolyrics">
              {hook?.hook && <p className="ml-hook">{hook.hasLyrics ? `“${hook.hook}”` : hook.hook}</p>}
              <p className="cs-muted">No synced lyrics for this track yet.</p>
            </div>
          )}
        </section>

        <ol ref={listRef} className="ml-list" aria-label="Tracks">
          {songs.map((s, i) => (
            <li key={s.id}>
              <button type="button" data-idx={i} data-on={i === idx || undefined} onClick={() => pick(i)}>
                <span className="ml-n">{s.day}</span>
                <span className="ml-t">{s.title}</span>
                <span className="ml-d">{clock(s.duration || 0)}</span>
              </button>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
