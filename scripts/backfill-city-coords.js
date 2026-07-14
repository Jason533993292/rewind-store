// ── One-off backfill script: read distinct city/country pairs from orders
//     and populate city_coords cache via Nominatim geocoding.
//
// Run: node scripts/backfill-city-coords.js
//
// Expects env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Address format in orders table (single text field):
//   "Street 123, 1000, Brussels, Belgium"  or  "1000 Brussels, Belgium"
// We parse city from the second-to-last segment, extracting it from
// "1000 Brussels" → "Brussels" when a postal code is present.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function sfetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${opts.method || 'GET'} ${path}: ${res.status} ${text.slice(0, 200)}`);
  }
  return res;
}

async function main() {
  console.log('Fetching orders...');
  const ordersRes = await sfetch('/orders?select=address&status=in.(pending,ordered,shipped)');
  const orders = await ordersRes.json();
  console.log(`  ${orders.length} orders found`);

  // Parse address and extract unique city/country pairs
  // "Street 123, 1000, Brussels, Belgium" → city="Brussels", country="Belgium"
  function parseAddress(address) {
    if (!address) return null;
    const parts = address.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    // If the last segment looks like a city (not a country), treat it as city
    // and default country to 'Belgium' (addresses often omit the country)
    const knownCountries = ['belgium','netherlands','france','germany','luxembourg','spain','italy','portugal','austria','switzerland','uk','united kingdom','usa','united states','canada'];
    if (knownCountries.includes(last.toLowerCase())) {
      // Last segment IS a country, second-to-last is the city
      let city = secondLast;
      const postalMatch = city.match(/^(\d{4,5})\s+(.+)/);
      if (postalMatch) city = postalMatch[2];
      return { city: city.replace(/^\d{4,5}\s*/, '').trim(), country: last };
    }
    // Last segment is a city name (no country in address) — default to Belgium
    let city = last;
    const postalMatch = city.match(/^(\d{4,5})\s+(.+)/);
    if (postalMatch) city = postalMatch[2];
    return { city: city.replace(/^\d{4,5}\s*/, '').trim(), country: 'Belgium' };
  }

  const pairs = new Map();
  for (const o of orders) {
    const parsed = parseAddress(o.address);
    if (parsed) {
      const key = `${parsed.city}|${parsed.country}`;
      if (!pairs.has(key)) pairs.set(key, parsed);
    }
  }
  console.log(`  ${pairs.size} unique city/country pairs to geocode\n`);

  // Clean existing city_coords to avoid stale data
  console.log('  🧹 Clearing old city_coords cache\n');
  await fetch(`${SUPABASE_URL}/rest/v1/city_coords?id=gte.0`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  }).catch(() => {});

  const USER_AGENT = 'REWIND (orders@rewind-stores.com)';
  let done = 0;
  for (const [, { city, country }] of pairs) {
    const q = encodeURIComponent(`${city}, ${country}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      await sfetch('/city_coords', {
        method: 'POST',
        body: JSON.stringify({ city, country, lat, lng }),
      });
      console.log(`  ✅ ${city}, ${country} → ${lat}, ${lng}`);
    } else {
      console.warn(`  ❌ Could not geocode ${city}, ${country}`);
    }
    done++;
    console.log(`  [${done}/${pairs.size}]\n`);
    if (done < pairs.size) await new Promise(r => setTimeout(r, 1100));
  }

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
