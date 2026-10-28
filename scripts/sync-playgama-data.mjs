#!/usr/bin/env node
/**
 * Brings the song data from main into the Playgama branch without any code:
 * `npm run sync:playgama-data [-- --from=origin/main]`
 *
 * This branch doesn't merge main. Charts, lyrics, chapter stories and the day
 * maps are data the monthly games read as-is, so they come over with this,
 * and the changes are left staged for review and commit.
 *
 * chapter_stories.json isn't synced: this branch builds it from the official
 * lyrics (scripts/build_chapter_stories.mjs), and main's copy quotes the old
 * transcribed lines.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = (process.argv.find((a) => a.startsWith('--from=')) || '--from=origin/main').slice(7);
const DATA = [
  'public/data/songs',
  'public/data/songs_variants/v6_master',
  'public/data/songs_variants/v1_gimmicks',
  'public/lyrics',
  'src/data/chapter_script.json',
  'src/game/day_file_map.json',
  'src/game/bombshell_covers_map.json',
];

const git = (...a) => execFileSync('git', a, { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] }).toString();
if (from.startsWith('origin/')) git('fetch', '-q', 'origin', from.slice(7));
git('checkout', from, '--', ...DATA);
const stat = git('diff', '--cached', '--stat', '--', ...DATA).trim();
console.log(stat ? `[sync-playgama-data] staged from ${from}:\n${stat}` : `[sync-playgama-data] already up to date with ${from}.`);
