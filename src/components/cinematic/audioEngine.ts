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

let sharedNoiseBuffer: AudioBuffer | null = null;

function getSharedNoiseBuffer(c: AudioContext): AudioBuffer {
  if (!sharedNoiseBuffer || sharedNoiseBuffer.sampleRate !== c.sampleRate) {
    const bufferSize = c.sampleRate * 2; // 2 seconds of pre-generated noise
    sharedNoiseBuffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  }
  return sharedNoiseBuffer;
}

function noise(
  duration: number,
  gain: number,
  filter?: { type: BiquadFilterType; freq: number },
): void {
  if (typeof localStorage !== 'undefined' && localStorage.getItem("opt_sfxEnabled") === "false") return;
  const c = getCtx();
  const buf = getSharedNoiseBuffer(c);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = c.createGain();
  safeGainRamp(g, gain * 0.8, 0.001, duration);
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    src.connect(f).connect(g).connect(getDestination());
  } else {
    src.connect(g).connect(getDestination());
  }
  src.start();
  src.stop(c.currentTime + duration);
}

function tone(
  freq: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
): OscillatorNode {
  const c = getCtx();
  const osc = c.createOscillator();
  if (typeof localStorage !== 'undefined' && localStorage.getItem("opt_sfxEnabled") === "false") {
    // Return muted osc node if SFX disabled
    const g = c.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(getDestination());
    osc.start();
    osc.stop(c.currentTime + duration);
    return osc;
  }
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  safeGainRamp(g, gain * 0.8, 0.001, duration);
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

export function playBombshellHeartbeat(): void {
  try {
    const c = getCtx();
    tone(42, 0.22, 0.2, 'sine');
    setTimeout(() => {
      try { tone(36, 0.28, 0.24, 'sine'); } catch { /* noop */ }
    }, 140);
  } catch { /* AudioContext suppressed */ }
}

export function playBombshellSwell(): void {
  try {
    const c = getCtx();
    // Warm deep sub
    tone(55, 0.8, 0.2, 'sine');
    // Ascending neon chime harmony
    const notes = [440, 554.37, 659.25, 880, 1108.73]; // A Major 7th / 9th glamour chord
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        try {
          tone(freq, 0.5, 0.04, 'sine');
        } catch { /* noop */ }
      }, idx * 60);
    });
  } catch { /* AudioContext suppressed */ }
}

export function playBombshellShimmer(): void {
  try {
    tone(3135.96, 0.9, 0.02, 'sine'); // G7
    tone(3729.31, 0.8, 0.015, 'sine'); // A#7
    tone(4186.01, 1.0, 0.02, 'sine'); // C8
    noise(0.12, 0.08, { type: 'highpass', freq: 7000 });
  } catch { /* AudioContext suppressed */ }
}

// ── Tiered reveal (common → mythic) ─────────────────────────────────

function sfxMuted(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem('opt_sfxEnabled') === 'false';
}

/** Rising riser under the pre-flip charge. Gets longer, lower and wider per tier. */
export function playTierCharge(tier: number, seconds: number): void {
  if (tier < 1 || seconds <= 0 || sfxMuted()) return;
  try {
    const c = getCtx();
    const t0 = c.currentTime;
    const end = t0 + seconds;

    // Filtered noise sweep
    const src = c.createBufferSource();
    src.buffer = getSharedNoiseBuffer(c);
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(300, t0);
    bp.frequency.exponentialRampToValueAtTime(2500 + tier * 900, end);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.001, t0);
    ng.gain.exponentialRampToValueAtTime(0.05 + tier * 0.025, end);
    src.connect(bp).connect(ng).connect(getDestination());
    src.start(t0);
    src.stop(end + 0.02);

    // Pitch glide (detuned pair for rare+)
    const voices = tier >= 2 ? [0, 7] : [0];
    voices.forEach((cents) => {
      const o = c.createOscillator();
      o.type = tier >= 3 ? 'sawtooth' : 'triangle';
      o.detune.value = cents;
      o.frequency.setValueAtTime(70 + tier * 10, t0);
      o.frequency.exponentialRampToValueAtTime(380 + tier * 140, end);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, t0);
      lp.frequency.exponentialRampToValueAtTime(2200, end);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.exponentialRampToValueAtTime(0.025 + tier * 0.012, end);
      o.connect(lp).connect(g).connect(getDestination());
      o.start(t0);
      o.stop(end + 0.02);
    });

    // Mythic: accelerating sub heartbeat under the riser
    if (tier >= 4) {
      const beats = 5;
      for (let b = 0; b < beats; b++) {
        const at = Math.pow(b / beats, 0.75) * seconds * 1000;
        setTimeout(() => {
          try {
            tone(44, 0.22, 0.22, 'sine');
            setTimeout(() => { try { tone(38, 0.26, 0.26, 'sine'); } catch { /* noop */ } }, 130);
          } catch { /* noop */ }
        }, at);
      }
    }
  } catch { /* AudioContext suppressed */ }
}

/** The hit when the card turns. Each tier stacks on the one below. */
export function playTierImpact(tier: number): void {
  try {
    if (tier <= 0) { playTick(); return; }
    if (tier === 1) {
      playTick();
      tone(880, 0.25, 0.04, 'sine');
      setTimeout(() => { try { tone(1318.5, 0.3, 0.035, 'sine'); } catch { /* noop */ } }, 70);
      return;
    }
    playRareHit();
    if (tier >= 3) {
      tone(48, 1.2, 0.25, 'sine'); // boom
      noise(0.5, 0.12, { type: 'lowpass', freq: 900 }); // body
      const chord = [523.25, 659.25, 783.99, 987.77]; // Cmaj7 bloom
      chord.forEach((f, k) => setTimeout(() => { try { tone(f, 1.1, 0.035, 'sine'); } catch { /* noop */ } }, 120 + k * 45));
    }
    if (tier >= 4) {
      tone(32, 1.8, 0.3, 'sine'); // sub drop
      setTimeout(() => { try { playUnlockChime(); } catch { /* noop */ } }, 380);
      [2093, 2637, 3136].forEach((f, k) => setTimeout(() => { try { tone(f, 1.4, 0.018, 'sine'); } catch { /* noop */ } }, 600 + k * 90));
    }
  } catch { /* AudioContext suppressed */ }
}


// ── Song unlock (first pull of a day) ──────────────────────────────

/** Rising filtered-noise sweep that builds into the song unlock drop. */
export function playSignalRiser(duration = 0.7): void {
  if (typeof localStorage !== 'undefined' && localStorage.getItem("opt_sfxEnabled") === "false") return;
  try {
    const c = getCtx();
    const src = c.createBufferSource();
    src.buffer = getSharedNoiseBuffer(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(300, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(6000, c.currentTime + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + duration * 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(f).connect(g).connect(getDestination());
    src.start();
    src.stop(c.currentTime + duration + 0.02);
  } catch { /* AudioContext suppressed */ }
}

/** Sub-bass drop + air burst that lands the moment the song opens up. */
export function playSongUnlockDrop(): void {
  if (typeof localStorage !== 'undefined' && localStorage.getItem("opt_sfxEnabled") === "false") return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, c.currentTime + 0.5);
    const g = c.createGain();
    safeGainRamp(g, 0.32, 0.001, 0.9);
    osc.connect(g).connect(getDestination());
    osc.start();
    osc.stop(c.currentTime + 0.9);
    noise(0.35, 0.12, { type: 'highpass', freq: 5000 });
    playUnlockChime();
  } catch { /* AudioContext suppressed */ }
}

/**
 * The cinematic AudioContext, which was created inside the user's pack tap and
 * is therefore already unlocked on iOS. Lets callers route media through it.
 */
export function getCinematicAudioContext(): AudioContext | null {
  try { return getCtx(); } catch { return null; }
}

/** Bonus Bombshell interrupt: a tape-stop glitch that cuts the regular pack's flow. */
export function playBombshellBonusGlitch(): void {
  try {
    noise(0.18, 0.22, { type: 'bandpass', freq: 2400 });
    const osc = tone(880, 0.45, 0.07, 'sawtooth');
    osc.frequency.exponentialRampToValueAtTime(55, getCtx().currentTime + 0.42);
  } catch { /* AudioContext suppressed */ }
}

/** Bonus Bombshell card slam: sub impact plus a bright crack. */
export function playBombshellBonusImpact(): void {
  try {
    const osc = tone(110, 0.6, 0.3, 'sine');
    osc.frequency.exponentialRampToValueAtTime(32, getCtx().currentTime + 0.5);
    noise(0.09, 0.2, { type: 'highpass', freq: 3500 });
  } catch { /* AudioContext suppressed */ }
}

export function disposeAudioContext(): void {
  if (ctx) {
    try { ctx.close(); } catch { /* noop */ }
    ctx = null;
    masterGain = null;
    compressor = null;
  }
}

