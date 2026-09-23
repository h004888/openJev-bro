import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FastLoopController } from '../src/fast_loop_controller.js';
import { JevEngine } from '../src/jev_engine.js';
import { DomExtractor } from '../src/dom_extractor.js';
import { AutomationStep, GatingConfig } from '../src/types.js';

describe('Task 3: FastLoopController (High-Speed Automated Gating)', () => {
  const gatingConfig: GatingConfig = {
    confidenceThreshold: 0.85,
    maxConsecutiveSteps: 10,
    microDelayMs: 5,
    stepTimeoutMs: 5000,
  };

  test('should auto-execute action when confidence >= threshold', async () => {
    const engine = new JevEngine();
    const extractor = new DomExtractor();
    const controller = new FastLoopController(engine, extractor, gatingConfig);

    let clickedSelector = '';
    // Mock Puppeteer Page
    const mockPage = {
      evaluate: async () => [
        {
          id: 'btn_submit',
          tagName: 'button',
          text: 'Submit Order Now',
          selector: 'button#btn-submit',
          isVisible: true,
          isEnabled: true,
        },
        {
          id: 'btn_back',
          tagName: 'a',
          text: 'Go Back',
          selector: 'a.back-btn',
          isVisible: true,
          isEnabled: true,
        },
      ],
      click: async (selector: string) => {
        clickedSelector = selector;
      },
      type: async () => {},
    } as any;

    const step: AutomationStep = {
      stepIndex: 1,
      goal: 'Click Submit Order Now button',
      actionType: 'click',
    };

    const result = await controller.executeStep(mockPage, step);

    assert.strictEqual(result.status, 'auto_executed');
    assert.strictEqual(clickedSelector, 'button#btn-submit');
    assert.ok(result.decision.confidenceScore >= 0.85);
    assert.ok(result.executionDurationMs < 100);
  });

  test('should escalate to System 2 when confidence < threshold', async () => {
    const engine = new JevEngine();
    const extractor = new DomExtractor();
    const controller = new FastLoopController(engine, extractor, gatingConfig);

    let wasClicked = false;
    const mockPage = {
      evaluate: async () => [
        {
          id: 'btn_opt_1',
          tagName: 'button',
          text: 'Option A1',
          selector: 'button.a1',
          isVisible: true,
          isEnabled: true,
        },
        {
          id: 'btn_opt_2',
          tagName: 'button',
          text: 'Option A2',
          selector: 'button.a2',
          isVisible: true,
          isEnabled: true,
        },
      ],
      click: async () => {
        wasClicked = true;
      },
    } as any;

    const step: AutomationStep = {
      stepIndex: 2,
      goal: 'Choose the special setting option',
      actionType: 'click',
    };

    const result = await controller.executeStep(mockPage, step);

    assert.strictEqual(result.status, 'escalated');
    assert.strictEqual(wasClicked, false, 'Should NOT click when confidence is below threshold');
    assert.ok(result.decision.confidenceScore < 0.85);
  });
});
