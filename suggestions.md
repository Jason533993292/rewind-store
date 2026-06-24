# REWIND — Suggestions & Improvements

_Last updated: June 24, 2026_

> Suggestions are automatically added by the suggestion bot.
> 🟢 Green = low priority · 🟠 Orange = medium · 🔴 Red = urgent (auto-fixed)

---

## [🟠] Return policy mismatch — "14d free returns" vs actual "2 days"
- Priority: Orange (medium)
- What: InfoModal said 2 days but Hero says 14 days
- File: src/components/InfoModal.jsx
- Fix: Changed "2 days" to "14 days"
- Status: [DONE] — Fixed by Hermes

## [🟢] Duplicate cart persistence effect
- Priority: Green (low)
- What: Two identical useEffects saving cart to localStorage
- File: src/App.jsx
- Fix: Removed duplicate useEffect
- Status: [DONE] — Fixed by Hermes

## [🟢] Add cart count badge to header icon
- Priority: Green (low)
- What: The cart icon doesn't show how many items are in it. A small badge number would make it clearer.
- File: src/components/Shell.jsx
- Fix: Add a counter badge overlay on the cart icon.
- Status: Pending

## [🟢] Make footer payment icons clickable
- Priority: Green (low)
- What: The "Pay with" section lists payment methods but they aren't clickable.
- File: src/components/Shell.jsx
- Fix: Add links to each payment provider's info page.
- Status: Pending

---

## [🟢] Photo upload + AI description generation
- Priority: Green (already done)
- What: User requested a button to add photos so the description generator can analyze them.
- Status: [DONE] — Already implemented. The "Add new product" form has a "📁 Choose files" input (supports image/*), a storefront preview that shows the selected photo, a "📋 Copy to Gemini" button for manual AI use, and an "✨ Generate from photo" button that sends the image to the backend API (HuggingFace → OpenAI → Gemini → fallback cascade). The image is also uploaded to Supabase storage (`product-images` bucket) on submit.

_New suggestions appear at the top._
