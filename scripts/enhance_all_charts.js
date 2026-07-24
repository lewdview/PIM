import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target directory
const songsDir = path.join(__dirname, '../public/data/songs');

// Dry-run mode indicator
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

/**
 * Calculates the theoretical 100% Perfect Run Max Score for a chart
 */
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
    if (note.type === 'mine') return; // mines are not hit in a perfect run
    if (note.type === 'hold') {
      scoreEvents.push({ time: note.time, type: note.type });
      scoreEvents.push({ time: note.time + (note.holdDuration || 0.5), type: note.type });
    } else {
      scoreEvents.push({ time: note.time, type: note.type });
    }
  });
  scoreEvents.sort((a, b) => a.time - b.time);

  let maxScore = 0;
  let tempCombo = 0;
  const triggered = new Set();
  let activePu = null;

  for (const event of scoreEvents) {
    for (const pw of POWER_UPS) {
      if (tempCombo >= pw.threshold && !triggered.has(pw.threshold)) {
        triggered.add(pw.threshold);
        activePu = {
          endTime: event.time + pw.duration,
          multiplier: pw.multiplier,
        };
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

// Helper to enhance a song chart
function enhanceSongChart(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const song = JSON.parse(fileContent);

  if (!song.notes || song.notes.length === 0) {
    return null; // Skip if no notes present
  }

  const bpm = song.bpm || 120;
  const beatDuration = 60 / bpm;
  const difficulty = song.difficultyLevel || 5;

  const originalNotesCount = song.notes.length;
  
  // 1. Quantize notes to 1/16 beat grids, clean precision, and sort by time
  let processedNotes = song.notes.map(note => {
    const timeVal = parseFloat(note.time);
    const beatFraction = beatDuration / 4; // 1/16th beat
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

  // Sort notes by time, then by lane
  processedNotes.sort((a, b) => a.time - b.time || a.lane - b.lane);

  // Remove duplicate notes (same time and lane)
  const uniqueNotesMap = new Map();
  processedNotes.forEach(note => {
    const key = `${note.time}-${note.lane}`;
    if (!uniqueNotesMap.has(key)) {
      uniqueNotesMap.set(key, note);
    }
  });
  processedNotes = Array.from(uniqueNotesMap.values());

  // 2. Inject Note Mechanics (Remix, Mine, Break, Accent, Burst, Lift, Swipes)
  let lastSwipeTime = -999;
  let lastRemixTime = -999;
  let lastMineTime = -999;

  const remixEffects = ['vocals_isolate', 'drums_mute', 'bass_boost', 'lead_solo'];
  let remixIdx = 0;

  processedNotes = processedNotes.map((note, index) => {
    let type = note.type || 'tap';
    let swipeDirection = note.swipeDirection;
    let holdDuration = note.holdDuration;
    let remixEffect = note.remixEffect;

    const timeInBeats = note.time / beatDuration;
    const roundBeat = Math.round(timeInBeats);
    const isDownbeat = Math.abs(timeInBeats - roundBeat) < 0.05;

    // Upgrade downbeat notes to REMIX Notes (every 24 to 32 beats)
    if (isDownbeat && (roundBeat % 32 === 0 || roundBeat % 24 === 0) && (note.time - lastRemixTime > 12.0)) {
      type = 'remix';
      remixEffect = remixEffects[remixIdx % remixEffects.length];
      remixIdx++;
      lastRemixTime = note.time;
    }
    // Upgrade major drop downbeats to BREAK Notes (every 16 beats)
    else if (isDownbeat && roundBeat % 16 === 0 && type === 'tap') {
      type = 'break';
    }
    // Upgrade snare/punch beats to ACCENT Notes (every 8 beats)
    else if (isDownbeat && roundBeat % 8 === 0 && type === 'tap') {
      type = 'accent';
    }
    // Upgrade downbeats to SWIPES (at least 3.0s apart)
    else if (difficulty >= 4 && type === 'tap' && isDownbeat && (note.time - lastSwipeTime > 3.0)) {
      type = 'swipe';
      const dirs = ['up', 'down', 'left', 'right'];
      swipeDirection = dirs[(index + roundBeat) % dirs.length];
      lastSwipeTime = note.time;
    }
    // Upgrade short holds to LIFT Notes
    else if (type === 'hold' && holdDuration && holdDuration < beatDuration * 0.8) {
      type = 'lift';
      holdDuration = undefined;
    }

    return {
      ...note,
      type,
      swipeDirection,
      holdDuration,
      remixEffect
    };
  });

  // 3. Inject Mine Hazard Notes on high difficulty tracks (difficulty >= 6)
  if (difficulty >= 6) {
    const notesWithMines = [];
    processedNotes.forEach((note, index) => {
      notesWithMines.push(note);

      const timeInBeats = note.time / beatDuration;
      const isSyncopatedOffbeat = Math.abs(timeInBeats - (Math.floor(timeInBeats) + 0.5)) < 0.05;

      if (isSyncopatedOffbeat && (index % 12 === 0) && (note.time - lastMineTime > 8.0)) {
        const mineLane = (note.lane + 1) % 3;
        // Verify no note currently exists on mineLane at this time
        const laneOccupied = processedNotes.some(n => n.lane === mineLane && Math.abs(n.time - note.time) < 0.15);
        if (!laneOccupied) {
          notesWithMines.push({
            id: 30000 + note.id,
            time: parseFloat((note.time + beatDuration * 0.5).toFixed(3)),
            lane: mineLane,
            type: 'mine'
          });
          lastMineTime = note.time;
        }
      }
    });
    processedNotes = notesWithMines;
    processedNotes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  }

  // 4. Clean up IDs so they are sequential
  processedNotes = processedNotes.map((note, idx) => ({
    ...note,
    id: idx
  }));

  // 5. Recalculate theoretical Perfect Run Max Score
  const perfectRunMaxScore = calculatePerfectRunMaxScore(processedNotes, difficulty);

  const updatedSong = {
    ...song,
    notes: processedNotes,
    perfectRunMaxScore
  };

  return {
    song: updatedSong,
    originalCount: originalNotesCount,
    newCount: processedNotes.length,
    perfectRunMaxScore
  };
}

// Main execution block
if (dryRun) {
  const sampleFile = path.join(songsDir, 'day-001.json');
  console.log(`[DRY-RUN] Processing sample file: ${sampleFile}`);
  const result = enhanceSongChart(sampleFile);
  if (result) {
    console.log(`[DRY-RUN] Success!`);
    console.log(`- Original note count: ${result.originalCount}`);
    console.log(`- Enhanced note count: ${result.newCount}`);
    console.log(`- Recalculated Perfect Run Max Score: ${result.perfectRunMaxScore.toLocaleString()} pts`);
    console.log(`- Sample Notes (First 15):`);
    console.log(JSON.stringify(result.song.notes.slice(0, 15), null, 2));
  } else {
    console.log(`[DRY-RUN] No notes processed.`);
  }
} else {
  console.log(`Processing all song files in: ${songsDir}`);
  const files = fs.readdirSync(songsDir).filter(f => f.startsWith('day-') && f.endsWith('.json'));
  console.log(`Found ${files.length} daily track files.`);

  let totalOriginal = 0;
  let totalNew = 0;

  files.forEach(file => {
    const filePath = path.join(songsDir, file);
    const result = enhanceSongChart(filePath);
    if (result) {
      totalOriginal += result.originalCount;
      totalNew += result.newCount;
      fs.writeFileSync(filePath, JSON.stringify(result.song, null, 2), 'utf8');
    }
  });

  console.log(`[FINISHED] All ${files.length} song charts enhanced with new note types!`);
  console.log(`- Total notes before: ${totalOriginal}`);
  console.log(`- Total notes after: ${totalNew}`);
}
