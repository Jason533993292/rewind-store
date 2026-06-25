// run-tests.js — Standalone test runner for the admin panel's "🧪 Run tests" button.
// This file is imported by the Express server (api/server.js) via button-test.js.
// Unlike comprehensive.spec.js, this does NOT import @playwright/test or use test.describe(),
// so it can run safely outside the Playwright test runner context.

import { expect } from '@playwright/test';

const BASE = process.env.TEST_URL || 'https://rewind-stores.com';

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
