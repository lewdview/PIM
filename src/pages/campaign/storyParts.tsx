import type { GameSong } from '@/game/api';
import { highlightRuns } from '@/game/chapterStory';

/** A lyric line with the given words lit in the chapter colour. */
export function Highlighted({ line, words }: { line: string; words: string[] }) {
  return (
    <>
      {highlightRuns(line, words).map((r, i) => (r.hit ? <mark key={i}>{r.text}</mark> : <span key={i}>{r.text}</span>))}
    </>
  );
}

export function WordChips({ words, redacted = false, small = false }: { words: string[]; redacted?: boolean; small?: boolean }) {
  return (
    <ul className={small ? 'cs-words cs-words--sm' : 'cs-words'} aria-label={redacted ? 'Hidden until unlocked' : 'Chapter words'}>
      {words.map((w) => (
        <li key={w} className="cs-word" data-redacted={redacted}>
          {redacted ? w.replace(/./g, '•') : w}
        </li>
      ))}
    </ul>
  );
}

/** Valence across a month's tracks, as a small sparkline. */
export function ArcSpark({ songs, color }: { songs: GameSong[]; color: string }) {
  if (songs.length < 2) return null;
  const pts = songs.map((s, i) => {
    const x = (i / (songs.length - 1)) * 100;
    const y = 30 - Math.max(0, Math.min(1, s.valence ?? 0.5)) * 26;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return (
    <svg className="cs-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,32 ${pts.join(' ')} 100,32`} fill={`${color}1f`} stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The slice of a chapter's act grouping the mood arc needs. */
export interface ArcGroup {
  key: string;
  label: string;
  act?: { act?: string; word: string };
  songs: GameSong[];
  startIdx: number;
  bonus: boolean;
}

/** The month's mood (track valence) as a line, with a tappable dot per track. */
export function MoodArc({ songs, groups, selectedIdx, stateOf, onSelect }: {
  songs: GameSong[];
  groups: ArcGroup[];
  selectedIdx: number;
  stateOf: (s: GameSong, i: number) => string;
  onSelect: (i: number) => void;
}) {
  if (songs.length < 2) return null;
  const H = 132;
  // Scale to this month's own range so its swings read clearly.
  const vals = songs.map((s) => s.valence ?? 0.5);
  const lo = Math.min(...vals);
  const span = Math.max(0.15, Math.max(...vals) - lo);
  const x = (i: number) => (i / (songs.length - 1)) * 100;
  const y = (s: GameSong) => 14 + (1 - ((s.valence ?? 0.5) - lo) / span) * (H - 28);
  const pts = songs.map((s, i) => `${x(i).toFixed(2)},${y(s).toFixed(1)}`).join(' ');
  const seps = groups.slice(1).map((g) => x(g.startIdx - 0.5));
  return (
    <section className="cs-arc" aria-label="Mood across the chapter">
      <div className="cs-arc-head">
        <div className="cs-eyebrow">Mood arc</div>
        <div className="cs-eyebrow">brighter ↑ · heavier ↓</div>
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <polygon className="arc-fill" points={`0,${H} ${pts} 100,${H}`} />
          {seps.map((sx, i) => <line key={i} className="arc-sep" x1={sx} x2={sx} y1={0} y2={H} />)}
          <polyline className="arc-line" points={pts} />
        </svg>
        <div className="cs-arc-dots" style={{ position: 'absolute', inset: 0, height: '100%' }}>
          {songs.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="cs-arc-dot"
              data-state={stateOf(s, i)}
              data-selected={i === selectedIdx}
              style={{ left: `${x(i)}%`, top: `${(y(s) / H) * 100}%` }}
              aria-label={`${s.title}, day ${s.day}`}
              onClick={() => onSelect(i)}
            />
          ))}
        </div>
      </div>
      <div className="cs-arc-acts" style={{ gridTemplateColumns: groups.map((g) => `${g.songs.length}fr`).join(' ') }}>
        {groups.map((g) => <span key={g.key} title={g.label}>{g.act?.act ? `${g.act.act} · ${g.act.word}` : g.bonus ? `Bonus${g.act ? ` · ${g.act.word}` : ''}` : g.label}</span>)}
      </div>
    </section>
  );
}
