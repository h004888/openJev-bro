import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { JevEngine } from './jev_engine.js';
import { DomExtractor } from './dom_extractor.js';
import { FastLoopController } from './fast_loop_controller.js';
import { BrowserManager, BrowserManagerConfig } from './browser_manager.js';
import { BrowserTools } from './browser_tools.js';
import { AutomationPlan, JevCandidate, JevDecisionResult } from './types.js';

export function createJevMcpServer(config?: BrowserManagerConfig) {
  const browserManager = new BrowserManager(config);
  const browserTools = new BrowserTools(browserManager);
  const jevEngine = new JevEngine();
  const domExtractor = new DomExtractor();
  const fastLoopController = new FastLoopController(jevEngine, domExtractor);

  const server = new Server(
    {
      name: 'jev-chrome-devtools-mcp',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Helper handler for jev_rank_elements
  const handleRankElements = async (params: {
    goal: string;
    candidates: Array<{ id: string; description: string; selector: string; nliHypothesis?: string }>;
    stateContext?: string;
    confidenceThreshold?: number;
  }): Promise<JevDecisionResult> => {
    const formattedCandidates: JevCandidate[] = params.candidates.map((c) => ({
      id: c.id,
      description: c.description,
      selector: c.selector,
      nliHypothesis: c.nliHypothesis || `It is the "${c.description}" element`,
    }));

    return jevEngine.decide(
      {
        schemaType: 'Choice',
        goal: params.goal,
        candidates: formattedCandidates,
        stateContext: params.stateContext,
      },
      params.confidenceThreshold
    );
  };

  // Helper handler for jev_evaluate_action
  const handleEvaluateAction = async (params: {
    actionDescription: string;
    elementSelector: string;
    pageContext?: string;
    confidenceThreshold?: number;
  }): Promise<JevDecisionResult> => {
    return jevEngine.decide(
      {
        schemaType: 'Score',
        goal: params.actionDescription,
        candidates: [
          {
            id: 'cand_target',
            description: params.elementSelector,
            selector: params.elementSelector,
            nliHypothesis: `It is the action "${params.actionDescription}" on ${params.elementSelector}`,
          },
          {
            id: 'cand_fallback',
            description: 'Do not perform this action',
            selector: 'none',
            nliHypothesis: 'It is not the correct action to perform',
          },
        ],
        stateContext: params.pageContext,
      },
      params.confidenceThreshold
    );
  };

  // Helper handler for jev_fast_run
  const handleFastRun = async (params: {
    url?: string;
    planId?: string;
    macroGoal: string;
    steps: Array<{
      stepIndex: number;
      goal: string;
      actionType: 'click' | 'type' | 'select' | 'navigate' | 'wait' | 'assert';
      inputValue?: string;
    }>;
    confidenceThreshold?: number;
  }) => {
    const page = await browserManager.getActivePage();
    const plan: AutomationPlan = {
      planId: params.planId || `plan_${Date.now()}`,
      macroGoal: params.macroGoal,
      url: params.url,
      steps: params.steps,
    };

    return fastLoopController.runPlan(page, plan, params.confidenceThreshold);
  };

  const toolsList = [
    // --- BROWSER LIFECYCLE & TABS ---
    {
      name: 'navigate_page',
      description: 'Navigates the active browser tab to the given URL.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to.' },
        },
        required: ['url'],
      },
    },
    {
      name: 'new_page',
      description: 'Opens a new browser tab.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Optional URL to open immediately.' },
        },
      },
    },
    {
      name: 'list_pages',
      description: 'Lists all open browser tabs and identifies the active one.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'select_page',
      description: 'Switches the active tab by its index.',
      inputSchema: {
        type: 'object',
        properties: {
          index: { type: 'number', description: '0-based index of the tab to activate.' },
        },
        required: ['index'],
      },
    },
    {
      name: 'close_page',
      description: 'Closes a tab by index, or closes the current active tab.',
      inputSchema: {
        type: 'object',
        properties: {
          index: { type: 'number', description: 'Optional 0-based tab index to close.' },
        },
      },
    },

    // --- DOM & USER ACTIONS ---
    {
      name: 'click',
      description: 'Clicks an element matching the given CSS selector or at coordinates (x, y).',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element to click.' },
          x: { type: 'number', description: 'X coordinate (optional).' },
          y: { type: 'number', description: 'Y coordinate (optional).' },
        },
      },
    },
    {
      name: 'type_text',
      description: 'Types text into an element matching the selector or into the currently focused element.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text string to type.' },
          selector: { type: 'string', description: 'Optional CSS selector to target.' },
        },
        required: ['text'],
      },
    },
    {
      name: 'fill',
      description: 'Directly fills an input or textarea value without typing delays.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of input.' },
          value: { type: 'string', description: 'Value to assign.' },
        },
        required: ['selector', 'value'],
      },
    },
    {
      name: 'hover',
      description: 'Hovers the mouse pointer over the specified element.',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector to hover over.' },
        },
        required: ['selector'],
      },
    },
    {
      name: 'press_key',
      description: 'Presses a keyboard key (e.g. Enter, Tab, Escape, Backspace).',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Name of the key to press.' },
        },
        required: ['key'],
      },
    },

    // --- INSPECTION & SCREENSHOTS ---
    {
      name: 'take_screenshot',
      description: 'Captures a screenshot of the active page or a specific element in base64 format.',
      inputSchema: {
        type: 'object',
        properties: {
          fullPage: { type: 'boolean', description: 'Capture full scrollable page (default false).' },
          selector: { type: 'string', description: 'Optional CSS selector of element to screenshot.' },
        },
      },
    },
    {
      name: 'take_snapshot',
      description: 'Extracts a clean text and DOM snapshot of the current page for agent analysis.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'evaluate_script',
      description: 'Executes arbitrary JavaScript in the page context and returns the result.',
      inputSchema: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'JavaScript code string to evaluate.' },
        },
        required: ['script'],
      },
    },

    // --- JEV FAST-LOOP DECISION & AUTOMATION TOOLS ---
    {
      name: 'jev_rank_elements',
      description: 'High-speed (~20ms) semantic element ranking and decision engine powered by openJev-verdict-2.0.',
      inputSchema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'Target action goal or query.' },
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                description: { type: 'string' },
                selector: { type: 'string' },
              },
              required: ['id', 'description', 'selector'],
            },
            description: 'List of interactive candidate elements.',
          },
          stateContext: { type: 'string' },
          confidenceThreshold: { type: 'number' },
        },
        required: ['goal', 'candidates'],
      },
    },
    {
      name: 'jev_evaluate_action',
      description: 'Calibrated confidence evaluation for a proposed browser action before execution.',
      inputSchema: {
        type: 'object',
        properties: {
          actionDescription: { type: 'string' },
          elementSelector: { type: 'string' },
          pageContext: { type: 'string' },
          confidenceThreshold: { type: 'number' },
        },
        required: ['actionDescription', 'elementSelector'],
      },
    },
    {
      name: 'jev_fast_run',
      description: 'Executes a multi-step web automation plan at high speed (~30ms/action) directly on the active browser tab.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Optional URL to navigate to first.' },
          planId: { type: 'string', description: 'Optional identifier for the plan.' },
          macroGoal: { type: 'string', description: 'High-level goal description.' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                stepIndex: { type: 'number' },
                goal: { type: 'string' },
                actionType: { type: 'string', enum: ['click', 'type', 'select', 'navigate', 'wait', 'assert'] },
                inputValue: { type: 'string' },
              },
              required: ['stepIndex', 'goal', 'actionType'],
            },
          },
          confidenceThreshold: { type: 'number' },
        },
        required: ['macroGoal', 'steps'],
      },
    },
  ];

  // Tool execution dispatcher
  const handleToolCall = async (name: string, args: any): Promise<{ content: Array<{ type: string; text: string }> }> => {
    switch (name) {
      case 'navigate_page': {
        const parsed = z.object({ url: z.string() }).parse(args);
        const res = await browserTools.navigatePage(parsed.url);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'new_page': {
        const parsed = z.object({ url: z.string().optional() }).parse(args);
        const page = await browserManager.newPage(parsed.url);
        return { content: [{ type: 'text', text: `Opened new tab: ${page.url()}` }] };
      }
      case 'list_pages': {
        const list = await browserManager.listPages();
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
      }
      case 'select_page': {
        const parsed = z.object({ index: z.number() }).parse(args);
        const page = await browserManager.selectPage(parsed.index);
        return { content: [{ type: 'text', text: `Switched to tab ${parsed.index}: ${page.url()}` }] };
      }
      case 'close_page': {
        const parsed = z.object({ index: z.number().optional() }).parse(args);
        await browserManager.closePage(parsed.index);
        return { content: [{ type: 'text', text: `Closed tab ${parsed.index ?? 'active'}` }] };
      }
      case 'click': {
        const parsed = z.object({ selector: z.string().optional(), x: z.number().optional(), y: z.number().optional() }).parse(args);
        const res = await browserTools.click(parsed.selector, parsed.x, parsed.y);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'type_text': {
        const parsed = z.object({ text: z.string(), selector: z.string().optional() }).parse(args);
        const res = await browserTools.typeText(parsed.selector, parsed.text);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'fill': {
        const parsed = z.object({ selector: z.string(), value: z.string() }).parse(args);
        const res = await browserTools.fill(parsed.selector, parsed.value);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'hover': {
        const parsed = z.object({ selector: z.string() }).parse(args);
        const res = await browserTools.hover(parsed.selector);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'press_key': {
        const parsed = z.object({ key: z.string() }).parse(args);
        const res = await browserTools.pressKey(parsed.key);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'take_screenshot': {
        const parsed = z.object({ fullPage: z.boolean().optional(), selector: z.string().optional() }).parse(args);
        const res = await browserTools.takeScreenshot(parsed.fullPage, parsed.selector);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'take_snapshot': {
        const res = await browserTools.takeSnapshot();
        return { content: [{ type: 'text', text: res }] };
      }
      case 'evaluate_script': {
        const parsed = z.object({ script: z.string() }).parse(args);
        const res = await browserTools.evaluateScript(parsed.script);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'jev_rank_elements': {
        const parsed = z
          .object({
            goal: z.string(),
            candidates: z.array(z.object({ id: z.string(), description: z.string(), selector: z.string() })),
            stateContext: z.string().optional(),
            confidenceThreshold: z.number().optional(),
          })
          .parse(args);
        const res = await handleRankElements(parsed);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'jev_evaluate_action': {
        const parsed = z
          .object({
            actionDescription: z.string(),
            elementSelector: z.string(),
            pageContext: z.string().optional(),
            confidenceThreshold: z.number().optional(),
          })
          .parse(args);
        const res = await handleEvaluateAction(parsed);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      case 'jev_fast_run': {
        const parsed = z
          .object({
            url: z.string().optional(),
            planId: z.string().optional(),
            macroGoal: z.string(),
            steps: z.array(
              z.object({
                stepIndex: z.number(),
                goal: z.string(),
                actionType: z.enum(['click', 'type', 'select', 'navigate', 'wait', 'assert']),
                inputValue: z.string().optional(),
              })
            ),
            confidenceThreshold: z.number().optional(),
          })
          .parse(args);
        const res = await handleFastRun(parsed);
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }
      default:
        throw new Error(`Unknown tool name: ${name}`);
    }
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolsList,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(request.params.name, request.params.arguments);
  });

  return {
    server,
    browserManager,
    browserTools,
    jevEngine,
    domExtractor,
    fastLoopController,
    handleRankElements,
    handleEvaluateAction,
    handleFastRun,
    handleToolCall,
    getRegisteredToolNames: () => toolsList.map((t) => t.name),
  };
}

export function parseCliArgs(argv: string[]): BrowserManagerConfig {
  const config: BrowserManagerConfig = {};

  for (const arg of argv) {
    if (arg === '--headless=false' || arg === '--no-headless') {
      config.headless = false;
    } else if (arg === '--headless=true' || arg === '--headless') {
      config.headless = true;
    } else if (arg.startsWith('--chrome-path=')) {
      config.executablePath = arg.substring('--chrome-path='.length);
    } else if (arg.startsWith('--stealth=')) {
      config.stealth = arg.substring('--stealth='.length) === 'true';
    } else if (arg.startsWith('--user-data-dir=')) {
      config.userDataDir = arg.substring('--user-data-dir='.length);
    }
  }

  return config;
}

// Auto-run if executed directly as script
if (process.argv[1]?.endsWith('mcp_server.js') || process.argv[1]?.endsWith('mcp_server.ts')) {
  const cliConfig = parseCliArgs(process.argv.slice(2));
  const { server } = createJevMcpServer(cliConfig);
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error('Fatal Unified MCP Server Error:', err);
    process.exit(1);
  });
}
