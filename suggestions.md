# REWIND — Suggestions & Improvements

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
