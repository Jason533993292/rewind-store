-- Lock down wishlists: remove anon write access, keep read
DROP POLICY IF EXISTS "anon can upsert by email" ON wishlists;
DROP POLICY IF EXISTS "anon can update by email" ON wishlists;
DROP POLICY IF EXISTS "anon can insert by email" ON wishlists;

-- Anon can still read (query already filters by email in the app code)
-- This allows the wishlist display to work. The email+product_ids data
-- is low sensitivity, but removing unrestricted read would break the app.
-- Keep anon SELECT, remove anon INSERT/UPDATE/DELETE.

-- Service role (backend) can do everything
CREATE POLICY "service can manage wishlists" ON wishlists
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
