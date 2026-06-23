/**
 * Procedural audio engine for cinematic pack reveal.
 * Uses Web Audio API — no external dependencies.
 *
 * Safety: All gain ramps use exponentialRampToValueAtTime with floor 0.001
 * (never 0, which throws). A shared getCtx() auto-resumes on user gesture.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    try {
      ctx = new AudioContextClass({ latencyHint: 'interactive' });
    } catch {
      ctx = new AudioContextClass();
    }
    // Set up master limiter chain for cinematic audio engine to prevent scratchy clipping
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, ctx.currentTime);

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-1.0, ctx.currentTime);
    compressor.knee.setValueAtTime(30, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.08, ctx.currentTime);

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function getDestination(): AudioNode {
  getCtx();
  return masterGain || ctx!.destination;
}

/** Safely schedule a gain ramp that avoids the "0 is not a valid value" error. */
function safeGainRamp(
  gain: GainNode,
  startValue: number,
  endValue: number,
  duration: number,
) {
  const c = getCtx();
  const safeStart = Math.max(startValue, 0.001);
  const safeEnd = Math.max(endValue, 0.001);
  gain.gain.setValueAtTime(safeStart, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(safeEnd, c.currentTime + duration);
}

function noise(
  duration: number,
  gain: number,
  filter?: { type: BiquadFilterType; freq: number },
): void {
  const c = getCtx();
  const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  safeGainRamp(g, gain, 0.001, duration);
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    src.connect(f).connect(g).connect(getDestination());
  } else {
    src.connect(g).connect(getDestination());
  }
  src.start();
}

function tone(
  freq: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
): OscillatorNode {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  safeGainRamp(g, gain, 0.001, duration);
  osc.connect(g).connect(getDestination());
  osc.start();
  osc.stop(c.currentTime + duration);
  return osc;
}

// ── Exported sound triggers ──────────────────────────────────────────

export function playAmbient(): () => void {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 55; // low A
  const g = c.createGain();
  g.gain.value = 0.06;
  const osc2 = c.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 82.5;
  const g2 = c.createGain();
  g2.gain.value = 0.03;
  osc.connect(g).connect(getDestination());
  osc2.connect(g2).connect(getDestination());
  osc.start();
  osc2.start();
  return () => {
    try {
      // Fade out rather than hard-stop to prevent clicks
      const now = c.currentTime;
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      g2.gain.setValueAtTime(g2.gain.value, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      setTimeout(() => {
        try { osc.stop(); } catch { /* already stopped */ }
        try { osc2.stop(); } catch { /* already stopped */ }
      }, 80);
    } catch {
      try { osc.stop(); } catch { /* noop */ }
      try { osc2.stop(); } catch { /* noop */ }
    }
  };
}

export function playCrinkle(): void {
  noise(0.15, 0.12, { type: 'bandpass', freq: 3000 });
  noise(0.08, 0.06, { type: 'highpass', freq: 5000 });
  tone(80, 0.3, 0.08, 'sine');
}

export function playTension(): void {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.3);
  const g = c.createGain();
  safeGainRamp(g, 0.04, 0.001, 0.35);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1200;
  osc.connect(f).connect(g).connect(getDestination());
  osc.start();
  osc.stop(c.currentTime + 0.35);
}

export function playTear(): void {
  noise(0.4, 0.2, { type: 'bandpass', freq: 2500 });
  noise(0.3, 0.15, { type: 'lowpass', freq: 400 });
  tone(45, 0.25, 0.1, 'sine');
}

export function playSnap(): void {
  noise(0.05, 0.25, { type: 'highpass', freq: 4000 });
  tone(35, 0.15, 0.15, 'sine'); // sub hit
}

export function playShimmer(): void {
  tone(2400, 0.8, 0.02, 'sine');
  tone(3200, 0.6, 0.015, 'sine');
}

export function playTick(): void {
  noise(0.03, 0.08, { type: 'highpass', freq: 6000 });
}

export function playNearMiss(): void {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.1);
  const g = c.createGain();
  safeGainRamp(g, 0.08, 0.001, 0.12);
  osc.connect(g).connect(getDestination());
  osc.start();
  osc.stop(c.currentTime + 0.13);
}

export function playRareHit(): void {
  tone(120, 0.6, 0.15, 'sine');
  tone(240, 0.4, 0.08, 'triangle');
  tone(480, 0.3, 0.05, 'sine');
  noise(0.08, 0.18, { type: 'highpass', freq: 3000 });
  setTimeout(() => {
    tone(180, 0.5, 0.1, 'sine');
    tone(360, 0.3, 0.06, 'triangle');
  }, 80);
}

export function playUnlockChime(): void {
  tone(523.25, 0.4, 0.08, 'sine'); // C5
  setTimeout(() => {
    tone(659.25, 0.3, 0.06, 'sine'); // E5
    setTimeout(() => {
      tone(783.99, 0.4, 0.08, 'sine'); // G5
      tone(1046.50, 0.5, 0.05, 'sine'); // C6
    }, 80);
  }, 80);
}

export function disposeAudioContext(): void {
  if (ctx) {
    try { ctx.close(); } catch { /* noop */ }
    ctx = null;
    masterGain = null;
    compressor = null;
  }
}
