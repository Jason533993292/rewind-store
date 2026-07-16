-- Run this in Supabase SQL Editor to fix wishlist 401 and audit_log permissions

-- 1. Ensure wishlist table exists
CREATE TABLE IF NOT EXISTS wishlists (
  email TEXT PRIMARY KEY,
  product_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Allow anon reads (needed for GET /wishlists?select=product_ids&email=eq.xxx)
CREATE POLICY "anon_read_wishlist" ON wishlists
  FOR SELECT USING (true);

-- Allow anon inserts/upserts (needed for POST /wishlists?on_conflict=email)
CREATE POLICY "anon_insert_wishlist" ON wishlists
  FOR INSERT WITH CHECK (true);

-- Allow anon updates
CREATE POLICY "anon_update_wishlist" ON wishlists
  FOR UPDATE USING (true) WITH CHECK (true);

-- Enable RLS on wishlists (if not already)
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- 2. Ensure audit_log table exists
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_email TEXT,
  action TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow service_role inserts for audit_log (handled by server-side anon key)
CREATE POLICY "anon_insert_audit_log" ON audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_select_audit_log" ON audit_log
  FOR SELECT USING (true);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 3. Ensure promo_codes table exists
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  discount NUMERIC DEFAULT 10,
  discount_type TEXT DEFAULT 'percentage',
  label TEXT,
  max_uses INTEGER DEFAULT 50,
  uses INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "anon_read_promo_codes" ON promo_codes
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_promo_codes" ON promo_codes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_update_promo_codes" ON promo_codes
  FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
