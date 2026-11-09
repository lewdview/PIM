import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { handleStripeWebhook } from './handler.ts';

// This function NEVER mints or credits independently. Browser callbacks and webhooks
// share vault-engine's database transaction and Stripe session receipt.
serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('STRIPE_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY_TEST');
  const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const base = Deno.env.get('SUPABASE_URL');
  if (!secret || !signingSecret || !serviceKey || !base) return new Response('Webhook configuration missing', { status: 503 });
  const stripe = new Stripe(secret, { httpClient: Stripe.createFetchHttpClient() });
  return handleStripeWebhook(req, {
    verify: (body, signature) => stripe.webhooks.constructEventAsync(body, signature, signingSecret,
      undefined, Stripe.createSubtleCryptoProvider()),
    fulfill: async (sessionId) => {
      const response = await fetch(`${base}/functions/v1/vault-engine`, {
        method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verifyStripeSession', payload: { sessionId } }),
        signal: AbortSignal.timeout(90_000),
      });
      const result = await response.json();
      return response.ok && result.success === true;
    },
  });
});
