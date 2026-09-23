import { BrowserManager } from './browser_manager.js';

export class BrowserTools {
  private browserManager: BrowserManager;

  constructor(browserManager?: BrowserManager) {
    this.browserManager = browserManager || new BrowserManager();
  }

  /**
   * Navigates active page to target URL
   */
  async navigatePage(url: string): Promise<{ success: boolean; url: string; title: string }> {
    const page = await this.browserManager.getActivePage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return {
      success: true,
      url: page.url(),
      title: await page.title(),
    };
  }

  /**
   * Clicks an element by selector or at coordinates (x, y)
   */
  async click(selector?: string, x?: number, y?: number): Promise<{ success: boolean; clicked: string }> {
    const page = await this.browserManager.getActivePage();

    if (selector) {
      await page.waitForSelector(selector, { visible: true, timeout: 5000 });
      await page.click(selector);
      return { success: true, clicked: selector };
    }

    if (x !== undefined && y !== undefined) {
      await page.mouse.click(x, y);
      return { success: true, clicked: `coordinates (${x}, ${y})` };
    }

    throw new Error('Must provide either a selector or (x, y) coordinates to click.');
  }

  /**
   * Types text into active element or specified selector
   */
  async typeText(selector: string | undefined, text: string): Promise<{ success: boolean; typed: string }> {
    const page = await this.browserManager.getActivePage();

    if (selector) {
      await page.waitForSelector(selector, { visible: true, timeout: 5000 });
      await page.click(selector);
      await page.type(selector, text, { delay: 10 });
    } else {
      await page.keyboard.type(text, { delay: 10 });
    }

    return { success: true, typed: text };
  }

  /**
   * Fills a form input directly
   */
  async fill(selector: string, value: string): Promise<{ success: boolean; selector: string; value: string }> {
    const page = await this.browserManager.getActivePage();
    await page.waitForSelector(selector, { visible: true, timeout: 5000 });
    await page.$eval(
      selector,
      (el, val) => {
        (el as HTMLInputElement).value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      value
    );
    return { success: true, selector, value };
  }

  /**
   * Hovers over an element
   */
  async hover(selector: string): Promise<{ success: boolean; hovered: string }> {
    const page = await this.browserManager.getActivePage();
    await page.waitForSelector(selector, { visible: true, timeout: 5000 });
    await page.hover(selector);
    return { success: true, hovered: selector };
  }

  /**
   * Presses a special keyboard key (e.g. Enter, Tab, Escape)
   */
  async pressKey(key: string): Promise<{ success: boolean; key: string }> {
    const page = await this.browserManager.getActivePage();
    await page.keyboard.press(key as any);
    return { success: true, key };
  }

  /**
   * Takes a screenshot in base64 format
   */
  async takeScreenshot(fullPage = false, selector?: string): Promise<{ success: boolean; base64: string }> {
    const page = await this.browserManager.getActivePage();

    let base64 = '';
    if (selector) {
      const element = await page.$(selector);
      if (!element) throw new Error(`Element not found for selector: ${selector}`);
      base64 = (await element.screenshot({ encoding: 'base64' })) as string;
    } else {
      base64 = (await page.screenshot({ fullPage, encoding: 'base64' })) as string;
    }

    return { success: true, base64 };
  }

  /**
   * Extracts clean structured text or DOM snapshot
   */
  async takeSnapshot(): Promise<string> {
    const page = await this.browserManager.getActivePage();
    const snapshot = await page.evaluate(() => {
      const title = document.title;
      const url = window.location.href;
      const bodyText = document.body ? document.body.innerText.slice(0, 4000) : '';
      return `URL: ${url}\nTitle: ${title}\n\n--- Page Text Content ---\n${bodyText}`;
    });
    return snapshot;
  }

  /**
   * Evaluates custom JavaScript script inside page context
   */
  async evaluateScript(script: string): Promise<{ success: boolean; result: any }> {
    const page = await this.browserManager.getActivePage();
    const result = await page.evaluate((code) => {
      return window.eval(code);
    }, script);
    return { success: true, result };
  }
}
