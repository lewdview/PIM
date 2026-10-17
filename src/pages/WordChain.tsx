// Word Chain: the pink dock button. It opens on a lyric line from today's
// track with the words other songs also sing lit up. Tap a lit word and the
// signal jumps to another song at the moment it sings that word, playing a few
// seconds from that line. Each hop adds a line to a found poem built across the
// year; it can be replayed line by line, copied, or followed into a full stage.
// Lines and the word index come from public/word_chain.json
// (scripts/build_word_chain.mjs), fetched on first open.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { Copy, Play, RotateCcw, Shuffle, Square, Volume2 } from 'lucide-react';
import { loadCatalog, type GameSong } from '@/game/api';
import { CHAPTERS } from '@/game/campaign';
import { audioManager } from '@/game/audio';
import { useGlobalPlayer } from '@/store/useGlobalPlayer';
import { getCurrentDay, getMonthNumFromDay } from '@/utils/dayCalc';
import '@/styles/stageShell.css';
import '@/styles/wordChain.css';

interface ChainData {
  tracks: Record<string, [number, string][]>;
  index: Record<string, [number, number][]>;
  /** Word forms folded onto an index word ('dreaming' -> 'dream'). */
  alias?: Record<string, string>;
}

interface ChainLink {
  day: number;
  line: number;
  /** The word that led here (none for the opening line). */
  via?: string;
}

let dataPromise: Promise<ChainData> | null = null;
const loadChain = () => {
  dataPromise ??= fetch('/word_chain.json').then((r) => {
    if (!r.ok) throw new Error(`word_chain.json ${r.status}`);
    return r.json() as Promise<ChainData>;
  }).catch((err) => { dataPromise = null; throw err; });
  return dataPromise;
};

// Same normalisation as norm() in scripts/lyricText.mjs, so tokens match the index.
const norm = (w: string) => w.toLowerCase().replace(/[’`]/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, '').replace(/^'+|'+$/g, '')
  .replace(/^(\w{2,})in'$/, '$1ing');
/** The index word a lyric token hooks on. */
const hookOf = (d: ChainData, tok: string) => { const w = norm(tok); return d.alias?.[w] ?? w; };

/** Keep only songs the loaded catalog has (live deploys list released days only), so every hop lands on a playable stage. */
const onlyCatalog = (d: ChainData, days: Set<number>): ChainData => {
  if (!days.size) return d;
  const tracks = Object.fromEntries(Object.entries(d.tracks).filter(([day]) => days.has(Number(day))));
  const index: ChainData['index'] = {};
  for (const [w, hits] of Object.entries(d.index)) {
    const kept = hits.filter(([day]) => days.has(day));
    if (kept.length >= 2) index[w] = kept;
  }
  return { ...d, tracks, index };
};

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const pad = (n: number) => String(n).padStart(3, '0');
const colorFor = (day: number) => CHAPTERS.find((c) => c.month === getMonthNumFromDay(day))?.dc ?? '#ff2fa0';
const SNIPPET_MAX = 9;
const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function WordChain() {
  const [data, setData] = useState<ChainData | null>(null);
  const [failed, setFailed] = useState(false);
  const [songs, setSongs] = useState<Map<number, GameSong>>(new Map());
  const [chain, setChain] = useState<ChainLink[]>([]);
  const [hop, setHop] = useState(0); // bumps on every jump to replay the entry animation
  const [playing, setPlaying] = useState<number | null>(null); // index in chain being heard
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimer = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    Promise.all([loadChain(), loadCatalog()]).then(([d, catalog]) => {
      if (!alive) return;
      const byDay = new Map(catalog.map((s) => [s.day, s]));
      setData(onlyCatalog(d, new Set(byDay.keys())));
      setSongs(byDay);
    }).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, []);

  const linksIn = useCallback((d: ChainData, l: ChainLink) => {
    const text = d.tracks[l.day]?.[l.line]?.[1] ?? '';
    return new Set(text.split(/\s+/).map((t) => hookOf(d, t)).filter((w) => d.index[w]?.some(([day]) => day !== l.day)));
  }, []);

  /** A line in this track that has somewhere to go, preferring the chorus-free middle of the song. */
  const openingLine = useCallback((d: ChainData, day: number): ChainLink | null => {
    const lines = d.tracks[day];
    if (!lines) return null;
    const options = lines.map((_, i) => ({ day, line: i })).filter((l) => linksIn(d, l).size >= 2);
    return options.length ? pick(options) : null;
  }, [linksIn]);

  const start = useCallback((d: ChainData, preferDay?: number) => {
    const days = Object.keys(d.tracks).map(Number);
    const first = (preferDay && openingLine(d, preferDay)) || openingLine(d, pick(days)) || { day: days[0], line: 0 };
    setChain([first]);
    setHop((h) => h + 1);
  }, [openingLine]);

  // Open on today's drop, which is what this button used to play.
  useEffect(() => {
    if (data && chain.length === 0) start(data, getCurrentDay());
  }, [data, chain.length, start]);

  const stopAudio = useCallback(() => {
    window.clearTimeout(stopTimer.current);
    const a = audioRef.current;
    if (a) { a.pause(); a.src = ''; }
    audioRef.current = null;
    setPlaying(null);
  }, []);
  useEffect(() => stopAudio, [stopAudio]);

  /** Play a few seconds from the start of a chain line, up to where the next line begins. */
  const hear = useCallback((idx: number, link: ChainLink) => {
    if (!data) return;
    const song = songs.get(link.day);
    const lines = data.tracks[link.day];
    if (!song?.audioUrl || !lines) return;
    stopAudio();
    const gp = useGlobalPlayer.getState();
    if (gp.isPlaying) gp.pause();
    const from = Math.max(0, lines[link.line][0] - 0.25);
    const next = lines[link.line + 1]?.[0];
    const length = Math.min(SNIPPET_MAX, Math.max(3.5, (next ?? from + 6) - from + 1.2));
    // The #t fragment starts loading at the line; play() is called inside the tap so mobile Safari allows it.
    const a = new Audio(`${song.audioUrl}#t=${from}`);
    a.volume = 0;
    a.preload = 'auto';
    audioRef.current = a;
    setPlaying(idx);
    a.play().catch(() => { if (audioRef.current === a) setPlaying(null); });
    const seek = () => { if (Math.abs(a.currentTime - from) > 0.5) a.currentTime = from; };
    if (a.readyState >= 1) seek();
    else a.addEventListener('loadedmetadata', seek, { once: true });
    // The snippet clock starts once sound does, so buffering doesn't eat into it.
    const begin = () => {
      if (audioRef.current !== a) return;
      // Fade in, hold, fade out: a radio catching the line.
      const t0 = performance.now();
      const tick = () => {
        if (audioRef.current !== a) return;
        const t = (performance.now() - t0) / 1000;
        const v = t < 0.4 ? t / 0.4 : t > length - 0.8 ? Math.max(0, (length - t) / 0.8) : 1;
        a.volume = 0.6 * v;
        if (t < length) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      stopTimer.current = window.setTimeout(() => { if (audioRef.current === a) stopAudio(); }, length * 1000);
    };
    a.addEventListener('playing', begin, { once: true });
    a.addEventListener('error', () => { if (audioRef.current === a) setPlaying(null); }, { once: true });
  }, [data, songs, stopAudio]);

  const current = chain[chain.length - 1];

  const jump = (word: string) => {
    if (!data || !current) return;
    const seen = new Set(chain.map((l) => l.day));
    const all = (data.index[word] ?? []).filter(([day]) => day !== current.day);
    if (!all.length) return;
    // Fresh songs first; among them, favour another month so the chain travels the year.
    const fresh = all.filter(([day]) => !seen.has(day));
    const pool = fresh.length ? fresh : all;
    const month = getMonthNumFromDay(current.day);
    const away = pool.filter(([day]) => getMonthNumFromDay(day) !== month);
    const [day, line] = pick(away.length && Math.random() < 0.75 ? away : pool);
    const link = { day, line, via: word };
    audioManager.playSfx('swipe', 0.35);
    setChain((c) => [...c, link]);
    setHop((h) => h + 1);
    setCopied(false);
    hear(chain.length, link);
  };

  const randomJump = () => {
    if (!data) return;
    stopAudio();
    audioManager.playSfx('swipe', 0.35);
    const days = Object.keys(data.tracks).map(Number).filter((d) => d !== current?.day);
    const link = openingLine(data, pick(days));
    if (!link) return;
    setChain((c) => [...c, link]);
    setHop((h) => h + 1);
  };

  const restart = () => {
    if (!data) return;
    stopAudio();
    audioManager.playSfx('tap_nav', 0.2);
    setCopied(false);
    start(data);
  };

  const lineText = (l: ChainLink) => data?.tracks[l.day]?.[l.line]?.[1] ?? '';
  const poemText = useMemo(
    () => chain.map((l) => `${lineText(l)}  (day ${l.day}${songs.get(l.day) ? `, ${songs.get(l.day)!.title}` : ''})`).join('\n'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chain, songs, data],
  );
  const copyPoem = async () => {
    try {
      await navigator.clipboard.writeText(`${poemText}\n\nA word chain through PIM`);
      setCopied(true);
      audioManager.playSfx('tap_nav', 0.2);
    } catch { /* clipboard blocked: nothing to do */ }
  };

  if (failed) {
    return (
      <div className="wc-page"><div className="wc-empty">
        <b>Signal lost</b>
        <span>The lyric index didn't load. Check your connection and try again.</span>
        <button type="button" className="btn-3d" onClick={() => { setFailed(false); loadChain().then(setData).catch(() => setFailed(true)); }}>Retry</button>
      </div></div>
    );
  }
  if (!data || !current) {
    return <div className="wc-page"><div className="wc-empty"><span className="wc-tuning">Tuning…</span></div></div>;
  }

  const song = songs.get(current.day);
  const lit = linksIn(data, current);
  const words = lineText(current).split(/(\s+)/);
  const ch = colorFor(current.day);
  let wi = 0;

  return (
    <div className="wc-page" style={{ ['--ch' as string]: ch } as CSSProperties}>
      <div className="wc-bg" aria-hidden="true">
        {song?.coverArt && <img key={current.day} src={song.coverArt} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
        <div className="wc-rays" />
        <div className="wc-scan" />
      </div>
      <div key={`static-${hop}`} className="wc-static" aria-hidden="true" />

      <header className="wc-head">
        <span className="wc-chip" data-tone="hot">Word chain</span>
        <span className="wc-chip">{chain.length === 1 ? 'Tap a lit word' : `${chain.length - 1} ${chain.length === 2 ? 'hop' : 'hops'}`}</span>
      </header>

      <section key={`line-${hop}`} className="wc-now" aria-live="polite">
        <div className="wc-src">
          <span className="wc-day">Day {pad(current.day)}</span>
          <span className="wc-title">{song?.title ?? `Day ${current.day}`}</span>
          {current.via && <span className="wc-via">via “{current.via}”</span>}
        </div>
        <p className="wc-line">
          {words.map((tok, i) => {
            if (/^\s+$/.test(tok)) return tok;
            const w = hookOf(data, tok);
            const n = wi++;
            const style = { ['--i' as string]: n } as CSSProperties;
            if (w && lit.has(w)) {
              const count = data.index[w].filter(([d]) => d !== current.day).length;
              return (
                <button key={i} type="button" className="wc-word" data-via={w === current.via || undefined} style={style}
                  onClick={() => jump(w)} aria-label={`${tok}: jump to one of ${count} other ${count === 1 ? 'song' : 'songs'}`}>
                  <span className="wc-word-t">{tok}</span><sup>{count}</sup>
                </button>
              );
            }
            return <span key={i} className="wc-tok" data-via={w === current.via || undefined} style={style}>{tok}</span>;
          })}
        </p>
        {lit.size === 0 && <p className="wc-dead">No other song sings these words. Jump somewhere new.</p>}
        <div className="wc-actions">
          <button type="button" className="btn-3d" data-tone="quiet" data-size="sm" disabled={!song?.audioUrl}
            onClick={() => (playing === chain.length - 1 ? stopAudio() : hear(chain.length - 1, current))}>
            {playing === chain.length - 1 ? <><Square size={14} /> Stop</> : <><Volume2 size={14} /> Hear this line</>}
          </button>
          <button type="button" className="btn-3d" data-tone="quiet" data-size="sm" onClick={randomJump}>
            <Shuffle size={14} /> Random jump
          </button>
          {song && (
            <Link href={`/play/${song.id}`} className="btn-3d" data-size="sm" onClick={stopAudio}>
              <Play size={14} fill="currentColor" /> Play this stage
            </Link>
          )}
        </div>
      </section>

      {chain.length > 1 && (
        <section className="wc-poem" aria-label="Your chain so far">
          <div className="wc-poem-head">
            <span className="wc-tab">Found poem</span>
            <div className="wc-poem-tools">
              <button type="button" className="wc-chip-btn" onClick={copyPoem}><Copy size={13} /> {copied ? 'Copied' : 'Copy'}</button>
              <button type="button" className="wc-chip-btn" onClick={restart}><RotateCcw size={13} /> New chain</button>
            </div>
          </div>
          <ol>
            {chain.map((l, i) => (
              <li key={`${i}-${l.day}-${l.line}`} style={{ ['--ch' as string]: colorFor(l.day) } as CSSProperties} data-current={i === chain.length - 1 || undefined}>
                <button type="button" onClick={() => (playing === i ? stopAudio() : hear(i, l))} aria-label={`Hear day ${l.day}: ${lineText(l)}`}>
                  <span className="wc-poem-day">{playing === i ? '▶▶' : pad(l.day)}</span>
                  <span className="wc-poem-line">
                    {lineText(l).split(/(\s+)/).map((tok, j) => {
                      const w = hookOf(data, tok);
                      const hot = w && (w === l.via || w === chain[i + 1]?.via);
                      return hot ? <mark key={j}>{tok}</mark> : <span key={j}>{tok}</span>;
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!reduceMotion() && chain.length === 1 && <div className="wc-hint" aria-hidden="true">▲ tap a glowing word ▲</div>}
    </div>
  );
}
