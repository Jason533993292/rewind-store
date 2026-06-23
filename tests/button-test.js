const BASE = process.env.TEST_URL || 'http://localhost:3000';
const results = [];

async function check(path, name, checkFn) {
  try {
    const start = Date.now();
    const url = BASE + path;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const ms = Date.now() - start;
    const text = await res.text();
    const passed = checkFn({ data: text, status: res.status, ms });
    results.push({ name, status: passed ? '✅' : '❌', detail: passed ? `${res.status} (${ms}ms)` : `${res.status} — ${passed}` });
  } catch (e) {
    results.push({ name, status: '❌', detail: e.message.slice(0, 120) });
  }
}

async function runTests() {
  // Page loads
  await check('/', 'Homepage', ({ status, ms }) => status === 200 && ms < 10000);
  await check('/#admin', 'Admin panel', ({ status }) => status === 200);

  // API endpoints availability
  await check('/api/send-order', 'Order API', ({ status }) => status !== 404);
  await check('/api/send-campaign', 'Campaign API', ({ status }) => status !== 404);

  // Content checks
  await check('/', 'Has title', ({ data }) => data.includes('REWIND'));
  await check('/', 'Has products', ({ data }) => data.includes('product') || data.includes('rw-grid'));

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
