/**
 * Canvas glow (shadowBlur) is the single most expensive thing the gameplay renderer does,
 * especially on phones. Dozens of draw sites set it directly, so the graphics settings are
 * enforced here, once per frame, on the context itself: every `ctx.shadowBlur = n` that
 * follows is scaled by `scale` (0 turns glow off entirely, 1 leaves it untouched).
 */
const proto = typeof CanvasRenderingContext2D !== 'undefined' ? CanvasRenderingContext2D.prototype : null;
const native = proto ? Object.getOwnPropertyDescriptor(proto, 'shadowBlur') : undefined;
const gated = new WeakMap<CanvasRenderingContext2D, number>();

export function gateShadows(ctx: CanvasRenderingContext2D, scale: number): void {
  if (!native?.get || !native.set) return;
  const s = Math.max(0, Math.min(1, scale));
  if (gated.get(ctx) === s) return;
  if (s >= 1) {
    // Back to the browser's own accessor.
    delete (ctx as unknown as Record<string, unknown>).shadowBlur;
    gated.delete(ctx);
    return;
  }
  const get = native.get;
  const set = native.set;
  Object.defineProperty(ctx, 'shadowBlur', {
    configurable: true,
    enumerable: true,
    get() {
      return get.call(this);
    },
    set(v: number) {
      set.call(this, s === 0 ? 0 : v * s);
    },
  });
  gated.set(ctx, s);
  // Apply to whatever is currently set.
  set.call(ctx, s === 0 ? 0 : get.call(ctx) * s);
}

/** Glow scale for the current graphics options. */
export function shadowScaleFor(o: { legacyGraphics?: boolean; bloomGlow?: boolean; gfxLevel?: string }): number {
  if (o.legacyGraphics || o.bloomGlow === false || o.gfxLevel === 'low') return 0;
  if (o.gfxLevel === 'medium') return 0.5;
  return 1;
}
