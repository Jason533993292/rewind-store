-- Creates the shared inbox table for cron bots to pull work from instead of
-- each bot independently polling chat/email (eliminates 3x redundant scanning).
-- Run this in Supabase SQL Editor.

create table if not exists cron_inbox (
  id bigint generated always as identity primary key,
  source text not null,          -- 'chat_message', 'email', 'webhook_event'
  source_id text,                -- original ID from chat_messages, email, etc.
  summary text,                  -- brief description of the item
  body text,                     -- full content
  customer_email text,
  handled boolean default false,
  claimed_by text,               -- bot name that claimed this item
  claimed_at timestamptz,
  handled_at timestamptz,
  verdict text,                  -- 'fixed', 'skipped', 'escalated', 'answered'
  created_at timestamptz default now()
);

-- RLS: service_role only (same as webhook_events)
alter table cron_inbox enable row level security;
create policy "service can manage cron_inbox" on cron_inbox
  for all to service_role using (true) with check (true);

-- Index for the polling query
create index if not exists idx_cron_inbox_unhandled on cron_inbox (handled, claimed_by) where handled = false and claimed_by is null;
