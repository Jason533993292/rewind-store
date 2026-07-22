-- Atomic increment for promo code usage counter
-- Run this once in Supabase SQL Editor
CREATE OR REPLACE FUNCTION increment_promo_uses(p_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE promo_codes SET uses = COALESCE(uses, 0) + 1 WHERE code = p_code;
END;
$$;
