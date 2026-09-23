import type { Page } from 'puppeteer';
import { DomExtractor } from './dom_extractor.js';
import { JevEngine } from './jev_engine.js';
import {
  AutomationPlan,
  AutomationRunSummary,
  AutomationStep,
  GatingConfig,
  StepExecutionResult,
} from './types.js';

export class FastLoopController {
  private jevEngine: JevEngine;
  private domExtractor: DomExtractor;
  private config: GatingConfig;

  constructor(
    jevEngine?: JevEngine,
    domExtractor?: DomExtractor,
    config?: Partial<GatingConfig>
  ) {
    this.jevEngine = jevEngine || new JevEngine();
    this.domExtractor = domExtractor || new DomExtractor();
    this.config = {
      confidenceThreshold: 0.85,
      maxConsecutiveSteps: 20,
      microDelayMs: 20,
      stepTimeoutMs: 5000,
      visualFeedback: true,
      highlightDurationMs: 0,
      ...config,
    };
  }

  /**
   * Injects glowing green border and Floating HUD badge on the selected element
   */
  private async injectVisualHud(
    page: Page,
    selector: string,
    description: string,
    confidenceScore: number,
    latencyMs: number
  ): Promise<void> {
    try {
      await page.evaluate(
        (sel, desc, conf, lat) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el) {
            try {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch {}
            el.style.outline = '3px solid #00ff66';
            el.style.backgroundColor = 'rgba(0, 255, 102, 0.15)';
            el.style.boxShadow = '0 0 16px #00ff66';
            el.style.transition = 'all 0.2s ease';

            let hud = document.getElementById('jev-hud-badge');
            if (!hud) {
              hud = document.createElement('div');
              hud.id = 'jev-hud-badge';
              hud.style.position = 'fixed';
              hud.style.top = '16px';
              hud.style.right = '16px';
              hud.style.padding = '10px 16px';
              hud.style.background = 'rgba(15, 23, 42, 0.95)';
              hud.style.border = '2px solid #00ff66';
              hud.style.borderRadius = '8px';
              hud.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
              hud.style.zIndex = '999999';
              hud.style.color = '#ffffff';
              hud.style.fontFamily = 'system-ui, -apple-system, sans-serif';
              hud.style.fontSize = '12px';
              hud.style.pointerEvents = 'none';
              document.body.appendChild(hud);
            }

            hud.innerHTML = `
              <div style="font-weight: 700; margin-bottom: 2px;">⚡ <b>openJev-verdict-2.0</b> Decision</div>
              <div style="color: #94a3b8; font-size: 11px; margin-bottom: 4px;">Target: ${desc.slice(0, 35)}</div>
              <div>
                <span style="color: #00ff66; font-weight: bold;">Confidence: ${(conf * 100).toFixed(1)}%</span> | 
                <span style="color: #38bdf8;">Latency: ${lat.toFixed(1)}ms</span>
              </div>
            `;
          }
        },
        selector,
        description,
        confidenceScore,
        latencyMs
      );
    } catch {}
  }

  /**
   * Executes a single micro-step with Jev Fast-Loop decision and automated gating.
   */
  async executeStep(
    page: Page,
    step: AutomationStep,
    overrideThreshold?: number
  ): Promise<StepExecutionResult> {
    const stepStartTime = performance.now();
    const effectiveThreshold = overrideThreshold ?? this.config.confidenceThreshold;

    try {
      // 1. Extract interactive candidates and compact state from DOM
      const elements = await this.domExtractor.extractInteractiveElements(page);
      const candidates = this.domExtractor.toJevCandidates(elements);
      const stateContext = await this.domExtractor.extractCompactState(page);

      if (candidates.length === 0) {
        return {
          stepIndex: step.stepIndex,
          goal: step.goal,
          decision: {
            selectedCandidateId: '',
            selectedSelector: '',
            selectedDescription: '',
            distribution: {},
            topProbability: 0,
            confidenceScore: 0,
            latencyMs: performance.now() - stepStartTime,
            isConfident: false,
          },
          status: 'escalated',
          errorMessage: 'No interactive elements found on the current page.',
          executionDurationMs: performance.now() - stepStartTime,
        };
      }

      // 2. Jev Non-Autoregressive Decision (~20-25ms)
      const decision = await this.jevEngine.decide(
        {
          schemaType: 'Choice',
          goal: step.goal,
          candidates,
          stateContext,
        },
        effectiveThreshold
      );

      // 3. Automated Gating: Execute immediately if confident, otherwise Escalate
      if (decision.isConfident && decision.selectedSelector) {
        if (this.config.visualFeedback) {
          await this.injectVisualHud(
            page,
            decision.selectedSelector,
            decision.selectedDescription,
            decision.confidenceScore,
            decision.latencyMs
          );
          if (this.config.highlightDurationMs && this.config.highlightDurationMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.config.highlightDurationMs));
          }
        }

        if (step.actionType === 'click') {
          if (typeof page.waitForNavigation === 'function') {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 3000 }).catch(() => {}),
              page.click(decision.selectedSelector),
            ]);
          } else {
            await page.click(decision.selectedSelector);
          }
        } else if (step.actionType === 'type') {
          await page.type(decision.selectedSelector, step.inputValue || '');
        }

        // Micro delay before next action (e.g. 20ms)
        if (this.config.microDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.config.microDelayMs));
        }

        const duration = performance.now() - stepStartTime;
        return {
          stepIndex: step.stepIndex,
          goal: step.goal,
          decision,
          status: 'auto_executed',
          actionTaken: `${step.actionType} on selector "${decision.selectedSelector}"`,
          executionDurationMs: Math.round(duration * 100) / 100,
        };
      } else {
        // Low confidence: Escalate to System 2 (LLM Planner)
        const duration = performance.now() - stepStartTime;
        return {
          stepIndex: step.stepIndex,
          goal: step.goal,
          decision,
          status: 'escalated',
          errorMessage: `Confidence score (${decision.confidenceScore}) is below threshold (${effectiveThreshold}). Escalating to System 2.`,
          executionDurationMs: Math.round(duration * 100) / 100,
        };
      }
    } catch (error: any) {
      const duration = performance.now() - stepStartTime;
      return {
        stepIndex: step.stepIndex,
        goal: step.goal,
        decision: {
          selectedCandidateId: '',
          selectedSelector: '',
          selectedDescription: '',
          distribution: {},
          topProbability: 0,
          confidenceScore: 0,
          latencyMs: duration,
          isConfident: false,
        },
        status: 'failed',
        errorMessage: error?.message || 'Unknown execution error',
        executionDurationMs: Math.round(duration * 100) / 100,
      };
    }
  }

  /**
   * Executes a full multi-step automation plan at high speed
   */
  async runPlan(
    page: Page,
    plan: AutomationPlan,
    overrideThreshold?: number
  ): Promise<AutomationRunSummary> {
    const planStartTime = performance.now();
    const stepResults: StepExecutionResult[] = [];
    let successfulSteps = 0;
    let escalatedSteps = 0;
    let failedSteps = 0;

    if (plan.url) {
      await page.goto(plan.url, { waitUntil: 'domcontentloaded' });
    }

    for (const step of plan.steps) {
      const result = await this.executeStep(page, step, overrideThreshold);
      stepResults.push(result);

      if (result.status === 'auto_executed') {
        successfulSteps++;
      } else if (result.status === 'escalated') {
        escalatedSteps++;
        // Stop fast-loop when escalation occurs to yield control to System 2
        break;
      } else {
        failedSteps++;
        break;
      }
    }

    const totalDuration = performance.now() - planStartTime;
    const avgLatency =
      stepResults.length > 0
        ? stepResults.reduce((sum, r) => sum + r.executionDurationMs, 0) / stepResults.length
        : 0;

    return {
      planId: plan.planId,
      totalSteps: plan.steps.length,
      successfulSteps,
      escalatedSteps,
      failedSteps,
      totalExecutionTimeMs: Math.round(totalDuration * 100) / 100,
      averageStepLatencyMs: Math.round(avgLatency * 100) / 100,
      stepResults,
    };
  }
}
