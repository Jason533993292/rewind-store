# REWIND — Suggestions & Improvements

## [DONE] InfoModal uses hardcoded colors and raw SVG — 6 locations break design-token consistency
- **Where:** `src/components/InfoModal.jsx` lines 42, 45, 49, 50, 54, 55
- **What:** The shipping/returns/tracking info modal (reached via footer links) has 6 spots that bypass the CSS design-token system:
  1. **Line 42 — close button:** Raw inline `<svg>` markup instead of `<Icon name="close" size={18} />`. Every other modal (QuickView, SignupModal) uses the `<Icon>` component for consistency. The raw SVG won't pick up future icon styling changes.
  2. **Line 45 — page title:** `color: '#16130F'` → should be `color: 'var(--ink)'`
  3. **Line 49 — section headings:** `color: '#16130F'` → should be `color: 'var(--ink)'`
  4. **Line 50 — body text:** `color: '#6E665A'` → should be `color: 'var(--muted)'`
  5. **Line 54 — top border separator:** `borderTop: '1px solid #eee'` → should be `'1px solid var(--line)'`. `#eee` is much lighter than the design system's `--line` (#E8E0D2) and belongs to an entirely different palette.
  6. **Line 55 — fine-print email text:** `color: '#aaa'` → should be `color: 'var(--muted)'`
- **Why it matters:** The InfoModal is a direct customer-facing page for shipping, returns, and tracking inquiries. It's one of the few text-heavy pages users read carefully. The hardcoded colors make it feel disconnected from the rest of the warm, cohesive site design. The raw SVG close button is inconsistent with every other modal (they all use `<Icon name="close" size={18} />` from the shared component). The `#eee` border and `#aaa` text are noticeably cold/grey compared to the warm neutral palette everywhere else.
- **Fix:**
  1. Import `Icon` from `./Shell` at the top: `import { Icon } from './Shell';`
  2. Replace the raw SVG on line 42 with `<Icon name="close" size={18} />`
  3. Replace the 5 hardcoded color values with their CSS variable equivalents as listed above.

## [DONE] Product page quantity stepper is completely disconnected from "Add to bag" — always adds 1 regardless of selected quantity
- **Where:** `src/components/ProductPage.jsx` line 180 + `src/App.jsx` lines 113–122, 252–253
- **What:** The product detail page has a quantity stepper (`qty` state, lines 6–7, 164–178) that lets the user set a quantity between 1 and the product's stock level. The +/- buttons work, the display updates — but the quantity value is never passed to the "Add to bag" action. Line 180 calls `onAdd(p, size)` with no quantity argument. In `App.jsx` line 253, the `onAdd` handler calls `addToCart(p, size)` — still no quantity. The `addToCart` function (lines 113–122) always hardcodes `qty: 1` when creating a new cart entry, or increments an existing entry by 1. **Result: setting quantity to 3 and clicking "Add to bag" adds exactly 1 item.**
- **Why it matters:** This is a functional bug, not a cosmetic one. The user interacts with a control, sees visual feedback (the number changes), and trusts that it affects the outcome. When they add to bag and see only 1 item in the cart drawer, the experience is confusing and feels broken. Compare: the cart drawer's own quantity steppers (`onQty`/`changeQty`) work correctly — only the product page's stepper is disconnected.
- **Fix:**
  1. In `ProductPage.jsx` line 180: change `onAdd(p, size)` → `onAdd(p, size, qty)`
  2. In `App.jsx` line 113: change `addToCart` signature to `(p, size, qty = 1)`
  3. In `addToCart` line 119: use `qty: qty` instead of `qty: 1` for new entries; for existing entries (line 118), use `qty: it.qty + qty` instead of `qty: it.qty + 1`
  4. In `App.jsx` line 253: pass qty through: `onAdd={(p, size, qty) => { addToCart(p, size, qty); setDrawer(true); }}`
  5. Optional polish: update the button text at line 184 to show quantity when > 1, e.g. `size ? \`Add ${qty > 1 ? qty + '× ' : ''}to bag — €${(p.price * qty).toFixed(2)}\` : 'Select a size'`, and update the toast at line 121 to mention quantity: `showToast(\`${qty > 1 ? qty + '× ' : ''}${p.name} added to bag\`)`

## [DONE] Product detail page has no wishlist (save/heart) button — missing at the point of highest purchase intent
- **Where:** `src/components/ProductPage.jsx` (entire component) + `src/App.jsx` line 252
- **What:** The product detail page — the full-screen dedicated product view a user reaches by clicking a card — has no wishlist/favorite button whatsoever. Every `ProductCard` in the grid renders a heart button (`.rw-card-fav`, Shop.jsx lines 55–60) that calls `onWishlist(p)`, but `ProductPage` never receives an `onWishlist` prop and never renders any save-to-wishlist control.
- **Why it matters:** The product detail page is the highest-intent browsing state — the user has clicked through to learn more, see all photos, check sizing, and consider a purchase. If they're not ready to buy (wrong size, waiting for payday, comparing options), the only way to save the item is to go back to the grid and find the card again. This is friction at exactly the wrong moment. Compare: every major e-commerce product page (ASOS, Zalando, Farfetch) places a wishlist/save button prominently — usually near the product name or add-to-bag CTA.
- **How it looks now:** Users must navigate back to the grid, locate the same card, and click the heart there. The header wishlist icon (with count badge) is visible from the product page, but it only opens the drawer — it doesn't let you *add* the current product.
- **Fix:** 
  1. Pass `onWishlist={handleWishlist}` and `wishlisted={wishlist.includes(selectedProduct?.id)}` to `<ProductPage>` in App.jsx line 252.
  2. In `ProductPage.jsx`, accept the new `onWishlist` and `wishlisted` props (destructure alongside `p, onBack, onAdd`).
  3. Render a wishlist button — ideally an outlined heart icon button near the product name/price area (e.g., next to the brand label at line 104 or as a standalone icon button to the right of the product title). Use the same `Icon name={wishlisted ? 'heartFilled' : 'heart'}` pattern from `ProductCard`, styled inline or with a CSS class. A natural spot: between the product name (line 107) and the price block (line 109), or floated right in the `.rw-product-info` column.
  4. The button should use `var(--accent)` when wishlisted (matching card behavior) and `var(--muted)` when not, with a hover transition to `var(--accent)`.

## [DONE] Product detail page uses hardcoded colors instead of CSS design tokens — 5 locations
- **Where:** `src/components/ProductPage.jsx` lines 105, 107, 110–111, 115, 170–174
- **What:** Five distinct spots on the product detail page use raw hex colors instead of the CSS custom properties defined in `:root` (App.css lines 1–14). This breaks visual consistency and means the Tweaks panel accent/look controls don't fully affect the detail page:
  1. **Line 105 — brand label:** `color: '#888'` → should be `color: 'var(--muted)'` (token = `#6E665A`)
  2. **Line 107 — product name:** `color: '#16130F'` → should be `color: 'var(--ink)'` (token = `#16130F`, same value but won't respond to future theme changes)
  3. **Lines 110–111 — price:** `color: '#16130F'` + `color: '#aaa'` → should be `'var(--ink)'` + `'var(--muted)'`
  4. **Line 115 — low-stock warning:** `background: '#fff3cd'` → This is Bootstrap's `.alert-warning` yellow. The app has *no* design token for this. Cards use `.rw-tag-low { background: var(--ink); }` for low-stock badges. Use `var(--line)` (`#E8E0D2`) or `var(--line-2)` for a subtle warning, or `color-mix(in oklab, var(--accent) 12%, transparent)` for an accent-adaptive warning background.
  5. **Lines 170–174 — details footer:** `borderTop: '1px solid #eee'` + `color: '#888'` → should be `'1px solid var(--line)'` + `'var(--muted)'`. `#eee` is much lighter than `--line` (#E8E0D2) and belongs to a completely different colour palette.
- **Why it matters:** The product detail page has already had 5 fixes applied (size buttons, add-to-bag, back button, quantity steppers, category badge). These lingering hardcoded colors make the page feel "nearly done" — the low-stock warning in particular is jarring because it uses Bootstrap yellow which doesn't exist anywhere else on the site. The details section border (`#eee`) and text (`#888`) are noticeably pale/grey compared to the warm neutral palette of the design system.
- **Fix:** Replace all 5 inline color values with their CSS variable equivalents as listed above. For the low-stock warning, consider `background: 'color-mix(in oklab, var(--accent) 10%, transparent)'` so it auto-adapts when the user changes the accent color via Tweaks.

## [DONE] Sidebar brand filter buttons have no hover feedback — inconsistent with category buttons
- **Where:** `src/App.jsx` lines 307–325 — the "All" brand button and individual brand buttons inside the `#rw-sidebar` `<aside>`: `<button onClick={() => setBrand(null)} style={{...}}>All</button>` and the `{currentBrands.map((b) => ...)}` buttons.
- **What:** The brand filter buttons use bare inline styles (`background: brand === b ? '#16130F' : 'transparent'`, etc.) with zero CSS `transition` property and no hover state at all. Mousing over them does absolutely nothing — no background highlight, no color shift, no visual feedback whatsoever.
- **Compare:** The category filter buttons directly above them in the same sidebar (lines 289–301) have `transition: 'background 0.15s'` and `onMouseOver`/`onMouseOut` handlers that highlight inactive buttons to `#ddd` on hover. The brand buttons sit right below them, visually identical in structure, but feel completely dead in comparison.
- **Why it matters:** Brand filtering is a primary navigation action — users click these to narrow down products within a category. When the buttons have no hover feedback, the interface feels unfinished and inconsistent right at a key decision point. The dead zone is especially jarring because the category buttons *just above them* animate smoothly, creating a "half-broken" impression.
- **Fix:** Add `transition: 'background 0.15s'` to each brand button's inline style, plus `onMouseOver`/`onMouseOut` handlers: `onMouseOver={e => { if (brand !== b) e.target.style.background = '#ddd'; }}` / `onMouseOut={e => { if (brand !== b) e.target.style.background = 'transparent'; }}`. For the "All" brand button, the same pattern but gate on `brand !== null`. This mirrors exactly the category-button hover behaviour already implemented directly above.

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

## [DONE] Product detail page category badge hardcodes accent color
- Status: [DONE] — Fixed in ProductPage.jsx, InfoModal.jsx, and 6 admin-panel locations (App.jsx). All now use `var(--accent)`.
- **Where:** `src/components/ProductPage.jsx` line 104 — `<span style={{ ... color: '#FF4D14' ... }}>`
- **What:** The category label (e.g. "JERSEYS") on the product detail page uses a hardcoded `#FF4D14` instead of `var(--accent)`. Every other accent-colored element in the app (hero kicker, sale tags, stock lines, toast icons, nav active state, footer links on hover, wishlist heart overlay, etc.) uses `var(--accent)` from the CSS custom property set on `:root` and controlled by the Tweaks panel.
- **Impact:** When a user changes the accent color via the Tweaks panel (orange → blue/green/pink), the entire site updates except for the product detail page category badge, which stays locked at orange. This breaks visual cohesion and makes the tweak feel broken.
- **Fix:** Change line 105 from `color: '#FF4D14'` to `color: 'var(--accent)'`.
- **Bonus:** Also fixed same issue in InfoModal.jsx (email link) and 6 admin-panel spots (email button, copy-for-supplier button, saved-tab prices, Gemini button, upload label, add-product preview badge).

## [DONE] Hardcoded admin promo code `74421` exposed in client JS bundle
- Status: [DONE] — Moved to server-side + Railway env var

## [DONE] Return policy mismatch
- Status: [DONE]

## [DONE] Duplicate cart persistence effect
- Status: [DONE]

## [DONE] Cart count badge on header icon
- Status: [DONE]

## [DONE] Make footer payment icons clickable
- Status: [DONE]

## [DONE] /api/run-tests endpoint crashes with Playwright test.describe error
- Status: [DONE] — Extracted runTests() into standalone tests/run-tests.js that doesn't import @playwright/test's test.describe. The admin panel's "🧪 Run tests" button now imports safely from tests/button-test.js → tests/run-tests.js without triggering the Playwright test runner context error.
