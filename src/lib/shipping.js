// Single source of truth for delivery estimates.
// Change these two numbers and every surface (product page, cart drawer) updates.
export const SHIP_MIN_DAYS = 10;
export const SHIP_MAX_DAYS = 25;
export const SHIP_LABEL = '10–25 day delivery';

const FMT = { day: 'numeric', month: 'short' };

// e.g. "11 Aug – 26 Aug" (always today + min … today + max)
export function arrivalRange() {
  const min = new Date(Date.now() + SHIP_MIN_DAYS * 864e5);
  const max = new Date(Date.now() + SHIP_MAX_DAYS * 864e5);
  return `${min.toLocaleDateString('en-GB', FMT)} – ${max.toLocaleDateString('en-GB', FMT)}`;
}
