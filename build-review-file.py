import os

root = '/Users/phil/REWIND'
out_path = os.path.join(root, 'REWIND-REVIEW-V2.txt')

lines = []
lines.append('=' * 80)
lines.append('  REWIND STORE - COMPLETE CODEBASE FOR CLAUDE REVIEW')
lines.append('=' * 80)
lines.append('')
lines.append('Below is the complete source code of REWIND, a vintage sportswear e-commerce')
lines.append('store. It uses React 18 + Vite (frontend), Express 5 (backend), Supabase')
lines.append('(database), Stripe (payments), and Resend (email). Deployed on Railway.')
lines.append('')
lines.append('Please review the code and suggest improvements in these areas:')
lines.append('')
lines.append('  1.  SECURITY - Admin auth, CSP, Stripe validation, RLS, blocklists, XSS')
lines.append('  2.  UI / UX - Layout, accessibility, mobile, dark mode, search, animations')
lines.append('  3.  BACKEND - Express architecture, API design, webhooks, rate limiting')
lines.append('  4.  FRONTEND / REACT - Components, state mgmt, performance, code-splitting')
lines.append('  5.  ARCHITECTURE and DEPLOYMENT - Structure, build pipeline, env vars, DB')
lines.append('  6.  BUSINESS and CONVERSION - Cart, checkout, SEO, wishlist, referrals')
lines.append('')
lines.append('Provide a prioritized list: P0 = Critical, P1 = Important, P2 = Nice-to-have')
lines.append('Include specific code snippets for each suggestion.')
lines.append('')
lines.append('Latest version (V13.0.0) includes these recent fixes:')
lines.append('  - Invisible AI text in chat fixed')
lines.append('  - AI messages in admin panel have distinct dashed-border styling')
lines.append('  - Order status changed from confirmed to pending')
lines.append('  - Dead /api/create-checkout-session route removed')
lines.append('  - Dead checkout.session.completed webhook branch removed')
lines.append('  - sendOrderConfirmationEmail() extracted as standalone function')
lines.append('  - fulfillReferral() extracted as standalone function on router')
lines.append('  - Webhook calls both directly instead of HTTP loopback')
lines.append('  - requireAdmin checks Supabase admins table on every request')
lines.append('')
lines.append('=' * 80)
lines.append('  SOURCE FILES')
lines.append('=' * 80)

files = [
    ('src/App.jsx', 'src/App.jsx'),
    ('src/main.jsx', 'src/main.jsx'),
    ('src/data.js', 'src/data.js'),
    ('src/App.css', 'src/App.css'),
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
print('Written ' + str(len(lines)) + ' lines to REWIND-REVIEW-V2.txt')
print('File size: ' + str(int(size/1024)) + ' KB')
