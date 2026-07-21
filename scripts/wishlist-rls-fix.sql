-- Lock down wishlists: all access must go through Express API
DROP POLICY IF EXISTS "anon can read by email" ON wishlists;
DROP POLICY IF EXISTS "anon can upsert by email" ON wishlists;
DROP POLICY IF EXISTS "anon can update by email" ON wishlists;
DROP POLICY IF EXISTS "anon can insert by email" ON wishlists;
DROP POLICY IF EXISTS "anon can read wishlists" ON wishlists;

-- Service role (backend) can do everything
CREATE POLICY "service can manage wishlists" ON wishlists
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
