import os

root = '/Users/phil/REWIND'
out_path = os.path.join(root, 'REWIND-COMPLETE-V4.txt')

lines = []
lines.append('=' * 80)
lines.append('  REWIND STORE — FULL CODEBASE + PROMPT FOR CLAUDE REVIEW')
lines.append('=' * 80)
lines.append('')
lines.append('Below is the complete source code of REWIND (rewind-stores.com).')
lines.append('')
lines.append('Owner: Philippe Anaman (Belgium, sole proprietor, under €25K VAT)')
lines.append('Fulfillment: China (10-25 day shipping). Returns: ALL SALES FINAL.')
lines.append('Tech: React 18 + Vite (frontend), Express 5 (backend), Supabase,')
lines.append('Stripe, Resend, Gemini, OpenAI, Railway.')
lines.append('')
lines.append('Run `python3 build-complete-v4.py` to regenerate this file.')
lines.append('')
lines.append('')
lines.append('=' * 80)
lines.append('  CLAUDE — READ THIS PROMPT FIRST')
lines.append('=' * 80)
lines.append('')
lines.append('You are reviewing a complete vintage streetwear e-commerce store codebase.')
lines.append('The full source code is below this prompt. Review EVERYTHING and give me:')
lines.append('')
lines.append('')
lines.append('---')
lines.append('  CATEGORY 1: SITE-WIDE IMPROVEMENTS (10)')
lines.append('---')
lines.append('Give me 10 ways you would improve the site overall. Think about:')
lines.append('- Overall user experience and flow from landing to purchase')
lines.append('- Conversion rate optimization (cart → checkout → payment → confirmation)')
lines.append('- Performance (load time, bundle size, image optimization)')
lines.append('- SEO (search engines, OpenGraph, JSON-LD, meta tags)')
lines.append('- Analytics and business intelligence')
lines.append('- Error handling and user-facing error messages')
lines.append('- Loading states, empty states, edge cases')
lines.append('- SEO, structured data, sitemap generation')
lines.append('- Dark mode / theming consistency')
lines.append('- Mobile-first responsiveness')
lines.append('')
lines.append('')
lines.append('---')
lines.append('  CATEGORY 2: UI / UX IMPROVEMENTS (10)')
lines.append('---')
lines.append('Give me 10 ways you would improve the UI and user experience:')
lines.append('- Layout and spacing, visual hierarchy')
lines.append('- Accessibility (ARIA labels, keyboard navigation, focus states, contrast)')
lines.append('- Mobile navigation and touch targets')
lines.append('- Animations and micro-interactions')
lines.append('- Form design and validation feedback')
lines.append('- Typography, color, and consistency')
lines.append('- Loading skeletons, spinners, placeholders')
lines.append('- Empty states (no results, empty cart, etc.)')
lines.append('- Cart and checkout UX (steps, progress, clarity)')
lines.append('- Product discovery (search, filters, sorting, categories)')
lines.append('')
lines.append('')
lines.append('---')
lines.append('  CATEGORY 3: FRONTEND IMPROVEMENTS (10)')
lines.append('---')
lines.append('Give me 10 ways you would improve the frontend code:')
lines.append('- React component architecture and file organization')
lines.append('- State management patterns (useState, useMemo, useCallback)')
lines.append('- Performance optimization (re-renders, memoization, lazy loading)')
lines.append('- Bundle size (code splitting, tree-shaking, dependency audit)')
lines.append('- Inline styles vs CSS modules vs styled-components')
lines.append('- Error boundaries and error recovery')
lines.append('- Form handling and validation patterns')
lines.append('- Custom hooks extraction and reusability')
lines.append('- Routing and navigation patterns')
lines.append('- Type safety (TypeScript migration potential)')
lines.append('')
lines.append('')
lines.append('---')
lines.append('  CATEGORY 4: BACKEND IMPROVEMENTS (10)')
lines.append('---')
lines.append('Give me 10 ways you would improve the backend code:')
lines.append('- Express architecture and middleware organization')
lines.append('- API endpoint design and input validation')
lines.append('- Stripe integration (payment intents, webhooks, error handling)')
lines.append('- Database query patterns (Supabase REST vs direct SQL)')
lines.append('- Webhook handling (GitHub, Railway, Stripe — dedup, retry, logging)')
lines.append('- Rate limiting and DDoS protection')
lines.append('- Error handling (try/catch coverage, uncaught rejections)')
lines.append('- File upload handling and image optimization')
lines.append('- Email delivery (Resend integration, templates, reliability)')
lines.append('- Chat system (AI auto-reply, pending queue, notification flow)')
lines.append('')
lines.append('')
lines.append('---')
lines.append('  CATEGORY 5: SECURITY IMPROVEMENTS (10)')
lines.append('---')
lines.append('Give me 10 ways you would improve security:')
lines.append('- Admin authentication (HMAC tokens vs localStorage spoofing)')
lines.append('- CSP headers and helmet configuration')
lines.append('- Stripe payment integrity (server-side computeOrder, amount validation)')
lines.append('- Supabase RLS policies and service role key protection')
lines.append('- Rate limiting strategy (per-endpoint, per-IP, global)')
lines.append('- XSS, CSRF, SQL injection, prompt injection vectors')
lines.append('- Environment variable management and secret rotation')
lines.append('- IP/email blocklist and abuse prevention')
lines.append('- Webhook verification (Stripe signatures, GitHub HMAC)')
lines.append('- Audit logging coverage (all admin actions tracked)')
lines.append('')
lines.append('')
lines.append('---')
lines.append('  CATEGORY 6: CRON BOT IMPROVEMENTS (10)')
lines.append('---')
lines.append('')
lines.append('The store runs 12 Hermes cron bots. Each is an AI agent that runs on a schedule')
lines.append('with access to the full codebase, terminal, file system, and web. They can read,')
lines.append('edit, build, commit, and push code autonomously.')
lines.append('')
lines.append('Give me 10 ways to improve the cron bot system:')
lines.append('- Reliability (what happens when a cron agent crashes mid-fix?)')
lines.append('- Token consumption (5-min Bug Watcher burns tokens investigating the same bug repeatedly)')
lines.append('- Coordination (Bug Watcher fixes something, Store Improver proposes a conflicting improvement)')
lines.append('- Safety (agent pushes code without tests — how to gate this?)')
lines.append('- Reporting (outputs go to this chat — hard to track across days)')
lines.append('- Testing (cron agents edit live code — how to validate before deploy?)')
lines.append('- Escalation (Bug Watcher hits a bug it cant fix — how does it alert?)')
lines.append('- Duplication (multiple crons check the same email/channel — wasted tokens)')
lines.append('- Resource limits (cron agents compete for CPU/memory on the same Mac)')
lines.append('- Priority (abandoned cart is hourly, Bug Watcher is every 5 min — should less important crons run less?)')
lines.append('')
lines.append('')
lines.append('=== CURRENT CRON BOTS ===')
lines.append('')
lines.append('REWIND STORE (8 bots):')
lines.append('')
lines.append('1. Chat auto-reply — Every 10 min')
lines.append('   Checks pending chat messages. Replies ONLY to first message from a new')
lines.append('   customer, and only for 8 specific question types (materials, origin,')
lines.append('   sizing, shipping, returns, discounts, stock, order status).')
lines.append('   Returns: "All sales are final — no returns." Shipping: "10-25 days."')
lines.append('')
lines.append('2. Email Monitor — Every 30 min')
lines.append('   Runs email-monitor.py (Python script checking Gmail All Mail + Spam via IMAP).')
lines.append('   Identifies customer emails (ignores marketing/newsletters). Summarizes')
lines.append('   relevant ones and reports bug reports or customer questions.')
lines.append('')
lines.append('3. Bug Watcher — Every 5 min')
lines.append('   Checks pending chat messages + email for bug reports. Investigates issues,')
lines.append('   edits code, builds, commits, and pushes fixes to origin/main.')
lines.append('   Railway auto-deploys from main. Most frequent and most token-hungry bot.')
lines.append('')
lines.append('4. Webhook Monitor — Every 5 min')
lines.append('   Queries Supabase webhook_events table for new GitHub/Railway/Stripe events.')
lines.append('   Reports deploys, pushes, payment failures, and refunds to this chat.')
lines.append('')
lines.append('5. Abandoned Cart — Every 60 min (currently DISABLED)')
lines.append('   Calls POST /api/cron/abandoned-cart which checks for checkout.session.expired')
lines.append('   events and sends "Still interested?" emails via Resend.')
lines.append('')
lines.append('6. Security Scanner — Daily at 8am')
lines.append('   Checks for exposed secrets, out-of-date npm packages, CSP violations,')
lines.append('   XSS vectors, permissions issues, and missing auth gates.')
lines.append('')
lines.append('7. Daily Briefing — Daily at 8am')
lines.append('   Summarizes yesterday: orders placed, emails received, chats answered,')
lines.append('   bugs fixed, deploys made, and any security incidents.')
lines.append('')
lines.append('8. Store Improver — Every 2.5 hours (currently DISABLED)')
lines.append('   Proposes 5 improvements. Uses Problem:/Solution: format.')
lines.append('   Does NOT implement changes without approval.')
lines.append('')
lines.append('')
lines.append('SMOKER.APP (4 bots — separate PWA smoking cessation app):')
lines.append('')
lines.append('9. Smoker Bug Watcher — Every 30 min')
lines.append('   Checks JS syntax, page render, git status of Smoker.app.')
lines.append('')
lines.append('10. Smoker Improver — Every 3 hours (currently DISABLED)')
lines.append('    Proposes 3 improvements. Problem:/Solution: format.')
lines.append('')
lines.append('11. Smoker Security Scanner — Daily at 8am')
lines.append('    Audits XSS, localStorage, PWA manifest, import flow.')
lines.append('')
lines.append('12. Smoker Daily Briefing — Daily at 8am')
lines.append('    JS status, recent changes, file sizes.')
lines.append('')
lines.append('')
lines.append('---')
lines.append('  OUTPUT FORMAT')
lines.append('---')
lines.append('')
lines.append('For each category, number your suggestions 1-10. For each suggestion:')
lines.append('')
lines.append('1. Title: One-line summary')
lines.append('   Problem: Why this is needed')
lines.append('   Solution: What to change (include specific file path + line numbers)')
lines.append('   Code: A code snippet showing the fix')
lines.append('   Priority: P0 (Critical) / P1 (Important) / P2 (Nice-to-have)')
lines.append('')
lines.append('')
lines.append('=' * 80)
lines.append('  FULL SOURCE CODE BELOW')
lines.append('=' * 80)
lines.append('')
lines.append('TECH STACK: React 18 + Vite (frontend), Express 5 (backend), Supabase (DB),')
lines.append('Stripe (payments), Resend (email), Gemini/OpenAI (AI).')
lines.append('Deployed on Railway. 47 source files, ~720KB total.')
lines.append('')
lines.append('RECENT DEPLOYED FIXES:')
lines.append('- free_shipping promo: const→let shipping fix')
lines.append('- Site crash: msgs→BANNER_MSGS')
lines.append('- Custom product edit: sending numeric id, not string product_id')
lines.append('- Email monitor: All Mail + Spam scanning')
lines.append('- Checkout 500: real Stripe error logging')
lines.append('- AudioContext: deferred to first user gesture')
lines.append('- Webhooks: GitHub header detection + ping support')
lines.append('')
lines.append('UNSOLVED PROBLEMS:')
lines.append('- Stripe Identity Alipay verification (may block charges)')
lines.append('- Emails from alt account go to Gmail Spam')
lines.append('- Abandoned cart cron untested')
lines.append('- Wishlist sync endpoint untested')
lines.append('- Vite chunk warnings for Three.js bundle')
lines.append('- Order tracking needs courier integration')
lines.append('')
lines.append('')
lines.append('=' * 80)
lines.append('  ALL SOURCE FILES')
lines.append('=' * 80)

files = [
    ('src/App.jsx', 'src/App.jsx'),
    ('src/App.css', 'src/App.css'),
    ('src/main.jsx', 'src/main.jsx'),
    ('src/data.js', 'src/data.js'),
    ('index.html', 'index.html'),
    ('src/hooks/useCountdown.js', 'src/hooks/useCountdown.js'),
    ('src/lib/supabase.js', 'src/lib/supabase.js'),
    ('src/lib/router.js', 'src/lib/router.js'),
    ('src/lib/adminApi.js', 'src/lib/adminApi.js'),
    ('src/components/Shell.jsx', 'src/components/Shell.jsx'),
    ('src/components/Shop.jsx', 'src/components/Shop.jsx'),
    ('src/components/ProductPage.jsx', 'src/components/ProductPage.jsx'),
    ('src/components/ChatBubble.jsx', 'src/components/ChatBubble.jsx'),
    ('src/components/Referral.jsx', 'src/components/Referral.jsx'),
    ('src/components/SettingsPanel.jsx', 'src/components/SettingsPanel.jsx'),
    ('src/components/AdminPanel.jsx', 'src/components/AdminPanel.jsx'),
    ('src/components/AdminOrdersPanel.jsx', 'src/components/AdminOrdersPanel.jsx'),
    ('src/components/AdminChatPanel.jsx', 'src/components/AdminChatPanel.jsx'),
    ('src/components/EditProductPanel.jsx', 'src/components/EditProductPanel.jsx'),
    ('src/components/ProductForm.jsx', 'src/components/ProductForm.jsx'),
    ('src/components/OrderConfirmed.jsx', 'src/components/OrderConfirmed.jsx'),
    ('src/components/OrderTracking.jsx', 'src/components/OrderTracking.jsx'),
    ('src/components/InfoModal.jsx', 'src/components/InfoModal.jsx'),
    ('src/components/SizeGuide.jsx', 'src/components/SizeGuide.jsx'),
    ('src/components/RecentlyViewed.jsx', 'src/components/RecentlyViewed.jsx'),
    ('src/components/PaymentCard.jsx', 'src/components/PaymentCard.jsx'),
    ('src/components/ClickSpark.jsx', 'src/components/ClickSpark.jsx'),
    ('src/components/Reveal.jsx', 'src/components/Reveal.jsx'),
    ('src/components/Tweaks.jsx', 'src/components/Tweaks.jsx'),
    ('src/components/CookieBanner.jsx', 'src/components/CookieBanner.jsx'),
    ('src/components/CustomerMap.jsx', 'src/components/CustomerMap.jsx'),
    ('src/components/BlockedPanel.jsx', 'src/components/BlockedPanel.jsx'),
    ('src/components/AuditLogPanel.jsx', 'src/components/AuditLogPanel.jsx'),
    ('src/components/CreatePromoCode.jsx', 'src/components/CreatePromoCode.jsx'),
    ('src/components/SidebarBtn.jsx', 'src/components/SidebarBtn.jsx'),
    ('src/components/Survey.jsx', 'src/components/Survey.jsx'),
    ('src/components/LegalPage.jsx', 'src/components/LegalPage.jsx'),
    ('api/server.js', 'api/server.js'),
    ('api/chat-routes.js', 'api/chat-routes.js'),
    ('api/referral-routes.js', 'api/referral-routes.js'),
    ('api/settings-routes.js', 'api/settings-routes.js'),
    ('api/push-routes.js', 'api/push-routes.js'),
    ('server.js', 'server.js'),
    ('vite.config.js', 'vite.config.js'),
    ('package.json', 'package.json'),
    ('vercel.json', 'vercel.json'),
    ('playwright.config.js', 'playwright.config.js'),
]

for label, relpath in files:
    fullpath = os.path.join(root, relpath)
    try:
        with open(fullpath, encoding='utf-8', errors='replace') as f:
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

with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

size = os.path.getsize(out_path)
print('Written to REWIND-COMPLETE-V4.txt')
print('Lines: ' + str(len(lines)))
print('Files: ' + str(len(files)))
print('Size: ' + str(int(size/1024)) + ' KB')
