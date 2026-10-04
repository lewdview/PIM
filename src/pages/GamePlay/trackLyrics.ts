// Canvas-rendered word lyrics painted directly ON the gameplay track surface.
//
// Words lie flat on the track (perspective-projected via the active POV's
// projection math), and notes/bursts are drawn OVER them by the draw loop.
// Always on when the song's day has an LRC file — no gating, no unlock flow.

import { getArchetypeProjection, type PovMode } from "./projections";
import type { TrackArchetype } from "./archetypes";

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
}

export type WordEffect = "pop" | "glow" | "rise" | "flash" | "bounce" | "fade";

const EFFECTS: WordEffect[] = ["pop", "glow", "rise", "flash", "bounce", "fade"];

// Track progress (0 = vanishing point, 1 = hit line) where the lyric line sits.
const LYRIC_PROGRESS = 0.38;
// Road-tilt foreshortening: text painted on the track is vertically compressed.
const ROAD_TILT = 0.62;

// ── LRC parsing ──────────────────────────────────────────────────────────────

const LRC_TAG_RE = /^\[(ti|ar|al|by|offset|length|re|ve):/i;
const LRC_LINE_RE = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/;

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

  return rawLines.map((rl, i) => {
    const nextStart = i + 1 < rawLines.length ? rawLines[i + 1].start : rl.start + 4;
    const end = Math.max(nextStart, rl.start + 0.5);
    const tokens = rl.text.split(/\s+/).filter(Boolean);
    const dur = end - rl.start;
    const words: TimedWord[] = tokens.map((t, wi) => ({
      text: t,
      start: rl.start + (dur * wi) / tokens.length,
      end: rl.start + (dur * (wi + 1)) / tokens.length,
      effect: EFFECTS[Math.floor(Math.random() * EFFECTS.length)],
    }));
    return { start: rl.start, end, words };
  });
}

// ── Loading (cached per day) ─────────────────────────────────────────────────

const lyricsCache = new Map<number, Promise<TimedLine[]>>();

export function loadLyricsForDay(day: number): Promise<TimedLine[]> {
  if (!Number.isFinite(day) || day < 1 || day > 365) return Promise.resolve([]);
  const cached = lyricsCache.get(day);
  if (cached) return cached;
  const name = `day${String(day).padStart(3, "0")}.lrc`;
  const p = fetch(`/lyrics/${name}`)
    .then((res) => {
      if (!res.ok) throw new Error(`no lyrics for day ${day}`);
      return res.text();
    })
    .then(parseLrc)
    .catch(() => [] as TimedLine[]);
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
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOutCubic(u: number): number {
  return 1 - Math.pow(1 - u, 3);
}

export function drawTrackLyrics(ctx: CanvasRenderingContext2D, opts: TrackLyricDrawOpts): void {
  const { W, H, t, lines, povMode, archetype, stage } = opts;
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

  // Scale lyrics to canvas height so they stay readable: base 4.5% of
  // screen height at full projection scale, never below 3%.
  const fontSize = Math.max(H * 0.03, H * 0.045 * Math.max(0.5, scale));
  ctx.save();
  ctx.font = `800 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  // Centered horizontal layout in unscaled font units.
  const spacing = fontSize * 0.30;
  const widths = line.words.map((w) => ctx.measureText(w.text).width);
  const totalW = widths.reduce((a, b) => a + b, 0) + spacing * (line.words.length - 1);
  // Clamp the line to the projected track width so words never spill off-road.
  const maxW = Math.max(fontSize * 2, proj.w * 1.6);
  const fit = totalW > maxW ? maxW / totalW : 1;

  let activeIdx = -1;
  for (let i = 0; i < line.words.length; i++) {
    const w = line.words[i];
    if (t >= w.start && t < w.end) {
      activeIdx = i;
      break;
    }
  }

  let x = cx - (totalW * fit) / 2;
  for (let i = 0; i < line.words.length; i++) {
    const w = line.words[i];
    const wW = widths[i] * fit;
    const isActive = i === activeIdx;
    const isSung = activeIdx >= 0 ? i < activeIdx : t >= w.end;
    const u = clamp01((t - w.start) / Math.max(0.001, w.end - w.start));

    ctx.save();
    // Word center in screen space.
    ctx.translate(x + wW / 2, cy);

    // Perspective stretch: full horizontal scale (track widens toward player),
    // vertical foreshortening (painted-on-road tilt).
    let sx = scale * fit;
    let sy = scale * fit * ROAD_TILT;
    let dy = 0;
    let alpha = 1;
    let glow = false;
    let flashHue = -1;

    switch (w.effect) {
      case "pop": {
        if (isActive) {
          const s = u < 0.55 ? 0.6 + 0.75 * (u / 0.55) : 1.35 - 0.23 * ((u - 0.55) / 0.45);
          sx *= s;
          sy *= s;
        }
        break;
      }
      case "glow": {
        glow = isActive;
        break;
      }
      case "rise": {
        if (isActive) dy = -11 * scale * easeOutCubic(u);
        break;
      }
      case "flash": {
        if (isActive) flashHue = (u * 300) % 360;
        break;
      }
      case "bounce": {
        if (isActive) dy = -Math.abs(Math.sin(u * Math.PI * 2)) * 10 * scale * (1 - u * 0.5);
        break;
      }
      case "fade": {
        if (isActive) alpha = 0.15 + 0.85 * u;
        break;
      }
    }

    ctx.translate(0, dy);
    ctx.scale(sx, sy);
    ctx.globalAlpha = alpha * (isActive ? 1 : isSung ? 0.5 : 0.30);

    ctx.fillStyle = flashHue >= 0 ? `hsl(${flashHue}, 100%, 72%)` : "#ffffff";
    if (glow) {
      ctx.shadowColor = "#ff1493";
      ctx.shadowBlur = 26;
    }
    // Dark outline keeps words readable over bright track art.
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 3.2;

    // Draw centered: text was measured in font units, scale handles perspective.
    const drawX = -widths[i] / 2;
    ctx.strokeText(w.text, drawX, 0);
    ctx.fillText(w.text, drawX, 0);
    ctx.restore();

    x += wW + spacing * fit;
  }
  ctx.restore();
}
