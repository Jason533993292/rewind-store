import os

root = '/Users/phil/REWIND'
out_path = os.path.join(root, 'REWIND-COMPLETE-V3.txt')

lines = []
lines.append('=' * 80)
lines.append('  REWIND STORE — COMPLETE CODEBASE V13.37.0 FOR CLAUDE REVIEW')
lines.append('=' * 80)
lines.append('')
lines.append('Below is the complete source code of REWIND, a vintage sportswear e-commerce')
lines.append('store running in production at rewind-stores.com.')
lines.append('')
lines.append('Stack: React 18 + Vite (frontend), Express 5 (backend), Supabase (database),')
lines.append('Stripe (payments), Resend (email), Google Gemini/OpenAI (AI chat).')
lines.append('Deployed on Railway with Nixpacks.')
lines.append('')
lines.append('Please review the ENTIRE codebase and suggest improvements in these areas:')
lines.append('')
lines.append('  1.  SECURITY')
lines.append('      - Admin auth (HMAC-signed session tokens, admins table check per request)')
lines.append('      - CSP / Helmet configuration')
lines.append('      - Stripe price validation (server-side computeOrder)')
lines.append('      - Supabase RLS policies and service role key usage')
lines.append('      - IP/email blocklist (in-memory cache with DB hydration)')
lines.append('      - Chat message IP ownership verification')
lines.append('      - Admin audit logging (all admin actions timestamped)')
lines.append('      - XSS, CSRF, injection vectors')
lines.append('')
lines.append('  2.  UI / UX')
lines.append('      - Layout, responsive design, spacing')
lines.append('      - Mobile nav slide-out sheet (replaced select dropdown)')
lines.append('      - Accessibility (ARIA, keyboard nav, focus states, contrast)')
lines.append('      - Product card hover effect (full card lift + scale)')
lines.append('      - Dark mode implementation')
lines.append('      - Search autocomplete dropdown with highlighting')
lines.append('      - Skeleton loading shimmer placeholders')
lines.append('      - Cart, checkout, payment flow')
lines.append('')
lines.append('  3.  BACKEND (api/server.js + api/*.js)')
lines.append('      - Express architecture and middleware')
lines.append('      - API endpoint design and input validation')
lines.append('      - Stripe webhook handling (payment_intent.succeeded)')
lines.append('      - Referral system fraud detection (IP checks, address similarity)')
lines.append('      - Chat system with AI auto-reply (OpenAI + Gemini fallback)')
lines.append('      - Rate limiting (global + per-endpoint)')
lines.append('      - Error handling and logging')
lines.append('')
lines.append('  4.  FRONTEND / REACT')
lines.append('      - Component architecture and file sizes')
lines.append('      - State management (useState, useEffect, useMemo, useCallback)')
lines.append('      - Performance (re-renders, memoization, bundle size)')
lines.append('      - Code-splitting (React.lazy for AdminPanel, SettingsPanel, Shop)')
lines.append('      - TDZ guard patterns')
lines.append('      - Form handling and validation')
lines.append('      - Inline styles vs CSS classes')
lines.append('')
lines.append('  5.  ARCHITECTURE & DEPLOYMENT')
lines.append('      - Project structure')
lines.append('      - Build pipeline (Vite, Nixpacks, Railway)')
lines.append('      - Environment variable management')
lines.append('      - Database schema (Supabase tables)')
lines.append('      - Caching strategy')
lines.append('')
lines.append('  6.  BUSINESS & CONVERSION')
lines.append('      - Cart and checkout flow')
lines.append('      - SEO (JSON-LD structured data, Open Graph, meta tags)')
lines.append('      - Order tracking for customers')
lines.append('      - Referral program with fraud prevention')
lines.append('      - Email campaigns and order confirmations')
lines.append('      - Admin panel (users, orders, products, chat, audits)')
lines.append('')
lines.append('IMPORTANT: Do NOT suggest adding/updating product photos or product')
lines.append('descriptions — the product data (names, prices, categories) is intentional')
lines.append('and already set. Focus on code architecture, security, performance, and UX.')
lines.append('')
lines.append('After your review, provide a prioritized list:')
lines.append('  P0 = Critical — fix immediately')
lines.append('  P1 = Important — fix soon')
lines.append('  P2 = Nice-to-have — when time permits')
lines.append('')
lines.append('Include specific code snippets for each suggested change.')
lines.append('')
lines.append('Latest version (V13.37.0) includes:')
lines.append('  - JSON-LD structured data (Store + Product schemas)')
lines.append('  - Per-product JSON-LD on product pages')
lines.append('  - Mobile nav: replaced ugly select with slide-out sheet')
lines.append('  - Code-splitting: Shop.jsx lazy-loaded separately')
lines.append('  - Admin keyboard shortcuts (1-9 for tabs)')
lines.append('  - Skeleton loading shimmer CSS classes')
lines.append('  - Chat message IP ownership verification')
lines.append('  - Admin audit logging to Supabase audit_log table')
lines.append('  - Audit log viewer in admin panel with one-click block/unblock')
lines.append('  - Promo code fallback in referral validation')
lines.append('  - Promo code live validation UI (debounced)')
lines.append('  - AI auto-reply (OpenAI + Gemini fallback)')
lines.append('  - requireAdmin inline on all admin routes')
lines.append('  - isAdmin checks real token, not just email')
lines.append('  - Instant admin revocation (checks admins table per request)')
lines.append('')
lines.append('=' * 80)
lines.append('  SOURCE FILES')
lines.append('=' * 80)

files = [
    ('src/App.jsx', 'src/App.jsx'),
    ('src/main.jsx', 'src/main.jsx'),
    ('src/data.js', 'src/data.js'),
    ('src/App.css', 'src/App.css'),
    ('index.html', 'index.html'),
    ('src/hooks/useCountdown.js', 'src/hooks/useCountdown.js'),
    ('src/lib/supabase.js', 'src/lib/supabase.js'),
    ('src/components/Shell.jsx', 'src/components/Shell.jsx'),
    ('src/components/Shop.jsx', 'src/components/Shop.jsx'),
    ('src/components/ProductPage.jsx', 'src/components/ProductPage.jsx'),
    ('src/components/ChatBubble.jsx', 'src/components/ChatBubble.jsx'),
    ('src/components/Referral.jsx', 'src/components/Referral.jsx'),
    ('src/components/SettingsPanel.jsx', 'src/components/SettingsPanel.jsx'),
    ('src/components/AdminPanel.jsx', 'src/components/AdminPanel.jsx'),
    ('src/components/InfoModal.jsx', 'src/components/InfoModal.jsx'),
    ('src/components/SizeGuide.jsx', 'src/components/SizeGuide.jsx'),
    ('src/components/RecentlyViewed.jsx', 'src/components/RecentlyViewed.jsx'),
    ('src/components/ClickSpark.jsx', 'src/components/ClickSpark.jsx'),
    ('src/components/Reveal.jsx', 'src/components/Reveal.jsx'),
    ('src/components/Tweaks.jsx', 'src/components/Tweaks.jsx'),
    ('src/components/PaymentCard.jsx', 'src/components/PaymentCard.jsx'),
    ('api/server.js', 'api/server.js'),
    ('api/chat-routes.js', 'api/chat-routes.js'),
    ('api/referral-routes.js', 'api/referral-routes.js'),
    ('api/settings-routes.js', 'api/settings-routes.js'),
    ('api/middleware/requireAdmin.js', 'api/middleware/requireAdmin.js'),
    ('server.js', 'server.js'),
    ('vite.config.js', 'vite.config.js'),
    ('package.json', 'package.json'),
    ('railway.json', 'railway.json'),
]

for label, relpath in files:
    fullpath = os.path.join(root, relpath)
    try:
        with open(fullpath) as f:
            content = f.read()
        total_lines = content.count('\n')
    except Exception as e:
        content = '[ERROR: ' + str(e) + ']'
        total_lines = 0
    
    lines.append('')
    lines.append('=' * 80)
    lines.append('FILE: ' + label + '  (' + str(total_lines) + ' lines)')
    lines.append('=' * 80)
    lines.append('')
    lines.append(content)
    lines.append('')

with open(out_path, 'w') as f:
    f.write('\n'.join(lines))

import os as os2
size = os2.path.getsize(out_path)
print('Written to REWIND-COMPLETE-V3.txt')
print('Lines: ' + str(len(lines)))
print('Size: ' + str(int(size/1024)) + ' KB')
