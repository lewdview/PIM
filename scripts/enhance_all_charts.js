import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target directory
const songsDir = path.join(__dirname, '../public/data/songs');

// Dry-run mode indicator
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

// Helper to check files
function enhanceSongChart(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const song = JSON.parse(fileContent);

  if (!song.notes || song.notes.length === 0) {
    return null; // Skip if no notes present
  }

  const bpm = song.bpm || 120;
  const beatDuration = 60 / bpm;
  const difficulty = song.difficultyLevel || 5;
  const duration = song.duration || 180;

  const originalNotesCount = song.notes.length;
  
  // 1. Quantize notes to 1/16 beat grids, clean precision, and sort by time
  let processedNotes = song.notes.map(note => {
    const timeVal = parseFloat(note.time);
    // Snap to nearest 1/16th beat grid
    const beatFraction = beatDuration / 4; // 1/16th beat (assuming 4/4 time signature)
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

  // 2. Adjust density based on difficulty level
  if (difficulty <= 3) {
    // Easy: Filter out notes that are too close (e.g. less than 1 beat apart)
    const minSpacing = beatDuration * 0.95;
    let lastTime = -999;
    processedNotes = processedNotes.filter(note => {
      if (note.time - lastTime < minSpacing) {
        return false;
      }
      lastTime = note.time;
      return true;
    });
  } else if (difficulty >= 7) {
    // Hard: Inject extra triplets or syncopations in intense sections (verse/chorus drops)
    const newNotes = [];
    for (let i = 0; i < processedNotes.length; i++) {
      const curr = processedNotes[i];
      newNotes.push(curr);
      
      const next = processedNotes[i + 1];
      if (next) {
        const gap = next.time - curr.time;
        // If there's a gap of exactly 2 beats or 4 beats, insert a syncopated note on the half-beat
        if (Math.abs(gap - beatDuration * 2) < 0.05 && (i % 3 === 0)) {
          const insertTime = curr.time + beatDuration;
          const otherLane = (curr.lane + 1) % 3;
          newNotes.push({
            id: 9999 + i,
            time: parseFloat(insertTime.toFixed(3)),
            lane: otherLane,
            type: 'tap'
          });
        }
      }
    }
    processedNotes = newNotes;
    processedNotes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  }

  // 3. Smooth lane flow to prevent bad repetitions and create natural flow runs
  let lastLane = 1;
  let secondLastLane = 0;
  processedNotes = processedNotes.map((note, index) => {
    let lane = note.lane;
    const prev = processedNotes[index - 1];

    if (prev && note.time - prev.time < 0.250) {
      // If notes are closer than 250ms, make sure they alternate lanes!
      if (lane === lastLane) {
        const availableLanes = [0, 1, 2].filter(l => l !== lastLane && l !== secondLastLane);
        lane = availableLanes.length > 0 ? availableLanes[0] : (lane + 1) % 3;
      }
    }

    secondLastLane = lastLane;
    lastLane = lane;
    return { ...note, lane };
  });

  // 4. Inject Premium Swipes, Dual Notes, and Hold Releases
  let lastSwipeTime = -999;
  processedNotes = processedNotes.map((note, index) => {
    let type = note.type || 'tap';
    let swipeDirection = note.swipeDirection;
    let holdDuration = note.holdDuration;

    const timeInBeats = note.time / beatDuration;
    const isDownbeat = Math.abs(timeInBeats - Math.round(timeInBeats)) < 0.05 && (Math.round(timeInBeats) % 4 === 0);

    // Upgrade taps on downbeats to swipes (at least 3.0s apart)
    if (difficulty >= 4 && type === 'tap' && isDownbeat && (note.time - lastSwipeTime > 3.0)) {
      type = 'swipe';
      const dirs = ['up', 'down', 'left', 'right'];
      swipeDirection = dirs[(index + Math.round(timeInBeats)) % dirs.length];
      lastSwipeTime = note.time;
    }

    // Attach release swipes to long holds
    if (difficulty >= 5 && type === 'hold' && holdDuration && holdDuration > beatDuration * 1.5) {
      swipeDirection = 'up';
    }

    return {
      ...note,
      type,
      swipeDirection,
      holdDuration
    };
  });

  // 5. Inject Dual Notes (Simultaneous Hits) on major drop beats for Hard Difficulties
  if (difficulty >= 5) {
    const dualNotes = [];
    processedNotes.forEach((note, index) => {
      dualNotes.push(note);
      
      const timeInBeats = note.time / beatDuration;
      const isMajorDrop = Math.abs(timeInBeats - Math.round(timeInBeats)) < 0.05 && (Math.round(timeInBeats) % 8 === 0);

      // Verify no simultaneous note exists at this exact time in other lanes
      const hasSimultaneous = processedNotes.some((n, idx) => idx !== index && Math.abs(n.time - note.time) < 0.01);
      
      if (isMajorDrop && !hasSimultaneous && (index % 5 === 0) && note.type === 'tap') {
        const secondLane = (note.lane + 2) % 3;
        dualNotes.push({
          id: 20000 + note.id,
          time: note.time,
          lane: secondLane,
          type: 'tap'
        });
      }
    });
    processedNotes = dualNotes;
    processedNotes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  }

  // 6. Clean up IDs so they are sequential
  processedNotes = processedNotes.map((note, idx) => ({
    ...note,
    id: idx
  }));

  const updatedSong = {
    ...song,
    notes: processedNotes
  };

  return {
    song: updatedSong,
    originalCount: originalNotesCount,
    newCount: processedNotes.length
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

  console.log(`[FINISHED] All ${files.length} song charts enhanced successfully!`);
  console.log(`- Total notes before: ${totalOriginal}`);
  console.log(`- Total notes after: ${totalNew}`);
}
