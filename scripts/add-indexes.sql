-- DB indexes for query performance as volume grows
-- Run in Supabase SQL Editor

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders (email);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions (status);
CREATE INDEX IF NOT EXISTS idx_custom_products_cat ON custom_products (cat);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events (created_at DESC);
