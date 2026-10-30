// Canvas-rendered word lyrics painted directly ON the gameplay track surface.
//
// Words lie flat on the track (perspective-projected via the active POV's
// projection math), and notes/bursts are drawn OVER them by the draw loop.
// On when the song's day has an LRC file and the player's trackLyrics option is enabled.
// Each line is word-wrapped into rows that stretch to fill the full track width.

import { getArchetypeProjection, type PovMode } from "./projections";
import type { TrackArchetype } from "./archetypes";
import { supabase } from "@/services/supabaseClient";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TimedWord {
  text: string;
  start: number; // seconds
  end: number; // seconds
  effect: WordEffect;
}

export interface TimedLine {
  start: number; // seconds
  end: number; // seconds
  words: TimedWord[];
  /** Display font picked at random per song (shared by all its lines). */
  font: string;
}

export type WordEffect = "pop" | "glow" | "rise" | "flash" | "bounce" | "fade";

const EFFECTS: WordEffect[] = ["pop", "glow", "rise", "flash", "bounce", "fade"];

// Display fonts — one is picked at random per song.
const LYRIC_FONTS: string[] = [
  `"JetBrains Mono", ui-monospace, monospace`,
  `Anton, Impact, "Arial Black", sans-serif`,
  `"Space Grotesk", system-ui, sans-serif`,
  `Impact, "Arial Black", sans-serif`,
  `Georgia, "Times New Roman", serif`,
];

// Track progress (0 = vanishing point, 1 = hit line) where the lyric block sits.
const LYRIC_PROGRESS = 0.38;
// Road-tilt foreshortening: text painted on the track is vertically compressed.
// Elongated per Bryan (2026-10-06) — tall type reads better at speed.
const ROAD_TILT = 0.9;
// Row upscale cap: a short row stretches to fill the track, but never beyond this
// multiple of its natural size (keeps single-word rows from going absurd).
const ROW_FILL_MAX = 2.0;
// Vertical gap between wrapped rows, as a multiple of row height.
const ROW_GAP = 1.15;

// ── LRC parsing ──────────────────────────────────────────────────────────────

const LRC_TAG_RE = /^\[(ti|ar|al|by|offset|length|re|ve):/i;
const LRC_LINE_RE = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/;

// One random karaoke style + one random font for the whole song.
function pickSongStyle(): { effect: WordEffect; font: string } {
  return {
    effect: EFFECTS[Math.floor(Math.random() * EFFECTS.length)],
    font: LYRIC_FONTS[Math.floor(Math.random() * LYRIC_FONTS.length)],
  };
}

export function parseLrc(text: string): TimedLine[] {
  const rawLines: { start: number; text: string }[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || LRC_TAG_RE.test(line)) continue;
    const m = LRC_LINE_RE.exec(line);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const fracRaw = m[3] || "0";
    const frac = fracRaw.length >= 3 ? parseInt(fracRaw, 10) / 1000 : parseInt(fracRaw, 10) / 100;
    const content = (m[4] || "").trim();
    if (!content) continue;
    rawLines.push({ start: min * 60 + sec + frac, text: content });
  }

  rawLines.sort((a, b) => a.start - b.start);

  const { effect: songEffect, font: songFont } = pickSongStyle();

  return rawLines.map((rl, i) => {
    const nextStart = i + 1 < rawLines.length ? rawLines[i + 1].start : rl.start + 4;
    const end = Math.max(nextStart, rl.start + 0.5);
    const tokens = rl.text.split(/\s+/).filter(Boolean);
    const dur = end - rl.start;
    const words: TimedWord[] = tokens.map((t, wi) => ({
      text: t,
      start: rl.start + (dur * wi) / tokens.length,
      end: rl.start + (dur * (wi + 1)) / tokens.length,
      effect: songEffect,
    }));
    return { start: rl.start, end, words, font: songFont };
  });
}

// ── Published timings (LRC layer → public.lyric_timings) ─────────────────────

interface PublishedWord {
  word: string;
  start: number;
  end: number;
}

interface PublishedSegment {
  text: string;
  start: number;
  end: number;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/**
 * Build lines from a published row: each segment is a line, and its words keep
 * their real karaoke timings. A segment with no timed words falls back to an even
 * split of its text. Returns [] when the row has nothing usable.
 */
export function linesFromPublished(rawWords: unknown, rawSegments: unknown): TimedLine[] {
  const segments: PublishedSegment[] = (Array.isArray(rawSegments) ? rawSegments : [])
    .map((s) => ({ text: String(s?.text ?? "").trim(), start: num(s?.start), end: num(s?.end) }))
    .filter((s) => s.text && Number.isFinite(s.start))
    .sort((a, b) => a.start - b.start);
  if (!segments.length) return [];
  const words: PublishedWord[] = (Array.isArray(rawWords) ? rawWords : [])
    .map((w) => ({ word: String(w?.word ?? "").trim(), start: num(w?.start), end: num(w?.end) }))
    .filter((w) => w.word && Number.isFinite(w.start))
    .sort((a, b) => a.start - b.start);

  const { effect, font } = pickSongStyle();
  let wi = 0;
  return segments.map((seg, i) => {
    const nextStart = i + 1 < segments.length ? segments[i + 1].start : NaN;
    // Like parseLrc, a line stays up until the next one starts.
    const end = Math.max(
      Number.isFinite(nextStart) ? nextStart : Number.isFinite(seg.end) ? seg.end : seg.start + 4,
      seg.start + 0.5
    );
    // Words before the next line's start belong to this line (early words go to line 1).
    const lineWords: TimedWord[] = [];
    while (wi < words.length && (!Number.isFinite(nextStart) || words[wi].start < nextStart)) {
      const w = words[wi++];
      const wEnd = Number.isFinite(w.end) && w.end > w.start ? w.end : w.start + 0.3;
      lineWords.push({ text: w.word, start: w.start, end: Math.min(wEnd, end), effect });
    }
    if (!lineWords.length) {
      const tokens = seg.text.split(/\s+/).filter(Boolean);
      const dur = end - seg.start;
      tokens.forEach((t, k) =>
        lineWords.push({
          text: t,
          start: seg.start + (dur * k) / tokens.length,
          end: seg.start + (dur * (k + 1)) / tokens.length,
          effect,
        })
      );
    }
    return { start: seg.start, end, words: lineWords, font };
  });
}

async function loadPublishedLyrics(day: number): Promise<TimedLine[]> {
  try {
    const { data, error } = await supabase
      .from("lyric_timings")
      .select("words, segments")
      .eq("day", day)
      .maybeSingle();
    if (error || !data) return [];
    return linesFromPublished(data.words, data.segments);
  } catch {
    return [];
  }
}

function loadBundledLyrics(day: number): Promise<TimedLine[]> {
  const name = `day${String(day).padStart(3, "0")}.lrc`;
  return fetch(`/lyrics/${name}`)
    .then((res) => {
      if (!res.ok) throw new Error(`no lyrics for day ${day}`);
      return res.text();
    })
    .then(parseLrc)
    .catch(() => [] as TimedLine[]);
}

// ── Loading (cached per day) ─────────────────────────────────────────────────

const lyricsCache = new Map<number, Promise<TimedLine[]>>();

/**
 * Lyrics published from the LRC layer win, so edits show up without a redeploy;
 * the .lrc files bundled in public/lyrics cover days that were never published.
 */
export function loadLyricsForDay(day: number): Promise<TimedLine[]> {
  if (!Number.isFinite(day) || day < 1 || day > 366) return Promise.resolve([]);
  const cached = lyricsCache.get(day);
  if (cached) return cached;
  const p = loadPublishedLyrics(day).then((lines) => (lines.length ? lines : loadBundledLyrics(day)));
  lyricsCache.set(day, p);
  return p;
}

// ── Canvas renderer ──────────────────────────────────────────────────────────

export interface TrackLyricDrawOpts {
  W: number;
  H: number;
  /** Song playback time in seconds. */
  t: number;
  lines: TimedLine[];
  povMode: PovMode;
  archetype: TrackArchetype;
  stage: number;
  /** Active-word highlight, derived from the track's cover-art lane colors. */
  highlightColor?: string;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOutCubic(u: number): number {
  return 1 - Math.pow(1 - u, 3);
}

// Flat fallback: per-word scaling at a single projected anchor. Used when the
// active POV has no road-like surface to paint onto (sideways / radial modes).
function drawFlatTrackLyrics(ctx: CanvasRenderingContext2D, opts: TrackLyricDrawOpts): void {
  const { W, H, t, lines, povMode, archetype, stage } = opts;
  const highlight = opts.highlightColor || "#ffffff";
  if (!lines.length || W <= 0 || H <= 0) return;

  // Find the active line for this song time.
  let line: TimedLine | null = null;
  for (const ln of lines) {
    if (t >= ln.start && t < ln.end) {
      line = ln;
      break;
    }
  }
  if (!line || line.words.length === 0) return;

  // Project the lyric anchor through the ACTIVE track POV so the words sit
  // on the real track surface (perspective-correct in every mode).
  const proj = getArchetypeProjection(1, LYRIC_PROGRESS, W, H, archetype, stage, t, povMode);
  // Defensive: exotic POV modes can return NaN/zero/offscreen projections.
  // Fall back to a centered on-track position so lyrics survive every POV change.
  const projOk =
    Number.isFinite(proj.x) && Number.isFinite(proj.y) &&
    Number.isFinite(proj.w) && Number.isFinite(proj.scale) && proj.scale > 0.01;
  const cx = projOk ? proj.x + proj.w / 2 : W / 2;
  const cy = projOk ? proj.y : H * 0.55;
  const scale = projOk ? Math.max(0.15, proj.scale) : 0.9;

  // BIG type: 9% of canvas height at full projection scale, never below 6%.
  const fontSize = Math.max(H * 0.06, H * 0.09 * Math.max(0.5, scale));
  ctx.save();
  ctx.font = `500 ${fontSize}px ${line.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  // Full track width at the lyric plane: lane 0's left edge to lane 2's right
  // edge through the same POV math, so wrapped rows truly fill the track.
  let trackW = W * 0.94;
  if (projOk) {
    const p0 = getArchetypeProjection(0, LYRIC_PROGRESS, W, H, archetype, stage, t, povMode);
    const p2 = getArchetypeProjection(2, LYRIC_PROGRESS, W, H, archetype, stage, t, povMode);
    const span = p2.x + p2.w - p0.x;
    if (Number.isFinite(span) && span > fontSize * 2) trackW = span;
  }

  const spacing = fontSize * 0.3;
  const widths = line.words.map((w) => ctx.measureText(w.text).width);
  // Row budget in font units: a row drawn at fill=1 exactly spans the track.
  const budget = trackW / scale;

  // Greedy word-wrap into rows that fit the track width.
  const rows: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  for (let i = 0; i < line.words.length; i++) {
    const wW = widths[i];
    if (cur.length > 0 && curW + spacing + wW > budget) {
      rows.push(cur);
      cur = [];
      curW = 0;
    }
    if (cur.length > 0) curW += spacing;
    cur.push(i);
    curW += wW;
  }
  if (cur.length > 0) rows.push(cur);

  // Per-row fill factor: stretch every row to fill the track width.
  // Short rows upscale (capped); a lone over-wide word shrinks to fit.
  const rowUnits = rows.map(
    (r) => r.reduce((a, i) => a + widths[i], 0) + spacing * (r.length - 1)
  );
  const rowFit = rowUnits.map((u) => Math.min(ROW_FILL_MAX, budget / Math.max(1, u)));
  const rowH = rowFit.map((f) => fontSize * scale * f * ROAD_TILT * ROW_GAP);
  const totalH = rowH.reduce((a, b) => a + b, 0);

  let activeIdx = -1;
  for (let i = 0; i < line.words.length; i++) {
    const w = line.words[i];
    if (t >= w.start && t < w.end) {
      activeIdx = i;
      break;
    }
  }

  let rowY = cy - totalH / 2;
  for (let r = 0; r < rows.length; r++) {
    const idxs = rows[r];
    const s = scale * rowFit[r]; // combined perspective + row-fill scale
    const rowScreenW = rowUnits[r] * s;
    let x = cx - rowScreenW / 2;
    const yc = rowY + rowH[r] / 2;

    for (const i of idxs) {
      const w = line.words[i];
      const wW = widths[i] * s;
      const isActive = i === activeIdx;
      const isSung = activeIdx >= 0 ? i < activeIdx : t >= w.end;
      const u = clamp01((t - w.start) / Math.max(0.001, w.end - w.start));

      ctx.save();
      // Word center in screen space.
      ctx.translate(x + wW / 2, yc);

      // Perspective stretch: full horizontal scale (track widens toward player),
      // vertical foreshortening (painted-on-road tilt).
      let sx = s;
      let sy = s * ROAD_TILT;
      let dy = 0;
      let alpha = 1;
      let glow = false;
      let flashHue = -1;

      switch (w.effect) {
        case "pop": {
          if (isActive) {
            const k = u < 0.55 ? 0.6 + 0.75 * (u / 0.55) : 1.35 - 0.23 * ((u - 0.55) / 0.45);
            sx *= k;
            sy *= k;
          }
          break;
        }
        case "glow": {
          glow = isActive;
          break;
        }
        case "rise": {
          if (isActive) dy = -11 * s * easeOutCubic(u);
          break;
        }
        case "flash": {
          if (isActive) flashHue = (u * 300) % 360;
          break;
        }
        case "bounce": {
          if (isActive) dy = -Math.abs(Math.sin(u * Math.PI * 2)) * 10 * s * (1 - u * 0.5);
          break;
        }
        case "fade": {
          if (isActive) alpha = 0.15 + 0.85 * u;
          break;
        }
      }

      ctx.translate(0, dy);
      ctx.scale(sx, sy);
      ctx.globalAlpha = alpha * (isActive ? 1 : isSung ? 0.5 : 0.3);

      ctx.fillStyle =
      flashHue >= 0 ? `hsl(${flashHue}, 100%, 72%)` : isActive ? highlight : "#ffffff";
      if (glow) {
        ctx.shadowColor = highlight;
        ctx.shadowBlur = 26;
      }
      // Dark outline keeps words readable over bright track art (scales with type).
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = Math.max(2, fontSize * 0.032);

      // Draw centered: text was measured in font units, scale handles perspective.
      const drawX = -widths[i] / 2;
      ctx.strokeText(w.text, drawX, 0);
      ctx.fillText(w.text, drawX, 0);
      ctx.restore();

      x += wW + spacing * s;
    }
    rowY += rowH[r];
  }
  ctx.restore();
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function findActiveLineIdx(lines: TimedLine[], t: number): number {
  for (let i = 0; i < lines.length; i++) {
    if (t >= lines[i].start && t < lines[i].end) return i;
  }
  return -1;
}

function findActiveWordIdx(line: TimedLine, t: number): number {
  for (let i = 0; i < line.words.length; i++) {
    const w = line.words[i];
    if (t >= w.start && t < w.end) return i;
  }
  return -1;
}

interface WordFx {
  k: number; // extra uniform scale
  dy: number; // vertical offset, in units of the word's font size
  alpha: number;
  glow: boolean;
  flashHue: number; // -1 = none
}

function wordFx(effect: WordEffect, isActive: boolean, u: number): WordFx {
  const fx: WordFx = { k: 1, dy: 0, alpha: 1, glow: false, flashHue: -1 };
  if (!isActive) return fx;
  switch (effect) {
    case "pop":
      fx.k = u < 0.55 ? 0.6 + 0.75 * (u / 0.55) : 1.35 - 0.23 * ((u - 0.55) / 0.45);
      break;
    case "glow":
      fx.glow = true;
      break;
    case "rise":
      fx.dy = -0.12 * easeOutCubic(u);
      break;
    case "flash":
      fx.flashHue = (u * 300) % 360;
      break;
    case "bounce":
      fx.dy = -Math.abs(Math.sin(u * Math.PI * 2)) * 0.11 * (1 - u * 0.5);
      break;
    case "fade":
      fx.alpha = 0.15 + 0.85 * u;
      break;
  }
  return fx;
}

let offCanvas: HTMLCanvasElement | null = null;
function getOffscreen(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!offCanvas) offCanvas = document.createElement("canvas");
  // Only ever grow the backing store; reallocating every frame is costly.
  if (offCanvas.width < w) offCanvas.width = w;
  if (offCanvas.height < h) offCanvas.height = h;
  const c = offCanvas.getContext("2d");
  if (!c) return null;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, offCanvas.width, offCanvas.height);
  return c;
}

// ── Road-painted renderer ────────────────────────────────────────────────────
//
// The line is typeset flat into an offscreen "decal", then laid onto the track
// in thin horizontal slices. Each slice is stretched to the real track width at
// its own depth, so the type is narrow at the horizon and widens toward the
// player — and it bends with curving / rolling archetypes like real road paint.

// Decal resolution (width). Height follows the wrapped rows.
const DECAL_W = 1024;
// Usable decal width (small margins so outlines/glow don't clip).
const DECAL_FILL = 0.94;
// Track progress of the decal's near (bottom) edge.
const DECAL_NEAR = 0.72;
// Never let the far edge run closer to the vanishing point than this.
const DECAL_FAR_MIN = 0.14;
// Converts decal aspect (h / w) into track-progress depth. Higher = longer, taller type.
const DECAL_DEPTH = 0.62;
// Depth samples along the track for the perspective warp.
const DECAL_SLICES = 48;
// Max wrapped rows before the type size steps down.
const DECAL_MAX_ROWS = 3;

interface DecalLayout {
  h: number;
}

function paintDecal(
  c: CanvasRenderingContext2D,
  line: TimedLine,
  t: number,
  highlight: string,
  rows: number[][],
  widths: number[],
  fontPx: number,
  spacing: number,
  budget: number
): DecalLayout {
  const rowUnits = rows.map((r) => r.reduce((a, i) => a + widths[i], 0) + spacing * (r.length - 1));
  const rowFit = rowUnits.map((u) => Math.min(ROW_FILL_MAX, budget / Math.max(1, u)));
  const rowH = rowFit.map((f) => fontPx * f * 1.04);
  const pad = fontPx * 0.28;
  const h = Math.ceil(rowH.reduce((a, b) => a + b, 0) + pad * 2);

  const activeIdx = findActiveWordIdx(line, t);
  c.font = `500 ${fontPx}px ${line.font}`;
  c.textBaseline = "middle";
  c.textAlign = "center";
  c.lineJoin = "round";

  let rowY = pad;
  for (let r = 0; r < rows.length; r++) {
    const s = rowFit[r];
    let x = DECAL_W / 2 - (rowUnits[r] * s) / 2;
    const yc = rowY + rowH[r] / 2;
    for (const i of rows[r]) {
      const w = line.words[i];
      const wW = widths[i] * s;
      const isActive = i === activeIdx;
      const isSung = activeIdx >= 0 ? i < activeIdx : t >= w.end;
      const u = clamp01((t - w.start) / Math.max(0.001, w.end - w.start));
      const fx = wordFx(w.effect, isActive, u);

      c.save();
      c.translate(x + wW / 2, yc + fx.dy * fontPx * s);
      c.scale(s * fx.k, s * fx.k);
      c.globalAlpha = fx.alpha * (isActive ? 1 : isSung ? 0.55 : 0.32);
      c.fillStyle = fx.flashHue >= 0 ? `hsl(${fx.flashHue}, 100%, 72%)` : isActive ? highlight : "#ffffff";
      if (fx.glow || isActive) {
        c.shadowColor = highlight;
        c.shadowBlur = fx.glow ? 34 : 14;
      }
      c.strokeStyle = "rgba(0,0,0,0.85)";
      c.lineWidth = Math.max(3, fontPx * 0.05);
      c.strokeText(w.text, 0, 0);
      c.fillText(w.text, 0, 0);
      c.restore();

      x += wW + spacing * s;
    }
    rowY += rowH[r];
  }

  // Distance haze: the far (top) edge of the paint fades toward the horizon.
  // Baked into the decal so overlapping warp slices don't stripe.
  c.save();
  c.globalCompositeOperation = "destination-in";
  const haze = c.createLinearGradient(0, 0, 0, h);
  haze.addColorStop(0, "rgba(0,0,0,0.45)");
  haze.addColorStop(1, "rgba(0,0,0,1)");
  c.fillStyle = haze;
  c.fillRect(0, 0, DECAL_W, h);
  c.restore();
  return { h };
}

export function drawTrackLyrics(ctx: CanvasRenderingContext2D, opts: TrackLyricDrawOpts): void {
  const { W, H, t, lines, povMode, archetype, stage } = opts;
  if (!lines.length || W <= 0 || H <= 0) return;
  const li = findActiveLineIdx(lines, t);
  if (li < 0) return;
  const line = lines[li];
  if (line.words.length === 0) return;
  const highlight = opts.highlightColor || "#ffffff";

  // ── Typeset flat: shrink type until the line wraps into ≤ DECAL_MAX_ROWS rows.
  const budget = DECAL_W * DECAL_FILL;
  const measure = getOffscreen(DECAL_W, 8);
  if (!measure) return drawFlatTrackLyrics(ctx, opts);
  let fontPx = 180;
  let rows: number[][] = [];
  let widths: number[] = [];
  let spacing = 0;
  for (;;) {
    measure.font = `500 ${fontPx}px ${line.font}`;
    spacing = fontPx * 0.28;
    widths = line.words.map((w) => measure.measureText(w.text).width);
    rows = [];
    let cur: number[] = [];
    let curW = 0;
    for (let i = 0; i < widths.length; i++) {
      if (cur.length > 0 && curW + spacing + widths[i] > budget) {
        rows.push(cur);
        cur = [];
        curW = 0;
      }
      if (cur.length > 0) curW += spacing;
      cur.push(i);
      curW += widths[i];
    }
    if (cur.length > 0) rows.push(cur);
    if (rows.length <= DECAL_MAX_ROWS || fontPx <= 90) break;
    fontPx = Math.round(fontPx * 0.86);
  }

  // Rough decal height first (to size the offscreen), then paint for real.
  const estH = Math.ceil(fontPx * (ROW_FILL_MAX * 1.04 * rows.length + 0.6));
  const c = getOffscreen(DECAL_W, estH);
  if (!c) return drawFlatTrackLyrics(ctx, opts);
  const { h: decalH } = paintDecal(c, line, t, highlight, rows, widths, fontPx, spacing, budget);

  // ── Map decal onto the track surface.
  const depth = Math.min(DECAL_NEAR - DECAL_FAR_MIN, Math.max(0.12, (decalH / DECAL_W) * DECAL_DEPTH));
  const far = DECAL_NEAR - depth;
  const N = DECAL_SLICES;
  const left = new Array<number>(N + 1);
  const right = new Array<number>(N + 1);
  const ys = new Array<number>(N + 1);
  for (let k = 0; k <= N; k++) {
    const p = far + (depth * k) / N;
    const p0 = getArchetypeProjection(0, p, W, H, archetype, stage, t, povMode);
    const p2 = getArchetypeProjection(2, p, W, H, archetype, stage, t, povMode);
    const l = p0.x;
    const r = p2.x + p2.w;
    const y = (p0.y + p2.y) / 2;
    // Bail to the flat renderer when the POV has no forward-running road:
    // bad numbers, collapsed width, or a surface that doesn't run top→bottom.
    if (!Number.isFinite(l) || !Number.isFinite(r) || !Number.isFinite(y) || r - l < 4) {
      return drawFlatTrackLyrics(ctx, opts);
    }
    if (k > 0 && y <= ys[k - 1]) return drawFlatTrackLyrics(ctx, opts);
    // Slight inset so the paint sits inside the rails.
    const inset = (r - l) * 0.03;
    left[k] = l + inset;
    right[k] = r - inset;
    ys[k] = y;
  }
  if (ys[N] - ys[0] < 10) return drawFlatTrackLyrics(ctx, opts);

  // Walk whole screen rows (2px bands) so slices tile exactly — overlapping
  // fractional slices double up the alpha on faded words and show as stripes.
  const src = offCanvas as HTMLCanvasElement;
  const BAND = 2;
  const yTop = Math.ceil(ys[0]);
  const yBot = Math.floor(ys[N]);
  // Screen y → fractional sample index (ys is strictly increasing).
  let j = 0;
  const sampleAt = (y: number): number => {
    while (j < N - 1 && ys[j + 1] < y) j++;
    return j + clamp01((y - ys[j]) / Math.max(1e-6, ys[j + 1] - ys[j]));
  };
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  for (let y = yTop; y < yBot; y += BAND) {
    const yEnd = Math.min(yBot, y + BAND);
    const f0 = sampleAt(y);
    const f1 = sampleAt(yEnd);
    const fm = (f0 + f1) / 2;
    const k = Math.min(N - 1, Math.floor(fm));
    const fr = fm - k;
    const x0 = left[k] + (left[k + 1] - left[k]) * fr;
    const x1 = right[k] + (right[k + 1] - right[k]) * fr;
    const sy0 = (f0 / N) * decalH;
    const sy1 = (f1 / N) * decalH;
    if (sy1 - sy0 <= 0 || x1 - x0 <= 0) continue;
    ctx.drawImage(src, 0, sy0, DECAL_W, sy1 - sy0, x0, y, x1 - x0, yEnd - y);
  }
  ctx.restore();
}

// ── "Lyric Cinema" background ────────────────────────────────────────────────
//
// Full-screen kinetic typography painted on the canvas BEFORE the track:
// a giant outlined echo of the active word, the current line set big along the
// sky with a chromatic-split hero word, the next line ghosted beneath, the
// previous line drifting away on change, and slow drifting light motes.

export interface LyricBackdropOpts {
  W: number;
  H: number;
  t: number;
  lines: TimedLine[];
  /** Cover-art lane colors: [accent A, accent B, accent C]. */
  colors: [string, string, string];
  /** Player's "Background animation" setting. Off = static layout: lyrics still
   *  advance and highlight, but nothing drifts, pulses, slams or sparkles. */
  animate: boolean;
  /** Which part to paint: the wash + motes ("backdrop"), the words ("text"), or both. */
  layer?: "all" | "backdrop" | "text";
}

// Append a 2-digit hex alpha; non-#rrggbb colors fall back to white.
function hexA(c: string, aa: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c + aa;
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] + aa;
  return "#ffffff" + aa;
}

/** A dark tone on the opposite side of the colour wheel, used to border cover-coloured letters. */
function opposingBorder(c: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c);
  if (!m) return "#050402";
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `hsl(${Math.round((h + 180) % 360)}, 85%, 11%)`;
}

/** Paint the border first so the fill sits on top of it. */
function borderText(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, size: number, color: string): void {
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = color;
  ctx.strokeText(txt, x, y);
}

const BACKDROP_FONT = `Anton, Impact, "Arial Black", sans-serif`;
const MOTE_COUNT = 34;

function layoutLineCentered(
  ctx: CanvasRenderingContext2D,
  line: TimedLine,
  maxW: number,
  fontPx: number
): { size: number; widths: number[]; spacing: number; total: number } {
  ctx.font = `400 ${fontPx}px ${BACKDROP_FONT}`;
  const widths = line.words.map((w) => ctx.measureText(w.text.toUpperCase()).width);
  const spacing = fontPx * 0.24;
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1);
  const fit = total > maxW ? maxW / total : 1;
  return {
    size: fontPx * fit,
    widths: widths.map((w) => w * fit),
    spacing: spacing * fit,
    total: total * fit,
  };
}

export function drawLyricBackdrop(ctx: CanvasRenderingContext2D, o: LyricBackdropOpts): void {
  const { W, H, t, lines, colors, animate, layer = "all" } = o;
  if (W <= 0 || H <= 0) return;
  const [cA, cB, cC] = colors;
  const edgeA = opposingBorder(cA);
  const edgeB = opposingBorder(cB);
  const edgeC = opposingBorder(cC);

  ctx.save();

  if (layer !== "text") {
    // ── Breathing color wash.
    const breathe = animate ? 0.5 + 0.5 * Math.sin(t * 0.6) : 0.5;
    const wash = ctx.createRadialGradient(W * (0.3 + 0.4 * breathe), H * 0.18, 0, W / 2, H * 0.3, Math.max(W, H) * 0.9);
    wash.addColorStop(0, hexA(cA, "38"));
    wash.addColorStop(0.45, hexA(cB, "18"));
    wash.addColorStop(1, "#00000000");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    // ── Drifting light motes (stateless: positions are a function of time).
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; animate && i < MOTE_COUNT; i++) {
      const seed = i * 12.9898;
      const rx = (Math.sin(seed) * 43758.5453) % 1;
      const ry = (Math.sin(seed * 1.7) * 24634.6345) % 1;
      const speed = 0.012 + Math.abs(rx) * 0.02;
      const x = (Math.abs(rx) * W + Math.sin(t * 0.4 + i) * 24) % W;
      const y = H - ((((Math.abs(ry) + t * speed) % 1) + 1) % 1) * H;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + i * 2.1));
      const r = 1 + (i % 3);
      ctx.globalAlpha = 0.35 * tw;
      ctx.fillStyle = i % 3 === 0 ? cA : i % 3 === 1 ? cB : cC;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  if (layer === "backdrop") {
    ctx.restore();
    return;
  }

  const li = findActiveLineIdx(lines, t);
  if (li < 0) {
    ctx.restore();
    return;
  }
  const line = lines[li];
  const activeIdx = findActiveWordIdx(line, t);
  const lineAge = t - line.start;
  const maxW = W * 0.9;
  const baseY = H * 0.17;

  // ── Giant outlined echo of the active word, filling the screen behind everything.
  if (activeIdx >= 0) {
    const w = line.words[activeIdx];
    const u = clamp01((t - w.start) / Math.max(0.001, w.end - w.start));
    const txt = w.text.toUpperCase();
    ctx.font = `400 100px ${BACKDROP_FONT}`;
    const natW = Math.max(1, ctx.measureText(txt).width);
    const size = Math.min(H * 0.62, (100 * W * 0.92) / natW);
    ctx.save();
    ctx.translate(W / 2, H * 0.42);
    ctx.rotate(animate ? -0.06 + 0.03 * Math.sin(t * 0.5) : -0.06);
    const grow = animate ? 1 + 0.12 * easeOutCubic(u) : 1;
    ctx.scale(grow, grow);
    ctx.font = `400 ${size}px ${BACKDROP_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = animate ? 0.16 * (1 - u * 0.6) : 0.12;
    ctx.lineWidth = Math.max(1.5, size * 0.012);
    ctx.strokeStyle = cB;
    ctx.strokeText(txt, 0, 0);
    ctx.restore();
  }

  // ── Previous line drifts up and dissolves during the first 0.45s of a new line.
  if (animate && li > 0 && lineAge < 0.45) {
    const prev = lines[li - 1];
    const k = easeOutCubic(lineAge / 0.45);
    const L = layoutLineCentered(ctx, prev, maxW, H * 0.11);
    ctx.font = `400 ${L.size}px ${BACKDROP_FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.globalAlpha = 0.6 * (1 - k);
    ctx.fillStyle = cA;
    let x = W / 2 - L.total / 2;
    const y = baseY - k * H * 0.08;
    prev.words.forEach((w, i) => {
      borderText(ctx, w.text.toUpperCase(), x, y, L.size, edgeA);
      ctx.fillText(w.text.toUpperCase(), x, y);
      x += L.widths[i] + L.spacing;
    });
  }

  // ── Current line: big, set across the sky, revealed as it's sung.
  const intro = animate ? easeOutCubic(clamp01(lineAge / 0.35)) : 1;
  const L = layoutLineCentered(ctx, line, maxW, H * 0.11);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  let x = W / 2 - L.total / 2;
  const y = baseY + (1 - intro) * H * 0.05;
  for (let i = 0; i < line.words.length; i++) {
    const w = line.words[i];
    const txt = w.text.toUpperCase();
    const ww = L.widths[i];
    const cx = x + ww / 2;
    const isActive = i === activeIdx;
    const isSung = activeIdx >= 0 ? i < activeIdx : t >= w.end;
    const u = clamp01((t - w.start) / Math.max(0.001, w.end - w.start));

    ctx.save();
    ctx.translate(cx, y);
    ctx.font = `400 ${L.size}px ${BACKDROP_FONT}`;
    ctx.globalAlpha = intro;
    if (isActive) {
      // Slam-in: overshoot then settle.
      if (animate) {
        const slam = u < 0.2 ? 1.45 - 0.5 * (u / 0.2) : 0.95 + 0.05 * clamp01((u - 0.2) / 0.3);
        ctx.scale(slam, slam);
        // Chromatic split ghosts.
        const split = L.size * 0.035 * (1 - u);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.55 * intro;
        ctx.fillStyle = cA;
        ctx.fillText(txt, -split, 0);
        ctx.fillStyle = cB;
        ctx.fillText(txt, split, 0);
        ctx.globalCompositeOperation = "source-over";
      }
      // Gradient-filled hero word with glow.
      const g = ctx.createLinearGradient(0, -L.size / 2, 0, L.size / 2);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.55, cB);
      g.addColorStop(1, cA);
      ctx.globalAlpha = intro;
      borderText(ctx, txt, 0, 0, L.size, edgeB);
      ctx.shadowColor = cB;
      ctx.shadowBlur = L.size * 0.45;
      ctx.fillStyle = g;
      ctx.fillText(txt, 0, 0);
      ctx.shadowBlur = 0;
      // Underline sweep tracks word progress.
      ctx.fillStyle = cC;
      ctx.fillRect(-ww / 2, L.size * 0.52, ww * u, Math.max(2, L.size * 0.045));
    } else if (isSung) {
      // Sung words take the cover's first colour.
      ctx.globalAlpha = 0.92 * intro;
      borderText(ctx, txt, 0, 0, L.size, edgeA);
      ctx.fillStyle = cA;
      ctx.fillText(txt, 0, 0);
    } else {
      // Words still to come: a cover-coloured outline over a dark opposing border.
      ctx.globalAlpha = 0.75 * intro;
      borderText(ctx, txt, 0, 0, L.size, edgeB);
      ctx.lineWidth = Math.max(1.5, L.size * 0.03);
      ctx.strokeStyle = cB;
      ctx.strokeText(txt, 0, 0);
    }
    ctx.restore();
    x += ww + L.spacing;
  }

  // ── Next line, ghosted beneath.
  const next = lines[li + 1];
  if (next && next.words.length) {
    const N = layoutLineCentered(ctx, next, maxW * 0.8, H * 0.045);
    ctx.font = `400 ${N.size}px ${BACKDROP_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.55 * intro;
    const nextTxt = next.words.map((w) => w.text.toUpperCase()).join(" ");
    borderText(ctx, nextTxt, W / 2, baseY + L.size * 0.95, N.size, edgeC);
    ctx.fillStyle = cC;
    ctx.fillText(nextTxt, W / 2, baseY + L.size * 0.95);
  }

  ctx.restore();
}
