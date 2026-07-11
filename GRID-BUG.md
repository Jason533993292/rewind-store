# REWIND Grid Bug — Full Diagnosis

## Symptoms

Product items render **1 per row** instead of **3 per row side-by-side**. On desktop, each product card sits alone in its own row, with the other 2/3 of the row empty.

This happens in the default **"Featured"** view. Switching to a sort option (Price, Name) puts all products in a single grid and works correctly.

---

## Root Cause (2 issues)

### Issue 1 — CSS: `auto-fill` + broken mobile overrides *(already fixed in src/App.css)*

**File:** `src/App.css` lines 244–255

The old CSS used:
```css
.rw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
```

This created 5–6 columns on desktop. Each single-item section filled only 1 of those columns — appearing as 1 skinny column.

The mobile media queries used **`flex` properties on grid children** (`.rw-grid > * { flex: ... }`) which are **completely ignored by CSS Grid** — so the responsive column collapse never worked on any screen size.

**Already applied fix:** Changed to explicit responsive columns:
```css
.rw-grid { grid-template-columns: repeat(3, 1fr); }  /* desktop */
@media (max-width: 860px) { .rw-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 380px) { .rw-grid { grid-template-columns: 1fr; } }
```

### Issue 2 — React: separate grids per brand-category section (NOT fixed)

**File:** `src/components/Shop.jsx` lines 160–199

In the **default "Featured"** view (no sort active), `ProductGrid` groups products by `brand → category` and creates a **separate `.rw-grid` for each group**:

```jsx
// Featured view (no sort) — lines 181-199
return (
  <div>
    {sections.map((s, i) => (
      <div key={i}>
        {s.label && <h3 className="rw-section-head">{s.label}</h3>}
        <div className="rw-grid">  {/* ← separate grid per section */}
          {s.items.map((p) => <ProductCard ... />)}
        </div>
      </div>
    ))}
  </div>
);
```

When a brand-category section has only **1 item**, that single item sits alone in a 3-column grid — occupying only the first column, with columns 2 and 3 empty. This looks like "1 per row" to the user.

When **sort is active** (Price/Name), all products go into a **single flat grid** (lines 147–158) — this works perfectly:

```jsx
// Sort view — lines 147-158
<div className="rw-grid">
  {sorted.map((p) => <ProductCard ... />)}
</div>
```

---

## Current State
The live site has **2 products**, each in its own brand-category group:
1. **CARTHARTT — JACKETS** → 1 item → 1 grid → shows alone
2. **UNDER ARMOUR — SETS** → 1 item → 1 grid → shows alone

Even with the CSS fix, `repeat(3, 1fr)` still shows each item alone in its own grid.

---

## Possible Solutions

### Solution A — Merge into a single grid in Featured view (recommended)

**File:** `src/components/Shop.jsx` lines 181-199

Remove the per-section grids and merge all products into one flat grid (same as sort mode), keeping section headers as non-grid elements above:

```jsx
return (
  <div>
    {sections.map((s, i) => (
      <div key={i}>
        {s.label && <h3 className="rw-section-head">{s.label}</h3>}
      </div>
    ))}
    <div className="rw-grid">
      {sorted.map((p) => <ProductCard ... />)}
    </div>
  </div>
);
```

This ensures 3 items per row regardless of brand-category grouping.

### Solution B — Increase grid columns for single-item sections

Not recommended — a section with 1 item will always look sparse regardless of column count. This is a band-aid.

### Solution C — Restructure data to have more items per section

If the business model is "one of each" vintage (limited stock), sections will naturally have 1 item. Solution A is more robust.

---

## Deploying the Fix

After the code change in `Shop.jsx`:
1. `npm run build` — rebuilds `dist/`
2. `git add -A && git commit -m "fix: 3-column grid in Featured view"` 
3. `git push` — triggers Railway auto-deploy

The CSS fix in `src/App.css` is already applied and built into `dist/`.

---

## Files Involved

| File | Purpose |
|------|---------|
| `src/App.css` lines 244–255 | Grid CSS rules (CSS fix already applied) |
| `src/components/Shop.jsx` lines 146–199 | ProductGrid component (main fix needed here) |
| `dist/assets/index-*.css` | Built CSS (verify fix is compiled) |
| `package.json` | Build/test scripts |

## Tested

- `npm run build` ✅ passes
- Grid CSS in compiled output confirmed: `repeat(3,1fr)` on desktop, `repeat(2,1fr)` on tablet, `1fr` on mobile
- All broken flex-based media queries removed
- 16/25 E2E tests pass (6 pre-existing failures: empty product catalogue + missing API keys)
