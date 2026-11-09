import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutPlan, checkoutOwner, beginFulfillment, completeFulfillment } from '../functions/vault-engine/fulfillment.ts';
import { handleStripeWebhook } from '../functions/stripe-webhook/handler.ts';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const catalog = { taste: { tiers: { single: { priceCents: 25, cardCount: 2 } } },
  token_bundle: { tiers: { pouch: { priceCents: 99, tokenAmount: 200, cardCount: 0 } } } };
const paid = () => ({ id: 'cs_paid', mode: 'payment', payment_status: 'paid', currency: 'usd', amount_total: 25,
  client_reference_id: owner, metadata: { userId: owner, packCategory: 'taste', packSize: 'single' } });

test('purchaser comes only from Stripe, including service-role webhook calls', () => {
  assert.equal(checkoutOwner(paid(), owner), owner);
  assert.equal(checkoutOwner(paid(), null), owner);
  assert.throws(() => checkoutOwner(paid(), other), /another account/);
  assert.throws(() => checkoutOwner({ ...paid(), metadata: { userId: other } }, owner), /disagrees/);
  assert.throws(() => checkoutOwner({ ...paid(), client_reference_id: null, metadata: {} }, null));
});

test('unpaid, wrong-currency, insufficient, unknown and malformed orders fail closed', () => {
  for (const override of [{ payment_status: 'unpaid' }, { mode: 'setup' }, { currency: 'eur' }, { amount_total: 24 },
    { amount_total: NaN }, { metadata: { userId: owner, packCategory: 'unknown', packSize: 'single' } },
    { metadata: { ...paid().metadata, kind: 'not-a-claw' } }]) {
    assert.throws(() => checkoutPlan({ ...paid(), ...override }, owner, catalog));
  }
});

test('pack and token quantities come from the server catalog, not request metadata', () => {
  assert.equal(checkoutPlan({ ...paid(), metadata: { ...paid().metadata, cardCount: '500' } }, owner, catalog).count, 2);
  const token = { ...paid(), amount_total: 99, metadata: { userId: owner, packCategory: 'token_bundle', packSize: 'pouch', tokenAmount: '100000' } };
  assert.equal(checkoutPlan(token, owner, catalog).tokens, 200);
});

test('claw checkout buys exactly one credit and no cards', () => {
  const claw = { ...paid(), amount_total: 99, metadata: { userId: owner, kind: 'claw_pull', pulls: '1' } };
  const plan = checkoutPlan(claw, owner, catalog);
  assert.equal(plan.category, 'claw_pull'); assert.equal(plan.count, 0);
  assert.throws(() => checkoutPlan({ ...claw, metadata: { ...claw.metadata, pulls: '5' } }, owner, catalog));
});

test('busy reservations and failed settlements cannot look like successful minting', async () => {
  const spec = { key: 'x', owner, kind: 'stripe', category: 'taste' };
  await assert.rejects(beginFulfillment({ rpc: async () => ({ data: { status: 'busy' } }) }, spec), /progress/);
  await assert.rejects(completeFulfillment({ rpc: async () => ({ error: { message: 'rollback' } }) }, { key: 'x', lease: 'y' }, []), /rollback/);
  await assert.rejects(completeFulfillment({ rpc: async () => ({ data: null }) }, { key: 'x', lease: 'y' }, []));
});

const request = () => new Request('https://example.com/hook', { method: 'POST', body: 'raw signed body', headers: { 'stripe-signature': 'sig' } });
const event = (type = 'checkout.session.completed', status = 'paid') => ({ type, data: { object: { id: 'cs_paid', payment_status: status } } });

test('invalid signatures never invoke fulfillment', async () => {
  let called = false;
  const res = await handleStripeWebhook(request(), { verify: async () => { throw new Error('bad'); }, fulfill: async () => { called = true; return true; } });
  assert.equal(res.status, 400); assert.equal(called, false);
});

test('unpaid and irrelevant signed events do not mint', async () => {
  for (const ev of [event('checkout.session.completed', 'unpaid'), event('customer.created')]) {
    let called = false;
    const res = await handleStripeWebhook(request(), { verify: async () => ev, fulfill: async () => { called = true; return true; } });
    assert.equal(res.status, 200); assert.equal(called, false);
  }
});

test('both supported paid events use the same checkout settlement', async () => {
  for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
    const res = await handleStripeWebhook(request(), { verify: async (body, sig) => {
      assert.equal(body, 'raw signed body'); assert.equal(sig, 'sig'); return event(type);
    }, fulfill: async (id) => { assert.equal(id, 'cs_paid'); return true; } });
    assert.equal(res.status, 200);
  }
});

test('unconfirmed settlement asks Stripe to retry', async () => {
  for (const fulfill of [async () => false, async () => { throw new Error('network'); }]) {
    assert.equal((await handleStripeWebhook(request(), { verify: async () => event(), fulfill })).status, 503);
  }
});
