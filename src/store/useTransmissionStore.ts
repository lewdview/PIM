import { create } from 'zustand';

export type TransmissionType = 'info' | 'success' | 'warning' | 'error' | 'loot' | 'telemetry';

export interface HUDToast {
  id: string;
  type: TransmissionType;
  title: string;
  message?: string;
  accentColor?: string;
  duration?: number; // ms, defaults to 4500ms. <= 0 means manual dismiss only
  badgeText?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  created_at: number;
}

export type ToastInput = Omit<HUDToast, 'id' | 'created_at'> & {
  id?: string;
};

interface TransmissionState {
  toasts: HUDToast[];
  addToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const DEFAULT_DURATION = 4500;
const MAX_CONCURRENT_TOASTS = 4;

export const useTransmissionStore = create<TransmissionState>((set, get) => ({
  toasts: [],

  addToast: (input: ToastInput) => {
    const id = input.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const duration = input.duration !== undefined ? input.duration : DEFAULT_DURATION;

    const newToast: HUDToast = {
      ...input,
      id,
      duration,
      created_at: Date.now(),
    };

    set((state) => {
      // Remove any existing toast with the same id
      const filtered = state.toasts.filter((t) => t.id !== id);
      // Keep only up to MAX_CONCURRENT_TOASTS - 1 to make room
      const bounded = filtered.slice(-(MAX_CONCURRENT_TOASTS - 1));
      return { toasts: [...bounded, newToast] };
    });

    if (duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }

    return id;
  },

  dismissToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

/**
 * Convenient procedural interface for triggering HUD transmissions from anywhere
 */
export const transmission = {
  info: (title: string, message?: string, options?: Partial<ToastInput>) =>
    useTransmissionStore.getState().addToast({
      type: 'info',
      title,
      message,
      accentColor: '#00e5ff',
      badgeText: 'SIGNAL',
      ...options,
    }),

  success: (title: string, message?: string, options?: Partial<ToastInput>) =>
    useTransmissionStore.getState().addToast({
      type: 'success',
      title,
      message,
      accentColor: '#39ff14',
      badgeText: 'CONFIRMED',
      ...options,
    }),

  warning: (title: string, message?: string, options?: Partial<ToastInput>) =>
    useTransmissionStore.getState().addToast({
      type: 'warning',
      title,
      message,
      accentColor: '#ff5500',
      badgeText: 'ALERT',
      ...options,
    }),

  error: (title: string, message?: string, options?: Partial<ToastInput>) =>
    useTransmissionStore.getState().addToast({
      type: 'error',
      title,
      message,
      accentColor: '#ff3800',
      badgeText: 'DESYNC',
      duration: 6000,
      ...options,
    }),

  loot: (title: string, message?: string, options?: Partial<ToastInput>) =>
    useTransmissionStore.getState().addToast({
      type: 'loot',
      title,
      message,
      accentColor: '#e5b800',
      badgeText: 'VAULT_SECURED',
      duration: 5500,
      ...options,
    }),

  telemetry: (title: string, message?: string, options?: Partial<ToastInput>) =>
    useTransmissionStore.getState().addToast({
      type: 'telemetry',
      title,
      message,
      accentColor: '#ff1493',
      badgeText: 'TRANSMISSION',
      duration: 4000,
      ...options,
    }),
};
