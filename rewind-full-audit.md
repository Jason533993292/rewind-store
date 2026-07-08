# REWIND Store — Full Codebase for Claude AI Review

**Site:** rewind-stores.com
**Stack:** React/Vite · Express · Supabase · Stripe (Elements) · Resend · Gemini
**Version:** V10.7.0 — **Live on Railway**

---

## Current State

### ✅ Working
- Product grid (3 columns on desktop, 2 tablet, 1 mobile)
- Cart/wishlist/checkout flow
- Stripe Elements inline payments (no redirect)
- Payment card preview with brand detection, 3D tilt on hover, CVV flip
- Confetti on order confirmation
- Admin panel (orders, users, chats, products, changelog)
- Live chat (customer widget + admin panel with close/block/promo)
- Cancel orders with reason-specific canned emails
- Promo codes (static + DB-backed)
- AI auto-reply in chat (Gemini)

### ❌ Known Issues
- Stripe Elements card preview shows dots (can't show numbers — Stripe security)
- CSP might still need tuning if new Stripe subdomains appear

---

## Key Files

### File: src/components/PaymentCard.jsx (328 lines)
Full Stripe Elements integration. Uses forwardRef + useImperativeHandle to expose pay(). Features brand detection, 3D tilt, CVV flip, gloss animation, confetti on order confirmed.

### File: src/components/Shop.jsx (~997 lines)
Checkout component with Stripe Elements, contact/delivery forms, promo codes, order summary.

### File: api/server.js (~983 lines)
Express server with Stripe PaymentIntent endpoint, webhooks, admin auth (requireAdmin), Supabase integration.

### File: api/chat-routes.js (~274 lines)
Chat API with rate limiting, AI auto-reply, session management, admin endpoints.

### File: src/App.css
Custom CSS with card animations (ccGloss, 3D flip, confettiFall) and grid breakpoints.

---

## PROMPT FOR CLAUDE

Review the REWIND vintage streetwear store at rewind-stores.com (React/Vite + Express + Supabase + Stripe Elements + Resend + Gemini). V10.7.0 live.

Focus on:

**1. SECURITY**
- Any endpoint missing requireAdmin
- Stripe webhook signature verification
- Price/discount tampering in checkout
- CSP gaps
- Injection risks

**2. PERFORMANCE**
- Bundle size (550KB JS — what can be split/lazy-loaded?)
- useEffect cleanup and stale closures
- Polling efficiency (chat polls every 5/30s)
- Image optimization

**3. UI/UX IMPROVEMENTS**
- Mobile responsiveness of checkout
- Loading states and error boundaries
- Accessibility (aria labels, keyboard nav, focus management)
- Card preview animations polish

**4. CODE QUALITY**
- Unused imports/dead code
- Duplicate logic (server.js vs chat-routes.js)
- The AdminPanel is 1000+ lines in App.jsx — extract?
- CSS consolidation

Give me a **prioritized list** with exact code snippets for each fix.
