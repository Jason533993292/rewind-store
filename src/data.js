// REWIND — product catalogue (vintage / retro resale)
export const REWIND_PRODUCTS = [
  // ── Jerseys ──
  { id: "jersey-brasil",    name: "Brasil '02 Jersey",       cat: "Jerseys", brand: "Nike",   price: 42, was: null, stock: 3, sizes: ["S","M","L","XL"],  hue: 25,  note: "Brazil World Cup replica — iconic green & yellow." },
  { id: "jersey-azzurri",   name: "Azzurri Retro Jersey",    cat: "Jerseys", brand: "Nike",   price: 45, was: 65,   stock: 2, sizes: ["M","L","XL"],       hue: 210, note: "Italy away kit reissue. Lightweight mesh." },
  { id: "jersey-ajax",      name: "Ajax Training Top",       cat: "Jerseys", brand: "Adidas", price: 34, was: null, stock: 4, sizes: ["S","M","L","XL"],  hue: 200, note: "Vintage training jersey — bold chest stripe." },

  // ── Polos ──
  { id: "polo-terry",       name: "Terry Polo",              cat: "Polos",   brand: "Ralph Lauren", price: 52, was: 75,   stock: 3, sizes: ["M","L","XL"],       hue: 30,  note: "French terry cloth — soft and breathable." },
  { id: "polo-pique",       name: "Cotton Pique Polo",       cat: "Polos",   brand: "Ralph Lauren", price: 38, was: null, stock: 5, sizes: ["S","M","L","XL"],  hue: 355, note: "Classic pique weave, embroidered pony." },
  { id: "polo-rugby",       name: "Striped Rugby Polo",      cat: "Polos",   brand: "Ralph Lauren", price: 44, was: 60,   stock: 2, sizes: ["L","XL"],            hue: 10,  note: "Bold horizontal stripes — thick cotton." },

  // ── Jumpers ──
  { id: "jumper-knit",      name: "Vintage Knit Jumper",     cat: "Jumpers", brand: "Stone Island", price: 55, was: null, stock: 3, sizes: ["M","L","XL"],       hue: 280, note: "Heavyweight wool blend, compass badge." },
  { id: "jumper-crew",      name: "Retro Crewneck",          cat: "Jumpers", brand: "Stone Island", price: 48, was: 70,   stock: 4, sizes: ["S","M","L","XL"],  hue: 350, note: "Fleece-lined crewneck, ribbed cuffs." },
  { id: "jumper-cardigan",  name: "Argyle Cardigan",         cat: "Jumpers", brand: "Ralph Lauren", price: 58, was: 85,   stock: 2, sizes: ["M","L"],            hue: 160, note: "Preppy argyle pattern, mother-of-pearl buttons." },

  // ── Zip-up Jumpers ──
  { id: "zip-windbreaker",  name: "Windbreaker Half-Zip",    cat: "Zip-up Jumpers", brand: "Nike Tech", price: 58, was: null, stock: 3, sizes: ["S","M","L","XL"], hue: 200, note: "Nylon half-zip, water-resistant shell." },
  { id: "zip-fleece",       name: "Tech Fleece Zip-Up",      cat: "Zip-up Jumpers", brand: "Nike Tech", price: 65, was: 90,   stock: 2, sizes: ["M","L","XL"],    hue: 10,  note: "Slim-fit tech fleece, zip pockets." },
  { id: "zip-bomber",       name: "Satin Bomber Jacket",     cat: "Zip-up Jumpers", brand: "Ralph Lauren", price: 72, was: null, stock: 3, sizes: ["M","L","XL"],    hue: 40,  note: "Satin finish, ribbed collar & cuffs." },

  // ── Tracksuits ──
  { id: "track-velour",     name: "Velour Tracksuit '94",    cat: "Tracksuits", brand: "Adidas", price: 68, was: null, stock: 2, sizes: ["S","M","L","XL"],  hue: 300, note: "Full velour set — retro trefoil logo." },
  { id: "track-shell",      name: "Shell Suit — Cobalt",     cat: "Tracksuits", brand: "Adidas", price: 54, was: 80,   stock: 4, sizes: ["S","M","L","XL"],  hue: 220, note: "Shiny shell fabric, signature 3-stripe." },
  { id: "track-classic",    name: "Classic Track Jacket",    cat: "Tracksuits", brand: "Nike",   price: 48, was: null, stock: 3, sizes: ["M","L","XL"],       hue: 180, note: "Warm-up jacket, contrast panel sleeves." },

  // ── Pants ──
  { id: "pants-cargo",      name: "Cargo Sweatpants",        cat: "Pants",   brand: "Ralph Lauren", price: 42, was: 60,   stock: 4, sizes: ["S","M","L","XL"],  hue: 30,  note: "Heavy cotton cargo pants, elastic cuffs." },
  { id: "pants-tech",       name: "Tech Woven Pants",        cat: "Pants",   brand: "Nike Tech", price: 55, was: null, stock: 3, sizes: ["M","L","XL"],       hue: 160, note: "Lightweight woven — zip ankles." },
  { id: "pants-chino",      name: "Retro Chino Pants",       cat: "Pants",   brand: "Lacoste", price: 38, was: null, stock: 5, sizes: ["S","M","L","XL"],   hue: 80,  note: "Straight-leg chino, embroidered croc." },

  // ── Sets ──
  { id: "set-track",        name: "Track Set — Navy",        cat: "Sets",    brand: "Nike Tech", price: 78, was: null, stock: 2, sizes: ["S","M","L","XL"],  hue: 210, note: "Matching zip-up + pants. Full Nike Tech set." },
  { id: "set-jogger",       name: "Jogger Set — Grey",       cat: "Sets",    brand: "Nike Tech", price: 68, was: 95,   stock: 3, sizes: ["M","L","XL"],       hue: 330, note: "Fleece jogger set, tonal branding." },
  { id: "set-polo",        name: "Polo Set — Ivory",        cat: "Sets",    brand: "Ralph Lauren", price: 85, was: null, stock: 2, sizes: ["M","L"],            hue: 45,  note: "Short-sleeve polo + matching shorts." },
  { id: "gtg",             name: "GTG",                     cat: "Sets",    brand: "Nike",   price: 55, was: 75,   stock: 3, sizes: ["S","M","L","XL"],  hue: 150, note: "Just added — check it out." },

  // ── Shoes ──
  { id: "shoe-court",       name: "Court Classic Lo",        cat: "Shoes",   brand: "Asics", price: 72, was: null, stock: 4, sizes: ["39","40","41","42","43","44"], hue: 25,  note: "Minimal court sneaker — gum sole." },
  { id: "shoe-suede",       name: "Suede Runner '88",        cat: "Shoes",   brand: "Asics", price: 85, was: 110,  stock: 3, sizes: ["40","41","42","43"],       hue: 200, note: "Archived runner reissue — pigskin suede." },
  { id: "shoe-hitop",       name: "Hi-Top Retro",            cat: "Shoes",   brand: "New Balance", price: 78, was: null, stock: 2, sizes: ["40","41","42","43","44"], hue: 350, note: "Padded hi-top, vintage N logo." },
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
  anonKey: '',  // e.g. 'eyJhbG...NiIs...'
};