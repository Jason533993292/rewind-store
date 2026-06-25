# REWIND — Suggestions & Improvements

## [🟢] Wishlist drawer can't display custom products (only searches REWIND_PRODUCTS)
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
