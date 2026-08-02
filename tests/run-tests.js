// run-tests.js — HTTP smoke tests for the admin panel's "Run tests" button.
// No browser needed: pure fetch checks against the live site, so this runs on
// Railway (no Chromium system deps). The full browser suite stays local in
// tests/comprehensive.spec.js (CI + manual runs).
//
// Result shape matches what AdminPanel.jsx renders:
//   { results: [{ name, status: '✅'|'❌'|'⚠️', detail }], passed, failed, total, skipped, hint }

const BASE = process.env.TEST_URL || 'https://rewind-stores.com';
const TIMEOUT_MS = 10000;

export async function runTests() {
  const results = [];
  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      const detail = await fn();
      results.push({ name, status: '✅', detail: detail || 'Passed' });
      passed++;
    } catch (e) {
      results.push({ name, status: '❌', detail: (e && e.message ? e.message : String(e)).slice(0, 120) });
      failed++;
    }
  }

  async function get(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    } finally {
      clearTimeout(t);
    }
  }

  const expectStatus = (r, code, label) => {
    if (r.status !== code) throw new Error(`${label}: expected ${code}, got ${r.status}`);
  };

  await check('Homepage loads (200)', async () => {
    const r = await get(`${BASE}/`);
    expectStatus(r, 200, 'Homepage');
    const html = await r.text();
    if (!html.includes('REWIND')) throw new Error('Homepage HTML missing REWIND branding');
    return '200, HTML served';
  });

  await check('JS bundle serves (200)', async () => {
    const r = await get(`${BASE}/`);
    const html = await r.text();
    const m = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
    if (!m) throw new Error('No index bundle referenced in HTML');
    const br = await get(`${BASE}/${m[0]}`);
    expectStatus(br, 200, 'Bundle');
    return `200 (${m[0]})`;
  });

  await check('SPA route serves (200)', async () => {
    const r = await get(`${BASE}/privacy`);
    expectStatus(r, 200, 'SPA route');
    return '200';
  });

  await check('/api/health responds', async () => {
    const r = await get(`${BASE}/api/health`);
    expectStatus(r, 200, 'health');
    return '200';
  });

  await check('/api/orders/locations responds', async () => {
    const r = await get(`${BASE}/api/orders/locations`);
    expectStatus(r, 200, 'locations');
    const d = await r.json().catch(() => null);
    if (d === null || !Array.isArray(d.locations)) throw new Error('locations: expected { locations: [...] }');
    return `200 (${d.locations.length} locations)`;
  });

  await check('Admin API requires auth (401)', async () => {
    const r = await get(`${BASE}/api/admin/analytics?period=7d`);
    expectStatus(r, 401, 'admin analytics');
    return '401 as expected';
  });

  await check('Visitor map endpoint requires auth (401)', async () => {
    const r = await get(`${BASE}/api/admin/visitor-locations`);
    expectStatus(r, 401, 'visitor-locations');
    return '401 as expected';
  });

  await check('Track endpoint responds', async () => {
    const r = await fetch(`${BASE}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: '/run-tests-probe' }), // no visitor_id → silently ignored, no row written
    });
    expectStatus(r, 200, 'track');
    return '200 (no row written)';
  });

  // Compact diagnostic code for failed runs: paste it to your assistant and
  // they can decode exactly which checks failed and why, without re-running.
  // Format: RW1.<base64url(JSON)> — self-contained, paste-safe, no newlines.
  const failedRows = results.filter(r => r.status === '❌');
  let diag = '';
  if (failedRows.length > 0) {
    diag = 'RW1.' + Buffer.from(JSON.stringify({
      v: 1,
      t: new Date().toISOString(),
      base: BASE,
      f: failedRows.map(r => r.name),
      d: failedRows.map(r => r.detail),
    })).toString('base64url');
  }

  return { results, passed, failed, total: results.length, skipped: false, hint: '', diag };
}
