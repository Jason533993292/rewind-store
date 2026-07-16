-- Run this in Supabase SQL Editor

-- 1. Atomic stock decrement (prevents overselling)
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id TEXT, p_qty INT)
RETURNS INT AS $$
DECLARE
  new_stock INT;
BEGIN
  UPDATE custom_products
  SET stock = GREATEST(stock - p_qty, 0)
  WHERE product_id = p_product_id AND stock >= p_qty
  RETURNING stock INTO new_stock;
  RETURN new_stock;
END;
$$ LANGUAGE plpgsql;

-- 2. Atomic promo uses increment
CREATE OR REPLACE FUNCTION increment_promo_uses(p_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE promo_codes
  SET uses = uses + 1
  WHERE code = p_code AND (max_uses IS NULL OR uses < max_uses);
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 3. Unique constraint on orders.order_num (webhook idempotency backstop)
-- Only add if the column exists and the constraint doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_num_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_order_num_key UNIQUE (order_num);
  END IF;
END $$;
