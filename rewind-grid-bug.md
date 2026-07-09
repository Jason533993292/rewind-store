# REWIND Store — Product Grid Bug Fix Prompt for Claude

**Site:** rewind-stores.com (React/Vite + Express + Supabase)
**Version:** V11.9.0 live on Railway
**Repo:** Jason533993292/rewind-store (public, main branch)

## The Bug

Product grid shows **1 item per row** instead of 3 columns. Some users see only 1 column across all sections, while others see 3 columns in some sections but 1 in others.

## What's been tried

### Current CSS (live in production)

```css
.rw-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px 18px; min-width: 0; overflow: hidden; }

@media (max-width: 1080px) { .rw-grid { grid-template-columns: repeat(3,1fr); } }
@media (max-width: 600px) { .rw-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 540px) { .rw-grid { grid-template-columns: repeat(3,1fr); gap: 8px; } }
@media (max-width: 380px) { .rw-grid { grid-template-columns: repeat(2,1fr); gap: 6px; } }
```

### Product card CSS
```css
.rw-card { display: flex; flex-direction: column; animation: cardIn .45s ease both;
  content-visibility: auto; contain-intrinsic-size: 340px; min-width: 0; max-width: 100%; overflow: hidden; }
```

### Card image
```css
.rw-img { display: block; width: 100%; height: 100%; object-fit: cover; }
.rw-photo { position: relative; width: 100%; overflow: hidden; border-radius: var(--r-sm); background: var(--ink); }
```

### JSX rendering (Shop.jsx)
```jsx
<div className="rw-grid" style={{ marginBottom: '8px' }}>
  {s.items.map((p) => (
    <ProductCard key={p.id || p.product_id} p={p} ... />
  ))}
</div>
```

### Verified from DevTools on live site
- The `.rw-grid` computed styles show `grid-template-columns: 136.328px 136.336px 136.336px` (3 columns)
- A `.rw-card` inside the grid has computed width of **445px** — way wider than its 136px column
- CSS is correctly applied: `repeat(3, minmax(0, 1fr))` is in the styles panel

## What to investigate

1. **Why is the card 445px wide when the grid column is 136px?** The card has `max-width: 100%` and `overflow: hidden`, but something inside the card is forcing it to 445px.
2. **Check the `.rw-img` element** — does the image inside the card have a natural width that overrides `max-width: 100%`?
3. **Check `content-visibility: auto`** — this CSS property can cause sizing bugs in grid layouts because the browser skips layout for off-screen elements.
4. **Check the card's children** — look at `.rw-photo-bg`, `.rw-photo-word`, `.rw-card-body`, and any quick-view/like button overlays for fixed widths or absolute positioning that could force the card wider.
5. **Check for `display: flex; flex-direction: column`** — a flex child inside a grid item might not shrink below its content size despite `min-width: 0`.
6. **Check the `rw-add` button** — it has `display: grid; width: 36px;` — could this affect layout?
7. **Verify the live CSS hash** — check `curl -sk https://rewind-stores.com/assets/index-CVjBVrsP.css | grep -o "rw-grid{[^}]*}"` to confirm the fix is deployed.

## Files to read
- `src/App.css` (full file — check for any overriding `.rw-grid` rules)
- `src/components/Shop.jsx` (ProductCard component + grid rendering)
- `src/components/Shell.jsx` (Photo component, image rendering)

## Fix approach
Find whatever is making the card 445px wide despite `max-width: 100%` on the card. The fix could be:
- Adding `max-width: 100%` to the image or photo container
- Adding `overflow: hidden` to a deeper container
- Adding `width: 100%` to `.rw-card` explicitly
- Removing `content-visibility: auto` from the card (test)
- Using `min-width: 0` on the grid tracks explicitly
