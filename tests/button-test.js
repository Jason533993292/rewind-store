import { chromium } from '@playwright/test';

const BASE = process.env.TEST_URL || 'https://rewind-stores.com';

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];

  async function click(page, selector, name) {
    try {
      await page.click(selector, { timeout: 5000 });
      results.push({ name, status: '✅', detail: 'clicked' });
    } catch (e) {
      results.push({ name, status: '❌', detail: e.message.slice(0, 100) });
    }
  }

  async function check(page, selector, name) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      results.push({ name, status: '✅', detail: 'visible' });
    } catch (e) {
      results.push({ name, status: '❌', detail: e.message.slice(0, 100) });
    }
  }

  // ── Page 1: Homepage ──
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  results.push({ name: 'Page load', status: '✅', detail: `${await page.title()}` });

  await check(page, '.rw-header', 'Header');
  await check(page, '.rw-hero', 'Hero section');
  await check(page, '.rw-marquee', 'Marquee');
  await check(page, '.rw-grid', 'Product grid');
  await check(page, '.rw-footer', 'Footer');

  // Nav buttons
  for (const cat of ['Polos', 'Jumpers', 'Tracksuits', 'Shoes']) {
    await click(page, `button:has-text("${cat}")`, `Nav: ${cat}`);
    await page.waitForTimeout(300);
  }

  // Brand panel (click a category first that shows brands)
  await click(page, 'button:has-text("Jerseys")', 'Nav: Jerseys');
  await page.waitForTimeout(500);
  await check(page, '.rw-brand-panel', 'Brand panel appears');
  await click(page, 'button:has-text("Brand 1")', 'Brand filter: Brand 1');

  // Product card actions
  await click(page, '.rw-card:first-child .rw-card-quick', 'Quick view (1st product)');
  await page.waitForTimeout(500);
  await check(page, '.rw-modal', 'Quick view modal');
  await click(page, '.rw-modal-x', 'Close quick view');

  // Heart / wishlist
  await click(page, '.rw-card:first-child .rw-card-fav', 'Wishlist heart (1st product)');
  await page.waitForTimeout(500);

  // Add to cart
  await click(page, '.rw-card:first-child .rw-add', 'Add to cart (1st)');
  await page.waitForTimeout(300);
  await click(page, '.rw-card:nth-child(2) .rw-add', 'Add to cart (2nd)');
  await page.waitForTimeout(300);

  // Cart drawer
  await click(page, '.rw-iconbtn[aria-label="Cart"]', 'Open cart drawer');
  await page.waitForTimeout(500);
  await check(page, '.rw-drawer.is-on', 'Cart drawer visible');
  await click(page, '.rw-drawer .rw-qty button:last-child', 'Increase qty');
  await page.waitForTimeout(200);
  await click(page, '.rw-drawer .rw-line-x', 'Remove item');
  await page.waitForTimeout(200);

  // Checkout
  await click(page, '.rw-drawer-foot .rw-btn-pri', 'Go to checkout');
  await page.waitForTimeout(500);
  await check(page, '.rw-checkout', 'Checkout page');
  await click(page, '.rw-pay:has-text("PayPal")', 'Select PayPal payment');
  await page.waitForTimeout(200);
  await click(page, '.rw-checkout-summary .rw-btn-pri', 'Pay button');

  // Confirm
  await page.waitForTimeout(2500);
  await check(page, '.rw-confirm', 'Order confirmation');
  await click(page, '.rw-confirm .rw-btn-pri', 'Continue shopping');

  // ── Admin panel ──
  await page.goto(`${BASE}/#admin`, { waitUntil: 'networkidle', timeout: 10000 });
  await check(page, 'h1:has-text("Admin")', 'Admin panel');
  await check(page, 'table', 'User table');

  await browser.close();

  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  return { results, passed, failed, total: results.length };
}

// Run if called directly
if (process.argv[1]?.includes('button-test')) {
  runTests().then((r) => {
    console.log(`\n${r.passed}/${r.total} passed, ${r.failed} failed\n`);
    r.results.forEach(r => console.log(`  ${r.status} ${r.name}: ${r.detail}`));
    process.exit(r.failed > 0 ? 1 : 0);
  });
}

export { runTests };
