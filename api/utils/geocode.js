// ── Geocode a city/country pair via Nominatim (OpenStreetMap) ──
// No API key required. 1 req/sec rate limit must be respected.
// Returns { lat, lng } or null.

const USER_AGENT = 'REWIND (orders@rewind-stores.com)';

export async function geocode(city, country) {
  if (!city || !country) return null;
  const q = encodeURIComponent(`${city}, ${country}`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function geocodeWithRetry(city, country, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const result = await geocode(city, country);
    if (result) return result;
    if (i < retries) await new Promise(r => setTimeout(r, 1100)); // 1.1s between retries
  }
  return null;
}
