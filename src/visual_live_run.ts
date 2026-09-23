import { BrowserManager } from './browser_manager.js';
import { DomExtractor } from './dom_extractor.js';
import { JevEngine } from './jev_engine.js';
import { FastLoopController } from './fast_loop_controller.js';

async function runLiveVisualDemo() {
  console.log(`\n========================================================================`);
  console.log(` 🚀 openJev-verdict-2.0 LIVE DESKTOP VISUAL AUTOMATION DEMO`);
  console.log(`========================================================================\n`);

  console.log(`[1/5] 🌐 Launching Real Google Chrome (Headful Mode with Persisted Profile)...`);
  const browserManager = new BrowserManager({
    headless: false,
    stealth: true,
  });

  const jevEngine = new JevEngine();
  const domExtractor = new DomExtractor();
  const controller = new FastLoopController(jevEngine, domExtractor, {
    visualFeedback: true,
    highlightDurationMs: 1200, // Show green highlight for 1.2s before clicking
  });

  try {
    const page = await browserManager.getActivePage();
    console.log(`[2/5] 📄 Navigating to Hacker News (https://news.ycombinator.com)...`);
    await page.goto('https://news.ycombinator.com', { waitUntil: 'domcontentloaded' });

    console.log(`[3/5] 🧠 openJev-verdict-2.0 analyzing DOM candidates & extracting state...`);
    const startTime = performance.now();

    const plan = {
      planId: `live_run_${Date.now()}`,
      macroGoal: 'Navigate to Hacker News, find the first article about AI, and click to view it',
      steps: [
        {
          stepIndex: 1,
          goal: 'Click the first article link about AI, LLM, GPT, Machine Learning, or Artificial Intelligence',
          actionType: 'click' as const,
        },
      ],
    };

    console.log(`[4/5] ⚡ Executing Fast-Loop Step with Visual HUD & Element Highlight...`);
    const summary = await controller.runPlan(page, plan, 0.5);

    const totalDuration = performance.now() - startTime;
    console.log(`\n------------------------------------------------------------------------`);
    console.log(` 🎯 EXECUTION SUMMARY:`);
    console.log(`------------------------------------------------------------------------`);
    console.log(` - Total Steps Executed : ${summary.totalSteps}`);
    console.log(` - Successful Steps     : ${summary.successfulSteps}`);
    console.log(` - Escalated Steps      : ${summary.escalatedSteps}`);
    console.log(` - Average Step Latency : ${summary.averageStepLatencyMs.toFixed(2)} ms`);
    console.log(` - Total Duration       : ${totalDuration.toFixed(2)} ms`);
    console.log(` - Current Page URL     : ${page.url()}`);
    console.log(` - Current Page Title   : ${await page.title()}`);
    console.log(`------------------------------------------------------------------------\n`);

    console.log(`[5/5] 📸 Capturing final screenshot of the live browser window...`);
    const screenshotBuffer = await page.screenshot({ fullPage: false });
    console.log(`      ✅ Screenshot captured successfully (${screenshotBuffer.length} bytes)!`);
    console.log(`\n✨ Demo completed! Leaving Chrome open for 5 seconds for observation...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    console.error('❌ Error during live demo:', error);
  } finally {
    await browserManager.closeBrowser();
    console.log(`\n🔒 Chrome browser session closed cleanly.\n`);
  }
}

runLiveVisualDemo();
