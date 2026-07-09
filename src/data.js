// REWIND — product catalogue (vintage / retro resale)
export const REWIND_PRODUCTS = [
  { id: "placeholder", name: "Add your first product", cat: "Polos", brand: "", price: 0, stock: 0, hue: 200, img: "", note: "Use the admin panel to add products.", sizes: ["M"] },
];

export const REWIND_CATS = ["All", "Jerseys", "Polos", "Jumpers", "Zip-up Jumpers", "Tracksuits", "Pants", "Sets", "Shoes"];

// Brands per category
export const BRANDS = {
  Jerseys:    ["Nike", "Adidas", "Kappa", "Umbro", "Puma"],
  Polos:      ["Ralph Lauren", "Lacoste", "Moncler"],
  Jumpers:    ["Stone Island", "Ralph Lauren", "Nike"],
  "Zip-up Jumpers": ["Stone Island", "Ralph Lauren", "Nike Tech"],
  Tracksuits: ["Nike", "Adidas", "Kappa", "Fila", "Puma"],
  Pants:      ["Ralph Lauren", "Nike Tech", "Lacoste"],
  Sets:       ["Ralph Lauren", "Nike Tech"],
  Shoes:      ["Asics", "Air Force", "Nike", "New Balance"],
};


export const REWIND_PAYMENTS = [
  { id: "card",       label: "Card",          sub: "Visa · Mastercard" },
  { id: "paypal",     label: "PayPal",        sub: "Pay in your account" },
  { id: "payconiq",   label: "Payconiq",      sub: "Scan to pay (BE)" },
  { id: "applepay",   label: "Apple Pay",     sub: "One-tap on Apple" },
  { id: "bancontact", label: "Bancontact",    sub: "Belgian debit" },
  { id: "klarna",     label: "Klarna",        sub: "Pay in 3" }
];

// ── Image configuration ────────────────────────────────────
// Set IMG_BASE_URL to serve real product photos from a CDN or backend.
// Images are resolved as: <IMG_BASE_URL>/<product.id>.webp
// Set to '' to keep using colour-block placeholders.
export const IMG_BASE_URL = '';

// ── API configuration ───────────────────────────────────────
// Replace with real payment gateway endpoints when ready.
export const API = {
  // Example: processOrder endpoint
  orderUrl: '',
  // Stripe publishable key, PayPal client ID, etc.
  stripeKey: '',
  paypalClientId: '',
};

// ── Supabase (wishlist sync) ─────────────────────────────────
// Create a free project at https://supabase.com → Settings → API
// Copy the Project URL and anon public key here:
export const SUPABASE_CONFIG = {
  url: '',     // e.g. 'https://xxxxx.supabase.co'
  anonKey: '',  // e.g. 'eyJhbGciOiJIUzI1NiIs...'
};
