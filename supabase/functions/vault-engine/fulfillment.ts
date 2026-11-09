/** Shared settlement protocol. Cards, credits and receipts commit in one DB transaction. */
export type Fulfillment = {
  key: string;
  lease: string;
};

export function checkoutOwner(session: any, caller: string | null): string {
  const owner = session.client_reference_id || session.metadata?.userId;
  if (!owner || !/^[0-9a-f-]{36}$/i.test(owner)) throw new Error('Checkout has no valid purchaser');
  if (session.client_reference_id && session.metadata?.userId && session.client_reference_id !== session.metadata.userId) {
    throw new Error('Checkout purchaser metadata disagrees');
  }
  if (caller && caller !== owner) throw new Error('Unauthorized: checkout belongs to another account');
  return owner;
}

export function checkoutPlan(session: any, caller: string | null, catalog: any) {
  const owner = checkoutOwner(session, caller);
  if (session.payment_status !== 'paid' || session.mode !== 'payment') throw new Error('Payment not completed');
  const claw = session.metadata?.kind === 'claw_pull';
  if (session.metadata?.kind && !claw) throw new Error('Unknown checkout kind');
  const category = claw ? 'claw_pull' : session.metadata?.packCategory;
  const size = claw ? 'single' : session.metadata?.packSize;
  const tier = claw ? { priceCents: 99, cardCount: 0, tokenAmount: 0 } : catalog[category]?.tiers[size];
  if (!tier || session.currency !== 'usd' || !Number.isSafeInteger(session.amount_total) || session.amount_total < tier.priceCents) {
    throw new Error('Checkout amount, currency or product does not match');
  }
  if (claw && session.metadata?.pulls !== '1') throw new Error('Invalid claw pull quantity');
  return { owner, category, size, count: tier.cardCount, tokens: tier.tokenAmount || 0,
    details: { sessionId: session.id, amountCents: session.amount_total, currency: session.currency,
      tokenAmount: tier.tokenAmount || 0, pulls: claw ? 1 : 0 } };
}

export async function beginFulfillment(svc: any, spec: {
  key: string; owner: string; kind: string; category: string; size?: string; details?: any;
}): Promise<any> {
  const { data, error } = await svc.rpc('begin_vault_fulfillment', {
    p_key: spec.key, p_owner: spec.owner, p_kind: spec.kind,
    p_category: spec.category, p_size: spec.size || 'single', p_details: spec.details || {},
  });
  if (error) throw new Error(error.message);
  if (!data || data.status === 'busy') throw new Error('Fulfillment in progress; retry the same request');
  return data;
}

export async function completeFulfillment(svc: any, op: Fulfillment, cards: any[]): Promise<any> {
  const { data, error } = await svc.rpc('complete_vault_fulfillment', {
    p_key: op.key, p_lease: op.lease, p_cards: cards,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error('Fulfillment did not complete');
  return data;
}

export async function releaseFulfillment(svc: any, op: Fulfillment): Promise<void> {
  // Fenced deletion cannot remove a committed receipt or a newer retry's reservation.
  await svc.rpc('release_vault_fulfillment', { p_key: op.key, p_lease: op.lease });
}
