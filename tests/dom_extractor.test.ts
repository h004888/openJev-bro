import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DomExtractor } from '../src/dom_extractor.js';
import { InteractiveElement } from '../src/types.js';

describe('Task 2: DomExtractor (DOM Interactive Elements & NLI Hypothesis)', () => {
  test('should format extracted elements with Jev v1.4 NLI sentence hypothesis', () => {
    const extractor = new DomExtractor(10, 512);

    const mockElements: InteractiveElement[] = [
      {
        id: 'btn_pay',
        tagName: 'button',
        text: 'Thanh toán ngay',
        selector: 'button#btn-pay',
        isVisible: true,
        isEnabled: true,
        nliDescription: 'It is the button "Thanh toán ngay" element',
      },
      {
        id: 'link_cart',
        tagName: 'a',
        text: 'Giỏ hàng',
        selector: 'a.cart-link',
        isVisible: true,
        isEnabled: true,
        nliDescription: 'It is the a "Giỏ hàng" element',
      },
    ];

    const candidates = extractor.toJevCandidates(mockElements);

    assert.strictEqual(candidates.length, 2);
    assert.strictEqual(candidates[0].id, 'btn_pay');
    assert.strictEqual(candidates[0].nliHypothesis, 'It is the button "Thanh toán ngay" element');
    assert.strictEqual(candidates[1].id, 'link_cart');
    assert.strictEqual(candidates[1].nliHypothesis, 'It is the a "Giỏ hàng" element');
  });

  test('should enforce max candidate limit and token budget restriction', () => {
    const extractor = new DomExtractor(3, 100);

    const rawElements: InteractiveElement[] = Array.from({ length: 10 }, (_, i) => ({
      id: `elem_${i}`,
      tagName: 'button',
      text: `Option ${i}`,
      selector: `button.opt-${i}`,
      isVisible: true,
      isEnabled: true,
      nliDescription: `It is the button "Option ${i}" element`,
    }));

    const candidates = extractor.toJevCandidates(rawElements.slice(0, 3));
    assert.strictEqual(candidates.length, 3);
  });
});
