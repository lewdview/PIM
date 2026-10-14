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
