import { create } from 'zustand';

// ═══════════════════════════════════════════════════════════════
// Display Mode Store — 4K HDR toggle
// Persisted to localStorage. When enabled, applies 'ultra-hd'
// class to <html> which triggers CSS overrides for wider layouts,
// P3 color gamut, enhanced glows, and larger card rendering.
// ═══════════════════════════════════════════════════════════════

interface DisplayModeState {
  is4K: boolean;
  isCapable: boolean; // can the display do 4K + wide gamut?
  toggle: () => void;
  detectCapability: () => void;
}

const STORAGE_KEY = 'th3vault-4k-mode';

function applyMode(enabled: boolean) {
  if (enabled) {
    document.documentElement.classList.add('ultra-hd');
  } else {
    document.documentElement.classList.remove('ultra-hd');
  }
}

export const useDisplayMode = create<DisplayModeState>((set, get) => {
  // Restore from localStorage on init
  const stored = localStorage.getItem(STORAGE_KEY);
  const initial = stored === 'true';
  // Apply immediately (before first render)
  if (typeof document !== 'undefined') applyMode(initial);

  return {
    is4K: initial,
    isCapable: false,

    toggle: () => {
      const next = !get().is4K;
      localStorage.setItem(STORAGE_KEY, String(next));
      applyMode(next);
      set({ is4K: next });
    },

    detectCapability: () => {
      if (typeof window === 'undefined') return;
      const w = window.screen.width * (window.devicePixelRatio || 1);
      const h = window.screen.height * (window.devicePixelRatio || 1);
      const is4KRes = Math.max(w, h) >= 3840;
      const hasWideGamut = window.matchMedia('(color-gamut: p3)').matches;
      const hasHDR = window.matchMedia('(dynamic-range: high)').matches;
      set({ isCapable: is4KRes || hasWideGamut || hasHDR });
    },
  };
});
