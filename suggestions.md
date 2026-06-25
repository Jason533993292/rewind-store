# REWIND — Suggestions & Improvements

## [DONE] Product detail page quantity stepper buttons have no hover feedback — inconsistent with cart drawer
- **Where:** `src/components/ProductPage.jsx` lines 150–154 — the `+` and `−` quantity buttons: `<button onClick={() => setQty(Math.max(1, qty - 1))} style={{...}}>−</button>` and `<button onClick={() => setQty(Math.min(p.stock || 99, qty + 1))} style={{...}}>+</button>`
- **What:** These buttons use bare inline styles (`border: '1px solid #ddd'`, `background: '#fff'`, no `transition`) with zero hover state. Mousing over them does absolutely nothing — no color shift, no background change, no border highlight. They feel completely dead.
- **Compare:** The cart drawer quantity buttons (`.rw-qty button` in App.css line 395–396) have `transition: background .15s` and `.rw-qty button:hover { background: var(--line); }` — a subtle but essential hover cue that tells the user the button is interactive.
- **Impact:** These are the *only* interactive elements users engage with before hitting the "Add to bag" CTA (alongside the size picker). When both the size buttons and the add-to-bag button have polished hover effects but the quantity steppers sit there inert, it creates a jarring inconsistency right at the point of purchase. It's especially noticeable on the product page where every other button now has proper feedback.
- **Fix:** Either (A) add `onMouseOver`/`onMouseOut` handlers: `onMouseOver={e => e.target.style.background = '#f0f0f0'}` / `onMouseOut={e => e.target.style.background = '#fff'}` with `transition: 'background 0.15s'` on the style, or (B) better: reuse the `.rw-qty` CSS class pattern from the cart drawer and define `.rw-qty-btn` in App.css with `transition: all .15s` and a `:hover` that changes background to `var(--line)` and darkens the border to `var(--line-2)`.

## [DONE] Product detail page size-selector buttons have no hover feedback — inconsistent with QuickView modal
- Status: [DONE] — Replaced inline styles with `className={"rw-size" + (size === s ? " is-on" : "")}` in `src/components/ProductPage.jsx`. Buttons now inherit hover transition (`border-color → var(--ink)`, `transition: all .15s`) from `.rw-size` CSS class while maintaining the circular 52×52px pill shape via inline style override.
- **Where:** `src/components/ProductPage.jsx` lines 133–145 — the circular size buttons: `<button key={s} onClick={() => setSize(s)} style={{...}}>`
- **What:** The size-picker buttons on the full product page use bare inline styles (`border: '1px solid #ddd'`, `background: '#fff'`) with zero CSS `transition` and no `:hover` state. Every other size selector in the app — the QuickView modal's `.rw-size` buttons (Shop.jsx line 198) — uses the `.rw-size` CSS class which provides `transition: all .15s` and `.rw-size:hover { border-color: var(--ink); }`. The product page buttons feel dead by comparison: mousing over them does absolutely nothing.
- **Why it matters:** Size selection is the *only* required action before the user can hit the "Add to bag" CTA. When the buttons have no hover feedback, the interface feels unresponsive and incomplete at the most critical decision point in the purchase flow — especially right after the user may have just seen the lively QuickView modal with its polished size buttons.
- **Fix:** Replace the inline styles with `className={"rw-size" + (size === s ? " is-on" : "")}` and drop the hardcoded `style={{...}}`. The `.rw-size` class already handles: base (min-width 46px, padding, border-radius 9px, border 1.5px solid var(--line-2), font-weight 600), hover (border-color → var(--ink)), and active state (`.rw-size.is-on` → ink bg, white text). The circular 52×52px pills would become rounded rectangles — that's a design choice to make, but either way they'll gain proper hover feedback.

## [DONE] Product detail page "Add to bag" button has no hover animation — feels flat vs every other primary CTA
- **Where:** `src/components/ProductPage.jsx` lines 160–171 — the main `<button onClick={() => { if (onAdd) onAdd(p, size); }}>` 
- **What:** This is the single most important CTA on the product detail page, but it used hardcoded inline styles (`background: '#16130F'`, no transition) with zero animation. Every other primary button in the app — product cards (`.rw-add`), QuickView modal (`.rw-btn-pri`), checkout — has a polished hover effect: `translateY(-2px) scale(1.025)` + accent color swap + shadow. This button just sat there, dead, while the user's mouse was on it.
- **Impact:** The button was invisible as an interactive element until clicked. After interacting with the lively card grid and maybe the QuickView modal (both of which have satisfying button feedback), the product page's add-to-bag button felt broken or cheap by comparison. There was also no disabled-state transition — the gray vs. black swap was instant and jarring.
- **Fix:** Replaced inline styles with `className="rw-btn rw-btn-pri rw-btn-full"` and rely on the existing `.rw-btn:disabled` CSS for the disabled state (opacity 0.4, no-transform). The button text logic remains: `{size ? "Add to bag — €" + p.price : "Select a size"}`. Bonus: the `.rw-btn-pri` hover swaps background to `var(--accent)`, so it also responds to the Tweaks panel accent color — previously the button was locked to `#16130F` even when the user picked blue/green/pink.
- Status: [DONE] — Replaced inline styles with `className="rw-btn rw-btn-pri rw-btn-full"` in `src/components/ProductPage.jsx`. Button now inherits hover animation (`translateY(-2px) scale(1.025)`, accent color swap, box-shadow) and disabled-state transition from CSS.

## [DONE] Product detail page "Back to shop" button has no hover effect & uses hardcoded colors
- Status: [DONE] — Replaced inline styles with `className="rw-btn rw-btn-ghost"` in `src/components/ProductPage.jsx`. Button now inherits the same hover animation (inset border → `var(--ink)`, `translateY(-2px) scale(1.025)`) as all other ghost buttons in the app.
- **Where:** `src/components/ProductPage.jsx` lines 19–25 — `<button onClick={onBack} style={{...}}>`
- **Fix:** Dropped the inline styles and used the existing `.rw-btn-ghost` class, which already provides the polished hover effect (border highlight + lift + scale).
- Status: [DONE] — Added `customProducts` prop to `WishlistDrawer`; merged with `REWIND_PRODUCTS` via `useMemo`. Also passed `customProducts` from `App.jsx`.
- **Where:** `src/components/Shop.jsx` line 551 — `WishlistDrawer` component
- **What:** The drawer resolves wishlisted product IDs by searching only `REWIND_PRODUCTS`:
  ```js
  const wishlistItems = items.map((id) => REWIND_PRODUCTS.find((p) => p.id === id)).filter(Boolean);
  ```
  Custom products added via the admin panel (stored in `customProducts` state in `App.jsx`) are never included in this search. If a user wishlists a custom product, the wishlist state in `App.jsx` correctly stores the ID, but the drawer returns `undefined` from `.find()` and filters it out — so the item silently never appears in the wishlist drawer UI.
- **Impact:** Custom products (added through the admin panel and synced from Supabase) are invisible in the wishlist drawer. Users can save them but can't see or interact with them.
- **Fix:** Pass `customProducts` (or the merged `[...REWIND_PRODUCTS, ...customProducts]` array) as a prop to `WishlistDrawer` and use the merged array in the `.find()` call. `App.jsx` already has `customProducts` in scope at line 349 where the drawer is rendered.

## [🟢] Product detail page category badge hardcodes accent color
- Status: [DONE] — Fixed in ProductPage.jsx, InfoModal.jsx, and 6 admin-panel locations (App.jsx). All now use `var(--accent)`.
- **Where:** `src/components/ProductPage.jsx` line 104 — `<span style={{ ... color: '#FF4D14' ... }}>`
- **What:** The category label (e.g. "JERSEYS") on the product detail page uses a hardcoded `#FF4D14` instead of `var(--accent)`. Every other accent-colored element in the app (hero kicker, sale tags, stock lines, toast icons, nav active state, footer links on hover, wishlist heart overlay, etc.) uses `var(--accent)` from the CSS custom property set on `:root` and controlled by the Tweaks panel.
- **Impact:** When a user changes the accent color via the Tweaks panel (orange → blue/green/pink), the entire site updates except for the product detail page category badge, which stays locked at orange. This breaks visual cohesion and makes the tweak feel broken.
- **Fix:** Change line 105 from `color: '#FF4D14'` to `color: 'var(--accent)'`.
- **Bonus:** Also fixed same issue in InfoModal.jsx (email link) and 6 admin-panel spots (email button, copy-for-supplier button, saved-tab prices, Gemini button, upload label, add-product preview badge).

## [🔴] Hardcoded admin promo code `74421` exposed in client JS bundle
- Status: [DONE] — Moved to server-side + Railway env var

## [🟠] Return policy mismatch
- Status: [DONE]

## [🟢] Duplicate cart persistence effect
- Status: [DONE]

## [🟢] Cart count badge on header icon
- Status: [DONE]

## [🟢] Make footer payment icons clickable
- Status: [DONE]

## [🟢] /api/run-tests endpoint crashes with Playwright test.describe error
- Status: [DONE] — Extracted runTests() into standalone tests/run-tests.js that doesn't import @playwright/test's test.describe. The admin panel's "🧪 Run tests" button now imports safely from tests/button-test.js → tests/run-tests.js without triggering the Playwright test runner context error.
