import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { FastLoopController } from '../src/fast_loop_controller.js';
import { BrowserManager } from '../src/browser_manager.js';

describe('Task 2: FastLoopController Visual HUD & Element Highlight', () => {
  let browserManager: BrowserManager | null = null;

  afterEach(async () => {
    if (browserManager) {
      await browserManager.closeBrowser();
      browserManager = null;
    }
  });

  it('should inject floating HUD and element highlight before executing action when visualFeedback is enabled', async () => {
    browserManager = new BrowserManager({ headless: true });
    const page = await browserManager.getActivePage();

    await page.setContent(`
      <html>
        <body>
          <div id="container">
            <button id="submit-btn">Submit Order Now</button>
          </div>
        </body>
      </html>
    `);

    const controller = new FastLoopController(undefined, undefined, {
      visualFeedback: true,
      highlightDurationMs: 20,
    });

    const result = await controller.executeStep(page, {
      stepIndex: 1,
      goal: 'Click Submit Order Now',
      actionType: 'click',
    });

    assert.strictEqual(result.status, 'auto_executed');
    assert.ok(result.decision.selectedSelector);

    // Verify HUD element was created in page DOM
    const hudExists = await page.evaluate(() => !!document.getElementById('jev-hud-badge'));
    assert.strictEqual(hudExists, true);
  });
});
