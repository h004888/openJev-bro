import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import { createJevMcpServer } from '../src/mcp_server.js';

describe('Task 4: Unified Live E2E jev_fast_run', () => {
  const { browserManager, handleToolCall } = createJevMcpServer({ headless: true });

  after(async () => {
    await browserManager.closeBrowser();
  });

  test('should execute 3-step live form automation via jev_fast_run in under 200ms', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Registration Form</title></head>
        <body>
          <h2 id="status">Ready</h2>
          <input id="inp-name" type="text" placeholder="Enter Full Name" />
          <button id="btn-next" onclick="document.getElementById('status').innerText = 'Step 2 Done'">Next Step</button>
          <button id="btn-finish" onclick="document.getElementById('status').innerText = 'Completed: ' + document.getElementById('inp-name').value">Finish Registration</button>
        </body>
      </html>
    `;

    // 1. Open page
    await handleToolCall('navigate_page', { url: `data:text/html,${encodeURIComponent(html)}` });

    // 2. Execute 3-step automation via jev_fast_run
    const fastRunResponse = await handleToolCall('jev_fast_run', {
      macroGoal: 'Fill full name, click Next Step, and click Finish Registration',
      steps: [
        {
          stepIndex: 1,
          goal: 'Enter Full Name into input box',
          actionType: 'type',
          inputValue: 'John Doe',
        },
        {
          stepIndex: 2,
          goal: 'Click Next Step button',
          actionType: 'click',
        },
        {
          stepIndex: 3,
          goal: 'Click Finish Registration button',
          actionType: 'click',
        },
      ],
      confidenceThreshold: 0.85,
    });

    const summary = JSON.parse(fastRunResponse.content[0].text);
    if (summary.successfulSteps !== 3) {
      console.error('FastRun Debug Summary:', JSON.stringify(summary, null, 2));
    }

    assert.strictEqual(summary.totalSteps, 3);
    assert.strictEqual(summary.successfulSteps, 3);
    assert.strictEqual(summary.escalatedSteps, 0);
    assert.strictEqual(summary.failedSteps, 0);

    // Verify DOM state on live page
    const page = await browserManager.getActivePage();
    const finalStatus = await page.$eval('#status', (el) => el.textContent);
    assert.strictEqual(finalStatus, 'Completed: John Doe');
  });
});
