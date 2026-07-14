// ── GET /api/orders/locations ──
// Returns aggregated customer locations by city for the world map.
// Cache-first: reads from city_coords table.
// Falls back to live geocode for any uncached city and writes result.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

export function buildLocationsRouter({ SUPABASE_URL, SERVICE_KEY }) {
  const router = Router();

  const locationsLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true });
  router.use(locationsLimiter);

  // Parse address like "Street 123, 1000, Brussels, Belgium" or "1000 Brussels, Belgium"
  // Returns { city, country } or null
  function parseAddress(address) {
    if (!address) return null;
    const parts = address.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const last = parts[parts.length - 1];
    const knownCountries = ['belgium','netherlands','france','germany','luxembourg','spain','italy','portugal','austria','switzerland','uk','united kingdom','usa','united states','canada'];
    if (knownCountries.includes(last.toLowerCase())) {
      let city = parts[parts.length - 2];
      const pm = city.match(/^(\d{4,5})\s+(.+)/);
      if (pm) city = pm[2];
      return { city: city.replace(/^\d{4,5}\s*/, '').trim(), country: last };
    }
    // Last segment is a city name (no country) — default to Belgium
    let city = last;
    const pm = city.match(/^(\d{4,5})\s+(.+)/);
    if (pm) city = pm[2];
    return { city: city.replace(/^\d{4,5}\s*/, '').trim(), country: 'Belgium' };
  }

  router.get('/locations', async (req, res) => {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }
    try {
      // 1. Get all non-cancelled orders
      const ordersRes = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?select=address&status=in.(pending,ordered,shipped)`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const ordersData = await ordersRes.json();
      const orders = Array.isArray(ordersData) ? ordersData : [];

      // 2. Aggregate by city/country
      const rawCounts = new Map();
      for (const o of orders) {
        const parsed = parseAddress(o.address);
        if (parsed) {
          const key = `${parsed.city}|${parsed.country}`;
          rawCounts.set(key, (rawCounts.get(key) || 0) + 1);
        }
      }

      if (rawCounts.size === 0) return res.json({ locations: [] });

      // 3. Fetch cached coordinates
      const cached = new Map();

      const coordsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/city_coords?select=city,country,lat,lng`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const coordsData = await coordsRes.json();
      const coords = Array.isArray(coordsData) ? coordsData : [];

      for (const c of coords) {
        cached.set(`${c.city}|${c.country}`, { lat: c.lat, lng: c.lng });
      }

      // 4. Build response — only cached cities with 2+ orders (privacy threshold)
      const locations = [];
      for (const [key, count] of rawCounts) {
        const coord = cached.get(key);
        if (coord && count >= 2) {
          const [city, country] = key.split('|');
          locations.push({ city, country, count, lat: coord.lat, lng: coord.lng });
        }
      }

      locations.sort((a, b) => b.count - a.count);
      res.json({ locations });
    } catch (e) {
      console.error('Locations error:', e.message);
      res.json({ locations: [] });
    }
  });

  return router;
}
