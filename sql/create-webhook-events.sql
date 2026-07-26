-- Create webhook_events table for Hermes webhook relaying
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  received_at TIMESTAMPTZ DEFAULT NOW(),
  seen BOOLEAN DEFAULT FALSE
);

-- Enable RLS but allow service_role to do everything
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow insert from anon key (so webhook endpoint can write without auth)
CREATE POLICY insert_webhook_events ON webhook_events
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow read/update for service_role only
CREATE POLICY select_webhook_events ON webhook_events
  FOR SELECT USING (true);
