#!/usr/bin/env node
/**
 * Regenerate a specific set of day JSON files through the fixed enhance pipeline.
 * Usage: node scripts/regen_test.mjs day-001 day-050 day-100 day-200
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stageifyNotes } from './stageify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const songsDir = path.join(__dirname, '../public/data/songs');

// ── Inline the enhance logic (from enhance_all_charts.js) ──
import { getStageBounds, getAllowedTypes } from './stageify.mjs';

function calculatePerfectRunMaxScore(notes, difficultyLevel = 5) {
  const getComboMul = (c) => {
    if (difficultyLevel <= 3) return c < 10 ? 1 : c < 25 ? 1.5 : c < 50 ? 2 : 3;
    if (difficultyLevel <= 6) return c < 10 ? 1 : c < 25 ? 1.5 : c < 50 ? 2 : c < 75 ? 3 : 4;
    return c < 10 ? 1 : c < 25 ? 1.5 : c < 50 ? 2 : c < 75 ? 3 : c < 100 ? 4 : 5;
  };
  const POWER_UPS = [
    { threshold: 20, duration: 9, multiplier: 2 },
    { threshold: 40, duration: 11, multiplier: 3 },
    { threshold: 60, duration: 14, multiplier: 4 },
  ];
  const scoreEvents = [];
  notes.forEach(note => {
    if (note.type === 'mine') return;
    if (note.type === 'hold') {
      scoreEvents.push({ time: note.time, type: note.type });
      scoreEvents.push({ time: note.time + (note.holdDuration || 0.5), type: note.type });
    } else {
      scoreEvents.push({ time: note.time, type: note.type });
    }
  });
  scoreEvents.sort((a, b) => a.time - b.time);
  let maxScore = 0, tempCombo = 0;
  const triggered = new Set();
  let activePu = null;
  for (const event of scoreEvents) {
    for (const pw of POWER_UPS) {
      if (tempCombo >= pw.threshold && !triggered.has(pw.threshold)) {
        triggered.add(pw.threshold);
        activePu = { endTime: event.time + pw.duration, multiplier: pw.multiplier };
      }
    }
    const puMul = activePu && event.time < activePu.endTime ? activePu.multiplier : 1;
    const comboMul = getComboMul(tempCombo);
    let baseNoteScore = 500;
    if (event.type === 'remix') baseNoteScore += 1000;
    else if (event.type === 'break') baseNoteScore += 1200;
    else if (event.type === 'accent') baseNoteScore += 800;
    maxScore += Math.round(baseNoteScore * puMul * comboMul);
    tempCombo++;
  }
  return maxScore || 1;
}

function enhanceAndStageify(song) {
  if (!song.notes || song.notes.length === 0) return null;

  const bpm = song.bpm || 120;
  const beatDuration = 60 / bpm;
  const difficulty = song.difficultyLevel || 5;
  const songDuration = song.duration || 180;
  const originalCount = song.notes.length;

  // 1. Quantize
  let processedNotes = song.notes.map(note => {
    const timeVal = parseFloat(note.time);
    const beatFraction = beatDuration / 4;
    const snappedTime = Math.round(timeVal / beatFraction) * beatFraction;
    const holdDur = note.holdDuration ? parseFloat(note.holdDuration) : undefined;
    const snappedHoldDur = holdDur ? Math.max(beatDuration * 0.5, Math.round(holdDur / beatFraction) * beatFraction) : undefined;
    return {
      ...note,
      time: parseFloat(snappedTime.toFixed(3)),
      lane: Math.min(2, Math.max(0, parseInt(note.lane) || 0)),
      holdDuration: snappedHoldDur ? parseFloat(snappedHoldDur.toFixed(3)) : undefined
    };
  });
  processedNotes.sort((a, b) => a.time - b.time || a.lane - b.lane);

  // Dedup
  const uniqueMap = new Map();
  processedNotes.forEach(n => {
    const key = `${n.time}-${n.lane}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, n);
  });
  processedNotes = Array.from(uniqueMap.values());

  // 2. Stage-aware mechanic injection
  const stageBounds = getStageBounds(songDuration);
  function getStage(time) {
    for (const sb of stageBounds) {
      if (time >= sb.startTime && time < sb.endTime) return sb.stage;
    }
    return 5;
  }

  let lastSwipeTime = -999, lastRemixTime = -999, lastMineTime = -999;
  const remixEffects = ['vocals_isolate', 'drums_mute', 'bass_boost', 'lead_solo'];
  let remixIdx = 0;

  processedNotes = processedNotes.map((note, index) => {
    let type = note.type || 'tap';
    let swipeDirection = note.swipeDirection;
    let holdDuration = note.holdDuration;
    let remixEffect = note.remixEffect;

    const stage = note.stage || getStage(note.time);
    const allowed = getAllowedTypes(stage);
    const timeInBeats = note.time / beatDuration;
    const roundBeat = Math.round(timeInBeats);
    const isDownbeat = Math.abs(timeInBeats - roundBeat) < 0.05;

    if (stage >= 3 && isDownbeat && (roundBeat % 32 === 0 || roundBeat % 24 === 0) && (note.time - lastRemixTime > 12.0) && allowed.has('remix')) {
      type = 'remix'; remixEffect = remixEffects[remixIdx++ % remixEffects.length]; lastRemixTime = note.time;
    } else if (stage >= 3 && isDownbeat && roundBeat % 16 === 0 && type === 'tap' && allowed.has('break')) {
      type = 'break';
    } else if (stage >= 2 && isDownbeat && roundBeat % 8 === 0 && type === 'tap' && allowed.has('accent')) {
      type = 'accent';
    } else if (stage >= 3 && difficulty >= 4 && type === 'tap' && isDownbeat && (note.time - lastSwipeTime > 3.0) && allowed.has('swipe')) {
      type = 'swipe'; swipeDirection = ['up','down','left','right'][(index + roundBeat) % 4]; lastSwipeTime = note.time;
    } else if (stage >= 3 && type === 'hold' && holdDuration && holdDuration < beatDuration * 0.8 && allowed.has('lift')) {
      type = 'lift'; holdDuration = undefined;
    }

    return { ...note, stage, type, swipeDirection, holdDuration, remixEffect };
  });

  // 3. Mine injection (stage 4+ only, difficulty >= 7)
  if (difficulty >= 7) {
    const withMines = [];
    processedNotes.forEach((note, index) => {
      withMines.push(note);
      const stage = note.stage || getStage(note.time);
      if (stage < 4) return;
      const timeInBeats = note.time / beatDuration;
      const isOffbeat = Math.abs(timeInBeats - (Math.floor(timeInBeats) + 0.5)) < 0.05;
      if (isOffbeat && (index % 12 === 0) && (note.time - lastMineTime > 8.0)) {
        const mineLane = (note.lane + 1) % 3;
        if (!processedNotes.some(n => n.lane === mineLane && Math.abs(n.time - note.time) < 0.15)) {
          withMines.push({ id: 30000 + note.id, time: parseFloat((note.time + beatDuration * 0.5).toFixed(3)), lane: mineLane, type: 'mine', stage });
          lastMineTime = note.time;
        }
      }
    });
    processedNotes = withMines;
    processedNotes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  }

  // 4. Final stageify pass
  const stageified = stageifyNotes(processedNotes, songDuration, bpm, difficulty);
  const perfectRunMaxScore = calculatePerfectRunMaxScore(stageified.notes, difficulty);

  return {
    song: { ...song, notes: stageified.notes, stages: stageified.stages, perfectRunMaxScore },
    originalCount,
    newCount: stageified.notes.length,
    perfectRunMaxScore
  };
}

// ── Main ──
const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.log('Usage: node scripts/regen_test.mjs day-001 day-050 ...');
  process.exit(1);
}

for (const target of targets) {
  const filename = target.endsWith('.json') ? target : `${target}.json`;
  const filePath = path.join(songsDir, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[SKIP] ${filename} not found`);
    continue;
  }

  const song = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const result = enhanceAndStageify(song);
  if (result) {
    fs.writeFileSync(filePath, JSON.stringify(result.song, null, 2), 'utf8');
    console.log(`[DONE] ${filename}: ${result.originalCount} → ${result.newCount} notes, maxScore: ${result.perfectRunMaxScore.toLocaleString()}`);
  } else {
    console.warn(`[SKIP] ${filename}: no notes`);
  }
}
