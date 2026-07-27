-- ═══════════════════════════════════════════════════════════════
-- Lock down anon-key write (and, for audit_log, read) access on
-- tables that should only ever be touched by the Express API's
-- service-role key.
--
-- MANUAL STEP REQUIRED: this file is not wired into any migration
-- runner in this repo and is not applied automatically. Copy/paste
-- it into the Supabase SQL Editor (or run it via the Supabase CLI)
-- directly against the live project. This sandbox has no direct
-- Supabase DB credentials, so it cannot be executed from here.
--
-- Why this is needed: supabase-setup.sql, supabase-referral.sql, and
-- scripts/supabase-fix.sql originally granted the public `anon` key
-- (the key shipped in the browser bundle) unrestricted INSERT/
-- UPDATE/DELETE on these tables. Anyone can call the Supabase REST
-- API directly with that key — no admin token, no fraud check, no
-- mass-assignment allowlist required — and e.g. reprice/delete any
-- product, mint fraudulent referral rewards, insert a 100%-off promo
-- code, or read/forge the admin audit trail.
--
-- After this runs, ALL reads and writes to these 6 tables must go
-- exclusively through the existing Express endpoints in api/server.js
-- and api/routes/*, which already authenticate to Supabase using
-- SUPABASE_SERVICE_ROLE_KEY (see .env.example) — never the anon key.
-- Anon SELECT policies needed by the public storefront (product
-- catalog, promo/referral code lookups) are left in place; only
-- audit_log has its anon SELECT policy dropped too (see item 6 below).
-- ═══════════════════════════════════════════════════════════════

-- 1. custom_products (policies defined in supabase-setup.sql:20-28)
drop policy if exists "anon can insert custom_products" on custom_products;
drop policy if exists "anon can update custom_products" on custom_products;
drop policy if exists "anon can delete custom_products" on custom_products;
-- "anon can read custom_products" (SELECT) is intentionally left in place —
-- the storefront reads the product catalog directly with the anon key.
create policy "service can manage custom_products" on custom_products
  for all to service_role using (true) with check (true);

-- 2. referral_codes (policies defined in supabase-referral.sql:53-56)
drop policy if exists "anon can insert referral_codes" on referral_codes;
-- "anon can read referral_codes" (SELECT) is intentionally left in place.
-- (No anon UPDATE/DELETE policy existed on this table to begin with.)
create policy "service can manage referral_codes" on referral_codes
  for all to service_role using (true) with check (true);

-- 3. referral_redemptions (policies defined in supabase-referral.sql:57-62)
drop policy if exists "anon can insert referral_redemptions" on referral_redemptions;
drop policy if exists "anon can update referral_redemptions" on referral_redemptions;
-- "anon can read referral_redemptions" (SELECT) is intentionally left in place.
create policy "service can manage referral_redemptions" on referral_redemptions
  for all to service_role using (true) with check (true);

-- 4. referral_rewards (policies defined in supabase-referral.sql:81-86)
drop policy if exists "anon can insert referral_rewards" on referral_rewards;
drop policy if exists "anon can update referral_rewards" on referral_rewards;
-- "anon can read referral_rewards" (SELECT) is intentionally left in place.
create policy "service can manage referral_rewards" on referral_rewards
  for all to service_role using (true) with check (true);

-- 5. promo_codes (policies defined in scripts/supabase-fix.sql:56-63)
drop policy if exists "anon_insert_promo_codes" on promo_codes;
drop policy if exists "anon_update_promo_codes" on promo_codes;
-- "anon_read_promo_codes" (SELECT) is intentionally left in place — checkout
-- needs to validate/display a promo code client-side before submitting payment.
-- (No anon DELETE policy existed on this table to begin with.)
create policy "service can manage promo_codes" on promo_codes
  for all to service_role using (true) with check (true);

-- 6. audit_log (policies defined in scripts/supabase-fix.sql:36-40)
-- Unlike the tables above, BOTH the anon INSERT *and* anon SELECT policies
-- are dropped here. This table is the admin audit trail (admin emails, IPs,
-- actions taken) — an anon SELECT policy lets anyone read the entire trail
-- with zero auth, and an anon INSERT policy lets anyone forge entries to
-- obscure real admin actions. Nothing legitimate needs anon access to this
-- table; the server's own auditLog() helper already writes to it using
-- SUPABASE_SERVICE_ROLE_KEY.
drop policy if exists "anon_insert_audit_log" on audit_log;
drop policy if exists "anon_select_audit_log" on audit_log;
create policy "service can manage audit_log" on audit_log
  for all to service_role using (true) with check (true);
