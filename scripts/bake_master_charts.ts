#!/usr/bin/env node
/**
 * bake_master_charts.ts — Chart Master (v6) batch baker.
 *
 * Downloads each day's audio (cached), decodes it with ffmpeg, runs the
 * Chart Master generator (src/game/chartMaster — the same code the game
 * uses at runtime) and writes public/data/songs_variants/v6_master/day-XXX.json.
 *
 * Usage (Node 22.6+ runs the TypeScript directly):
 *   node scripts/bake_master_charts.ts                 # all days, skip existing
 *   node scripts/bake_master_charts.ts 1 14 284        # specific days
 *   node scripts/bake_master_charts.ts --force         # rebuild everything
 *   node scripts/bake_master_charts.ts --jobs 6
 *   node scripts/bake_master_charts.ts --local /Volumes/extremeUno/th3scr1b3-365-warp/365-releases
 *   node scripts/bake_master_charts.ts --deluxe        # Chart Master Deluxe → day-XXX_deluxe.json
 *
 * Audio source per day: --local base + src/game/day_file_map.json path when
 * that file exists, else a file already in --cache, else a download from the
 * song's audioUrl. Downloads are deleted after decoding unless --keep.
 *
 * Requires ffmpeg on PATH.
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  analyzeAudio, generateMasterChart, ANALYSIS_SAMPLE_RATE, CHART_MASTER_VERSION, CHART_MASTER_DELUXE_VERSION, type ChartMasterReport,
} from '../src/game/chartMaster/index.ts';
import { measureSync, validateChart } from '../src/game/chartMaster/validate.ts';

const run = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SONGS_DIR = path.join(ROOT, 'public/data/songs');
const OUT_DIR = path.join(ROOT, 'public/data/songs_variants', CHART_MASTER_VERSION);
/** Previous default edition — scored alongside v6 for the manifest. */
const LEGACY_DIR = path.join(ROOT, 'public/data/songs_variants/v1_gimmicks');

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const force = flag('--force');
const keep = flag('--keep');
/** Deluxe edition: written next to the v6 charts as day-XXX_deluxe.json. */
const deluxe = flag('--deluxe');
const localBase = opt('--local', '');
const dayFileMap: Record<string, { audio: string }> = JSON.parse(
  readFileSync(path.join(ROOT, 'src/game/day_file_map.json'), 'utf8'),
);
const jobs = Math.max(1, parseInt(opt('--jobs', '4'), 10));
const cacheDir = opt('--cache', path.join(homedir(), '.cache', 'pim-chart-master', 'audio')).replace(/^~/, homedir());
const optionValues = new Set([opt('--jobs', ''), opt('--cache', ''), localBase]);
const dayArgs = args.filter((a) => /^\d+$/.test(a) && !optionValues.has(a)).map(Number);

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const dayFiles = readdirSync(SONGS_DIR)
  .filter((f) => /^day-\d{3}\.json$/.test(f))
  .filter((f) => dayArgs.length === 0 || dayArgs.includes(parseInt(f.slice(4, 7), 10)))
  .sort();

async function fetchAudio(url: string, dest: string) {
  if (existsSync(dest)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function decode(file: string): Promise<Float32Array> {
  const { stdout } = await run(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(ANALYSIS_SAMPLE_RATE), '-f', 'f32le', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 30 },
  );
  const buf = stdout as Buffer;
  // Copy into an aligned buffer (Buffer slices may be unaligned for Float32Array)
  const out = new Float32Array(buf.byteLength / 4);
  new Uint8Array(out.buffer).set(buf);
  return out;
}

interface ManifestEntry {
  id: string;
  title: string;
  notes: number;
  bpm: number;
  catalogBpm: number;
  povTimes: number[];
  types: Record<string, number>;
  /** Share of notes on a strong onset: v6, the old v1 default, and random placement. */
  sync: { v6: number; v1: number | null; random: number };
}

const manifestPath = path.join(OUT_DIR, deluxe ? 'manifest_deluxe.json' : 'manifest.json');
const manifest: Record<string, ManifestEntry> = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8')).songs ?? {}
  : {};

let done = 0;
let skipped = 0;
const failed: string[] = [];

async function bake(file: string) {
  const id = file.replace('.json', '');
  const outPath = path.join(OUT_DIR, deluxe ? file.replace('.json', '_deluxe.json') : file);
  if (!force && existsSync(outPath)) { skipped++; return; }
  const meta = JSON.parse(readFileSync(path.join(SONGS_DIR, file), 'utf8'));
  if (!meta.audioUrl) { failed.push(`${id} (no audioUrl)`); return; }

  try {
    const ext = path.extname(new URL(meta.audioUrl).pathname) || '.mp3';
    const localRel = dayFileMap[String(meta.day)]?.audio;
    const localPath = localBase && localRel ? path.join(localBase, localRel) : '';
    let audioPath = path.join(cacheDir, `${id}${ext}`);
    let downloaded = false;
    if (localPath && existsSync(localPath)) {
      audioPath = localPath;
    } else if (!existsSync(audioPath)) {
      await fetchAudio(meta.audioUrl, audioPath);
      downloaded = true;
    }
    let pcm: Float32Array;
    try {
      pcm = await decode(audioPath);
    } finally {
      if (downloaded && !keep) unlinkSync(audioPath);
    }
    const an = analyzeAudio(pcm, ANALYSIS_SAMPLE_RATE);
    const result = generateMasterChart(pcm, ANALYSIS_SAMPLE_RATE, {
      bpm: meta.bpm,
      duration: meta.duration,
      difficultyLevel: meta.difficultyLevel,
      day: meta.day,
      deluxe,
    }, an);
    const v6Sync = measureSync(an, result.notes);
    const legacyPath = path.join(LEGACY_DIR, file);
    const v1Sync = existsSync(legacyPath)
      ? measureSync(an, JSON.parse(readFileSync(legacyPath, 'utf8')).notes ?? []).sync
      : null;
    const pct = (x: number) => Math.round(x * 100);
    const report: ChartMasterReport = result.report;
    const issues = validateChart(result.notes, result.stages, pcm.length / ANALYSIS_SAMPLE_RATE, { deluxe });
    if (issues.length) throw new Error(`invalid chart: ${issues.slice(0, 4).join('; ')}${issues.length > 4 ? ` (+${issues.length - 4} more)` : ''}`);
    const out = {
      ...meta,
      notes: result.notes,
      stages: result.stages,
      chartVersion: deluxe ? CHART_MASTER_DELUXE_VERSION : CHART_MASTER_VERSION,
      chartReport: report,
      ...(deluxe ? { deluxe: true, timingProfile: 'elite', difficultyLevel: Math.min(10, (meta.difficultyLevel || 5) + 2) } : {}),
    };
    writeFileSync(outPath, JSON.stringify(out));
    manifest[id] = {
      id,
      title: meta.title,
      notes: result.notes.length,
      bpm: report.bpm,
      catalogBpm: report.catalogBpm,
      povTimes: report.povTimes,
      types: report.typeCounts,
      sync: { v6: pct(v6Sync.sync), v1: v1Sync === null ? null : pct(v1Sync), random: pct(v6Sync.randomBaseline) },
    };
    done++;
    console.log(
      `✓ ${id} ${String(result.notes.length).padStart(4)} notes · ${report.bpm} BPM (catalog ${report.catalogBpm}) · ` +
      `POV ${report.povTimes.join('s / ')}s · sync ${pct(v6Sync.sync)}% (v1 ${v1Sync === null ? '–' : pct(v1Sync)}%, random ${pct(v6Sync.randomBaseline)}%) · ${meta.title}`,
    );
  } catch (err) {
    failed.push(`${id} (${(err as Error).message})`);
    console.error(`✗ ${id}: ${(err as Error).message}`);
  }
}

const queue = [...dayFiles];
await Promise.all(
  Array.from({ length: jobs }, async () => {
    while (queue.length) await bake(queue.shift()!);
  }),
);

writeFileSync(
  manifestPath,
  JSON.stringify({ version: deluxe ? CHART_MASTER_DELUXE_VERSION : CHART_MASTER_VERSION, generatedAt: new Date().toISOString(), songs: manifest }, null, 1),
);
const scored = Object.values(manifest).filter((m) => m.sync);
if (scored.length) {
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length));
  const v1s = scored.map((m) => m.sync.v1).filter((x): x is number => x !== null);
  console.log(
    `\nSync across ${scored.length} songs — v6 ${avg(scored.map((m) => m.sync.v6))}% · ` +
    `v1 ${avg(v1s)}% · random ${avg(scored.map((m) => m.sync.random))}%`,
  );
}
console.log(`\nBaked ${done}, skipped ${skipped} existing, failed ${failed.length}.`);
if (failed.length) console.log('Failed:\n  ' + failed.join('\n  '));
