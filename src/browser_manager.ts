import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BrowserManagerConfig {
  headless?: boolean;
  defaultViewport?: { width: number; height: number } | null;
  args?: string[];
  executablePath?: string;
  stealth?: boolean;
  userDataDir?: string;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private activePageIndex = 0;
  private config: BrowserManagerConfig;

  constructor(config?: BrowserManagerConfig) {
    // Determine headless mode: Default to false (HEADFUL) unless explicitly set to true
    let headless = false;
    if (config?.headless !== undefined) {
      headless = config.headless;
    } else if (process.env.HEADLESS !== undefined) {
      headless = process.env.HEADLESS === 'true' || process.env.HEADLESS === '1';
    } else if (process.env.CHROME_HEADLESS !== undefined) {
      headless = process.env.CHROME_HEADLESS === 'true' || process.env.CHROME_HEADLESS === '1';
    }

    const stealth = config?.stealth ?? true;
    const defaultArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,800',
    ];

    if (stealth) {
      defaultArgs.push('--disable-blink-features=AutomationControlled');
    }

    if (config?.args) {
      for (const arg of config.args) {
        if (!defaultArgs.includes(arg)) {
          defaultArgs.push(arg);
        }
      }
    }

    // Auto-detect Chrome executable path on Windows or from env
    const executablePath =
      config?.executablePath ||
      process.env.CHROME_PATH ||
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      BrowserManager.findSystemChromeExecutable();

    // Default persisted profile to ~/.jev-chrome-profile (or isolated dir during automated tests)
    const isTestEnv = !!process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === 'test';
    let defaultUserDataDir: string;
    if (config?.userDataDir) {
      defaultUserDataDir = config.userDataDir;
    } else if (isTestEnv) {
      defaultUserDataDir = path.join(
        os.tmpdir(),
        `jev-profile-test-${process.pid}-${Math.random().toString(36).substring(2, 7)}`
      );
    } else {
      defaultUserDataDir = path.join(os.homedir(), '.jev-chrome-profile');
    }
    const userDataDir = defaultUserDataDir;
    try {
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
    } catch {}

    this.config = {
      ...config,
      headless,
      defaultViewport: config?.defaultViewport !== undefined ? config.defaultViewport : (headless ? { width: 1280, height: 800 } : null),
      args: defaultArgs,
      executablePath,
      stealth,
      userDataDir,
    };

    // Auto-cleanup on process exit
    const cleanup = async () => {
      await this.closeBrowser();
    };
    process.once('exit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  /**
   * Searches common Windows and OS locations for Google Chrome binary
   */
  static findSystemChromeExecutable(): string | undefined {
    if (process.platform === 'win32') {
      const candidates = [
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ];
      for (const p of candidates) {
        if (p && fs.existsSync(p)) {
          return p;
        }
      }
    } else if (process.platform === 'darwin') {
      const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      if (fs.existsSync(macPath)) return macPath;
    } else if (process.platform === 'linux') {
      const linuxPaths = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser'];
      for (const p of linuxPaths) {
        if (fs.existsSync(p)) return p;
      }
    }
    return undefined;
  }

  /**
   * Applies stealth scripts and realistic settings to a page
   */
  private async setupPageStealth(page: Page): Promise<void> {
    if (this.config.stealth) {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
      );
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        (window as any).chrome = (window as any).chrome || {
          runtime: {},
          loadTimes: function () {},
          csi: function () {},
          app: {},
        };
        // Mock languages and plugins
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });
    }
  }

  /**
   * Lazily launches or returns the shared browser instance.
   */
  async getOrLaunchBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      const launchOptions: any = {
        headless: this.config.headless,
        defaultViewport: this.config.defaultViewport,
        args: this.config.args,
      };

      if (this.config.executablePath && fs.existsSync(this.config.executablePath)) {
        launchOptions.executablePath = this.config.executablePath;
      }

      if (this.config.userDataDir) {
        launchOptions.userDataDir = this.config.userDataDir;
      }

      this.browser = await puppeteer.launch(launchOptions);
      this.activePageIndex = 0;
    }
    return this.browser;
  }

  /**
   * Returns the currently active page/tab.
   */
  async getActivePage(): Promise<Page> {
    const browser = await this.getOrLaunchBrowser();
    const pages = await browser.pages();

    let page: Page;
    if (pages.length === 0) {
      page = await browser.newPage();
      this.activePageIndex = 0;
    } else {
      if (this.activePageIndex >= pages.length) {
        this.activePageIndex = pages.length - 1;
      }
      page = pages[this.activePageIndex];
    }

    await this.setupPageStealth(page);
    return page;
  }

  /**
   * Opens a new page/tab and sets it as active.
   */
  async newPage(url?: string): Promise<Page> {
    const browser = await this.getOrLaunchBrowser();
    const page = await browser.newPage();
    await this.setupPageStealth(page);

    const pages = await browser.pages();
    this.activePageIndex = pages.length - 1;

    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    return page;
  }

  /**
   * Lists all open pages with their URLs and titles.
   */
  async listPages(): Promise<Array<{ index: number; url: string; title: string; isActive: boolean }>> {
    const browser = await this.getOrLaunchBrowser();
    const pages = await browser.pages();

    const results = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      let url = 'about:blank';
      let title = 'Untitled';
      try {
        url = p.url();
        title = await p.title();
      } catch {}
      results.push({
        index: i,
        url,
        title,
        isActive: i === this.activePageIndex,
      });
    }

    return results;
  }

  /**
   * Selects an active page by index.
   */
  async selectPage(index: number): Promise<Page> {
    const browser = await this.getOrLaunchBrowser();
    const pages = await browser.pages();

    if (index < 0 || index >= pages.length) {
      throw new Error(`Invalid page index ${index}. Total open pages: ${pages.length}`);
    }

    this.activePageIndex = index;
    await pages[index].bringToFront();
    return pages[index];
  }

  /**
   * Closes a page by index or the active page.
   */
  async closePage(index?: number): Promise<void> {
    const browser = await this.getOrLaunchBrowser();
    const pages = await browser.pages();

    const targetIdx = index ?? this.activePageIndex;
    if (pages[targetIdx]) {
      await pages[targetIdx].close();
      const remainingPages = await browser.pages();
      this.activePageIndex = Math.max(0, Math.min(this.activePageIndex, remainingPages.length - 1));
    }
  }

  /**
   * Closes the entire browser session.
   */
  async closeBrowser(): Promise<void> {
    if (this.browser && this.browser.connected) {
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
    }
  }
}
