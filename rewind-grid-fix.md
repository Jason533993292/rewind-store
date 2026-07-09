# REWIND Store — Product Grid Fix for Claude

**Issue:** Product grid shows 1 item per row / 1 column instead of 3 columns.
**Live URL:** https://rewind-stores.com
**CSS file:** src/App.css

## Current grid CSS (live in production)

```css
/* Base grid — 3 columns */
.rw-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px 18px; }

/* Medium screens */
@media (max-width: 1080px) { .rw-grid { grid-template-columns: repeat(3,1fr); } }

/* Small screens */
@media (max-width: 600px) { .rw-grid { grid-template-columns: repeat(2,1fr); } }

/* Mobile portrait */
@media (max-width: 540px) { .rw-grid { grid-template-columns: repeat(3,1fr); gap: 8px; } }

/* Very small */
@media (max-width: 380px) { .rw-grid { grid-template-columns: repeat(2,1fr); gap: 6px; } }
```

## Product card CSS

```css
.rw-card { display: flex; flex-direction: column; animation: cardIn .45s ease both;
  content-visibility: auto; contain-intrinsic-size: 340px; min-width: 0; }
```

## JSX (Shop.jsx)

The grid is rendered as:
```jsx
<div className="rw-grid">
  {products.map(p => <ProductCard ... />)}
</div>
```

## What to check

1. Is there any inline style on the `.rw-grid` div that overrides `grid-template-columns`?
2. Is there a parent element with `display: flex` or `flex-direction: column` that's forcing single column?
3. Is there a CSS specificity issue where another rule overrides `.rw-grid`?
4. Is the Shop.jsx rendering the grid correctly? Check if there's a single-column fallback in the sorting/filtering logic.
5. Check for `!important` overrides or any liquid-glass dock CSS that might be affecting layout.

Please inspect the live site at rewind-stores.com, read the full Shop.jsx and App.css, and give me:
1. The exact root cause
2. The exact fix (file path + line number + code change)
