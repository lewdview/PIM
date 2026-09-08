#!/usr/bin/env node
/**
 * generate_v5_flagship.mjs
 *
 * PIM : th3v4ult — V5 Flagship Kinesthetic & Motif Beatmap Generator
 *
 * Core Pillars:
 * 1. Structural Song Segmentation (Intro, Verses, Pre-Chorus, Chorus, Bridge, Climax)
 * 2. Musical Motif Memory & Thematic Evolution (Theme & Variation across Chorus/Verse returns)
 * 3. Two-Thumb Kinesthetic Ergonomics (Hand alternation, anchor-and-play counterpoint, gallop prevention)
 * 4. Acoustic Frequency-to-Lane Spatialization (0=Bass/Kick, 1=Mids/Vocals, 2=Treble/Leads)
 * 5. Pre-Drop Negative Space & Dynamic Tension (vacuum breathers before drops)
 * 6. Complete Note Taxonomy Integration (tap, hold, hold-swipe, 8-way swipe, slide, zigzag, remix, break, accent, lift, mine, double)
 * 7. 5-Stage Progression & Transition Gaps (stageify.mjs compliance)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { stageifyNotes } from './stageify.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DATA = path.join(__dirname, '../public/data');
const SONGS_DIR = path.join(ROOT_DATA, 'songs');
const V5_DIR = path.join(ROOT_DATA, 'songs_variants/v5_flagship');
const MANIFEST_PATH = path.join(V5_DIR, 'manifest.json');

// Ensure target directory exists
fs.mkdirSync(V5_DIR, { recursive: true });

// Seeded PRNG for reproducible variety
function createPrng(seed) {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 8-directional swipe directions
const SWIPE_DIRS = ['up', 'down', 'left', 'right', 'up-left', 'up-right', 'down-left', 'down-right'];
const REMIX_EFFECTS = ['vocals_isolate', 'drums_mute', 'bass_boost', 'lead_solo'];

/**
 * Snap time to nearest subdivision grid
 */
function snap(time, bpm, subdivision = 16) {
  const subDur = (60 / bpm) * (4 / subdivision);
  return parseFloat((Math.round(time / subDur) * subDur).toFixed(3));
}

/**
 * Generate a single rhythmic motif (sequence of relative beat offsets, lanes, and note roles)
 */
function createMotif(prng, barCount = 4, difficulty = 5, isDeluxe = false) {
  const beatsPerBar = 4;
  const totalBeats = barCount * beatsPerBar;
  const motif = [];

  let currentBeat = 0;
  let lastLane = 1;

  while (currentBeat < totalBeats) {
    const isDownbeat = currentBeat % 1 === 0;

    // Determine lane with acoustic bias (downbeats favor Lane 0 or Lane 1)
    let lane;
    if (isDownbeat && prng() < 0.5) {
      lane = prng() < 0.6 ? 0 : 1;
    } else {
      const candidates = [0, 1, 2].filter(l => l !== lastLane);
      lane = candidates[Math.floor(prng() * candidates.length)];
    }
    lastLane = lane;

    // Note role / archetype
    let archetype = 'pulse';
    if (isDownbeat && currentBeat % 4 === 0) {
      archetype = 'downbeat';
    } else if (prng() < 0.3) {
      archetype = 'syncopated';
    }

    motif.push({
      beat: currentBeat,
      lane,
      archetype,
      length: prng() < 0.25 ? 1.0 : 0.5,
    });

    // Step to next note:
    // Deluxe mode: fast 16th (0.25) bursts and dense syncopation
    // Standard mode: tapered back to comfortable quarter (1.0) and eighth (0.5) steps
    const stepRoll = prng();
    let step = 0.5;
    if (isDeluxe) {
      if (difficulty >= 6 && stepRoll < 0.40) step = 0.25;
      else if (difficulty <= 4 && stepRoll < 0.30) step = 1.0;
      else if (stepRoll < 0.20) step = 0.75;
    } else {
      // Standard mode: relaxed, legible pacing
      if (stepRoll < 0.45) step = 1.0;     // 45% quarter notes
      else if (stepRoll < 0.85) step = 0.5; // 40% eighth notes
      else step = 0.75;                     // 15% dotted eighth
    }

    currentBeat += step;
  }

  return motif;
}

/**
 * Core V5 Flagship Note Generator for a single song
 *
 * @param {object} song - Source song metadata
 * @param {object} [options={}] - Generation options ({ deluxe?: boolean })
 */
export function generateV5SongChart(song, options = {}) {
  const isDeluxe = Boolean(options.deluxe);
  const bpm = song.bpm || 120;
  const beatDuration = 60 / bpm;
  const duration = Math.max(60, song.duration || 180);
  const difficulty = song.difficultyLevel || 5;
  // Use distinct seed for deluxe to give differentiated nuance while preserving motif structure
  const seedMultiplier = isDeluxe ? 13337 : 9973;
  const prng = createPrng((song.day || 1) * seedMultiplier + Math.round(bpm * 17));

  // Standard mode tapers back difficulty for an accessible, clear, comfortable baseline (effective difficulty 2-6)
  // Deluxe mode unleashes the full intended difficulty up to level 10
  const effectiveDiff = isDeluxe ? difficulty : Math.max(2, Math.min(6, Math.round(difficulty * 0.75)));

  // 1. Structural Section Boundaries (Seconds)
  const sections = [
    { name: 'intro',      start: 2.0,                  end: duration * 0.12, type: 'sparse' },
    { name: 'verse1',     start: duration * 0.12,      end: duration * 0.28, type: 'verse', iteration: 1 },
    { name: 'preChorus1', start: duration * 0.28,      end: duration * 0.38, type: 'buildup' },
    { name: 'chorus1',    start: duration * 0.38,      end: duration * 0.54, type: 'chorus', iteration: 1 },
    { name: 'verse2',     start: duration * 0.54,      end: duration * 0.66, type: 'verse', iteration: 2 },
    { name: 'bridgeSolo', start: duration * 0.66,      end: duration * 0.78, type: 'bridge' },
    { name: 'chorus2',    start: duration * 0.78,      end: duration * 0.94, type: 'chorus', iteration: 2 },
    { name: 'outro',      start: duration * 0.94,      end: duration - 2.5,  type: 'outro' }
  ];

  // 2. Motif Seeds (Theme & Variation)
  const verseMotif = createMotif(prng, 4, effectiveDiff, isDeluxe);
  const chorusMotif = createMotif(prng, 4, effectiveDiff, isDeluxe);
  const soloMotif = createMotif(prng, 2, isDeluxe ? Math.min(10, difficulty + 2) : effectiveDiff, isDeluxe);

  let rawNotes = [];
  let noteId = 0;

  // Kinesthetic State Tracker (Two-Thumb Kinematics)
  const handState = {
    lastHand: 'left',
    lastTime: -1,
    leftLane: 0,
    rightLane: 2,
    consecutiveSameLane: 0,
    lastLane: -1,
  };

  // Active Touch Allocator State Machine (Two-Thumb Polyphony Guard)
  // Tracks active sustains: hold, slide, zigzag, hold-swipe
  let activeSustains = []; // { id, startTime, endTime, lane, targetLane, hand }
  let lastDoubleSustainReleaseTime = -1;
  let lastCenterHoldHand = null;
  let lastCenterHoldEndTime = -1;

  function getSustainDuration(n) {
    if (typeof n.holdDuration === 'number' && n.holdDuration > 0) return n.holdDuration;
    if (n.type === 'hold' || n.type === 'hold-swipe' || n.type === 'slide' || n.type === 'zigzag') {
      return 0.5;
    }
    return 0;
  }

  /**
   * Safe note pusher with Active Touch Allocator State Machine & Ergonomics
   */
  function pushNote(note) {
    if (note.time < 1.0 || note.time > duration - 2.0) return;

    // 1. Evict finished sustains at note.time
    activeSustains = activeSustains.filter(s => s.endTime > note.time);

    // 2. RULE B: If 2 thumb channels are occupied concurrently, no other notes can spawn
    // until at least one sustain finishes plus a minimum release delta (>= 120ms).
    if (activeSustains.length >= 2) {
      return;
    }
    if (note.time < lastDoubleSustainReleaseTime + 0.120) {
      return;
    }

    // 3. RULE A: If 1 thumb channel is occupied:
    // - Simultaneous notes (dual hits) are strictly forbidden; only single-lane taps or swipes
    //   can spawn on the remaining available lanes.
    if (activeSustains.length === 1) {
      const active = activeSustains[0];

      // Check if another note already exists at roughly the same time (Δt < 0.008s)
      const isSimultaneousAttempt = rawNotes.some(n => Math.abs(n.time - note.time) < 0.008);
      if (isSimultaneousAttempt) {
        return; // Dual hit forbidden while 1 thumb is holding
      }

      // Check if target note lane is occupied by active sustain
      const activeLanes = [active.lane, active.targetLane].filter(l => l !== undefined);
      if (activeLanes.includes(note.lane)) {
        return; // Lane occupied by holding finger
      }

      // RULE C: Anchor hold on Lane 1 (Center) must prevent immediate crossover hits
      // on opposite flanking lanes that would force thumb crossing.
      // E.g. Left Thumb on Lane 1 blocks Lane 0; Right Thumb on Lane 1 blocks Lane 2.
      if (active.lane === 1 || active.targetLane === 1) {
        if (active.hand === 'left' && note.lane === 0) {
          return; // Left thumb holding center blocks left lane (Lane 0)
        }
        if (active.hand === 'right' && note.lane === 2) {
          return; // Right thumb holding center blocks right lane (Lane 2)
        }
      }
    }

    // Check Rule C release delta (>= 120ms) for Center Lane 1 crossover recovery
    if (note.time < lastCenterHoldEndTime + 0.120) {
      if (lastCenterHoldHand === 'left' && note.lane === 0) {
        return; // Left thumb recovery window after Lane 1 hold
      }
      if (lastCenterHoldHand === 'right' && note.lane === 2) {
        return; // Right thumb recovery window after Lane 1 hold
      }
    }

    // Check collision in same lane
    const collision = rawNotes.some(
      n => n.lane === note.lane && Math.abs(n.time - note.time) < 0.14
    );
    if (collision) return;

    // Kinesthetic alternation & hand determination
    let assignedHand = 'left';
    if (note.lane === 0) {
      assignedHand = 'left';
    } else if (note.lane === 2) {
      assignedHand = 'right';
    } else { // lane === 1 (Center)
      if (activeSustains.length > 0) {
        // If left hand is holding lane 0, right hand hits lane 1, and vice versa
        const active = activeSustains[0];
        assignedHand = active.hand === 'left' ? 'right' : 'left';
      } else {
        // Alternate from previous hand
        assignedHand = handState.lastHand === 'left' ? 'right' : 'left';
      }
    }

    // Single-thumb jackhammer fatigue check
    const timeDelta = note.time - handState.lastTime;
    if (note.lane === handState.lastLane && timeDelta < 0.22) {
      handState.consecutiveSameLane++;
      if (handState.consecutiveSameLane > 2) {
        // Shift lane to prevent single-thumb jackhammer fatigue
        note.lane = (note.lane + (prng() < 0.5 ? 1 : 2)) % 3;
        handState.consecutiveSameLane = 0;
        if (note.lane === 0) assignedHand = 'left';
        else if (note.lane === 2) assignedHand = 'right';
      }
    } else {
      handState.consecutiveSameLane = 1;
    }

    handState.lastHand = assignedHand;
    handState.lastLane = note.lane;
    handState.lastTime = note.time;

    // Register active sustain
    const dur = getSustainDuration(note);
    if (dur > 0) {
      const sustainItem = {
        id: noteId,
        startTime: note.time,
        endTime: note.time + dur,
        lane: note.lane,
        targetLane: note.targetLane !== undefined ? note.targetLane : note.lane,
        hand: assignedHand
      };
      activeSustains.push(sustainItem);

      if (activeSustains.length >= 2) {
        lastDoubleSustainReleaseTime = Math.max(...activeSustains.map(s => s.endTime));
      }
      if (note.lane === 1 || note.targetLane === 1) {
        lastCenterHoldHand = assignedHand;
        lastCenterHoldEndTime = note.time + dur;
      }
    }

    // Tag lift and hold-swipe objects with releaseWindowBonusMs: 20
    const bonusMs = (note.type === 'lift' || note.type === 'hold-swipe') ? 20 : undefined;

    rawNotes.push({
      id: noteId++,
      ...note,
      ...(bonusMs ? { releaseWindowBonusMs: bonusMs } : {}),
      time: parseFloat(note.time.toFixed(3)),
    });
  }

  // 3. Populate Timeline by Section
  for (const sec of sections) {
    const secDur = sec.end - sec.start;
    if (secDur <= 0) continue;

    const measureDur = beatDuration * 4;

    // ──────────────────────────────────────────
    // INTRO: Atmospheric, sparse pulse on downbeats
    // ──────────────────────────────────────────
    if (sec.type === 'sparse') {
      let t = snap(sec.start, bpm, 4);
      while (t < sec.end - beatDuration) {
        pushNote({
          time: t,
          lane: prng() < 0.6 ? 1 : 0,
          type: 'tap',
        });
        t = snap(t + beatDuration * (prng() < 0.5 ? 2 : 4), bpm, 4);
      }
    }

    // ──────────────────────────────────────────
    // VERSE 1 & VERSE 2: Motif Playback with Lyrical Breath Windows
    // ──────────────────────────────────────────
    else if (sec.type === 'verse') {
      const isVerse2 = sec.iteration === 2;
      let measureStart = snap(sec.start, bpm, 4);
      let barIndex = 0;

      while (measureStart + measureDur < sec.end) {
        // Designate a 1-bar "breath window" every 4 bars (barIndex % 4 === 3)
        const isBreathBar = (barIndex % 4 === 3);

        for (const item of verseMotif) {
          const t = snap(measureStart + item.beat * beatDuration, bpm, 16);
          if (t >= sec.end) break;

          let targetLane = item.lane;
          let noteType = 'tap';
          let holdDur = undefined;
          let swipeDir = undefined;

          // In lyrical breath windows:
          // Reduce note density on Lane 1 (Vocals) by 50% or suppress Lane 1 notes entirely,
          // shifting light percussive accents to Lanes 0 and 2.
          if (isBreathBar && item.lane === 1) {
            if (prng() < 0.5) {
              continue; // Suppress Lane 1 note entirely (vocal breath)
            } else {
              targetLane = prng() < 0.5 ? 0 : 2; // Shift light percussive accent to flanking lane
              noteType = 'tap';
            }
          } else {
            // In Verse 2: Evolve motif (+20% syncopation, accents, hold-swipes)
            if (isVerse2) {
              if (item.archetype === 'downbeat' && prng() < 0.35) {
                noteType = 'accent';
              } else if (item.length >= 1.0 && prng() < 0.5) {
                noteType = 'hold-swipe';
                holdDur = parseFloat((beatDuration * 1.5).toFixed(3));
                swipeDir = prng() < 0.5 ? 'up' : 'right';
              } else if (prng() < 0.2) {
                noteType = 'swipe';
                swipeDir = prng() < 0.5 ? 'left' : 'right';
              }
            } else {
              // Verse 1: straightforward taps with occasional hold
              if (item.length >= 1.0 && prng() < 0.4) {
                noteType = 'hold';
                holdDur = parseFloat((beatDuration * 1.0).toFixed(3));
              }
            }
          }

          pushNote({
            time: t,
            lane: targetLane,
            type: noteType,
            holdDuration: holdDur,
            swipeDirection: swipeDir,
          });
        }
        barIndex++;
        measureStart += measureDur;
      }
    }

    // ──────────────────────────────────────────
    // PRE-CHORUS: Riser Buildup & Pre-Drop Silence Vacuum
    // ──────────────────────────────────────────
    else if (sec.type === 'buildup') {
      let t = snap(sec.start, bpm, 8);
      const silenceStart = sec.end - beatDuration * 1.5; // 1.5 beats vacuum silence before drop

      while (t < silenceStart) {
        // Rapid crescendo alternation
        const progress = (t - sec.start) / (silenceStart - sec.start);
        const lane = progress > 0.6 ? (Math.round(t / beatDuration) % 3) : 1;
        const noteType = progress > 0.7 && prng() < 0.4 ? 'accent' : 'tap';

        pushNote({
          time: t,
          lane,
          type: noteType,
        });

        // Tighter spacing as we approach the drop (Deluxe accelerates to 0.5, Standard maintains 1.0)
        const step = progress > 0.5 ? (isDeluxe && difficulty >= 6 ? 0.5 : 1.0) : 1.0;
        t = snap(t + step * beatDuration, bpm, 16);
      }
    }

    // ──────────────────────────────────────────
    // CHORUS 1 & CHORUS 2 (CLIMAX): Thematic Drop, Remix Notes & Full Choreography
    // ──────────────────────────────────────────
    else if (sec.type === 'chorus') {
      const isClimax = sec.iteration === 2;

      // EXPLOSIVE DROP HIT on Beat 1
      const dropTime = snap(sec.start, bpm, 16);
      if (isClimax) {
        // Climax Drop: Signature REMIX Rune Note
        pushNote({
          time: dropTime,
          lane: 1,
          type: 'remix',
          remixEffect: REMIX_EFFECTS[Math.floor(prng() * REMIX_EFFECTS.length)],
        });
      } else {
        // Chorus 1 Drop: Heavy BREAK note (Dual hit only in Deluxe)
        pushNote({
          time: dropTime,
          lane: 0,
          type: 'break',
        });
        if (isDeluxe && difficulty >= 5) {
          pushNote({
            time: dropTime,
            lane: 2,
            type: 'tap',
          });
        }
      }

      let measureStart = snap(sec.start + beatDuration, bpm, 4);

      while (measureStart + measureDur < sec.end) {
        for (const item of chorusMotif) {
          const t = snap(measureStart + item.beat * beatDuration, bpm, 16);
          if (t >= sec.end - 1.0) break;

          let noteType = 'tap';
          let holdDur = undefined;
          let targetLane = undefined;
          let swipeDir = undefined;
          let zigzagAmp = undefined;

          if (isClimax) {
            if (isDeluxe) {
              // DELUXE CLIMAX OVERDRIVE: Slides, Zigzags, Hold-Swipes, Lifts, Mines
              const roll = prng();
              if (roll < 0.2) {
                // Cross-lane Slide
                noteType = 'slide';
                holdDur = parseFloat((beatDuration * 1.5).toFixed(3));
                targetLane = (item.lane + 1 + (prng() < 0.5 ? 1 : 0)) % 3;
              } else if (roll < 0.32 && difficulty >= 6) {
                // Zigzag Slide
                noteType = 'zigzag';
                holdDur = parseFloat((beatDuration * 2.0).toFixed(3));
                targetLane = (item.lane + 2) % 3;
                zigzagAmp = 1.0;
              } else if (roll < 0.48) {
                // Hold-Swipe
                noteType = 'hold-swipe';
                holdDur = parseFloat((beatDuration * 1.0).toFixed(3));
                swipeDir = SWIPE_DIRS[Math.floor(prng() * SWIPE_DIRS.length)];
              } else if (roll < 0.60) {
                // Directional Swipe (8 directions)
                noteType = 'swipe';
                swipeDir = item.lane === 0 ? 'left' : item.lane === 2 ? 'right' : 'up';
              } else if (roll < 0.72) {
                noteType = 'accent';
              } else if (roll < 0.80) {
                noteType = 'lift';
              }

              // Deluxe Hazard Mine placement on inactive lane (Stage 4 & 5 obstacle)
              if (difficulty >= 5 && prng() < 0.24 && noteType === 'tap') {
                const mineLane = (item.lane + 1) % 3;
                pushNote({
                  time: snap(t + beatDuration * 0.5, bpm, 16),
                  lane: mineLane,
                  type: 'mine',
                });
              }

              // Deluxe Anchor & Play counterpoint: Occasional dual downbeat
              if (difficulty >= 6 && item.archetype === 'downbeat' && prng() < 0.25) {
                const dualLane = (item.lane + 2) % 3;
                pushNote({
                  time: t,
                  lane: dualLane,
                  type: 'tap',
                });
              }
            } else {
              // STANDARD CLIMAX: Tapered back, melodic, readable (Smooth Slides, Swipes, Holds, Accents)
              const roll = prng();
              if (roll < 0.25) {
                noteType = 'slide';
                holdDur = parseFloat((beatDuration * 1.2).toFixed(3));
                targetLane = (item.lane + 1) % 3;
              } else if (roll < 0.50) {
                noteType = 'swipe';
                swipeDir = item.lane === 0 ? 'left' : item.lane === 2 ? 'right' : 'up';
              } else if (roll < 0.75) {
                noteType = 'hold';
                holdDur = parseFloat((beatDuration * 1.0).toFixed(3));
              } else if (roll < 0.88) {
                noteType = 'accent';
              } else {
                noteType = 'lift';
              }
            }
          } else {
            // Chorus 1: Medium-Hard mechanics (Swipes, Slides, Holds)
            const roll = prng();
            if (roll < 0.22) {
              noteType = 'slide';
              holdDur = parseFloat((beatDuration * 1.2).toFixed(3));
              targetLane = (item.lane + 1) % 3;
            } else if (roll < 0.42) {
              noteType = 'swipe';
              swipeDir = item.lane === 0 ? 'down' : item.lane === 2 ? 'up-right' : 'up';
            } else if (roll < 0.65) {
              noteType = 'hold';
              holdDur = parseFloat((beatDuration * 1.0).toFixed(3));
            } else if (roll < 0.78) {
              noteType = 'accent';
            }
          }

          pushNote({
            time: t,
            lane: item.lane,
            type: noteType,
            holdDuration: holdDur,
            targetLane,
            swipeDirection: swipeDir,
            zigzagAmplitude: zigzagAmp,
          });
        }
        measureStart += measureDur;
      }
    }

    // ──────────────────────────────────────────
    // BRIDGE / SOLO: Solo zigzags, breakbeats, lifts
    // ──────────────────────────────────────────
    else if (sec.type === 'bridge') {
      let measureStart = snap(sec.start, bpm, 4);

      // Start bridge with a Break note
      pushNote({
        time: measureStart,
        lane: 1,
        type: 'break',
      });

      while (measureStart + measureDur < sec.end) {
        for (const item of soloMotif) {
          const t = snap(measureStart + item.beat * beatDuration, bpm, 16);
          if (t >= sec.end) break;

          let noteType = 'tap';
          let holdDur = undefined;
          let targetLane = undefined;
          let swipeDir = undefined;
          let zigzagAmp = undefined;

          if (isDeluxe) {
            const roll = prng();
            if (roll < 0.25) {
              noteType = 'zigzag';
              holdDur = parseFloat((beatDuration * 1.5).toFixed(3));
              targetLane = (item.lane + 2) % 3;
              zigzagAmp = 1.2;
            } else if (roll < 0.45) {
              noteType = 'lift';
            } else if (roll < 0.65) {
              noteType = 'swipe';
              swipeDir = SWIPE_DIRS[Math.floor(prng() * SWIPE_DIRS.length)];
            } else if (roll < 0.8) {
              noteType = 'accent';
            }

            // Deluxe mode extra mine placement on bridge solo
            if (prng() < 0.16 && noteType === 'tap') {
              const mineLane = (item.lane + 1) % 3;
              pushNote({
                time: snap(t + beatDuration * 0.5, bpm, 16),
                lane: mineLane,
                type: 'mine',
              });
            }
          } else {
            // Standard mode bridge: melodic holds, lifts, and accents (zero mines, zero zigzags)
            const roll = prng();
            if (roll < 0.35) {
              noteType = 'hold';
              holdDur = parseFloat((beatDuration * 1.2).toFixed(3));
            } else if (roll < 0.60) {
              noteType = 'lift';
            } else if (roll < 0.80) {
              noteType = 'swipe';
              swipeDir = item.lane === 0 ? 'left' : 'right';
            } else {
              noteType = 'accent';
            }
          }

          pushNote({
            time: t,
            lane: item.lane,
            type: noteType,
            holdDuration: holdDur,
            targetLane,
            swipeDirection: swipeDir,
            zigzagAmplitude: zigzagAmp,
          });
        }
        measureStart += measureDur;
      }
    }

    // ──────────────────────────────────────────
    // OUTRO: Resolving descent to final hold
    // ──────────────────────────────────────────
    else if (sec.type === 'outro') {
      let t = snap(sec.start, bpm, 4);
      while (t < sec.end - beatDuration * 3) {
        pushNote({
          time: t,
          lane: (Math.round(t / beatDuration)) % 3,
          type: prng() < 0.3 ? 'swipe' : 'tap',
          swipeDirection: 'down',
        });
        t = snap(t + beatDuration * 2, bpm, 4);
      }

      // Final sustained resolution note
      pushNote({
        time: snap(sec.end - beatDuration * 2, bpm, 4),
        lane: 1,
        type: 'hold',
        holdDuration: parseFloat((beatDuration * 2.0).toFixed(3)),
      });
    }
  }

  // 4. Sort and re-index notes
  rawNotes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  rawNotes = rawNotes.map((n, i) => ({ ...n, id: i }));

  // 5. Stageify Pass (Applies 5-stage gating, transitions, density ramps, ergonomic clamping)
  const { notes: stageifiedNotes, stages } = stageifyNotes(rawNotes, duration, bpm, difficulty, { deluxe: isDeluxe });

  // Re-index final notes cleanly
  const finalNotes = stageifiedNotes.map((n, i) => ({ ...n, id: i }));

  return {
    ...song,
    notes: finalNotes,
    stages,
    deluxe: isDeluxe,
    timingProfile: isDeluxe ? "elite" : "standard",
  };
}

/**
 * Main Batch Runner
 */
async function main() {
  const args = process.argv.slice(2);
  const isTest = args.includes('--test');
  const daysArgIdx = args.indexOf('--days');
  const filterDays = daysArgIdx !== -1 && args[daysArgIdx + 1]
    ? args[daysArgIdx + 1].split(',').map(Number)
    : null;

  console.log(`\n============================================================`);
  console.log(`  PIM : th3v4ult — V5 FLAGSHIP BEATMAP GENERATOR`);
  console.log(`  Choreography, Motif Memory & Dual Edition (Std/Deluxe)`);
  console.log(`============================================================\n`);

  const files = fs.readdirSync(SONGS_DIR).filter(f => f.startsWith('day-') && f.endsWith('.json'));
  files.sort();

  const targetFiles = files.filter(f => {
    const dayNum = parseInt(f.replace('day-', '').replace('.json', ''), 10);
    if (filterDays) return filterDays.includes(dayNum);
    if (isTest) return [1, 50, 100, 200].includes(dayNum);
    return true;
  });

  console.log(`Targeting ${targetFiles.length} song(s) for V5 Standard + Deluxe generation...\n`);

  let totalStandardNotes = 0;
  let totalDeluxeNotes = 0;
  const standardMechanicCounts = {};
  const deluxeMechanicCounts = {};

  for (const file of targetFiles) {
    const filePath = path.join(SONGS_DIR, file);
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // 1. Generate Standard Edition (day-{N}.json)
    const standardSong = generateV5SongChart(rawData, { deluxe: false });
    const standardOutPath = path.join(V5_DIR, file);
    fs.writeFileSync(standardOutPath, JSON.stringify(standardSong, null, 2));

    totalStandardNotes += standardSong.notes.length;
    for (const n of standardSong.notes) {
      standardMechanicCounts[n.type] = (standardMechanicCounts[n.type] || 0) + 1;
    }

    // 2. Generate Deluxe Edition (day-{N}_deluxe.json)
    const deluxeSong = generateV5SongChart(rawData, { deluxe: true });
    const deluxeFileName = file.replace('.json', '_deluxe.json');
    const deluxeOutPath = path.join(V5_DIR, deluxeFileName);
    fs.writeFileSync(deluxeOutPath, JSON.stringify(deluxeSong, null, 2));

    totalDeluxeNotes += deluxeSong.notes.length;
    for (const n of deluxeSong.notes) {
      deluxeMechanicCounts[n.type] = (deluxeMechanicCounts[n.type] || 0) + 1;
    }

    if (isTest || targetFiles.length <= 5) {
      console.log(`✅ [${file}] "${standardSong.title}" — Std: ${standardSong.notes.length} notes, Dlx: ${deluxeSong.notes.length} notes (BPM: ${standardSong.bpm}, Diff: ${standardSong.difficultyLevel})`);
    }
  }

  // Also include test sandbox songs if they exist
  const specialSongs = ['transmission-001.json', 'signal-rising.json', 'break-of-light.json'];
  for (const sp of specialSongs) {
    const spPath = path.join(SONGS_DIR, sp);
    if (fs.existsSync(spPath)) {
      const rawData = JSON.parse(fs.readFileSync(spPath, 'utf8'));

      const standardSong = generateV5SongChart(rawData, { deluxe: false });
      fs.writeFileSync(path.join(V5_DIR, sp), JSON.stringify(standardSong, null, 2));

      const deluxeSong = generateV5SongChart(rawData, { deluxe: true });
      fs.writeFileSync(path.join(V5_DIR, sp.replace('.json', '_deluxe.json')), JSON.stringify(deluxeSong, null, 2));
    }
  }

  // Generate Dual-Edition Manifest
  const manifest = {
    variant: "v5_flagship",
    name: "Flagship Kinesthetic & Motif Master Edition",
    description: "Flagship procedural engine featuring two-thumb kinematic ergonomics, musical motif memory across song sections, frequency-to-lane spatialization, pre-drop tension vacuums, full note taxonomy integration, and dual Standard / Deluxe editions.",
    architecture: "Section Cadence Analyzer + Motif Memory Cache + Two-Thumb Kinematic Simulator + Stage 5 Progressive Gate + Touch Allocator State Machine",
    totalSongs: targetFiles.length,
    editions: {
      standard: {
        totalNotes: totalStandardNotes,
        avgNotesPerSong: (totalStandardNotes / Math.max(1, targetFiles.length)).toFixed(1),
        timingProfile: "standard",
        stage5Multiplier: 0.22,
        minSpacingMs: 135,
        supportedMechanics: Object.keys(standardMechanicCounts).sort(),
        mechanicDistribution: standardMechanicCounts,
      },
      deluxe: {
        totalNotes: totalDeluxeNotes,
        avgNotesPerSong: (totalDeluxeNotes / Math.max(1, targetFiles.length)).toFixed(1),
        timingProfile: "elite",
        stage5Multiplier: 0.10,
        minSpacingMs: 75,
        supportedMechanics: Object.keys(deluxeMechanicCounts).sort(),
        mechanicDistribution: deluxeMechanicCounts,
      }
    },
    // Backwards-compatible legacy keys
    totalNotes: totalStandardNotes,
    avgNotesPerSong: (totalStandardNotes / Math.max(1, targetFiles.length)).toFixed(1),
    supportedMechanics: Object.keys(standardMechanicCounts).sort(),
    mechanicDistribution: standardMechanicCounts,
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`\n============================================================`);
  console.log(`✨ V5 FLAGSHIP GENERATION COMPLETE (STANDARD & DELUXE)`);
  console.log(`📁 Target Directory: ${V5_DIR}`);
  console.log(`📊 Songs Processed:  ${targetFiles.length}`);
  console.log(`🎵 Std Total Notes:  ${totalStandardNotes} (avg ${(totalStandardNotes / Math.max(1, targetFiles.length)).toFixed(1)})`);
  console.log(`🔥 Dlx Total Notes:  ${totalDeluxeNotes} (avg ${(totalDeluxeNotes / Math.max(1, targetFiles.length)).toFixed(1)})`);
  console.log(`============================================================\n`);
}

main().catch(err => {
  console.error("FATAL ERROR in generate_v5_flagship:", err);
  process.exit(1);
});
