import { getStageGeometry, laneAt, lerp, type StageGeometry } from './geometry';
import { HW_TOP, HW_BOT } from './constants';
import type { TrackArchetype } from './archetypes';

export interface ProjectionResult {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  scale: number;
}


export function getCorkscrewSpiralPos(
  lane: number,
  prog: number,
  W: number,
  H: number,
  t: number,
  stage: number
): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vanishingY = hitY * 0.18;
  const cx = W / 2;
  const corkW = geom.stageW;
  const laneOffset = lane - 1; // -1 for left, 0 for center, 1 for right
  const mult = stage === 5 ? 1.6 : 1.0;
  const baseH = hitY - vanishingY;

  // ── Phase 1: Entry Plunge ($p: 0.00 \rightarrow 0.12$) ──
  // Fast plunge from vanishing horizon into top of the corkscrew tube
  if (prog < 0.12) {
    const u = prog / 0.12;
    const startX = cx + laneOffset * (corkW * 0.06);
    const startY = vanishingY;

    const entryAngle = t * 1.6 * mult;
    const entryRadiusX = corkW * 0.05;
    const entryRadiusY = H * 0.02;
    const entryX = cx + Math.cos(entryAngle) * entryRadiusX + laneOffset * 14;
    const entryY = vanishingY + baseH * 0.10 + Math.sin(entryAngle) * entryRadiusY;

    const noteX = lerp(startX, entryX, u);
    const noteY = lerp(startY, entryY, u);
    const noteW = lerp(geom.laneW * 0.30, geom.laneW * 0.48, u);
    const noteH = lerp(geom.targetNoteH * 0.30, geom.targetNoteH * 0.45, u);
    return { x: noteX - noteW / 2, y: noteY, w: noteW, h: noteH, rot: laneOffset * 0.05, scale: lerp(0.35, 0.52, u) };
  } 
  
  // ── Phase 2: Tight Helical 3D Spiral Loops ($p: 0.12 \rightarrow 0.48$) ──
  // Fast, tight 720° helical spin centered compactly in the upper middle tube
  else if (prog < 0.48) {
    const u = (prog - 0.12) / 0.36;
    const loopAngle = u * Math.PI * 4 + t * 1.6 * mult; // 2 complete 360° loops

    // Tightened horizontal radius (compact 3D tube)
    const helixRadiusX = lerp(corkW * 0.05, corkW * 0.15, u);
    const helixRadiusY = lerp(H * 0.02, H * 0.065, u);
    const centerY = lerp(vanishingY + baseH * 0.10, vanishingY + baseH * 0.42, u);

    const spiralX = cx + Math.cos(loopAngle) * helixRadiusX + laneOffset * 16 * Math.cos(loopAngle);
    const spiralY = centerY + Math.sin(loopAngle) * helixRadiusY;

    const zDepth = Math.sin(loopAngle); // -1 (back) to +1 (front)
    const rot = Math.cos(loopAngle) * 0.30;
    const depthScale = lerp(0.52, 0.85, u) * (0.90 + zDepth * 0.10);
    const noteW = lerp(geom.laneW * 0.45, geom.laneW * 0.85, u) * (0.90 + zDepth * 0.10);
    const noteH = lerp(geom.targetNoteH * 0.45, geom.targetNoteH * 0.75, u) * (0.90 + zDepth * 0.10);

    return { x: spiralX - noteW / 2, y: spiralY, w: noteW, h: noteH, rot, scale: depthScale };
  } 
  
  // ── Phase 3: Extended Readability Runway & Target Lane Ejection ($p: 0.48 \rightarrow 1.00$) ──
  // Notes shoot out of the bottom nozzle at p = 0.48 and smoothly glide straight into strike buttons
  else {
    const u = (prog - 0.48) / 0.52;
    const exitAngle = Math.PI * 4 + t * 1.6 * mult;
    const exitRadiusX = corkW * 0.15;
    const exitRadiusY = H * 0.065;
    const exitX = cx + Math.cos(exitAngle) * exitRadiusX + laneOffset * 16;
    const exitY = vanishingY + baseH * 0.42 + Math.sin(exitAngle) * exitRadiusY;

    const { x: targetX, w: targetW } = laneAt(lane, 1, W, HW_TOP, HW_BOT, undefined, 1, 0, H);
    const targetCenterX = targetX + targetW / 2;
    const targetCenterY = hitY;

    // Rapid ease-in to straight vertical lane column by u = 0.25 (p = 0.61)
    const alignT = 1 - Math.pow(1 - u, 2.8);
    const noteX = lerp(exitX, targetCenterX, alignT);
    const noteY = lerp(exitY, targetCenterY, u);
    const noteW = lerp(geom.laneW * 0.85, targetW, u);
    const noteH = lerp(geom.targetNoteH * 0.85, geom.targetNoteH, u);
    const rot = lerp(0.15, 0, alignT); // Straightens out into the hit lane
    const scale = lerp(0.85, 1.0, u);

    return { x: noteX - noteW / 2, y: noteY, w: noteW, h: noteH, rot, scale };
  }
}


export function getWaveCoasterPos(
  lane: number,
  prog: number,
  W: number,
  H: number,
  t: number,
  stage: number
): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vanishingY = hitY * 0.22;
  const cx = W / 2;
  const coasterW = geom.stageW;
  const laneOffset = lane - 1; // -1 for left, 0 for center, 1 for right
  const mult = stage === 5 ? 1.6 : 1.0;
  const safeP = Math.max(0, prog);

  // 1. Perspective gravity plunge
  const persP = Math.pow(safeP, 1.25);

  // 2. Wave damping factor: wave amplitude is high in upper/mid track, but damps smoothly to 0 at strike line
  const dampFactor = Math.pow(Math.max(0, 1 - safeP), 1.6);

  // 3. Coaster Vertical Wave (Crest & G-Force Dip)
  const waveFreq = 2.2;
  const waveSpeed = 2.4 * mult;
  const wavePhase = safeP * Math.PI * waveFreq + t * waveSpeed;
  const waveY = Math.sin(wavePhase) * (H * 0.085) * dampFactor;

  // 4. Banking Lateral Sway & Turn
  const swayX = Math.cos(wavePhase * 0.8) * (coasterW * 0.075) * dampFactor;

  // 5. 3D Banking Rotation (Roll tilt into coaster corners)
  const rot = (-Math.cos(wavePhase) * 0.22 + laneOffset * 0.05) * dampFactor;

  // 6. Lane layout with perspective expansion
  const { x: laneHitX, w: laneHitW } = laneAt(lane, 1, W, 0.20, 0.88, undefined, 1, 0, H);
  const noteW = lerp(coasterW * 0.07, laneHitW, persP);
  const startSpacing = coasterW * 0.08;
  const startX = cx + laneOffset * startSpacing - (coasterW * 0.07) / 2;

  const noteX = lerp(startX, laneHitX, persP) + swayX;
  const noteY = lerp(vanishingY, hitY, persP) + waveY;
  const noteH = lerp(geom.targetNoteH * 0.6, geom.targetNoteH, persP);
  const scale = lerp(0.35, 1.0, persP) * (1.0 + Math.sin(wavePhase) * 0.08 * dampFactor);

  return {
    x: noteX,
    y: noteY,
    w: noteW,
    h: noteH,
    rot,
    scale,
  };
}


export function getFlat2DPos(lane: number, prog: number, W: number, H: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const trackW = geom.botWidth;
  const laneW = geom.laneW;
  const startX = (W - trackW) / 2;
  const noteX = startX + lane * laneW;
  const noteY = prog * hitY;
  const noteH = geom.targetNoteH;
  return {
    x: noteX,
    y: noteY,
    w: laneW,
    h: noteH,
    rot: 0,
    scale: 1.0,
  };
}


export function getRadialOrbitPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const cx = W / 2;
  const cy = H * 0.50;
  const maxR = Math.min(geom.stageW, H) * 0.44;
  const targetR = Math.min(geom.stageW, H) * 0.16;
  const safeP = Math.max(0, prog);
  const curR = lerp(maxR, targetR, safeP);

  const rotOffset = t * 0.35 + (stage === 5 ? t * 0.6 : 0);
  const laneAngle = ((lane * 2 * Math.PI) / 3) + rotOffset - Math.PI / 2;

  const noteX = cx + Math.cos(laneAngle) * curR;
  const noteY = cy + Math.sin(laneAngle) * curR;
  const noteW = lerp(geom.laneW * 0.32, geom.laneW * 0.70, safeP);
  const noteH = lerp(geom.targetNoteH * 0.35, geom.targetNoteH, safeP);

  return {
    x: noteX - noteW / 2,
    y: noteY - noteH / 2,
    w: noteW,
    h: noteH,
    rot: laneAngle + Math.PI / 2,
    scale: lerp(0.35, 1.0, safeP),
  };
}


export function getHorizontalDriftPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const trackW = Math.min(W * 0.84, Math.max(geom.stageW, 600));
  const startX = (W - trackW) / 2;
  const hitX = startX + trackW * 0.88;
  const trackH = Math.min(H * 0.55, 360);
  const laneH = trackH / 3;
  const startY = (H - trackH) / 2;
  const safeP = Math.max(0, prog);
  
  const noteX = lerp(startX, hitX, Math.pow(safeP, 1.25));
  const noteY = startY + (2 - lane) * laneH;
  const noteW = lerp(geom.laneW * 0.35, geom.laneW * 0.65, safeP);
  const noteH = laneH * 0.85;

  return {
    x: noteX - noteW / 2,
    y: noteY,
    w: noteW,
    h: noteH,
    rot: 0,
    scale: lerp(0.4, 1.0, safeP),
  };
}


export function getCockpitHudPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vanishingY = hitY * 0.22;
  const cx = W / 2;
  const laneOffset = lane - 1;
  const safeP = Math.max(0, prog);
  const persP = Math.pow(safeP, 1.4);
  const canopyCurve = Math.sin(safeP * Math.PI) * (laneOffset * geom.stageW * 0.06);
  const gForceSway = Math.sin(t * 1.5) * (geom.stageW * 0.012) * safeP;

  const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.14, 0.88, undefined, 1, 0, H);
  const noteY = lerp(vanishingY, hitY, persP);
  const noteW = lerp(geom.stageW * 0.04, hitW, Math.pow(safeP, 1.3));
  const noteH = lerp(geom.targetNoteH * 0.5, geom.targetNoteH, persP);
  const noteX = lerp(cx + laneOffset * (geom.stageW * 0.04), hitX, persP) + canopyCurve + gForceSway;
  const rot = (laneOffset * 0.15 + Math.sin(t * 1.5) * 0.03) * Math.sin(safeP * Math.PI);

  return {
    x: noteX,
    y: noteY,
    w: noteW,
    h: noteH,
    rot,
    scale: lerp(0.3, 1.0, persP),
  };
}


export function getHyperPrismPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vanishingY = hitY * 0.30;
  const safeP = Math.max(0, prog);
  const persP = Math.pow(safeP, 1.3);
  const laneOffset = lane - 1;
  const prismAngle = (laneOffset * (Math.PI / 4)) * Math.sin(safeP * Math.PI);
  const prismDisplacement = Math.sin(t * 2.0 + laneOffset * 1.5) * (geom.stageW * 0.015) * Math.sin(safeP * Math.PI);

  const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.16, 0.86, undefined, 1, 0, H);
  const noteY = lerp(vanishingY, hitY, persP);
  const noteW = lerp(geom.stageW * 0.05, hitW, persP);
  const noteH = lerp(geom.targetNoteH * 0.55, geom.targetNoteH, persP);
  const noteX = lerp(W / 2 + laneOffset * (geom.stageW * 0.05), hitX, persP) + prismDisplacement;

  return {
    x: noteX,
    y: noteY,
    w: noteW,
    h: noteH,
    rot: prismAngle,
    scale: lerp(0.35, 1.0, persP),
  };
}


export function getDnaHelixPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vanishingY = hitY * 0.24;
  const safeP = Math.max(0, prog);
  const persP = Math.pow(safeP, 1.28);
  const cx = W / 2;

  const helixCycles = 2.5;
  const mult = stage === 5 ? 2.0 : 1.0;
  const phaseAngle = safeP * helixCycles * 2 * Math.PI + t * 1.8 * mult;
  const helixRadius = lerp(geom.stageW * 0.08, geom.stageW * 0.24, persP);

  let helixOffset = 0;
  let helixScaleMod = 1.0;
  if (lane === 0) {
    helixOffset = Math.sin(phaseAngle) * helixRadius;
    helixScaleMod = 0.85 + Math.cos(phaseAngle) * 0.25;
  } else if (lane === 2) {
    helixOffset = -Math.sin(phaseAngle) * helixRadius;
    helixScaleMod = 0.85 - Math.cos(phaseAngle) * 0.25;
  } else {
    helixOffset = Math.sin(phaseAngle * 2) * (helixRadius * 0.25);
  }

  const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.18, 0.85, undefined, 1, 0, H);
  const noteY = lerp(vanishingY, hitY, persP);
  const noteW = lerp(geom.stageW * 0.05, hitW, persP) * helixScaleMod;
  const noteH = lerp(geom.targetNoteH * 0.55, geom.targetNoteH, persP);
  const noteX = lerp(cx + (lane - 1) * (geom.stageW * 0.05), hitX, persP) + helixOffset;
  const rot = Math.cos(phaseAngle) * 0.18 * (1 - safeP * 0.5);

  return {
    x: noteX,
    y: noteY,
    w: noteW,
    h: noteH,
    rot,
    scale: lerp(0.3, 1.0, persP) * helixScaleMod,
  };
}


export function getVertigoDropPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vanishingY = hitY * 0.12;
  const safeP = Math.max(0, prog);
  const persP = Math.pow(safeP, 2.2);

  const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.08, 0.92, undefined, 1, 0, H);
  const noteY = lerp(vanishingY, hitY, persP);
  const noteW = lerp(geom.stageW * 0.03, hitW, Math.pow(safeP, 1.8));
  const noteH = lerp(geom.targetNoteH * 0.45, geom.targetNoteH, Math.pow(safeP, 1.5));
  const noteX = lerp(W / 2 + (lane - 1) * (geom.stageW * 0.03), hitX, persP);

  return {
    x: noteX,
    y: noteY,
    w: noteW,
    h: noteH,
    rot: 0,
    scale: lerp(0.2, 1.0, persP),
  };
}


export function getSingularityVoidPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vanishingY = hitY * 0.28;
  const cx = W / 2;
  const safeP = Math.max(0, prog);
  const persP = Math.pow(safeP, 1.35);

  const laneOffset = lane - 1;
  const gravityLensing = laneOffset * (geom.stageW * 0.14) * Math.pow(1 - safeP, 1.8);
  const eventHorizonSwirl = Math.sin(t * 2.2 + safeP * 4.0) * (geom.stageW * 0.018) * Math.sin(safeP * Math.PI);

  const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.22, 0.88, undefined, 1, 0, H);
  const noteY = lerp(vanishingY, hitY, persP);
  const noteW = lerp(geom.stageW * 0.04, hitW, persP);
  const noteH = lerp(geom.targetNoteH * 0.5, geom.targetNoteH, persP);
  const noteX = lerp(cx + laneOffset * (geom.stageW * 0.08), hitX, persP) - gravityLensing + eventHorizonSwirl;
  const rot = (laneOffset * 0.25 - Math.sin(t * 2.0) * 0.05) * Math.pow(1 - safeP, 1.2);

  return {
    x: noteX,
    y: noteY,
    w: noteW,
    h: noteH,
    rot,
    scale: lerp(0.28, 1.0, persP),
  };
}


export function getGroundZeroPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vanishingY = hitY * 0.42;
  const safeP = Math.max(0, prog);
  const persP = Math.pow(safeP, 1.6);

  const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.26, 0.94, undefined, 1, 0, H);
  const noteY = lerp(vanishingY, hitY, persP);
  const noteW = lerp(geom.stageW * 0.08, hitW, persP);
  const noteH = lerp(geom.targetNoteH * 0.6, geom.targetNoteH, persP);
  const noteX = lerp(W / 2 + (lane - 1) * (geom.stageW * 0.08), hitX, persP);

  return {
    x: noteX,
    y: noteY,
    w: noteW,
    h: noteH,
    rot: (lane - 1) * 0.08 * (1 - safeP),
    scale: lerp(0.45, 1.0, persP),
  };
}


export function getOrbitalHaloPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const cx = W / 2;
  const safeP = Math.max(0, prog);
  const persP = Math.pow(safeP, 1.3);

  const laneOffset = lane - 1;
  const haloArcY = hitY * 0.20 - Math.cos((laneOffset * Math.PI) / 4) * (H * 0.08);
  const haloArcX = cx + Math.sin((laneOffset * Math.PI) / 3) * (geom.stageW * 0.28) * (1 - safeP);

  const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.18, 0.88, undefined, 1, 0, H);
  const noteY = lerp(haloArcY, hitY, persP);
  const noteW = lerp(geom.stageW * 0.06, hitW, persP);
  const noteH = lerp(geom.targetNoteH * 0.55, geom.targetNoteH, persP);
  const noteX = lerp(haloArcX, hitX, persP);

  return {
    x: noteX,
    y: noteY,
    w: noteW,
    h: noteH,
    rot: laneOffset * 0.18 * (1 - safeP),
    scale: lerp(0.35, 1.0, persP),
  };
}


export function getMobiusLoopPos(lane: number, prog: number, W: number, H: number, t: number, stage: number): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;
  const vanishingY = hitY * 0.26;
  const safeP = Math.max(0, prog);
  const persP = Math.pow(safeP, 1.3);

  const twistAngle = safeP * Math.PI * 2 + t * 1.5;
  const mobiusLateral = Math.sin(twistAngle) * (geom.stageW * 0.16) * Math.sin(safeP * Math.PI);
  const mobiusRot = Math.cos(twistAngle) * 0.35 * Math.sin(safeP * Math.PI);

  const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.16, 0.86, undefined, 1, 0, H);
  const noteY = lerp(vanishingY, hitY, persP);
  const noteW = lerp(geom.stageW * 0.05, hitW, persP);
  const noteH = lerp(geom.targetNoteH * 0.55, geom.targetNoteH, persP);
  const noteX = lerp(W / 2 + (lane - 1) * (geom.stageW * 0.05), hitX, persP) + mobiusLateral;

  return {
    x: noteX,
    y: noteY,
    w: noteW,
    h: noteH,
    rot: mobiusRot,
    scale: lerp(0.3, 1.0, persP),
  };
}


export function getArchetypeProjection(
  lane: number,
  prog: number,
  W: number,
  H: number,
  archetype: TrackArchetype,
  stage: number,
  t: number,
  povMode: PovMode = 'classic'
): ProjectionResult {
  const geom = getStageGeometry(W, H);
  const hitY = geom.hitY;

  // 1. Direct persistent POV Mode Overrides:
  if (povMode === 'flat_2d') {
    return getFlat2DPos(lane, prog, W, H);
  }
  if (povMode === 'circle') {
    return getRadialOrbitPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'horizontal_drift') {
    return getHorizontalDriftPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'cockpit_hud') {
    return getCockpitHudPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'hyper_prism') {
    return getHyperPrismPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'dna_helix') {
    return getDnaHelixPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'vertigo_drop') {
    return getVertigoDropPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'singularity_void') {
    return getSingularityVoidPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'ground_zero') {
    return getGroundZeroPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'orbital_halo') {
    return getOrbitalHaloPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'mobius_loop') {
    return getMobiusLoopPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'corkscrew') {
    return getCorkscrewSpiralPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'rollercoaster') {
    return getWaveCoasterPos(lane, prog, W, H, t, stage);
  }
  if (povMode === 'matrix_split') {
    const spread = (lane - 1) * (geom.stageW * 0.22 * Math.sin(prog * Math.PI));
    const { x: lx, w: lw } = laneAt(lane, prog, W, 0.25, 0.90, undefined, 1, 0, H);
    const noteY = prog * hitY;
    const noteH = lerp(geom.targetNoteH * 0.6, geom.targetNoteH, prog);
    return {
      x: lx + spread,
      y: noteY,
      w: lw,
      h: noteH,
      rot: (lane - 1) * 0.25 * Math.sin(prog * Math.PI),
      scale: lerp(0.4, 1.0, prog),
    };
  }
  if (povMode === 'cyber_tunnel') {
    const vanishingY = hitY * 0.28;
    const cx = W / 2;
    const tunnelW = geom.stageW;
    const laneOffset = lane - 1;
    const mult = stage === 5 ? 2.0 : 1.0;
    const safeP = Math.max(0, prog);
    const persP = Math.pow(safeP, 1.35);

    const entranceSpacing = tunnelW * 0.055;
    const entranceX = cx + laneOffset * entranceSpacing;
    const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.18, 0.86, undefined, 1, 0, H);

    const noteY = lerp(vanishingY, hitY, persP);
    const noteW = lerp(tunnelW * 0.05, hitW, Math.pow(safeP, 1.25));
    const noteH = lerp(geom.targetNoteH * 0.55, geom.targetNoteH, persP);
    const noteX = lerp(entranceX - noteW / 2, hitX, persP);

    const warpFactor = Math.sin(safeP * Math.PI);
    const barrelWarp = laneOffset * (tunnelW * 0.045) * warpFactor;
    const vortexSway = Math.sin(t * 1.8 * mult + safeP * 3.0) * (tunnelW * 0.016 * mult) * warpFactor;
    const rot = (laneOffset * 0.12 + Math.cos(t * 1.8 * mult + safeP * 3.0) * 0.04) * warpFactor;

    return {
      x: noteX + barrelWarp + vortexSway,
      y: noteY,
      w: noteW,
      h: noteH,
      rot,
      scale: lerp(0.25, 1.0, persP),
    };
  }
  if (povMode === 'classic') {
    const { x, w } = laneAt(lane, prog, W, HW_TOP, HW_BOT, undefined, 1, 0, H);
    const noteY = prog * hitY;
    const noteH = lerp(geom.targetNoteH * 0.55, geom.targetNoteH, prog);
    return { x, y: noteY, w, h: noteH, rot: 0, scale: lerp(0.4, 1.0, prog) };
  }

  // 2. Dynamic Stage Cam Mode (transitions based on stage progression):
  if (povMode === 'dynamic_stage') {
    if (stage === 3 || stage === 5) {
      if (archetype === 'corkscrew_slide') {
        return getCorkscrewSpiralPos(lane, prog, W, H, t, stage);
      }
      if (archetype === 'wave_coaster') {
        return getWaveCoasterPos(lane, prog, W, H, t, stage);
      }
      if (archetype === 'radial_orbit') {
        return getRadialOrbitPos(lane, prog, W, H, t, stage);
      }
      if (archetype === 'horizontal_drift') {
        return getHorizontalDriftPos(lane, prog, W, H, t, stage);
      }
      if (archetype === 'matrix_split') {
        const spread = (lane - 1) * (geom.stageW * 0.22 * Math.sin(prog * Math.PI));
        const { x: lx, w: lw } = laneAt(lane, prog, W, 0.25, 0.90, undefined, 1, 0, H);
        const noteY = prog * hitY;
        const noteH = lerp(geom.targetNoteH * 0.6, geom.targetNoteH, prog);
        return {
          x: lx + spread,
          y: noteY,
          w: lw,
          h: noteH,
          rot: (lane - 1) * 0.25 * Math.sin(prog * Math.PI),
          scale: lerp(0.4, 1.0, prog),
        };
      }
      // Default dynamic 3D Cyber Tunnel
      const vanishingY = hitY * 0.28;
      const cx = W / 2;
      const tunnelW = geom.stageW;
      const laneOffset = lane - 1;
      const mult = stage === 5 ? 2.0 : 1.0;
      const safeP = Math.max(0, prog);
      const persP = Math.pow(safeP, 1.35);
      const entranceSpacing = tunnelW * 0.055;
      const entranceX = cx + laneOffset * entranceSpacing;
      const { x: hitX, w: hitW } = laneAt(lane, 1, W, 0.18, 0.86, undefined, 1, 0, H);

      const noteY = lerp(vanishingY, hitY, persP);
      const noteW = lerp(tunnelW * 0.05, hitW, Math.pow(safeP, 1.25));
      const noteH = lerp(geom.targetNoteH * 0.55, geom.targetNoteH, persP);
      const noteX = lerp(entranceX - noteW / 2, hitX, persP);

      const warpFactor = Math.sin(safeP * Math.PI);
      const barrelWarp = laneOffset * (tunnelW * 0.045) * warpFactor;
      const vortexSway = Math.sin(t * 1.8 * mult + safeP * 3.0) * (tunnelW * 0.016 * mult) * warpFactor;
      const rot = (laneOffset * 0.12 + Math.cos(t * 1.8 * mult + safeP * 3.0) * 0.04) * warpFactor;

      return {
        x: noteX + barrelWarp + vortexSway,
        y: noteY,
        w: noteW,
        h: noteH,
        rot,
        scale: lerp(0.25, 1.0, persP),
      };
    }
  }

  // Fallback: 2.5D Classic Highway
  const { x, w } = laneAt(lane, prog, W, HW_TOP, HW_BOT, undefined, 1, 0, H);
  const noteY = prog * hitY;
  const noteH = lerp(geom.targetNoteH * 0.55, geom.targetNoteH, prog);
  return { x, y: noteY, w, h: noteH, rot: 0, scale: lerp(0.4, 1.0, prog) };
}


export function getLaneFromCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  W: number,
  H: number,
  povMode: PovMode = 'classic',
  archetype: TrackArchetype = 'classic_perspective',
  stage: number = 1,
  t: number = 0,
  activeNotes?: NoteState[]
): number {
  if (rect.width <= 0 || rect.height <= 0) return 1;
  const clickX = ((clientX - rect.left) / rect.width) * W;
  const clickY = ((clientY - rect.top) / rect.height) * H;
  const geom = getStageGeometry(W, H);

  // 0. Direct Note Proximity Hit-Testing:
  // If player tapped directly on or near a visible active note in the current hit window,
  // route the tap directly to that note's lane (prevents any 3D perspective distortion)!
  if (activeNotes && activeNotes.length > 0) {
    let closestCandidateLane: number | null = null;
    let minCandidateDist = Infinity;

    for (let i = 0; i < activeNotes.length; i++) {
      const ns = activeNotes[i];
      if (ns.hit || ns.missed) continue;
      const noteT = ns.note.time;
      if (Math.abs(noteT - t) > 0.35) continue; // Only consider notes near the hit window
      
      const spawnT = noteT - 1.6;
      const prog = (t - spawnT) / 1.6;
      if (prog < 0.45 || prog > 1.35) continue;

      const proj = getArchetypeProjection(ns.note.lane, prog, W, H, archetype, stage, t, povMode);
      const noteCenterX = proj.x + proj.w / 2;
      const noteCenterY = proj.y;
      const halfW = Math.max(proj.w / 2, 32);
      const halfH = Math.max(proj.h / 2, 28);

      // Check if tap falls within generous bounding box of this note
      const inX = clickX >= noteCenterX - halfW * 1.35 && clickX <= noteCenterX + halfW * 1.35;
      const inY = clickY >= noteCenterY - halfH * 1.5 && clickY <= noteCenterY + halfH * 1.5;
      if (inX && inY) {
        const dist = Math.hypot(clickX - noteCenterX, clickY - noteCenterY);
        if (dist < minCandidateDist) {
          minCandidateDist = dist;
          closestCandidateLane = ns.note.lane;
        }
      }
    }
    if (closestCandidateLane !== null) {
      return closestCandidateLane;
    }
  }

  const effectivePov = (povMode === 'dynamic_stage' && (stage === 3 || stage === 5))
    ? (archetype === 'horizontal_drift' ? 'horizontal_drift' : archetype === 'radial_orbit' ? 'circle' : povMode)
    : povMode;

  // 1. Horizontal Drift: Lanes stacked vertically as horizontal rows
  if (effectivePov === 'horizontal_drift') {
    const trackH = Math.min(H * 0.55, 360);
    const laneH = trackH / 3;
    const startY = (H - trackH) / 2;
    if (clickY < startY + laneH) return 2;
    if (clickY < startY + 2 * laneH) return 1;
    return 0;
  }

  // 2. Radial Orbit (Circle): 3 radial spokes at 120° angles rotating around center
  if (effectivePov === 'circle') {
    const cx = W / 2;
    const cy = H * 0.50;
    const rotOffset = t * 0.35 + (stage === 5 ? t * 0.6 : 0);
    const clickAngle = Math.atan2(clickY - cy, clickX - cx);

    let bestLane = 1;
    let minDiff = Infinity;
    for (let l = 0; l < 3; l++) {
      const laneAngle = ((l * 2 * Math.PI) / 3) + rotOffset - Math.PI / 2;
      let diff = (clickAngle - laneAngle) % (Math.PI * 2);
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;
      const absDiff = Math.abs(diff);
      if (absDiff < minDiff) {
        minDiff = absDiff;
        bestLane = l;
      }
    }
    return bestLane;
  }

  // 3. Flat 2D: Track is centered with distinct boundaries
  if (effectivePov === 'flat_2d') {
    const trackW = geom.botWidth;
    const laneW = geom.laneW;
    const startX = (W - trackW) / 2;
    if (clickX < startX + laneW) return 0;
    if (clickX < startX + 2 * laneW) return 1;
    return 2;
  }

  // 4. 3D POV Modes: Height-aware sampling at tap's vertical progress
  if (effectivePov !== 'classic') {
    const hitY = geom.hitY;
    const vanishingY = hitY * 0.28;
    const persTap = Math.max(0.1, Math.min(1.0, (clickY - vanishingY) / Math.max(1, hitY - vanishingY)));
    const progTap = Math.pow(persTap, 1 / 1.35); // Invert perspective warp to sample lanes at tap height

    const p0 = getArchetypeProjection(0, progTap, W, H, archetype, stage, t, povMode);
    const p1 = getArchetypeProjection(1, progTap, W, H, archetype, stage, t, povMode);
    const p2 = getArchetypeProjection(2, progTap, W, H, archetype, stage, t, povMode);

    const c0x = p0.x + p0.w / 2;
    const c1x = p1.x + p1.w / 2;
    const c2x = p2.x + p2.w / 2;

    if (c0x < c1x && c1x < c2x) {
      const split01 = (c0x + c1x) / 2;
      const split12 = (c1x + c2x) / 2;
      if (clickX < split01) return 0;
      if (clickX < split12) return 1;
      return 2;
    } else {
      const d0 = (clickX - c0x) ** 2 + (clickY - p0.y) ** 2;
      const d1 = (clickX - c1x) ** 2 + (clickY - p1.y) ** 2;
      const d2 = (clickX - c2x) ** 2 + (clickY - p2.y) ** 2;
      if (d0 <= d1 && d0 <= d2) return 0;
      if (d1 <= d0 && d1 <= d2) return 1;
      return 2;
    }
  }

  // 5. Classic Mode: Sample exact highway lane boundaries at bottom judgment strike zone (p = 1.0)
  const l0 = laneAt(0, 1, W, HW_TOP, HW_BOT, undefined, 1, 0, H);
  const l1 = laneAt(1, 1, W, HW_TOP, HW_BOT, undefined, 1, 0, H);
  const split01 = l0.x + l0.w;
  const split12 = l1.x + l1.w;

  if (clickX < split01) return 0;
  if (clickX < split12) return 1;
  return 2;
}
