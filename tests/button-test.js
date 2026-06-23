const PORT = process.env.PORT || 3000;
const BASE = process.env.TEST_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${PORT}`}`;
const results = [];

async function check(path, name, checkFn, method = 'GET', body = null) {
  try {
    const start = Date.now();
    const url = BASE + path;
    const opts = { method, signal: AbortSignal.timeout(10000) };
    if (body) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = body; }
    const res = await fetch(url, opts);
    const ms = Date.now() - start;
    const text = await res.text();
    const passed = checkFn({ data: text, status: res.status, ms });
    results.push({ name, status: passed ? '✅' : '❌', detail: passed ? `${res.status} (${ms}ms)` : `${res.status}` });
  } catch (e) {
    results.push({ name, status: '❌', detail: e.message.slice(0, 100) });
  }
}

async function runTests() {
  // Page loads
  await check('/', 'Homepage', ({ status, ms }) => status === 200 && ms < 10000);
  await check('/#admin', 'Admin panel', ({ status }) => status === 200);

  // API endpoints (POST)
  await check('/api/send-order', 'Order API', ({ status }) => status === 200, 'POST', JSON.stringify({ email: 'test@t.com', items: [], total: 0, orderNum: 'T' }));
  await check('/api/send-campaign', 'Campaign API', ({ status }) => status === 200, 'POST', JSON.stringify({ emails: ['test@t.com'], subject: 't', message: 't' }));

  // Content - check HTML meta/script tags
  await check('/', 'Has script tags', ({ data }) => data.includes('src="/assets'));
  await check('/', 'Has React root', ({ data }) => data.includes('id="root"'));
  await check('/', 'Has site title', ({ data }) => data.includes('REWIND'));
  await check('/', 'Has assets', ({ data }) => data.includes('.js') && data.includes('.css'));

  // Speed
  await check('/', 'Fast (<2s)', ({ ms }) => ms < 2000);

  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  return { results, passed, failed, total: results.length };
}

if (process.argv[1]?.includes('button-test')) {
  runTests().then((r) => {
    console.log(`\n${r.passed}/${r.total} passed, ${r.failed} failed\n`);
    r.results.forEach(r => console.log(`  ${r.status} ${r.name}  ${r.detail}`));
    process.exit(r.failed > 0 ? 1 : 0);
  });
}

export { runTests };
