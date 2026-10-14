/**
 * Global audio gate for the Playgama build. The app makes sound through many
 * AudioContexts and <audio> elements, so instead of threading a mute flag
 * through every one we track them here and silence them all while any reason
 * is active (platform mute, platform pause, ad on screen, tab hidden).
 */
export type GateReason = 'platform_audio' | 'platform_pause' | 'ad' | 'hidden';

const reasons = new Set<GateReason>();
const contexts = new Set<BaseAudioContext>();
const suspendedByGate = new WeakSet<BaseAudioContext>();
const mediaRefs: WeakRef<HTMLMediaElement>[] = [];
const mutedByGate = new WeakSet<HTMLMediaElement>();

let nativeResume: ((this: AudioContext) => Promise<void>) | null = null;

export function isAudioGated(): boolean {
  return reasons.size > 0;
}

function trackMedia(el: HTMLMediaElement) {
  if (!mediaRefs.some((r) => r.deref() === el)) mediaRefs.push(new WeakRef(el));
}

function liveMedia(): HTMLMediaElement[] {
  const out: HTMLMediaElement[] = [];
  for (let i = mediaRefs.length - 1; i >= 0; i--) {
    const el = mediaRefs[i].deref();
    if (el) out.push(el);
    else mediaRefs.splice(i, 1);
  }
  document.querySelectorAll('audio, video').forEach((el) => {
    if (!out.includes(el as HTMLMediaElement)) out.push(el as HTMLMediaElement);
  });
  return out;
}

function silence(el: HTMLMediaElement) {
  if (!el.muted) {
    el.muted = true;
    mutedByGate.add(el);
  }
}

function apply() {
  const gated = isAudioGated();
  for (const ctx of contexts) {
    if (ctx.state === 'closed') {
      contexts.delete(ctx);
      continue;
    }
    if (gated && ctx.state === 'running') {
      suspendedByGate.add(ctx);
      (ctx as AudioContext).suspend?.().catch(() => {});
    } else if (!gated && suspendedByGate.has(ctx)) {
      suspendedByGate.delete(ctx);
      nativeResume?.call(ctx as AudioContext).catch(() => {});
    }
  }
  for (const el of liveMedia()) {
    if (gated) silence(el);
    else if (mutedByGate.has(el)) {
      mutedByGate.delete(el);
      el.muted = false;
    }
  }
}

export function setGate(reason: GateReason, active: boolean): void {
  const had = reasons.has(reason);
  if (active === had) return;
  if (active) reasons.add(reason);
  else reasons.delete(reason);
  apply();
}

let installed = false;

/** Hooks AudioContext and HTMLMediaElement so the gate sees every sound source. */
export function installAudioGate(): void {
  if (installed) return;
  installed = true;

  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Native = w.AudioContext || w.webkitAudioContext;
  if (Native) {
    nativeResume = Native.prototype.resume;
    // While gated, the game's own resume() calls are deferred until the gate lifts.
    Native.prototype.resume = function (this: AudioContext) {
      contexts.add(this);
      if (isAudioGated()) {
        suspendedByGate.add(this);
        return Promise.resolve();
      }
      return nativeResume!.call(this);
    };
    class TrackedAudioContext extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.add(this);
        if (isAudioGated()) {
          suspendedByGate.add(this);
          this.suspend().catch(() => {});
        }
      }
    }
    if (w.AudioContext) w.AudioContext = TrackedAudioContext;
    if (w.webkitAudioContext) w.webkitAudioContext = TrackedAudioContext;
  }

  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    trackMedia(this);
    if (isAudioGated()) silence(this);
    return nativePlay.call(this);
  };

  document.addEventListener('visibilitychange', () => setGate('hidden', document.hidden));
}
