import os

root = '/Users/phil/REWIND'
out_path = os.path.join(root, 'REWIND-KIMI-AUDIT.txt')

lines = []
lines.append('=' * 80)
lines.append('  REWIND STORE — FULL CODEBASE + PROMPT FOR KIMI REVIEW')
lines.append('=' * 80)
lines.append('')
lines.append('Below is the complete source code of REWIND (rewind-stores.com).')
lines.append('')
lines.append('Owner: Philippe Anaman (Belgium, sole proprietor, under €25K VAT)')
lines.append('Fulfillment: China (10-25 day shipping). Returns: ALL SALES FINAL.')
lines.append('Tech: React 18 + Vite (frontend), Express 5 (backend), Supabase,')
lines.append('Stripe, Resend, Gemini, OpenAI, Railway.')
lines.append('')
lines.append('=' * 80)
lines.append('  KIMI — READ THIS PROMPT FIRST')
lines.append('=' * 80)
lines.append('')
lines.append('You are performing a FULL AUDIT of a complete vintage streetwear')
lines.append('e-commerce store. The entire source code is below this prompt.')
lines.append('Read EVERYTHING and give me a structured audit with EXACTLY:')
lines.append('')
lines.append('10 SECURITY BUGS/FIXES — find real security issues (XSS, CSRF, IDOR,')
lines.append('SQL injection, auth bypass, RLS gaps, exposed secrets, rate limiting')
lines.append('holes, webhook verification). For each: FILE:LINE, the bug, and the fix.')
lines.append('')
lines.append('10 UI BUGS/FIXES — visual and interaction problems (broken layout,')
lines.append('overlapping elements, dead clicks, missing states, contrast issues,')
lines.append('broken hover/animations, responsive breakpoint bugs).')
lines.append('')
lines.append('10 FRONTEND BUGS/FIXES — code-level React issues (state bugs,')
lines.append('re-render problems, stale closures, missing keys, effect cleanup,')
lines.append('memory leaks, bundle bloat, error boundaries, performance).')
lines.append('')
lines.append('10 BACKEND BUGS/FIXES — server issues (input validation gaps,')
lines.append('unhandled promise rejections, Stripe amount integrity, order flow,')
lines.append('Supabase query issues, error handling, race conditions, logging).')
lines.append('')
lines.append('PLUS — what you would improve to the FRONTEND and UX overall:')
lines.append('conversion flow (landing to purchase), performance, accessibility,')
lines.append('empty/loading states, mobile experience, and visual polish.')
lines.append('')
lines.append('OUTPUT FORMAT for every finding:')
lines.append('1. Title: one-line summary')
lines.append('   File:Line: where it is')
lines.append('   Problem: why it matters')
lines.append('   Fix: what to change (with a code snippet)')
lines.append('   Priority: P0 (critical) / P1 (important) / P2 (nice-to-have)')
lines.append('')
lines.append('Be specific and honest. Only report REAL issues you can point to in')
lines.append('the code — no generic filler. Prioritize P0/P1. Number each item 1-10.')
lines.append('')
lines.append('=' * 80)
lines.append('  PROJECT CONTEXT')
lines.append('=' * 80)
lines.append('')
lines.append('TECH STACK: React 18 + Vite, Express 5, Supabase (PostgreSQL),')
lines.append('Stripe, Resend, Railway.')
lines.append('')
lines.append('RECENT FIXES ALREADY APPLIED (do not re-suggest):')
lines.append('- free_shipping promo: const to let shipping fix')
lines.append('- Custom product edit: sending numeric id not string product_id')
lines.append('- Rate limiting raised 120 to 300 req/min')
lines.append('- Admin login: email must include @gmail.com exactly')
lines.append('- CSP allows localhost:4747 for Agentation dev toolbar')
lines.append('- Search now navigates to product page')
lines.append('- Chat bubble always orange; logo W orange with hover pop')
lines.append('- Sidebar is sticky, marquee GPU-composited')
lines.append('')
lines.append('UNSOLVED / KNOWN LIMITS:')
lines.append('- Stripe Identity Alipay verification may block charges')
lines.append('- Emails from alt account go to Gmail Spam')
lines.append('- Abandoned cart cron untested')
lines.append('- Vite chunk warning for Three.js bundle (~2MB vendor-three)')
lines.append('- Order tracking needs courier integration')
lines.append('- 91 product images labelled but not all in Supabase yet')
lines.append('')
lines.append('=' * 80)
lines.append('  ALL SOURCE FILES')
lines.append('=' * 80)
lines.append('')

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
    ('src/components/BugReportModal.jsx', 'src/components/BugReportModal.jsx'),
    ('api/server.js', 'api/server.js'),
    ('api/chat-routes.js', 'api/chat-routes.js'),
    ('api/referral-routes.js', 'api/referral-routes.js'),
    ('api/settings-routes.js', 'api/settings-routes.js'),
    ('api/push-routes.js', 'api/push-routes.js'),
    ('api/routes/admin-products.js', 'api/routes/admin-products.js'),
    ('server.js', 'server.js'),
    ('vite.config.js', 'vite.config.js'),
    ('package.json', 'package.json'),
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
print('Written to REWIND-KIMI-AUDIT.txt')
print('Lines: ' + str(len(lines)))
print('Files: ' + str(len(files)))
print('Size: ' + str(int(size/1024)) + ' KB')
