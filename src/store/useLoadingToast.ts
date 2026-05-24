import { create } from 'zustand';

// ═══════════════════════════════════════════════════════════════
// Global Loading Toast — Shows a small bottom-center indicator
// whenever the app is waiting on a database call, audio load, etc.
// ═══════════════════════════════════════════════════════════════

interface LoadingToastState {
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
}

export const useLoadingToast = create<LoadingToastState>((set) => ({
  message: null,
  show: (message: string) => set({ message }),
  hide: () => set({ message: null }),
}));
