# REWIND — Edit History, Fixes & Working Preferences
**Owner:** Philippe Anaman · **Maintained by:** Hermes Agent · **Last updated:** 2026-08-01

---

## Part 1 — How Philippe likes things (read this first)

### Working style
- **Problem: → Solution: → Expected impact** format for proposals. No preamble.
- **Code over explanations** — show the change, not the path to it. Never print file paths unless asked.
- **Comprehensive fixes in one go** — fix the whole bug class, not just the reported spot. No drive-by refactors.
- **Clear todo list after tasks** — a scannable record of what was done.
- **No thinking blocks, no tool noise** — clean user-facing responses only. Never display internal tool results, error-masking noise, or verifier warnings. He asks for details explicitly if he wants them.
- **Hates silent failures** — tools must print explicit warnings instead of silently no-opping. Verification with receipts (row IDs, HTTP statuses, build exits).
- **Visual feedback** — wants to SEE the result (screenshots, live checks), and clear reports of what was fixed and why.

### Product & brand
- **Retro-Modern** brand direction (nostalgic, bold, vibrant) — Option 3 from the Pomelli branding quiz. Applies to all marketing/design decisions.
- **Human/handcrafted UI** — prefers handcrafted over template-y.
- **Free/local tools over paid SaaS** — SaaS free tiers only for benchmarking.

### Automation philosophy
- **Propose-only by default** for improvement bots; a **human gate** on everything that touches the live store. Automated output gets curation/spot-check before publish.
- **Automation-first**: scheduled tasks, cron, webhooks are his core workflow.
- Actively seeks outside AI reviews (Lovable, KIMI) of his work.
- Runs **Lighthouse (DevTools) audits** himself and expects flagged a11y issues fixed (form id/name, button labels, target size) + clean consoles.
- Tests the bug panel himself and asks where submissions land.

### Contact / accounts
- Admin email: philippekojoanaman@gmail.com (exact, in admins table)
- GitHub: Jason533993292 (rewind-store repo)
- Store: rewind-stores.com (Supabase `luiqimsfvllgsmzedncw`)

---

## Part 2 — REWIND edit/fix/bug history (chronological)

### The bug panel saga
1. **Dead code → missing import** — BugReportModal existed but wasn't wired; then a missing import broke the build. Fixed (commit `3c85872`).
2. **Bug reports now land in Supabase** — POST `/api/report-bug` → `webhook_events` (source `bug-report`). Endpoint added `519c0df`; first live row 756.
3. **UA dump → device/browser/timestamp** — modal footer showed raw UA string; rewritten with `detectDevice()` to show **Device / Browser / Sent timestamp** (commit `f9bf9f3`).
4. **Server was silently dropping fields** — only message/email/page/browser persisted; `device`/`submittedAt`/`ua` now destructured and saved (commit `9c3e1c5`; verified row 843, deleted after; user's test row 832 kept).
5. **20-char bug text cap** — `maxLength` + onChange `slice(0,20)` + live "X characters left" counter (red ≤3); handler also clamps so the counter can never go negative (commits `9c3e1c5`, `52e687e`).

### Images
6. **Hero swap** — replaced with the user's 439,271-byte Lacoste bundle artwork; cache-busted `?v=2` (commit `4fa01fd`; event 764).
7. **Cropped product images** — `.rw-img { object-fit: cover }` in a 340px fixed-height card cropped tall phone screenshots → `object-fit: contain` (commit `071589c`; event 775).
8. **3 giant PNGs compressed → JPEG (-80%)** — lacoste-jacket-bundle 2.4MB→439KB, carhartt-jacket 1.8MB→284KB, under-armour 925KB→207KB; rows 9/7/6 repointed to `.jpg` in storage (commit `afbe7ba`).
9. **og-image preload bug** — index.html preloaded `/og-image.png` (never rendered → 4× console warnings) → now preloads the real hero `/products/hero-detail.jpg?v=2` (commit preload-fix; event 770).

### Accessibility (Lighthouse-driven, commit `f9bf9f3` + `afbe7ba`)
10. **Form fields got id/name** — search `rw-search`/`q`; ChatBubble email `chat-email`; OrderTracking + Shop checkout `email`; newsletter `newsletter-email`.
11. **Unnamed buttons** — quantity −/+ on product pages (Decrease/Increase quantity) + the dock Home button (icon-only when collapsed) got aria-labels.
12. **Cart/wishlist accessible-name mismatch** — aria-labels now include the count: "Cart (4)" — axe wanted the visible badge in the name (test updated to `/^Cart/`, commit `124dad9`).
13. **Heading order** — "👁 Recently viewed" h3 → h2.
14. **Target size** — remove-from-recently-viewed buttons 22px → 26px.
15. **Per-route canonical** — canonical tag now syncs to the actual pathname on navigation (was always root).

### Performance & caching (commit `afbe7ba`)
16. **bfcache blocked** — HTML responses served `no-store` → `no-cache, must-revalidate` (static + SPA fallback; admin routes keep no-store).

### Hero/bundle
17. **Clickable hero** — hero bundle bar clickable (commit `ecdbe67`).
18. **Hero hover-pop** — Lacoste bundle bar name+price hover transition with `prefers-reduced-motion` guard (commit `f9bf9f3`).

### Products/data
19. **Facted batch** — 17 `vintage-*` products added matching the user's table exactly (BAPE 18, FOG 14, CP Company 20, Lacoste 22, Unknown 10; 7 Zip-up Jumpers / 7 Jumpers / 3 Pants) (commit `d119bbe`).
20. **Pink Lacoste Hoodie** — product id=15 added; bundle image renamed; new storage file instead of overwrite.

### Test suite (commits `afbe7ba`, `b0caad2`, `124dad9`)
21. **Flaky load-timeouts** — page.goto `waitUntil:'load'` on the heavy 51-product homepage exceeded 30s under 3 workers → timeout 90s, workers 2, expect 10s. Suite: **18 passed / 0 failed / 1 flaky (retry-pass) / 6 skipped**.
22. **Known data-assumption** — "free returns + shipping strikethrough" expects `.rw-price-was` on the first featured card (Brasil '02 Jersey €42 has no discount) — test is now graceful (skips cards without a was-price).

### Infrastructure gotchas (worth remembering)
23. **Secret-masking corrupts patches** — the secret-redaction layer once wrote literal `***` into `api/server.js`'s Supabase REST header template. Rebuild such lines via python3 string-concat; always `node --check api/server.js` after patching.
24. **Cloudflare in front** — blocks headless Chrome (UA rule: Playwright → Skip); cache-bust via `?v=2` (no CF API creds).
25. **Deploy flow** — push to GitHub main → Railway auto-deploys → verify new bundle hash on live site.
26. **Playwright** — real Chrome UA required; use `load` not `networkidle` (chat polling blocks idle).

---

## Part 3 — AionUi & Hermes setup history

- **AionUi v2.1.45** installed (`/Applications/AionUi.app`); agents: Hermes (connected), Gemini CLI (connected via API-key login), Claude Code (available), Cursor (CURSOR_API_KEY required).
- **Gemini CLI**: Google sunset the free "Code Assist for individuals" OAuth — API-key login is the working path (GEMINI_API_KEY from Google AI Studio).
- **7 skills imported** into AionUi from `~/Desktop/aionui-rewind-skills/` (each folder has SKILL.md with `---` frontmatter + description — required, plain `# title` is rejected).
- **Scheduled tasks live** in AionUi (bug digest, orders, stock, health, chat replies, Downloads cleanup).
- **Hermes skin `ember-brown`** — warm cocoa/bronze variant of the built-in ember; active via `display.skin`; tweak single keys with `hermes skin set <key> <hex>`.
- **AionUi theme** — `~/Desktop/aionui-ember-dark.css` (Ember Dark, token-based) for Appearance → theme gallery.
- **Crush v0.88.0** installed (`~/.local/bin/crush`) — free-Claude coding agent; global flags go before the subcommand (`crush --yolo run "…"`).
- **Graphify** installed (pipx `graphifyy`) — skill at `~/.claude/skills/graphify/`; needs the `claude` CLI signed in.
- **Paths**: npm global bins + `claude`/`gemini`/`crush` live in `~/.local/bin` (add `export PATH="$PATH:$HOME/.local/bin"` to ~/.zshrc to use them in Terminal).

---

## Part 4 — Current state snapshot (2026-08-01)

- **Live**: 51 products (26 custom_products rows incl. 17 `vintage-*`; bundle id=9; Pink Lacoste id=15). Orders/bug reports in Supabase.
- **Memory**: Hermes memory near its 2,200-char cap — full details live in this file + `~/Desktop/AionUi-Agent-Skills.md` + the 7-skill bundle.
- **Verification scripts on record**: `~/.hermes/cron/hermes-verify-a11y-batch.py` (18 checks), `hermes-verify-ember-theme.py` (10 checks), plus earlier rewind-bundle / pink-lacoste / clipforge scripts.
- **Clipforge** (`~/clipforge`): fetch/transcribe/score/cut pipeline, 8/8 regression checks — separate from REWIND, no correlation.
