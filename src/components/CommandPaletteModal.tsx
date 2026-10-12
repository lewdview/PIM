// ════════════════════════════════════════════════════════════════════════════════
// CommandPaletteModal.tsx — Super search
// One box for every place in the app and every released song. Day-locked: songs
// after today stay hidden unless a Prophecy card unlocks them; an exact "day N"
// query for a locked day says when it opens instead of revealing it.
// Filters: "day 12", "d12", "bpm>150", "bpm<100", "light", "dark".
// ════════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Clock, CornerDownLeft, Lock, Play, Sparkles, Unlock, Wallet } from 'lucide-react';
import { useVaultStore, ownsCardForDay } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useDisplayMode } from '../store/useDisplayMode';
import { getCurrentDay, formatDate } from '../utils/dayCalc';
import staticSongCatalog from '../data/song_catalog.json';
import { haptics } from '../utils/haptics';
import { NAV_SECTIONS, OPEN_GUIDE_EVENT, visibleItems, type NavItem, type NavSectionId } from './nav/navConfig';
import '../styles/consoleShell.css';

type Scope = 'all' | 'songs' | NavSectionId;

interface SongHit {
  kind: 'song';
  key: string;
  day: number;
  id: string;
  title: string;
  mood: 'light' | 'dark';
  bpm: number;
  duration: number;
  genre: string;
  difficulty: number;
  coverArt?: string;
  locked: boolean;
  prophecy: boolean;
  score: number;
}

interface PlaceHit {
  kind: 'place';
  key: string;
  item: NavItem;
  section: { id: NavSectionId; label: string; accent: string };
  score: number;
}

type Hit = SongHit | PlaceHit;

const RECENT_SEARCHES_KEY = 'th3scr1b3_recent_searches_v1';
const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'songs', label: 'Songs' },
  ...NAV_SECTIONS.map((s) => ({ id: s.id as Scope, label: s.label })),
];
const FILTER_HINTS = ['day 1', 'bpm>160', 'dark', 'light bpm<100', 'fusion'];

const padDay = (d: number) => String(d).padStart(3, '0');
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

// Extra places that aren't sidebar destinations but people search for.
const EXTRA_ITEMS: { section: NavSectionId; item: NavItem }[] = [
  {
    section: 'you',
    item: { id: 'wallet', label: 'Connect wallet', action: undefined, icon: Wallet, desc: 'Sign in with a Base smart wallet or EVM key', keywords: ['wallet', 'connect', 'auth', 'base', 'coinbase', 'login', 'sign in'] },
  },
];

interface Filters {
  text: string[];
  day: number | null;
  bpmMin: number | null;
  bpmMax: number | null;
  mood: 'light' | 'dark' | null;
}

function parseQuery(q: string): Filters {
  const f: Filters = { text: [], day: null, bpmMin: null, bpmMax: null, mood: null };
  const tokens = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  tokens.forEach((t, i) => {
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^(?:day|d)[-:#]?(\d{1,3})$/))) f.day = Number(m[1]);
    else if (t === 'day' && /^\d{1,3}$/.test(tokens[i + 1] || '')) return;
    else if (/^\d{1,3}$/.test(t) && tokens[i - 1] === 'day') f.day = Number(t);
    else if ((m = t.match(/^bpm([<>])=?(\d{2,3})$/))) {
      if (m[1] === '>') f.bpmMin = Number(m[2]);
      else f.bpmMax = Number(m[2]);
    } else if (t === 'light' || t === 'dark') f.mood = t;
    else f.text.push(t);
  });
  return f;
}

/** 0 = no match. Word-start matches outrank mid-word ones. */
function matchScore(haystack: string, terms: string[]): number {
  if (!terms.length) return 1;
  const h = haystack.toLowerCase();
  let score = 0;
  for (const t of terms) {
    const i = h.indexOf(t);
    if (i < 0) return 0;
    score += i === 0 ? 3 : /[\s\-(:/]/.test(h[i - 1]) ? 2 : 1;
  }
  return score;
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const useful = terms.filter((t) => t.length > 1);
  if (!useful.length) return <>{text}</>;
  const re = new RegExp(`(${useful.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  return (
    <>
      {text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <React.Fragment key={i}>{part}</React.Fragment>))}
    </>
  );
}

function coverGradient(day: number, mood: 'light' | 'dark') {
  const h = Math.abs(Math.sin(day * 12.9898) * 43758.5453) % 1;
  const a = mood === 'light' ? `hsl(${330 + h * 50} 95% 55%)` : `hsl(${250 + h * 40} 80% 45%)`;
  const b = mood === 'light' ? `hsl(${20 + h * 30} 100% 45%)` : `hsl(${200 + h * 60} 85% 20%)`;
  return `radial-gradient(120% 90% at ${20 + h * 60}% 0%, ${a}, transparent 60%), linear-gradient(${Math.round(h * 360)}deg, ${b}, #0b0710)`;
}

function CoverArt({ song, className }: { song: SongHit; className: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={className} style={{ background: coverGradient(song.day, song.mood) }} aria-hidden="true">
      <span className="pim-ss-daynum">{song.day}</span>
      {song.coverArt && !failed && !song.locked && (
        <img src={song.coverArt} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

function Pips({ n }: { n: number }) {
  return (
    <span className="pim-pips" aria-label={`Difficulty ${n} of 10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} data-on={i < n} />
      ))}
    </span>
  );
}

export default function CommandPaletteModal() {
  const isOpen = useVaultStore((s) => s.commandPaletteOpen);
  const setOpen = useVaultStore((s) => s.setCommandPaletteOpen);
  const setOptionsModalOpen = useVaultStore((s) => s.setOptionsModalOpen);
  const collection = useVaultStore((s) => s.collection);
  const claimedRewards = useVaultStore((s) => s.claimedRewards);
  const { toggle: toggle4K } = useDisplayMode();
  const { setShowAuthModal } = useAuthStore();
  const [, setLocation] = useLocation();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const currentDay = getCurrentDay();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored).slice(0, 5));
    } catch {
      // Ignore
    }
  }, []);

  const saveRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const updated = [clean, ...prev.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 5);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  }, []);

  // Global hotkeys: ⌘K / Ctrl+K toggles, "/" opens when not typing, Esc closes.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(!useVaultStore.getState().commandPaletteOpen);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(tag)) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === 'Escape' && useVaultStore.getState().commandPaletteOpen) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setScope('all');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  // Days unlocked early by owned cards or Prophecy rewards.
  const prophecyDays = useMemo(() => {
    const days = new Set<number>();
    collection.forEach((owned) => {
      if (owned.card?.day) days.add(owned.card.day);
    });
    Object.entries(claimedRewards).forEach(([songId, tierList]) => {
      if (Array.isArray(tierList) && tierList.includes('prophecy')) {
        const match = songId.match(/(\d+)/);
        if (match) days.add(parseInt(match[1], 10));
      }
    });
    return days;
  }, [collection, claimedRewards]);

  const songIndex = useMemo(() => {
    if (!Array.isArray(staticSongCatalog)) return [] as Omit<SongHit, 'score'>[];
    return (staticSongCatalog as any[])
      .filter((s) => s && s.day)
      .map((s) => {
        const day: number = s.day;
        const isFuture = day > currentDay;
        return {
          kind: 'song' as const,
          key: `song-${day}`,
          day,
          id: s.id || `day-${padDay(day)}`,
          title: s.title || `Day ${day}`,
          mood: (s.mood === 'dark' ? 'dark' : 'light') as 'light' | 'dark',
          bpm: Number(s.bpm) || 0,
          duration: Number(s.duration) || 0,
          genre: Array.isArray(s.genre) ? s.genre[0] || '' : '',
          difficulty: Number(s.difficultyLevel) || 0,
          coverArt: s.coverArt,
          locked: isFuture && !prophecyDays.has(day),
          prophecy: isFuture && prophecyDays.has(day),
          haystack: `${s.title || ''} ${s.artist || ''} ${(s.genre || []).join(' ')} ${(s.moodTags || []).join(' ')}`,
        };
      });
  }, [currentDay, prophecyDays]);

  const placeIndex = useMemo(() => {
    const out: Omit<PlaceHit, 'score'>[] = [];
    NAV_SECTIONS.forEach((section) => {
      visibleItems(section.items).forEach((item) =>
        out.push({ kind: 'place', key: `place-${item.id}`, item, section: { id: section.id, label: section.label, accent: section.accent } })
      );
    });
    EXTRA_ITEMS.forEach(({ section: sid, item }) => {
      const section = NAV_SECTIONS.find((s) => s.id === sid)!;
      out.push({ kind: 'place', key: `place-${item.id}`, item, section: { id: section.id, label: section.label, accent: section.accent } });
    });
    return out;
  }, []);

  const runSearch = useCallback(
    (q: string, sc: Scope) => {
      const f = parseQuery(q);
      const songFilter = f.day != null || f.bpmMin != null || f.bpmMax != null || f.mood != null;
      let songs: SongHit[] = [];
      let places: PlaceHit[] = [];

      if (sc === 'all' || sc === 'songs') {
        songs = songIndex
          .map((s) => {
            if (f.day != null && s.day !== f.day) return null;
            // A locked day only surfaces for an exact "day N" query, and never by title.
            if (s.locked && f.day == null) return null;
            if (f.bpmMin != null && s.bpm <= f.bpmMin) return null;
            if (f.bpmMax != null && s.bpm >= f.bpmMax) return null;
            if (f.mood && s.mood !== f.mood) return null;
            const sc0 = s.locked ? 1 : matchScore(s.haystack, f.text);
            if (!sc0) return null;
            const { haystack: _h, ...rest } = s;
            return { ...rest, score: sc0 + (s.day === currentDay ? 2 : 0) } as SongHit;
          })
          .filter((x): x is SongHit => x !== null)
          .sort((a, b) => b.score - a.score || Math.abs(a.day - currentDay) - Math.abs(b.day - currentDay));
      }

      if (!songFilter) {
        places = placeIndex
          .filter((p) => sc === 'all' || p.section.id === sc)
          .map((p) => {
            const base = matchScore(`${p.item.label} ${p.item.desc} ${(p.item.keywords || []).join(' ')}`, f.text);
            if (!base) return null;
            return { ...p, score: base + (matchScore(p.item.label, f.text) && f.text.length ? 3 : 0) };
          })
          .filter((x): x is PlaceHit => x !== null)
          .sort((a, b) => b.score - a.score);
      }
      return { songs, places, filters: f };
    },
    [songIndex, placeIndex, currentDay]
  );

  const { songs, places, filters } = useMemo(() => runSearch(query, scope), [runSearch, query, scope]);

  const scopeCounts = useMemo(() => {
    const counts = {} as Record<Scope, number>;
    SCOPES.forEach(({ id }) => {
      const r = runSearch(query, id);
      counts[id] = r.songs.length + r.places.length;
    });
    return counts;
  }, [runSearch, query]);

  // Flatten into rendered groups; `flat` order matches the visual order for arrow keys.
  const { groups, flat, topHit } = useMemo(() => {
    const out: { label: string; meta?: string; hits: Hit[] }[] = [];
    let top: Hit | null = null;

    if (!query.trim()) {
      const today = songs.find((s) => s.day === currentDay);
      if (today && (scope === 'all' || scope === 'songs')) out.push({ label: 'Today', hits: [today] });
      if (scope === 'songs') out.push({ label: 'Recent releases', hits: songs.filter((s) => s.day < currentDay).sort((a, b) => b.day - a.day).slice(0, 12) });
      else out.push({ label: scope === 'all' ? 'Jump to' : 'Places', hits: places.slice(0, scope === 'all' ? 8 : 20) });
    } else {
      const bestPlace = places[0];
      const bestSong = songs.find((s) => !s.locked);
      top = bestPlace && (!bestSong || bestPlace.score >= bestSong.score + 1) ? bestPlace : bestSong || null;
      if (top) out.push({ label: 'Top hit', hits: [top] });
      const restPlaces = places.filter((p) => p !== top).slice(0, 8);
      const restSongs = songs.filter((s) => s !== top).slice(0, 60);
      if (restPlaces.length) out.push({ label: 'Places', meta: String(restPlaces.length), hits: restPlaces });
      if (restSongs.length) {
        const lockedN = songs.filter((s) => s.locked).length;
        out.push({ label: 'Songs', meta: `${songs.length}${lockedN ? ` · ${lockedN} locked` : ''}`, hits: restSongs });
      }
    }
    return { groups: out, flat: out.flatMap((g) => g.hits), topHit: top };
  }, [query, scope, songs, places, currentDay]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, scope]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const selected = flat[Math.min(selectedIndex, flat.length - 1)];

  const runPlace = (item: NavItem) => {
    if (item.to) return setLocation(item.to);
    if (item.id === 'wallet') return setShowAuthModal(true);
    switch (item.action) {
      case 'options':
        return setOptionsModalOpen(true);
      case 'hdr':
        return toggle4K();
      case 'notifications':
        return useNotificationStore.getState().setIsOpen(true);
      case 'guide':
        return window.dispatchEvent(new Event(OPEN_GUIDE_EVENT));
    }
  };

  const execute = (hit: Hit | undefined, mode: 'play' | 'listen' | 'page' = 'play') => {
    if (!hit) return;
    haptics.mediumTap();
    saveRecentSearch(query || (hit.kind === 'song' ? hit.title : hit.item.label));
    setOpen(false);
    if (hit.kind === 'place') return runPlace(hit.item);
    if (hit.locked) return setLocation('/vault');
    if (mode === 'listen') return setLocation(`/listen/${hit.id}`);
    if (mode === 'page') return setLocation(`/song/${hit.id}`);
    setLocation(`/play/day-${padDay(hit.day)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const n = Math.max(1, flat.length);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((p) => (p + 1) % n);
      haptics.lightTap();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((p) => (p - 1 + n) % n);
      haptics.lightTap();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(selected);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const i = SCOPES.findIndex((s) => s.id === scope);
      setScope(SCOPES[(i + (e.shiftKey ? SCOPES.length - 1 : 1)) % SCOPES.length].id);
    }
  };

  // Gamepad: d-pad moves, A opens, B closes.
  const executeRef = useRef(execute);
  executeRef.current = execute;
  useEffect(() => {
    if (!isOpen) return;
    let animId: number;
    let lastNavTime = 0;
    let prevA = false;
    let prevB = false;
    const n = Math.max(1, flat.length);

    const poll = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(pads).find((g) => g !== null && g.connected);
      if (gp) {
        const now = performance.now();
        const up = gp.buttons[12]?.pressed || (gp.axes[1] !== undefined && gp.axes[1] < -0.5);
        const down = gp.buttons[13]?.pressed || (gp.axes[1] !== undefined && gp.axes[1] > 0.5);
        const a = gp.buttons[0]?.pressed || false;
        const b = gp.buttons[1]?.pressed || false;
        if (now - lastNavTime > 180) {
          if (down) {
            setSelectedIndex((p) => (p + 1) % n);
            lastNavTime = now;
          } else if (up) {
            setSelectedIndex((p) => (p - 1 + n) % n);
            lastNavTime = now;
          }
        }
        if (a && !prevA) executeRef.current(flat[selectedIndex]);
        if (b && !prevB) setOpen(false);
        prevA = a;
        prevB = b;
      }
      animId = requestAnimationFrame(poll);
    };
    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, flat, selectedIndex, setOpen]);

  if (!isOpen) return null;

  const renderRow = (hit: Hit, idx: number, isTop: boolean) => {
    const sel = idx === selectedIndex;
    const key = hit.key + (isTop ? '-top' : '');
    const common = {
      role: 'option' as const,
      'aria-selected': sel,
      onMouseMove: () => selectedIndex !== idx && setSelectedIndex(idx),
      onClick: () => execute(hit),
    };

    if (hit.kind === 'place') {
      const Icon = hit.item.icon;
      return (
        <div key={key} {...common} className={`pim-ss-row${isTop ? ' is-top' : ''}`} style={{ ['--row-accent' as string]: hit.section.accent }}>
          <span className="pim-ss-icon">
            <Icon size={isTop ? 22 : 18} />
          </span>
          <span className="pim-ss-main">
            <b>
              <Highlight text={hit.item.label} terms={filters.text} />
            </b>
            <small>{hit.item.desc}</small>
          </span>
          <span className="pim-ss-end">{sel ? <>open <CornerDownLeft size={11} /></> : hit.section.label}</span>
        </div>
      );
    }

    const owned = ownsCardForDay(collection, hit.day);
    return (
      <div key={key} {...common} className={`pim-ss-row${isTop ? ' is-top' : ''}${hit.locked ? ' is-locked' : ''}`}>
        <CoverArt song={hit} className="pim-ss-thumb" />
        <span className="pim-ss-main">
          <b>{hit.locked ? `Locked until ${formatDate(hit.day)}` : <Highlight text={hit.title} terms={filters.text} />}</b>
          <small>
            <span style={{ fontFamily: 'var(--shell-mono)' }}>Day {hit.day}</span>
            {hit.locked ? (
              <span>Opens in {hit.day - currentDay} days</span>
            ) : (
              <>
                <span className="pim-mood" data-mood={hit.mood}>{hit.mood}</span>
                {hit.bpm > 0 && <span>{hit.bpm} BPM</span>}
                {hit.genre && <span>{hit.genre}</span>}
                {!owned && <span title="You don't own this day's card yet">no card</span>}
              </>
            )}
          </small>
        </span>
        <span className="pim-ss-end">
          {hit.locked ? (
            <><Lock size={12} /> {formatDate(hit.day)}</>
          ) : hit.prophecy ? (
            <span style={{ color: 'var(--shell-gold)', display: 'inline-flex', gap: 5 }}><Unlock size={12} /> Prophecy</span>
          ) : hit.day === currentDay ? (
            <span style={{ color: 'var(--shell-accent)' }}>TODAY</span>
          ) : sel || isTop ? (
            <><Play size={11} /> play</>
          ) : (
            hit.duration > 0 && fmtDur(hit.duration)
          )}
        </span>
      </div>
    );
  };

  const renderPane = () => {
    if (!selected) return null;
    if (selected.kind === 'place') {
      const Icon = selected.item.icon;
      return (
        <>
          <div className="pim-ss-art" style={{ aspectRatio: '16 / 10', background: `linear-gradient(135deg, ${selected.section.accent}55, #0b0710)` }}>
            <Icon size={56} strokeWidth={1.5} color="#fff" />
          </div>
          <h4>{selected.item.label}</h4>
          <p>{selected.item.desc}.</p>
          <dl className="pim-ss-kv">
            <dt>Section</dt>
            <dd>{selected.section.label}</dd>
            {selected.item.to && (
              <>
                <dt>Route</dt>
                <dd style={{ fontFamily: 'var(--shell-mono)', fontSize: 12 }}>{selected.item.to}</dd>
              </>
            )}
          </dl>
          <div className="pim-ss-acts">
            <button type="button" className="pim-shear" data-fill="true" style={{ ['--c' as string]: selected.section.accent }} onClick={() => execute(selected)}>
              Open
            </button>
          </div>
        </>
      );
    }

    const s = selected;
    if (s.locked) {
      return (
        <>
          <CoverArt song={s} className="pim-ss-art" />
          <h4>Day {s.day}</h4>
          <div className="pim-ss-lockmsg">
            This song releases on <b>{formatDate(s.day)}</b>, {s.day - currentDay} days from now. A Prophecy card for day {s.day} unlocks it early.
          </div>
          <div className="pim-ss-acts">
            <button type="button" className="pim-shear" style={{ ['--c' as string]: 'var(--shell-gold)' }} onClick={() => execute(s)}>
              <Sparkles size={12} /> Pack shop
            </button>
          </div>
        </>
      );
    }
    const owned = ownsCardForDay(collection, s.day);
    return (
      <>
        <CoverArt song={s} className="pim-ss-art" />
        <h4>{s.title}</h4>
        <dl className="pim-ss-kv">
          <dt>Released</dt>
          <dd>
            Day {s.day} · {formatDate(s.day)}
            {s.prophecy && <span style={{ color: 'var(--shell-gold)' }}> · Prophecy unlock</span>}
          </dd>
          <dt>Mood</dt>
          <dd><span className="pim-mood" data-mood={s.mood}>{s.mood}</span></dd>
          {s.bpm > 0 && (
            <>
              <dt>Tempo</dt>
              <dd>{s.bpm} BPM{s.duration > 0 && ` · ${fmtDur(s.duration)}`}</dd>
            </>
          )}
          {s.genre && (
            <>
              <dt>Genre</dt>
              <dd>{s.genre}</dd>
            </>
          )}
          {s.difficulty > 0 && (
            <>
              <dt>Difficulty</dt>
              <dd><Pips n={s.difficulty} /></dd>
            </>
          )}
          <dt>Card</dt>
          <dd>{owned ? 'In your vault' : 'Not collected yet'}</dd>
        </dl>
        <div className="pim-ss-acts">
          <button type="button" className="pim-shear" data-fill="true" style={{ ['--c' as string]: '#ff1e8c' }} onClick={() => execute(s, 'play')}>
            <Play size={12} /> Play
          </button>
          <button type="button" className="pim-shear" style={{ ['--c' as string]: 'var(--shell-text-2)' }} onClick={() => execute(s, 'listen')}>
            Listen
          </button>
          <button type="button" className="pim-shear" style={{ ['--c' as string]: 'var(--shell-text-2)' }} onClick={() => execute(s, 'page')}>
            Song page
          </button>
        </div>
      </>
    );
  };

  let rowIdx = 0;
  return (
    <div className="pim-ss-scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="pim-ss" role="dialog" aria-modal="true" aria-label="Super search">
        <div className="pim-ss-in">
          <span className="pim-caret">&gt;_</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Songs, days, cards, modes, settings"
            aria-label="Search"
            aria-controls="pim-ss-list"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="pim-ss-lock" title="Songs after today stay locked unless a Prophecy card unlocks them">
            <Lock size={11} /> DAY {currentDay}
          </span>
          <button type="button" className="pim-ss-close" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>

        <div className="pim-ss-scopes" role="tablist" aria-label="Search scope">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={scope === s.id}
              onClick={() => {
                setScope(s.id);
                inputRef.current?.focus();
              }}
            >
              {s.label}
              <b>{scopeCounts[s.id]}</b>
            </button>
          ))}
        </div>

        <div className="pim-ss-body">
          <div className="pim-ss-list" role="listbox" id="pim-ss-list" ref={listRef}>
            {!query.trim() && recentSearches.length > 0 && (
              <>
                <div className="pim-ss-group"><span>Recent</span></div>
                <div className="pim-ss-chips">
                  {recentSearches.map((term) => (
                    <button key={term} type="button" onClick={() => setQuery(term)}>
                      <Clock size={11} /> {term}
                    </button>
                  ))}
                </div>
              </>
            )}

            {query.trim() && flat.length === 0 ? (
              <div className="pim-ss-empty">
                Nothing matches “{query}”.
                <br />
                Try a title word, <code>day 12</code>, <code>bpm&gt;150</code> or <code>dark</code>.
                <br />
                Songs after day {currentDay} stay locked until their release day.
              </div>
            ) : (
              groups.map((g) => (
                <React.Fragment key={g.label}>
                  <div className="pim-ss-group">
                    <span>{g.label}</span>
                    {g.meta && <span>{g.meta}</span>}
                  </div>
                  {g.hits.map((hit) => renderRow(hit, rowIdx++, g.label === 'Top hit' && hit === topHit))}
                </React.Fragment>
              ))
            )}

            {!query.trim() && (
              <>
                <div className="pim-ss-group"><span>Filters</span></div>
                <div className="pim-ss-chips">
                  {FILTER_HINTS.map((h) => (
                    <button key={h} type="button" onClick={() => setQuery(h)}>
                      {h}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="pim-ss-pane" aria-live="polite">{renderPane()}</aside>
        </div>

        <div className="pim-ss-foot">
          <span className="pim-ss-kb"><kbd className="pim-kbd">↑</kbd><kbd className="pim-kbd">↓</kbd> move</span>
          <span className="pim-ss-kb"><kbd className="pim-kbd">↵</kbd> open</span>
          <span className="pim-ss-kb"><kbd className="pim-kbd">tab</kbd> scope</span>
          <span className="pim-ss-kb"><kbd className="pim-kbd">esc</kbd> close</span>
          <span className="pim-ss-note">future days stay locked</span>
        </div>
      </div>
    </div>
  );
}
