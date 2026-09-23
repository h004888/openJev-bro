import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createJevMcpServer } from '../src/mcp_server.js';

describe('Task 3: E2E Hacker News Live Simulation with Visual HUD and Screenshot', () => {
  let serverInstance: ReturnType<typeof createJevMcpServer> | null = null;

  afterEach(async () => {
    if (serverInstance?.browserManager) {
      await serverInstance.browserManager.closeBrowser();
      serverInstance = null;
    }
  });

  it('should run full fast_run plan on Hacker News mock with Visual HUD and capture screenshot', async () => {
    serverInstance = createJevMcpServer({
      headless: true,
      stealth: true,
    });

    const page = await serverInstance.browserManager.getActivePage();

    const hnArticles = `
      <!DOCTYPE html>
      <html>
      <head><title>Hacker News</title></head>
      <body>
        <table id="hnmain">
          <tr><td><a href="#1">Show HN: High-performance C++ Compiler</a></td></tr>
          <tr><td><a href="#2">Postgres 18 Query Planner Improvements</a></td></tr>
          <tr><td><a href="#3" id="target-ai">GPT-6 Sol and Luna: Next Generation Frontier Models</a></td></tr>
          <tr><td><a href="#4">Ask HN: Best Mechanical Keyboards for 2026?</a></td></tr>
        </table>
      </body>
      </html>
    `;

    await page.setContent(hnArticles);

    const result = await serverInstance.handleFastRun({
      macroGoal: 'Navigate to Hacker News, find the first article about AI, and click to view it',
      confidenceThreshold: 0.5,
      steps: [
        {
          stepIndex: 1,
          goal: 'Click the first article link about AI, LLM, GPT, Machine Learning, or Artificial Intelligence',
          actionType: 'click',
        },
      ],
    });

    assert.strictEqual(result.successfulSteps, 1);
    assert.strictEqual(result.stepResults[0].status, 'auto_executed');
    assert.strictEqual(result.stepResults[0].decision.selectedCandidateId, 'elem_2_a');
    assert.strictEqual(result.stepResults[0].decision.isConfident, true);

    // Verify take_screenshot tool
    const screenshotRes = await serverInstance.handleToolCall('take_screenshot', { fullPage: false });
    assert.ok(screenshotRes.content[0].text.includes('base64'));
  });
});
