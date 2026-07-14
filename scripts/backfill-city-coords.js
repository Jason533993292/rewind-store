// ── One-off backfill script: read distinct city/country pairs from orders
//     and populate city_coords cache via Nominatim geocoding.
//
// Run: node scripts/backfill-city-coords.js
//
// Expects env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Address format in orders table (single text field):
//   "Street 123, 1000, Brussels, Belgium"
// We extract city = second-to-last segment, country = last segment.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function fetchOrders() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=address&status=in.(pending,ordered,shipped)`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase returned ${res.status}`);
  return res.json();
}

async function insertCoords(city, country, lat, lng) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/city_coords`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ city, country, lat, lng }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`  ⚠  Insert failed for ${city}, ${country}: ${text.slice(0, 100)}`);
  }
}

function parseAddress(address) {
  if (!address) return null;
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const country = parts[parts.length - 1];
  const city = parts[parts.length - 2];
  return { city, country };
}

const USER_AGENT = 'REWIND (orders@rewind-stores.com)';

async function geocode(city, country) {
  const q = encodeURIComponent(`${city}, ${country}`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function main() {
  console.log('Fetching orders...');
  const orders = Array.isArray(await fetchOrders()) ? await fetchOrders() : [];
  console.log(`  ${orders.length} orders found`);

  // Extract unique city/country pairs
  const pairs = new Map();
  for (const o of orders) {
    const parsed = parseAddress(o.address);
    if (parsed) {
      const key = `${parsed.city}|${parsed.country}`;
      if (!pairs.has(key)) pairs.set(key, parsed);
    }
  }
  console.log(`  ${pairs.size} unique city/country pairs to geocode\n`);

  let done = 0;
  for (const [, { city, country }] of pairs) {
    const coords = await geocode(city, country);
    if (coords) {
      await insertCoords(city, country, coords.lat, coords.lng);
      console.log(`  ✅ ${city}, ${country} → ${coords.lat}, ${coords.lng}`);
    } else {
      console.warn(`  ❌ Could not geocode ${city}, ${country}`);
    }
    done++;
    console.log(`  [${done}/${pairs.size}]\n`);
    // Nominatim rate limit: 1 req/sec
    if (done < pairs.size) await new Promise(r => setTimeout(r, 1100));
  }

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });

