# REWIND — Suggestions & Improvements

## [DONE] Product detail page quantity stepper buttons use hardcoded colors — last interactive elements breaking design-token consistency
- **Where:** `src/components/ProductPage.jsx` lines 168–176 — the `+` and `−` quantity stepper buttons
- **What:** The quantity stepper buttons use hardcoded hex colors instead of CSS design tokens. Border: `'1px solid #ddd'`, background: `'#fff'`, hover background: `'#f0f0f0'`. These are cold, generic grays that clash with REWIND's warm neutral palette (`--line-2`: #D9D0C0, `--surface`: #FFFFFF, `--line`: #E8E0D2). Every other interactive element on the product page now uses design tokens: size buttons (`.rw-size` → `var(--line-2)` border), add-to-bag (`.rw-btn-pri` → `var(--ink)`/`var(--accent)`), back button (`.rw-btn-ghost` → `var(--line-2)`). The quantity steppers are the **lone holdout**.
- **Compare:** The cart drawer's own quantity steppers (`.rw-qty button` in App.css line 397) use `var(--line)` for the hover state — a warm, subtle highlight. The product page steppers, built with bare inline styles, use stark `#f0f0f0` / `#ddd` that feels like a different app.
- **Why it matters:** Users engage with these buttons immediately before hitting "Add to bag" — the most important CTA on the page. The hardcoded grays sit jarringly beside the warm, cohesive surrounding elements (size pills with their `var(--line-2)` borders, the accent-colored low-stock badge). It's a small visual papercut that makes the purchase flow feel slightly unpolished at a critical moment.
- **Fix:** Replace 6 hardcoded values across both buttons:
  - `border: '1px solid #ddd'` → `border: '1px solid var(--line-2)'`
  - `background: '#fff'` → `background: 'var(--surface)'`
  - `onMouseOver` `'#f0f0f0'` → `'var(--line)'`
  - `onMouseOut` `'#fff'` → `'var(--surface)'`
  The existing `transition: 'background 0.15s'` inline style already handles smooth hover animation — no new CSS needed.

## [DONE] Wishlist drawer "Add to cart" silently picks the first size — user has no way to choose
- **Where:** `src/components/Shop.jsx` lines 584–588 (WishlistDrawer add button) + `src/App.jsx` line 360 (onAddToCart prop)
- **What:** The wishlist drawer renders an "add to cart" ⊕ button for each saved item (line 584–588), which calls `onAddToCart(p)` with no size argument. In `App.jsx` line 360, the handler calls `addToCart(p)` — still no size. The `addToCart` function (lines 113–122) defaults to `p.sizes[0]` when no size is passed. **Result: adding a product from the wishlist drawer always silently adds the first listed size.** For clothing that's almost always "S", for shoes it's "40". A user who wears size L or shoe size 44 gets the wrong size without any warning or chance to change it.
- **Compare:** This is the exact same class of bug as the QuickView "Add to bag" issue (previously fixed — see line 113 of this file). The QuickView used to silently pick `p.sizes[0]`; it was fixed by adding `disabled={!size}` and requiring explicit size selection. The ProductPage also correctly requires size selection before adding. The cart drawer's own items already have the correct size because it was chosen earlier. The wishlist drawer is the **only remaining add-to-cart path that silently picks a size.**
- **Why it matters:** The wishlist exists for two reasons: saving items to buy later, and comparing items before purchase. Both end with the user adding items to their cart. When the size is silently defaulted to the wrong one, the user discovers the error only after opening the cart drawer — and must remove the item, navigate to the product page, pick the right size, and re-add. This erodes trust in the wishlist feature and creates unnecessary friction. For shoe products where sizes are numeric (40–44), the wrong default is especially likely.
- **Fix:** Two options:
  1. **Simplest:** Change the wishlist ⊕ button to navigate to the product detail page instead of adding directly: `onClick={() => onSelect(p)}` (needs `onSelect` prop passed through). This is the lowest-risk fix and matches the "click card → see product page → pick size → add" flow users already expect.
  2. **Better UX:** Show a small size picker inline (like a compact dropdown or pill row) that appears when the ⊕ button is clicked, requiring the user to pick a size before the item is added. This keeps the wishlist as a quick-add surface but prevents silent wrong-size additions.
  Either way, the `onAddToCart(p)` call in App.jsx line 360 must be updated to pass a size argument: `onAddToCart={(p, size) => { addToCart(p, size); setDrawer(true); }}`.

## [DONE] Product page thumbnail strip shows a fake second thumbnail — users think there's another product photo
- **Where:** `src/components/ProductPage.jsx` lines 81–95 — the thumbnail strip beneath the main product image
- **What:** The thumbnail strip always renders exactly two thumbnails via `{[0, 1].map(i => (...))}` (line 84), but the product detail page only ever has one image. At line 13, `const images = [p.img || ''];` creates an array with exactly one element. The second thumbnail at index 1 is always a bare colored block (`hsl(${p.hue + 60},40%,80%)` or `#e8e4dd`) with no image inside — it's a misleading placeholder that looks like it should be a second product photo (alternate angle, detail shot, etc.). The comment on line 81 even reads `{/* Thumbnail strip — only show if multiple photos */}`, but the code ignores that condition and always renders two thumbnails regardless.
- **Why it matters:** A user on the product detail page sees two thumbnails below the main image — one real photo and one solid-color block. The color block is styled identically to the real thumbnail (same size, border, cursor: pointer), so it looks like a broken or missing image. Users click it expecting to see another product view and get nothing. This erodes trust and makes the product page feel buggy or incomplete. For products without real photos (all current products have `img: ""` in data.js), the thumbnails don't even render — but for any product that does have a photo, the fake second thumbnail appears.
- **Fix:** Change line 84 from `{[0, 1].map(i => (` to `{images.filter(Boolean).map((img, i) => (` and line 92 from `{i === 0 && p.img && <img src={p.img}` to `{<img src={img}`. This way only real images get thumbnails. If there's only one image, only one thumbnail renders. If/when more images are added to the `images` array (line 13), the thumbnail strip auto-scales. Also remove the hardcoded `#f5f0eb` / `hsl(...)` background fallback (lines 88) in favor of just using the actual image — if the array is filtered to real images only, there's no need for placeholder backgrounds.

## [DONE] Wishlisted product-card hearts are invisible by default — users can't scan the grid to see what they've already saved
- **Where:** `src/components/Shop.jsx` line 55 adds `is-wishlisted` class to wishlisted cards, but `src/App.css` has no corresponding CSS rule (lines 278–286). The `.rw-card-fav` button defaults to `opacity: 0` and only becomes visible on `.rw-card:hover`.
- **What:** When a user hearts (wishlists) several products while browsing, there is zero visual indication of which products are saved. The heart button is `opacity: 0` at rest — it only appears on card hover. A user returning to the grid after adding 5 items to their wishlist sees exactly the same grid as before: no filled hearts, no accent-colored indicators, no badges. To re-find their saved items they must hover over every single card.
- **Compare:** Every major e-commerce site that supports wishlisting shows a persistent visual marker on saved items:
  - ASOS: filled pink heart always visible on saved cards
  - Zalando: filled heart icon visible at all times on wishlisted items
  - Farfetch: "Saved" heart always visible
  - REWIND's own **product detail page** (ProductPage.jsx line 110–123) renders the wishlist heart *always visible* with `color: var(--accent)` when wishlisted
  The grid cards are the ONLY wishlist surface where the saved state is hidden.
- **Why it matters:** The heart/wishlist feature exists for two use cases: (1) saving items to buy later, and (2) comparing items before purchase. Both require the user to *see* their saved items when they return. An invisible saved state defeats both use cases. The user must either (a) open the wishlist drawer and cross-reference names/prices with the grid, or (b) hover over every single card hunting for filled hearts. This is especially punishing on mobile where there is no hover state at all — wishlisted hearts are literally *never visible* on touch devices.
- **Fix:** Add one CSS rule to `src/App.css` after the existing `.rw-card-fav:hover` rule (line 286):
  ```css
  .rw-card-fav.is-wishlisted { opacity: 1; transform: none; }
  ```
  That's it — 4 characters of CSS. The `color: var(--accent)` is already applied via inline style in Shop.jsx line 57 (`style={{ color: wishlisted ? 'var(--accent)' : undefined }}`), so the heart will render in the accent color and be always visible. On touch devices this is a dramatic improvement: wishlisted items are instantly identifiable in the grid.

## [DONE] Search input has no clear/reset button — users must manually backspace to dismiss a query
- **Where:** `src/components/Shell.jsx` lines 113–116 — the `.rw-search` div in the `Header` component: `<div className="rw-search"><Icon name="search" size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" /></div>`
- **What:** When a user types a search query to filter products, the only way to return to the full unfiltered view is to manually backspace through the entire query string. There is no ✕ clear button inside or next to the search field. Once the user has typed even a short term like "nike", they must delete all 4 characters one-by-one to see all products again.
- **Compare:** Modern search UI patterns universally include a clear button when the field is non-empty:
  - macOS Spotlight: ✕ appears in the search field when text is present
  - Apple.com / Google: ✕ clear button inside the input
  - Amazon / ASOS / Zalando: ✕ or "Clear" link in/next to search
  REWIND's search is the *only* filtering axis with no quick-reset affordance — both the category sidebar and brand filter have an "All" button that instantly resets to the full view. The search box lacks any equivalent.
- **Why it matters:** Search is a primary navigation tool, especially on mobile where the header nav is hidden. A user who searches for "jerseys", browses results, and then wants to browse "All" again must either (a) manually delete the search text character by character, or (b) click a sidebar category — but that changes the category filter, not the search. The only *true* reset is backspacing the entire query. On mobile keyboards this is particularly tedious: the user must tap into the field, long-press backspace, or tap delete 6+ times. The ✕ is a sub-10-line fix with disproportionately high UX payoff.
- **Fix:** Add a clear button that appears inside or immediately after the search field when `query` is non-empty:
  ```jsx
  <div className="rw-search">
    <Icon name="search" size={17} />
    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
    {query && (
      <button onClick={() => setQuery('')}
        aria-label="Clear search"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px', display: 'grid', placeItems: 'center',
          color: 'var(--muted)', opacity: 0.7,
        }}
        onMouseOver={e => e.target.style.opacity = '1'}
        onMouseOut={e => e.target.style.opacity = '0.7'}>
        <Icon name="close" size={14} />
      </button>
    )}
  </div>
  ```
  The `<Icon name="close">` already exists in the shared component — no new SVG needed. The `opacity: 0.7` with a hover-to-1 transition makes it subtle but discoverable, matching the muted aesthetic of the search field.

## [DONE] Promo code popup has no explicit close button — the only modal in the app without one
- **Where:** `src/App.jsx` lines 378–414 — the promo code popup rendered when `promoOpen` is true
- **What:** The promo code popup (triggered by the 💬 floating button at bottom-right) can only be dismissed by clicking the dark backdrop — there is no visible close/✕ button inside the popup itself. Every other modal, drawer, and overlay in the app has an explicit close button:
  - QuickView: `.rw-modal-x` with `<Icon name="close">` (Shop.jsx line 136)
  - CartDrawer: close button in `.rw-drawer-head` (Shop.jsx line 229)
  - WishlistDrawer: close button in `.rw-drawer-head` (Shop.jsx line 560)
  - SignupModal: `.rw-modal-x` with close icon (Shop.jsx line 505)
  - Checkout: "Back" button (Shop.jsx line 381)
  - InfoModal: `.rw-modal-x` with close icon (InfoModal.jsx line 51)
  - SizeGuide: close button (not shown but confirmed present)
  The promo popup is the lone exception. Users who don't think to click outside (or are on mobile where the backdrop is less obvious) may feel trapped or frustrated.
- **Why it matters:** Consistency in dismiss behaviour is a basic UX expectation. When every other overlay has a close button and this one doesn't, it feels like an oversight or bug. On mobile especially, tapping outside a small popup can be finicky — a clear ✕ in the corner is universally expected.
- **Fix:** Add a close button to the top-right of the popup, matching the pattern used everywhere else:
  ```jsx
  <button onClick={() => setPromoOpen(false)}
    style={{
      position: 'absolute', top: '10px', right: '10px',
      width: '28px', height: '28px', borderRadius: '50%',
      border: 'none', background: 'none', cursor: 'pointer',
      display: 'grid', placeItems: 'center',
      color: 'var(--muted)', fontSize: '16px',
    }}>✕</button>
  ```
  Or better: reuse the existing `<Icon name="close" size={16} />` from Shell for visual consistency.

## [DONE] Sidebar category buttons don't scroll to the product grid after selection — inconsistent with header nav
- **Where:** `src/App.jsx` line 291 — sidebar category buttons: `<button key={c} onClick={() => setCat(c)} ...>`
- **What:** The sidebar category filter buttons update the product state via `setCat(c)` but never scroll the viewport to the product grid. The header navigation (line 263) wraps its `setCat` in a function that also calls `scrollToGrid()`: `setCat={(c) => { setCat(c); scrollToGrid(); }}`. When a user is scrolled down (past the hero, into the product list, maybe from a prior category) and clicks a sidebar category, the products update but the page stays wherever it is — the user may not realize anything changed, especially on mobile where the grid could be entirely off-screen.
- **Compare:** Header nav → `setCat()` + `scrollToGrid()`. Footer links → `setCat()` + `scrollToGrid()` (line 346: `onSetCat={(c) => { setCat(c); scrollToGrid(); }}`). Hero CTAs → `setCat()` + `scrollToGrid()` (line 267). **Every** category-change entry point scrolls to the grid except the sidebar. The sidebar is the *only* place where changing a category leaves the user stranded.
- **Why it matters:** This is the primary browsing axis for desktop users — the sidebar is the persistent, always-visible filter panel. When it silently changes the category without moving the viewport, it feels broken. Users click "Jerseys" in the sidebar, nothing appears to happen, they click it again, then scroll down and discover the jerseys were there all along. This is a small code change with a disproportionately large UX impact.
- **Fix:** Change line 291 from `onClick={() => setCat(c)}` to `onClick={() => { setCat(c); scrollToGrid(); }}`. This brings the sidebar in line with every other category selector on the page. The `scrollToGrid` function (line 161–164) already handles the scroll offset (`el.offsetTop - 80`) to account for the sticky header — no other changes needed.

## [DONE] Product grid section headers (brand/category labels) use hardcoded #888 instead of var(--muted)
- **Where:** `src/components/Shop.jsx` line 112 — the `ProductGrid` section header: `<h3 style={{ fontSize: '14px', fontWeight: 600, color: '#888', margin: '24px 0 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>`
- **What:** When the product grid is grouped by brand and category (e.g., "Adidas — Jerseys", "Nike — Tracksuits"), the section header labels use `color: '#888'` — a neutral/cool gray. The site's design system uses `--muted` (#6E665A), a warm muted tone that matches the cream/ink/warm-neutral palette. The `#888` gray is visibly cooler and clashes with every other muted text element on the page (the "X pieces · one of each" subtitle, card category labels, footer meta, shipping text, etc., all use `var(--muted)`).
- **Why it matters:** These section headers appear whenever products are grouped — which is most of the time (e.g., browsing "All" shows brand+category groupings; browsing "Jerseys" shows brand subgroups). The off-color gray is a subtle but real visual papercut that makes the grouped grid feel slightly "off" compared to the rest of the site. It's especially noticeable when a section header sits right above cart cards whose muted elements use the proper warm `--muted`.
- **Fix:** Change line 112 from `color: '#888'` to `color: 'var(--muted)'`. One character edit — no other changes needed.

## [DONE] Hero "Browse jerseys" button is misleading — says it filters to jerseys but just scrolls to full grid
- **Where:** `src/components/Shell.jsx` lines 144–145 — both hero CTA buttons call `onShop` (which is `scrollToGrid`): `<button className="rw-btn rw-btn-pri" onClick={onShop}>Shop the drop</button>` and `<button className="rw-btn rw-btn-ghost" onClick={onShop}>Browse jerseys</button>`
- **What:** The "Browse jerseys" button promises to show the user jerseys, but it behaves identically to "Shop the drop" — both just scroll down to the full product listing with whatever category/filter is active. There's no category filtering happening. A user who clicks "Browse jerseys" expecting to see just jerseys instead sees every product. The button label creates false expectations.
- **Why it matters:** This is a trust/credibility papercut on the very first screen users see. The hero is the landing experience — when a labelled action doesn't deliver what it says, users feel misled. The fix also improves conversion: someone who clicks "Browse jerseys" has declared intent to see jerseys specifically, so showing them unfiltered results adds unnecessary friction to their purchase journey.
- **Fix:**
  1. In `src/App.jsx` line 267, change `onShop={scrollToGrid}` to accept an optional category: `onShop={(filterCat) => { if (filterCat) setCat(filterCat); scrollToGrid(); }}`
  2. In `src/components/Shell.jsx` line 133, update the `Hero` component to pass category through: the `onShop` prop signature becomes `onShop(filterCat?)`.
  3. In Shell.jsx line 145, change the "Browse jerseys" button to `onClick={() => onShop('Jerseys')}`.
  4. In Shell.jsx line 144, change "Shop the drop" to `onClick={() => onShop()}` (no category → all).

## [DONE] Footer "Pay with" links all incorrectly point to shipping info — 5 links, wrong target
- **Where:** `src/components/Shell.jsx` line 202 — the "Pay with" footer column: `<div><h4>Pay with</h4><a onClick={() => onInfo('shipping')} style={{ cursor: 'pointer' }}>PayPal</a>...<a onClick={() => onInfo('shipping')} style={{ cursor: 'pointer' }}>Klarna</a></div>`
- **What:** All 5 payment method links (PayPal, Payconiq, Apple Pay, Bancontact, Klarna) call `onInfo('shipping')`, which opens the shipping information modal. The section header says "Pay with" but every link shows shipping delivery times, costs, and tracking — not payment information. There's also no `payments` page defined in `InfoModal.jsx`'s `PAGES` constant (only `shipping`, `returns`, `tracking` exist), so there's literally no payment info page to link to.
- **Why it matters:** Users clicking "PayPal" or "Apple Pay" in the footer naturally expect to see accepted payment methods, security info, or payment FAQs. Instead they get shipping details. This is confusing and undermines trust — a user wondering "does this store take Klarna?" clicks the link and sees delivery times. Every other footer section ("Shop" and "Help") links to its namesake content. The "Pay with" section is the only one that lies about its destination.
- **Fix:**
  1. Add a `payments` entry to the `PAGES` object in `InfoModal.jsx` (alongside `shipping`, `returns`, `tracking`) with a title like "Payment Methods" and sections covering accepted methods, security, and when you're charged.
  2. Change all 5 `onInfo('shipping')` calls in Shell.jsx line 202 to `onInfo('payments')`.
  3. Pass `'payments'` as a valid page key — the `InfoModal` component already handles the lookup via `PAGES[page]`, so just adding the entry is enough.

## [DONE] QuickView "Add to bag" button has no disabled state — silently picks first size when nothing selected
- **Where:** `src/components/Shop.jsx` line 203 — QuickView modal's `<button className="rw-btn rw-btn-pri rw-btn-full" onClick={() => onAdd(p, size)}>Add to bag — {money(p.price)}</button>`
- **What:** The QuickView modal lets the user pick a size via the `.rw-size` buttons (lines 197–200), but the "Add to bag" button at line 203 is always active — it has no `disabled` attribute and no guard. Clicking it without selecting a size calls `addFromQuick(p, size)` with `size = null`, which flows into `addToCart(p, size)` at App.jsx line 113 where line 114 silently defaults to `p.sizes[0]`. The user gets the first size in the array without ever being told which size that is.
- **Compare:** The ProductPage (`src/components/ProductPage.jsx` line 181) correctly uses `disabled={!size}` and shows button text "Select a size" until a size is picked. The QuickView — which is the user's first interaction with the product after clicking "Quick view" on a card — has no such guard.
- **Why it matters:** A user browsing quickly, or on mobile where the size buttons are easy to miss, can add an item to bag without ever choosing a size. They see "Added to bag" in the toast, open the cart drawer, and discover a size they didn't intend. This creates confusion and potential returns. The inconsistency between QuickView and ProductPage also feels like a bug — why does one page care about size selection but the other doesn't?
- **Fix:**
  1. In `Shop.jsx` line 203: add `disabled={!size}` to the button attributes
  2. Change the button text to `{size ? `Add to bag — ${money(p.price)}` : 'Select a size'}` to match the ProductPage pattern
  3. The existing `.rw-btn:disabled` CSS (App.css line 58) already handles `opacity: 0.4; cursor: not-allowed; transform: none;` — no new CSS needed.

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

## [DONE] First-visit survey blocks all page interaction — users can't click anything until they dismiss it
- **Where:** `src/App.jsx` lines 431–439 + `src/App.css` class `.rw-modal-wrap`
- **What:** The first-visit "Welcome to REWIND" survey modal uses `.rw-modal-wrap` which is a full-screen overlay with `pointer-events: auto` (default). This blocks ALL clicks on the page behind it until the survey is dismissed. Users who want to browse must first answer or skip the survey. The survey also causes flaky Playwright tests — the sidebar test (`sidebar category buttons filter products`) times out because the survey overlay intercepts clicks on sidebar buttons.
- **Fix:** Replaced the survey overlay with a new CSS class `.rw-survey-overlay` that sets `pointer-events: none` on the wrapper but `pointer-events: auto` on the modal card (`.rw-survey-overlay > *`). This allows clicks to pass through the semi-transparent backdrop to the underlying page elements. Users can now browse the site, click sidebar categories, and scroll while the survey is visible, dismissing it when they're ready. The survey card itself remains fully interactive — all buttons inside it work normally.

## [DONE] Sort-by-price renders items in global order instead of grouped by brand/category

- **Where:** `src/components/Shop.jsx` — `ProductGrid` component (lines 93–132)
- **What:** When a user selects "Price: Low → High" or "Price: High → Low", the grid still grouped products by brand/category sections. Sections appeared in insertion/object order (not by price), so a cheap item from "Polos" could appear after expensive items from "Jerseys" even when sorting Low→High. The sort was **per-group only** — items within each section were price-sorted, but the global sort order was broken.
- **Why it matters:** A sort-by-price dropdown explicitly promises to reorder ALL items globally by price. When items appear in brand/category sections instead, the sort feels broken — users scrolling from top expect to see the cheapest items first, not a sub-sorted brand section that starts with an expensive category.
- **Fix:** When `sort` is `'price-asc'` or `'price-desc'`, return a single flat `<div className="rw-grid">` with all products rendered in price order. The brand/category grouping is preserved for the default "Featured" sort mode where grouping makes semantic sense (showing "what's new" by brand). This matches the UX pattern used by major e-commerce sites (ASOS, Zalando) that show flat price-sorted results when sorting by price.

## [DONE] ProductForm (admin panel) — 14 remaining hardcoded colors replaced with CSS design tokens

- **Where:** `src/App.jsx` — `ProductForm` component (lines ~1590–1780) + scattered admin panel locations
- **What:** The admin panel's product add/edit form and several other admin sections still used raw hex colors (`#fff`, `#eee`, `#888`, `#aaa`, `#16130F`, `#FAF6EF`, `#4caf50`, `#e53935`, `#f9f9f9`, `#f0ece6`, `#fff3cd`, `#cce5ff`, `#d4edda`) instead of the site's CSS design tokens (`var(--surface)`, `var(--line)`, `var(--muted)`, `var(--ink)`, `var(--bg)`, `var(--accent)`, `color-mix(...)`). This was the last admin panel section untouched by the design-token migration.
- **Fix:** Replaced 20+ hardcoded hex values across the ProductForm, EditProductPanel, order stat cards, stock bar chart, Supabase-not-connected banner, admin error message, product-stats table, promo code button, and file-picker display — all now use `var(--surface)`, `var(--line)`, `var(--bg)`, `var(--ink)`, `var(--muted)`, `var(--accent)`, and `color-mix(in oklab, ...)` where semantic colour needed tinted variants. The `#4caf50`/"View on store" button now uses `var(--accent)`, matching the rest of the site's action buttons. The `#fff3cd`/`#cce5ff`/`#d4edda` order stat cards use `color-mix(in oklab, ...)` for tinted backgrounds that look intentional rather than borrowed from Bootstrap. (V6.4.16)

## [DONE] Checkout-flow Playwright test fails on production (Stripe redirect) — no skip guard
- **Where:** `tests/comprehensive.spec.js` lines 380-421
- **What:** The `full checkout flow places order` test adds items to cart, opens checkout, clicks "Pay", and expects `.rw-confirm` to appear. On production, clicking Pay triggers a Stripe Checkout Session redirect — the page navigates away from REWIND to Stripe's domain, so `.rw-confirm` is never rendered. The test consistently fails with `element(s) not found` on `.rw-confirm`.
- **Compare:** The `admin panel loads` test had the same class of problem — it navigated to `/#admin` but the admin panel requires `rw_admin_email` in localStorage (only set up locally). It was fixed with a `const adminTest = !isAdmin ? test.skip : test;` guard that skips the test when running against the production URL.
- **Why it matters:** 2/21 tests failing makes the test suite unreliable as a CI gate. The "full checkout flow" test has failed on every production run since Stripe was integrated. A developer looking at the test dashboard sees red and has to manually check whether the failures are real regressions or environment mismatches. The skip guard makes the test suite truthful: pass/fail now means the site is actually working or broken, not "the test doesn't know it's on production."
- **Fix:** Same pattern used for the admin test — wrap in a production-skip guard. Also fixed a minor hover-state inconsistency: the admin panel's "Email opted-in only" button was missing onMouseOver/onMouseOut hover effects (no opacity 0.85 + translateY(-1px) lift). Added the same transition and hover handlers. (V6.5.47)

## [DONE] First-visit survey sends empty source to API — React stale-state bug in submit()
- **Where:** `src/App.jsx` lines 1553–1557, 1571–1576 — the `Survey` component's `submit()` function and option button click handlers
- **What:** When a user clicks a survey option (e.g., "Social media" or "Grailed"), the button's `onClick` handler calls `setSource(o)` then immediately calls `submit()`. But because React batches state updates, `source` hasn't been updated yet when `submit()` reads it — so the API receives an empty string instead of the user's actual answer.
- **Why it matters:** The survey data is supposed to tell the business where users discover REWIND (social media, Vinted, Grailed, Google, etc.). Every submission from the primary options was sending blank data, making the entire first-visit survey useless for analytics. The "Other" text field also had the same bug at the `Enter` key handler and Submit button.
- **Fix:** Changed `submit()` to accept an `answer` parameter. Option button click handlers now pass the answer directly: `submit(o)` instead of `setSource(o); submit()`. The "Other" text submit path also passes `otherText.trim()`. The old `source`-based fallback is preserved as a defensive default but is no longer the primary data path. (V6.5.50)
