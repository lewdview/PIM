import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target directory for public day JSON files
const songsDir = path.join(__dirname, '../public/data/songs');

// Day File Map (contains the relative audio filenames)
const dayFileMapPath = path.join(__dirname, '../src/game/day_file_map.json');
const dayFileMap = JSON.parse(fs.readFileSync(dayFileMapPath, 'utf8'));

// Audio files base paths on mounted drives
const drive1Base = "/Volumes/extremeUno/th3scr1b3-365-warp/365-releases/";
const drive2Base = "/Volumes/extremeDos/temp music/";

// Dry-run mode indicator
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

// Parse WAV header and extract PCM data
function readWavPcm(filePath) {
  const buffer = fs.readFileSync(filePath);

  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error("Invalid RIFF/WAVE file structure");
  }

  let pos = 12;
  let fmtInfo = null;
  let dataInfo = null;

  while (pos < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', pos, pos + 4);
    const chunkSize = buffer.readUInt32LE(pos + 4);
    pos += 8;

    if (chunkId === 'fmt ') {
      const audioFormat = buffer.readUInt16LE(pos);
      const numChannels = buffer.readUInt16LE(pos + 2);
      const sampleRate = buffer.readUInt32LE(pos + 4);
      const byteRate = buffer.readUInt32LE(pos + 8);
      const blockAlign = buffer.readUInt16LE(pos + 12);
      const bitsPerSample = buffer.readUInt16LE(pos + 14);
      fmtInfo = { audioFormat, numChannels, sampleRate, byteRate, blockAlign, bitsPerSample };
    } else if (chunkId === 'data') {
      dataInfo = { offset: pos, size: chunkSize };
      break;
    }

    pos += chunkSize;
  }

  if (!fmtInfo || !dataInfo) {
    throw new Error("Missing fmt or data subchunks in WAV file");
  }

  return { buffer, fmtInfo, dataInfo };
}

// Perform transient onset detection and generate note array using a hybrid math-grid and audio-reactive peak algorithm
function forgeBeatmap(song, wavData) {
  const bpm = song.bpm || 120;
  const beatDuration = 60 / bpm;
  const beatFraction = beatDuration / 4; // 1/16th beat snap grid
  const duration = Math.min(180, song.duration || 120);
  const difficulty = song.difficultyLevel || 5;

  const { buffer, fmtInfo, dataInfo } = wavData;
  const sampleRate = fmtInfo.sampleRate;
  const numChannels = fmtInfo.numChannels;
  const bitsPerSample = fmtInfo.bitsPerSample;
  const bytesPerFrame = fmtInfo.blockAlign;

  const dataOffset = dataInfo.offset;
  const dataSize = dataInfo.size;
  const totalFrames = Math.min(Math.floor(dataSize / bytesPerFrame), Math.floor(sampleRate * duration));

  // Determine dynamic block size (~23.2ms)
  const blockSize = Math.round(sampleRate * 0.02322);
  // Determine dynamic moving average window (~1.0s)
  const movingAvgWindow = Math.round(1.0 / (blockSize / sampleRate));

  const blockEnergies = [];

  // 1. Calculate RMS energy for each block
  for (let i = 0; i < totalFrames; i += blockSize) {
    let sum = 0;
    const end = Math.min(totalFrames, i + blockSize);
    const count = end - i;

    for (let j = i; j < end; j++) {
      const frameOffset = dataOffset + j * bytesPerFrame;
      
      let sampleVal = 0;
      if (bitsPerSample === 16) {
        let channelSum = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          channelSum += buffer.readInt16LE(frameOffset + ch * 2);
        }
        sampleVal = (channelSum / numChannels) / 32768.0;
      } else if (bitsPerSample === 24) {
        let channelSum = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          const valIdx = frameOffset + ch * 3;
          const val = (buffer[valIdx] | (buffer[valIdx + 1] << 8) | (buffer[valIdx + 2] << 16)) << 8 >> 8;
          channelSum += val;
        }
        sampleVal = (channelSum / numChannels) / 8388608.0;
      } else if (bitsPerSample === 32) {
        let channelSum = 0;
        for (let ch = 0; ch < numChannels; ch++) {
          channelSum += buffer.readInt32LE(frameOffset + ch * 4);
        }
        sampleVal = (channelSum / numChannels) / 2147483648.0;
      }

      sum += sampleVal * sampleVal;
    }

    const rms = Math.sqrt(sum / count);
    blockEnergies.push(rms);
  }

  // 2. Identify physical onset peak locations (transients)
  const thresholdRatio = 1.35 - (difficulty * 0.035); // 1.31 to 1.0
  const peaks = []; // array of block indices representing peaks

  for (let b = movingAvgWindow; b < blockEnergies.length; b++) {
    const instantEnergy = blockEnergies[b];

    let windowSum = 0;
    for (let w = b - movingAvgWindow; w < b; w++) {
      windowSum += blockEnergies[w];
    }
    const localAvgEnergy = windowSum / movingAvgWindow;

    if (instantEnergy > localAvgEnergy * thresholdRatio && instantEnergy > 0.012) {
      peaks.push(b);
    }
  }

  // 3. Step through math-grid intervals, syncing notes on peaks, adding filler taps on energy
  let notes = [];
  let lastLane = 1;
  let secondLastLane = 0;
  let time = 3.0; // Wait 3 seconds to let player get ready
  let index = 0;

  // Step interval based on difficulty scaling
  const stepTime = beatDuration / (difficulty >= 8 ? 2 : difficulty >= 5 ? 1 : 0.5);

  while (time < duration - 4) {
    const blockIndex = Math.floor((time * sampleRate) / blockSize);
    const energy = blockEnergies[blockIndex] || 0;

    // Check if there is an audio onset peak within ~120ms (search radius in blocks)
    const searchRadiusBlocks = Math.round(0.12 * sampleRate / blockSize);
    const hasPeakNear = peaks.some(pb => Math.abs(pb - blockIndex) <= searchRadiusBlocks);

    let shouldSpawn = false;
    let noteType = 'tap';
    let holdDuration = undefined;
    let swipeDirection = undefined;

    if (hasPeakNear) {
      // Audio peak transient matched!
      shouldSpawn = true;
      
      // Premium note upgrades (holds & swipes) on accent peaks
      if (difficulty >= 3 && energy > 0.12 && index % 6 === 2) {
        noteType = 'hold';
        const rawHold = beatDuration * (1.5 + (index % 2));
        holdDuration = Math.round(rawHold / beatFraction) * beatFraction;
      } else if (difficulty >= 5 && energy > 0.16 && index % 7 === 4) {
        noteType = 'swipe';
        const dirs = ['up', 'down', 'left', 'right'];
        swipeDirection = dirs[(index + Math.round(time)) % dirs.length];
      }
    } else {
      // Math filler check: if local energy is strong (>0.035) and difficulty is medium+,
      // spawn a standard tap on grid steps with a probability to sustain the song's energy.
      const fillProbability = difficulty >= 7 ? 0.65 : difficulty >= 5 ? 0.45 : 0.25;
      if (energy > 0.035 && Math.random() < fillProbability) {
        shouldSpawn = true;
      }
    }

    if (shouldSpawn) {
      // Snap to nearest 1/16th beat grid
      const snappedTime = Math.round(time / beatFraction) * beatFraction;
      
      // Prevent duplicate notes
      const exists = notes.some(n => Math.abs(n.time - snappedTime) < 0.01);
      if (!exists) {
        const availableLanes = [0, 1, 2].filter(l => l !== lastLane && l !== secondLastLane);
        const lane = availableLanes[Math.floor((snappedTime * 17) % availableLanes.length)];
        secondLastLane = lastLane;
        lastLane = lane;

        let targetLane = undefined;
        if (noteType === 'hold') {
          if (difficulty >= 5 && index % 3 === 0) {
            targetLane = (lane + 1 + (index % 2)) % 3;
          }
          if (difficulty >= 4 && index % 2 === 1) {
            const dirs = ['up', 'down', 'left', 'right'];
            swipeDirection = dirs[(index + Math.round(snappedTime)) % dirs.length];
          }
        }

        notes.push({
          time: parseFloat(snappedTime.toFixed(3)),
          lane,
          type: noteType,
          holdDuration: holdDuration ? parseFloat(holdDuration.toFixed(3)) : undefined,
          targetLane,
          swipeDirection
        });

        // Inject double notes on major transient drops (difficulty >= 4)
        const canSpawnDual = difficulty >= 4 && noteType !== 'hold';
        if (canSpawnDual) {
          const dualRoll = (snappedTime * 23 + index * 3) % 100;
          const dualChance = difficulty >= 7 ? 25 : 12;
          if (dualRoll < dualChance && energy > 0.12) {
            const secondLane = (lane + 1 + (index % 2)) % 3;
            let secondType = 'tap';
            let secondSwipeDir = undefined;
            
            const typeRoll = (index * 13 + Math.floor(snappedTime)) % 100;
            if (difficulty >= 6 && typeRoll < 30) {
              secondType = 'swipe';
              const dirs = ['up', 'down', 'left', 'right'];
              secondSwipeDir = dirs[(index + 2) % dirs.length];
            }
            
            notes.push({
              time: parseFloat(snappedTime.toFixed(3)),
              lane: secondLane,
              type: secondType,
              swipeDirection: secondSwipeDir
            });
          }
        }
        
        index++;
      }
    }

    if (noteType === 'hold' && holdDuration) {
      time += holdDuration + beatDuration * 1.5;
    } else {
      time += stepTime;
    }
  }

  // Sort notes chronologically
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);

  // Re-index IDs sequentially
  notes = notes.map((note, idx) => ({
    ...note,
    id: idx
  }));

  return notes;
}

// Procedural grid fallback helper
function generateProceduralFallback(song) {
  const bpm = song.bpm || 120;
  const beatDuration = 60 / bpm;
  const duration = Math.min(180, song.duration || 120);
  const difficulty = song.difficultyLevel || 5;

  const notes = [];
  let time = 3.0; // Wait 3 seconds to let player get ready
  let lastLane = 1;
  let secondLastLane = 0;
  let noteId = 0;

  // Scaling density based on difficulty level
  const stepTime = beatDuration / (difficulty >= 8 ? 2 : difficulty >= 5 ? 1 : 0.5);

  while (time < duration - 4) {
    const availableLanes = [0, 1, 2].filter(l => l !== lastLane && l !== secondLastLane);
    const lane = availableLanes[Math.floor((time * 31) % availableLanes.length)];
    secondLastLane = lastLane;
    lastLane = lane;

    let noteType = 'tap';
    let holdDuration = undefined;
    let swipeDirection = undefined;

    let targetLane = undefined;

    // Introduce variety based on difficulty
    const triggerIndex = Math.round(time / stepTime);
    if (difficulty >= 3 && triggerIndex % 8 === 2) {
      noteType = 'hold';
      holdDuration = beatDuration * (1.5 + (triggerIndex % 2));
      
      if (difficulty >= 5 && triggerIndex % 3 === 0) {
        targetLane = (lane + 1 + (triggerIndex % 2)) % 3;
      }
      if (difficulty >= 4 && triggerIndex % 2 === 1) {
        const dirs = ['up', 'down', 'left', 'right'];
        swipeDirection = dirs[triggerIndex % dirs.length];
      }
    } else if (difficulty >= 5 && triggerIndex % 8 === 5) {
      noteType = 'swipe';
      const dirs = ['up', 'down', 'left', 'right'];
      swipeDirection = dirs[triggerIndex % dirs.length];
    }

    notes.push({
      id: noteId++,
      time: parseFloat(time.toFixed(3)),
      lane,
      type: noteType,
      holdDuration: holdDuration ? parseFloat(holdDuration.toFixed(3)) : undefined,
      targetLane,
      swipeDirection
    });

    const canSpawnDual = difficulty >= 4 && noteType !== 'hold';
    if (canSpawnDual) {
      const dualRoll = (time * 17 + noteId * 3) % 100;
      const dualChance = difficulty >= 7 ? 22 : 12;
      if (dualRoll < dualChance) {
        const secondLane = (lane + 1 + (noteId % 2)) % 3;
        let secondType = 'tap';
        let secondSwipeDir = undefined;
        
        const typeRoll = (noteId * 11 + Math.floor(time)) % 100;
        if (difficulty >= 6 && typeRoll < 30) {
          secondType = 'swipe';
          const dirs = ['up', 'down', 'left', 'right'];
          secondSwipeDir = dirs[(noteId + 2) % dirs.length];
        }
        
        notes.push({
          id: noteId++,
          time: parseFloat(time.toFixed(3)),
          lane: secondLane,
          type: secondType,
          swipeDirection: secondSwipeDir
        });
      }
    }

    if (noteType === 'hold' && holdDuration) {
      time += holdDuration + beatDuration * 1.5;
    } else {
      time += stepTime;
    }
  }

  return notes;
}

// A helper to normalize strings for comparison (e.g. "To Be a Man" -> "tobeaman")
function normalizeName(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Find matching audio file on disk using multiple search strategies
function resolveAudioFile(song, mapped, dayOfMonth, month) {
  // DRIVE 1: /Volumes/extremeUno/
  
  // Drive 1: Strategy 1 - URL relative path
  if (song.audioUrl) {
    const decodedUrl = decodeURIComponent(song.audioUrl);
    const urlMarker = '/releaseready/';
    const markerIndex = decodedUrl.indexOf(urlMarker);
    if (markerIndex !== -1) {
      const relPath = decodedUrl.substring(markerIndex + urlMarker.length);
      const testPath = path.join(drive1Base, relPath);
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }
  }

  // Drive 1: Strategy 2 - day_file_map relative path
  if (mapped && mapped.audio) {
    const testPath = path.join(drive1Base, mapped.audio);
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }

  // Drive 1: Strategy 3 - Scan folder for files starting with padded or unpadded day number
  const folderPath = path.join(drive1Base, 'audio', month);
  if (fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    const dayPrefixes = [
      String(dayOfMonth).padStart(2, '0'),
      String(dayOfMonth)
    ];

    for (const prefix of dayPrefixes) {
      const matched = files.find(f => {
        return (f.startsWith(prefix + ' ') || f.startsWith(prefix + ' -') || f.startsWith(prefix + '.')) && !f.startsWith('._');
      });
      if (matched) {
        return path.join(folderPath, matched);
      }
    }
  }

  // DRIVE 2: /Volumes/extremeDos/temp music/

  const drive2Dirs = [drive2Base, path.join(drive2Base, 'master')];
  const searchNames = [];
  if (song.title) searchNames.push(normalizeName(song.title));
  if (mapped && mapped.audio) searchNames.push(normalizeName(path.basename(mapped.audio)));
  if (song.audioUrl) {
    const urlBasename = path.basename(decodeURIComponent(song.audioUrl));
    searchNames.push(normalizeName(urlBasename));
    const cleanBasename = urlBasename.replace(/^\d+\s*-\s*/, '');
    searchNames.push(normalizeName(cleanBasename));
  }

  // Special normalized mappings for common differences
  if (song.title && song.title.toLowerCase().includes("to be a man")) {
    searchNames.push("tobeaman");
  }
  if (song.title && song.title.toLowerCase().includes("excstacy")) {
    searchNames.push("momentofexcstacy");
  }

  for (const dir of drive2Dirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.startsWith('._')) continue;
          const normalizedFile = normalizeName(file);

          for (const searchName of searchNames) {
            if (searchName.length > 3 && (normalizedFile.includes(searchName) || searchName.includes(normalizedFile.replace(/\.(wav|mp3|m4a|aif)$/, '')))) {
              return path.join(dir, file);
            }
          }
        }
      } catch (e) {}
    }
  }

  return null;
}

// Run mapping
if (dryRun) {
  console.log("[DRY-RUN] Simulating Audio Forge analysis for Day 92...");
  const dayStr = "92";
  const mapped = dayFileMap[dayStr];
  const jsonPath = path.join(songsDir, 'day-092.json');
  const song = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const wavPath = resolveAudioFile(song, mapped, mapped.dayOfMonth, mapped.month);
  console.log(`- Resolved WAV: ${wavPath}`);

  if (wavPath) {
    const isMp3 = wavPath.endsWith('.mp3');
    const decodeWavPath = isMp3 ? path.join(__dirname, '../temp_forge_dryrun.wav') : wavPath;

    if (isMp3) {
      console.log(`- Detected MP3. Converting to temporary WAV via FFmpeg...`);
      execSync(`ffmpeg -y -i "${wavPath}" -acodec pcm_s16le -ac 2 -ar 44100 "${decodeWavPath}" 2>/dev/null`);
    }

    try {
      const wavData = readWavPcm(decodeWavPath);
      const forgedNotes = forgeBeatmap(song, wavData);
      console.log(`[DRY-RUN] Forged ${forgedNotes.length} notes (Original was ${song.notes.length})`);
    } catch (err) {
      console.error("Failed to parse WAV file:", err);
    } finally {
      if (isMp3 && fs.existsSync(decodeWavPath)) {
        fs.unlinkSync(decodeWavPath);
      }
    }
  } else {
    console.error("Could not resolve audio file path!");
  }
} else {
  console.log("Starting robust Audio Forge transient analysis for all 365 daily charts...");
  
  let successCount = 0;
  let fallbackCount = 0;
  let totalNotesGenerated = 0;

  for (let d = 1; d <= 365; d++) {
    const dayStr = String(d);
    const padded = String(d).padStart(3, '0');
    const jsonPath = path.join(songsDir, `day-${padded}.json`);

    if (!fs.existsSync(jsonPath)) {
      console.warn(`[SKIP] day-${padded}.json not found in songs dir.`);
      continue;
    }

    const song = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const mapped = dayFileMap[dayStr];
    
    const dayOfMonth = mapped ? mapped.dayOfMonth : (song.dayOfMonth || 1);
    const month = mapped ? mapped.month : (song.month || 'january');

    const audioPath = resolveAudioFile(song, mapped, dayOfMonth, month);

    if (!audioPath) {
      console.warn(`[FALLBACK] Audio file not found on drive for Day ${padded} ("${song.title}"). Generating procedural fallback...`);
      const fallbackNotes = generateProceduralFallback(song);
      song.notes = fallbackNotes;
      fs.writeFileSync(jsonPath, JSON.stringify(song, null, 2), 'utf8');
      fallbackCount++;
      totalNotesGenerated += fallbackNotes.length;
      continue;
    }

    const isMp3 = audioPath.endsWith('.mp3');
    const decodeWavPath = isMp3 ? path.join(__dirname, `../temp_forge_${padded}.wav`) : audioPath;

    try {
      if (isMp3) {
        // Convert to standard WAV format temporarily
        execSync(`ffmpeg -y -i "${audioPath}" -acodec pcm_s16le -ac 2 -ar 44100 "${decodeWavPath}" 2>/dev/null`);
      }

      const wavData = readWavPcm(decodeWavPath);
      const forgedNotes = forgeBeatmap(song, wavData);

      song.notes = forgedNotes;
      fs.writeFileSync(jsonPath, JSON.stringify(song, null, 2), 'utf8');
      
      console.log(`[SUCCESS] Day ${padded} ("${song.title}") forged! Source: ${path.basename(audioPath)}. Notes count: ${forgedNotes.length}`);
      successCount++;
      totalNotesGenerated += forgedNotes.length;
    } catch (err) {
      console.warn(`[FAIL] Error during Audio Forge for Day ${padded} ("${song.title}"): ${err.message}. Falling back to procedural...`);
      const fallbackNotes = generateProceduralFallback(song);
      song.notes = fallbackNotes;
      fs.writeFileSync(jsonPath, JSON.stringify(song, null, 2), 'utf8');
      fallbackCount++;
      totalNotesGenerated += fallbackNotes.length;
    } finally {
      // Clean up temporary decoded WAV file
      if (isMp3 && fs.existsSync(decodeWavPath)) {
        try {
          fs.unlinkSync(decodeWavPath);
        } catch (e) {}
      }
    }
  }

  console.log(`[COMPLETED] Audio Forge transient sync run complete.`);
  console.log(`- Successfully forged reactive charts: ${successCount} tracks`);
  console.log(`- Generated procedural fallback charts: ${fallbackCount} tracks`);
  console.log(`- Total notes across all 365 daily charts: ${totalNotesGenerated}`);
}
