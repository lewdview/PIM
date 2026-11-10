// Note skins per HUD style. Each HUD draws its own notes: Neon Reel → glow bars (neonNotes),
// Poetic GUI → ink on paper slips (inkNotes), Console Rail → LED chips (railNotes). Beta keeps
// the original renderer in GameplayCore.drawKey, so it has no skin here.

import type { Note, NoteType } from '../../game/types';
import type { HudStyle } from '../../lib/options';
import { drawNeonKey } from './neonNotes';
import { drawInkKey } from './inkNotes';
import { drawRailKey } from './railNotes';

type SkinFn = (
  ctx: CanvasRenderingContext2D,
  noteW: number,
  noteH: number,
  laneColor: string,
  prog: number,
  isHold: boolean,
  swipeDirection: Note['swipeDirection'] | undefined,
  noteType: NoteType | undefined,
  timeOffset?: number,
) => boolean;

const SKINS: Partial<Record<HudStyle, SkinFn>> = {
  neon: drawNeonKey,
  stanza: drawInkKey,
  console: drawRailKey,
};

let active: SkinFn | null = null;

/** GameplayCore calls this whenever the HUD style changes (null on unmount). */
export function setNoteSkin(style: HudStyle | null | undefined) {
  active = (style && SKINS[style]) || null;
}

/** Draws the note with the active skin. False when the HUD uses the original renderer. */
export const drawSkinnedKey: SkinFn = (...args) => (active ? active(...args) : false);
