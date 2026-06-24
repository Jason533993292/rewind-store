# REWIND — Suggestions & Improvements

_Last updated: June 24, 2026_

> Suggestions are automatically added by the suggestion bot every 2 hours.
> 🟢 Green = low priority · 🟠 Orange = medium · 🔴 Red = urgent (auto-fixed)

---

## [🟠] Return policy mismatch — "14d free returns" vs actual "2 days"
- **Priority:** Orange (medium)
- **What:** The Hero section prominently advertises "14d free returns", and every product card shows "Free returns" with a €8 strikethrough. But the actual Returns policy in the InfoModal says customers have only **2 days** from delivery to return an item. This discrepancy could mislead customers and create refund disputes.
- **File:** `src/components/InfoModal.jsx` (line 16: `'You have 2 days from delivery...'`)
- **Fix:** Change the returns policy to match the marketing — update "2 days" to "14 days" in InfoModal.jsx, or update the Hero/card copy to reflect the real policy. If 14 days is the intended policy, simply change line 16 from `'You have 2 days from delivery...'` to `'You have 14 days from delivery...'`.
- **Status:** Pending

## [🟢] Duplicate cart persistence effect
- **Priority:** Green (low)
- **What:** App.jsx has two identical `useEffect` hooks that save the cart to localStorage (lines 31-33 and line 84). Both have `[cart]` as a dependency, so on every cart change, `localStorage.setItem('rw_cart', ...)` is called twice. This is harmless functionally but wastes writes to localStorage.
- **File:** `src/App.jsx`
- **Fix:** Remove the duplicate `useEffect` on line 84. The first effect (lines 31-33) already handles cart persistence — it was probably duplicated by accident during development.
- **Status:** Pending

## [🟢] Add cart count badge to header icon
- **Priority:** Green (low)
- **What:** The cart icon doesn't show how many items are in it. A small badge number would make it clearer.
- **File:** `src/components/Shell.jsx`
- **Fix:** Add a counter badge overlay on the cart icon.
- **Status:** Pending

## [🟢] Make footer payment icons clickable
- **Priority:** Green (low)
- **What:** The "Pay with" section lists payment methods but they aren't clickable.
- **File:** `src/components/Shell.jsx`
- **Fix:** Add links to each payment provider's info page.
- **Status:** Pending

---

_New suggestions appear at the top._
