import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as os from 'os';
import * as path from 'path';
import { BrowserManager } from '../src/browser_manager.js';

describe('Task 1: BrowserManager Default Headful and Persisted Profile', () => {
  let browserManager: BrowserManager | null = null;

  afterEach(async () => {
    if (browserManager) {
      await browserManager.closeBrowser();
      browserManager = null;
    }
  });

  it('should default to headless: false when no headless config or env var is passed', () => {
    const originalEnv = process.env.HEADLESS;
    const originalChromeEnv = process.env.CHROME_HEADLESS;
    try {
      delete process.env.HEADLESS;
      delete process.env.CHROME_HEADLESS;
      const bm = new BrowserManager();
      assert.strictEqual((bm as any).config.headless, false);
    } finally {
      if (originalEnv !== undefined) process.env.HEADLESS = originalEnv;
      if (originalChromeEnv !== undefined) process.env.CHROME_HEADLESS = originalChromeEnv;
    }
  });

  it('should support default or custom userDataDir', () => {
    const customDir = path.join(os.tmpdir(), 'custom-jev-profile');
    const bm = new BrowserManager({ userDataDir: customDir });
    assert.strictEqual((bm as any).config.userDataDir, customDir);
  });

  it('should allow explicit override to headless: true for CI/CD environments', () => {
    const bm = new BrowserManager({ headless: true });
    assert.strictEqual((bm as any).config.headless, true);
  });
});
