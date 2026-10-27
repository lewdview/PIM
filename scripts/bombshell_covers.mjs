#!/usr/bin/env node
/**
 * bombshell_covers.mjs — add new Bombshell covers end to end.
 *
 * The app only knows about a cover if it is listed in
 * src/game/bombshell_covers_map.json AND the file is live in storage at
 *   rare_covers/day <N>/<file>            (the card art)
 *   rare_covers/day <N>/hi res/<file>.png (optional hi-res download)
 * so this script keeps the two in step. See docs/bombshell-covers.md.
 *
 * Source folder layout (same as the local rare_covers folder):
 *   <src>/day 1/day 001 - 10.jpg
 *   <src>/day 1/lb day 001 - 05.jpg
 *   <src>/day 1/hi res/day 001 - 10.png      (optional)
 *
 * Commands
 *   scan   --src <dir>            Validate names and list what is new vs the map. Writes nothing.
 *   upload --src <dir> [--yes]    Upload files not already live. Dry run unless --yes.
 *   map    --src <dir> [--write]  Merge the source files into the map (never drops entries). Dry run unless --write.
 *   verify [--days 1-365]         HEAD every mapped file on the public storage URL and report gaps.
 *
 * Upload needs @aws-sdk/client-s3 (devDependency) and these env vars:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   (or R2_ENDPOINT instead of R2_ACCOUNT_ID for any S3-compatible host)
 * Public base for skip-existing and verify: STORAGE_BASE_URL, default https://files.th3scr1b3.art/
 *
 * Typical run:
 *   node scripts/bombshell_covers.mjs scan   --src "/Volumes/extremeUno/.../rare_covers"
 *   node scripts/bombshell_covers.mjs upload --src "..." --yes
 *   node scripts/bombshell_covers.mjs map    --src "..." --write
 *   node scripts/bombshell_covers.mjs verify
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
// The app imports the src copy; the public copy is kept identical for anything that fetches it.
const MAP_PATHS = [
  path.join(ROOT, 'src/game/bombshell_covers_map.json'),
  path.join(ROOT, 'public/data/bombshell_covers_map.json'),
];
const PUBLIC_BASE = (process.env.STORAGE_BASE_URL || 'https://files.th3scr1b3.art/').replace(/\/?$/, '/');
const MAX_DAY = 365;
// "day 001 - 01.jpg" / "lb day 001 - 01.jpg". Two-or-more digit index so 100+ covers still sort.
const COVER_RE = /^(lb )?day (\d{3}) - (\d{2,})\.jpg$/;

// ── args ────────────────────────────────────────────────────────────────

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) continue;
  const next = rest[i + 1];
  if (next !== undefined && !next.startsWith('--')) { flags[a.slice(2)] = next; i++; }
  else flags[a.slice(2)] = true;
}

function die(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

// ── map helpers ─────────────────────────────────────────────────────────

function readMap() {
  return JSON.parse(fs.readFileSync(MAP_PATHS[0], 'utf8'));
}

function coverIndex(file) {
  const m = COVER_RE.exec(file);
  return m ? parseInt(m[3], 10) : Number.MAX_SAFE_INTEGER;
}

function sortCovers(files) {
  return [...new Set(files)].sort((a, b) => coverIndex(a) - coverIndex(b) || a.localeCompare(b));
}

function storageKey(day, file, hiRes = false) {
  return `rare_covers/day ${day}/${hiRes ? 'hi res/' : ''}${file}`;
}

function publicUrl(key) {
  return PUBLIC_BASE + key.split('/').map(encodeURIComponent).join('/');
}

// ── scan ────────────────────────────────────────────────────────────────

/** Walk <src>/day N/ and return valid covers plus every problem found. */
function scanSource(src) {
  if (!src) die('--src <folder> is required');
  if (!fs.existsSync(src)) die(`source folder not found: ${src}`);

  const covers = []; // { day, file, abs, isLB, hiRes: abs|null }
  const problems = [];

  for (const dirName of fs.readdirSync(src).sort()) {
    const abs = path.join(src, dirName);
    if (!fs.statSync(abs).isDirectory()) continue;
    const dm = /^day (\d+)$/.exec(dirName);
    if (!dm) { problems.push(`folder "${dirName}" is not named "day N" (no zero padding), skipped`); continue; }
    const day = parseInt(dm[1], 10);
    if (day < 1 || day > MAX_DAY) { problems.push(`folder "${dirName}" is outside days 1-${MAX_DAY}, skipped`); continue; }

    const hiResDir = path.join(abs, 'hi res');
    const hiRes = fs.existsSync(hiResDir) ? new Set(fs.readdirSync(hiResDir)) : new Set();

    for (const file of fs.readdirSync(abs).sort()) {
      const fileAbs = path.join(abs, file);
      if (file.startsWith('.') || fs.statSync(fileAbs).isDirectory()) continue;
      const m = COVER_RE.exec(file);
      if (!m) {
        const hint = /\.(jpeg|png|webp|JPG)$/.test(file) ? ' (covers must be .jpg)' : '';
        problems.push(`day ${day}: "${file}" does not match "[lb ]day NNN - NN.jpg"${hint}, skipped`);
        continue;
      }
      if (parseInt(m[2], 10) !== day) {
        problems.push(`day ${day}: "${file}" names day ${m[2]} but sits in "${dirName}", skipped`);
        continue;
      }
      const png = file.replace(/\.jpg$/, '.png');
      covers.push({ day, file, abs: fileAbs, isLB: Boolean(m[1]), hiRes: hiRes.has(png) ? path.join(hiResDir, png) : null });
    }
  }
  return { covers, problems };
}

function diffAgainstMap(covers, map) {
  const added = covers.filter((c) => {
    const e = map[String(c.day)];
    return !e || !(c.isLB ? e.lbFiles : e.normalFiles).includes(c.file);
  });
  // A new file numbered below an existing one shifts the existing covers' positions in the list.
  const reordered = added.filter((c) => {
    const e = map[String(c.day)];
    const list = e ? (c.isLB ? e.lbFiles : e.normalFiles) : [];
    return list.some((f) => coverIndex(f) > coverIndex(c.file));
  });
  return { added, reordered };
}

function cmdScan() {
  const { covers, problems } = scanSource(flags.src);
  const map = readMap();
  const { added, reordered } = diffAgainstMap(covers, map);

  const byDay = new Map();
  for (const c of added) byDay.set(c.day, [...(byDay.get(c.day) || []), c]);
  console.log(`Source: ${covers.length} valid covers, ${added.length} not yet in the map, across ${byDay.size} days.`);
  for (const [day, list] of [...byDay].sort((a, b) => a[0] - b[0])) {
    const before = map[String(day)]?.totalCovers ?? 0;
    const noHiRes = list.filter((c) => !c.hiRes).length;
    console.log(`  day ${day}: ${before} → ${before + list.length}  (+${list.map((c) => c.file).join(', ')})${noHiRes ? `  [${noHiRes} without hi res png]` : ''}`);
  }
  if (reordered.length) {
    console.log('\n⚠ These new files number below an existing cover on the same day, so they reorder the list:');
    for (const c of reordered) console.log(`  day ${c.day}: ${c.file}`);
  }
  if (problems.length) {
    console.log(`\n⚠ ${problems.length} problem(s):`);
    for (const p of problems) console.log(`  ${p}`);
  }
  return { covers, added, problems };
}

// ── upload ──────────────────────────────────────────────────────────────

/** 'live' | 'missing' | 'error' (could not reach storage at all). */
async function liveState(key) {
  try {
    const res = await fetch(publicUrl(key), { method: 'HEAD' });
    return res.ok ? 'live' : 'missing';
  } catch {
    return 'error';
  }
}

async function cmdUpload() {
  const { covers } = scanSource(flags.src);
  const jobs = [];
  for (const c of covers) {
    jobs.push({ key: storageKey(c.day, c.file), abs: c.abs, type: 'image/jpeg' });
    if (c.hiRes) jobs.push({ key: storageKey(c.day, path.basename(c.hiRes), true), abs: c.hiRes, type: 'image/png' });
  }

  console.log(`Checking ${jobs.length} files against ${PUBLIC_BASE} …`);
  const todo = [];
  let unreachable = 0;
  for (const j of jobs) {
    const state = await liveState(j.key);
    if (state === 'error') unreachable++;
    if (state !== 'live') todo.push(j);
  }
  console.log(`${jobs.length - todo.length} already live, ${todo.length} to upload.`);
  if (unreachable) console.log(`⚠ ${PUBLIC_BASE} was unreachable for ${unreachable} file(s); they are re-uploaded to be safe.`);
  for (const j of todo) console.log(`  ${j.key}`);
  if (!todo.length) return;
  if (!flags.yes) { console.log('\nDry run. Re-run with --yes to upload.'); return; }

  const { R2_ACCOUNT_ID, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !(R2_ACCOUNT_ID || R2_ENDPOINT)) {
    die('set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_ACCOUNT_ID (or R2_ENDPOINT)');
  }
  let S3;
  try { S3 = await import('@aws-sdk/client-s3'); }
  catch { die('npm install first (needs the @aws-sdk/client-s3 devDependency)'); }

  const client = new S3.S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  let done = 0;
  for (const j of todo) {
    await client.send(new S3.PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: j.key,
      Body: fs.readFileSync(j.abs),
      ContentType: j.type,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    console.log(`  ✓ ${++done}/${todo.length} ${j.key}`);
  }
  console.log('Upload done. Next: map --write, then verify.');
}

// ── map ─────────────────────────────────────────────────────────────────

function cmdMap() {
  const { covers, problems } = scanSource(flags.src);
  if (problems.length) console.log(`⚠ ${problems.length} source problem(s); run scan to see them. Valid files are still merged.`);
  const map = readMap();
  const { added } = diffAgainstMap(covers, map);

  for (const c of added) {
    const key = String(c.day);
    const e = map[key] || { day: c.day, dir: `day ${c.day}`, lbFiles: [], normalFiles: [], totalCovers: 0 };
    (c.isLB ? e.lbFiles : e.normalFiles).push(c.file);
    map[key] = e;
  }
  const ordered = {};
  for (const key of Object.keys(map).sort((a, b) => Number(a) - Number(b))) {
    const e = map[key];
    e.lbFiles = sortCovers(e.lbFiles);
    e.normalFiles = sortCovers(e.normalFiles);
    e.totalCovers = e.lbFiles.length + e.normalFiles.length;
    ordered[key] = e;
  }

  const total = Object.values(ordered).reduce((s, e) => s + e.totalCovers, 0);
  console.log(`${added.length} cover(s) added → ${total} covers across ${Object.keys(ordered).length} days.`);
  if (!flags.write) { console.log('Dry run. Re-run with --write to update both map copies.'); return; }
  const json = JSON.stringify(ordered, null, 2) + '\n';
  for (const p of MAP_PATHS) fs.writeFileSync(p, json);
  console.log(`Wrote ${MAP_PATHS.map((p) => path.relative(ROOT, p)).join(' and ')}.`);
}

// ── verify ──────────────────────────────────────────────────────────────

async function cmdVerify() {
  const map = readMap();
  let [lo, hi] = [1, MAX_DAY];
  if (typeof flags.days === 'string') {
    const [a, b] = flags.days.split('-').map(Number);
    lo = a || 1; hi = b || a || MAX_DAY;
  }
  const keys = [];
  for (let d = lo; d <= hi; d++) {
    const e = map[String(d)];
    if (!e) continue;
    for (const f of [...e.lbFiles, ...e.normalFiles]) keys.push(storageKey(d, f));
  }
  console.log(`HEAD-checking ${keys.length} covers for days ${lo}-${hi} on ${PUBLIC_BASE} …`);
  const missing = [];
  const unreachable = [];
  const queue = [...keys];
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (queue.length) {
      const k = queue.shift();
      const state = await liveState(k);
      if (state === 'missing') missing.push(k);
      if (state === 'error') unreachable.push(k);
    }
  }));
  if (unreachable.length) {
    console.log(`✖ could not reach ${PUBLIC_BASE} for ${unreachable.length} file(s); check the network and re-run.`);
    process.exitCode = 1;
    return;
  }
  if (!missing.length) { console.log('✓ every mapped cover is live'); return; }
  console.log(`✖ ${missing.length} mapped cover(s) are not live:`);
  for (const k of missing.sort()) console.log(`  ${k}`);
  process.exitCode = 1;
}

// ── main ────────────────────────────────────────────────────────────────

const commands = { scan: cmdScan, upload: cmdUpload, map: cmdMap, verify: cmdVerify };
if (!commands[cmd]) {
  console.log('Usage: node scripts/bombshell_covers.mjs <scan|upload|map|verify> [--src <folder>] [--yes] [--write] [--days 1-365]');
  process.exit(cmd ? 1 : 0);
}
await commands[cmd]();
