// REWIND — product catalogue (vintage / retro resale)
export const REWIND_PRODUCTS = [
  // Jerseys
  { id: "brasil02",   name: "Brasil '02 Jersey",      cat: "Jerseys",    brand: "Nike",   price: 42, was: 60,  stock: 3,  hue: 128, img: "", note: "Retro replica, ventilated mesh back.",               sizes: ["S","M","L","XL"] },
  { id: "azzurri",    name: "Azzurri Retro Jersey",   cat: "Jerseys",    brand: "Kappa",  price: 45, was: 58,  stock: 6,  hue: 232, img: "", note: "Classic blue replica, embroidered crest.",           sizes: ["S","M","L","XL"] },
  { id: "meshtop",    name: "Mesh Training Top",      cat: "Jerseys",    brand: "Adidas", price: 34, was: 45,  stock: 12, hue: 38,  img: "", note: "Breathable mesh, raglan sleeve.",                    sizes: ["S","M","L","XL"] },

  // Polos
  { id: "terrypolo",  name: "Terry Polo Set",         cat: "Polos",      brand: "Ralph Lauren", price: 52, was: 70,  stock: 4,  hue: 188, img: "", note: "Towelling polo + matching short.",                   sizes: ["XS","S","M","L"] },
  { id: "cottonpolo", name: "Cotton Pique Polo",      cat: "Polos",      brand: "Lacoste",      price: 38, was: 52,  stock: 7,  hue: 350, img: "", note: "Classic pique polo, embroidered logo.",               sizes: ["S","M","L","XL"] },
  { id: "stripedpolo",name: "Striped Rugby Polo",     cat: "Polos",      brand: "Ralph Lauren", price: 44, was: 58,  stock: 5,  hue: 10,  img: "", note: "Cotton rugby polo with contrast stripes.",            sizes: ["S","M","L","XL"] },

  // Jumpers
  { id: "vintageknit",name: "Vintage Knit Jumper",    cat: "Jumpers",    brand: "Ralph Lauren", price: 55, was: 75,  stock: 4,  hue: 30,  img: "", note: "Wool blend knit, raglan sleeves.",                    sizes: ["S","M","L","XL"] },
  { id: "crewneck",   name: "Retro Crewneck",          cat: "Jumpers",   brand: "Nike",         price: 48, was: 62,  stock: 8,  hue: 200, img: "", note: "Heavy cotton fleece crewneck.",                      sizes: ["S","M","L","XL"] },
  { id: "cardigan",   name: "Argyle Cardigan",          cat: "Jumpers",  brand: "Ralph Lauren", price: 58, was: 78,  stock: 3,  hue: 280, img: "", note: "Vintage argyle pattern, button front.",               sizes: ["S","M","L","XL"] },

  // Tracksuits
  { id: "velour94",   name: "Velour Tracksuit '94",   cat: "Tracksuits", brand: "Adidas", price: 68, was: 95,  stock: 4,  hue: 14,  img: "", note: "Plush velour two-piece. Boxy fit, elasticated cuffs.", sizes: ["S","M","L","XL"] },
  { id: "shellcobalt",name: "Shell Suit — Cobalt",    cat: "Tracksuits", brand: "Nike",   price: 54, was: 72,  stock: 9,  hue: 248, img: "", note: "Crinkle nylon shell suit. Colour-block panels.",     sizes: ["S","M","L","XL"] },
  { id: "halfzip",    name: "Windbreaker Half-Zip",   cat: "Tracksuits", brand: "Kappa",  price: 58, was: 78,  stock: 11, hue: 158, img: "", note: "Lightweight half-zip windbreaker. Packable.",        sizes: ["S","M","L","XL"] },

  // Shoes
  { id: "courtlo",    name: "Court Classic Lo",       cat: "Shoes",       brand: "Nike",        price: 72, was: 99,  stock: 5,  hue: 20,  img: "", note: "Low-top leather court sneaker.",                     sizes: ["40","41","42","43","44"] },
  { id: "suede88",    name: "Suede Runner '88",       cat: "Shoes",       brand: "New Balance", price: 85, was: 110, stock: 8,  hue: 96,  img: "", note: "Suede + nylon retro runner.",                        sizes: ["40","41","42","43","44"] },
  { id: "hitop",      name: "Hi-Top Retro",           cat: "Shoes",       brand: "Air Force",   price: 78, was: 105, stock: 6,  hue: 300, img: "", note: "Canvas hi-top, vulcanised sole.",                    sizes: ["40","41","42","43","44"] },
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
