import type { TrackArchetype } from './archetypes';
import type { Note } from '@/game/types';
import { HW_TOP, HW_BOT, LANE_COUNT, HIT_RATIO } from './constants';

export interface StageGeometry {
  stageW: number;
  botWidth: number;
  topWidth: number;
  laneW: number;
  hitY: number;
  btnH: number;
  btnY: number;
  targetNoteH: number;
  isLandscape: boolean;
  isTabletPortrait: boolean;
}


export function getStageGeometry(W: number, H: number): StageGeometry {
  const isLandscape = W > H * 0.88;
  const isTabletPortrait = !isLandscape && W > 640;

  let stageW: number;
  let btnH: number;
  let hitY: number;

  if (isLandscape) {
    // Desktop / Landscape: golden ratio arcade column centered with wide wings
    stageW = Math.min(W * 0.88, Math.max(500, Math.min(680, Math.round(H * 0.68))));
    btnH = Math.min(135, Math.max(90, Math.round(H * 0.14)));
    hitY = H - Math.round(btnH * 0.72);
  } else if (isTabletPortrait) {
    // iPad / Tablet portrait: 90% width or capped at 680px, button height capped to 185px
    stageW = Math.min(W * 0.90, 680);
    btnH = Math.min(185, Math.max(130, Math.round(H * 0.17)));
    hitY = H - Math.round(btnH * 0.65);
  } else {
    // Phone / Mobile portrait: edge-to-edge highway (W), authentic mobile strike zone
    stageW = W;
    hitY = Math.round(H * HIT_RATIO);
    btnH = H - hitY;
  }

  const botWidth = stageW * HW_BOT;
  const topWidth = stageW * HW_TOP;
  const laneW = botWidth / LANE_COUNT;
  const btnY = hitY - Math.round(btnH / 2);
  // Authentic Beatstar piano-tile aspect ratio: tall, substantial key notes (target ~88% of lane width, clamped 90px - 140px)
  const targetNoteH = Math.max(90, Math.min(140, Math.round(laneW * 0.88)));

  return {
    stageW,
    botWidth,
    topWidth,
    laneW,
    hitY,
    btnH,
    btnY,
    targetNoteH,
    isLandscape,
    isTabletPortrait,
  };
}


export function approachTime(diffLevel: number): number {
  return Math.max(1.35, 2.5 - (diffLevel - 1) * 0.128);
}


export function hwAtProgress(p: number, W: number, topRatio: number = HW_TOP, botRatio: number = HW_BOT, H?: number) {
  const stageW = H
    ? getStageGeometry(W, H).stageW
    : (typeof window !== 'undefined' && window.innerHeight > 0
        ? getStageGeometry(W, window.innerHeight).stageW
        : (W > 640 ? Math.min(W * 0.88, 680) : W));
  const w = stageW * lerp(topRatio, botRatio, p);
  const l = (W - w) / 2;
  return { left: l, right: l + w, width: w };
}


export function laneAt(
  lane: number,
  progress: number,
  W: number,
  topRatio: number = HW_TOP,
  botRatio: number = HW_BOT,
  archetype?: TrackArchetype,
  stage: number = 1,
  t: number = 0,
  H?: number
) {
  const effectiveH = H ?? (typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : undefined);
  const { left, width } = hwAtProgress(progress, W, topRatio, botRatio, effectiveH);
  const lw = width / LANE_COUNT;
  let baseX = left + lane * lw;

  // Apply track archetype motion geometry ONLY during Stage 3 and Stage 5
  if (archetype && (stage === 3 || stage === 5)) {
    if (archetype === 'matrix_split') {
      const stageW = effectiveH ? getStageGeometry(W, effectiveH).stageW : width;
      const spread = (lane - 1) * (stageW * 0.15 * Math.sin(progress * Math.PI));
      baseX += spread;
    }
  }

  return { x: baseX, w: lw };
}


export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}


export function formatTimeSec(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}


export function isDirectionMatch(reqDir?: Note['swipeDirection'], actualDir?: Note['swipeDirection']): boolean {
  if (!reqDir || !actualDir) return true;
  if (reqDir === actualDir) return true;
  if (reqDir === 'up') return actualDir === 'up-left' || actualDir === 'up-right';
  if (reqDir === 'down') return actualDir === 'down-left' || actualDir === 'down-right';
  if (reqDir === 'left') return actualDir === 'up-left' || actualDir === 'down-left';
  if (reqDir === 'right') return actualDir === 'up-right' || actualDir === 'down-right';
  if (actualDir === 'up') return reqDir === 'up-left' || reqDir === 'up-right';
  if (actualDir === 'down') return reqDir === 'down-left' || reqDir === 'down-right';
  if (actualDir === 'left') return reqDir === 'up-left' || reqDir === 'down-left';
  if (actualDir === 'right') return reqDir === 'up-right' || reqDir === 'down-right';
  return false;
}
