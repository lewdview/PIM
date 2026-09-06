/**
 * Safe multi-driver haptic feedback engine for PIM : th3v4ult
 *
 * Supported Drivers:
 *  1. Native iOS Taptic Engine via HTML5 switch checkbox trigger (<input type="checkbox" switch>)
 *  2. Standard Mobile Web Vibration API (navigator.vibrate) tuned for hardware thresholds (>= 35ms)
 *  3. Gamepad Haptic Actuators (dual-rumble on PlayStation, Xbox, Switch Pro, Steam Deck controllers)
 *  4. Sub-Acoustic Tactile Impulse Synthesizer (Web Audio 55Hz mechanical transient fallback for desktop)
 */

export interface HapticOptions {
  weakMagnitude?: number;
  strongMagnitude?: number;
  audioTactile?: boolean;
}

// Global state for lazily created drivers
let iosSwitchLabel: HTMLElement | null = null;
let iosSwitchInput: HTMLInputElement | null = null;
let iosSwitchScheduledTimers: number[] = [];

let audioTactileCtx: AudioContext | null = null;

/**
 * Safely checks if user has enabled haptics in application settings
 */
function isHapticsEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('opt_haptics') !== 'false';
    }
  } catch {
    // Fallback gracefully if storage access is restricted (e.g. sandboxed iframes)
  }
  return true;
}

/**
 * Detects if the current platform is iOS / iPadOS
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  return isAppleMobile || isIPadOS;
}

/**
 * Ensures the hidden DOM elements required for iOS Taptic Engine triggering exist
 */
function ensureIOSTapticDOM(): boolean {
  if (typeof document === 'undefined') return false;
  if (iosSwitchLabel && iosSwitchInput) return true;

  try {
    const existingLabel = document.getElementById('pim-taptic-label');
    const existingInput = document.getElementById('pim-taptic-switch') as HTMLInputElement | null;

    if (existingLabel && existingInput) {
      iosSwitchLabel = existingLabel;
      iosSwitchInput = existingInput;
      return true;
    }

    const label = document.createElement('label');
    label.id = 'pim-taptic-label';
    label.setAttribute('for', 'pim-taptic-switch');
    label.setAttribute('aria-hidden', 'true');
    Object.assign(label.style, {
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1',
      clip: 'rect(0 0 0 0)',
      clipPath: 'inset(50%)'
    });

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.id = 'pim-taptic-switch';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    Object.assign(input.style, {
      position: 'absolute',
      opacity: '0',
      pointerEvents: 'none'
    });

    label.appendChild(input);
    document.body.appendChild(label);

    iosSwitchLabel = label;
    iosSwitchInput = input;
    return true;
  } catch {
    return false;
  }
}

/**
 * Pulses the iOS switch element to fire Apple's native Taptic Engine
 */
function pulseIOSTaptic(): void {
  if (!ensureIOSTapticDOM() || !iosSwitchLabel) return;
  try {
    iosSwitchLabel.click();
  } catch {
    // Graceful no-op if blocked
  }
}

/**
 * Triggers haptic vibration across all connected gamepads
 */
function pulseGamepads(durationMs: number, weakMagnitude: number, strongMagnitude: number): void {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
  try {
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;

      // Modern Gamepad API Haptic Actuator (dual-rumble)
      const actuator = (gp as any).vibrationActuator;
      if (actuator && typeof actuator.playEffect === 'function') {
        actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: Math.max(20, Math.min(500, durationMs)),
          weakMagnitude: Math.max(0, Math.min(1, weakMagnitude)),
          strongMagnitude: Math.max(0, Math.min(1, strongMagnitude))
        }).catch(() => {});
      } else if ((gp as any).hapticActuators && (gp as any).hapticActuators.length > 0) {
        // Legacy Gamepad hapticActuators
        const legacyActuator = (gp as any).hapticActuators[0];
        if (typeof legacyActuator?.pulse === 'function') {
          legacyActuator.pulse(strongMagnitude, durationMs).catch(() => {});
        }
      }
    }
  } catch {
    // Ignore gamepad errors
  }
}

/**
 * Generates an ultra-fast, snappy acoustic tactile impulse using Web Audio.
 * Simulates a subtle 55Hz mechanical thud (perceived as a tactile click on headphones/speakers).
 */
function playAcousticTactile(intensity = 0.5): void {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;

    if (!audioTactileCtx || audioTactileCtx.state === 'closed') {
      audioTactileCtx = new AudioCtxClass();
    }
    if (audioTactileCtx.state === 'suspended') {
      audioTactileCtx.resume().catch(() => {});
    }

    const ctx = audioTactileCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Low-frequency tactile micro-drop: 85Hz down to 35Hz
    osc.type = 'sine';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.025);

    // Rapid exponential envelope (30ms total length)
    const peakGain = Math.min(0.25, 0.08 * intensity);
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  } catch {
    // Ignore audio errors
  }
}

/**
 * Schedules a multi-pulse sequence for the iOS Taptic Engine
 */
function scheduleIOSTapticSequence(pattern: number[]): void {
  // Clear any existing pending timers
  for (const timer of iosSwitchScheduledTimers) {
    clearTimeout(timer);
  }
  iosSwitchScheduledTimers = [];

  let accumulatedDelay = 0;
  for (let i = 0; i < pattern.length; i++) {
    const duration = pattern[i];
    if (i % 2 === 0) {
      // Vibration pulse
      if (accumulatedDelay === 0) {
        pulseIOSTaptic();
      } else {
        const timerId = window.setTimeout(() => {
          pulseIOSTaptic();
        }, accumulatedDelay);
        iosSwitchScheduledTimers.push(timerId);
      }
      accumulatedDelay += duration;
    } else {
      // Pause
      accumulatedDelay += duration;
    }
  }
}

export const haptics = {
  /**
   * Main vibration dispatch with multi-driver resolution.
   * Pattern can be a single duration (ms) or an array [vibrate, pause, vibrate, ...].
   */
  vibrate: (pattern: number | number[], options?: HapticOptions) => {
    if (!isHapticsEnabled()) return;

    const patternArray = Array.isArray(pattern) ? pattern : [pattern];
    const totalDuration = patternArray.reduce((sum, val) => sum + val, 0);
    const firstDuration = patternArray[0] || 35;

    let physicalHardwareTriggered = false;

    // ── Driver 1: Gamepad Haptic Actuator ──
    const weakMag = options?.weakMagnitude ?? (firstDuration > 60 ? 0.8 : 0.4);
    const strongMag = options?.strongMagnitude ?? (firstDuration > 60 ? 0.9 : 0.6);
    pulseGamepads(totalDuration, weakMag, strongMag);

    // ── Driver 2: iOS Native Taptic Engine ──
    if (isIOS()) {
      if (patternArray.length === 1) {
        pulseIOSTaptic();
      } else {
        scheduleIOSTapticSequence(patternArray);
      }
      physicalHardwareTriggered = true;
    }

    // ── Driver 3: Standard Web Vibration API (Android & Supported Browsers) ──
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        const success = navigator.vibrate(pattern);
        if (success) {
          physicalHardwareTriggered = true;
        }
      } catch {
        // Fallback silently if blocked by security policies
      }
    }

    // ── Driver 4: Audio-Tactile Impulse Fallback ──
    // If no physical vibration hardware was triggered (e.g. desktop web with no controller),
    // or if audioTactile is explicitly enabled, emit an acoustic micro-thud.
    if (!physicalHardwareTriggered || options?.audioTactile) {
      playAcousticTactile(options?.strongMagnitude ?? (firstDuration / 100));
    }
  },

  /**
   * Single short tap for standard UI interactions (button clicks, card selection, etc.)
   * Tuned to 35ms (surpasses Android 25ms hardware threshold).
   */
  lightTap: () => {
    haptics.vibrate(35, { weakMagnitude: 0.3, strongMagnitude: 0.4 });
  },

  /**
   * Medium tap for note judgments (PERFECT, slide heads, navigation).
   */
  mediumTap: () => {
    haptics.vibrate(55, { weakMagnitude: 0.6, strongMagnitude: 0.7 });
  },

  /**
   * Heavy tap for PERFECT+, mines, overdrive activation, or boss hits.
   */
  heavyTap: () => {
    haptics.vibrate(90, { weakMagnitude: 0.85, strongMagnitude: 1.0 });
  },

  /**
   * Double tap for directional swipes and flicks.
   */
  doubleTap: () => {
    haptics.vibrate([35, 45, 35], { weakMagnitude: 0.7, strongMagnitude: 0.8 });
  },

  /**
   * Long buzz or distinct stutter for errors, misses, or failures.
   */
  error: () => {
    haptics.vibrate([60, 40, 100], { weakMagnitude: 0.9, strongMagnitude: 0.9 });
  },

  /**
   * Succession of pulses for fusions/pack openings (crescendo effect).
   */
  fusionProgress: () => {
    haptics.vibrate([25, 25, 35, 25, 45, 25, 60], { weakMagnitude: 0.5, strongMagnitude: 0.75 });
  },

  /**
   * Success fanfare pattern.
   */
  fusionSuccess: () => {
    haptics.vibrate([30, 40, 30, 40, 110], { weakMagnitude: 0.8, strongMagnitude: 1.0 });
  },

  /**
   * Pack reveal sequence.
   */
  packReveal: () => {
    haptics.vibrate([35, 45, 55, 65, 90], { weakMagnitude: 0.6, strongMagnitude: 0.9 });
  },

  /**
   * Card flip click.
   */
  cardFlip: () => {
    haptics.vibrate(35, { weakMagnitude: 0.4, strongMagnitude: 0.5 });
  },

  /**
   * Cancel any active vibration and clear timers.
   */
  cancel: () => {
    for (const timer of iosSwitchScheduledTimers) {
      clearTimeout(timer);
    }
    iosSwitchScheduledTimers = [];

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  },

  /**
   * Test diagnostic trigger for OptionsModal.
   */
  test: (type: 'light' | 'medium' | 'heavy' | 'double' | 'error' = 'medium') => {
    switch (type) {
      case 'light':
        haptics.lightTap();
        break;
      case 'medium':
        haptics.mediumTap();
        break;
      case 'heavy':
        haptics.heavyTap();
        break;
      case 'double':
        haptics.doubleTap();
        break;
      case 'error':
        haptics.error();
        break;
      default:
        haptics.mediumTap();
    }
  },

  /**
   * Reports system haptics capabilities and active hardware drivers
   */
  getCapabilities: (): {
    enabled: boolean;
    hasVibrationApi: boolean;
    isIOS: boolean;
    hasGamepad: boolean;
    drivers: string[];
    primaryDriver: string;
  } => {
    const enabled = isHapticsEnabled();
    const hasVibrationApi = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    const isApple = isIOS();

    let hasGamepad = false;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      try {
        const gps = navigator.getGamepads();
        hasGamepad = Array.from(gps).some(gp => gp && ((gp as any).vibrationActuator || (gp as any).hapticActuators));
      } catch {}
    }

    const drivers: string[] = [];
    if (isApple) drivers.push('iOS Taptic Engine');
    if (hasVibrationApi) drivers.push('Vibration API');
    if (hasGamepad) drivers.push('Gamepad Dual-Rumble');
    drivers.push('Acoustic Tactile');

    const primaryDriver = isApple
      ? 'iOS Taptic Engine'
      : hasGamepad
      ? 'Gamepad Dual-Rumble'
      : hasVibrationApi
      ? 'Vibration API'
      : 'Acoustic Tactile';

    return {
      enabled,
      hasVibrationApi,
      isIOS: isApple,
      hasGamepad,
      drivers,
      primaryDriver
    };
  }
};
