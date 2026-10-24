/**
 * Shareable accomplishments for the monthly build, all without a link (Playgama
 * doesn't allow links out of the game):
 *
 *   - progressText(): a Wordle-style grid of the month's medals to copy.
 *   - drawRunCard() / drawProgressCard(): a portrait PNG of one run or of the
 *     whole month, drawn on a canvas, for the player to save or send.
 *   - saveCard(): the device share sheet with the image where the portal frame
 *     allows it, otherwise a download. The panel also shows the image itself,
 *     so a long-press or right-click saves it when both are blocked.
 */

export const MEDAL_COLOR: Record<string, string> = {
  PLATINUM: '#39FF14', GOLD: '#FFC21A', SILVER: '#C9D3E6', BRONZE: '#E08A45',
};
const MEDAL_SQUARE: Record<string, string> = {
  PLATINUM: '🟩', GOLD: '🟨', SILVER: '⬜', BRONZE: '🟧',
};
const CLEARED_SQUARE = '🟦';
const OPEN_SQUARE = '⬛';

export interface TrackMark {
  title: string;
  day: number;
  coverArt: string | null;
  /** '' or 'NONE' when there's no medal. */
  medal: string;
  cleared: boolean;
  bonus: boolean;
}

export interface ProgressSummary {
  monthName: string;
  color: string;
  tracks: TrackMark[];
  cleared: number;
  regularCount: number;
  platinums: number;
  deluxePlatinums: number;
  total: number;
  endings: string[];
  trophies: number;
  trophyCount: number;
}

export interface RunSummary {
  monthName: string;
  color: string;
  title: string;
  day: number | null;
  coverArt: string | null;
  score: number;
  accuracy: number;
  maxCombo: number;
  medal: string;
  rank: string;
  fullCombo: boolean;
  deluxe: boolean;
  stageLabel: string;
  record: 'first' | 'new' | null;
}

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const hasMedal = (m: string) => !!MEDAL_COLOR[m];

function square(t: TrackMark): string {
  return MEDAL_SQUARE[t.medal] ?? (t.cleared ? CLEARED_SQUARE : OPEN_SQUARE);
}

/** The month as text: one row of squares per week, then the bonus row. */
export function progressText(p: ProgressSummary): string {
  const regular = p.tracks.filter((t) => !t.bonus);
  const bonus = p.tracks.filter((t) => t.bonus);
  const rows: string[] = [];
  for (let i = 0; i < regular.length; i += 7) rows.push(regular.slice(i, i + 7).map(square).join(''));
  if (bonus.length) rows.push(`${bonus.map(square).join('')} bonus`);
  const stats = [`✦ ${p.platinums} platinum`];
  if (p.deluxePlatinums) stats.push(`${p.deluxePlatinums} Deluxe platinum`);
  stats.push(`🏆 ${p.trophies}/${p.trophyCount}`);
  return [
    `PIM: ${titleCase(p.monthName)} · ${p.cleared}/${p.regularCount} cleared`,
    ...rows,
    stats.join(' · '),
    ...(p.endings.length ? [`Endings: ${p.endings.join(', ')}`] : []),
    `Score ${p.total.toLocaleString('en-US')}`,
  ].join('\n');
}

/** One run as text, to go with the card where the portal takes text. */
export function runText(r: RunSummary): string {
  const medal = hasMedal(r.medal) ? `${MEDAL_SQUARE[r.medal]} ${titleCase(r.medal)}` : 'Cleared';
  const extras = [r.fullCombo && 'Full combo', r.record === 'first' && 'First clear', r.record === 'new' && 'New record'].filter(Boolean).join(' · ');
  return [
    `PIM: ${titleCase(r.monthName)} · ${r.title}${r.deluxe ? ' (Deluxe)' : ''}`,
    `${medal} · Rank ${r.rank} · ${r.score.toLocaleString('en-US')} pts · ${r.accuracy.toFixed(1)}%`,
    ...(extras ? [extras] : []),
  ].join('\n');
}

// ── Canvas cards ──────────────────────────────────────────────────────────
const W = 1080;
const H = 1350;
const DISPLAY = "'Anton', Impact, 'Arial Narrow', sans-serif";
const BODY = "'Space Grotesk', system-ui, sans-serif";
const PIXEL = "'Press Start 2P', monospace";

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`80px ${DISPLAY}`),
      document.fonts.load(`600 32px ${BODY}`),
      document.fonts.load(`20px ${PIXEL}`),
    ]);
  } catch { /* draw with fallbacks */ }
}

function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Squeezes a line into maxW by shrinking the font, down to minPx. */
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, px: number, maxW: number, minPx = 28) {
  let size = px;
  ctx.font = font(size);
  while (size > minPx && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

function backdrop(ctx: CanvasRenderingContext2D, color: string, art: HTMLImageElement | null) {
  ctx.fillStyle = '#07060a';
  ctx.fillRect(0, 0, W, H);
  if (art) {
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.filter = 'blur(28px) saturate(1.3)';
    cover(ctx, art, -60, -60, W + 120, H + 120);
    ctx.restore();
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(7,6,10,0.2)');
  g.addColorStop(0.55, 'rgba(7,6,10,0.75)');
  g.addColorStop(1, 'rgba(7,6,10,0.97)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Scanlines, like the in-game CRT.
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, 14);
}

function header(ctx: CanvasRenderingContext2D, color: string, monthName: string, eyebrow: string) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = `22px ${PIXEL}`;
  ctx.fillText(eyebrow.toUpperCase(), 72, 110);
  ctx.fillStyle = '#fff';
  ctx.font = `120px ${DISPLAY}`;
  ctx.fillText(`PIM: ${monthName.toUpperCase()}`, 68, 236);
}

function footer(ctx: CanvasRenderingContext2D, color: string) {
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 28px ${BODY}`;
  ctx.fillText('th3scr1b3 · 365 Days of Light and Dark', 72, H - 72);
  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.font = `18px ${PIXEL}`;
  ctx.fillText('POETRY IN MOTION', W - 72, H - 76);
  ctx.textAlign = 'left';
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, bg: string, fg = '#0a0a0a') {
  ctx.font = `20px ${PIXEL}`;
  const w = ctx.measureText(text).width + 40;
  roundRect(ctx, x, y, w, 52, 26);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 20, y + 28);
  ctx.textBaseline = 'alphabetic';
  return w;
}

async function render(draw: (ctx: CanvasRenderingContext2D, withArt: boolean) => Promise<void>): Promise<HTMLCanvasElement> {
  await fontsReady();
  const make = async (withArt: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    await draw(ctx, withArt);
    ctx.getImageData(0, 0, 1, 1); // throws if a cover tainted the canvas
    return canvas;
  };
  try {
    return await make(true);
  } catch {
    return make(false);
  }
}

export function drawRunCard(r: RunSummary): Promise<HTMLCanvasElement> {
  return render(async (ctx, withArt) => {
    const art = withArt ? await loadImage(r.coverArt) : null;
    const medalColor = MEDAL_COLOR[r.medal] ?? r.color;
    backdrop(ctx, r.color, art);
    header(ctx, r.color, r.monthName, r.deluxe ? `${r.stageLabel} · Deluxe` : r.stageLabel);

    // Cover art with a medal-coloured frame.
    const size = 560;
    const x = (W - size) / 2;
    const y = 300;
    ctx.save();
    ctx.shadowColor = medalColor;
    ctx.shadowBlur = 60;
    roundRect(ctx, x - 10, y - 10, size + 20, size + 20, 30);
    ctx.fillStyle = medalColor;
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, size, size, 22);
    ctx.clip();
    ctx.fillStyle = '#16131c';
    ctx.fillRect(x, y, size, size);
    if (art) cover(ctx, art, x, y, size, size);
    ctx.restore();

    // Rank stamp over the corner of the art.
    const sx = x + size - 30;
    const sy = y + size - 40;
    ctx.beginPath();
    ctx.arc(sx, sy, 96, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0a';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = medalColor;
    ctx.stroke();
    ctx.fillStyle = medalColor;
    ctx.textAlign = 'center';
    ctx.font = `86px ${DISPLAY}`;
    ctx.fillText(r.rank, sx, sy + 22);
    ctx.font = `14px ${PIXEL}`;
    ctx.fillText(hasMedal(r.medal) ? r.medal : 'CLEAR', sx, sy + 58);
    ctx.textAlign = 'left';

    // Track title.
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `600 30px ${BODY}`;
    ctx.fillText(r.day != null ? `Day ${r.day}` : 'Transmission', 72, 940);
    ctx.fillStyle = '#fff';
    fitText(ctx, r.title, (px) => `${px}px ${DISPLAY}`, 84, W - 144);
    ctx.fillText(r.title, 72, 1030);

    // Score line.
    ctx.fillStyle = medalColor;
    ctx.font = `96px ${DISPLAY}`;
    const score = r.score.toLocaleString('en-US');
    ctx.fillText(score, 72, 1140);
    const sw = ctx.measureText(score).width;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `600 32px ${BODY}`;
    ctx.fillText(`${r.accuracy.toFixed(1)}%  ·  ${r.maxCombo}x combo`, 72 + sw + 28, 1132);

    let cx = 72;
    if (r.fullCombo) cx += chip(ctx, cx, 1170, 'FULL COMBO', '#39FF14') + 14;
    if (r.record) cx += chip(ctx, cx, 1170, r.record === 'first' ? 'FIRST CLEAR' : 'NEW RECORD', '#FFC21A') + 14;
    if (r.deluxe) chip(ctx, cx, 1170, 'DELUXE', '#FF1493', '#fff');
    footer(ctx, r.color);
  });
}

export function drawProgressCard(p: ProgressSummary): Promise<HTMLCanvasElement> {
  return render(async (ctx, withArt) => {
    const arts = withArt ? await Promise.all(p.tracks.map((t) => (t.cleared ? loadImage(t.coverArt) : Promise.resolve(null)))) : [];
    backdrop(ctx, p.color, null);
    header(ctx, p.color, p.monthName, 'Month progress');

    // Stats row.
    const stats: [string, string][] = [
      [`${p.cleared}/${p.regularCount}`, 'cleared'],
      [String(p.platinums), 'platinum'],
      [`${p.trophies}/${p.trophyCount}`, 'trophies'],
    ];
    stats.forEach(([v, label], i) => {
      const x = 72 + i * 320;
      ctx.fillStyle = i === 1 ? MEDAL_COLOR.PLATINUM : '#fff';
      ctx.font = `76px ${DISPLAY}`;
      ctx.fillText(v, x, 350);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `600 26px ${BODY}`;
      ctx.fillText(label, x, 390);
    });

    // Track grid: 7 per row, bonus tracks in their own row.
    const regular = p.tracks.map((t, i) => ({ t, art: arts[i] ?? null })).filter((x) => !x.t.bonus);
    const bonus = p.tracks.map((t, i) => ({ t, art: arts[i] ?? null })).filter((x) => x.t.bonus);
    const cols = 7;
    const gap = 14;
    // Small enough that four weeks, the bonus row and the totals clear the footer.
    const tile = 104;
    const tileAt = (x: number, y: number, item: { t: TrackMark; art: HTMLImageElement | null }) => {
      const medal = MEDAL_COLOR[item.t.medal];
      ctx.save();
      roundRect(ctx, x, y, tile, tile, 14);
      ctx.clip();
      ctx.fillStyle = item.t.cleared ? '#1d1a26' : '#0f0d14';
      ctx.fillRect(x, y, tile, tile);
      if (item.art) cover(ctx, item.art, x, y, tile, tile);
      ctx.restore();
      roundRect(ctx, x + 2, y + 2, tile - 4, tile - 4, 13);
      ctx.lineWidth = medal ? 6 : 2;
      ctx.strokeStyle = medal ?? (item.t.cleared ? 'rgba(120,170,255,0.8)' : 'rgba(255,255,255,0.12)');
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = item.t.cleared ? '#fff' : 'rgba(255,255,255,0.3)';
      ctx.font = `16px ${PIXEL}`;
      if (!item.art) ctx.fillText(String(item.t.day), x + tile / 2, y + tile / 2 + 8);
      if (medal) {
        ctx.beginPath();
        ctx.arc(x + tile - 20, y + 20, 11, 0, Math.PI * 2);
        ctx.fillStyle = medal;
        ctx.fill();
      }
      ctx.textAlign = 'left';
    };
    let y = 440;
    for (let i = 0; i < regular.length; i += cols) {
      regular.slice(i, i + cols).forEach((item, j) => tileAt(72 + j * (tile + gap), y, item));
      y += tile + gap;
    }
    if (bonus.length) {
      y += 18;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `16px ${PIXEL}`;
      ctx.fillText('BONUS', 72, y + 10);
      y += 26;
      bonus.forEach((item, j) => tileAt(72 + j * (tile + gap), y, item));
      y += tile + gap;
    }

    // Endings and total.
    const base = y + 46;
    ctx.fillStyle = p.color;
    ctx.font = `18px ${PIXEL}`;
    ctx.fillText(p.endings.length ? `ENDINGS · ${p.endings.join(' · ').toUpperCase()}` : 'NO ENDINGS YET', 72, base);
    ctx.fillStyle = '#fff';
    ctx.font = `600 34px ${BODY}`;
    ctx.fillText(`Score ${p.total.toLocaleString('en-US')}`, 72, base + 56);
    footer(ctx, p.color);
  });
}

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export type SaveResult = 'shared' | 'downloaded' | 'failed';

/** Opens the share sheet with the image where allowed, else downloads it. */
export async function saveCard(blob: Blob, fileName: string, text: string): Promise<SaveResult> {
  const file = new File([blob], fileName, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return 'failed';
    /* frame blocks the share sheet: download instead */
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
