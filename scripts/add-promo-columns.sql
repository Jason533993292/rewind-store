-- Add uses and max_uses columns to promo_codes table
-- Run once in Supabase SQL Editor
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS uses INTEGER DEFAULT 0;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS max_uses INTEGER;
