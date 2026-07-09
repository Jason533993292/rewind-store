# Fix REWIND Store Product Grid — Prompt for Claude

**Site:** rewind-stores.com (React/Vite + Express + Supabase)
**Current version:** V11.9.0 (just pushed, live on Railway)
**Repo:** Jason533993292/rewind-store (public, main branch)
**Viewport tested:** 920px wide, 100% zoom

## The Bug

Product grid shows **1 item per row** instead of 3 columns. The grid container is 460px wide with 3 columns at 141px each, but each product card is 445px wide (nearly the full container width) instead of shrinking to 141px.

## What's been tried (all failed)

### Current CSS (flexbox approach — latest push)
```css
.rw-grid { display: flex; flex-wrap: wrap; gap: 22px 18px; min-width: 0; }
.rw-grid > * { width: calc(33.333% - 12px); min-width: 0; }
@media (max-width: 600px) { .rw-grid > * { width: calc(50% - 9px); } }
@media (max-width: 380px) { .rw-grid > * { width: 100%; } }
```

### What else is in the CSS
```css
.rw-card { display: flex; flex-direction: column; animation: cardIn .45s ease both;
  min-width: 0; max-width: 100%; overflow: hidden; }
.rw-img { display: block; width: 100%; max-width: 100%; height: 100%; object-fit: cover; }
.rw-photo { position: relative; width: 100%; overflow: hidden; border-radius: var(--r-sm); background: var(--ink); }
```

### Previously tried (CSS Grid approach)
```css
.rw-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px 18px; min-width: 0; overflow: hidden; }
.rw-card { display: flex; flex-direction: column; min-width: 0; width: 100%; max-width: 100%; overflow: hidden; }
```

With the Grid approach, DevTools confirmed:
- Grid container: 460px wide
- Grid columns: 141.328px, 141.336px, 141.336px (3 columns ✅)
- Card computed width: **445px** (should be ~141px ❌)
- No `grid-column` override found anywhere in CSS or inline styles
- All `grid-column` searches returned empty

## JSX rendering (Shop.jsx)
```jsx
// Sorting view
if (isSorting) {
  return (
    <div>
      <div className="rw-grid">
        {sorted.map((p) => (<ProductCard key={p.id || p.product_id} ... />))}
      </div>
    </div>
  );
}

// Grouped view (brand → category sections) — this is the default view
const sections = [];
Object.entries(grouped).forEach(([brand, cats]) => {
  Object.entries(cats).forEach(([cat, items]) => {
    const isCurrentCat = activeCat && activeCat !== 'All' && cat === activeCat;
    const label = isCurrentCat ? brand : [brand, cat].filter(Boolean).join(' — ');
    sections.push({ label, items });
  });
});

return (
  <div>
    {sections.map((s, i) => (
      <div key={i}>
        {s.label && (<h3 className="rw-section-head">{s.label}</h3>)}
        <div className="rw-grid" style={{ marginBottom: '8px' }}>
          {s.items.map((p) => (<ProductCard ... />))}
        </div>
      </div>
    ))}
  </div>
);
```

## ProductCard component (Shop.jsx)

The ProductCard renders as a div with class `rw-card`. It contains:
- `.rw-card-media` (photo wrapper with `.rw-photo` > `<img>`)
- `.rw-card-body` (name, category, price, add button)

## What to investigate

1. **Check if `.rw-card` has a fixed width or min-width set** via inline styles or a CSS rule not in App.css (check the `<ProductCard>` component in Shop.jsx for any inline `style={{ width: ... }}`)
2. **Check the `Photo` component** (src/components/Shell.jsx) — it renders inside the card and might have absolute positioning that creates overflow
3. **Check for parent containers** — the grid is inside `.rw-shop-content` which has `min-width: 0`. Any parent without `min-width: 0` could prevent shrinking.
4. **Check for any `max-width` or `width` CSS rules** on `.rw-shop-content` or `.rw-shop` that might constrict the grid container.
5. **Look at the computed `width` of `.rw-shop-layout` and `.rw-shop-content`** — if either is narrower than expected, the grid columns would be narrower.
6. **Check if `content-visibility: auto` or `contain-intrinsic-size`** is still present anywhere in the rendered CSS (browser cache issue).
7. **Try adding `flex-shrink: 1` and `flex-basis: 0`** to `.rw-grid > *` for better flex control.

## Files to read
- `src/App.css` (full file)
- `src/components/Shop.jsx` (ProductCard + grid rendering)
- `src/components/Shell.jsx` (Photo component)

## What I need
1. The exact root cause (which file + line + CSS rule)
2. The exact fix (before/after code)
3. Verify by running locally and checking computed widths in DevTools
