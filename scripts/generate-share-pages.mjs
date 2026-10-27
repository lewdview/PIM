#!/usr/bin/env node
/**
 * generate-share-pages.mjs — per-day social preview pages for PIM.
 *
 * Social preview bots don't run JavaScript, so every pim.th3scr1b3.art link
 * previews with one generic title/image. This script generates one tiny
 * static HTML file per day (public/share/day-<n>.html) carrying that day's
 * Open Graph / Twitter tags, which instantly forwards human visitors to the
 * real day page (/day/<n>), preserving any query string (e.g. ?utm_source=…)
 * so platform tags flow through.
 *
 * Data source: the 365LandD month packages
 *   ~/workspace/365LandD/public/month-packages/month-* /month-data.json
 * (override with MONTH_DATA_DIR). Only facts present in the data are used.
 * Missing cover -> fallback to the site key art (day numbers are reported).
 * Missing title -> "Day <n>" is used as the title (and reported).
 *
 * Run: node scripts/generate-share-pages.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://pim.th3scr1b3.art';
const FALLBACK_IMAGE = `${SITE}/seo/pim-key-art.jpg`;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const dataDir =
  process.env.MONTH_DATA_DIR ||
  resolve(repoRoot, '..', '365LandD', 'public', 'month-packages');
const outDir = join(repoRoot, 'public', 'share');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Load per-day facts -------------------------------------------------
const days = new Map();
for (const entry of readdirSync(dataDir).sort()) {
  if (!entry.startsWith('month-')) continue;
  const file = join(dataDir, entry, 'month-data.json');
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    continue; // not a month directory (e.g. .zip handled by name filter anyway)
  }
  for (const r of data.releases || []) {
    days.set(r.day, r);
  }
}

const fallbackImageDays = [];
const missingTitleDays = [];

/**
 * Extract a clean theme sentence from the raw description field.
 * Days 60–365 carry a short plain sentence ("Exploring …"). Days 1–59 carry
 * HTML: PRODUCTION INFO notes + a "SONOTELLER.AI lyrical Analysis" block —
 * take the first sentence of the analysis text; if the analysis is just a
 * "NEEDS …" placeholder, there is no theme (return '').
 */
function themeSentence(raw) {
  if (!raw) return '';
  let text = String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const marker = 'lyrical Analysis';
  const idx = text.indexOf(marker);
  if (idx !== -1) {
    text = text.slice(idx + marker.length).trim();
    if (/^NEEDS\b/i.test(text)) return '';
  }
  if (text.length <= 200) return text;
  const firstSentence = text.match(/^.*?\.(?=\s|$)/);
  if (firstSentence && firstSentence[0].length <= 200) return firstSentence[0];
  return text.slice(0, text.lastIndexOf(' ', 197)).trimEnd() + '…';
}

function buildDescription(n, r, title) {
  let head = `Day ${n}/365 of 365 Days of Light and Dark`;
  const theme = themeSentence(r.description);
  if (theme) head += ` — ${theme.endsWith('.') || theme.endsWith('…') ? theme : theme + '.'}`;
  const stats = [];
  if (r.tempo) stats.push(`${r.tempo} BPM`);
  if (r.durationFormatted) stats.push(r.durationFormatted);
  if (r.mood) stats.push(r.mood === 'dark' ? 'Dark' : r.mood === 'light' ? 'Light' : r.mood);
  let desc = head;
  if (stats.length) desc += ` ${stats.join(' · ')}.`;
  desc += ' Play the level and claim the card in PIM: th3v4ult.';
  return desc;
}

function buildPage(n, r) {
  const rawTitle = (r.title || '').trim();
  if (!rawTitle) missingTitleDays.push(n);
  const title = rawTitle || `Day ${n}`;
  const cover = (r.coverUrl || '').trim();
  if (!cover) fallbackImageDays.push(n);
  const image = cover || FALLBACK_IMAGE;

  const pageTitle = `Day ${n} — "${title}" · PIM: th3v4ult`;
  const desc = buildDescription(n, r, title);
  const shareUrl = `${SITE}/share/day-${n}.html`;
  const dayUrl = `${SITE}/day/${n}`;
  const imageAlt = `Day ${n} — "${title}" cover art`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${shareUrl}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pageTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${dayUrl}">
<script>location.replace(${JSON.stringify(dayUrl)} + window.location.search);</script>
</head>
<body>
<p>Opening Day ${n}… <a href="${dayUrl}">Continue to Day ${n} — &quot;${esc(title)}&quot; in PIM: th3v4ult</a></p>
</body>
</html>
`;
}

// ---- Generate ------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
let written = 0;
for (let n = 1; n <= 365; n++) {
  const r = days.get(n);
  if (!r) {
    console.error(`WARNING: no data for day ${n} — writing minimal page`);
    days.set(n, {});
  }
  writeFileSync(join(outDir, `day-${n}.html`), buildPage(n, days.get(n)));
  written++;
}

console.log(`Wrote ${written} share pages to ${outDir}`);
console.log(`Fallback image days (${fallbackImageDays.length}): ${fallbackImageDays.join(', ') || 'none'}`);
console.log(`Missing-title days (${missingTitleDays.length}): ${missingTitleDays.join(', ') || 'none'}`);
