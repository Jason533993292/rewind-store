# REWIND Store — Full Codebase Audit Request for Claude

**Site:** rewind-stores.com (React/Vite + Express + Supabase + Stripe Elements + Resend + Gemini)
**Version:** V11.3.0 live on Railway
**Repo:** Jason533993292/rewind-store (public, main branch)

## Current Dock Buttons (3 items)
1. **Referrals** — opens full-page referral dashboard (stats, code, rewards, activity)
2. **Home** — scrolls to top, resets filters
3. **Settings** — placeholder (dimmed, disabled)

The dock is a floating pill at the bottom center. Collapses to just a home icon when not hovered.

## What I want from you

**1. Security audit** — scan every endpoint for: missing auth, price tampering holes, CSP gaps, XSS vectors, RLS bypasses. Give exact file paths and line numbers.

**2. Memory leaks** — check for: setInterval without cleanup, stale closures in useEffect, unsubscribed event listeners, blob URL leaks, AbortController patterns.

**3. Performance optimization** — bundle size, unnecessary re-renders, lazy loading opportunities, images, caching strategy.

**4. Settings page ideas** — what should go in the dock's Settings button? Think features a small vintage streetwear store owner would need quick access to:
- Quick order lookup
- Stock alerts (low stock items)
- Recent orders summary
- Quick promo code generator
- Store analytics snapshot (today's sales, visits)
- Theme/toggle options (dark mode, grid columns)
- Something else useful?

**5. Dock expansion ideas** — what other buttons would make sense? Think:
- Quick actions a store owner needs while browsing their own store
- Customer-facing tools (wishlist, cart quick-access, recently viewed)

Don't just list — give me actual implementation approaches for your top 2-3 suggestions.

## Files included (read the repo directly at Jason533993292/rewind-store)

Key files:
- `api/server.js` — Express server, all routes, Stripe webhooks
- `api/chat-routes.js` — Chat with AI auto-reply
- `api/referral-routes.js` — Referral system with fraud checks
- `api/middleware/requireAdmin.js` — Admin auth (session tokens)
- `src/App.jsx` — Main React app, state, admin panel
- `src/components/Shop.jsx` — Products, cart, checkout
- `src/components/PaymentCard.jsx` — Stripe Elements payment
- `src/components/Referral.jsx` — Referral dashboard page
- `src/components/AdminPanel.jsx` — Admin CRUD (lazy loaded)
- `src/App.css` — All styles

## Priority order
1. Security issues (anything that could lose money or leak data)
2. Memory leaks (things that degrade over time)
3. Settings page design + implementation plan
4. Performance wins
