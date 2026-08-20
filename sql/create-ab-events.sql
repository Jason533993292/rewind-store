-- A/B testing event log for REWIND
-- Run once in the Supabase SQL editor (Project → SQL Editor → New query → Run).
CREATE TABLE IF NOT EXISTS ab_events (
  id BIGSERIAL PRIMARY KEY,
  experiment TEXT NOT NULL,      -- e.g. 'hero_v1'
  variant TEXT NOT NULL,         -- e.g. 'control' | 'variant'
  event_type TEXT NOT NULL,      -- 'impression' | 'conversion'
  session_id TEXT,               -- anonymous visitor id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ab_events_exp ON ab_events (experiment, variant, event_type);

-- Enable row-level access so the store's server (service key) can insert/read.
ALTER TABLE ab_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_key full" ON ab_events FOR ALL TO anon USING (true) WITH CHECK (true);
