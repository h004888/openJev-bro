import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import { BrowserManager } from '../src/browser_manager.js';

describe('Task 1: BrowserManager (Puppeteer Shared Browser & Tab Lifecycle)', () => {
  const manager = new BrowserManager({ headless: true });

  after(async () => {
    await manager.closeBrowser();
  });

  test('should launch browser, create new page, and get active page', async () => {
    const page = await manager.getActivePage();
    assert.ok(page, 'Active page should exist');

    await page.setContent('<h1>Hello Jev Chrome DevTools</h1>');
    const title = await page.$eval('h1', (el) => el.textContent);
    assert.strictEqual(title, 'Hello Jev Chrome DevTools');

    const pages = await manager.listPages();
    assert.ok(pages.length >= 1, 'Should list at least 1 open page');
  });

  test('should create multiple tabs and switch active page', async () => {
    const page2 = await manager.newPage('https://example.com');
    assert.ok(page2);

    const pages = await manager.listPages();
    assert.ok(pages.length >= 2, 'Should have at least 2 open tabs');

    // Switch active tab
    await manager.selectPage(0);
    const active = await manager.getActivePage();
    assert.ok(active);
  });
});
