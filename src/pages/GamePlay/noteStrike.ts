// The strike line: the mark through the middle of every hittable note. A note sits on the
// track's hit line exactly when its strike line lies on top of it, so each skin draws one
// through y = 0 (drawKey has already moved the origin to the note's own moment in time) and
// flanks it with a pair of sights that close in and brighten as the note arrives. Mines and
// ghosts get no strike line, because they are not meant to be hit.

export type StrikeOpts = {
  /** Colour of the line itself; defaults to white. */
  core?: string;
  /** How far the line stops short of each end of the note. */
  inset?: number;
  /** Glow in the note colour behind the line (off for flat, printed skins). */
  glow?: boolean;
  /** Draw the two sights outside the note's ends. */
  sights?: boolean;
  /** Line weight; defaults to a hairline that scales with the note. */
  weight?: number;
};

/** Draws the centre line of a note of size w × h, centred on the origin. `p` is approach, 0..1. */
export function drawStrike(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  p: number,
  o: StrikeOpts = {},
) {
  const core = o.core ?? '#ffffff';
  const inset = o.inset ?? Math.min(h * 0.3, 6);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha *= 0.62 + 0.38 * p;
  if (o.glow !== false) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 4 + 8 * p;
  }
  ctx.strokeStyle = core;
  ctx.lineWidth = o.weight ?? Math.max(1.5, h * 0.075);
  ctx.beginPath();
  ctx.moveTo(-w / 2 + inset, 0);
  ctx.lineTo(w / 2 - inset, 0);
  ctx.stroke();
  ctx.restore();
  if (o.sights !== false) drawSights(ctx, w, h, color, p, core);
}

/**
 * Two small arrowheads outside the note's ends, pointing in at the strike line. They start a
 * little way off and close up as the note reaches the hit line, so "now" reads from the edges
 * of the lane as well as from the note's middle.
 */
export function drawSights(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  p: number,
  edge = '#ffffff',
) {
  const s = Math.max(3, Math.min(7, h * 0.18));
  const gap = 1.5 + (1 - p) * Math.min(6, h * 0.16);
  ctx.save();
  ctx.globalAlpha *= 0.55 + 0.45 * p;
  ctx.lineJoin = 'round';
  for (const sx of [-1, 1] as const) {
    const x = sx * (w / 2 + gap);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + sx * s, -s * 0.7);
    ctx.lineTo(x + sx * s, s * 0.7);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();
}
