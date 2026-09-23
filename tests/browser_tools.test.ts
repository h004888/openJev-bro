import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import { BrowserManager } from '../src/browser_manager.js';
import { BrowserTools } from '../src/browser_tools.js';

describe('Task 2: BrowserTools (Chrome DevTools Standard Action & Inspection Tools)', () => {
  const manager = new BrowserManager({ headless: true });
  const tools = new BrowserTools(manager);

  after(async () => {
    await manager.closeBrowser();
  });

  test('should navigate to page, type text, click, evaluate script, and take snapshot', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1 id="header">Welcome</h1>
          <input id="username" type="text" placeholder="Enter name" />
          <button id="submit-btn" onclick="document.getElementById('header').innerText = 'Submitted: ' + document.getElementById('username').value">Submit</button>
        </body>
      </html>
    `;

    // 1. Navigate via data-url
    const navResult = await tools.navigatePage(`data:text/html,${encodeURIComponent(html)}`);
    assert.ok(navResult.success);

    // 2. Type text
    const typeResult = await tools.typeText('#username', 'Alice');
    assert.ok(typeResult.success);

    // 3. Click
    const clickResult = await tools.click('#submit-btn');
    assert.ok(clickResult.success);

    // 4. Evaluate Script
    const evalResult = await tools.evaluateScript('document.getElementById("header").innerText');
    assert.strictEqual(evalResult.result, 'Submitted: Alice');

    // 5. Take Snapshot
    const snapshot = await tools.takeSnapshot();
    assert.ok(snapshot.includes('Submitted: Alice'));
  });

  test('should take screenshot and return base64 data', async () => {
    const screenshotResult = await tools.takeScreenshot();
    assert.ok(screenshotResult.base64);
    assert.ok(screenshotResult.base64.length > 50);
  });
});
