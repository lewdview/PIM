/**
 * Desktop runtime bridge for PIM : th3v4ult
 * Safe for both browser web and native Tauri 2.0 desktop runtimes.
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: Record<string, unknown>;
  }
}

/**
 * Returns true if running inside the Tauri native desktop wrapper
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

/**
 * Returns true if running in desktop environment (Tauri or desktop browser user-agent)
 */
export function isDesktop(): boolean {
  if (isTauri()) return true;
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent.toLowerCase();
  return !/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
}

/**
 * Checks if running on Steam Deck (via User Agent or custom Steam flag)
 */
export function isSteamDeck(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('valve') || ua.includes('steamdeck') || ua.includes('jupiter');
}

/**
 * Safe invoke helper to call native Tauri Rust commands
 */
export async function invokeDesktopCommand<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!isTauri()) {
    // Graceful no-op fallback on web
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[DesktopBridge] Failed to invoke '${cmd}':`, err);
    return null;
  }
}

/**
 * Toggle Fullscreen mode on Desktop
 */
export async function toggleFullscreen(): Promise<boolean> {
  if (isTauri()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const isFull = await win.isFullscreen();
      await win.setFullscreen(!isFull);
      return !isFull;
    } catch (err) {
      console.warn('[DesktopBridge] Fullscreen toggle error:', err);
    }
  }

  // Fallback to standard Web Fullscreen API
  if (typeof document !== 'undefined') {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      return true;
    } else {
      await document.exitFullscreen?.();
      return false;
    }
  }
  return false;
}
