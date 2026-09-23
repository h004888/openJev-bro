import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FastLoopController } from '../src/fast_loop_controller.js';
import { JevEngine } from '../src/jev_engine.js';
import { DomExtractor } from '../src/dom_extractor.js';
import { AutomationPlan } from '../src/types.js';

describe('Task 2: FastLoopController Threshold Passthrough', () => {
  test('should respect custom confidenceThreshold passed into runPlan', async () => {
    // FastLoopController with default 0.85
    const controller = new FastLoopController(new JevEngine(), new DomExtractor(), {
      confidenceThreshold: 0.85,
    });

    let clicked = false;
    const mockPage = {
      goto: async () => {},
      evaluate: async () => [
        {
          id: 'btn_1',
          tagName: 'button',
          text: 'Semi matching button',
          selector: '#btn-1',
          isVisible: true,
          isEnabled: true,
        },
        {
          id: 'btn_2',
          tagName: 'button',
          text: 'Another option',
          selector: '#btn-2',
          isVisible: true,
          isEnabled: true,
        },
      ],
      click: async () => {
        clicked = true;
      },
      type: async () => {},
    } as any;

    const plan: AutomationPlan = {
      planId: 'test_plan_custom_threshold',
      macroGoal: 'Test custom threshold',
      steps: [
        {
          stepIndex: 1,
          goal: 'Semi matching button',
          actionType: 'click',
        },
      ],
    };

    // When passing confidenceThreshold: 0.5, it should auto_execute instead of escalating at 0.85
    const summary = await controller.runPlan(mockPage, plan, 0.5);

    assert.strictEqual(summary.successfulSteps, 1, 'Should auto-execute with threshold 0.5');
    assert.strictEqual(summary.escalatedSteps, 0);
    assert.strictEqual(clicked, true);
  });
});
