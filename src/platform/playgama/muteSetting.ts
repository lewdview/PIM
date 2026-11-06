// The player's own mute switch for monthly builds. One shared value, so the
// floating button on menus and the button inside each in-song HUD stay in step.

import { useSyncExternalStore } from 'react';
import { setGate } from './audioGate';

const MUTE_KEY = 'pg_muted';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

let muted = read();
setGate('user', muted);

export function setMuted(next: boolean): void {
  if (next === muted) return;
  muted = next;
  setGate('user', muted);
  try {
    localStorage.setItem(MUTE_KEY, String(muted));
  } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
}

export function useMuted(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => muted,
  );
  return [value, setMuted];
}
