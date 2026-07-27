# Hermes Bot Fleet — Recommendations

The 12 Hermes bots run externally (on the owner's Mac) and their orchestration
code is not part of this repo, so none of the 10 items below are code fixes
that could be committed here. This doc exists so the recommendations from the
full codebase review (2026-07-27) aren't lost — implement them in the
external orchestrator. The two in-repo artifacts the bots actually coordinate
through are `.hermes-done-state.json` (root — dedup ledger of shipped
improvements) and the Supabase `webhook_events` table
(`sql/create-webhook-events.sql`).

## P0 — do first

1. **Bug Watcher pushes straight to `origin/main` with no staging gate.**
   A crash mid-multi-file-edit, or a push before its own build finishes,
   ships a half-applied fix to paying customers within minutes (Railway
   auto-deploys from main). Never let an autonomous bot push directly to
   `main`: push to a short-lived branch, build (and test), fast-forward
   `main` only on green, and wrap edits in a try/finally that reverts on any
   uncaught exception.
   ```bash
   git checkout -b bot/bug-watcher-$(date +%s)
   npm run build && npm test || { git reset --hard HEAD; exit 1; }
   git push -u origin HEAD   # merge to main only after CI is green
   ```

2. **Nothing gates an autonomous push behind the test suite.** The repo has
   a real Playwright suite (`tests/comprehensive.spec.js`, `npm test`), but
   Bug Watcher is described as "builds, commits, and pushes" — build, not
   test. Make `npm test` (at minimum `npm run build`) a hard,
   non-bypassable precondition for every code-editing bot's push step.

3. **Railway "auto-deploys from main" means there is no pre-production
   validation step at all.** Add a Railway staging environment tied to a
   `staging` branch; bot pushes land there first, a smoke-test cron hits
   `/health` and runs the Playwright suite against staging, and only
   promotes to `main` on green.

## P1 — important

4. **Bug Watcher (every 5 min) has no memory of investigations that failed.**
   `.hermes-done-state.json` proves the ledger pattern works for shipped
   improvements (30 tracked `done_items`) — extend it to unresolved cases so
   a known dead end isn't silently re-investigated every 5 minutes forever.
   ```json
   // .hermes-bug-state.json
   { "sha256(report)": { "attempts": 3, "last_verdict": "no repro", "next_retry_after": "2026-07-28T08:00:00Z" } }
   ```

5. **No coordination lock between bots that edit the same files.** Bug
   Watcher (5 min, autonomous push) and Store Improver (2.5h, proposal) can
   target the same file in the same window with no awareness of each
   other. Take an advisory lock for the duration of any edit+push cycle,
   and have proposal-generating bots check whether a target file was
   touched recently before proposing changes to it.

6. **Bot activity has no persistent record beyond chat scrollback and one
   dedup counter.** Have every bot append one structured line to a shared
   ledger on every run — `hermes-log.jsonl`, or a Supabase table
   (`webhook_events` already proves this pattern):
   `{bot, timestamp, action, outcome, commit_sha}`. Without this there's no
   way to query "what did Bug Watcher change last Tuesday" a week later.

7. **No defined escalation path when Bug Watcher can't fix something.**
   Combined with #4, an unfixable bug can be silently re-investigated
   forever with no signal ever reaching the owner. Cap retries per report
   (via the ledger from #4); on exhausting retries, send one push
   notification via the store's existing web-push infrastructure and mark
   the entry `escalated: true` so it's never re-attempted or re-escalated.

8. **Three separate bots redundantly poll the same chat/email inboxes.**
   Chat auto-reply (10 min) and Bug Watcher (5 min) both read pending chat
   messages independently; Email Monitor (30 min) and Bug Watcher both scan
   the inbox for bug reports — up to 3x the token spend re-fetching and
   re-classifying the same raw messages. Split fetch-and-normalize from
   act: one poller writes new messages into a shared table with a
   `claimed_by`/`handled` column; each acting bot queries its unclaimed
   rows instead of re-scanning from scratch.

9. **No lock prevents overlapping runs of the same bot when a run overruns
   its interval.** Bug Watcher and Webhook Monitor both run every 5
   minutes; if a single run takes longer than that (plausible for Bug
   Watcher, which edits/builds/commits/pushes), the next tick can start a
   second instance on top of the first. A trivial PID/lock file per bot —
   a tick that finds the lock held skips and logs "skipped — previous run
   still active" instead of launching a second instance.

10. **Cadence is set by "how often could this change," not by
    blast-radius × business value.** The highest-blast-radius bot (Bug
    Watcher — autonomous push to production) runs most frequently (5 min),
    while two low-risk, high-value bots sit disabled: Abandoned Cart (worst
    case is one wrongly-timed email, real revenue upside) and Store
    Improver (explicitly human-gated — zero deploy risk by design). Rank
    bots by risk-adjusted value instead of raw frequency: re-enable
    Abandoned Cart and Store Improver now, and consider decoupling Bug
    Watcher's "investigate" (safe, every 5 min) from "auto-push" (only
    after 2 consecutive independent runs agree on the same root cause and
    fix).
