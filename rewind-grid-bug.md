# REWIND Store — Product Grid Bug Fix Prompt for Claude

**Site:** rewind-stores.com (React/Vite + Express + Supabase)
**Version:** V11.9.0 live on Railway
**Repo:** Jason533993292/rewind-store (public, main branch)
**Viewport tested:** 920px wide, 100% zoom

## The Bug

Product grid shows **1 item per row** instead of 3 columns on a 920px viewport. CSS is correctly set to 3 columns (`repeat(3, minmax(0, 1fr))`) but rendered width shows cards at 445px each while grid columns compute to 136px.

## Debugging findings

### DevTools computed values (live site)
- `.rw-grid` computed: `grid-template-columns: 136.328px 136.336px 136.336px` ✅ (3 columns correct)
- `.rw-card` computed width: **445px** ❌ (should be ~136px to fit in column)

### Current product grid CSS (live in production)
```css
.rw-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px 18px;
  min-width: 0;
  overflow: hidden;
}

@media (max-width: 1080px) { .rw-grid { grid-template-columns: repeat(3,1fr); } }
@media (max-width: 600px)  { .rw-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 540px)  { .rw-grid { grid-template-columns: repeat(3,1fr); gap: 8px; } }
@media (max-width: 380px)  { .rw-grid { grid-template-columns: repeat(2,1fr); gap: 6px; } }
```

### Current product card CSS
```css
.rw-card {
  display: flex;
  flex-direction: column;
  animation: cardIn .45s ease both;
  contain-intrinsic-size: 340px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
```

### Card image CSS
```css
.rw-img { display: block; width: 100%; height: 100%; object-fit: cover; }
.rw-photo { position: relative; width: 100%; overflow: hidden; border-radius: var(--r-sm); background: var(--ink); }
```

### JSX rendering (Shop.jsx lines 146-199)
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

// Grouped view (brand → category sections)
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

## What to fix

The `.rw-card` is 445px wide when it should shrink to ~136px (the grid column width). It has `max-width: 100%` and `overflow: hidden`, but something inside it overrides this.

### Check these:
1. **Inside Photo component** (src/components/Shell.jsx line 31-80) — the `.rw-photo` has `width: 100%` but check if an inner element (`.rw-photo-bg`, `.rw-photo-word`, or the `<img>` tag) has a fixed width.
2. **ProductCard component** (Shop.jsx) — check for any elements with fixed widths, min-widths, or absolute positioning that could force the card wider.
3. **Quick View / Like buttons** — check if these overlays have fixed positions or widths.
4. **`.rw-add` button** — has `width: 36px; display: grid` — could this force the layout?
5. **Check if removing `contain-intrinsic-size: 340px` helps** — this sets the assumed size before rendering and could interact badly with grid sizing.
6. **Try `min-width: 0` on the grid tracks** — add `grid-template-columns: repeat(3, minmax(0, min-content))` or try `1fr` without `minmax`.
7. **Check for parent containers** — is there a parent `<div>` without `min-width: 0` that prevents the grid from shrinking?

### Give me:
1. The exact root cause
2. The exact fix (file path + line number + before/after code)
