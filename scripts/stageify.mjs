/**
 * stageify.mjs — Shared stage partitioning utility
 * 
 * Partitions a flat array of notes into 5 stages with:
 * - Stage-appropriate mechanic gating (taps → holds → swipes → all)
 * - BPM-relative transition gaps between stages
 * - Intra-stage density ramping (notes get progressively denser within each stage)
 * - Unified difficulty vocabulary: EASY / MEDIUM / HARD / BRUTAL / FINAL STAGE
 *
 * Used by: split_songs.mjs, enhance_all_charts.js, audio_forge_all_charts.js, GamePlay.tsx (runtime)
 */

/**
 * Stage boundary percentages of total song duration.
 * Stage 1 = 0%–15%, Stage 2 = 15%–35%, Stage 3 = 35%–60%, Stage 4 = 60%–80%, Stage 5 = 80%–100%
 */
const STAGE_PERCENTS = [0, 0.15, 0.35, 0.60, 0.80, 1.0];

/**
 * Stage metadata templates.
 * Vocabulary matches campaign tiers: EASY / MEDIUM / HARD / BRUTAL
 * Stage 5 is labelled "FINAL STAGE" per design.
 */
const STAGE_META = [
  { stage: 1, name: "Stage 1",      difficulty: "EASY"   },
  { stage: 2, name: "Stage 2",      difficulty: "MEDIUM" },
  { stage: 3, name: "Stage 3",      difficulty: "HARD"   },
  { stage: 4, name: "Stage 4",      difficulty: "BRUTAL" },
  { stage: 5, name: "FINAL STAGE",  difficulty: "BRUTAL" },
];

/**
 * Minimum note spacing per stage, expressed as a multiplier of beatDuration.
 * These are the TIGHTEST spacing (at end of stage). At stage start, spacing is 1.5x wider.
 */
const STAGE_MIN_SPACING = [
  1.0,   // Stage 1: Very Easy — generous, comfortable entry pacing
  0.55,  // Stage 2: Easy/Medium — smooth transition
  0.30,  // Stage 3: Hard — balanced rhythmic pulse
  0.18,  // Stage 4: Brutal — dense syncopated patterns
  0.10,  // Stage 5: FINAL STAGE — expert climax
];

/**
 * Intra-stage density ramp factor.
 * At the START of each stage, min spacing is multiplied by this factor (wider).
 * At the END of each stage, min spacing uses the base value (tighter).
 * Linear interpolation between them based on progress through the stage.
 */
const DENSITY_RAMP_FACTOR = 1.4;

/**
 * Transition gap duration in beats (BPM-relative).
 * A gap of this many beats is inserted at each stage boundary.
 * Notes falling inside the gap are removed.
 */
const TRANSITION_GAP_BEATS = 4;

/**
 * Mechanic allowlists per stage.
 * Controls which note types survive each stage after the enhance pass.
 * 'mine' has special gating: only allowed in Stage 4+ AND difficultyLevel >= 7.
 */
const STAGE_ALLOWED_TYPES = {
  1: new Set(['tap']),
  2: new Set(['tap', 'hold']),
  3: new Set(['tap', 'hold', 'swipe', 'accent', 'slide']),
  4: new Set(['tap', 'hold', 'swipe', 'hold-swipe', 'slide', 'accent', 'remix', 'break', 'lift', 'mine', 'zigzag', 'burst']),
  5: new Set(['tap', 'hold', 'swipe', 'hold-swipe', 'slide', 'accent', 'remix', 'break', 'lift', 'mine', 'zigzag', 'burst']),
};

/**
 * Build stage boundary objects from song duration.
 */
function buildStageBounds(duration) {
  return STAGE_META.map((meta, i) => ({
    ...meta,
    startTime: duration * STAGE_PERCENTS[i],
    endTime: duration * STAGE_PERCENTS[i + 1],
    noteCount: 0,
  }));
}

/**
 * Determine which stage a given time falls into.
 * @param {number} time - Note time in seconds
 * @param {object[]} stageBounds - Array of stage boundary objects
 * @returns {number} Stage number 1-5
 */
function getStageForTime(time, stageBounds) {
  for (let i = 0; i < stageBounds.length; i++) {
    if (time >= stageBounds[i].startTime && time < stageBounds[i].endTime) {
      return stageBounds[i].stage;
    }
  }
  return 5; // default to final stage
}

/**
 * Check if a time falls inside a transition gap between stages.
 * A gap of TRANSITION_GAP_BEATS occurs just after each stage boundary (except stage 5 end).
 *
 * @param {number} time - Note time in seconds
 * @param {object[]} stageBounds - Array of stage boundary objects
 * @param {number} beatDuration - Duration of one beat in seconds
 * @returns {boolean} True if note falls in a transition gap
 */
function isInTransitionGap(time, stageBounds, beatDuration) {
  const gapDuration = TRANSITION_GAP_BEATS * beatDuration;
  // Gaps occur at the end of stages 1, 2, 3, 4 (which is the start of stages 2, 3, 4, 5)
  for (let i = 1; i < stageBounds.length; i++) {
    const boundaryTime = stageBounds[i].startTime;
    if (time >= boundaryTime && time < boundaryTime + gapDuration) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate the minimum note spacing at a given point within a stage.
 * Interpolates from wide spacing at stage start to tight spacing at stage end.
 *
 * @param {number} time - Note time in seconds
 * @param {number} stage - Stage number 1-5
 * @param {object[]} stageBounds - Array of stage boundary objects
 * @param {number} beatDuration - Duration of one beat in seconds
 * @returns {number} Minimum spacing in seconds
 */
function getMinSpacing(time, stage, stageBounds, beatDuration) {
  const sb = stageBounds[stage - 1];
  const stageProgress = (time - sb.startTime) / Math.max(0.1, sb.endTime - sb.startTime);
  const clampedProgress = Math.max(0, Math.min(1, stageProgress));

  const baseSpacing = STAGE_MIN_SPACING[stage - 1] * beatDuration;
  // Lerp from wide (ramp factor × base) at start to tight (base) at end
  const startSpacing = baseSpacing * DENSITY_RAMP_FACTOR;
  return startSpacing + (baseSpacing - startSpacing) * clampedProgress;
}

/**
 * Downgrade a note's type if it's not allowed in its stage.
 * Returns a cloned note with appropriate type/field adjustments.
 *
 * @param {object} note - The note object
 * @param {number} stage - Stage number 1-5
 * @param {number} difficultyLevel - Overall song difficulty 1-10
 * @returns {object} Adjusted note clone
 */
function gateNoteType(note, stage, difficultyLevel) {
  const clone = { ...note, stage };
  const allowed = STAGE_ALLOWED_TYPES[stage];

  // Special mine gating: only allowed at difficulty >= 7 in stage 4+
  if (clone.type === 'mine') {
    if (stage < 4 || difficultyLevel < 7) {
      // Remove mine entirely (return null to signal removal)
      return null;
    }
    return clone;
  }

  // If type is already allowed, keep it
  if (allowed.has(clone.type)) {
    return clone;
  }

  // Downgrade unsupported types gracefully
  if (clone.type === 'hold-swipe') {
    if (allowed.has('hold')) {
      clone.type = 'hold';
      if (stage <= 2) delete clone.swipeDirection;
    } else {
      clone.type = 'tap';
      delete clone.holdDuration;
      delete clone.swipeDirection;
    }
  } else if (clone.type === 'slide') {
    if (allowed.has('hold')) {
      clone.type = 'hold';
      delete clone.targetLane;
    } else {
      clone.type = 'tap';
      delete clone.holdDuration;
      delete clone.targetLane;
    }
  } else if (clone.type === 'zigzag') {
    if (allowed.has('slide')) {
      clone.type = 'slide';
      delete clone.zigzagAmplitude;
    } else if (allowed.has('hold')) {
      clone.type = 'hold';
      delete clone.targetLane;
      delete clone.zigzagAmplitude;
    } else {
      clone.type = 'tap';
      delete clone.holdDuration;
      delete clone.targetLane;
      delete clone.zigzagAmplitude;
    }
  } else if (clone.type === 'swipe') {
    clone.type = 'tap';
    delete clone.swipeDirection;
  } else if (clone.type === 'hold' && !allowed.has('hold')) {
    clone.type = 'tap';
    delete clone.holdDuration;
    delete clone.targetLane;
  } else if (clone.type === 'remix' || clone.type === 'break' || clone.type === 'accent' || clone.type === 'lift' || clone.type === 'burst') {
    clone.type = 'tap';
    delete clone.remixEffect;
  }

  // Stage 1: strip all advanced fields
  if (stage === 1) {
    delete clone.holdDuration;
    delete clone.targetLane;
    delete clone.swipeDirection;
    delete clone.remixEffect;
    delete clone.zigzagAmplitude;
  }

  // Stage 2: strip swipe-related fields (holds are ok)
  if (stage === 2) {
    delete clone.swipeDirection;
    delete clone.targetLane;
    delete clone.zigzagAmplitude;
  }

  return clone;
}

/**
 * Main stageify function.
 * Partitions notes into 5 stages with mechanic gating, density ramping,
 * and BPM-relative transition gaps.
 *
 * @param {object[]} notes - Array of note objects (must have at least `time`, `type`, `lane`)
 * @param {number} duration - Total song duration in seconds
 * @param {number} bpm - Beats per minute
 * @param {number} [difficultyLevel=5] - Overall song difficulty (1-10)
 * @returns {{ notes: object[], stages: object[] }}
 */
export function stageifyNotes(notes, duration, bpm, difficultyLevel = 5) {
  const beatDuration = 60 / bpm;
  const stageBounds = buildStageBounds(duration);

  // Build boundary times (transitions between stages)
  const boundaries = STAGE_PERCENTS.slice(1, -1).map(p => duration * p);

  // Gap duration is BPM-relative
  const gapDuration = TRANSITION_GAP_BEATS * beatDuration;

  const processed = [];
  // Track last note time per stage for spacing checks
  const lastNoteTimeByStage = { 1: -999, 2: -999, 3: -999, 4: -999, 5: -999 };

  // Sort input by time
  const sorted = [...notes].sort((a, b) => a.time - b.time);

  for (const note of sorted) {
    // Skip notes in transition gaps
    if (isInTransitionGap(note.time, boundaries, gapDuration)) {
      continue;
    }

    // Determine stage
    const stage = getStageForTime(note.time, stageBounds);

    // Gate note type
    const gated = gateNoteType(note, stage, difficultyLevel);
    if (!gated) continue; // note was removed (e.g. mine in wrong stage)

    // Check minimum spacing (density gating)
    const minSpacing = getMinSpacing(note.time, stage, stageBounds, beatDuration);
    if (note.time - lastNoteTimeByStage[stage] < minSpacing) {
      continue;
    }

    // For stages 1-3, prevent simultaneous notes (no duals)
    if (stage <= 3) {
      const hasDuplicate = processed.some(n => Math.abs(n.time - gated.time) < 0.02);
      if (hasDuplicate) {
        continue;
      }
    }

    processed.push(gated);
    lastNoteTimeByStage[stage] = note.time;
  }

  // Re-index IDs sequentially
  const finalNotes = processed.map((note, index) => ({
    ...note,
    id: index,
  }));

  // Build stages metadata with note counts
  const stagesWithCounts = stageBounds.map(sb => ({
    ...sb,
    noteCount: finalNotes.filter(n => n.stage === sb.stage).length,
  }));

  return { notes: finalNotes, stages: stagesWithCounts };
}

/**
 * Get the stage boundaries for a given duration (useful for enhance script).
 */
export function getStageBounds(duration) {
  return buildStageBounds(duration);
}

/**
 * Get the allowed types for a given stage number.
 */
export function getAllowedTypes(stage) {
  return STAGE_ALLOWED_TYPES[stage] || STAGE_ALLOWED_TYPES[5];
}

/**
 * Constants exported for external use.
 */
export { STAGE_PERCENTS, STAGE_META, STAGE_MIN_SPACING, TRANSITION_GAP_BEATS };
