import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs, createJevMcpServer } from '../src/mcp_server.js';

describe('Task 2: MCP Server CLI Argument Parser & Config', () => {
  it('should parse --headless=false and --no-headless correctly', () => {
    const config1 = parseCliArgs(['--headless=false']);
    assert.strictEqual(config1.headless, false);

    const config2 = parseCliArgs(['--no-headless']);
    assert.strictEqual(config2.headless, false);

    const config3 = parseCliArgs(['--headless=true']);
    assert.strictEqual(config3.headless, true);

    const config4 = parseCliArgs(['--headless']);
    assert.strictEqual(config4.headless, true);
  });

  it('should parse --chrome-path and --stealth options', () => {
    const config = parseCliArgs(['--chrome-path=C:\\Custom\\Chrome\\chrome.exe', '--stealth=false']);
    assert.strictEqual(config.executablePath, 'C:\\Custom\\Chrome\\chrome.exe');
    assert.strictEqual(config.stealth, false);
  });

  it('should pass parsed config into createJevMcpServer', () => {
    const instance = createJevMcpServer({ headless: false });
    assert.ok(instance);
    assert.ok(instance.browserManager);
    assert.strictEqual((instance.browserManager as any).config.headless, false);
  });
});
