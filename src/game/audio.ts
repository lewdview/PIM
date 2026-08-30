/**
 * AudioManager — centralized sample-based SFX engine.
 *
 * Architecture:
 *  - Single shared AudioContext, lazily created on first interaction.
 *  - WAV files are fetched once, decoded into AudioBuffers, and cached in a Map.
 *  - `playSfx()` is fire-and-forget: creates a one-shot BufferSourceNode each call.
 *  - `preloadAll()` bulk-loads every game SFX so there's zero latency at play time.
 */

export type SfxName =
  | 'back'
  | 'rewind'
  | 'gmeover'
  | 'fusion'
  | 'gold_get'
  | 'silver_get'
  | 'bronxe_get'
  | 'diamond'
  | 'mythic_get'
  | 'platinum_get'
  | 'reveal'
  | 'open_chest'
  | 'bing_before_platinum'
  | 'queue_before_mythic'
  | 'tap_nav'
  | 'swipe'
  | 'tap_perfect'
  | 'mine_explosion'
  | 'overdrive_activate'
  | 'remix_stem'
  | 'powerup_t1'
  | 'powerup_t2'
  | 'powerup_t3'
  | 'tunnel_transition'
  | 'continue?'
  | 'countdown'
  | 'gameover_countdown'
  | 'outof_continues'
  | 'perfect'
  | 'results'
  | 'resuts2'
  | 'select_high_short'
  | 'select_start_song'
  | 'song_completion'
  | 'locked_out'
  | 'not_enough'
  | 'error'
  | 'hidden_secret_found'
  | 'new_modes_available'
  | 'pause'
  | 'pause_2'
  | 'intro'
  | 'intro_2'
  | 'intro3'
  | 'cas_slam_down'
  | 'case_open_2'
  | 'open_basic'
  | 'open_basic_2'
  | 'open_case'
  | 'by_th3scr1b3'
  | 'inbetween'
  | 'crowd'
  | 'month_3'
  | 'menu_confirm'
  | 'targeted'
  | 'upgrade'
  | 'miss';

const REWIND_TRACKS = [
  'rewind1', 'rewind2', 'rewind3', 'rewind4',
  'rewind5', 'rewind6', 'rewind7', 'rewind8'
];

let nextRewindIdx = Math.floor(Math.random() * REWIND_TRACKS.length);

// ── Canonical filename map ─────────────────────────────────────────────────
// Maps logical SFX names to actual filenames on disk (no .wav extension).
// Typos / spaces in actual filenames are contained here so callers never
// need to know about them.
const SFX_FILES: Record<SfxName, string> = {
  back:                   'back',
  rewind:                 'rewind1',         // dynamically cycled — see playSfx()
  gmeover:                'gmeover',
  fusion:                 'fusion',
  gold_get:               'gold_voice_get',
  silver_get:             'silver_get',
  bronxe_get:             'bronxe_get',
  diamond:                'diamond',
  mythic_get:             'mythic_get',
  platinum_get:           'platinum _get_voice',  // space intentional — matches disk
  reveal:                 'reveal',
  open_chest:             'open_chest',
  bing_before_platinum:   'bing befre pltinum',   // typo intentional — matches disk
  queue_before_mythic:    'que_before_mythic',
  // Navigation tap — crisp short blip, NOT the back sound
  tap_nav:                'select_high_short',
  swipe:                  'swipe_sound',
  tap_perfect:            'audio218',
  mine_explosion:         'audio499',
  overdrive_activate:     'audio205',
  remix_stem:             'audio637',
  powerup_t1:             'audio417',
  powerup_t2:             'audio580',
  powerup_t3:             'audio420',
  tunnel_transition:      'audio207',
  'continue?':            'continue?',
  countdown:              'countdown',
  gameover_countdown:     'gameover_countdown',
  outof_continues:        'outof_continues',
  perfect:                'perfect',
  results:                'results',
  resuts2:                'resuts2',
  select_high_short:      'select_high_short',
  select_start_song:      'select_start_song',
  song_completion:        'song_completion',
  locked_out:             'locked_out',
  not_enough:             'not_enough',
  error:                  'error',
  hidden_secret_found:    'hidden_secret_found',
  new_modes_available:    'new_modes_available',
  pause:                  'pause',
  pause_2:                'pause_2',
  intro:                  'intro',
  intro_2:                'intro_2',
  intro3:                 'intro3',
  cas_slam_down:          'cas_slam_down',
  case_open_2:            'case_open_2',
  open_basic:             'open_basic',
  open_basic_2:           'open_basic_2',
  open_case:              'open_case',
  by_th3scr1b3:           'by_th3scr1b3',
  inbetween:              'inbetween',
  crowd:                  'crowd',
  month_3:                'month_3',
  menu_confirm:           'select_high_short',
  targeted:               'select_high_short',
  upgrade:                'fusion',
  miss:                   'not_enough',
};

// ── Preload list ───────────────────────────────────────────────────────────
// Everything used during active gameplay must be here — latency-sensitive.
const PRELOAD_LIST: SfxName[] = [
  // Navigation / UI
  'back',
  'tap_nav',
  'pause',
  'pause_2',
  // Gameplay
  'countdown',
  'rewind',
  'gmeover',
  'outof_continues',
  'gameover_countdown',
  'song_completion',
  'select_start_song',
  'hidden_secret_found',
  'fusion',
  'perfect',
  'swipe',
  'tap_perfect',
  'mine_explosion',
  'overdrive_activate',
  'remix_stem',
  'powerup_t1',
  'powerup_t2',
  'powerup_t3',
  'tunnel_transition',
  'inbetween',
  // Results
  'reveal',
  'open_chest',
  'bing_before_platinum',
  'queue_before_mythic',
  'gold_get',
  'silver_get',
  'bronxe_get',
  'platinum_get',
];

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private preloaded = false;
  private activeSources: Map<SfxName, AudioBufferSourceNode[]> = new Map();

  // ── lifecycle ──────────────────────────────────────────────────

  /** Lazy-init the AudioContext. Safe to call multiple times. */
  async init(): Promise<void> {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      try {
        this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
      } catch {
        this.ctx = new AudioContextClass();
      }
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  /** Ensure AudioContext is ready (call on first user gesture). */
  async ensureReady(): Promise<void> {
    await this.init();
  }

  isReady(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  // ── loading ────────────────────────────────────────────────────

  /**
   * Load a single SFX by canonical name into the buffer cache.
   * De-duplicates concurrent requests for the same file.
   */
  async loadSfx(name: SfxName): Promise<void> {
    if (name === 'rewind') {
      await Promise.all(REWIND_TRACKS.map(f => this._loadSingleSfx(f)));
      return;
    }
    const filename = SFX_FILES[name] ?? name;
    await this._loadSingleSfx(filename);
  }

  private async _loadSingleSfx(filename: string): Promise<void> {
    if (this.bufferCache.has(filename)) return;
    if (this.loadingPromises.has(filename)) return this.loadingPromises.get(filename)!;

    if (!this.ctx) await this.init();

    const promise = (async () => {
      const url = `/audio/sfx/${encodeURIComponent(filename)}.wav`;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`SFX 404: ${url}`);
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          this.ctx!.decodeAudioData(
            arrayBuffer,
            (buf) => resolve(buf),
            (err) => reject(err)
          );
        });
        this.bufferCache.set(filename, audioBuffer);
      } catch (err) {
        console.warn(`Failed to load sfx "${filename}" (${url}):`, err);
      } finally {
        this.loadingPromises.delete(filename);
      }
    })();

    this.loadingPromises.set(filename, promise);
    return promise;
  }

  /**
   * Bulk-preload every gameplay SFX.
   * Call once after the first user interaction (e.g. on Home page click).
   */
  async preloadAll(): Promise<void> {
    if (this.preloaded) return;
    this.preloaded = true;
    await this.init();
    await Promise.allSettled(PRELOAD_LIST.map((n) => this.loadSfx(n)));
  }

  // ── playback ───────────────────────────────────────────────────

  /**
   * Fire-and-forget SFX playback. If the buffer hasn't loaded yet,
   * the call is silently skipped (no audible delay, no error).
   */
  playSfx(name: SfxName, volume = 0.6): void {
    if (!this.ctx || !this.masterGain) return;
    if (typeof localStorage !== 'undefined' && localStorage.getItem("opt_sfxEnabled") === "false") return;
    let filename = SFX_FILES[name] ?? name;
    if (name === 'rewind') {
      filename = REWIND_TRACKS[nextRewindIdx % REWIND_TRACKS.length];
      nextRewindIdx++;
    }
    const buffer = this.bufferCache.get(filename);
    if (!buffer) return;

    // Resume if suspended (handles mobile after tab switch)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();

    // Lower sound FX volume by 20% (80% baseline) * sfxVolume setting
    const sfxVolSetting = typeof localStorage !== 'undefined' ? (parseFloat(localStorage.getItem("opt_sfxVolume") ?? "0.8") ?? 0.8) : 0.8;
    const sfxVolume = volume * 0.8 * sfxVolSetting;
    gain.gain.value = Math.max(0, Math.min(1, sfxVolume));
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(0);

    // Track sounds that need to be manually stopped via stopSfx
    if (name === "gameover_countdown" || name === "song_completion") {
      if (!this.activeSources.has(name)) {
        this.activeSources.set(name, []);
      }
      const sources = this.activeSources.get(name)!;
      sources.push(source);

      source.onended = () => {
        const active = this.activeSources.get(name);
        if (active) {
          const idx = active.indexOf(source);
          if (idx !== -1) {
            active.splice(idx, 1);
          }
        }
        // PERF: Disconnect nodes from audio graph to prevent GainNode accumulation
        try { source.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };
    } else {
      // PERF: Disconnect nodes when playback ends to prevent orphaned GainNode leak
      source.onended = () => {
        try { source.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };
    }
  }

  /** Stop all active playing nodes of a specific SFX name. */
  stopSfx(name: SfxName): void {
    const sources = this.activeSources.get(name);
    if (sources) {
      const toStop = [...sources];
      sources.length = 0;
      toStop.forEach((s) => {
        try {
          s.stop();
        } catch (e) {
          // ignore if already stopped or not started
        }
        try {
          s.disconnect();
        } catch {}
      });
    }
  }

  private activeRemixTimeout: number | null = null;
  public activeRemixEffect: string | null = null;

  /**
   * Triggers a temporary stem remix effect (e.g. isolating vocals, muting drums, boosting bass).
   */
  triggerRemixStemEffect(
    effectType: 'vocals_isolate' | 'drums_mute' | 'bass_boost' | 'lead_solo' = 'vocals_isolate',
    durationSec = 4.0
  ): string {
    this.playSfx('remix_stem', 0.85);

    if (this.activeRemixTimeout) {
      window.clearTimeout(this.activeRemixTimeout);
    }

    this.activeRemixEffect = effectType;

    this.activeRemixTimeout = window.setTimeout(() => {
      this.activeRemixEffect = null;
      this.activeRemixTimeout = null;
    }, durationSec * 1000);

    return effectType;
  }

  private activeHoldTones: Map<string | number, {
    osc: OscillatorNode;
    gain: GainNode;
    filter: BiquadFilterNode;
    baseFreq: number;
  }> = new Map();

  // ── Healing Solfeggio & 432 Hz Harmonic Low-Octave Frequencies ──
  // Lane 0: 108.0 Hz (Sacred 108 / 432 Hz Sub-Octave A2 / Earth Grounding)
  // Lane 1: 132.0 Hz (528 Hz Solfeggio "Miracle / DNA Repair" Sub-Octave C3)
  // Lane 2: 162.0 Hz (Harmonic Golden Fifth of 108 Hz in 432 Hz tuning / E3)
  public static readonly HEALING_LANE_FREQUENCIES: number[] = [108.0, 132.0, 162.0];

  // ── 3-Band Crossover Subsystem (PIM Spec) ────────────────────────
  // Lane 0 (Bass): Lowpass 300Hz, Q: 0.8
  // Lane 1 (Mids): Bandpass 1200Hz, Q: 0.7
  // Lane 2 (Treble): Highpass 3200Hz, Q: 0.8
  public static readonly CROSSOVER_BAND_DEFS: { type: BiquadFilterType; freq: number; Q: number }[] = [
    { type: 'lowpass', freq: 300, Q: 0.8 },
    { type: 'bandpass', freq: 1200, Q: 0.7 },
    { type: 'highpass', freq: 3200, Q: 0.8 },
  ];

  private crossoverFilters: BiquadFilterNode[] = [];
  private crossoverGains: GainNode[] = [];
  private crossoverSilenced: boolean[] = [false, false, false];
  private crossoverRestoreTimers: (number | null)[] = [null, null, null];

  /**
   * Set up the 3-band crossover filter graph from an audio source node.
   * Routes Source -> [LP 300Hz, BP 1200Hz, HP 3200Hz] -> [Lane 0 Gain, Lane 1 Gain, Lane 2 Gain] -> Destination.
   */
  create3BandCrossover(
    source: AudioNode,
    destination?: AudioNode
  ): { filters: BiquadFilterNode[]; gains: GainNode[]; cleanup: () => void } {
    if (!this.ctx) throw new Error('AudioContext not initialized');
    const dest = destination || this.masterGain || this.ctx.destination;

    this.cleanup3BandCrossover();

    const filters: BiquadFilterNode[] = [];
    const gains: GainNode[] = [];

    AudioManager.CROSSOVER_BAND_DEFS.forEach(({ type, freq, Q }) => {
      const filter = this.ctx!.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = Q;
      filters.push(filter);

      const gain = this.ctx!.createGain();
      gain.gain.value = 1.0;
      gains.push(gain);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
    });

    this.crossoverFilters = filters;
    this.crossoverGains = gains;
    this.crossoverSilenced = [false, false, false];

    return {
      filters,
      gains,
      cleanup: () => this.cleanup3BandCrossover(),
    };
  }

  /** Mute a crossover lane on miss: drops gain to 0.04 over 0.12s with 3.5s auto-recovery ramp */
  muteCrossoverLane(lane: number, targetGain = 1.0): void {
    if (!this.ctx || !this.crossoverGains[lane] || this.crossoverSilenced[lane]) return;
    const gainNode = this.crossoverGains[lane];
    this.crossoverSilenced[lane] = true;

    gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.12);

    if (this.crossoverRestoreTimers[lane] !== null) {
      window.clearTimeout(this.crossoverRestoreTimers[lane]!);
    }

    this.crossoverRestoreTimers[lane] = window.setTimeout(() => {
      this.crossoverSilenced[lane] = false;
      this.crossoverRestoreTimers[lane] = null;
      if (!this.ctx || !this.crossoverGains[lane]) return;
      const g = this.crossoverGains[lane];
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.4);
    }, 3500);
  }

  /** Active restore of a crossover lane on hit: ramps gain to target over 0.25s */
  restoreCrossoverLane(lane: number, targetGain = 1.0): void {
    if (!this.crossoverSilenced[lane] || !this.ctx || !this.crossoverGains[lane]) return;
    this.crossoverSilenced[lane] = false;

    if (this.crossoverRestoreTimers[lane] !== null) {
      window.clearTimeout(this.crossoverRestoreTimers[lane]!);
      this.crossoverRestoreTimers[lane] = null;
    }

    const gainNode = this.crossoverGains[lane];
    gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.25);
  }

  /** Clean up crossover nodes and cancel timers */
  cleanup3BandCrossover(): void {
    this.crossoverRestoreTimers.forEach((timer) => {
      if (timer !== null) window.clearTimeout(timer);
    });
    this.crossoverRestoreTimers = [null, null, null];
    this.crossoverSilenced = [false, false, false];

    this.crossoverGains.forEach((g) => {
      try { g.disconnect(); } catch {}
    });
    this.crossoverFilters.forEach((f) => {
      try { f.disconnect(); } catch {}
    });
    this.crossoverGains = [];
    this.crossoverFilters = [];
  }

  /** Start a warm, therapeutic healing frequency tone in the lower octave for an active hold note */
  startHoldTone(noteId: string | number, laneOrFreq: number = 0, volume = 0.12): void {
    if (!this.ctx || !this.masterGain) return;
    if (typeof localStorage !== 'undefined' && localStorage.getItem("opt_sfxEnabled") === "false") return;
    if (this.activeHoldTones.has(noteId)) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    try {
      // Resolve to lower-octave healing frequency (108Hz, 132Hz, 162Hz)
      let baseFreq: number;
      if (laneOrFreq >= 0 && laneOrFreq < AudioManager.HEALING_LANE_FREQUENCIES.length) {
        baseFreq = AudioManager.HEALING_LANE_FREQUENCIES[laneOrFreq];
      } else if (laneOrFreq >= 50 && laneOrFreq <= 300) {
        // If an absolute frequency was passed, normalize to warm lower octave (54 - 174 Hz)
        baseFreq = laneOrFreq > 180 ? laneOrFreq / 2 : laneOrFreq;
      } else {
        baseFreq = 108.0;
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Pure therapeutic sine wave for soothing warmth without ear-piercing harmonics
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

      // Warm analog lowpass filter (gentle Butterworth damping, no sharp resonance peaks)
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, this.ctx.currentTime);
      filter.Q.setValueAtTime(0.707, this.ctx.currentTime);

      const sfxVolSetting = typeof localStorage !== 'undefined' ? (parseFloat(localStorage.getItem("opt_sfxVolume") ?? "0.8") ?? 0.8) : 0.8;
      const targetVol = volume * 0.75 * sfxVolSetting;

      // Soft non-jarring attack envelope
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, Math.min(0.4, targetVol)), now + 0.06);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);

      this.activeHoldTones.set(noteId, { osc, gain, filter, baseFreq });
    } catch (e) {
      console.warn("Failed to start hold tone:", e);
    }
  }

  /** Update subtle harmonic bloom of active healing tone as hold progresses (0 -> 1) */
  updateHoldTone(noteId: string | number, progress: number): void {
    if (!this.ctx) return;
    const tone = this.activeHoldTones.get(noteId);
    if (!tone) return;

    try {
      const clampedProg = Math.max(0, Math.min(1, progress));
      // Keep fundamental frequency steady on healing root; gently open filter for warm harmonic bloom
      tone.osc.frequency.value = tone.baseFreq;
      tone.filter.frequency.value = 320 + clampedProg * 160;
    } catch {}
  }

  /** Stop active hold tone with a soft, clean decay */
  stopHoldTone(noteId: string | number): void {
    if (!this.ctx) return;
    const tone = this.activeHoldTones.get(noteId);
    if (!tone) return;

    this.activeHoldTones.delete(noteId);

    try {
      const now = this.ctx.currentTime;
      const stopTime = now + 0.06;
      // Soft exponential release to prevent clicks
      tone.gain.gain.setTargetAtTime(0.0001, now, 0.02);
      tone.osc.stop(stopTime);
      // Clean up Web Audio nodes after stop
      tone.osc.onended = () => {
        try {
          tone.osc.disconnect();
          tone.filter.disconnect();
          tone.gain.disconnect();
        } catch {}
      };
      // Fallback timer to disconnect nodes if onended does not fire
      window.setTimeout(() => {
        try {
          tone.osc.disconnect();
          tone.filter.disconnect();
          tone.gain.disconnect();
        } catch {}
      }, 100);
    } catch {
      try {
        tone.osc.stop();
        tone.osc.disconnect();
        tone.filter.disconnect();
        tone.gain.disconnect();
      } catch {}
    }
  }

  /** Stop all active hold tones immediately with zero lingering oscillators */
  stopAllHoldTones(): void {
    if (!this.ctx) return;
    // Snapshot keys first to avoid Map mutation while iterating
    const toneIds = Array.from(this.activeHoldTones.keys());
    for (const id of toneIds) {
      this.stopHoldTone(id);
    }
    // Safety net: ensure any lingering nodes in the map are immediately stopped & disconnected
    this.activeHoldTones.forEach((tone) => {
      try {
        tone.osc.stop();
        tone.osc.disconnect();
        tone.filter.disconnect();
        tone.gain.disconnect();
      } catch {}
    });
    this.activeHoldTones.clear();
  }

  // ── teardown ───────────────────────────────────────────────────

  stop(): void {
    this.stopAllHoldTones();
    this.cleanup3BandCrossover();
    if (this.activeRemixTimeout) {
      window.clearTimeout(this.activeRemixTimeout);
      this.activeRemixTimeout = null;
    }
    this.activeRemixEffect = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }
}

export const audioManager = new AudioManager();
export const HEALING_LANE_FREQUENCIES: number[] = [108.0, 132.0, 162.0];
export default audioManager;
