import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createJevMcpServer } from '../src/mcp_server.js';

describe('Task 4: Jev Chrome DevTools MCP Server Tools', () => {
  test('should initialize MCP server and handle jev_rank_elements tool call', async () => {
    const { server, handleRankElements } = createJevMcpServer();

    assert.ok(server);

    const result = await handleRankElements({
      goal: 'Find the download button',
      candidates: [
        { id: '1', description: 'Download Now Installer', selector: 'a#download-btn' },
        { id: '2', description: 'Terms of Service', selector: 'a#tos' },
        { id: '3', description: 'Contact Us', selector: 'a#contact' },
      ],
    });

    assert.strictEqual(result.selectedCandidateId, '1');
    assert.strictEqual(result.selectedSelector, 'a#download-btn');
    assert.ok(result.confidenceScore > 0.8);
    assert.ok(result.latencyMs < 50);
  });

  test('should handle jev_evaluate_action tool call', async () => {
    const { handleEvaluateAction } = createJevMcpServer();

    const result = await handleEvaluateAction({
      actionDescription: 'Click the primary CTA button',
      elementSelector: 'button.btn-primary',
      pageContext: 'Landing Page Hero Section',
    });

    assert.ok(result.confidenceScore > 0.5);
    assert.strictEqual(typeof result.isConfident, 'boolean');
  });
});
