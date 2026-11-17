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
 *   npm run build:playgama -- --month=1 [--media-dir=PATH] [--no-bombshell] [--no-album] [--bonus-price=2] [--public-token=TOKEN]
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
 *   - lyrics: lrc.th3scr1b3.art is the official source. Each published day's
 *     timings (public.lyric_timings) are baked into lyrics/dayNNN.json and win
 *     over the bundled .lrc; the build lists which days are official. It stops
 *     if Supabase can't be reached, unless --allow-stale-lyrics.
 *   - --placeholder-media makes silent audio and blank art instead, to test the
 *     build without the real files. Never upload that zip.
 *   -> pim-playgama-<month>.zip
 *
 * One portal per build, each with its own SDK and nothing of the others':
 *
 *   --portal=playgama    (default) Playgama Bridge, its config, purchases and banners
 *   --portal=klyo        games.klyo.pl SDK                       -> pim-klyo-<month>.zip
 *   --portal=crazygames  CrazyGames HTML5 SDK v3                 -> pim-crazygames-<month>.zip
 *   --portal=gamealia    Gamealia SDK                            -> pim-gamealia-<month>.zip
 *
 *   --bombshell-dir=PATH  takes each day's perfect-run art from PATH (a file whose name
 *     holds the three-digit day, e.g. th3scr1b3_007.jpg or d007.jpg) instead of the
 *     Bombshell art on the CDN; for portals whose content rules exclude suggestive art.
 *   --cache-dir=PATH  keeps downloaded media there, so building several portals in a
 *     row downloads each file once.
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
const PORTALS = ['playgama', 'klyo', 'crazygames', 'gamealia'];
const portal = typeof args.portal === 'string' ? args.portal : 'playgama';
if (!PORTALS.includes(portal)) {
  console.error(`[build-playgama] --portal must be one of ${PORTALS.join(', ')}.`);
  process.exit(1);
}
const month = args.month ? Number(args.month) : 0;
if (args.month && !(Number.isInteger(month) && month >= 1 && month <= 12)) {
  console.error('[build-playgama] --month must be 1-12.');
  process.exit(1);
}
const withBombshell = month > 0 && !args['no-bombshell'];
// Chapter card album: on by default, --no-album builds the Phase A game without it.
const withAlbum = month > 0 && !args['no-album'];
const mediaDir = typeof args['media-dir'] === 'string' ? path.resolve(args['media-dir']) : null;
const placeholderMedia = !!args['placeholder-media'];
const bombshellDir = typeof args['bombshell-dir'] === 'string' ? path.resolve(args['bombshell-dir']) : null;
const cacheDir = typeof args['cache-dir'] === 'string' ? path.resolve(args['cache-dir']) : null;
const STORAGE_BASE = (process.env.VITE_STORAGE_BASE_URL || 'https://files.th3scr1b3.art').replace(/\/?$/, '/');

const zipPath = path.join(root, month ? `pim-${portal}-${MONTH_NAMES[month - 1]}.zip` : `pim-${portal}.zip`);
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

// Build version shown in game (title screen, Options) and written to version.json,
// so an upload on Playgama can be matched to its build: m02-20261028.1745-cc926a6
// (month, local build time, commit; "-dirty" when the tree had uncommitted changes).
const buildVersion = (() => {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}.${p2(d.getHours())}${p2(d.getMinutes())}`;
  const git = (...a) => { try { return execFileSync('git', a, { cwd: root }).toString().trim(); } catch { return ''; } };
  const sha = git('rev-parse', '--short=7', 'HEAD') || 'nogit';
  const dirty = git('status', '--porcelain', '--untracked-files=no') ? '-dirty' : '';
  return `${month ? `m${p2(month)}` : 'all'}-${stamp}-${sha}${dirty}${month && !withAlbum ? '-noalbum' : ''}${portal === 'playgama' ? '' : `-${portal}`}`;
})();

console.log(`[build-playgama] vite build (portal ${portal}${month ? `, month ${month}` : ''}, version ${buildVersion})`);
run('npx', ['vite', 'build', '--config', 'vite.config.ts'], {
  env: {
    ...process.env,
    VITE_PLATFORM: 'playgama',
    PIM_PORTAL: portal,
    PIM_PLAYGAMA_MONTH: String(month),
    PIM_PLAYGAMA_BOMBSHELL: withBombshell ? '1' : '0',
    PIM_PLAYGAMA_ALBUM: withAlbum ? '1' : '0',
    PIM_BUILD_VERSION: buildVersion,
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

fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ version: buildVersion, month, album: withAlbum, builtAt: new Date().toISOString() }, null, 2) + '\n');

fs.rmSync(zipPath, { force: true });
run('zip', ['-qr', '-9', zipPath, '.'], { cwd: out });

const size = fs.statSync(zipPath).size;
const mb = (size / 1024 / 1024).toFixed(1);
console.log(`[build-playgama] ${path.relative(root, zipPath)}: ${mb} MB, version ${buildVersion}`);
if (size > MAX_ARCHIVE_BYTES) {
  console.error('[build-playgama] Archive is over the 300 MB limit.');
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
  const cached = cacheDir && path.join(cacheDir, rel);
  if (cached && fs.existsSync(cached)) return fs.readFileSync(cached);
  const url = STORAGE_BASE + encodeURIComponent(rel).replace(/%2F/g, '/');
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (cached) {
      fs.mkdirSync(path.dirname(cached), { recursive: true });
      fs.writeFileSync(cached, data);
    }
    return data;
  } catch {
    return null;
  }
}

/** The replacement perfect-run art for a day from --bombshell-dir, or null. */
function bombshellOverride(day) {
  if (!bombshellDir) return null;
  const tag = String(day).padStart(3, '0');
  const name = fs.readdirSync(bombshellDir)
    .filter((n) => /\.(jpe?g|png|webp)$/i.test(n) && new RegExp(`(^|[^0-9])${tag}([^0-9]|$)`).test(n))
    .sort()[0];
  return name ? path.join(bombshellDir, name) : null;
}

/** Puts the original file for an entry at `dest`; false if none of its paths exist. */
async function fetchSource(entry, dest) {
  if (entry.kind === 'bombshell' && bombshellDir) {
    const local = bombshellOverride(entry.day);
    if (!local) return false;
    fs.copyFileSync(local, dest);
    return true;
  }
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

/**
 * lrc.th3scr1b3.art is the official source of lyrics and word timings: it
 * publishes each day to public.lyric_timings. A portal build can't call
 * Supabase at runtime, so the month's published days are baked into
 * lyrics/dayNNN.json, which the game reads before any bundled .lrc.
 * Pass --allow-stale-lyrics to build anyway when Supabase can't be reached.
 */
async function bakeOfficialLyrics(days, dayId) {
  const url = (process.env.VITE_SUPABASE_URL || 'https://toemkhrfsbkfkutwcjkd.supabase.co').replace(/\/$/, '');
  const key = process.env.VITE_SUPABASE_ANON_KEY
    || (fs.readFileSync(path.join(root, 'src/services/supabaseClient.ts'), 'utf8').match(/'(eyJ[^']+)'/) || [])[1];
  const list = [...days].sort((a, b) => a - b);
  let rows;
  try {
    const res = await fetch(`${url}/rest/v1/lyric_timings?select=day,words,segments&day=in.(${list.join(',')})`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rows = await res.json();
  } catch (err) {
    const msg = `[build-playgama] Could not read the official lyrics (lyric_timings): ${err.message}`;
    if (args['allow-stale-lyrics']) { console.warn(`${msg}; using the bundled .lrc files only.`); return; }
    console.error(`${msg}\n  Rerun with --allow-stale-lyrics to build with the bundled .lrc files only.`);
    process.exit(1);
  }
  const lyricsDir = path.join(out, 'lyrics');
  fs.mkdirSync(lyricsDir, { recursive: true });
  const official = new Set();
  for (const row of rows) {
    const words = Array.isArray(row.words) ? row.words : [];
    const segments = Array.isArray(row.segments) ? row.segments : [];
    if (!segments.length) continue;
    fs.writeFileSync(path.join(lyricsDir, `day${String(row.day).padStart(3, '0')}.json`), JSON.stringify({ words, segments }));
    official.add(row.day);
  }
  const fallback = list.filter((d) => !official.has(d) && fs.existsSync(path.join(lyricsDir, `day${String(d).padStart(3, '0')}.lrc`)));
  const none = list.filter((d) => !official.has(d) && !fallback.includes(d));
  console.log(`[build-playgama] lyrics: ${official.size}/${list.length} days from lrc.th3scr1b3.art (official)` +
    (fallback.length ? `; older bundled .lrc for days ${fallback.join(', ')}` : '') +
    (none.length ? `; no lyrics for days ${none.join(', ')}` : ''));
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
  await bakeOfficialLyrics(days, dayId);

  // Pack, crate and launch-page art belong to the vault and shop, which this build doesn't have.
  for (const rel of ['data/packs', 'data/crates', 'data/launch', 'data/slideshow']) {
    fs.rmSync(path.join(out, rel), { recursive: true, force: true });
  }

  // The Bombshell ending's one-off piece: public/endings/mMM-final.(jpg|jpeg|png|webp).
  // Only this month's ships, as the mMM-final.jpg the game asks for.
  const endingsDir = path.join(out, 'endings');
  const finalStem = `m${String(month).padStart(2, '0')}-final`;
  pruneDir(endingsDir, (name) => name.startsWith(`${finalStem}.`));
  if (fs.existsSync(endingsDir)) {
    const src = fs.readdirSync(endingsDir).find((n) => /\.(jpe?g|png|webp)$/i.test(n));
    if (src) {
      const tmpOut = path.join(endingsDir, `${finalStem}.tmp.jpg`);
      run('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(endingsDir, src), '-vf', "scale='min(1600,iw)':-2", '-q:v', '3', tmpOut]);
      pruneDir(endingsDir, (name) => name === path.basename(tmpOut));
      fs.renameSync(tmpOut, path.join(endingsDir, `${finalStem}.jpg`));
      console.log(`[build-playgama] final Bombshell piece: endings/${finalStem}.jpg`);
    } else {
      console.log(`[build-playgama] no final Bombshell piece for this month (public/endings/${finalStem}.jpg); the ending shows the gallery`);
    }
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
    const ext = entry.kind === 'bombshell' && bombshellDir ? path.extname(bombshellOverride(entry.day) || '') : path.extname(entry.remote);
    const src = path.join(tmp, `src${ext || '.bin'}`);
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
