-- READ ONLY. Run as an administrator before/after the coordinated cutover.
-- These are review candidates, not proof of missing cards. Do not blindly delete
-- payout rows: legacy PLATINUM backfill inferred lower tiers even when minting failed.
begin read only;

select to_regclass('public.vault_fulfillments') as settlement_receipts,
       to_regprocedure('public.complete_vault_fulfillment(text,uuid,jsonb)') as atomic_settlement,
       to_regclass('public.gameplay_reward_payouts') as run_payout_ledger;

select count(*) as existing_custom_song_awards
from public.vault_collections where public.has_ultra_reward(ultra_reward);

-- Backfilled rows have no per-tier run proof. Review against actual collection
-- inserts, support reports and payment/reward telemetry before approving credit.
select user_id,song_id,array_agg(tier order by tier) as inferred_paid_tiers,
       min(paid_at) as ledger_created_at
from public.gameplay_reward_payouts
where record_id is null
group by user_id,song_id order by user_id,song_id;

-- Orders awaiting confirmation: replay their ORIGINAL Stripe session through
-- verifyStripeSession after checking Stripe; never issue a fresh charge.
select stripe_session_id,user_id,pack_category,pack_size,amount_cents,status
from public.stripe_orders where status <> 'completed'
order by stripe_session_id;

-- A completed claw purchase must have exactly one corresponding credit grant.
select o.stripe_session_id,o.user_id,o.status,p.pulls
from public.stripe_orders o
left join public.claw_purchases p on p.stripe_session_id=o.stripe_session_id
where o.pack_category='claw_pull' and (p.stripe_session_id is null or p.owner_id<>o.user_id);

commit;

-- AFTER applying the new migration, inspect any stale in-flight settlements:
-- select operation_key,owner_id,kind,category,started_at from public.vault_fulfillments
-- where completed_at is null and started_at < now()-interval '5 minutes';
-- Retry through the matching API with the SAME session/run/request ID. Do not
-- manually mark a receipt completed or clear Stripe orders to force a replay.
