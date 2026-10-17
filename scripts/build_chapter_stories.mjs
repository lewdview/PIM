// Builds src/data/chapter_stories.json — the "story" each campaign month tells
// through its tracks, distilled from the LRC lyrics in public/lyrics plus the
// catalog descriptions. Re-run after adding lyrics or catalog entries:
//
//   node scripts/build_chapter_stories.mjs
//
// Per track: a hook line (the most repeated lyric line, else the most
// distinctive one) and 3 highlight words (TF-IDF against the whole year).
// Per month: chapter words (distinctive vs the other months), a prologue
// quote, and three acts that split the month's tracks into a story arc.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collapseRepeats, hasBlocked, isClean, isWord, norm, profanity, readLyricLines as readLrc } from './lyricText.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/song_catalog.json'), 'utf8'));
const lyricsDir = path.join(root, 'public/lyrics');
const readLyricLines = (day) => readLrc(lyricsDir, day);
const outFile = path.join(root, 'src/data/chapter_stories.json');

// Same month boundaries as getMonthNumFromDay in src/utils/dayCalc.ts.
const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const monthOf = (day) => {
  let m = 1;
  MONTH_STARTS.forEach((start, i) => { if (day >= start) m = i + 1; });
  return m;
};

function themesOf(description) {
  const body = (description || '').replace(/^Exploring\s+/i, '').replace(/\.$/, '');
  if (!/^Exploring/i.test(description || '')) return [];
  return body.replace(/, and /g, ' and ').replace(/, /g, ' and ').split(' and ')
    .map((t) => t.trim().toLowerCase().replace(/_/g, '-'))
    .filter(Boolean);
}

// ── Pass 1: per-track word counts ─────────────────────────────────────────
const tracks = catalog
  .filter((s) => s && s.day)
  .sort((a, b) => a.day - b.day)
  .map((s) => {
    const lines = readLyricLines(s.day);
    const counts = new Map();
    for (const line of lines || []) {
      for (const tok of line.split(/\s+/)) {
        const w = norm(tok);
        if (isWord(w)) counts.set(w, (counts.get(w) || 0) + 1);
      }
    }
    return { song: s, month: monthOf(s.day), lines, counts };
  });

const withLyrics = tracks.filter((t) => t.lines);
const docFreq = new Map();
for (const t of withLyrics) for (const w of t.counts.keys()) docFreq.set(w, (docFreq.get(w) || 0) + 1);
const idf = (w) => Math.log((withLyrics.length + 1) / ((docFreq.get(w) || 0) + 1)) + 1;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cleanLine = (l) => l.replace(/[♪♫]/g, '').replace(/\s+/g, ' ').replace(/^[^\w"'(]+/, '').trim();

function trackStory(t) {
  const { song, lines, counts } = t;
  const themes = themesOf(song.description);
  if (!lines) {
    // No lyrics on file: the title, mood tags and catalog themes carry the story.
    const bareTitle = song.title.split(/\s+(?:feat\.?|ft\.?|by|with)\s+|\s*[([]/i)[0];
    const titleWords = bareTitle.split(/\s+/).map(norm).filter(isWord);
    const themeWords = themes.map((x) => x.split(/[\s-]/).pop()).map(norm).filter(isWord);
    const weights = new Map();
    for (const w of titleWords) weights.set(w, 2);
    for (const w of themeWords) weights.set(w, (weights.get(w) || 0) + 1);
    return {
      day: song.day,
      hasLyrics: false,
      hook: song.description || song.title,
      words: [...new Set([...titleWords, ...themeWords])].slice(0, 3),
      themes,
      weights,
    };
  }

  // Highlight words: TF-IDF within the year, with a boost for repeated hooks.
  const weights = new Map();
  for (const [w, c] of counts) weights.set(w, (1 + Math.log(c)) * idf(w));
  const words = [...weights.entries()].filter(([w]) => isClean(w)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);

  // Hook line: the most repeated line of 3+ words, else the highest-scoring line.
  // Lines with slurs never qualify; cleaner lines win ties.
  const pool = lines.filter((l) => !hasBlocked(l));
  const lineCount = new Map();
  for (const l of pool) {
    const key = l.toLowerCase().replace(/[^a-z' ]/g, '').trim();
    if (key.split(' ').length >= 3) lineCount.set(key, (lineCount.get(key) || 0) + 1);
  }
  const [topKey, topCount] = [...lineCount.entries()]
    .sort((a, b) => b[1] - a[1] || profanity(a[0]) - profanity(b[0]))[0] || ['', 0];
  let hook;
  if (topCount >= 2) {
    hook = pool.find((l) => l.toLowerCase().replace(/[^a-z' ]/g, '').trim() === topKey);
  } else {
    let best = -1;
    for (const l of pool) {
      const toks = l.split(/\s+/).map(norm).filter(isWord);
      if (toks.length < 2 || l.length > 90) continue;
      const score = toks.reduce((s, w) => s + (weights.get(w) || 0), 0) / Math.sqrt(toks.length) / (1 + profanity(l));
      if (score > best) { best = score; hook = l; }
    }
  }
  hook = collapseRepeats(cleanLine(hook || pool[0] || song.description || song.title));
  if (hook.length > 96) hook = hook.slice(0, 93).replace(/\s+\S*$/, '') + '…';

  return { day: song.day, hasLyrics: true, hook: cap(hook), words, themes, weights };
}

const stories = tracks.map((t) => ({ ...trackStory(t), month: t.month, song: t.song }));

// ── Pass 2: months ────────────────────────────────────────────────────────
function sumWeights(list) {
  const total = new Map();
  for (const s of list) for (const [w, v] of s.weights) total.set(w, (total.get(w) || 0) + v);
  return total;
}

const yearTotals = sumWeights(stories);
const topThemes = (list, n) => {
  const c = new Map();
  for (const s of list) for (const th of s.themes) c.set(th, (c.get(th) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([th]) => th);
};

// Common words that are fine inside a lyric but say nothing as a chapter or act headline.
const GENERIC = new Set(`
good bad left right another little away else will think sometimes around gone tried full next line used day days man
ask known inside end check goes ready thing people life world wanna yeah body hand hands head eyes face mind night
baby girl boy real true better best last first long hard soft old new big small part place times turn turned
nah bout use along least twice seems maybe stand set coming chin rather saying round
`.split(/\s+/).filter(Boolean));

// "sittin", "tryin": dropped-g spellings make poor headlines.
const droppedG = (w) => /in$/.test(w) && docFreq.has(`${w}g`);

function distinctiveWords(list, n, against = yearTotals, { headline = true } = {}) {
  const local = sumWeights(list);
  const localSum = [...local.values()].reduce((a, b) => a + b, 0) || 1;
  const globalSum = [...against.values()].reduce((a, b) => a + b, 0) || 1;
  // A chapter word has to recur across tracks, not just one chorus.
  const minSpread = Math.min(list.length, list.length >= 15 ? 3 : 2);
  return [...local.entries()]
    .filter(([w]) => isClean(w) && !(headline && (GENERIC.has(w) || w.includes("'") || droppedG(w))))
    .map(([w, v]) => {
      const spread = list.filter((s) => s.weights.has(w)).length;
      const lift = (v / localSum) / (((against.get(w) || 0) + 1) / globalSum);
      return [w, spread >= minSpread ? v * Math.log(1 + lift) : 0];
    })
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

function moodPhrase(list) {
  const v = list.reduce((s, x) => s + (x.song.valence ?? 0.5), 0) / (list.length || 1);
  if (v >= 0.62) return 'bright';
  if (v >= 0.5) return 'rising';
  if (v >= 0.4) return 'restless';
  return 'heavy';
}

const ACT_NAMES = ['I', 'II', 'III'];
const BONUS_COUNT = 5;

// Story beats for a run of tracks: where it opens, where the mood turns
// hardest, and where it lands. Each beat is a track's hook line.
function actBeats(slice) {
  const beat = (s) => ({ day: s.day, line: s.hasLyrics ? s.hook : null });
  let turn = null;
  for (let i = 1; i < slice.length; i++) {
    const d = (slice[i].song.valence ?? 0.5) - (slice[i - 1].song.valence ?? 0.5);
    if (!turn || Math.abs(d) > Math.abs(turn.delta)) turn = { s: slice[i], delta: d };
  }
  // Open and close on the nearest track with lyrics, so the beat has a line to quote.
  const sung = slice.filter((s) => s.hasLyrics);
  const open = sung[0] || slice[0];
  const close = sung.length > 1 ? sung[sung.length - 1] : slice[slice.length - 1];
  return {
    open: beat(open),
    turn: turn && turn.s !== close && turn.s !== open && Math.abs(turn.delta) >= 0.12
      ? { ...beat(turn.s), dir: turn.delta > 0 ? 'lifts' : 'drops' }
      : null,
    close: close !== open ? beat(close) : null,
  };
}

const months = [];
for (let m = 1; m <= 12; m++) {
  const list = stories.filter((s) => s.month === m);
  if (!list.length) continue;
  const chapterWords = distinctiveWords(list, 8);

  // The last five tracks of a month are bonus stages (see src/game/chapterStory.ts),
  // so the three acts split only the regular tracks; the bonus run is the epilogue.
  const regular = list.length > BONUS_COUNT ? list.slice(0, -BONUS_COUNT) : list;
  const bonus = list.length > BONUS_COUNT ? list.slice(-BONUS_COUNT) : [];
  const size = Math.ceil(regular.length / 3);
  // Act words add to the chapter's headline words rather than repeat them.
  const used = new Set(chapterWords.slice(0, 4));
  const pickWord = (slice, fallback) => {
    const candidates = distinctiveWords(slice, 12);
    const word = candidates.find((w) => !used.has(w))
      || topThemes(slice, 3).map((th) => th.split('-').pop()).find((w) => !used.has(w))
      || fallback;
    used.add(word);
    return word;
  };
  const acts = ACT_NAMES.map((name, i) => {
    const slice = regular.slice(i * size, (i + 1) * size);
    if (!slice.length) return null;
    return {
      act: name,
      word: pickWord(slice, chapterWords[i] || 'signal'),
      fromDay: slice[0].day,
      toDay: slice[slice.length - 1].day,
      themes: topThemes(slice, 3),
      mood: moodPhrase(slice),
      ...actBeats(slice),
    };
  }).filter(Boolean);
  const epilogue = bonus.length
    ? {
        word: pickWord(bonus, 'encore'),
        fromDay: bonus[0].day,
        toDay: bonus[bonus.length - 1].day,
        themes: topThemes(bonus, 3),
        mood: moodPhrase(bonus),
        ...actBeats(bonus),
      }
    : null;

  // Prologue: the hook from the track that best carries the chapter words.
  const anchor = [...list]
    .filter((s) => s.hasLyrics && !profanity(s.hook))
    .sort((a, b) =>
      chapterWords.reduce((s, w) => s + (b.weights.get(w) || 0), 0) -
      chapterWords.reduce((s, w) => s + (a.weights.get(w) || 0), 0))[0] || list[0];

  months.push({
    month: m,
    words: chapterWords,
    themes: topThemes(list, 4),
    prologue: { day: anchor.day, line: anchor.hook, lyric: anchor.hasLyrics },
    acts,
    epilogue,
    lyricCoverage: list.filter((s) => s.hasLyrics).length,
    trackCount: list.length,
  });
}

const out = {
  generatedFrom: 'scripts/build_chapter_stories.mjs',
  months,
  tracks: Object.fromEntries(stories.map((s) => [s.day, { hook: s.hook, words: s.words, themes: s.themes.slice(0, 3), hasLyrics: s.hasLyrics }])),
};

fs.writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${path.relative(root, outFile)}: ${months.length} months, ${stories.length} tracks (${withLyrics.length} with lyrics)`);
