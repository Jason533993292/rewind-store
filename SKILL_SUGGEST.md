---
name: supabase-bug-report-monitor
description: Monitor Supabase webhook_events for new bug-report source entries and summarize key telemetry.
---

### Objective
Check Supabase `webhook_events` for rows with `source='bug-report'` that have arrived since yesterday. Summarize each report's message, page, device, browser, and user email. Immediately flag any reports mentioning "checkout" or "payment" as URGENT.

### Verification Steps
1. **API Credentials & Connection**: Extract `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY` from the local `.env` file or read database credentials from `/Users/phil/.hermes/scripts/_rw_creds.json`.
2. **Retrieve Data**: Query the Supabase `/webhook_events` endpoint using GET with PostgREST query parameters:
   - Filter `source=eq.bug-report`
   - Filter `received_at=gte.<yesterday_timestamp>` (e.g., `2026-08-01T00:00:00+00:00` for a run on `2026-08-02`)
   - Order by `id.desc`
3. **Analyze Payloads**: Parse the `payload` JSON of each event. Extract:
   - `message` (within payload)
   - `page` (within payload)
   - `device` (within payload, default to "Not specified" if missing)
   - `browser` (within payload)
   - `email` (within payload)
4. **Keyword Scanning (Urgency Flag)**:
   - Check the `message` and overall payload body (case-insensitive) for terms like `checkout` and `payment`.
   - If found, mark the report prominently with `⚠️ **URGENT** ⚠️`.
5. **Report Summary**: Present the list of summaries in a neat, professional markdown list or table structure.
