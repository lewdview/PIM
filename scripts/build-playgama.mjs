#!/usr/bin/env node
/**
 * Builds the Playgama upload: `npm run build:playgama`
 *
 *   1. vite build with VITE_PLATFORM=playgama  -> dist-playgama/
 *   2. drops files the portal build must not ship (web-only pages, store
 *      screenshots, Farcaster manifest, the Stella slideshow photos)
 *   3. re-encodes the long music beds to MP3 and gives every sfx file a plain
 *      Latin name (see src/platform/playgama/sfx.ts)
 *   4. zips the folder with index.html at the root -> pim-playgama.zip
 *
 * Monthly build, one campaign chapter as its own game ("PIM: January"):
 *
 *   npm run build:playgama -- --month=1 [--media-dir=PATH] [--no-bombshell] [--bonus-price=2] [--public-token=TOKEN]
 *   npm run build:playgama -- --month=all ...    (all twelve, or a list: --month=2,3)
 *
 *   - ships only that month's charts and lyrics, and bundles its songs, covers
 *     and (unless --no-bombshell) one Bombshell artwork per track, re-encoded
 *     to fit the 300 MB cap. Files come from --media-dir (a local copy laid out
 *     like files.th3scr1b3.art, e.g. /Volumes/extremeUno/th3scr1b3-365-warp/365-releases)
 *     when given, otherwise they are downloaded from the CDN.
 *   - --bonus-price is the bonus bundle's price in USD (default 2). The bundle is
 *     sold as PIM_<Month>_Bonus, which must also be in the Playgama dashboard.
 *   - --public-token (or PIM_PLAYGAMA_PUBLIC_TOKEN) is the game's public token from
 *     the Playgama dashboard; it turns on the in-game leaderboard on playgama.com.
 *   - --placeholder-media makes silent audio and blank art instead, to test the
 *     build without the real files. Never upload that zip.
 *   -> pim-playgama-<month>.zip
 *
 * Needs ffmpeg and zip on PATH.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { monthDays, monthMediaEntries } from '../src/platform/playgama/monthMedia.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-playgama');
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
// --month=all (or a list such as --month=1,2,3) builds one zip per month in turn.
if (typeof args.month === 'string' && (args.month === 'all' || args.month.includes(','))) {
  const months = args.month === 'all' ? MONTH_NAMES.map((_, i) => i + 1) : args.month.split(',').map(Number);
  const rest = process.argv.slice(2).filter((a) => !a.startsWith('--month'));
  for (const m of months) {
    console.log(`\n[build-playgama] ==== ${MONTH_NAMES[m - 1] ?? m} ====`);
    execFileSync(process.execPath, [fileURLToPath(import.meta.url), `--month=${m}`, ...rest], { stdio: 'inherit', cwd: root });
  }
  process.exit(0);
}
const month = args.month ? Number(args.month) : 0;
if (args.month && !(Number.isInteger(month) && month >= 1 && month <= 12)) {
  console.error('[build-playgama] --month must be 1-12.');
  process.exit(1);
}
const withBombshell = month > 0 && !args['no-bombshell'];
const mediaDir = typeof args['media-dir'] === 'string' ? path.resolve(args['media-dir']) : null;
const placeholderMedia = !!args['placeholder-media'];
const STORAGE_BASE = (process.env.VITE_STORAGE_BASE_URL || 'https://files.th3scr1b3.art').replace(/\/?$/, '/');

const zipPath = path.join(root, month ? `pim-playgama-${MONTH_NAMES[month - 1]}.zip` : 'pim-playgama.zip');
const MAX_ARCHIVE_BYTES = 300 * 1024 * 1024;

const compressedSfx = JSON.parse(
  fs.readFileSync(path.join(root, 'src/platform/playgama/compressedSfx.json'), 'utf8'),
);
const playgamaSfxName = (name) => name.replace(/[^A-Za-z0-9._-]/g, '_');

// Not part of the game on a portal.
const REMOVE = [
  '.well-known',
  '404.html.disabled',
  '_redirects',
  'farcaster.json',
  'email-signatures.html',
  'screenshots',
  'seo',
  'nft',
  'data/slideshow/stella',
  'audio/sfx/store_background.wav', // unreferenced
];

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
}

function requireTool(cmd) {
  try {
    execFileSync(cmd, ['-version'], { stdio: 'ignore' });
  } catch {
    try {
      execFileSync(cmd, ['-v'], { stdio: 'ignore' });
    } catch {
      console.error(`[build-playgama] "${cmd}" is required but was not found on PATH.`);
      process.exit(1);
    }
  }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

requireTool('ffmpeg');
requireTool('zip');

console.log(`[build-playgama] vite build (VITE_PLATFORM=playgama${month ? `, month ${month}` : ''})`);
run('npx', ['vite', 'build', '--config', 'vite.config.ts'], {
  env: {
    ...process.env,
    VITE_PLATFORM: 'playgama',
    PIM_PLAYGAMA_MONTH: String(month),
    PIM_PLAYGAMA_BOMBSHELL: withBombshell ? '1' : '0',
    ...(args['bonus-price'] ? { PIM_PLAYGAMA_BONUS_PRICE_USD: String(args['bonus-price']) } : {}),
    ...(args['public-token'] ? { PIM_PLAYGAMA_PUBLIC_TOKEN: String(args['public-token']) } : {}),
  },
});

for (const rel of REMOVE) fs.rmSync(path.join(out, rel), { recursive: true, force: true });

if (month) await buildMonth();

const sfxDir = path.join(out, 'audio/sfx');
for (const file of fs.readdirSync(sfxDir)) {
  if (!file.endsWith('.wav')) continue;
  const name = file.slice(0, -4);
  const src = path.join(sfxDir, file);
  const safe = playgamaSfxName(name);
  if (compressedSfx.includes(name)) {
    run('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-codec:a', 'libmp3lame', '-b:a', '192k', path.join(sfxDir, `${safe}.mp3`)]);
    fs.rmSync(src);
  } else if (safe !== name) {
    fs.renameSync(src, path.join(sfxDir, `${safe}.wav`));
  }
}

const badNames = walk(out)
  .map((p) => path.relative(out, p))
  .filter((p) => !/^[A-Za-z0-9._/-]+$/.test(p.split(path.sep).join('/')));
if (badNames.length) {
  console.error('[build-playgama] Non-Latin file names (Playgama rejects these):\n  ' + badNames.join('\n  '));
  process.exit(1);
}

fs.rmSync(zipPath, { force: true });
run('zip', ['-qr', '-9', zipPath, '.'], { cwd: out });

const size = fs.statSync(zipPath).size;
const mb = (size / 1024 / 1024).toFixed(1);
console.log(`[build-playgama] ${path.relative(root, zipPath)}: ${mb} MB`);
if (size > MAX_ARCHIVE_BYTES) {
  console.error('[build-playgama] Archive is over the 300 MB Playgama limit.');
  process.exit(1);
}

// ── Monthly build ────────────────────────────────────────────────────────────

/** Keeps only the files in `dir` whose name passes `keep`. */
function pruneDir(dir, keep) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!keep(name)) fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

async function fetchRemote(rel) {
  const url = STORAGE_BASE + encodeURIComponent(rel).replace(/%2F/g, '/');
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Puts the original file for an entry at `dest`; false if none of its paths exist. */
async function fetchSource(entry, dest) {
  for (const rel of [entry.remote, ...entry.aliases]) {
    if (mediaDir) {
      const local = path.join(mediaDir, rel);
      if (fs.existsSync(local)) {
        fs.copyFileSync(local, dest);
        return true;
      }
      continue;
    }
    const data = await fetchRemote(rel);
    if (data) {
      fs.writeFileSync(dest, data);
      return true;
    }
  }
  return false;
}

function writePlaceholder(entry, dest) {
  if (entry.kind === 'audio') {
    run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '200', '-codec:a', 'libmp3lame', '-b:a', '32k', dest]);
  } else {
    const color = entry.kind === 'bombshell' ? '0x5a1030' : '0x202838';
    run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=768x768`, '-frames:v', '1', dest]);
  }
}

async function buildMonth() {
  const dayFileMap = JSON.parse(fs.readFileSync(path.join(root, 'src/game/day_file_map.json'), 'utf8'));
  const bombshellMap = JSON.parse(fs.readFileSync(path.join(root, 'src/game/bombshell_covers_map.json'), 'utf8'));
  const days = new Set(monthDays(month, dayFileMap));
  const dayId = (d) => `day-${String(d).padStart(3, '0')}`;
  const monthChart = (name) => {
    const m = name.match(/^day-(\d{3})(_deluxe)?\.json$/);
    return !!m && days.has(Number(m[1]));
  };

  // Charts: the two editions open to every player (v6 default, v1 classic) plus the
  // canonical fallback, for this month only. Lyrics likewise.
  const variants = path.join(out, 'data/songs_variants');
  pruneDir(variants, (name) => name === 'v6_master' || name === 'v1_gimmicks');
  pruneDir(path.join(variants, 'v6_master'), monthChart);
  pruneDir(path.join(variants, 'v1_gimmicks'), monthChart);
  pruneDir(path.join(out, 'data/songs'), monthChart);
  pruneDir(path.join(out, 'lyrics'), (name) => {
    const m = name.match(/^day(\d{3})\./);
    return !!m && days.has(Number(m[1]));
  });
  // Pack, crate and launch-page art belong to the vault and shop, which this build doesn't have.
  for (const rel of ['data/packs', 'data/crates', 'data/launch', 'data/slideshow']) {
    fs.rmSync(path.join(out, rel), { recursive: true, force: true });
  }

  const entries = monthMediaEntries(month, dayFileMap, bombshellMap, withBombshell);
  const tmp = fs.mkdtempSync(path.join(out, '.media-src-'));
  const missing = [];
  console.log(`[build-playgama] bundling ${entries.length} media files for ${MONTH_NAMES[month - 1]} (${days.size} tracks)` +
    (placeholderMedia ? ' as PLACEHOLDERS' : mediaDir ? ` from ${mediaDir}` : ` from ${STORAGE_BASE}`));
  for (const entry of entries) {
    const dest = path.join(out, entry.local);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (placeholderMedia) {
      writePlaceholder(entry, dest);
      continue;
    }
    const src = path.join(tmp, `src${path.extname(entry.remote) || '.bin'}`);
    if (!(await fetchSource(entry, src))) {
      missing.push(entry.remote);
      continue;
    }
    if (entry.kind === 'audio') {
      run('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-vn', '-codec:a', 'libmp3lame', '-b:a', '160k', dest]);
    } else {
      run('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', dest]);
    }
    fs.rmSync(src, { force: true });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (missing.length) {
    console.error(`[build-playgama] Could not find ${missing.length} media file(s):\n  ` + missing.join('\n  '));
    process.exit(1);
  }
  if (!fs.existsSync(path.join(out, 'data/songs_variants/v6_master', `${dayId([...days][0])}.json`))) {
    console.error('[build-playgama] No charts found for this month.');
    process.exit(1);
  }
}
