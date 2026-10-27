// Lyric text helpers shared by the build scripts that read public/lyrics:
// tokenising, stop words, the slur/profanity filters and LRC line cleanup.

import fs from 'fs';
import path from 'path';

export const STOP = new Set(`
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
export const BLOCK = /^(nigg|fag|retard|tranny|chink|spic|kike)/;
export const PROFANE = /^(fuck|motherfuck|shit|bitch|cunt|dick|pussy|ass$|asshole|damn|hoe)/;
// Credits and filler that leak in from titles.
export const CREDIT = new Set(['alternative', 'ballad', 'pop', 'electronic', 'indie', 'rock', 'rap', 'hip-hop', 'hiphop', 'growth',
  'gon', 'doin', 'sayin', 'somethin', 'nothin', 'lookin', 'goin', 'comin', 'feelin', 'tryna', 'feat', 'ft', 'featuring', 'cover', 'remix', 'version', 'edit', 'mix', 'prod', 'intro', 'outro', 'interlude', 'verse', 'challenge', 'open']);

export const norm = (w) => w.toLowerCase().replace(/[’`]/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, '').replace(/^'+|'+$/g, '')
  .replace(/^(\w{2,})in'$/, '$1ing');
export const isWord = (w) => w.length >= 3 && !STOP.has(w) && !STOP.has(w.replace(/'/g, '')) && !CREDIT.has(w) && !BLOCK.test(w) && /[a-z]/.test(w);
export const isClean = (w) => !PROFANE.test(w);
export const hasBlocked = (line) => line.split(/\s+/).some((t) => BLOCK.test(norm(t)));
export const profanity = (line) => line.split(/\s+/).filter((t) => PROFANE.test(norm(t))).length;

// "Cold as ice, cold as ice, cold as ice" → "Cold as ice"
export function collapseRepeats(line) {
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

// Enhanced-LRC word timings ("<00:04.98>it"), music notes, emoji and
// bracketed stage directions ("[Music]", "(I'm sorry)") never reach a hook.
export function scrubLine(raw) {
  return raw
    .replace(/<?\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, '')
    .replace(/\[[^\]]*\]?|\([^)]*\)?/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}♪♫]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Transcription filler and lines that aren't words at all.
export const JUNK = /thanks for watching|subscribe|wylio|fideo|like and share|^music$|^instrumental$/i;
export function isJunk(line) {
  const letters = (line.match(/[a-z]/gi) || []).length;
  return letters < 3 || letters / line.length < 0.5 || JUNK.test(line) || /[A-Z]-?[A-Z]?\d{2,}/.test(line);
}

// ── Official lyrics (lrc.th3scr1b3.art → public.lyric_timings) ────────────────
// The LRC layer is the official source of lyrics and timings. Build scripts
// call loadOfficialLyrics() once; published days then win over public/lyrics.
let official = null; // Map<day, [{ start, text }]>

export async function loadOfficialLyrics(root) {
  const url = (process.env.VITE_SUPABASE_URL || 'https://toemkhrfsbkfkutwcjkd.supabase.co').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_ANON_KEY
    || (fs.readFileSync(path.join(root, 'src/services/supabaseClient.ts'), 'utf8').match(/'(eyJ[^']+)'/) || [])[1];
  try {
    const res = await fetch(`${url}/rest/v1/lyric_timings?select=day,segments&order=day`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    official = new Map();
    for (const row of await res.json()) {
      const lines = (Array.isArray(row.segments) ? row.segments : [])
        .filter((s) => s && typeof s.text === 'string' && s.text.trim() && Number.isFinite(s.start))
        .sort((a, b) => a.start - b.start)
        .map((s) => ({ start: s.start, text: s.text.trim() }));
      if (lines.length) official.set(row.day, lines);
    }
    console.log(`[lyrics] official lyrics from lrc.th3scr1b3.art for ${official.size} days; public/lyrics covers the rest`);
  } catch (err) {
    if (process.env.ALLOW_STALE_LYRICS === '1') {
      console.warn(`[lyrics] official lyrics not reachable (${err.message}); using public/lyrics only`);
      official = new Map();
      return;
    }
    console.error(`[lyrics] official lyrics not reachable (${err.message}). Set ALLOW_STALE_LYRICS=1 to build from public/lyrics only.`);
    process.exit(1);
  }
}

/** The day's official lines ({ start, text }), or null when it isn't published. */
export function officialLines(day) {
  return official?.get(day) ?? null;
}

export function readLyricLines(lyricsDir, day) {
  const published = officialLines(day);
  if (published) {
    const lines = published.map((l) => scrubLine(l.text)).filter((l) => l && !isJunk(l));
    if (lines.length) return lines;
  }
  const file = path.join(lyricsDir, `day${String(day).padStart(3, '0')}.lrc`);
  if (!fs.existsSync(file)) return null;
  const lines = [];
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]\s*(.*)$/.exec(raw.trim());
    if (!m) continue;
    const line = scrubLine(m[1]);
    if (line && !isJunk(line)) lines.push(line);
  }
  return lines.length ? lines : null;
}
