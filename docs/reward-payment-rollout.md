# Reward and payment reconciliation

This branch builds on merged #247 and supersedes the overlapping implementation
in open #212. Do not merge #212 over this branch: it uses a different grant ledger
and a time-expiring Stripe lock that does not atomically commit the minted cards.

## Resulting behavior

- Run rewards require a recent submitted clear belonging to the caller. Platinum
  receives all earned tiers; other medals receive their earned tier. Song ownership
  or the existing 10-shard Award Play unlock is checked on the server. Verified
  rewards skip shop daily caps, retaining the current pack contents and odds.
- Campaign rewards send month/milestone explicitly, require campaign clears backed
  by submitted clears, and can pay only once per milestone. This corroborates clears;
  it does not prove that the submitted play was in campaign mode, because the current
  score records do not authoritatively record that mode.
- Browser Stripe returns and the signature-verified webhook both invoke the same
  settlement. The purchaser and product come from the retrieved Stripe session,
  never caller-supplied category, quantity or user ID. Completed legacy receipts
  are honored only for their recorded owner. Anonymous receipt retrieval is refused.
- A Stripe checkout produces its purchased pack, spark bundle, or ONE claw credit.
  It cannot fulfill as a different product or credit/mint twice.
- Claw pulls use a persistent per-account request UUID. A lost response can be
  retried without another debit. The server picks the prize. A lost grip consumes
  one credit under the existing rule; failed minting consumes none.
- The settlement transaction commits cards, supply/echo allocation, counters,
  reward ledgers, credit debit and receipt together. Failed batches roll back together.
  Supply exhaustion fails the operation safely rather than inserting duplicate
  capped editions; retry recalculates the pack from the current supply.
- Five-minute leases permit retrying abandoned work. A new lease fences the old
  worker: an expired worker cannot later commit or release a newer attempt.
- A database trigger serializes actual Ultra inserts across every mint path and
  enforces `admin_config.ultraRewardMax` (default 5). It leaves existing over-cap
  awards untouched. It does not use expiring reservations that can overbook slots.

No change is made to the separate Playgama chapter album, its local save economy,
or its platform payments.

## Checks run locally

```
npm run test:rewards
python -m pip install pgserver psycopg2-binary
npm run test:rewards:sql
npm run build
```

The SQL suite starts PostgreSQL 16 and executes the actual new migration twice.
It uses a minimal schema for the referenced Supabase tables/RPCs, not a production
schema dump. Concurrent connections exercise payout/credit races and the Ultra cap.
The Node suites also exercise actual engine pack preparation with external I/O stubbed.
They check purchaser/product validation, webhook dispatch, failure
acknowledgement and RPC errors. It mocks the signature-verification dependency;
Stripe's actual SDK verifies raw request bodies in the deployed webhook.

This environment has no connected Supabase or Stripe administration tools. These
checks are not evidence that a migration, webhook or function is deployed, nor a
live purchase/refund test. Existing repository-wide TypeScript errors are reported
separately from the production Vite build.

## Coordinated cutover (administrator)

1. Record the current vault-engine and stripe-webhook versions and the current
   active Stripe endpoint. Back up the database; run the read-only
   `supabase/queries/reward_payment_audit.sql`. Preserve old fulfillment receipts.
   Check the deployed column types against this migration, especially collection
   `proof`, `fingerprint`, `ultra_reward`, and profile counters. Rehearse on a
   staging copy with the existing constraints/triggers.
2. Stop new checkout/claim traffic and pause the OLD Stripe webhook delivery.
   Drain existing invocations. An old webhook that independently mints bypasses
   the new protocol; running both implementations together is unsafe. Stripe's
   pending deliveries must be replayed after the new endpoint is ready.
3. Confirm #247's `20261106120000_gameplay_reward_payouts.sql` and the claw migration
   `20261104090000_claw_pulls.sql` are already applied, as well as the repository's
   prior score-authority, claims and campaign migrations. Apply ONLY the new
   `20261109090000_reward_payment_reconciliation.sql` for this change. There is no
   need to apply #212's unmerged migrations. If they were applied out of band,
   the new code also checks that legacy song grant ledger.
4. Deploy this vault-engine, then this stripe-webhook. Webhook gateway JWT
   verification must be disabled (Stripe signatures are verified by the handler):

   ```
   supabase functions deploy vault-engine
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

   Required secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` (or the test variant), and
   `STRIPE_WEBHOOK_SECRET` for the active endpoint. Keep them out of source control.
   In Stripe, subscribe to `checkout.session.completed` and
   `checkout.session.async_payment_succeeded`.
5. Ship the frontend together with the backend. Old reward clients without proof
   and old claw clients without a request UUID are intentionally refused, with
   reload/retry errors, rather than using an unsafe compatibility path.
6. In Stripe TEST mode/staging, verify a pack, spark bundle and claw purchase;
   send each return callback and signed webhook repeatedly and concurrently.
   Verify one entitlement, one receipt and the correct purchaser. Test another
   account's session ID, unpaid sessions, delayed payment, a failed DB insert,
   a lost response, and a cancelled checkout. Do not make a real charge as a test.
7. Verify five reward tiers with shop caps already exhausted; retry the same run,
   use a different qualifying run for the same song, and deliberately fail one
   mint. Verify only unpaid earned tiers can retry, and campaign milestones cannot
   pay twice. Test zero claw credits and a failed mint: balances must not go negative.
8. Re-enable the NEW webhook, replay pending paid deliveries through it, then
   reopen new checkouts. Compare Stripe sessions, receipts, actual collection rows,
   claw grants and player balances. Check the Ultra count before/after concurrent
   pack opens. Existing seven awards should remain seven, with no additional award
   while the configured cap is five.

Rollback must keep the new settlement backend while disabling new purchase/claim
entry points. Restoring an old minting webhook or an unchecked reward client path
reintroduces double fulfillment. Never delete receipts to retry a payment.

## Historical missing rewards and over-cap awards

The #247 backfill marked inferred lower Platinum tiers paid, even when an old
daily cap refused those cards. Neither a highest-tier gameplay record nor a null
`record_id` is proof that a particular lower-tier card was actually received.
The audit reports candidates; it must not automatically issue refunds or cards.

For each reported loss, preserve the player, song, tier, run timestamp, expected
versus actual cards, relevant telemetry, and the operator's decision. Correlate
collection rows by source and time, while noting that an unrelated pack can share
the same source. Once the operator confirms a missing award, use the guarded
restitution procedure described below rather than clearing a Stripe receipt.
Do not revoke existing Ultra awards automatically: honoring or replacing those
seven awards is an explicit product/support decision.

Until those live records are inspected, the number of missing awards and any
refund amount remain unknown.

For a confirmed missing tier that exists only as an inferred backfill row, an
operator can call the service-only `approve_reward_restitution(user UUID, song ID,
tier, reason, evidence JSON)` RPC. It refuses a tier with a verified run-linked
payout or completed fulfillment receipt. It preserves the original ledger row as
evidence and returns one stable approval UUID for the player/song/tier.

Then invoke vault-engine's `restoreApprovedReward` action with
`{ "approvalId": "<returned UUID>" }` using the service role or an authenticated
administrator. It mints the existing single pack for that tier through the same
atomic settlement, with a unique `restore:<approval UUID>` receipt. A failed mint
can retry; a duplicate request returns the existing result. The player does not
need to replay a song to receive the approved missing pack. This procedure must
not be used simply because a backfill row has no `record_id`.
