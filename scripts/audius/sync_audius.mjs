#!/usr/bin/env node
/**
 * sync_audius.mjs
 *
 * Builds src/data/audius_map.json: every th3Scr1b3 track on Audius, matched to
 * its 365 day where there is one. Tracks with no day are "beyond" (the
 * Beyond 365 section).
 *
 * Matching is by normalized title, with duration as a sanity check. Anything
 * uncertain is marked "review". Hand decisions live in overrides.json and
 * always win, so re-running the sync never undoes a correction. An override
 * with "alt": true is a second upload of a day's song; the card links the
 * non-alt track.
 *
 * Usage:
 *   node scripts/audius/sync_audius.mjs              # fetch live from Audius
 *   node scripts/audius/sync_audius.mjs --from-tsv   # use scripts/audius/raw.tsv
 *
 * raw.tsv lines: title|permalink|play_count|duration_seconds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HANDLE = 'th3Scr1b3';
const APP_NAME = 'PIM';
const API = 'https://api.audius.co/v1';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const catalogPath = path.join(root, 'src/data/song_catalog.json');
const overridesPath = path.join(here, 'overrides.json');
const tsvPath = path.join(here, 'raw.tsv');
const outPath = path.join(root, 'src/data/audius_map.json');

async function fetchLive() {
  const tracks = [];
  for (let offset = 0; ; offset += 50) {
    const url = `${API}/users/handle/${HANDLE}/tracks?app_name=${APP_NAME}&limit=50&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Audius ${res.status} for ${url}`);
    const { data } = await res.json();
    if (!data?.length) break;
    for (const t of data) {
      tracks.push({
        title: t.title,
        permalink: t.permalink,
        plays: t.play_count ?? 0,
        duration: t.duration ?? 0,
      });
    }
    if (data.length < 50) break;
  }
  return tracks;
}

function readTsv() {
  return fs
    .readFileSync(tsvPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [title, permalink, plays, duration] = line.split('|');
      return { title, permalink, plays: Number(plays), duration: Number(duration) };
    });
}

export function normTitle(s) {
  return s
    .toLowerCase()
    .replace(/\(?\s*\b(feat\.?|ft\.?)\s[^)]*\)?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Similarity in [0,1] from the longest common subsequence of two strings.
function similarity(a, b) {
  if (!a || !b) return 0;
  const dp = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return (2 * dp[b.length]) / (a.length + b.length);
}

function bestMatch(track, catalog) {
  const n = normTitle(track.title);
  let best = null;
  for (const song of catalog) {
    const sim = similarity(n, normTitle(song.title));
    if (!best || sim > best.sim) {
      best = { sim, song, durationDiff: Math.abs((song.duration ?? 0) - track.duration) };
    }
  }
  return best;
}

async function main() {
  const fromTsv = process.argv.includes('--from-tsv');
  const tracks = fromTsv ? readTsv() : await fetchLive();
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const overrides = fs.existsSync(overridesPath)
    ? JSON.parse(fs.readFileSync(overridesPath, 'utf8'))
    : {};
  const byDay = new Map(catalog.map((s) => [s.day, s]));

  const out = tracks.map((t) => {
    const base = {
      permalink: t.permalink,
      url: `https://audius.co${t.permalink}`,
      title: t.title,
      duration: t.duration,
    };
    const o = overrides[t.permalink];
    if (o) {
      const song = o.day ? byDay.get(o.day) : null;
      return {
        ...base,
        day: o.day ?? null,
        dayTitle: song?.title ?? null,
        status: o.day ? 'matched' : 'beyond',
        ...(o.alt ? { alt: true } : {}),
        note: o.note ?? 'set by hand',
      };
    }
    const m = bestMatch(t, catalog);
    const exact = m.sim >= 0.999;
    // Same title is a match even when the length differs (a different mix
    // of the same song still deserves the link); near titles need a look.
    const status = exact ? 'matched' : m.sim >= 0.6 ? 'review' : 'beyond';
    let note;
    if (status === 'review') {
      note = `title ${(m.sim * 100).toFixed(0)}% similar, length differs by ${m.durationDiff}s`;
    } else if (status === 'matched' && m.durationDiff > 15) {
      note = `same title, length differs by ${m.durationDiff}s (different mix?)`;
    }
    return {
      ...base,
      day: status === 'beyond' ? null : m.song.day,
      dayTitle: status === 'beyond' ? null : m.song.title,
      status,
      note,
      _sim: m.sim,
    };
  });

  // Two Audius tracks claiming the same day: keep the closer one matched.
  const claims = new Map();
  for (const t of out) {
    if (t.status === 'beyond' || !t.day) continue;
    claims.set(t.day, [...(claims.get(t.day) ?? []), t]);
  }
  for (const [day, list] of claims) {
    if (list.length < 2) continue;
    const keep = list.find((t) => overrides[t.permalink]?.day === day)
      ?? [...list].sort((a, b) => (b._sim ?? 0) - (a._sim ?? 0))[0];
    for (const t of list) {
      if (t === keep || overrides[t.permalink]) continue;
      t.status = 'review';
      t.note = `day ${day} already matches "${keep.title}"; duplicate upload or a different song?`;
    }
  }
  for (const t of out) delete t._sim;

  const doc = {
    handle: HANDLE,
    generatedAt: new Date().toISOString(),
    counts: {
      total: out.length,
      matched: out.filter((t) => t.status === 'matched').length,
      review: out.filter((t) => t.status === 'review').length,
      beyond: out.filter((t) => t.status === 'beyond').length,
    },
    tracks: out,
  };
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
  console.log(`Wrote ${path.relative(root, outPath)}`, doc.counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
