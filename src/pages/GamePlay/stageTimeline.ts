import type { Stage } from '../../game/api';

/** Legacy fixed split, used when a chart carries no usable stage table. */
export const DEFAULT_STAGE_PCTS = [0, 0.15, 0.35, 0.6, 0.8];

/**
 * Stage start times (s) for a song. Charts that place their own stages
 * (e.g. Chart Master v6, which puts stage 3 / 5 on the song's drops so the
 * POV switch lands on the music) are honoured; anything missing or
 * malformed falls back to the fixed percentage split.
 */
export function getStageStarts(song: { duration: number; stages?: Stage[] } | null | undefined): number[] {
  const dur = song?.duration || 180;
  const st = song?.stages;
  if (Array.isArray(st) && st.length === 5) {
    const starts = [...st].sort((a, b) => a.stage - b.stage).map((s) => s.startTime);
    const valid = starts.every(
      (t, i) => Number.isFinite(t) && t >= 0 && t < dur && (i === 0 || t > starts[i - 1]),
    );
    if (valid) return starts;
  }
  return DEFAULT_STAGE_PCTS.map((p) => p * dur);
}

/** 1-based stage at time t. */
export function stageAtTime(starts: number[], t: number): number {
  let stage = 1;
  for (let i = 1; i < starts.length; i++) if (t >= starts[i]) stage = i + 1;
  return stage;
}
