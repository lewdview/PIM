#!/usr/bin/env node
/**
 * bake_contest_charts.ts — bakes the Audius weekly top-5 charts.
 *
 * Every player in a contest week should play the same chart. The game can forge
 * a Chart Master chart in the browser, but each browser decodes MP3 slightly
 * differently, so those charts can differ by a few notes. This script:
 *
 *   1. locks this week's 5 songs (vault-engine getAudiusWeeklyContest),
 *   2. downloads each song from Audius and decodes it with ffmpeg,
 *   3. runs Chart Master (src/game/chartMaster, the game's own generator) with
 *      the same inputs the game uses for a contest song, once for the standard
 *      chart ("aud-<id>") and once for the Deluxe chart ("aud-<id>_deluxe",
 *      unlocked in game by a 97% run of the standard chart),
 *   4. stores both charts in public.audius_contest_charts,
 *   5. builds the week's contest cards (build_audius_contest_cards).
 *
 * Songs that already have a chart are skipped unless --force. Runs every Monday
 * from .github/workflows/audius-contest-charts.yml; run it by hand too:
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/audius/bake_contest_charts.ts
 *   … --force          rebake songs that already have a chart
 *   … --dry            bake and validate, write nothing to Supabase
 *
 * Requires Node 22.18+ (runs the TypeScript directly) and ffmpeg on PATH.
 */

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { analyzeAudio, generateMasterChart, ANALYSIS_SAMPLE_RATE, CHART_MASTER_VERSION, CHART_MASTER_DELUXE_VERSION } from '../../src/game/chartMaster/index.ts';
import { validateChart } from '../../src/game/chartMaster/validate.ts';

const run = promisify(execFile);
const AUDIUS = process.env.AUDIUS_API || 'https://api.audius.co/v1';

const args = process.argv.slice(2);
const force = args.includes('--force');
const dry = args.includes('--dry');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

interface ContestTrack { id: string; title: string; artist: string; duration: number }

/** Same inputs GameplayCore gives Chart Master for an "aud-" song (see getContestGameSong). */
const CONTEST_SONG = { bpm: 120, difficultyLevel: 5, day: 0 };

async function lockContest(): Promise<{ week_start: string; tracks: ContestTrack[] }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/vault-engine`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'getAudiusWeeklyContest', payload: {} }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.success || !body.contest) {
    throw new Error(`getAudiusWeeklyContest failed (${res.status}): ${body?.error || 'no contest'}`);
  }
  return body.contest;
}

async function bakedSongIds(week: string): Promise<Set<string>> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/audius_contest_charts?select=song_id&week_start=eq.${week}`,
    { headers },
  );
  if (!res.ok) throw new Error(`reading audius_contest_charts failed (${res.status}): ${await res.text()}`);
  return new Set(((await res.json()) as { song_id: string }[]).map((r) => r.song_id));
}

async function decode(file: string): Promise<Float32Array> {
  const { stdout } = await run(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(ANALYSIS_SAMPLE_RATE), '-f', 'f32le', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 30 },
  );
  const buf = stdout as Buffer;
  const out = new Float32Array(buf.byteLength / 4);
  new Uint8Array(out.buffer).set(buf);
  return out;
}

/** Downloads and decodes a song, then returns its standard and Deluxe charts. */
async function bake(track: ContestTrack, dir: string) {
  const res = await fetch(`${AUDIUS}/tracks/${encodeURIComponent(track.id)}/stream?app_name=PIM`);
  if (!res.ok) throw new Error(`Audius stream ${res.status}`);
  const file = path.join(dir, `${track.id}.mp3`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const pcm = await decode(file);
  const duration = pcm.length / ANALYSIS_SAMPLE_RATE;
  const an = analyzeAudio(pcm, ANALYSIS_SAMPLE_RATE);

  const make = (deluxe: boolean) => {
    // The game forges Deluxe with the standard song's level and deluxe: true.
    const result = generateMasterChart(pcm, ANALYSIS_SAMPLE_RATE, { ...CONTEST_SONG, duration, deluxe }, an);
    const issues = validateChart(result.notes, result.stages, duration, { deluxe });
    if (issues.length) throw new Error(`invalid ${deluxe ? 'Deluxe ' : ''}chart: ${issues.slice(0, 4).join('; ')}`);
    return {
      notes: result.notes,
      stages: result.stages,
      chartVersion: deluxe ? CHART_MASTER_DELUXE_VERSION : CHART_MASTER_VERSION,
      duration: Math.round(duration * 10) / 10,
      bpm: result.report.bpm,
    };
  };
  return { standard: make(false), deluxe: make(true) };
}

async function save(week: string, songId: string, chart: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/audius_contest_charts`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ song_id: songId, week_start: week, chart }),
  });
  if (!res.ok) throw new Error(`saving ${songId} failed (${res.status}): ${await res.text()}`);
}

/**
 * Builds the week's contest cards (build_audius_contest_cards, idempotent). Wren's
 * 00:05 pipeline builds them too; doing it here means clears can be claimed
 * from the first minute of the week. A failure here doesn't stop the bake.
 */
async function buildCards(week: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/build_audius_contest_cards`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_week: week }),
  });
  if (!res.ok) {
    console.warn(`! building contest cards failed (${res.status}): ${await res.text()}`);
    return;
  }
  console.log(`Contest cards: ${await res.json()} new`);
}

const contest = await lockContest();
console.log(`Week ${contest.week_start}: ${contest.tracks.length} songs`);
if (!dry) await buildCards(contest.week_start);
const have = dry ? new Set<string>() : await bakedSongIds(contest.week_start);
const dir = mkdtempSync(path.join(tmpdir(), 'pim-contest-'));
const failed: string[] = [];
try {
  for (const t of contest.tracks) {
    const songId = `aud-${t.id}`;
    const deluxeId = `${songId}_deluxe`;
    if (!force && have.has(songId) && have.has(deluxeId)) {
      console.log(`· ${songId} already baked · ${t.title}`);
      continue;
    }
    try {
      const charts = await bake(t, dir);
      if (!dry) {
        await save(contest.week_start, songId, charts.standard);
        await save(contest.week_start, deluxeId, charts.deluxe);
      }
      console.log(
        `✓ ${songId} ${charts.standard.notes.length} notes (Deluxe ${charts.deluxe.notes.length}) · ` +
        `${charts.standard.bpm} BPM · ${charts.standard.duration}s · ${t.artist} – ${t.title}`,
      );
    } catch (err) {
      failed.push(songId);
      console.error(`✗ ${songId}: ${(err as Error).message}`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failed.length) {
  console.error(`${failed.length} song(s) failed: ${failed.join(', ')}`);
  process.exit(1);
}
