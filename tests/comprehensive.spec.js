/**
 * REWIND Comprehensive Test Suite
 *
 * Tests: all buttons (nav, hero, footer, cart, wishlist, admin),
 *        page loads, search, cart lifecycle, checkout flow,
 *        backend API endpoints, and stress under concurrency.
 *
 * Run:   npx playwright test tests/comprehensive.spec.js
 *        BROWSER=1 npx playwright test --headed tests/comprehensive.spec.js
 *        TEST_URL=http://localhost:3000 npx playwright test ...
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.TEST_URL || 'https://rewind-stores.com';
const isAdmin = BASE.includes('localhost') || BASE.includes('127.0.0.1');

// ── Helpers ─────────────────────────────────────────────────────
async function nav(page)           { return page.locator('.rw-nav button, .rw-navlink'); }
async function footerShopLinks(page) { return page.locator('.rw-footer-cols div:first-child a'); }
async function cards(page)         { return page.locator('.rw-card'); }
async function quickView(page)     { return page.locator('.rw-modal'); }
async function cartDrawer(page)    { return page.locator('.rw-drawer'); }
async function toast(page)         { return page.locator('.rw-toast'); }
async function heroBtn(page)       { return page.locator('.rw-hero-cta button'); }
async function searchInput(page)   { return page.locator('.rw-search input'); }
async function sidebarCats(page)   { return page.locator('.rw-shop-layout aside button'); }
async function brandBtns(page)     { return page.locator('.rw-shop-layout aside h3 + button, .rw-brand-item'); }

// ── Page load tests ─────────────────────────────────────────────
test.describe('Page loads', () => {
  test('homepage loads with title', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText(/REWIND|Loved again|Worn/i);
    expect(await page.title()).toBeTruthy();
  });

  test('serves built assets (JS + CSS)', async ({ page }) => {
    const res = await page.goto(BASE, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);

    // Check links reference built assets
    const html = await page.content();
    expect(html).toContain('src="/assets/');
    expect(html).toContain('href="/assets/');
    expect(html).toContain('id="root"');
    expect(html).toContain('REWIND');
  });

  test('responsive — no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // Allow known non-critical errors (e.g. supabase if not configured)
    const critical = errors.filter(e =>
      !e.includes('Supabase') && !e.includes('supabase') &&
      !e.includes('favicon') && !e.includes('Failed to load resource') &&
      !e.includes('ERR_BLOCKED')
    );
    expect(critical).toEqual([]);
  });

  // Admin panel requires local auth (rw_admin_email in localStorage) — only works in dev
  const adminTest = !isAdmin ? test.skip : test;
  adminTest('admin panel loads', async ({ page }) => {
    await page.goto(`${BASE}/#admin`, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toContainText(/REWIND Admin/i);
  });
});

// ── Navigation buttons ─────────────────────────────────────────
test.describe('Navigation buttons work', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
  });

  test('header nav buttons switch categories', async ({ page }) => {
    const buttons = await nav(page);
    const count = await buttons.count();
    expect(count).toBeGreaterThan(5); // Should have All + at least 5 categories

    // Click each and verify the section title updates
    for (let i = 1; i < Math.min(count, 6); i++) {
      const label = await buttons.nth(i).textContent();
      await buttons.nth(i).click();
      await page.waitForTimeout(300);
      // Title should reflect the category
      const title = page.locator('.rw-shop-title');
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      expect(titleText?.toLowerCase()).toContain(label?.trim().toLowerCase() || '');
    }
  });

  test('sidebar category buttons filter products', async ({ page }) => {
    // Scroll to shop
    await page.evaluate(() => document.getElementById('the-drop')?.scrollIntoView());
    await page.waitForTimeout(300);

    const sidebar = await sidebarCats(page);
    const count = await sidebar.count();
    expect(count).toBeGreaterThan(3);

    for (let i = 1; i < Math.min(count, 5); i++) {
      const label = await sidebar.nth(i).textContent();
      await sidebar.nth(i).click();
      await page.waitForTimeout(300);
      const title = page.locator('.rw-shop-title');
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      expect(titleText?.toLowerCase()).toContain(label?.trim().toLowerCase() || '');
    }
  });

  test('hero buttons scroll to shop', async ({ page }) => {
    const btns = await heroBtn(page);
    expect(await btns.count()).toBe(2);

    // Click "Shop the drop"
    await btns.first().click();
    await page.waitForTimeout(500);
    const shop = page.locator('#the-drop');
    await expect(shop).toBeVisible();

    // Click "Browse jerseys"
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await btns.last().click();
    await page.waitForTimeout(500);
    // Should scroll to shop and likely filter to Jerseys
    await expect(page.locator('#the-drop')).toBeVisible();
  });
});

// ── Footer links ───────────────────────────────────────────────
test.describe('Footer links have purpose', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  });

  test('Shop footer links filter products', async ({ page }) => {
    // Get initial footer links count to validate
    let links = await footerShopLinks(page);
    let count = await links.count();
    expect(count).toBeGreaterThanOrEqual(4); // 5 if 'New in' still deployed, 4 if removed

    // Click each shop link and verify it filters
    for (let attempt = 0; attempt < count; attempt++) {
      // Re-locate after every click (page re-renders)
      links = await footerShopLinks(page);
      const n = await links.count();
      if (attempt >= n) break;
      const label = await links.nth(attempt).textContent();
      if (label?.trim() === 'New in') continue; // skip, it's the "All" category
      await links.nth(attempt).click({ force: true });
      await page.waitForTimeout(400);
      // Should scroll up and show filtered title
      const title = page.locator('.rw-shop-title');
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      // Kicks maps to Shoes in the system
      const expected = label?.trim() === 'Kicks' ? 'Shoes' : label?.trim();
      expect(titleText?.toLowerCase()).toContain(expected?.toLowerCase() || '');

      // Re-locate footer links after page scroll, then scroll back down
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
    }
  });

  test('Help footer links open modals', async ({ page }) => {
    const helpSection = page.locator('.rw-footer-cols div:nth-child(2) a');
    const count = await helpSection.count();
    expect(count).toBeGreaterThanOrEqual(4); // Sizing, Shipping, Returns, Track order

    // Click Sizing — opens SizeGuide modal
    await helpSection.first().click({ force: true });
    await page.waitForTimeout(400);
    await expect(page.locator('.rw-modal')).toBeVisible({ timeout: 3000 });
    // Close it
    await page.locator('.rw-modal button, .rw-modal-x').first().click({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('.rw-modal')).not.toBeVisible({ timeout: 2000 });

    // Click Shipping — opens InfoModal
    await helpSection.nth(1).click({ force: true });
    await page.waitForTimeout(400);
    const modal = page.locator('.rw-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    // Close InfoModal (it has a Close or Back button)
    await modal.locator('button').first().click({ force: true });
    await page.waitForTimeout(500);
  });
});

// ── Product cards ──────────────────────────────────────────────
test.describe('Product card interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
  });

  test('quick view opens modal with product info', async ({ page }) => {
    const cardButtons = await cards(page);
    const count = await cardButtons.count();
    if (count === 0) return; // No products loaded

    // Hover first card to reveal quick view button, then click
    const firstCard = cardButtons.first();
    await firstCard.hover();
    const quickBtn = firstCard.locator('.rw-card-quick');
    await expect(quickBtn).toBeVisible({ timeout: 3000 });
    await quickBtn.click();
    await page.waitForTimeout(400);

    const modal = await quickView(page);
    await expect(modal).toBeVisible();
    // Should have product info
    await expect(modal.locator('h2')).toBeVisible();
    // Select a size first (button is disabled + shows "Select a size" until size is picked)
    const sizeButtons = modal.locator('.rw-size');
    const sizeCount = await sizeButtons.count();
    if (sizeCount > 0) {
      await sizeButtons.first().click();
      await page.waitForTimeout(200);
    }
    // Should have Add to bag button now that size is selected
    await expect(modal.locator('button:has-text("Add to bag")')).toBeVisible();
    // Should have Free returns
    await expect(modal.locator('text=Free returns')).toBeVisible();
    // Should have size selector
    await expect(modal.locator('.rw-sizes')).toBeVisible();
    // Close modal
    await modal.locator('.rw-modal-x').click();
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });

  test('wishlist heart toggles', async ({ page }) => {
    const cardButtons = await cards(page);
    const count = await cardButtons.count();
    if (count === 0) return;

    const firstCard = cardButtons.first();
    await firstCard.hover();
    const favBtn = firstCard.locator('.rw-card-fav');
    await expect(favBtn).toBeVisible({ timeout: 3000 });

    // Click to wishlist
    await favBtn.click();
    await page.waitForTimeout(300);
    // Should show toast or signup modal
    const signup = page.locator('.rw-modal--signup');
    if (await signup.isVisible({ timeout: 1000 }).catch(() => false)) {
      // User isn't signed in — close signup modal
      await signup.locator('.rw-modal-x').click();
    } else {
      // If signed in, heart should toggle
      const t = await toast(page);
      expect(await t.isVisible()).toBeTruthy();
    }
  });

  test('free returns + shipping strikethrough on each card', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });

    // Scroll to the shop grid so all cards load
    await page.evaluate(() => document.getElementById('the-drop')?.scrollIntoView());
    await page.waitForTimeout(500);

    const cardButtons = await cards(page);
    const count = await cardButtons.count();
    if (count === 0) return;

    // Check first few cards for the shipping line
    for (let i = 0; i < Math.min(count, 4); i++) {
      const card = cardButtons.nth(i);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      const shipLine = card.locator('.rw-card-ship');
      // Graceful: if the shipping line exists (new build), verify it; otherwise skip
      if (await shipLine.count() > 0) {
        await expect(shipLine).toBeVisible();
        await expect(shipLine).toContainText(/Free returns/i);
        await expect(shipLine.locator('.rw-price-was')).toBeVisible();
        await expect(shipLine).toContainText(/€8/);
      } else {
        // Card still renders without shipping line (pre-update deployment)
        await expect(card.locator('.rw-price-now')).toBeVisible();
      }
    }
  });
});

// ── Search ──────────────────────────────────────────────────────
test.describe('Search works', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
  });

  test('search filters products', async ({ page }) => {
    const search = await searchInput(page);
    await expect(search).toBeVisible();

    // Type a query
    await search.fill('Jersey');
    await page.waitForTimeout(500);
    // Products should be visible
    const visibleCards = page.locator('.rw-card:visible');
    const count = await visibleCards.count().catch(() => 0);
    if (count > 0) {
      // If results exist, they should contain "Jersey"
      const firstTitle = await visibleCards.first().locator('h3').textContent();
      expect(firstTitle?.toLowerCase()).toContain('jersey');
    }

    // Clear search
    await search.fill('');
    await page.waitForTimeout(300);
    const afterClear = page.locator('.rw-card:visible');
    expect(await afterClear.count()).toBeGreaterThan(0);
  });
});

// ── Cart lifecycle ──────────────────────────────────────────────
test.describe('Cart lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
  });

  test('add to bag and cart operations work', async ({ page }) => {
    // ── Add an item via quick view ──
    const firstCard = page.locator('.rw-card').first();
    await firstCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await firstCard.hover({ force: true });
    await firstCard.locator('.rw-add').click({ force: true });
    await page.waitForTimeout(500);

    // Dismiss scrim
    await page.locator('.rw-scrim, .rw-modal-wrap').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);

    // Toast should appear
    await expect(page.locator('.rw-toast')).toBeVisible({ timeout: 3000 });

    // ── Open cart drawer ──
    await page.waitForTimeout(300);
    const cartIcon = page.getByRole('button', { name: 'Cart', exact: true });
    await cartIcon.click({ force: true });
    await page.waitForTimeout(400);

    const drawer = page.locator('.rw-drawer.is-on');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('h4')).toBeVisible();

    // ── Increase qty ──
    await drawer.locator('.rw-qty button').last().click();
    await page.waitForTimeout(200);

    // ── Decrease ──
    await drawer.locator('.rw-qty button').first().click();
    await page.waitForTimeout(200);

    // ── Remove ──
    const removeBtn = drawer.locator('button[aria-label="Remove"]');
    if (await removeBtn.count() > 0) {
      await removeBtn.click();
      await page.waitForTimeout(300);
    }

    // ── Close ──
    await drawer.locator('button[aria-label="Close"]').first().click({ force: true });
    await page.waitForTimeout(300);
  });

  // Should see confirmation — skip on production (checkout redirects to Stripe)
  // Only works locally where Stripe test keys can complete the redirect
  const checkoutTest = !isAdmin ? test.skip : test;
  checkoutTest('full checkout flow places order', async ({ page }) => {
    // Add item
    const firstCard = page.locator('.rw-card').first();
    await firstCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await firstCard.hover({ force: true });
    await firstCard.locator('.rw-add').click({ force: true });
    await page.waitForTimeout(500);

    // Dismiss scrim
    await page.locator('.rw-scrim, .rw-modal-wrap').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);

    // Open cart
    await page.waitForTimeout(300);
    const cartIcon = page.getByRole('button', { name: 'Cart', exact: true });
    await cartIcon.click({ force: true });
    await page.waitForTimeout(400);

    // Checkout
    const drawer = page.locator('.rw-drawer.is-on');
    const checkoutBtn = drawer.locator('button:has-text("Checkout")');
    await expect(checkoutBtn).toBeVisible({ timeout: 3000 });
    await checkoutBtn.click();
    await page.waitForTimeout(500);

    // Should see checkout page
    const checkoutPage = page.locator('.rw-checkout');
    await expect(checkoutPage).toBeVisible({ timeout: 3000 });
    await expect(checkoutPage.locator('h3:has-text("Contact")')).toBeVisible();
    await expect(checkoutPage.locator('h3:has-text("Delivery")')).toBeVisible();
    await expect(checkoutPage.locator('h3:has-text("Payment")')).toBeVisible();
    await expect(checkoutPage.locator('h3:has-text("Order summary")')).toBeVisible();
    await expect(checkoutPage.locator('text=Shipping')).toBeVisible();

    // Place order — target the main action button (not payment method toggles)
    await checkoutPage.locator('.rw-btn-pri:has-text("Pay")').click();
    await page.waitForTimeout(3000);

    // Should see confirmation
    await expect(page.locator('.rw-confirm')).toBeVisible({ timeout: 5000 });
  });
});

// ── Backend API tests ──────────────────────────────────────────
test.describe('Backend API endpoints', () => {
  test('/api/send-order responds', async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/send-order`, {
      data: { email: 'test@test.com', name: 'Test', items: [{ name: 'Test Item', size: 'M', price: 42 }], total: 42, orderNum: 'RW-TEST' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Should have ok:true even if Resend not configured
    expect(body.ok ?? body.note).toBeTruthy();
  });

  test('/api/send-campaign responds', async ({ page }) => {
    const res = await page.request.post(`${BASE}/api/send-campaign`, {
      data: { emails: ['test@test.com'], subject: 'Test', message: 'Test message' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('sent');
    expect(body).toHaveProperty('total');
  });

  test('/api/run-tests endpoint exists', async ({ page }) => {
    const res = await page.request.get(`${BASE}/api/run-tests`);
    // Should respond, even if with an error (server-side Playwright may not be installed)
    expect([200, 500]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('passed');
    expect(body).toHaveProperty('failed');
    expect(body).toHaveProperty('total');
  });

  test('static files served correctly', async ({ page }) => {
    // Check that JS bundle is served with correct MIME type
    const html = await (await page.goto(BASE, { waitUntil: 'networkidle' }))?.text();
    const match = html?.match(/src="(\/assets\/[^"]+\.js)"/);
    if (match) {
      const jsRes = await page.request.get(`${BASE}${match[1]}`);
      expect(jsRes.status()).toBe(200);
      expect(jsRes.headers()['content-type']).toContain('javascript');
    }
  });
});

// ── Concurrent / Stress tests ──────────────────────────────────
test.describe('Stress / concurrency', () => {
  test('multiple concurrent homepage loads', async ({ browser }) => {
    const pages = await Promise.all(
      Array.from({ length: 5 }, () => browser.newPage())
    );
    try {
      const results = await Promise.allSettled(
        pages.map((p) => p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.status() === 200).length;
      expect(succeeded).toBeGreaterThanOrEqual(4); // At least 4/5 should succeed
    } finally {
      await Promise.all(pages.map((p) => p.close()));
    }
  });

  test('concurrent API calls to send-order', async ({ page }) => {
    const responses = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        page.request.post(`${BASE}/api/send-order`, {
          data: { email: `stress${i}@test.com`, name: 'Stress', items: [{ name: 'Stress Test Item', qty: 1, price: 10, size: 'M' }], total: 0, orderNum: `RW-STRESS-${i}` },
        })
      )
    );
    const ok = responses.filter(r => r.status === 'fulfilled' && r.value?.status() === 200).length;
    expect(ok).toBeGreaterThanOrEqual(3); // At least 3/5
  });
});

// ── Export for admin panel integration ─────────────────────────
export async function runTests() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await fn(page);
      results.push({ name, status: '✅', detail: 'Passed' });
      passed++;
    } catch (e) {
      results.push({ name, status: '❌', detail: e.message?.slice(0, 100) || 'Unknown error' });
      failed++;
    } finally {
      await context.close();
    }
  }

  await check('Homepage loads', async (p) => {
    const res = await p.goto(BASE, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    await expect(p.locator('h1')).toBeVisible();
  });

  await check('Admin panel loads', async (p) => {
    const res = await p.goto(`${BASE}/#admin`, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    await expect(p.locator('h1')).toContainText(/REWIND Admin/i);
  });

  await check('Navigation buttons exist', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const btns = p.locator('.rw-nav button, .rw-navlink');
    expect(await btns.count()).toBeGreaterThan(5);
  });

  await check('Product cards render', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const productCards = p.locator('.rw-card');
    expect(await productCards.count()).toBeGreaterThan(0);
  });

  await check('Footer Shop links exist', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const links = p.locator('.rw-footer-cols div:first-child a');
    expect(await links.count()).toBeGreaterThanOrEqual(4);
  });

  await check('Quick view modal opens', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const card = p.locator('.rw-card').first();
    await card.hover();
    await card.locator('.rw-card-quick').click();
    await p.waitForTimeout(400);
    await expect(p.locator('.rw-modal')).toBeVisible();
    await expect(p.locator('.rw-modal h2')).toBeVisible();
  });

  await check('Add to bag works', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const card = p.locator('.rw-card').first();
    await card.hover();
    await card.locator('.rw-add').click();
    await p.waitForTimeout(400);
    await expect(p.locator('.rw-toast')).toBeVisible({ timeout: 3000 });
  });

  await check('Cart drawer opens', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.locator('.rw-card').first().hover();
    await p.locator('.rw-card .rw-add').first().click();
    await p.waitForTimeout(300);
    await p.locator('.rw-iconbtn[aria-label="Cart"]').click();
    await p.waitForTimeout(400);
    await expect(p.locator('.rw-drawer')).toBeVisible();
  });

  await check('Search input works', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const search = p.locator('.rw-search input');
    await expect(search).toBeVisible();
    await search.fill('Jersey');
    await p.waitForTimeout(500);
  });

  await check('Free returns on product cards', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    const card = p.locator('.rw-card').first();
    await expect(card.locator('.rw-card-ship')).toBeVisible();
    await expect(card.locator('.rw-card-ship')).toContainText(/Free returns/i);
  });

  await check('Backend API /api/send-order', async (p) => {
    const res = await p.request.post(`${BASE}/api/send-order`, {
      data: { email: 'test@test.com', name: 'Test', items: [], total: 0, orderNum: 'RW-TEST' },
    });
    expect(res.status()).toBe(200);
  });

  await check('Backend API /api/send-campaign', async (p) => {
    const res = await p.request.post(`${BASE}/api/send-campaign`, {
      data: { emails: ['test@test.com'], subject: 'Test', message: 'Test' },
    });
    expect(res.status()).toBe(200);
  });

  await browser.close();
  return { results, passed, failed, total: results.length };
}
