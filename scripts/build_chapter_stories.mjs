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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/song_catalog.json'), 'utf8'));
const lyricsDir = path.join(root, 'public/lyrics');
const outFile = path.join(root, 'src/data/chapter_stories.json');

// Same month boundaries as getMonthNumFromDay in src/utils/dayCalc.ts.
const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const monthOf = (day) => {
  let m = 1;
  MONTH_STARTS.forEach((start, i) => { if (day >= start) m = i + 1; });
  return m;
};

const STOP = new Set(`
a about above after again against all am an and any are aren't as at be because been before being below between both but by
can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't
have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is
isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves
out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves
then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd
we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would
wouldn't you you'd you'll you're you've your yours yourself yourselves
oh ooh ohh ah ahh yeah yea ya yo uh huh hey la na da woah whoa mm mmm hmm gonna wanna gotta ain't got get gets getting just like
know dont im ive youre cant thats its aint cause cuz em 'em lil ima i'ma imma y'all ya'll yall really never ever always still
one two three go going come came make made say said see tell take let way back thing things want need feel right now well
even every keep give put look much many something nothing everything anything someone everybody somebody time
`.split(/\s+/).filter(Boolean));

// Never surfaced as highlight words or hooks (slurs), or kept out of the
// chapter-level word clouds (profanity stays in the songs, not the headlines).
const BLOCK = /^(nigg|fag|retard|tranny|chink|spic|kike)/;
const PROFANE = /^(fuck|motherfuck|shit|bitch|cunt|dick|pussy|ass$|asshole|damn|hoe)/;
// Credits and filler that leak in from titles.
const CREDIT = new Set(['alternative', 'ballad', 'pop', 'electronic', 'indie', 'rock', 'rap', 'hip-hop', 'hiphop', 'growth',
  'gon', 'doin', 'sayin', 'somethin', 'nothin', 'lookin', 'goin', 'comin', 'feelin', 'tryna', 'feat', 'ft', 'featuring', 'cover', 'remix', 'version', 'edit', 'mix', 'prod', 'intro', 'outro', 'interlude', 'verse', 'challenge', 'open']);

const norm = (w) => w.toLowerCase().replace(/[’`]/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, '').replace(/^'+|'+$/g, '')
  .replace(/^(\w{2,})in'$/, '$1ing');
const isWord = (w) => w.length >= 3 && !STOP.has(w) && !STOP.has(w.replace(/'/g, '')) && !CREDIT.has(w) && !BLOCK.test(w) && /[a-z]/.test(w);
const isClean = (w) => !PROFANE.test(w);
const hasBlocked = (line) => line.split(/\s+/).some((t) => BLOCK.test(norm(t)));
const profanity = (line) => line.split(/\s+/).filter((t) => PROFANE.test(norm(t))).length;

// "Cold as ice, cold as ice, cold as ice" → "Cold as ice"
function collapseRepeats(line) {
  const parts = line.split(/,\s*/).map((p) => p.trim()).filter(Boolean);
  const seen = new Set();
  const kept = parts.filter((p) => {
    const k = p.toLowerCase().replace(/^i'?m\s+/, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return kept.join(', ');
}

function readLyricLines(day) {
  const file = path.join(lyricsDir, `day${String(day).padStart(3, '0')}.lrc`);
  if (!fs.existsSync(file)) return null;
  const lines = [];
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]\s*(.*)$/.exec(raw.trim());
    if (m && m[1].trim()) lines.push(m[1].trim());
  }
  return lines.length ? lines : null;
}

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
    const moodWords = (song.moodTags || []).map(norm).filter(isWord);
    const weights = new Map();
    for (const w of titleWords) weights.set(w, 2);
    for (const w of [...themeWords, ...moodWords]) weights.set(w, (weights.get(w) || 0) + 1);
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

function distinctiveWords(list, n, against = yearTotals) {
  const local = sumWeights(list);
  const localSum = [...local.values()].reduce((a, b) => a + b, 0) || 1;
  const globalSum = [...against.values()].reduce((a, b) => a + b, 0) || 1;
  // A chapter word has to recur across tracks, not just one chorus.
  const minSpread = Math.min(list.length, list.length >= 15 ? 3 : 2);
  return [...local.entries()]
    .filter(([w]) => isClean(w))
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

const months = [];
for (let m = 1; m <= 12; m++) {
  const list = stories.filter((s) => s.month === m);
  if (!list.length) continue;
  const chapterWords = distinctiveWords(list, 8);

  // Three acts in release order; each named after its own most distinctive word.
  const size = Math.ceil(list.length / 3);
  const used = new Set();
  const acts = ACT_NAMES.map((name, i) => {
    const slice = list.slice(i * size, (i + 1) * size);
    if (!slice.length) return null;
    const candidates = distinctiveWords(slice, 6, sumWeights(list));
    const word = candidates.find((w) => !used.has(w)) || slice[0].words[0] || chapterWords[i] || 'signal';
    used.add(word);
    return {
      act: name,
      word,
      fromDay: slice[0].day,
      toDay: slice[slice.length - 1].day,
      themes: topThemes(slice, 3),
      mood: moodPhrase(slice),
    };
  }).filter(Boolean);

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
    prologue: { day: anchor.day, line: anchor.hook },
    acts,
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
