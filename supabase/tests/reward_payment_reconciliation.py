"""Run the reconciliation migration on isolated PostgreSQL 16, including real concurrency.

pip install pgserver psycopg2-binary
python supabase/tests/reward_payment_reconciliation.py

The bootstrap models the referenced Supabase tables/RPCs; it is not a production-schema dump.
No network service other than a temporary local PostgreSQL is contacted.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
import unittest
import uuid

import pgserver
import psycopg2
from psycopg2.extras import Json

ROOT = Path(__file__).resolve().parents[2]
A = '11111111-1111-4111-8111-111111111111'
B = '22222222-2222-4222-8222-222222222222'
URI = ''

BOOTSTRAP = """
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
create function public.is_admin() returns boolean language sql stable as $$select false$$;
create table public.profiles(id uuid primary key references auth.users, tokens integer default 0,
 tokens_earned_total integer default 0,total_pulls integer default 0,pulls_since_rare_plus integer default 0,pity_counter integer default 0);
create table public.admin_config(id integer, config jsonb);
insert into public.admin_config values(1,'{"ultraRewardMax":5}');
create table public.vault_collections(id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users,
 card_id text not null,rarity text not null,source text,is_echo boolean,echo_generation integer,echo_source_day integer,
 edition integer,max_supply integer,proof text,ultra_reward jsonb,claimed_at timestamptz,fingerprint text,
 check(card_id <> 'bad-card'));
create table public.global_supply(card_id_rarity text primary key,supply integer not null default 0);
create table public.user_fragments(user_id uuid,fragment_id text,amount integer);
create table public.echo_pool(id uuid primary key);
create function public.increment_supply(p_card_id_rarity text,p_max_supply integer) returns integer
language plpgsql as $$declare n integer; begin
 insert into public.global_supply values(p_card_id_rarity,1) on conflict(card_id_rarity)
 do update set supply=global_supply.supply+1 where global_supply.supply<p_max_supply returning supply into n;
 return coalesce(n,-1); end $$;
create function public.has_ultra_reward(v anyelement) returns boolean language sql immutable
as $$select v is not null and v::text not in ('false','null','','{}')$$;
create function public.normalize_song_id(v text) returns text language sql immutable as $$
 select case when v ~* '^(day|card)-[0-9]{1,3}$' then 'day-'||lpad(split_part(v,'-',2),3,'0') else v end $$;
create table public.gameplay_records(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,
 song_id text, accuracy numeric, medal text, timestamp timestamptz default now(), pack_rewarded boolean default false,reward_tier text default 'none');
create table public.campaign_clears(user_id uuid,song_id text,medal text,primary key(user_id,song_id));
create table public.stripe_orders(stripe_session_id text primary key,user_id uuid references auth.users,pack_category text,
 pack_size text,amount_cents integer,currency text,status text,cards_minted jsonb,completed_at timestamptz);
"""


def sql(query, params=()):
    with psycopg2.connect(URI) as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or None)
            return cur.fetchall() if cur.description else []


def begin(key, kind='stripe', category='taste', details=None, owner=A, size='single'):
    return sql('select public.begin_vault_fulfillment(%s,%s,%s,%s,%s,%s)',
               (key, owner, kind, category, size, Json(details or {})))[0][0]


def complete(op, cards):
    return sql('select public.complete_vault_fulfillment(%s,%s,%s)',
               (op['key'], op['lease'], Json(cards)))[0][0]


def card(owner=A, ultra=False, name='card-1'):
    return dict(owner_id=owner, card_id=name, rarity='common', source='pack_taste',
                is_echo=False, echo_generation=0, edition=1, max_supply=1000,
                ultra_reward={'type': 'custom_song'} if ultra else None,
                claimed_at='2026-11-09T00:00:00Z', _supply_key='1-common')


def stripe(key, owner=A, category='taste', **extra):
    return begin('stripe:' + key, category=category, owner=owner,
                 details=dict(sessionId=key, amountCents=99, currency='usd', **extra))


class SettlementTests(unittest.TestCase):
    def setUp(self):
        sql('truncate vault_fulfillments,reward_restitution_approvals,gameplay_reward_payouts,vault_collections,global_supply,echo_pool,gameplay_records,campaign_clears,claw_purchases,claw_pulls,claw_credits,stripe_orders')
        sql('update profiles set tokens=0,tokens_earned_total=0,total_pulls=0,pulls_since_rare_plus=0,pity_counter=0')

    def record(self, owner=A, song='day-001', accuracy=98, medal='PLATINUM', age='0 minutes'):
        return str(sql("insert into gameplay_records(user_id,song_id,accuracy,medal,timestamp) values(%s,%s,%s,%s,now()-%s::interval) returning id",
                       (owner,song,accuracy,medal,age))[0][0])

    def reward(self, rec, tier='prophecy', song='day-001', owner=A):
        return begin(f'run:{owner}:{song}:{tier}', 'run_reward', tier, {'recordId': rec}, owner)

    def test_browser_webhook_race_credits_tokens_once(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            ops = list(pool.map(lambda _: stripe('cs_race',category='token_bundle',tokenAmount=200),range(12)))
        ready = [o for o in ops if o['status']=='reserved']
        self.assertEqual(len(ready),1)
        r=complete(ready[0],[])
        self.assertEqual(r['newBalance'],200)
        self.assertEqual(stripe('cs_race',category='token_bundle',tokenAmount=200)['result'],r)
        self.assertEqual(sql('select tokens from profiles where id=%s',(A,))[0][0],200)

    def test_concurrent_completion_same_receipt_mints_once(self):
        op=stripe('cs_pack')
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results=list(pool.map(lambda _: complete(op,[card()]),range(12)))
        self.assertTrue(all(r==results[0] for r in results))
        self.assertEqual(sql('select count(*) from vault_collections')[0][0],1)
        self.assertEqual(sql('select supply from global_supply')[0][0],1)
        self.assertEqual(sql('select total_pulls from profiles where id=%s',(A,))[0][0],1)

    def test_wrong_owner_and_stale_lease_rejected(self):
        op=stripe('cs_fence')
        with self.assertRaises(psycopg2.Error): stripe('cs_fence',owner=B)
        sql("update vault_fulfillments set started_at=now()-interval '6 minutes'")
        newer=stripe('cs_fence')
        with self.assertRaises(psycopg2.Error): complete(op,[card()])
        sql('select release_vault_fulfillment(%s,%s)',(op['key'],op['lease']))
        self.assertEqual(complete(newer,[card()])['success'],True)

    def test_failed_claw_batch_rolls_back_credit_cards_supply_and_logs(self):
        sql('insert into claw_credits(owner_id,credits) values(%s,1)',(A,))
        op=begin(f'claw:{A}:{uuid.uuid4()}','claw','taste',{'won':True})
        with self.assertRaises(psycopg2.Error): complete(op,[card(),card(name='bad-card')])
        self.assertEqual(sql('select credits from claw_credits')[0][0],1)
        self.assertEqual(sql('select count(*) from vault_collections')[0][0],0)
        self.assertEqual(sql('select count(*) from global_supply')[0][0],0)
        self.assertEqual(sql('select count(*) from claw_pulls')[0][0],0)
        self.assertTrue(complete(op,[card()])['won'])
        self.assertEqual(sql('select credits from claw_credits')[0][0],0)

    def test_two_claw_events_cannot_spend_one_credit(self):
        sql('insert into claw_credits(owner_id,credits) values(%s,1)',(A,))
        ops=[begin(f'claw:{A}:{uuid.uuid4()}','claw','taste',{'won':True}) for _ in range(2)]
        def attempt(op):
            try: return complete(op,[card()])['success']
            except psycopg2.Error: return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sum(pool.map(attempt,ops)),1)
        self.assertEqual(sql('select count(*) from vault_collections')[0][0],1)

    def test_claw_checkout_and_slip(self):
        op=stripe('cs_claw',category='claw_pull',pulls=1)
        complete(op,[]);complete(op,[])
        self.assertEqual(sql('select credits from claw_credits')[0][0],1)
        slip=begin(f'claw:{A}:{uuid.uuid4()}','claw','taste',{'won':False})
        r=complete(slip,[])
        self.assertFalse(r['won']);self.assertEqual(r['credits'],0)
        self.assertEqual(sql('select count(*) from vault_collections')[0][0],0)

    def test_all_platinum_tiers_pay_once_and_keep_highest(self):
        rec=self.record()
        tiers=['prophecy','free','alpha','taste','special_picks']
        for t in tiers: complete(self.reward(rec,t),[card()])
        self.assertEqual(sql('select count(*) from gameplay_reward_payouts')[0][0],5)
        self.assertEqual(sql('select reward_tier from gameplay_records')[0][0],'legendary')
        rec2=self.record()
        self.assertEqual(self.reward(rec2)['status'],'completed')
        self.assertEqual(sql('select count(*) from vault_collections')[0][0],5)

    def test_bad_run_proof_is_refused(self):
        for args in [dict(owner=B),dict(age='31 minutes'),dict(age='-2 minutes'),dict(medal='NONE'),dict(accuracy=80,medal='GOLD')]:
            rec=self.record(**args)
            with self.assertRaises(psycopg2.Error): self.reward(rec)
        rec=self.record(accuracy=80,medal='GOLD')
        with self.assertRaises(psycopg2.Error): self.reward(rec,'free')
        self.assertTrue(complete(self.reward(rec,'special_picks'),[card()])['success'])

    def test_failed_reward_can_retry_without_false_ledger(self):
        rec=self.record();op=self.reward(rec)
        with self.assertRaises(psycopg2.Error): complete(op,[card(name='bad-card')])
        self.assertEqual(sql('select count(*) from gameplay_reward_payouts')[0][0],0)
        self.assertTrue(complete(op,[card()])['success'])

    def test_old_paid_ledger_remains_protected(self):
        rec=self.record()
        sql("insert into gameplay_reward_payouts(user_id,song_id,tier) values(%s,'day-001','prophecy')",(A,))
        with self.assertRaises(psycopg2.Error): self.reward(rec)

    def test_campaign_requires_submitted_clears_and_one_receipt(self):
        for i in range(1,6):
            sql("insert into campaign_clears values(%s,%s,'GOLD')",(A,f'day-{i:03}'))
        key=f'campaign:{A}:1:1'
        with self.assertRaises(psycopg2.Error): begin(key,'campaign_reward','taste',{'month':1,'milestone':1})
        for i in range(1,6): self.record(song=f'day-{i:03}',medal='GOLD',accuracy=85)
        complete(begin(key,'campaign_reward','taste',{'month':1,'milestone':1}),[card()])
        self.assertEqual(begin(key,'campaign_reward','taste',{'month':1,'milestone':1})['status'],'completed')

    def test_ultra_cap_under_concurrent_inserts_and_no_expiring_reservations(self):
        def insert(i):
            # Separate owners avoid serializing solely on the profile lock.
            owner=str(uuid.uuid4());sql('insert into auth.users values(%s)',(owner,));sql('insert into profiles(id) values(%s)',(owner,))
            op=stripe(f'cs_ultra{i}',owner=owner)
            return complete(op,[card(owner,ultra=True)])
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: list(pool.map(insert,range(16)))
        self.assertEqual(sql('select count(*) from vault_collections where has_ultra_reward(ultra_reward)')[0][0],5)
        self.assertEqual(sql('select count(*) from vault_collections')[0][0],16)

    def test_public_roles_cannot_call_settlement(self):
        for role in ['anon','authenticated']:
            with self.assertRaises(psycopg2.Error):
                sql(f"set role {role}; select begin_vault_fulfillment('x',%s,'stripe','taste','single','{{}}')",(A,))

    def test_distinct_token_sessions_do_not_lose_balance_increments(self):
        ops=[stripe(f'cs_tokens{i}',category='token_bundle',tokenAmount=200) for i in range(8)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda op: complete(op,[]),ops))
        self.assertEqual(sql('select tokens from profiles where id=%s',(A,))[0][0],1600)

    def test_empty_pack_and_null_lease_cannot_consume_payment(self):
        op=stripe('cs_empty')
        with self.assertRaises(psycopg2.Error): complete(op,[])
        with self.assertRaises(psycopg2.Error): complete(dict(op,lease=None),[card()])
        self.assertEqual(sql('select count(*) from stripe_orders')[0][0],0)

    def test_restitution_requires_approved_loss_and_cannot_repeat(self):
        sql("insert into gameplay_reward_payouts(user_id,song_id,tier) values(%s,'day-001','prophecy')",(A,))
        args=(A,'day-001','prophecy','Confirmed missing pack from the premium cap incident',Json({'supportTicket':'local-test-1'}))
        approval=str(sql('select approve_reward_restitution(%s,%s,%s,%s,%s)',args)[0][0])
        self.assertEqual(str(sql('select approve_reward_restitution(%s,%s,%s,%s,%s)',args)[0][0]),approval)
        with self.assertRaises(psycopg2.Error): begin('restore:'+str(uuid.uuid4()),'restitution_reward','prophecy',{'approvalId':str(uuid.uuid4())})
        op=begin('restore:'+approval,'restitution_reward','prophecy',{'approvalId':approval})
        with self.assertRaises(psycopg2.Error): complete(op,[card(name='bad-card')])
        self.assertIsNone(sql('select fulfilled_at from reward_restitution_approvals')[0][0])
        complete(op,[card()]);complete(op,[card()])
        self.assertEqual(sql('select count(*) from vault_collections')[0][0],1)
        self.assertEqual(sql('select count(*) from gameplay_reward_payouts where record_id is null')[0][0],1)

    def test_verified_payout_cannot_get_legacy_restitution(self):
        rec=self.record();complete(self.reward(rec),[card()])
        with self.assertRaises(psycopg2.Error):
            sql('select approve_reward_restitution(%s,%s,%s,%s,%s)',
                (A,'day-001','prophecy','Invalid attempt at refunding a verified payout',Json({'ticket':'x'})))

    def test_echo_consumption_rolls_back_and_only_one_pack_consumes_it(self):
        eid=str(uuid.uuid4());sql('insert into echo_pool values(%s)',(eid,))
        echo=dict(card(),_echo_id=eid,is_echo=True)
        op=stripe('cs_echo')
        with self.assertRaises(psycopg2.Error): complete(op,[echo,card(name='bad-card')])
        self.assertEqual(sql('select count(*) from echo_pool')[0][0],1)
        complete(op,[echo])
        with self.assertRaises(psycopg2.Error): complete(stripe('cs_echo2'),[echo])
        self.assertEqual(sql('select count(*) from vault_collections')[0][0],1)

    def test_existing_overcap_ultras_are_preserved(self):
        sql('alter table vault_collections disable trigger enforce_ultra_reward_cap')
        for i in range(7):
            sql("insert into vault_collections(owner_id,card_id,rarity,ultra_reward) values(%s,'card-1','common',%s)",(A,Json({'type':'custom_song','legacy':i})))
        sql('alter table vault_collections enable trigger enforce_ultra_reward_cap')
        sql("update vault_collections set ultra_reward=ultra_reward || '{\"reviewed\":true}'::jsonb")
        complete(stripe('cs_no_more_ultra'),[card(ultra=True)])
        self.assertEqual(sql('select count(*) from vault_collections where has_ultra_reward(ultra_reward)')[0][0],7)

    def test_supply_exhaustion_rolls_back_instead_of_duplicating_edition(self):
        sql("insert into global_supply values('1-common',1)")
        with self.assertRaises(psycopg2.Error): complete(stripe('cs_cap'),[dict(card(),max_supply=1)])
        self.assertEqual(sql('select count(*) from vault_collections')[0][0],0)
        self.assertEqual(sql('select supply from global_supply')[0][0],1)

    def test_submitted_run_without_ownership_or_award_unlock_is_rejected(self):
        rec=self.record(song='day-002')
        with self.assertRaises(psycopg2.Error): self.reward(rec,song='day-002')


def main():
    global URI
    binaries=Path(pgserver.__file__).parent/'pginstall'/'bin'
    with tempfile.TemporaryDirectory(prefix='pim-settlement-') as folder:
        subprocess.run([str(binaries/'initdb'),'-D',folder,'-A','trust','--no-locale','-E','UTF8'],check=True,capture_output=True)
        port=int(os.environ.get('PIM_TEST_PG_PORT','55462'))
        URI=f'postgresql://{os.environ.get("USER","agent")}@127.0.0.1:{port}/postgres'
        with open(Path(folder)/'server.log','w') as log:
            process=subprocess.Popen([str(binaries/'postgres'),'-D',folder,'-h','127.0.0.1','-p',str(port),'-c','unix_socket_directories='],stdout=log,stderr=log)
            try:
                for _ in range(100):
                    try: sql('select 1');break
                    except psycopg2.OperationalError: time.sleep(.05)
                sql(BOOTSTRAP)
                sql('insert into auth.users values(%s),(%s)',(A,B))
                sql('insert into profiles(id) values(%s),(%s)',(A,B))
                sql("insert into user_fragments values(%s,'card-1',10)",(A,))
                for name in ['20261104090000_claw_pulls.sql','20261106120000_gameplay_reward_payouts.sql','20261109090000_reward_payment_reconciliation.sql']:
                    sql((ROOT/'supabase/migrations'/name).read_text())
                # Ensure the new migration can safely run twice.
                sql((ROOT/'supabase/migrations/20261109090000_reward_payment_reconciliation.sql').read_text())
                result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(SettlementTests))
                if not result.wasSuccessful(): raise SystemExit(1)
            finally:
                process.send_signal(signal.SIGINT);process.wait(timeout=10)


if __name__=='__main__': main()
