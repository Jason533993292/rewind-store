# REWIND Store Changelog

## 2026-07-30
- **New:** Self-hosted analytics dashboard (visitors, countries, browsers, OS)
- **New:** llms-full.txt for AI agent documentation
- **New:** OpenAPI spec at /openapi.json
- **New:** MCP config at /mcp.json
- **Improvement:** Rate limit increased 120→300 req/min
- **Improvement:** CSP hashes updated to match current scripts
- **Improvement:** Edit product page — inline validation, live preview, drag reorder, duplicate button
- **Fix:** Edit product save now works (*** header corruption fixed)
- **Fix:** Product delete now works (same *** header fix)

## 2026-07-29
- **New:** Chat session auto-close after 24h inactivity
- **New:** Order confirmed checkmark animation
- **New:** Sold-out badge pulse animation
- **New:** Admin panel CSS utility classes
- **Improvement:** Order search expanded from 50→200 results
- **Improvement:** Footer tests more reliable
- **Fix:** Chat icon — outline SVG, orange hue, hover popup
- **Fix:** Aria-labels on admin icon-only buttons

## Earlier
- Initial store launch
- Supabase product database
- Stripe payments (card, Bancontact, iDEAL, Klarna, PayPal, Apple Pay, Google Pay)
- Chat support with auto-reply
- Admin panel with user/order/chat management
- Plausible analytics
