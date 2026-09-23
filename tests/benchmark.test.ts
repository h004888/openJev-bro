import { test, describe } from 'node:test';
import assert from 'node:assert';
import { FastLoopController } from '../src/fast_loop_controller.js';
import { AutomationPlan } from '../src/types.js';

describe('Task 5: E2E Benchmark (High-Speed Automation Latency)', () => {
  test('should execute 5-step e-commerce automation plan under 250ms total duration', async () => {
    const controller = new FastLoopController();

    // Mock interactive page with dynamic elements per step
    let stepCount = 0;
    const mockPage = {
      goto: async () => {},
      evaluate: async () => {
        stepCount++;
        return [
          {
            id: `btn_step_${stepCount}`,
            tagName: 'button',
            text: `Action for Step ${stepCount}`,
            selector: `button#step-${stepCount}`,
            isVisible: true,
            isEnabled: true,
          },
          {
            id: `link_cancel_${stepCount}`,
            tagName: 'a',
            text: 'Cancel and Exit',
            selector: 'a.cancel',
            isVisible: true,
            isEnabled: true,
          },
        ];
      },
      click: async () => {},
      type: async () => {},
    } as any;

    const plan: AutomationPlan = {
      planId: 'plan_ecom_5_steps',
      macroGoal: 'Search, select, and checkout product',
      steps: [
        { stepIndex: 1, goal: 'Action for Step 1', actionType: 'type', inputValue: 'Sony Headphones' },
        { stepIndex: 2, goal: 'Action for Step 2', actionType: 'click' },
        { stepIndex: 3, goal: 'Action for Step 3', actionType: 'click' },
        { stepIndex: 4, goal: 'Action for Step 4', actionType: 'click' },
        { stepIndex: 5, goal: 'Action for Step 5', actionType: 'click' },
      ],
    };

    const summary = await controller.runPlan(mockPage, plan);

    assert.strictEqual(summary.totalSteps, 5);
    assert.strictEqual(summary.successfulSteps, 5);
    assert.strictEqual(summary.escalatedSteps, 0);
    assert.strictEqual(summary.failedSteps, 0);

    // Fast-Loop latency assertions
    assert.ok(
      summary.totalExecutionTimeMs < 250,
      `Total execution time should be < 250ms, got ${summary.totalExecutionTimeMs}ms`
    );
    assert.ok(
      summary.averageStepLatencyMs < 45,
      `Average step latency should be < 45ms, got ${summary.averageStepLatencyMs}ms`
    );
  });
});
