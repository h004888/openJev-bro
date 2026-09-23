import type { Page } from 'puppeteer';
import { InteractiveElement, JevCandidate } from './types.js';

/**
 * Fast DOM Interactive Element Extractor
 * Designed to extract relevant clickable and form elements,
 * format them into Jev NLI sentence templates, and stay within
 * the optimal 512-token context budget.
 */
export class DomExtractor {
  private maxCandidates: number;
  private maxContextLength: number;

  constructor(maxCandidates = 15, maxContextLength = 512) {
    this.maxCandidates = maxCandidates;
    this.maxContextLength = maxContextLength;
  }

  /**
   * Extracts visible interactive elements from the current page state.
   */
  async extractInteractiveElements(page: Page): Promise<InteractiveElement[]> {
    // Use string literal to avoid tsx/esbuild helper injection (__name) inside browser sandbox
    const rawElements = (await page.evaluate(`(() => {
      function isVisible(el) {
        try {
          const style = window.getComputedStyle(el);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          ) {
            return false;
          }
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
        } catch (e) {
          return true;
        }
      }

      function generateSelector(el) {
        if (el.id && isNaN(Number(el.id[0]))) return '#' + el.id;
        if (el.getAttribute('data-testid')) {
          return '[data-testid="' + el.getAttribute('data-testid') + '"]';
        }
        if (el.getAttribute('name')) {
          return el.tagName.toLowerCase() + '[name="' + el.getAttribute('name') + '"]';
        }

        let path = '';
        let current = el;
        while (current && current.nodeType === 1 && current !== document.body && current !== document.documentElement) {
          if (current.id && isNaN(Number(current.id[0]))) {
            path = '#' + current.id + (path ? ' > ' + path : '');
            break;
          }
          let tag = current.tagName.toLowerCase();
          let parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1;
              tag += ':nth-of-type(' + index + ')';
            }
          }
          path = path ? tag + ' > ' + path : tag;
          current = parent;
        }
        return path || el.tagName.toLowerCase();
      }

      const nodes = Array.from(
        document.querySelectorAll(
          'button, a, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="tab"], [tabindex="0"]'
        )
      );

      const items = [];

      nodes.forEach((el, index) => {
        if (!isVisible(el)) return;

        const rect = el.getBoundingClientRect();
        const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 100);
        const ariaLabel = el.getAttribute('aria-label') || undefined;
        const placeholder = el.getAttribute('placeholder') || undefined;
        const name = el.getAttribute('name') || undefined;
        const type = el.getAttribute('type') || undefined;
        const role = el.getAttribute('role') || undefined;
        const href = el.href || undefined;
        const value = el.value || undefined;
        const isEnabled = !el.disabled;

        if (!text && !ariaLabel && !placeholder && !name && !value) return;

        items.push({
          id: 'elem_' + index + '_' + el.tagName.toLowerCase(),
          tagName: el.tagName.toLowerCase(),
          role: role,
          type: type,
          text: text,
          ariaLabel: ariaLabel,
          name: name,
          value: value,
          placeholder: placeholder,
          href: href,
          selector: generateSelector(el),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          isVisible: true,
          isEnabled: isEnabled,
        });
      });

      return items;
    })()`)) as any[];

    // Format with NLI sentence templating: "It is {description}"
    return (rawElements || []).slice(0, this.maxCandidates).map((item) => {
      const label = item.text || item.ariaLabel || item.placeholder || item.name || item.tagName;
      const typeDesc = item.role || item.type || item.tagName;
      const cleanDesc = `${typeDesc} "${label}"`;

      return {
        ...item,
        // Jev v1.4 NLI hypothesis template
        nliDescription: `It is the ${cleanDesc} element`,
      };
    });
  }

  /**
   * Converts interactive elements into formatted Jev candidates
   */
  toJevCandidates(elements: InteractiveElement[]): JevCandidate[] {
    return elements.map((elem) => ({
      id: elem.id,
      description: elem.text || elem.ariaLabel || elem.name || elem.placeholder || elem.selector,
      selector: elem.selector,
      nliHypothesis: elem.nliDescription,
    }));
  }

  /**
   * Extracts compact state summary (Page title, URL, focused element)
   * Guaranteed to be under context budget.
   */
  async extractCompactState(page: Page): Promise<string> {
    try {
      const state = (await page.evaluate(`(() => {
        const title = document.title || 'Untitled';
        const url = window.location.href;
        const activeEl = document.activeElement ? document.activeElement.tagName.toLowerCase() : 'none';
        return 'URL: ' + url + ' | Title: ' + title + ' | Focus: ' + activeEl;
      })()`)) as string;

      return (state || 'Active Page').slice(0, this.maxContextLength);
    } catch {
      return 'State: Active Browser Page';
    }
  }
}
