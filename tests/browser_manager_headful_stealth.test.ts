import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserManager } from '../src/browser_manager.js';

describe('Task 1: BrowserManager Headful Mode and Stealth Support', () => {
  let browserManager: BrowserManager | null = null;

  afterEach(async () => {
    if (browserManager) {
      await browserManager.closeBrowser();
      browserManager = null;
    }
  });

  it('should accept custom headless config and stealth options', async () => {
    browserManager = new BrowserManager({
      headless: true,
      stealth: true,
      args: ['--test-flag'],
    });

    const config = (browserManager as any).config;
    assert.strictEqual(config.headless, true);
    assert.strictEqual(config.stealth, true);
    assert.ok(config.args.includes('--disable-blink-features=AutomationControlled'));
    assert.ok(config.args.includes('--test-flag'));
  });

  it('should respect environment variable HEADLESS=false when config.headless is undefined', () => {
    const originalEnv = process.env.HEADLESS;
    try {
      process.env.HEADLESS = 'false';
      const bm = new BrowserManager();
      assert.strictEqual((bm as any).config.headless, false);
    } finally {
      if (originalEnv !== undefined) {
        process.env.HEADLESS = originalEnv;
      } else {
        delete process.env.HEADLESS;
      }
    }
  });

  it('should remove navigator.webdriver on page initialization when stealth is enabled', async () => {
    browserManager = new BrowserManager({
      headless: true,
      stealth: true,
    });

    const page = await browserManager.getActivePage();
    await page.setContent('<html><body><h1>Stealth Test</h1></body></html>');

    const isWebdriver = await page.evaluate(() => (navigator as any).webdriver);
    assert.strictEqual(isWebdriver, false);
  });
});
