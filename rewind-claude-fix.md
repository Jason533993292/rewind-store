# Fix REWIND Store — Product Grid + Admin Panel Issues for Claude

**Site:** rewind-stores.com (React/Vite + Express + Supabase)
**Version:** V11.10.0 live on Railway
**Repo:** Jason533993292/rewind-store (public, main branch)
**Viewport:** 920px wide, 100% zoom

## Issue 1: Products Don't Show Side by Side (1 Column)

Products appear in 1 column regardless of viewport width. DevTools confirmed:
- Grid container computed `grid-template-columns` shows 3 columns at 136px each ✅
- A `.rw-card` computed width is **445px** (exactly = 136*3 + 18*2 = 3 columns + 2 gaps) ❌
- Card should be 136px but spans all 3 columns

### What's been tried (all failed):
- `minmax(0, 1fr)` on grid columns
- `display: flex` with fixed `calc()` widths
- `repeat(auto-fill, minmax(200px, 1fr))` (current live)
- `min-width: 0` on grid and cards
- `max-width: 100%` on cards
- `overflow: hidden` everywhere
- Removed `content-visibility: auto`
- No `grid-column: span` rules found anywhere

### Current grid CSS (live)
```css
.rw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 22px 18px; width: 100%; }
.rw-grid > * { min-width: 0; }
```

### Current card CSS (live)
```css
.rw-card { animation: cardIn .45s ease both; min-width: 0; overflow: hidden; }
.rw-img { display: block; width: 100%; max-width: 100%; height: 100%; object-fit: cover; }
```

### JSX rendering (Shop.jsx lines 146-199)
```jsx
// When sorting
if (isSorting) {
  return (<div><div className="rw-grid">{sorted.map(p => <ProductCard .../>)}</div></div>);
}
// Grouped view (brand → category)
return (
  <div>
    {sections.map((s, i) => (
      <div key={i}>
        {s.label && <h3 className="rw-section-head">{s.label}</h3>}
        <div className="rw-grid" style={{ marginBottom: '8px' }}>
          {s.items.map(p => <ProductCard .../>)}
        </div>
      </div>
    ))}
  </div>
);
```

### ProductCard (Shop.jsx line 45)
```jsx
<article className="rw-card" style={{ opacity: soldOut ? 0.5 : 1 }}>
  <div className="rw-card-media">
    <Photo id={p.id} hue={p.hue} label={p.name.toUpperCase()} h={340} img={p.img} />
    ...tags, quick view, wishlist button...
  </div>
  <div className="rw-card-body">name, price, add button</div>
</article>
```

### Photo component (Shell.jsx line 31)
```jsx
export function Photo({ id, hue, label, h = 320, img }) {
  // If no image, renders color-block placeholder:
  return <div className="rw-photo" style={{ height: h }}>
    <div className="rw-photo-bg"><span className="rw-photo-word">{label}</span></div>
  </div>;
  // With image:
  return <div className="rw-photo" style={{ height: h, overflow: 'hidden', position: 'relative' }}>
    <img className="rw-img" />
  </div>;
}
```

## Issue 2: Admin Product Form — Preview Image Not Working

### What works
- File input at line 2065: `onChange` sets both `form.file` and `form.files`
- Product save now works (removed `material` field that didn't exist in table)

### What doesn't work
- Product form at line 1775 (ProductForm component)
- Preview image at line 2085-2090
- previewUrl (line 1790): `React.useMemo(() => form.file ? URL.createObjectURL(form.file) : null, [form.file])`
- The preview renders: `{previewUrl ? <img src={previewUrl} /> : <span>Upload a photo</span>}` — this should work but image never shows

### Check
- Is `React.useMemo` getting stale closure?
- Is `form.file` being set correctly? (line 2069 sets both file and files)
- Does the blob URL work with the img tag?

## Issue 3: Multi-Image Upload

File input at line 2066 has `multiple` attribute. Upload logic at lines 1829-1834 handles `form.files` array. But only first image is saved to `product.img`; others go to `${productId}-${i}` which may not be referenced anywhere.

## Files to read
- `src/App.css` — full file, check for any `.rw-grid` or `.rw-card` overrides
- `src/components/Shop.jsx` — ProductCard, ProductGrid, Photo usage
- `src/components/Shell.jsx` — Photo component
- `src/components/AdminPanel.jsx` — ProductForm, preview image, file upload
- `api/server.js` — admin product add/update endpoints

## What I need
1. **Root cause** of the 1-column grid (files + lines)
2. **Exact fix** (before/after code)
3. **Root cause** of the preview image not showing
4. **Exact fix** for preview + multi-image support
