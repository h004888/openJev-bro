import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createJevMcpServer } from '../src/mcp_server.js';

describe('Task 3: E2E Fast Run with Stealth and Custom Browser Config', () => {
  it('should execute fast-run plan on mock AI tech page and capture screenshot without hanging', async () => {
    const { server, browserManager, handleFastRun } = createJevMcpServer({
      headless: true,
      stealth: true,
    });

    try {
      const page = await browserManager.getActivePage();
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Hacker News Simulation</title></head>
        <body>
          <table id="hnmain">
            <tr>
              <td><a href="#article1">Rust 2026 Roadmap</a></td>
            </tr>
            <tr>
              <td><a href="#article2" id="ai-article">Introducing GPT-6 and Advanced AI Agents</a></td>
            </tr>
            <tr>
              <td><a href="#article3">Show HN: Lightweight SQLite GUI</a></td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await page.setContent(mockHtml);

      const result = await handleFastRun({
        macroGoal: 'Find and click the first article about AI',
        confidenceThreshold: 0.5,
        steps: [
          {
            stepIndex: 1,
            goal: 'Click the article link about AI or GPT',
            actionType: 'click',
          },
        ],
      });

      assert.strictEqual(result.successfulSteps, 1);
      assert.strictEqual(result.stepResults[0].status, 'auto_executed');
      assert.ok(result.stepResults[0].actionTaken?.includes('click'));
    } finally {
      await browserManager.closeBrowser();
    }
  });
});
