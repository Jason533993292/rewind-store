// run-tests.js — Standalone test runner for the admin panel's "🧪 Run tests" button.
// This file is imported by the Express server (api/server.js) via button-test.js.
// Unlike comprehensive.spec.js, this does NOT import @playwright/test or use test.describe(),
// so it can run safely outside the Playwright test runner context.

import { expect } from '@playwright/test';

const BASE = process.env.TEST_URL || 'https://rewind-stores.com';
const isAdmin = BASE.includes('localhost') || BASE.includes('127.0.0.1');

export async function runTests() {
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
  } catch (launchErr) {
    // Browser can't launch (missing system deps on this server — e.g. libglib)
    return {
      results: [{ name: 'Browser launch', status: '⚠️', detail: `Playwright browser unavailable on this server. Run tests locally: npx playwright test tests/comprehensive.spec.js. (${launchErr.message?.slice(0, 80)})` }],
      passed: 0,
      failed: 0,
      total: 0,
      skipped: true,
      hint: 'Missing system libraries for headless Chromium. Run `npx playwright install --with-deps chromium` on the server, or test locally.',
    };
  }
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

  // Skip admin test on production — the admin panel requires local auth (rw_admin_email in localStorage).
  if (isAdmin) {
    await check('Admin panel loads', async (p) => {
      const res = await p.goto(`${BASE}/#admin`, { waitUntil: 'networkidle' });
      expect(res?.status()).toBe(200);
      await expect(p.locator('h1')).toContainText(/REWIND Admin/i);
    });
  } else {
    results.push({ name: 'Admin panel loads', status: '⏭️', detail: 'Skipped (requires local auth)' });
  }

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
