import { test, describe } from 'node:test';
import assert from 'node:assert';
import { JevEngine } from '../src/jev_engine.js';
import { JevDecisionRequest } from '../src/types.js';

describe('Task 1: JevEngine Scaling with 15 Candidates (Hacker News case)', () => {
  test('should achieve confidence >= 0.85 when matching target AI article among 15 noise candidates', async () => {
    const engine = new JevEngine();

    const candidates = [
      { id: 'elem_1_a', description: 'Show HN: Simple SQLite backup tool in Rust', selector: 'tr#1 a', nliHypothesis: 'It is the link "Show HN: Simple SQLite backup tool in Rust" element' },
      { id: 'elem_2_a', description: 'PostgreSQL 17 Released', selector: 'tr#2 a', nliHypothesis: 'It is the link "PostgreSQL 17 Released" element' },
      { id: 'elem_3_a', description: 'Why we switched from React to HTMX', selector: 'tr#3 a', nliHypothesis: 'It is the link "Why we switched from React to HTMX" element' },
      { id: 'elem_4_a', description: 'Ask HN: Best ergonomic chair for remote work?', selector: 'tr#4 a', nliHypothesis: 'It is the link "Ask HN: Best ergonomic chair for remote work?" element' },
      { id: 'elem_5_a', description: 'Linux Kernel 6.12 features and changes', selector: 'tr#5 a', nliHypothesis: 'It is the link "Linux Kernel 6.12 features and changes" element' },
      { id: 'elem_6_a', description: 'Building a DIY Mechanical Keyboard from scratch', selector: 'tr#6 a', nliHypothesis: 'It is the link "Building a DIY Mechanical Keyboard from scratch" element' },
      { id: 'elem_7_a', description: 'CSS Grid vs Flexbox in 2026', selector: 'tr#7 a', nliHypothesis: 'It is the link "CSS Grid vs Flexbox in 2026" element' },
      { id: 'elem_8_a', description: 'How Wi-Fi 7 achieves 46 Gbps theoretical speed', selector: 'tr#8 a', nliHypothesis: 'It is the link "How Wi-Fi 7 achieves 46 Gbps theoretical speed" element' },
      { id: 'elem_9_a', description: 'NASA James Webb Telescope reveals ancient galaxy', selector: 'tr#9 a', nliHypothesis: 'It is the link "NASA James Webb Telescope reveals ancient galaxy" element' },
      { id: 'elem_10_a', description: 'A deep dive into Go runtime garbage collector', selector: 'tr#10 a', nliHypothesis: 'It is the link "A deep dive into Go runtime garbage collector" element' },
      // Target AI Article
      { id: 'elem_11_a', description: 'GPT-6 Sol and Luna AI Model weights released', selector: 'tr#11 a', nliHypothesis: 'It is the link "GPT-6 Sol and Luna AI Model weights released" element' },
      { id: 'elem_12_a', description: 'Vintage Computing: Apple II restoration log', selector: 'tr#12 a', nliHypothesis: 'It is the link "Vintage Computing: Apple II restoration log" element' },
      { id: 'elem_13_a', description: 'Understanding B-Tree indexing algorithms', selector: 'tr#13 a', nliHypothesis: 'It is the link "Understanding B-Tree indexing algorithms" element' },
      { id: 'elem_14_a', description: 'WebAssembly multi-threading support status', selector: 'tr#14 a', nliHypothesis: 'It is the link "WebAssembly multi-threading support status" element' },
      { id: 'elem_15_a', description: 'How we reduced AWS cloud bill by 40%', selector: 'tr#15 a', nliHypothesis: 'It is the link "How we reduced AWS cloud bill by 40%" element' },
    ];

    const request: JevDecisionRequest = {
      schemaType: 'Choice',
      goal: 'Click the first article link about AI, LLM, GPT, Machine Learning, or Artificial Intelligence',
      stateContext: 'URL: https://news.ycombinator.com | Title: Hacker News',
      candidates,
    };

    const result = await engine.decide(request);

    assert.strictEqual(result.selectedCandidateId, 'elem_11_a', 'Should select the GPT-6 AI article');
    assert.ok(
      result.confidenceScore >= 0.85,
      `Confidence score should be >= 0.85, got ${result.confidenceScore}`
    );
    assert.strictEqual(result.isConfident, true);
  });
});
