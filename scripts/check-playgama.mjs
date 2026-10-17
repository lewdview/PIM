#!/usr/bin/env node
/**
 * Readiness report for the twelve monthly Playgama games: `npm run check:playgama`
 *
 *   npm run check:playgama [-- --media-dir=PATH] [--month=N]
 *
 * For each month: track count, charts (both editions), lyrics, chapter story,
 * and whether every song, cover and Bombshell file the build bundles exists,
 * in --media-dir when given, otherwise on files.th3scr1b3.art (HEAD requests,
 * nothing is downloaded). A month is READY when `build:playgama` would succeed
 * for it; missing lyrics only thin out the chapter text and don't block it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { monthDays, monthMediaEntries } from '../src/platform/playgama/monthMedia.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
const mediaDir = typeof args['media-dir'] === 'string' ? path.resolve(args['media-dir']) : null;
const months = args.month ? [Number(args.month)] : MONTH_NAMES.map((_, i) => i + 1);
const STORAGE_BASE = (process.env.VITE_STORAGE_BASE_URL || 'https://files.th3scr1b3.art').replace(/\/?$/, '/');

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const dayFileMap = readJson('src/game/day_file_map.json');
const bombshellMap = readJson('src/game/bombshell_covers_map.json');
const stories = readJson('src/data/chapter_stories.json').months;
const pad3 = (n) => String(n).padStart(3, '0');
const has = (rel) => fs.existsSync(path.join(root, rel));

async function exists(rel) {
  if (mediaDir) return fs.existsSync(path.join(mediaDir, rel));
  const url = STORAGE_BASE + encodeURIComponent(rel).replace(/%2F/g, '/');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return res.ok;
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error(`Could not reach ${STORAGE_BASE} (pass --media-dir to check a local copy)`);
}

/** Runs `fn` over `items` with at most `n` in flight. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

let blocked = 0;
for (const m of months) {
  const days = monthDays(m, dayFileMap);
  const noChart = days.filter((d) =>
    !has(`public/data/songs_variants/v6_master/day-${pad3(d)}.json`) ||
    !has(`public/data/songs_variants/v1_gimmicks/day-${pad3(d)}.json`));
  const lyrics = days.filter((d) => fs.readdirSync(path.join(root, 'public/lyrics')).some((f) => f.startsWith(`day${pad3(d)}.`))).length;
  const story = stories.find((s) => s.month === m && s.acts?.length);
  const entries = monthMediaEntries(m, dayFileMap, bombshellMap, true);
  const found = await pool(entries, 12, async (e) => {
    for (const rel of [e.remote, ...e.aliases]) if (await exists(rel)) return true;
    return false;
  });
  const missing = entries.filter((_, k) => !found[k]);
  const ready = days.length > 0 && noChart.length === 0 && !!story && missing.length === 0;
  if (!ready) blocked++;

  console.log(`\n${ready ? 'READY  ' : 'BLOCKED'} ${MONTH_NAMES[m - 1]}: ${days.length} tracks (${Math.max(0, days.length - 5)} + 5 bonus), ` +
    `product PIM_${MONTH_NAMES[m - 1]}_Bonus, leaderboard PIM_${MONTH_NAMES[m - 1]}_Score`);
  console.log(`  charts   ${noChart.length ? `missing for day ${noChart.join(', ')}` : 'ok'}`);
  console.log(`  story    ${story ? 'ok' : 'missing'}`);
  console.log(`  lyrics   ${lyrics}/${days.length} tracks`);
  console.log(`  media    ${missing.length ? `${missing.length} missing:` : `ok (${entries.length} files)`}`);
  for (const e of missing) console.log(`           day ${e.day} ${e.kind}: ${e.remote}`);
}

console.log(`\n${months.length - blocked}/${months.length} months ready.`);
process.exit(blocked ? 1 : 0);
