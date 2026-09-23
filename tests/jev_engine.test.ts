import { test, describe } from 'node:test';
import assert from 'node:assert';
import { JevEngine } from '../src/jev_engine.js';
import { JevDecisionRequest } from '../src/types.js';

describe('Task 1: Jev Decision Engine (Dual-Channel Calibration)', () => {
  test('should perform non-autoregressive decision inference under 50ms with calibrated confidence', async () => {
    const engine = new JevEngine();

    const request: JevDecisionRequest = {
      schemaType: 'Choice',
      goal: 'Click the checkout button to proceed to payment',
      stateContext: 'URL: https://store.example.com/cart | Title: Shopping Cart',
      candidates: [
        {
          id: 'opt_checkout',
          description: 'Proceed to Checkout',
          selector: 'button#btn-checkout',
          nliHypothesis: 'It is the button "Proceed to Checkout" element',
        },
        {
          id: 'opt_cancel',
          description: 'Continue Shopping',
          selector: 'a.btn-continue',
          nliHypothesis: 'It is the link "Continue Shopping" element',
        },
        {
          id: 'opt_help',
          description: 'Customer Support FAQ',
          selector: 'a#faq-link',
          nliHypothesis: 'It is the link "Customer Support FAQ" element',
        },
      ],
    };

    const startTime = performance.now();
    const result = await engine.decide(request);
    const duration = performance.now() - startTime;

    // Assert correct candidate selected
    assert.strictEqual(result.selectedCandidateId, 'opt_checkout');
    assert.strictEqual(result.selectedSelector, 'button#btn-checkout');

    // Assert Channel 1 (Distribution Head): Soft probabilities
    assert.ok(result.topProbability > 0.6, `Top probability should be > 0.6, got ${result.topProbability}`);
    assert.ok(result.distribution['opt_checkout'] > result.distribution['opt_cancel']);

    // Assert Channel 2 (Confidence Head): Calibrated confidence score (ECE 1.44%)
    assert.ok(result.confidenceScore >= 0.85, `Confidence score should be >= 0.85, got ${result.confidenceScore}`);
    assert.strictEqual(result.isConfident, true);

    // Assert ultra-low latency (< 50ms)
    assert.ok(duration < 50, `Inference duration should be < 50ms, got ${duration}ms`);
    assert.ok(result.latencyMs < 50);
  });

  test('should produce lower confidence score when choices are ambiguous', async () => {
    const engine = new JevEngine();

    const request: JevDecisionRequest = {
      schemaType: 'Choice',
      goal: 'Select the color option',
      stateContext: 'URL: https://store.example.com/product | Title: Product Details',
      candidates: [
        {
          id: 'opt_dark_blue',
          description: 'Navy Blue',
          selector: 'button.color-navy',
          nliHypothesis: 'It is the button "Navy Blue" element',
        },
        {
          id: 'opt_deep_blue',
          description: 'Midnight Blue',
          selector: 'button.color-midnight',
          nliHypothesis: 'It is the button "Midnight Blue" element',
        },
      ],
    };

    const result = await engine.decide(request);
    // When ambiguous, confidence should reflect doubt (gating trigger)
    assert.ok(result.confidenceScore < 0.85, `Ambiguous query confidence should be < 0.85, got ${result.confidenceScore}`);
    assert.strictEqual(result.isConfident, false);
  });
});
