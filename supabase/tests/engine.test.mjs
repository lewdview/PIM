// Exercise the actual engine orchestration with stubbed external I/O, not a copy
// of its algorithms. Node 22.6+ with --experimental-strip-types is required.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformWithEsbuild } from 'vite';

const root = new URL('../functions/vault-engine/', import.meta.url);
let source = await fs.readFile(new URL('index.ts', root), 'utf8');
source = source
  .replace(/^import \{ serve \} from "https:[^\n]+;/m, 'const serve = () => {};')
  .replace(/^import \{ createClient \} from "https:[^\n]+;/m, 'const createClient = () => { throw new Error("Unexpected network client"); };')
  .replace(/^import Stripe from "https:[^\n]+;/m, 'class Stripe {}');
source += '\nexport { generateCards, mintReceipt, settleStripe };';
const { code } = await transformWithEsbuild(source, 'engine.ts', { format: 'esm', target: 'node22' });
const temp = new URL(`.engine-test-${crypto.randomUUID()}.mjs`, root);
globalThis.Deno = { env: { get: () => undefined } };
await fs.writeFile(temp, code);
let engine;
try { engine = await import(pathToFileURL(fileURLToPath(temp)).href); }
finally { await fs.unlink(temp); delete globalThis.Deno; }

function database({ failed = false, completed = false } = {}) {
  const calls = [];
  const cached = { success: true, cards: [{ id: 'existing-card' }] };
  const svc = {
    calls,
    from(table) {
      calls.push(['read', table]);
      const answer = table === 'admin_config'
        ? { data: { config: { echoSystem: { echoChance: 0 }, ultraRewardChance: 0 } } }
        : table === 'profiles' ? { data: { total_pulls: 5 } } : { data: [], count: 0 };
      const query = new Proxy({}, { get: (_, key) => {
        if (key === 'then') return (resolve) => resolve(answer);
        if (key === 'single' || key === 'maybeSingle') return async () => answer;
        if (['insert', 'update', 'delete', 'upsert'].includes(String(key))) {
          return () => { throw new Error(`Non-transactional ${table} write`); };
        }
        return () => query;
      } });
      return query;
    },
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === 'begin_vault_fulfillment') return { data: completed
        ? { status: 'completed', result: cached }
        : { status: 'reserved', key: args.p_key, lease: 'lease', category: args.p_category, size: args.p_size, details: args.p_details } };
      if (name === 'complete_vault_fulfillment') return failed ? { error: { message: 'DB rollback' } }
        : { data: { success: true, verifiedReward: true, cards: args.p_cards.map((c, i) => ({ ...c, id: `card-${i}` })) } };
      if (name === 'release_vault_fulfillment') return { data: null };
      throw new Error(`Non-transactional RPC ${name}`);
    },
  };
  return svc;
}
const spec = { key: 'test', owner: '11111111-1111-4111-8111-111111111111', kind: 'run_reward', category: 'taste', size: 'single', details: { recordId: 'run' } };

test('real pack preparation defers cards, counters and supply to one settlement', async () => {
  const svc = database();
  const result = await engine.mintReceipt(svc, spec, 200);
  assert.equal(result.cards.length, 2, 'Taste single retains its existing two cards');
  assert.ok(result.cards.every((c) => /^\d+-(common|uncommon|rare|legendary|mythic)$/.test(c._supply_key)));
  assert.equal(svc.calls.filter(([n]) => n === 'complete_vault_fulfillment').length, 1);
});

test('actual orchestration releases failed uncommitted work and does not claim success', async () => {
  const svc = database({ failed: true });
  await assert.rejects(engine.mintReceipt(svc, spec, 200), /DB rollback/);
  assert.equal(svc.calls.filter(([n]) => n === 'release_vault_fulfillment').length, 1);
});

test('replaying a completed operation returns stored cards without rerolling', async () => {
  const svc = database({ completed: true });
  assert.deepEqual(await engine.mintReceipt(svc, spec, 200), { success: true, cards: [{ id: 'existing-card' }] });
  assert.equal(svc.calls.length, 1);
});
