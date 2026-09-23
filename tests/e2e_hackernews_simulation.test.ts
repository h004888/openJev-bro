import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import { createJevMcpServer } from '../src/mcp_server.js';

describe('Task 3: E2E Hacker News Simulation with 15 Articles', () => {
  const { browserManager, handleToolCall } = createJevMcpServer({ headless: true });

  after(async () => {
    await browserManager.closeBrowser();
  });

  test('should successfully click target AI article on Hacker News page with 15 articles', async () => {
    // Generate HTML with 15 article links exactly matching Hacker News layout
    const articles = [
      'Show HN: Simple SQLite backup tool in Rust',
      'PostgreSQL 17 Released',
      'Why we switched from React to HTMX',
      'Ask HN: Best ergonomic chair for remote work?',
      'Linux Kernel 6.12 features and changes',
      'Building a DIY Mechanical Keyboard from scratch',
      'CSS Grid vs Flexbox in 2026',
      'How Wi-Fi 7 achieves 46 Gbps theoretical speed',
      'NASA James Webb Telescope reveals ancient galaxy',
      'A deep dive into Go runtime garbage collector',
      'GPT-6 Sol and Luna AI Model weights released', // Target #11
      'Vintage Computing: Apple II restoration log',
      'Understanding B-Tree indexing algorithms',
      'WebAssembly multi-threading support status',
      'How we reduced AWS cloud bill by 40%',
    ];

    const tableRows = articles
      .map(
        (title, i) => `
        <tr class="athing" id="${i + 1}">
          <td class="title">
            <span class="titleline">
              <a href="https://example.com/item?id=${i + 1}" onclick="document.getElementById('clicked-title').innerText = '${title}'; return false;">${title}</a>
            </span>
          </td>
        </tr>
      `
      )
      .join('\n');

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Hacker News</title></head>
        <body>
          <h2 id="clicked-title">None</h2>
          <center>
            <table>
              <tbody>
                <tr>
                  <td>
                    <table>
                      <tbody>
                        ${tableRows}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </center>
        </body>
      </html>
    `;

    // 1. Navigate to simulated Hacker News page
    await handleToolCall('navigate_page', { url: `data:text/html,${encodeURIComponent(html)}` });

    // 2. Call jev_fast_run (mimicking the user prompt)
    const fastRunResponse = await handleToolCall('jev_fast_run', {
      macroGoal: 'Navigate to Hacker News, find the first article about AI, and click to view it',
      steps: [
        {
          stepIndex: 1,
          goal: 'Click the first article link about AI, LLM, GPT, Machine Learning, or Artificial Intelligence',
          actionType: 'click',
        },
      ],
      confidenceThreshold: 0.5,
    });

    assert.ok(fastRunResponse.content);
    const summary = JSON.parse(fastRunResponse.content[0].text);

    assert.strictEqual(summary.totalSteps, 1);
    assert.strictEqual(summary.successfulSteps, 1, 'Should successfully click the AI article');
    assert.strictEqual(summary.escalatedSteps, 0, 'Should NOT escalate when confidence is high');
    assert.strictEqual(summary.failedSteps, 0);

    // Verify the clicked article is GPT-6
    const step1 = summary.stepResults[0];
    assert.strictEqual(step1.decision.selectedDescription, 'GPT-6 Sol and Luna AI Model weights released');
    assert.ok(step1.decision.confidenceScore >= 0.85);

    // Verify DOM state
    const page = await browserManager.getActivePage();
    const clickedText = await page.$eval('#clicked-title', (el) => el.textContent);
    assert.strictEqual(clickedText, 'GPT-6 Sol and Luna AI Model weights released');
  });
});
