/**
 * Safe haptic feedback wrapper using navigator.vibrate.
 * Gracefully ignores platforms that do not support haptics (like iOS Safari or desktop browsers).
 */
export const haptics = {
  vibrate: (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      // Check if user has activated the document (required for vibration)
      const hasActivation = typeof navigator.userActivation !== 'undefined'
        ? navigator.userActivation.hasBeenActive
        : true; // fallback for older browsers

      if (hasActivation) {
        try {
          navigator.vibrate(pattern);
        } catch (e) {
          // Ignore errors (e.g. security blocks or permission issues in some frames)
        }
      }
    }
  },

  // Single short tap for standard UI interactions (button clicks, card selection, etc.)
  lightTap: () => {
    haptics.vibrate(15);
  },

  mediumTap: () => {
    haptics.vibrate(35);
  },

  heavyTap: () => {
    haptics.vibrate(60);
  },

  // Double tap for swipes
  doubleTap: () => {
    haptics.vibrate([15, 30, 15]);
  },

  // Long buzz for errors, misses, or failures
  error: () => {
    haptics.vibrate(140);
  },

  // Succession of pulses for fusions/pack openings (crescendo effect)
  fusionProgress: () => {
    haptics.vibrate([20, 20, 30, 20, 40, 20, 50]);
  },

  fusionSuccess: () => {
    haptics.vibrate([15, 40, 15, 40, 90]);
  },

  packReveal: () => {
    haptics.vibrate([30, 40, 50, 60, 70]);
  },

  cardFlip: () => {
    haptics.vibrate(25);
  }
};
