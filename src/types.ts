/**
 * Core Type Definitions for openJev-verdict-2.0 & Chrome DevTools Fast-Loop Automation
 */

export type JevSchemaType = 'Choice' | 'Score' | 'Noun';

export interface InteractiveElement {
  id: string;
  tagName: string;
  role?: string;
  type?: string;
  text: string;
  ariaLabel?: string;
  name?: string;
  value?: string;
  placeholder?: string;
  href?: string;
  selector: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
  isEnabled: boolean;
  /** NLI formatted description for Jev: "It is {description}" */
  nliDescription: string;
}

export interface JevCandidate {
  id: string;
  description: string;
  selector: string;
  nliHypothesis: string;
}

export interface JevDecisionRequest {
  schemaType: JevSchemaType;
  goal: string;
  stateContext?: string;
  candidates: JevCandidate[];
}

export interface JevDecisionResult {
  selectedCandidateId: string;
  selectedSelector: string;
  selectedDescription: string;
  /** Channel 1 (Distribution Head): Soft probabilities across all candidates */
  distribution: Record<string, number>;
  topProbability: number;
  /** Channel 2 (Confidence Head): Calibrated probability of correctness (ECE 1.44%) */
  confidenceScore: number;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Whether the confidence exceeds gating threshold */
  isConfident: boolean;
}

export interface GatingConfig {
  /** Minimum confidence score required to auto-execute (e.g. 0.85) */
  confidenceThreshold: number;
  /** Maximum number of automated steps before requiring a sync check */
  maxConsecutiveSteps: number;
  /** Delay between micro-actions in ms (for high-speed automation, e.g. 20ms) */
  microDelayMs: number;
  /** Timeout per step in ms */
  stepTimeoutMs: number;
  /** Whether to inject visible HUD badge and element highlight on screen */
  visualFeedback?: boolean;
  /** Duration in ms to display element highlight before clicking (e.g. 300ms) */
  highlightDurationMs?: number;
}

export interface AutomationStep {
  stepIndex: number;
  goal: string;
  actionType: 'click' | 'type' | 'select' | 'navigate' | 'wait' | 'assert';
  inputValue?: string;
  expectedOutcome?: string;
}

export interface AutomationPlan {
  planId: string;
  macroGoal: string;
  url?: string;
  steps: AutomationStep[];
}

export interface StepExecutionResult {
  stepIndex: number;
  goal: string;
  decision: JevDecisionResult;
  status: 'auto_executed' | 'escalated' | 'failed';
  actionTaken?: string;
  executionDurationMs: number;
  errorMessage?: string;
}

export interface AutomationRunSummary {
  planId: string;
  totalSteps: number;
  successfulSteps: number;
  escalatedSteps: number;
  failedSteps: number;
  totalExecutionTimeMs: number;
  averageStepLatencyMs: number;
  stepResults: StepExecutionResult[];
}
