#!/usr/bin/env node
/**
 * rebuild_day_file_map.mjs
 *
 * Rebuilds src/game/day_file_map.json by:
 * 1. Fetching https://th3scr1b3.art/release-data.json (the source of truth)
 * 2. For each release, deriving the expected cover path from the coverArt URL
 *    (strips base URL, converts .png → .jpg)
 * 3. HEAD-checking each cover path against Supabase storage to confirm it exists
 * 4. Writing the verified paths into day_file_map.json
 *
 * Usage:  node scripts/rebuild_day_file_map.mjs
 * Options:
 *   --skip-verify    Skip the HTTP HEAD checks (use if you trust the static JSON)
 *   --days 143-200   Only update a specific day range
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_PATH = path.join(__dirname, '../src/game/day_file_map.json');
const SUPABASE_BASE = 'https://pznmptudgicrmljjafex.supabase.co/storage/v1/object/public/releaseready/';
const RELEASE_DATA_URL = 'https://th3scr1b3.art/release-data.json';

const args = process.argv.slice(2);
const skipVerify = args.includes('--skip-verify');
const dayRangeArg = args.find(a => a.startsWith('--days'));
let minDay = 1, maxDay = 365;
if (dayRangeArg) {
  const [, range] = dayRangeArg.split(' ');
  if (range) {
    const [a, b] = range.split('-').map(Number);
    minDay = a || 1;
    maxDay = b || a || 365;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function headCheck(urlStr) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(urlStr);
      const req = https.request(
        { hostname: parsed.hostname, path: parsed.pathname, method: 'HEAD' },
        res => resolve(res.statusCode === 200)
      );
      req.on('error', () => resolve(false));
      req.end();
    } catch { resolve(false); }
  });
}

function coverUrlToPath(coverArtUrl) {
  // e.g. https://...supabase.co/storage/v1/object/public/releaseready/covers/may/23%20-%20...png
  if (!coverArtUrl) return null;
  const marker = '/releaseready/';
  const idx = coverArtUrl.indexOf(marker);
  if (idx === -1) return null;
  let rel = decodeURIComponent(coverArtUrl.slice(idx + marker.length));
  // Normalize extension: .png → .jpg
  rel = rel.replace(/\.png$/i, '.jpg');
  return rel;
}

function buildSupabaseUrl(relativePath) {
  return SUPABASE_BASE + encodeURIComponent(relativePath).replace(/%2F/g, '/');
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching release data from ${RELEASE_DATA_URL}...`);
  const data = await fetchJson(RELEASE_DATA_URL);
  const releases = data.releases || [];
  console.log(`Got ${releases.length} releases.`);

  // Load existing map
  const existing = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

  let updated = 0;
  let missing = 0;
  let skipped = 0;

  for (const r of releases) {
    const day = r.day;
    if (day < minDay || day > maxDay) continue;

    const entry = existing[String(day)];
    if (!entry) {
      console.warn(`  ⚠️  Day ${day} not in map — skipping`);
      skipped++;
      continue;
    }

    // Skip days that already have a cover in the map
    if (entry.cover) {
      skipped++;
      continue;
    }

    const coverPath = coverUrlToPath(r.coverArt);
    if (!coverPath) {
      console.log(`  Day ${day}: no coverArt in release data`);
      missing++;
      continue;
    }

    if (!skipVerify) {
      const exists = await headCheck(buildSupabaseUrl(coverPath));
      if (!exists) {
        // Try .png as fallback
        const pngPath = coverPath.replace(/\.jpg$/i, '.png');
        const pngExists = await headCheck(buildSupabaseUrl(pngPath));
        if (pngExists) {
          // Store .jpg path anyway — the app does the .png→.jpg replace at upload time
          // but the file itself is .png. Store as-is so local/supabase modes both work.
          console.log(`  Day ${day}: ✅ (png only) ${pngPath}`);
          entry.cover = pngPath;
          updated++;
        } else {
          console.log(`  Day ${day}: ❌ cover not found in storage — ${coverPath}`);
          missing++;
        }
        continue;
      }
    }

    console.log(`  Day ${day}: ✅ ${coverPath}`);
    entry.cover = coverPath;
    updated++;
  }

  fs.writeFileSync(MAP_PATH, JSON.stringify(existing, null, 2) + '\n');
  console.log(`\nDone. Updated: ${updated}, Missing: ${missing}, Skipped: ${skipped}`);
  console.log(`Wrote ${MAP_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
