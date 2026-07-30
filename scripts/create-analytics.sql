-- Analytics tables for self-hosted pageview tracking
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS analytics_visits (
  id BIGSERIAL PRIMARY KEY,
  page TEXT NOT NULL,
  referrer TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  browser TEXT,
  os TEXT,
  device TEXT,
  screen_width INT,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_visits_ts ON analytics_visits (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_visits_visitor ON analytics_visits (visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_visits_page ON analytics_visits (page);

-- Enable RLS but allow service role only
ALTER TABLE analytics_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service only" ON analytics_visits;
CREATE POLICY "service only" ON analytics_visits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  page TEXT,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  meta JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events ON analytics_events (event, timestamp DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service only events" ON analytics_events;
CREATE POLICY "service only events" ON analytics_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
