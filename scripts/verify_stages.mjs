#!/usr/bin/env node
/**
 * Verify stage distribution and mechanic gating for test JSONs.
 * Run after enhance_all_charts.js to confirm the pipeline is fixed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const songsDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../public/data/songs');

const testFiles = ['day-001.json', 'day-050.json', 'day-100.json', 'day-200.json'];

for (const file of testFiles) {
  const filePath = path.join(songsDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`\n=== ${file} NOT FOUND ===`);
    continue;
  }

  const song = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const notes = song.notes || [];
  const diff = song.difficultyLevel || '?';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${file}  |  "${song.title}"  |  BPM: ${song.bpm}  |  Difficulty: ${diff}  |  Notes: ${notes.length}`);
  console.log(`${'='.repeat(60)}`);

  // Stage distribution
  const stageCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, missing: 0 };
  notes.forEach(n => {
    if (n.stage && stageCounts[n.stage] !== undefined) {
      stageCounts[n.stage]++;
    } else {
      stageCounts.missing++;
    }
  });

  console.log('\nStage Distribution:');
  for (const [stage, count] of Object.entries(stageCounts)) {
    if (stage === 'missing') {
      if (count > 0) console.log(`  ⚠ MISSING stage: ${count} notes`);
    } else {
      const pct = notes.length > 0 ? ((count / notes.length) * 100).toFixed(1) : '0';
      console.log(`  Stage ${stage}: ${count} notes (${pct}%)`);
    }
  }

  // Mechanic distribution per stage
  console.log('\nMechanic Types per Stage:');
  const mechByStage = {};
  notes.forEach(n => {
    const s = n.stage || 0;
    if (!mechByStage[s]) mechByStage[s] = {};
    const t = n.type || 'tap';
    mechByStage[s][t] = (mechByStage[s][t] || 0) + 1;
  });

  for (const stage of [1, 2, 3, 4, 5]) {
    const mechs = mechByStage[stage] || {};
    const parts = Object.entries(mechs).map(([t, c]) => `${t}:${c}`).join(', ');
    console.log(`  Stage ${stage}: ${parts || '(empty)'}`);
  }

  // Violations check
  const violations = [];
  notes.forEach(n => {
    if (!n.stage) {
      violations.push(`Note id=${n.id} at t=${n.time} has no stage`);
    }
    if (n.stage === 1 && n.type !== 'tap') {
      violations.push(`Stage 1 violation: ${n.type} at t=${n.time}`);
    }
    if (n.stage === 2 && ['swipe', 'mine', 'remix', 'break', 'lift'].includes(n.type)) {
      violations.push(`Stage 2 violation: ${n.type} at t=${n.time}`);
    }
    if (n.stage <= 3 && n.type === 'mine') {
      violations.push(`Mine in Stage ${n.stage} at t=${n.time}`);
    }
  });

  if (violations.length === 0) {
    console.log('\n✅ No mechanic violations detected!');
  } else {
    console.log(`\n❌ ${violations.length} VIOLATIONS:`);
    violations.slice(0, 10).forEach(v => console.log(`   ${v}`));
    if (violations.length > 10) console.log(`   ... and ${violations.length - 10} more`);
  }

  // Stage metadata check
  if (song.stages) {
    console.log('\nStages metadata:');
    song.stages.forEach(s => {
      console.log(`  ${s.name} (${s.difficulty}): ${s.startTime?.toFixed(1)}s-${s.endTime?.toFixed(1)}s, ${s.noteCount} notes`);
    });
  } else {
    console.log('\n⚠ No stages metadata array in JSON');
  }
}
