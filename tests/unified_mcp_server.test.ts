import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import { createJevMcpServer } from '../src/mcp_server.js';

describe('Task 3: Unified All-in-One MCP Server', () => {
  const { server, browserManager, handleToolCall, getRegisteredToolNames } = createJevMcpServer({ headless: true });

  after(async () => {
    await browserManager.closeBrowser();
  });

  test('should register both Chrome DevTools tools and Jev Decision tools in unified catalog', async () => {
    const toolNames = getRegisteredToolNames();

    // Check DevTools tools
    assert.ok(toolNames.includes('navigate_page'), 'Missing navigate_page');
    assert.ok(toolNames.includes('click'), 'Missing click');
    assert.ok(toolNames.includes('type_text'), 'Missing type_text');
    assert.ok(toolNames.includes('fill'), 'Missing fill');
    assert.ok(toolNames.includes('hover'), 'Missing hover');
    assert.ok(toolNames.includes('press_key'), 'Missing press_key');
    assert.ok(toolNames.includes('take_screenshot'), 'Missing take_screenshot');
    assert.ok(toolNames.includes('take_snapshot'), 'Missing take_snapshot');
    assert.ok(toolNames.includes('evaluate_script'), 'Missing evaluate_script');
    assert.ok(toolNames.includes('list_pages'), 'Missing list_pages');
    assert.ok(toolNames.includes('new_page'), 'Missing new_page');
    assert.ok(toolNames.includes('close_page'), 'Missing close_page');

    // Check Jev tools
    assert.ok(toolNames.includes('jev_rank_elements'), 'Missing jev_rank_elements');
    assert.ok(toolNames.includes('jev_evaluate_action'), 'Missing jev_evaluate_action');
    assert.ok(toolNames.includes('jev_fast_run'), 'Missing jev_fast_run');
    assert.ok(toolNames.length >= 15);
  });

  test('should execute DevTools tool (navigate_page) and Jev tool (jev_rank_elements) on unified server', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <button id="btn-login">Login with SSO</button>
          <a id="link-forgot" href="#">Forgot Password</a>
        </body>
      </html>
    `;

    // 1. Call navigate_page
    const navResponse = await handleToolCall('navigate_page', { url: `data:text/html,${encodeURIComponent(html)}` });
    assert.ok(navResponse.content);
    assert.ok(navResponse.content[0].text.includes('success'));

    // 2. Call jev_rank_elements
    const jevResponse = await handleToolCall('jev_rank_elements', {
      goal: 'Login to system with single sign on',
      candidates: [
        { id: '1', description: 'Login with SSO', selector: '#btn-login' },
        { id: '2', description: 'Forgot Password', selector: '#link-forgot' },
      ],
    });

    assert.ok(jevResponse.content);
    const parsed = JSON.parse(jevResponse.content[0].text);
    assert.strictEqual(parsed.selectedCandidateId, '1');
    assert.strictEqual(parsed.selectedSelector, '#btn-login');
  });
});
