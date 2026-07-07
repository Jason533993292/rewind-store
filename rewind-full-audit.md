# REWIND Store — Full Codebase for Claude AI

## SITE
**URL:** rewind-stores.com (Cloudflare → Railway)
**Stack:** React/Vite · Express · Supabase · Stripe · Resend · Gemini
**Version:** V8.9.0 (Restored - all features working)
**Admin:** Visit /#admin, login with email + token

---

## ALL SOURCE FILES

### File: src/App.css (Full CSS)

\`\`\`css
:root {
  --bg: #FAF6EF;
  --surface: #FFFFFF;
  --ink: #16130F;
  --muted: #6E665A;
  --line: #E8E0D2;
  --line-2: #D9D0C0;
  --accent: #FF4D14;
  --font-head: "Bricolage Grotesque", sans-serif;
  --font-body: "Space Grotesk", sans-serif;
  --r: 14px;
  --r-sm: 10px;
  --shadow: 0 1px 2px rgba(22,19,15,.04), 0 10px 30px -12px rgba(22,19,15,.18);
  --maxw: 1240px;
}

* { box-sizing: border-box; }
html { overflow-x: hidden; width: 100%; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden; width: 100%;
}
h1, h2, h3, h4 {
  font-family: var(--font-head);
  margin: 0;
  letter-spacing: -.02em;
  line-height: 1.02;
}
button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
input { font-family: inherit; }
a { color: inherit; cursor: pointer; }
::selection { background: var(--accent); color: #fff; }

/* ---- buttons ---- */
.rw-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: .5em;
  font-family: var(--font-head); font-weight: 700; font-size: 15px; letter-spacing: -.01em;
  padding: 14px 22px; border-radius: 999px;
  transition: transform .16s cubic-bezier(.3,1.4,.5,1), background .18s, color .18s, box-shadow .18s;
  white-space: nowrap; position: relative; overflow: hidden;
}
.rw-btn::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%);
  transform: translateX(-100%); transition: transform 0.5s ease; pointer-events: none; border-radius: inherit;
}
.rw-btn:hover::after { transform: translateX(100%); }
.rw-btn:active::before {
  content: ''; position: absolute; top: 50%; left: 50%; width: 0; height: 0;
  background: rgba(255,255,255,0.2); border-radius: 50%;
  transform: translate(-50%, -50%); animation: ripple 0.6s ease-out; z-index: 1;
}
@keyframes ripple { to { width: 400px; height: 400px; opacity: 0; } }
.rw-btn-pri { background: var(--ink); color: #fff; }
.rw-btn-pri:hover {
  background: var(--accent);
  transform: translateY(-2px) scale(1.025);
  box-shadow: 0 12px 24px -8px color-mix(in oklab, var(--accent) 60%, transparent);
}
.rw-btn-ghost {
  background: transparent; color: var(--ink);
  box-shadow: inset 0 0 0 1.5px var(--line-2);
}
.rw-btn-ghost:hover { box-shadow: inset 0 0 0 1.5px var(--ink); transform: translateY(-2px) scale(1.025); }
.rw-btn-full { width: 100%; }
.rw-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.rw-btn:disabled .rw-spinner{display:inline-block;animation:spin .6s linear infinite;margin-right:6px;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;}
@keyframes spin{to{transform:rotate(360deg);}}

/* ---- banner ---- */
.rw-banner {
  background: var(--accent); color: #fff;
  display: flex; align-items: center; justify-content: center; gap: 28px;
  padding: 9px 20px; font-size: 13.5px; font-weight: 500;
  position: relative; overflow: hidden;
}
.rw-banner-track { display: flex; align-items: center; gap: 7px; animation: fadeUp .5s ease; }
.rw-banner-track svg { opacity: .9; }
.rw-banner-count {
  display: flex; align-items: center; gap: 8px; font-size: 12.5px;
  background: rgba(0,0,0,.16); padding: 5px 12px; border-radius: 999px; font-weight: 600;
}
.rw-banner-count b { font-variant-numeric: tabular-nums; letter-spacing: .02em; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes genieUp { from { opacity: 0; transform: scale(0.3) translateY(30px); } to { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes genieDown { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.3) translateY(30px); } }
@keyframes confettiFall { 0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) translateX(var(--drift, 0)) rotate(var(--rotation, 720deg)); opacity: 0; } }
@media (max-width: 720px) { .rw-banner { gap: 14px; font-size: 12px; } .rw-banner-track span { display: none; } }
@media (max-width: 540px) { .rw-banner-count { display: none; } }

/* ---- header ---- */
.rw-header {
  position: sticky; top: 0; z-index: 50;
  background: color-mix(in oklab, var(--bg) 88%, transparent);
  backdrop-filter: blur(14px); border-bottom: 1px solid var(--line);
}
.rw-header-row {
  max-width: var(--maxw); margin: 0 auto; padding: 14px 24px;
  display: flex; align-items: center; gap: 24px;
}
.rw-logo { font-family: var(--font-head); font-weight: 800; font-size: 26px; letter-spacing: -.04em; }
.rw-logo span { color: var(--accent); }
.rw-logo-lg { font-size: 40px; }
.rw-nav { display: flex; gap: 4px; margin-left: 8px; }
.rw-navlink {
  font-weight: 600; font-size: 14.5px; padding: 8px 12px; border-radius: 999px;
  color: var(--muted); transition: color .15s, background .15s;
}
.rw-navlink:hover { color: var(--ink); }
.rw-navlink.is-on { color: var(--ink); background: color-mix(in oklab, var(--accent) 16%, transparent); }
.rw-header-actions { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.rw-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
  padding: 8px 14px; color: var(--muted); transition: border-color .15s, box-shadow .15s;
}
.rw-search:focus-within {
  border-color: var(--ink);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent);
}
.rw-search input { border: none; outline: none; background: none; width: 120px; font-size: 14px; color: var(--ink); transition: width .2s ease; }
.rw-search:focus-within input { width: 220px; }
.rw-iconbtn {
  position: relative; width: 42px; height: 42px; border-radius: 999px;
  display: grid; place-items: center;
  background: var(--surface); border: 1px solid var(--line);
  transition: transform .16s cubic-bezier(.3,1.4,.5,1), border-color .15s;
}
.rw-iconbtn:hover { transform: scale(1.08); border-color: var(--ink); }
.rw-badge {
  position: absolute; top: -5px; right: -5px; min-width: 20px; height: 20px; padding: 0 5px;
  background: var(--accent); color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700;
  display: grid; place-items: center; border: 2px solid var(--bg);
}
@media (max-width: 880px) { .rw-nav { display: none; } .rw-search input { width: 80px; } .rw-search:focus-within input { width: 160px; } }
@media (max-width: 540px) { .rw-header-row { padding: 0 12px; gap: 6px; } .rw-search input { width: 60px; font-size: 12px; } .rw-search:focus-within input { width: 110px; } .rw-logo { font-size: 18px; } }

/* ---- photo tile ---- */
.rw-photo {
  position: relative; width: 100%; overflow: hidden; border-radius: var(--r-sm);
  background: var(--ink);
}
.rw-photo-bg { position: absolute; inset: 0; display: grid; place-items: center; }
.rw-photo-word {
  font-family: var(--font-head); font-weight: 800; color: rgba(255,255,255,.82);
  font-size: clamp(13px,1.4vw,17px); letter-spacing: .02em; text-align: center;
  padding: 0 14px; line-height: 1.05;
  text-shadow: 0 1px 14px rgba(0,0,0,.25); mix-blend-mode: overlay;
}

/* ---- hero ---- */
.rw-hero {
  max-width: var(--maxw); margin: 0 auto; padding: 56px 24px 30px;
  display: grid; grid-template-columns: 1.05fr .95fr; gap: 48px; align-items: center;
}
.rw-hero-kicker {
  display: inline-flex; align-items: center; gap: 6px;
  font-weight: 600; font-size: 13px; text-transform: uppercase;
  letter-spacing: .12em; color: var(--accent); margin-bottom: 18px;
}
.rw-hero-title { font-size: clamp(46px,6.6vw,88px); font-weight: 800; letter-spacing: -.045em; min-height: 1.35em; }
.type-wrap { display: inline-block; min-width: 1ch; }
.type-cursor { animation: blink-cursor 0.7s step-end infinite; color: var(--accent); font-weight: 100; margin-left: 1px; }
@keyframes blink-cursor { 50% { opacity: 0; } }
.rw-hero-sub {
  font-size: 17.5px; color: var(--muted); max-width: 30ch;
  margin: 20px 0 28px; line-height: 1.55; text-wrap: pretty;
}
.rw-hero-cta { display: flex; gap: 12px; flex-wrap: wrap; }
.rw-hero-stats { display: flex; gap: 32px; margin-top: 34px; }
.rw-hero-stats div { display: flex; flex-direction: column; }
.rw-hero-stats b { font-family: var(--font-head); font-weight: 700; font-size: 24px; }
.rw-hero-stats span { font-size: 13px; color: var(--muted); }
.rw-hero-art { display: grid; grid-template-columns: 1fr; gap: 14px; }
.rw-hero-loop { animation: heroPulse 4s ease-in-out infinite; }
@keyframes heroPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.02); opacity: 0.9; } }
@media (prefers-reduced-motion: reduce) { .rw-hero-loop { animation: none; } }
.rw-hero-art .rw-photo:first-child { grid-row: 1 / span 2; }
@media (max-width: 860px) { .rw-hero { grid-template-columns: 1fr; gap: 28px; padding-top: 36px; } .rw-hero-art { grid-template-columns: 1.2fr 1fr; } }

/* ---- marquee ---- */
.rw-marquee { background: var(--ink); color: var(--bg); overflow: hidden; padding: 13px 0; margin-top: 14px; }
.rw-marquee-track { display: flex; gap: 40px; width: max-content; animation: scroll 30s linear infinite; }
.rw-marquee-item { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-head); font-weight: 700; font-size: 15px; letter-spacing: .01em; white-space: nowrap; }
.rw-marquee-item svg { color: var(--accent); }
.rw-marquee-track > * { flex-shrink: 0; }
@keyframes scroll { to { transform: translateX(-33.333%); } }
.rw-marquee-track:hover { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .rw-marquee-track { animation: none; } }

/* ---- shop ---- */
.rw-shop { max-width: var(--maxw); margin: 0 auto; padding: 54px 24px 70px; }
.rw-shop-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 28px; flex-wrap: wrap; }
.rw-shop-headl { flex: 1 1 auto; min-width: 200px; }
.rw-shop-title { font-size: clamp(30px,3.6vw,46px); font-weight: 800; }
.rw-shop-sub { color: var(--muted); font-size: 14.5px; margin-top: 6px; }
.rw-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.rw-chip { font-weight: 600; font-size: 14px; padding: 9px 16px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); color: var(--muted); transition: transform .16s cubic-bezier(.3,1.4,.5,1), background .15s, color .15s, border-color .15s; }
.rw-chip:hover { transform: translateY(-2px); color: var(--ink); border-color: var(--line-2); }
.rw-chip.is-on { background: var(--ink); color: #fff; border-color: var(--ink); }
.rw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 22px 18px; }
.rw-section-head { font-size: 14px; font-weight: 600; color: var(--muted); margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 1px; }
@media (max-width: 1080px) { .rw-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); } }
@media (max-width: 700px) { .rw-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); } }
@media (max-width: 440px) { .rw-grid { grid-template-columns: 1fr; } }
@media (max-width: 680px) { #rw-sidebar { display: none; } }
@media (min-width: 681px) { #rw-mobile-cat, .rw-mobile-brand { display: none !important; } }
@media (max-width: 540px) { .rw-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; } .rw-shop { padding: 24px 12px 50px; } }
@media (max-width: 540px) { .rw-card .rw-photo { height: 160px !important; } .rw-card-body { padding: 10px 12px; } .rw-card-name { font-size: 13px; } .rw-card-price { font-size: 15px; } .rw-card-was { font-size: 11px; } }
.rw-empty { padding: 60px 0; text-align: center; color: var(--muted); font-size: 16px; }
/* ... rest of CSS continues with modals, checkout, drawers, cart, admin, etc ... */
\`\`\`

---

## PROMPT FOR CLAUDE

I run a vintage streetwear store at **rewind-stores.com**. Tech: React/Vite + Express + Supabase + Stripe + Resend + Gemini.

**What's broken:** My grid layout keeps breaking when someone tries to fix it. The current grid uses `auto-fill` with `minmax()` which I want to keep working. Quick view buttons and like/save buttons need to be fully functional.

**Features that exist:**
- Live chat (ChatBubble.jsx, chat-routes.js, admin Chat tab with close/block/promo)
- Cancel orders with step indicators + reason-specific emails
- Promo codes (static + DB-backed)
- Admin panel with orders/users/chats/products/changelog tabs
- Stripe payments + webhooks
- Blocked IPs/emails
- AI auto-reply for chat (Gemini)
- Custom products with image uploads

**Please review the entire codebase for:**
1. Grid layout — make it 3 columns on desktop, 2 on tablet, 1 on mobile without breaking quick view/like buttons
2. Security — any endpoint missing `requireAdmin`, Stripe webhook issues, price tampering in checkout
3. Chat bugs — session handling, notification badge, modals for block/close/promo
4. UI/UX — loading states, error feedback, hover states, mobile responsiveness
5. Code quality — unused imports, duplicate code, bundle size (544KB)

Give me a prioritized list with exact code snippets for each fix.
