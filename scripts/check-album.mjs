#!/usr/bin/env node
/**
 * Checks the Chapter Album rules (src/platform/playgama/albumRules.ts)
 * against the spec: first-pack guarantees, the tenth-pack Rare guarantee,
 * same-pack duplicates, shards and crafting, stamps, double-award guards and
 * reload safety. Also simulates sustained play for the cost review.
 *
 *   npm run check:album
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'album-')), 'rules.mjs');
await build({ entryPoints: [path.join(root, 'src/platform/playgama/albumRules.ts')], bundle: true, format: 'esm', platform: 'node', outfile: outFile, logLevel: 'error' });
const A = await import(pathToFileURL(outFile).href);

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}\n${err.stack}`);
    process.exitCode = 1;
  }
};

// Seeded RNG so failures repeat.
function seeded(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 2 ** 32;
  };
}
const constant = (v) => () => v;
const regular = Array.from({ length: 26 }, (_, i) => `day-${String(i + 1).padStart(3, '0')}`);
const bonus = Array.from({ length: 5 }, (_, i) => `day-${String(27 + i).padStart(3, '0')}`);
const pool = { regular, bonus, bonusOpen: [] };
const finish = (over = {}) => ({ runId: `r${Math.random()}`, songId: regular[0], failed: false, participation: 0.8, mode: 'relaxed', assisted: false, medal: 'NONE', deluxe: false, ...over });
const fresh = () => A.emptyAlbum('m1', false, 0);

test('first finish: slot 1 is the entry Common, first-ever pack slot 2 Uncommon', () => {
  const r = A.rewardFinish(fresh(), finish({ songId: regular[4] }), pool, constant(0.01));
  assert.equal(r.packs.length, 1);
  const [c1, c2, c3] = r.packs[0].cards;
  assert.deepEqual([c1.songId, c1.r, c1.why], [regular[4], 0, 'entry']);
  assert.equal(c2.r, 1);
  assert.equal(c2.why, 'first_pack');
  assert.equal(c3.why, 'roll');
  assert.equal(r.stamp, false, 'first finish gives no stamp');
});

test('second pack has no Uncommon guarantee', () => {
  let s = A.rewardFinish(fresh(), finish({ songId: regular[0] }), pool, constant(0.01)).state;
  const r = A.rewardFinish(s, finish({ songId: regular[1] }), pool, constant(0.01));
  assert.deepEqual(r.packs[0].cards.map((c) => c.r), [0, 0, 0]);
});

test('bonus entries only drop once unlocked', () => {
  const r = A.rewardFinish(fresh(), finish(), pool, seeded(3));
  let s = r.state;
  for (let i = 0; i < 200; i++) s = A.awardPack(s, { source: 'stamps', runId: `x${i}`, pool, rng: seeded(i + 9) }).state;
  assert.ok(bonus.every((id) => !s.got[id]), 'locked bonus never drops');
  const open = { ...pool, bonusOpen: [bonus[0]] };
  for (let i = 0; i < 300; i++) s = A.awardPack(s, { source: 'stamps', runId: `y${i}`, pool: open, rng: seeded(i + 999) }).state;
  assert.ok(s.got[bonus[0]], 'unlocked bonus drops');
  assert.ok(bonus.slice(1).every((id) => !s.got[id]));
});

test('tenth pack since the last Rare forces a Rare in the final random slot', () => {
  let s = fresh();
  const noRare = constant(0.01); // always Common, first entry
  for (let i = 0; i < 9; i++) {
    const r = A.awardPack(s, { source: 'stamps', runId: `p${i}`, pool, rng: noRare });
    assert.ok(!r.pack.cards.some((c) => c.r === 2));
    s = r.state;
  }
  assert.equal(s.sinceRare, 9);
  const r = A.awardPack(s, { source: 'first_finish', songId: regular[3], runId: 'p10', pool, rng: noRare });
  assert.equal(r.pack.cards[0].r, 0, 'entry slot untouched');
  assert.equal(r.pack.cards[2].r, 2);
  assert.equal(r.pack.cards[2].why, 'pity');
  assert.equal(r.pack.cards.length, 3, 'forced Rare replaces, does not add');
  assert.equal(r.state.sinceRare, 0);
  assert.equal(r.pack.pityBefore, 9);
});

test('any Rare resets the counter; no pack run longer than 10 without one', () => {
  let s = fresh();
  const rng = seeded(42);
  let run = 0;
  let maxRun = 0;
  for (let i = 0; i < 5000; i++) {
    const r = A.awardPack(s, { source: 'stamps', runId: `q${i}`, pool, rng });
    s = r.state;
    run = r.pack.cards.some((c) => c.r === 2) ? 0 : run + 1;
    assert.equal(s.sinceRare, run);
    maxRun = Math.max(maxRun, run);
  }
  assert.ok(maxRun <= 9, `longest run without Rare was ${maxRun}`);
});

test('duplicates in the same pack resolve in order into shards', () => {
  // rng 0 -> first entry, Common every slot.
  const r = A.awardPack({ ...fresh(), packsAwarded: 1 }, { source: 'stamps', runId: 'd', pool, rng: constant(0) });
  const cards = r.pack.cards;
  assert.ok(cards.every((c) => c.songId === regular[0]));
  assert.deepEqual(cards.map((c) => c.dup), [false, true, true]);
  assert.equal(r.state.shards, 2);
  assert.deepEqual(r.state.got[regular[0]], [3, 0, 0]);
  assert.deepEqual(r.state.fresh, [`${regular[0]}:0`]);
});

test('shard values per rarity', () => {
  assert.deepEqual([...A.DUPE_SHARDS], [1, 3, 9]);
  assert.deepEqual([...A.CRAFT_COST], [6, 12, 30]);
});

test('crafting: costs, never owned variants, never below zero, no pity change', () => {
  let s = { ...fresh(), shards: 11, sinceRare: 4 };
  assert.equal(A.canCraft(s, regular[2], 1, pool), 'shards');
  assert.equal(A.craft(s, regular[2], 1, pool), null);
  const c = A.craft(s, regular[2], 0, pool);
  assert.equal(c.shards, 5);
  assert.equal(c.sinceRare, 4);
  assert.equal(c.packsAwarded, 0);
  assert.equal(A.canCraft(c, regular[2], 0, pool), 'owned');
  assert.equal(A.craft(c, regular[2], 0, pool), null);
  assert.equal(A.canCraft({ ...c, shards: 99 }, bonus[0], 0, pool), 'locked');
  assert.equal(s.shards, 11, 'input state untouched');
});

test('replay stamps: one per valid replay, three make a pack, remainder kept', () => {
  let s = A.rewardFinish(fresh(), finish({ songId: regular[0] }), pool, seeded(1)).state;
  const packsAfterFirst = s.packsAwarded;
  for (let i = 0; i < 4; i++) {
    const r = A.rewardFinish(s, finish({ songId: regular[0], runId: `rep${i}` }), pool, seeded(i));
    assert.equal(r.stamp, true);
    s = r.state;
    if (i === 2) assert.equal(r.packs.length, 1, 'third stamp converts');
  }
  assert.equal(s.packsAwarded, packsAfterFirst + 1);
  assert.equal(s.stamps, 1);
});

test('same run or reload never awards twice', () => {
  const run = finish({ runId: 'same', songId: regular[1] });
  const a = A.rewardFinish(fresh(), run, pool, seeded(5));
  const b = A.rewardFinish(a.state, run, pool, seeded(6));
  assert.equal(b.packs.length, 0);
  assert.equal(b.stamp, false);
  assert.equal(b.state, a.state);
  // Reload: the saved JSON comes back with the same cards.
  const reloaded = A.parseAlbum(JSON.stringify(a.state), 'm1');
  assert.deepEqual(reloaded.packs, a.state.packs);
  assert.equal(A.rewardFinish(reloaded, run, pool, seeded(7)).packs.length, 0);
});

test('first-finish and platinum packs once per entry; both on the same run', () => {
  const plat = finish({ mode: 'standard', medal: 'PLATINUM', songId: regular[2], runId: 'a' });
  const r = A.rewardFinish(fresh(), plat, pool, seeded(8));
  assert.deepEqual(r.packs.map((p) => p.source), ['first_finish', 'platinum']);
  const again = A.rewardFinish(r.state, { ...plat, runId: 'b' }, pool, seeded(9));
  assert.deepEqual(again.packs.map((p) => p.source), [], 'replay platinum: only a stamp');
  assert.equal(again.stamp, true);
});

test('assisted, relaxed or deluxe platinum never award the platinum pack', () => {
  for (const over of [{ assisted: true }, { mode: 'relaxed' }, { deluxe: true }]) {
    const r = A.rewardFinish(fresh(), finish({ mode: 'standard', medal: 'PLATINUM', ...over }), pool, seeded(10));
    assert.ok(!r.packs.some((p) => p.source === 'platinum'), JSON.stringify(over));
  }
});

test('fails, quits and low participation give nothing; low participation says why', () => {
  assert.equal(A.rewardFinish(fresh(), finish({ failed: true }), pool, seeded(1)).packs.length, 0);
  const low = A.rewardFinish(fresh(), finish({ participation: 0.29 }), pool, seeded(1));
  assert.equal(low.packs.length, 0);
  assert.equal(low.withheld, true);
  assert.equal(A.rewardFinish(fresh(), finish({ participation: 0.3 }), pool, seeded(1)).packs.length, 1);
});

test('unopened pack cards stay hidden in the album until opened', () => {
  const r = A.rewardFinish(fresh(), finish({ songId: regular[6] }), pool, seeded(2));
  const hidden = A.hiddenVariants(r.state);
  assert.ok(hidden.has(`${regular[6]}:0`));
  assert.equal(A.completion(r.state, pool).regularOwned, 0);
  const opened = A.markOpened(r.state, r.packs[0].id);
  assert.equal(A.hiddenVariants(opened).size, 0);
  assert.ok(A.completion(opened, pool).regularOwned >= 1);
});

test('saves from another chapter or a damaged save are refused', () => {
  const s = JSON.stringify(fresh());
  assert.equal(A.parseAlbum(s, 'm2'), null);
  assert.equal(A.parseAlbum('{oops', 'm1'), null);
  assert.equal(A.parseAlbum(JSON.stringify({ ...fresh(), shards: -5 }), 'm1').shards, 0);
});

test('migrated players: notice pending, no retroactive packs', () => {
  const s = A.emptyAlbum('m1', true, 0);
  assert.equal(s.noticeSeen, false);
  assert.equal(s.packs.length, 0);
});

// Section 9: progress after 5, 10 and 20 completed entries, and over a long stretch.
function simulate(seed, finishes, replaysPerEntry) {
  const rng = seeded(seed);
  let s = fresh();
  let runs = 0;
  let firstCraft = null;
  const snaps = {};
  for (let e = 0; e < finishes; e++) {
    for (let k = 0; k <= replaysPerEntry; k++) {
      runs++;
      s = A.rewardFinish(s, finish({ songId: regular[e % 26], runId: `s${runs}` }), pool, rng).state;
      for (const p of s.packs) if (!p.opened) s = A.markOpened(s, p.id);
      // Craft whenever possible, cheapest missing first.
      for (const r of [0, 1, 2]) for (const id of regular) {
        if (A.canCraft(s, id, r, pool) === 'ok') {
          s = A.craft(s, id, r, pool);
          firstCraft ??= runs;
        }
      }
    }
    if ([5, 10, 20, 26].includes(e + 1)) snaps[e + 1] = A.completion(s, pool);
  }
  return { s, snaps, firstCraft, runs };
}
console.log('\n  simulation (median of 25 seeds, regular album 26 entries / 78 variants):');
for (const replays of [0, 1, 3]) {
  const results = Array.from({ length: 25 }, (_, i) => simulate(i + 100, 26, replays));
  const med = (f) => { const v = results.map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const line = [5, 10, 20, 26].map((n) => `after ${n}: ${med((r) => r.snaps[n].regularOwned)} entries, ${med((r) => r.snaps[n].regularVariants)} variants`).join(' | ');
  console.log(`    ${replays} replays per entry -> ${line}; first craft at run ${med((r) => r.firstCraft ?? Infinity)}`);
}

console.log(`\n${passed} album checks passed${process.exitCode ? ', some FAILED' : ''}.`);
