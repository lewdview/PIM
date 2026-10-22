// Word Chain data: every lyric line with its start time, plus an index from
// each word to the lines (in other tracks) that use it, so the Word Chain
// screen can hop from a lit word in one song straight into the moment another
// song sings it. Written to public/word_chain.json and fetched on demand.
// Re-run after adding lyrics or catalog entries:
//   node scripts/build_word_chain.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collapseRepeats, hasBlocked, isClean, isJunk, isWord, loadOfficialLyrics, norm, officialLines, scrubLine } from './lyricText.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/song_catalog.json'), 'utf8'));
const lyricsDir = path.join(root, 'public/lyrics');
const outFile = path.join(root, 'public/word_chain.json');

// A word links tracks once at least two songs sing it.
const MIN_TRACKS = 2;
const MAX_LINE = 90;

// Plain words the shared stop list drops from word clouds but that make good
// hooks between songs ("never", "time", "feel").
const HOOKABLE = new Set(`time feel way back right never always keep give look nothing everything something anything someone
somebody everybody make made take tell come came see say said want need still ever know even every`.split(/\s+/).filter(Boolean));
const canLink = (w) => w.length >= 3 && isClean(w) && (HOOKABLE.has(w) || isWord(w));

const toSeconds = (stamp) => {
  const [m, s] = stamp.split(':');
  return Math.round((parseInt(m, 10) * 60 + parseFloat(s.replace(':', '.'))) * 100) / 100;
};

// Official lines (lrc.th3scr1b3.art) when the day is published, else public/lyrics.
function rawTimedLines(day) {
  const published = officialLines(day);
  if (published) return published.map((l) => [Math.round(l.start * 100) / 100, l.text]);
  const file = path.join(lyricsDir, `day${String(day).padStart(3, '0')}.lrc`);
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\[(\d{1,3}:\d{2}(?:[.:]\d{1,3})?)\]\s*(.*)$/.exec(raw.trim());
    if (m) out.push([toSeconds(m[1]), m[2]]);
  }
  return out;
}

function readTimedLines(day) {
  const out = [];
  const seen = new Set();
  for (const [start, rawText] of rawTimedLines(day)) {
    const text = collapseRepeats(scrubLine(rawText).replace(/^[^\w"'(]+/, ''));
    if (!text || isJunk(text) || hasBlocked(text) || text.length > MAX_LINE) continue;
    // Each distinct line once, at its first appearance.
    const key = text.toLowerCase().replace(/[^a-z' ]/g, '').trim();
    if (key.split(' ').length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push([start, text.charAt(0).toUpperCase() + text.slice(1)]);
  }
  return out;
}

await loadOfficialLyrics(root);

const tracks = {};
for (const song of catalog.filter((s) => s && s.day)) {
  const lines = readTimedLines(song.day);
  if (lines.length) tracks[song.day] = lines;
}

// Fold word forms onto one another when the plain form is sung somewhere too
// ("dreams", "dreamed", "dreaming" -> "dream"), so they all hook together.
const vocab = new Set(Object.values(tracks).flatMap((ls) => ls.flatMap(([, t]) => t.split(/\s+/).map(norm))));
const lemma = (w) => {
  const forms = [w.replace(/'s$/, ''), w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/(e)d$/, '$1'), w.replace(/ed$/, ''),
    w.replace(/ying$/, 'ie'), w.replace(/([^y])ing$/, '$1e'), w.replace(/ing$/, ''), w.replace(/(.)\1(?:ing|ed)$/, '$1')];
  const base = forms.find((f) => f !== w && f.length >= 3 && vocab.has(f) && canLink(f));
  return base ?? w;
};
const alias = {};

const uses = new Map(); // word -> Map(day -> [lineIdx])
for (const [dayKey, lines] of Object.entries(tracks)) {
  const day = Number(dayKey);
  lines.forEach(([, text], i) => {
    for (const tok of text.split(/\s+/)) {
      const raw = norm(tok);
      if (!canLink(raw)) continue;
      const w = lemma(raw);
      if (w !== raw) alias[raw] = w;
      if (!uses.has(w)) uses.set(w, new Map());
      const byDay = uses.get(w);
      if (!byDay.has(day)) byDay.set(day, []);
      const list = byDay.get(day);
      if (list[list.length - 1] !== i) list.push(i);
    }
  });
}

// index[word] = [[day, lineIdx], ...]: one line per track (its first use).
// alias[form] = word, for the forms folded onto it above.
const index = {};
for (const [w, byDay] of [...uses.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (byDay.size < MIN_TRACKS) continue;
  index[w] = [...byDay.entries()].map(([day, list]) => [day, list[0]]);
}

fs.writeFileSync(outFile, JSON.stringify({ generatedFrom: 'public/lyrics', tracks, index,
  alias: Object.fromEntries(Object.entries(alias).filter(([, w]) => index[w]).sort()) }));
const lineCount = Object.values(tracks).reduce((n, l) => n + l.length, 0);
console.log(`wrote public/word_chain.json: ${Object.keys(tracks).length} tracks, ${lineCount} lines, ${Object.keys(index).length} linking words, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`);
