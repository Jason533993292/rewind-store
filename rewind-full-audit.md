# REWIND Store — Grid Bug Fix File for Gemini

**Site:** rewind-stores.com (React/Vite + Express + Supabase)
**Version:** V9.1.0
**Bug:** Product grid shows 2 per row instead of 3 per row on desktop

---

## Files Involved

### File 1: src/App.css (Grid + Card CSS)

```css
/* ── shop section headers ── */
.rw-section-head {
  font-size: 14px; font-weight: 600; color: var(--muted);
  margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 1px;
}

/* ── THE GRID ── */
.rw-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px 18px; }
@media (max-width: 768px) { .rw-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px) { .rw-grid { grid-template-columns: 1fr; gap: 8px; } }

/* ── shop container ── */
.rw-shop { max-width: var(--maxw); margin: 0 auto; padding: 54px 24px 70px; }
:root { --maxw: 1240px; }

/* ── cards ── */
.rw-card { display: flex; flex-direction: column; animation: cardIn .45s ease both;
  content-visibility: auto; contain-intrinsic-size: 340px; }
.rw-card-media { position: relative; overflow: hidden; }
.rw-card-media .rw-photo { transition: transform .3s ease, box-shadow .3s ease; }
.rw-card:hover .rw-photo { transform: translateY(-4px); box-shadow: var(--shadow); }
.rw-card-tags { position: absolute; top: 10px; left: 10px; display: flex; flex-direction: column; gap: 6px; z-index: 3; pointer-events: none; }
.rw-tag { font-family: var(--font-head); font-weight: 700; font-size: 12px; padding: 5px 9px; border-radius: 7px; letter-spacing: .01em; }
.rw-tag-sale { background: var(--accent); color: #fff; }
.rw-tag-low { background: var(--ink); color: #fff; }

/* Quick view button (shows on card hover) */
.rw-card-quick {
  position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 3;
  background: color-mix(in oklab, var(--surface) 92%, transparent); backdrop-filter: blur(6px);
  font-family: var(--font-head); font-weight: 700; font-size: 13.5px; padding: 11px; border-radius: 9px;
  opacity: 0; transform: translateY(8px); transition: opacity .2s, transform .2s, background .15s, color .15s;
}
.rw-card:hover .rw-card-quick { opacity: 1; transform: none; }
.rw-card-quick:hover { background: var(--ink); color: #fff; }

/* Favorite/wishlist heart button */
.rw-card-fav {
  position: absolute; top: 10px; right: 10px; z-index: 3; width: 34px; height: 34px;
  border-radius: 999px; display: grid; place-items: center;
  background: color-mix(in oklab, var(--surface) 88%, transparent); backdrop-filter: blur(6px);
  color: var(--ink); opacity: 0; transform: scale(.85);
  transition: opacity .2s, transform .2s, color .15s;
}
.rw-card-fav.is-wishlisted { opacity: 1; transform: none; }
.rw-card-fav:hover { color: var(--accent); }
.rw-card:hover .rw-card-fav { opacity: 1; transform: none; }
```

### File 2: src/components/Shop.jsx (ProductCard + ProductGrid)

Key section for the grid rendering:

```jsx
// ProductCard — renders inside the grid
export function ProductCard({ p, showCompare, showStock, onQuick, onAdd, wishlisted, onWishlist, onSelect, onCart }) {
  return (
    <article className="rw-card" style={{ opacity: p.stock === 0 ? 0.5 : 1 }}>
      <div className="rw-card-media" style={{ cursor: 'pointer' }} onClick={() => onSelect ? onSelect(p) : onQuick(p)}>
        <Photo id={p.id} hue={p.hue} label={p.name.toUpperCase()} h={340} img={p.img} />
        <div className="rw-card-tags">
          {showCompare && discountPct(p) > 0 && <span className="rw-tag rw-tag-sale">-{discountPct(p)}%</span>}
          {showStock && p.stock === 0 && <span className="rw-tag rw-tag-low">Sold out</span>}
          {showStock && p.stock > 0 && p.stock <= 5 && <span className="rw-tag rw-tag-low">Only {p.stock} left</span>}
        </div>
        <button className="rw-card-quick" onClick={(e) => { e.stopPropagation(); onQuick(p); }}>Quick view</button>
        <button className={"rw-card-fav" + (wishlisted ? ' is-wishlisted' : '')}
          aria-label={wishlisted ? 'Remove' : 'Save'}
          style={{ color: wishlisted ? 'var(--accent)' : undefined }}
          onClick={(e) => { e.stopPropagation(); onWishlist(p); }}>
          <Icon name={wishlisted ? 'heartFilled' : 'heart'} size={17} />
        </button>
      </div>
      <div className="rw-card-body">
        <div className="rw-card-head">
          <h3 onClick={() => onSelect ? onSelect(p) : onQuick(p)}>{p.name}</h3>
          <span className="rw-card-cat">{p.cat}</span>
        </div>
        <div className="rw-card-foot">
          <div className="rw-price">
            <span className="rw-price-now">{money(p.price)}</span>
            {showCompare && p.was && <span className="rw-price-was">{money(p.was)}</span>}
          </div>
          {/* Add to cart button — handles sold out, added state, normal */}
        </div>
        <div className="rw-card-ship">
          <Icon name="retrn" size={13} /> Free returns <span className="rw-price-was">€8</span>
        </div>
      </div>
    </article>
  );
}

// ProductGrid — renders products grouped by brand → category sections
export function ProductGrid({ products, wishlist, onWishlist, sort, query, onClearSearch, activeCat, activeBrand, onCart, ...rest }) {
  // Products are grouped by brand then category:
  // e.g. NIKE → JERSEYS (3 items) → section with grid
  //      RALPH LAUREN → POLOS (2 items) → section with grid
  
  const sections = [];
  // ... grouping logic ...
  
  return (
    <div>
      {sections.map((s, i) => (
        <div key={i}>
          {s.label && <h3 className="rw-section-head">{s.label}</h3>}
          <div className="rw-grid" style={{ marginBottom: '8px' }}>
            {s.items.map((p) => (
              <ProductCard key={p.id || p.product_id} p={p} ... />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## PROMPT FOR GEMINI

REWIND vintage streetwear store at rewind-stores.com. React/Vite frontend.

**The grid shows 2 items per row on desktop instead of 3.** The CSS uses:
- `.rw-grid` with `repeat(3, 1fr)` 
- Breakpoints at 768px (→2 columns) and 540px (→1 column)
- Container max-width: 1240px

The grid is rendered in `ProductGrid` component in `Shop.jsx`. Products are grouped by brand→category sections. Each section has its OWN `.rw-grid` div. The `rw-card` elements are flex column cards with `content-visibility: auto`.

The quick view button (`.rw-card-quick`) and wishlist heart (`.rw-card-fav`) use `opacity: 0` → `1` on `.rw-card:hover` — these work correctly on working versions.

**What I need you to fix:**
1. Make the grid show exactly 3 columns on desktop (≥769px), 2 on tablet, 1 on mobile
2. Ensure quick view buttons and wishlist hearts still appear on hover
3. Don't break the grouped brand→category sections

The full source is above. Give me exact CSS and/or JSX changes with code snippets.
