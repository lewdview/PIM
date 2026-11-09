/** Keep signature verification before any side effects, and acknowledge only confirmed settlement. */
export async function handleStripeWebhook(req: Request, deps: {
  verify: (body: string, signature: string) => Promise<any>;
  fulfill: (sessionId: string) => Promise<boolean>;
}): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let event: any;
  try { event = await deps.verify(await req.text(), req.headers.get('stripe-signature') || ''); }
  catch { return new Response('Invalid Stripe signature', { status: 400 }); }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    return Response.json({ received: true });
  }
  const session = event.data.object;
  if (session.payment_status !== 'paid') return Response.json({ received: true });
  try {
    if (!await deps.fulfill(session.id)) throw new Error('Unconfirmed settlement');
    return Response.json({ received: true });
  } catch {
    return new Response('Settlement not confirmed; retry required', { status: 503 });
  }
}
