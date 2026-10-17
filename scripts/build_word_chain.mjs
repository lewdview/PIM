// Word Chain data: every lyric line with its start time, plus an index from
// each word to the lines (in other tracks) that use it, so the Word Chain
// screen can hop from a lit word in one song straight into the moment another
// song sings it. Written to public/word_chain.json and fetched on demand.
// Re-run after adding lyrics or catalog entries:
//   node scripts/build_word_chain.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collapseRepeats, hasBlocked, isClean, isJunk, isWord, norm, scrubLine } from './lyricText.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/song_catalog.json'), 'utf8'));
const lyricsDir = path.join(root, 'public/lyrics');
const outFile = path.join(root, 'public/word_chain.json');

// A word links tracks only when at least two songs sing it, and stops being
// interesting once most of the year does.
const MIN_TRACKS = 2;
const MAX_TRACKS = 60;
const MAX_LINE = 90;

const toSeconds = (stamp) => {
  const [m, s] = stamp.split(':');
  return Math.round((parseInt(m, 10) * 60 + parseFloat(s.replace(':', '.'))) * 100) / 100;
};

function readTimedLines(day) {
  const file = path.join(lyricsDir, `day${String(day).padStart(3, '0')}.lrc`);
  if (!fs.existsSync(file)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\[(\d{1,3}:\d{2}(?:[.:]\d{1,3})?)\]\s*(.*)$/.exec(raw.trim());
    if (!m) continue;
    const text = collapseRepeats(scrubLine(m[2]).replace(/^[^\w"'(]+/, ''));
    if (!text || isJunk(text) || hasBlocked(text) || text.length > MAX_LINE) continue;
    // Each distinct line once, at its first appearance.
    const key = text.toLowerCase().replace(/[^a-z' ]/g, '').trim();
    if (key.split(' ').length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push([toSeconds(m[1]), text.charAt(0).toUpperCase() + text.slice(1)]);
  }
  return out;
}

const tracks = {};
const uses = new Map(); // word -> Map(day -> [lineIdx])
for (const song of catalog.filter((s) => s && s.day).sort((a, b) => a.day - b.day)) {
  const lines = readTimedLines(song.day);
  if (!lines.length) continue;
  tracks[song.day] = lines;
  lines.forEach(([, text], i) => {
    for (const tok of text.split(/\s+/)) {
      const w = norm(tok);
      if (!isWord(w) || !isClean(w)) continue;
      if (!uses.has(w)) uses.set(w, new Map());
      const byDay = uses.get(w);
      if (!byDay.has(song.day)) byDay.set(song.day, []);
      const list = byDay.get(song.day);
      if (list[list.length - 1] !== i) list.push(i);
    }
  });
}

// index[word] = [[day, lineIdx], ...]: one line per track (its first use).
const index = {};
for (const [w, byDay] of [...uses.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (byDay.size < MIN_TRACKS || byDay.size > MAX_TRACKS) continue;
  index[w] = [...byDay.entries()].map(([day, list]) => [day, list[0]]);
}

fs.writeFileSync(outFile, JSON.stringify({ generatedFrom: 'public/lyrics', tracks, index }));
const lineCount = Object.values(tracks).reduce((n, l) => n + l.length, 0);
console.log(`wrote public/word_chain.json: ${Object.keys(tracks).length} tracks, ${lineCount} lines, ${Object.keys(index).length} linking words, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`);
