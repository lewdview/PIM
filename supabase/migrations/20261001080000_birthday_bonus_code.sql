-- Birthday bonus code: 10031981 → free bombshell 2x pack (2026-10-01).
--
-- Bryan's birthday is 2026-10-03. This seeds a database-managed bonus code
-- redeemable through the Claim page decryptor (same mechanism as BONUSAUG29).
--
-- How the grant works (no code changes needed anywhere):
--   1. Client calls vault-engine action 'redeemBonusCode' with the code.
--   2. The action looks the code up in public.bonus_codes, enforces
--      max_uses / expires_at / one-per-user via bonus_code_redemptions.
--   3. reward_type='pack' + reward_value='bombshell' runs generateCards()
--      with count=2 → 2 bombshell cards = the 2x (double) denomination pack.
--   4. The PIM client already maps pack rewards into the collection
--      (vaultService.redeemBonusCode handles data.rewardType === 'pack').
--
-- Apply via the Supabase SQL editor. Idempotent.

insert into public.bonus_codes (code, reward_type, reward_value, max_uses, expires_at)
values ('10031981', 'pack', 'bombshell', 10000, null)
on conflict (code) do nothing;
