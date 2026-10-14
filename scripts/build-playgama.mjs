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
 * Needs ffmpeg and zip on PATH.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-playgama');
const zipPath = path.join(root, 'pim-playgama.zip');
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

console.log('[build-playgama] vite build (VITE_PLATFORM=playgama)');
run('npx', ['vite', 'build', '--config', 'vite.config.ts'], {
  env: { ...process.env, VITE_PLATFORM: 'playgama' },
});

for (const rel of REMOVE) fs.rmSync(path.join(out, rel), { recursive: true, force: true });

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
