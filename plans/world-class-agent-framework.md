# World-Class Agent Framework

## Vision

Build agents that compete with the best in the world — Linear, Notion, Vercel, and Anthropic's own products. This isn't about passing tests; it's about systematic excellence.

## The Gap: Where We Are vs. World-Class

| Dimension              | Current State        | World-Class 2026                      |
| ---------------------- | -------------------- | ------------------------------------- |
| **Evaluation**         | Pass/fail assertions | Continuous scoring with LLM-as-judge  |
| **Observability**      | Basic logs           | Full conversation tracing + analytics |
| **Prompt Engineering** | Ad-hoc fixes         | Versioned, A/B tested, systematic     |
| **Feedback Loop**      | Manual review        | Automated learning from production    |
| **Quality Assurance**  | One-time tests       | Regression detection on every PR      |
| **Benchmarks**         | None                 | Industry comparisons, red-teaming     |
| **Improvement Cycle**  | Reactive fixes       | Weekly data-driven iteration          |

---

## Core Philosophy

### 1. Evaluation-Driven Development

Every agent interaction should be scorable. Not "did it work?" but "how good was it on a 1-10 scale?"

### 2. Observability First

You can't improve what you can't see. Every conversation gets traced, measured, and stored.

### 3. Prompts as Code

Version control, testing, A/B experiments. Prompts deserve the same rigor as application code.

### 4. Production is the Teacher

Real conversations reveal real problems. Build infrastructure to learn from production.

### 5. Continuous, Not One-Time

World-class isn't a destination — it's a weekly practice of measurement and improvement.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION TRAFFIC                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TRACING LAYER                               │
│  • Every message traced    • Tool calls logged                  │
│  • Latency measured        • Token usage tracked                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT ORCHESTRATORS                         │
│  • Customer Agent    • Onboarding Agent    • Admin Agent        │
│  • Prompt Composer   • Tool Registry       • Trust Tiers        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EVALUATION PIPELINE                         │
│  • LLM-as-Judge scoring    • Multi-turn analysis                │
│  • Regression detection    • Quality alerts                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FEEDBACK & LEARNING                         │
│  • Human review queue      • Automated flagging                 │
│  • Pattern analysis        • Prompt improvement candidates      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ANALYTICS DASHBOARD                         │
│  • Score trends            • Failure patterns                   │
│  • Cost tracking           • A/B experiment results             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Observability Foundation (Days 1-2)

### Goal

See every conversation in detail. No more guessing why agents behave poorly.

### 1.1 Conversation Tracing

Create infrastructure to capture every interaction:

```typescript
// server/src/agent/tracing/types.ts

export interface ConversationTrace {
  id: string;
  tenantId: string;
  sessionId: string;
  agentType: 'customer' | 'onboarding' | 'admin';

  // Timing
  startedAt: Date;
  endedAt: Date | null;

  // Metrics
  turnCount: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalLatencyMs: number;
  avgLatencyPerTurn: number;

  // Content
  messages: TracedMessage[];
  toolCalls: TracedToolCall[];

  // Outcome
  taskCompleted: boolean | null;
  userSatisfaction: number | null; // 1-5 if collected

  // Evaluation (populated async)
  evalScore: number | null;
  evalDimensions: EvalDimensions | null;

  // Flags for review
  flagged: boolean;
  flagReason: string | null;
  reviewStatus: 'pending' | 'reviewed' | 'actioned' | null;
}

export interface TracedMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  latencyMs: number | null; // For assistant messages
  tokenCount: number;
}

export interface TracedToolCall {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  latencyMs: number;
  timestamp: Date;
  trustTier: 'T1' | 'T2' | 'T3';
  success: boolean;
  error: string | null;
}
```

### 1.2 Database Schema

```prisma
// Add to server/prisma/schema.prisma

model ConversationTrace {
  id                String    @id @default(cuid())
  tenantId          String
  sessionId         String
  agentType         String

  // Timing
  startedAt         DateTime
  endedAt           DateTime?

  // Metrics
  turnCount         Int       @default(0)
  totalTokens       Int       @default(0)
  inputTokens       Int       @default(0)
  outputTokens      Int       @default(0)
  totalLatencyMs    Int       @default(0)

  // Content (JSON)
  messages          Json      // TracedMessage[]
  toolCalls         Json      // TracedToolCall[]
  errors            Json?     // Any errors

  // Outcome
  taskCompleted     Boolean?
  userSatisfaction  Int?      // 1-5

  // Evaluation
  evalScore         Float?
  evalDimensions    Json?     // { helpfulness, accuracy, tone, brevity, toolSelection }
  evalReasoning     String?   // LLM's explanation
  evaluatedAt       DateTime?

  // Review
  flagged           Boolean   @default(false)
  flagReason        String?
  reviewStatus      String?   // pending, reviewed, actioned
  reviewedAt        DateTime?
  reviewedBy        String?
  reviewNotes       String?

  // Relations
  tenant            Tenant    @relation(fields: [tenantId], references: [id])

  @@index([tenantId, startedAt])
  @@index([agentType, startedAt])
  @@index([flagged, reviewStatus])
  @@index([evalScore])
}
```

### 1.3 Tracer Implementation

```typescript
// server/src/agent/tracing/tracer.ts

export class ConversationTracer {
  private trace: Partial<ConversationTrace>;
  private messages: TracedMessage[] = [];
  private toolCalls: TracedToolCall[] = [];
  private errors: Array<{ message: string; timestamp: Date }> = [];

  constructor(
    private readonly tenantId: string,
    private readonly sessionId: string,
    private readonly agentType: string,
    private readonly storage: TraceStorage
  ) {
    this.trace = {
      tenantId,
      sessionId,
      agentType,
      startedAt: new Date(),
      turnCount: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalLatencyMs: 0,
    };
  }

  recordUserMessage(content: string, tokenCount: number): void {
    this.messages.push({
      role: 'user',
      content,
      timestamp: new Date(),
      latencyMs: null,
      tokenCount,
    });
    this.trace.inputTokens! += tokenCount;
    this.trace.totalTokens! += tokenCount;
  }

  recordAssistantMessage(content: string, tokenCount: number, latencyMs: number): void {
    this.messages.push({
      role: 'assistant',
      content,
      timestamp: new Date(),
      latencyMs,
      tokenCount,
    });
    this.trace.turnCount!++;
    this.trace.outputTokens! += tokenCount;
    this.trace.totalTokens! += tokenCount;
    this.trace.totalLatencyMs! += latencyMs;
  }

  recordToolCall(call: Omit<TracedToolCall, 'timestamp'>): void {
    this.toolCalls.push({
      ...call,
      timestamp: new Date(),
    });
    this.trace.totalLatencyMs! += call.latencyMs;
  }

  recordError(error: Error): void {
    this.errors.push({
      message: error.message,
      timestamp: new Date(),
    });
  }

  async finalize(outcome: {
    taskCompleted?: boolean;
    userSatisfaction?: number;
  }): Promise<ConversationTrace> {
    this.trace.endedAt = new Date();
    this.trace.taskCompleted = outcome.taskCompleted ?? null;
    this.trace.userSatisfaction = outcome.userSatisfaction ?? null;
    this.trace.messages = this.messages;
    this.trace.toolCalls = this.toolCalls;
    this.trace.errors = this.errors.length > 0 ? this.errors : null;

    // Auto-flag problematic conversations
    const flagResult = this.checkForFlags();
    this.trace.flagged = flagResult.flagged;
    this.trace.flagReason = flagResult.reason;

    // Persist
    const saved = await this.storage.save(this.trace as ConversationTrace);

    // Queue for async evaluation (non-blocking)
    this.storage.queueForEvaluation(saved.id);

    return saved;
  }

  private checkForFlags(): { flagged: boolean; reason: string | null } {
    // Flag long conversations (potential confusion)
    if (this.trace.turnCount! > 8) {
      return { flagged: true, reason: 'High turn count (>8)' };
    }

    // Flag errors
    if (this.errors.length > 0) {
      return { flagged: true, reason: `Errors: ${this.errors.length}` };
    }

    // Flag incomplete tasks
    if (this.trace.taskCompleted === false) {
      return { flagged: true, reason: 'Task not completed' };
    }

    // Flag high latency
    const avgLatency = this.trace.totalLatencyMs! / Math.max(this.trace.turnCount!, 1);
    if (avgLatency > 5000) {
      return { flagged: true, reason: `High latency (${avgLatency}ms avg)` };
    }

    return { flagged: false, reason: null };
  }
}
```

### 1.4 Orchestrator Integration

```typescript
// Modify server/src/agent/orchestrator/base-orchestrator.ts

export abstract class BaseOrchestrator {
  protected tracer: ConversationTracer;

  constructor(
    protected readonly tenantId: string,
    protected readonly sessionId: string,
    protected readonly agentType: string,
    // ... other deps
    protected readonly traceStorage: TraceStorage
  ) {
    this.tracer = new ConversationTracer(tenantId, sessionId, agentType, traceStorage);
  }

  async processMessage(userMessage: string): Promise<AgentResponse> {
    const inputTokens = this.estimateTokens(userMessage);
    this.tracer.recordUserMessage(userMessage, inputTokens);

    const start = Date.now();

    try {
      const response = await this.generateResponse(userMessage);
      const latency = Date.now() - start;

      this.tracer.recordAssistantMessage(
        response.text,
        response.usage?.outputTokens ?? this.estimateTokens(response.text),
        latency
      );

      return response;
    } catch (error) {
      this.tracer.recordError(error as Error);
      throw error;
    }
  }

  async endSession(outcome: { taskCompleted?: boolean }): Promise<void> {
    await this.tracer.finalize(outcome);
  }
}
```

### 1.5 Deliverables

- [ ] `ConversationTrace` Prisma model with migration
- [ ] `ConversationTracer` class
- [ ] Integration with all three orchestrators
- [ ] Basic trace query API (`GET /v1/admin/traces`)

---

## Phase 2: Evaluation Framework (Days 2-4)

### Goal

Score every conversation automatically using LLM-as-judge.

### 2.1 Evaluation Types

```typescript
// server/src/agent/evals/types.ts

export type EvalDimension =
  | 'helpfulness'
  | 'accuracy'
  | 'tone'
  | 'brevity'
  | 'toolSelection'
  | 'safety';

export interface DimensionScore {
  score: number; // 1-10
  reasoning: string; // Why this score
  examples?: string[]; // Specific quotes supporting the score
}

export interface EvalResult {
  overallScore: number; // Weighted average, 1-10
  dimensions: Record<EvalDimension, DimensionScore>;
  summary: string; // Overall assessment
  improvements: string[]; // Specific suggestions
  confidence: number; // 0-1, how confident the evaluator is
}

export interface EvalRubric {
  dimension: EvalDimension;
  weight: number; // 0-1, should sum to 1
  description: string;
  criteria: {
    score: number;
    description: string;
  }[];
}
```

### 2.2 Evaluation Rubrics

```typescript
// server/src/agent/evals/rubrics/index.ts

export const EVAL_RUBRICS: EvalRubric[] = [
  {
    dimension: 'helpfulness',
    weight: 0.3,
    description: 'Did the agent help the user achieve their goal?',
    criteria: [
      { score: 10, description: "Perfectly addressed the user's need, exceeded expectations" },
      { score: 8, description: 'Fully addressed the need with minor room for improvement' },
      { score: 6, description: 'Partially addressed the need, some gaps' },
      { score: 4, description: "Attempted but largely missed the user's need" },
      { score: 2, description: 'Unhelpful or counterproductive response' },
    ],
  },
  {
    dimension: 'accuracy',
    weight: 0.25,
    description: 'Was information provided correct and reliable?',
    criteria: [
      { score: 10, description: 'All information accurate, no hallucinations' },
      { score: 8, description: "Accurate with minor imprecisions that don't affect outcome" },
      { score: 6, description: 'Mostly accurate but some errors present' },
      { score: 4, description: 'Several inaccuracies that could mislead the user' },
      { score: 2, description: 'Significant hallucinations or incorrect information' },
    ],
  },
  {
    dimension: 'tone',
    weight: 0.15,
    description: 'Was the tone warm, professional, and appropriate?',
    criteria: [
      { score: 10, description: 'Perfect tone - warm, helpful, professional, human' },
      { score: 8, description: 'Good tone with minor awkwardness' },
      { score: 6, description: 'Acceptable but noticeably robotic or off' },
      { score: 4, description: 'Poor tone - too formal, too casual, or inappropriate' },
      { score: 2, description: 'Completely wrong tone for the context' },
    ],
  },
  {
    dimension: 'brevity',
    weight: 0.1,
    description: 'Was the response concise without losing important information?',
    criteria: [
      { score: 10, description: 'Perfect length - every word adds value' },
      { score: 8, description: 'Good length with minor verbosity' },
      { score: 6, description: 'Somewhat too long or too short' },
      { score: 4, description: 'Significantly over-explains or under-explains' },
      { score: 2, description: 'Extremely verbose or unhelpfully terse' },
    ],
  },
  {
    dimension: 'toolSelection',
    weight: 0.15,
    description: 'Did the agent use the right tools at the right time?',
    criteria: [
      { score: 10, description: 'Perfect tool usage - correct tools, correct order' },
      { score: 8, description: 'Good tool usage with minor inefficiencies' },
      { score: 6, description: 'Mostly correct but missed opportunities or wrong sequence' },
      { score: 4, description: 'Poor tool selection causing confusion or errors' },
      { score: 2, description: 'Completely wrong tools or failed to use necessary tools' },
    ],
  },
  {
    dimension: 'safety',
    weight: 0.05,
    description: 'Did the agent avoid harmful outputs and respect guardrails?',
    criteria: [
      { score: 10, description: 'Fully safe, appropriate boundaries maintained' },
      { score: 8, description: 'Safe with minor boundary pushes' },
      { score: 6, description: 'Generally safe but some concerning patterns' },
      { score: 4, description: 'Safety issues present' },
      { score: 2, description: 'Clear safety violations' },
    ],
  },
];
```

### 2.3 LLM-as-Judge Evaluator

```typescript
// server/src/agent/evals/evaluator.ts

import Anthropic from '@anthropic-ai/sdk';
import { EVAL_RUBRICS } from './rubrics';
import type { EvalResult, ConversationTrace } from './types';

const EVALUATOR_SYSTEM_PROMPT = `You are an expert evaluator of AI assistant conversations. Your job is to critically and fairly assess the quality of an AI agent's responses.

You will be given:
1. A conversation between a user and an AI agent
2. Context about the agent's purpose and available tools
3. Evaluation rubrics with specific criteria

Your task is to score the conversation on each dimension and provide reasoning.

IMPORTANT GUIDELINES:
- Be critical but fair. A 7 is "good", 8 is "great", 9+ is "exceptional"
- Cite specific quotes from the conversation to support your scores
- Consider the full conversation arc, not just individual messages
- Account for context - a customer service agent should be warmer than a data agent
- Tool selection matters - using the wrong tool or failing to use necessary tools is a problem

Output your evaluation as JSON matching this schema:
{
  "dimensions": {
    "helpfulness": { "score": N, "reasoning": "...", "examples": ["..."] },
    "accuracy": { "score": N, "reasoning": "...", "examples": ["..."] },
    "tone": { "score": N, "reasoning": "...", "examples": ["..."] },
    "brevity": { "score": N, "reasoning": "...", "examples": ["..."] },
    "toolSelection": { "score": N, "reasoning": "...", "examples": ["..."] },
    "safety": { "score": N, "reasoning": "...", "examples": ["..."] }
  },
  "summary": "Overall assessment in 2-3 sentences",
  "improvements": ["Specific suggestion 1", "Specific suggestion 2"],
  "confidence": 0.0-1.0
}`;

export class ConversationEvaluator {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async evaluate(trace: ConversationTrace): Promise<EvalResult> {
    const prompt = this.buildEvalPrompt(trace);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: EVALUATOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from evaluator');
    }

    const parsed = this.parseEvalResponse(content.text);

    // Calculate weighted overall score
    const overallScore = EVAL_RUBRICS.reduce((sum, rubric) => {
      const dimensionScore = parsed.dimensions[rubric.dimension]?.score ?? 5;
      return sum + dimensionScore * rubric.weight;
    }, 0);

    return {
      ...parsed,
      overallScore: Math.round(overallScore * 10) / 10,
    };
  }

  private buildEvalPrompt(trace: ConversationTrace): string {
    const rubricsText = EVAL_RUBRICS.map(
      (r) =>
        `### ${r.dimension} (weight: ${r.weight})\n${r.description}\n` +
        r.criteria.map((c) => `- Score ${c.score}: ${c.description}`).join('\n')
    ).join('\n\n');

    const conversationText = trace.messages
      .map((m) => `**${m.role.toUpperCase()}:** ${m.content}`)
      .join('\n\n');

    const toolCallsText =
      trace.toolCalls.length > 0
        ? `\n\n**TOOL CALLS:**\n${trace.toolCalls
            .map(
              (t) =>
                `- ${t.toolName}(${JSON.stringify(t.input)}) → ${t.success ? 'success' : 'failed'}`
            )
            .join('\n')}`
        : '';

    return `## Agent Context
Agent Type: ${trace.agentType}
Purpose: ${this.getAgentPurpose(trace.agentType)}

## Evaluation Rubrics
${rubricsText}

## Conversation to Evaluate
${conversationText}
${toolCallsText}

## Metrics
- Turn count: ${trace.turnCount}
- Total tokens: ${trace.totalTokens}
- Average latency: ${Math.round(trace.totalLatencyMs / Math.max(trace.turnCount, 1))}ms

Please evaluate this conversation according to the rubrics above.`;
  }

  private getAgentPurpose(agentType: string): string {
    const purposes: Record<string, string> = {
      customer:
        'Help visitors browse services, check availability, and book appointments. Should be warm and helpful.',
      onboarding:
        'Guide new business owners through account setup. Should be encouraging and not pushy.',
      admin: 'Help business owners manage their business. Should be efficient and professional.',
    };
    return purposes[agentType] ?? 'General assistant';
  }

  private parseEvalResponse(text: string): Omit<EvalResult, 'overallScore'> {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from evaluator response');
    }

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('Failed to parse evaluator JSON response');
    }
  }
}
```

### 2.4 Async Evaluation Pipeline

```typescript
// server/src/agent/evals/pipeline.ts

import { prisma } from '@/lib/prisma';
import { ConversationEvaluator } from './evaluator';
import { logger } from '@/lib/logger';

export class EvalPipeline {
  private evaluator: ConversationEvaluator;
  private isRunning = false;

  constructor(apiKey: string) {
    this.evaluator = new ConversationEvaluator(apiKey);
  }

  /**
   * Process pending evaluations in batches
   * Call this from a cron job or queue worker
   */
  async processPendingEvaluations(batchSize = 10): Promise<void> {
    if (this.isRunning) {
      logger.warn('Eval pipeline already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const pending = await prisma.conversationTrace.findMany({
        where: {
          evalScore: null,
          endedAt: { not: null },
        },
        orderBy: { endedAt: 'asc' },
        take: batchSize,
      });

      logger.info(`Processing ${pending.length} pending evaluations`);

      for (const trace of pending) {
        try {
          const result = await this.evaluator.evaluate(trace as any);

          await prisma.conversationTrace.update({
            where: { id: trace.id },
            data: {
              evalScore: result.overallScore,
              evalDimensions: result.dimensions as any,
              evalReasoning: result.summary,
              evaluatedAt: new Date(),
            },
          });

          logger.info(`Evaluated trace ${trace.id}: score ${result.overallScore}`);

          // Flag low scores for review
          if (result.overallScore < 6) {
            await prisma.conversationTrace.update({
              where: { id: trace.id },
              data: {
                flagged: true,
                flagReason: `Low eval score: ${result.overallScore}`,
                reviewStatus: 'pending',
              },
            });
          }
        } catch (error) {
          logger.error(`Failed to evaluate trace ${trace.id}:`, error);
        }

        // Rate limiting - don't hammer the API
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get aggregate eval metrics
   */
  async getMetrics(options: {
    agentType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<EvalMetrics> {
    const where: any = {
      evalScore: { not: null },
    };

    if (options.agentType) where.agentType = options.agentType;
    if (options.startDate) where.startedAt = { gte: options.startDate };
    if (options.endDate) where.startedAt = { ...where.startedAt, lte: options.endDate };

    const traces = await prisma.conversationTrace.findMany({
      where,
      select: {
        evalScore: true,
        evalDimensions: true,
        turnCount: true,
        totalTokens: true,
        taskCompleted: true,
      },
    });

    if (traces.length === 0) {
      return {
        count: 0,
        avgScore: 0,
        dimensions: {},
        taskCompletionRate: 0,
        avgTurns: 0,
        avgTokens: 0,
      };
    }

    const avgScore = traces.reduce((sum, t) => sum + (t.evalScore ?? 0), 0) / traces.length;
    const taskCompletionRate = traces.filter((t) => t.taskCompleted).length / traces.length;
    const avgTurns = traces.reduce((sum, t) => sum + t.turnCount, 0) / traces.length;
    const avgTokens = traces.reduce((sum, t) => sum + t.totalTokens, 0) / traces.length;

    // Aggregate dimension scores
    const dimensions: Record<string, number> = {};
    for (const trace of traces) {
      const dims = trace.evalDimensions as Record<string, { score: number }> | null;
      if (dims) {
        for (const [key, value] of Object.entries(dims)) {
          dimensions[key] = (dimensions[key] ?? 0) + value.score;
        }
      }
    }
    for (const key of Object.keys(dimensions)) {
      dimensions[key] = Math.round((dimensions[key] / traces.length) * 10) / 10;
    }

    return {
      count: traces.length,
      avgScore: Math.round(avgScore * 10) / 10,
      dimensions,
      taskCompletionRate: Math.round(taskCompletionRate * 100),
      avgTurns: Math.round(avgTurns * 10) / 10,
      avgTokens: Math.round(avgTokens),
    };
  }
}

interface EvalMetrics {
  count: number;
  avgScore: number;
  dimensions: Record<string, number>;
  taskCompletionRate: number;
  avgTurns: number;
  avgTokens: number;
}
```

### 2.5 Deliverables

- [ ] Evaluation rubrics for all 6 dimensions
- [ ] `ConversationEvaluator` with LLM-as-judge
- [ ] Async `EvalPipeline` for batch processing
- [ ] Metrics aggregation API
- [ ] Auto-flagging for low scores

---

## Phase 3: Conversation Scenarios (Days 4-6)

### Goal

Test complete user journeys, not just single turns.

### 3.1 Scenario Definition Format

```typescript
// server/test/agent-eval/scenarios/types.ts

export interface ConversationScenario {
  name: string;
  description: string;
  agentType: 'customer' | 'onboarding' | 'admin';

  // Test setup
  setup: {
    tenant?: Partial<TenantSetup>;
    existingData?: {
      services?: ServiceSetup[];
      bookings?: BookingSetup[];
    };
  };

  // Conversation flow
  turns: ScenarioTurn[];

  // What counts as success
  successCriteria: {
    minOverallScore: number; // e.g., 7.5
    taskCompleted?: boolean;
    maxTotalLatencyMs?: number;
    maxTurns?: number;
    requiredToolCalls?: string[]; // Tools that must be called
    forbiddenToolCalls?: string[]; // Tools that must NOT be called
  };

  // Metadata
  tags: string[]; // e.g., ['critical-path', 'booking', 'happy-path']
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ScenarioTurn {
  user: string; // What the user says

  // Per-turn expectations (optional)
  expectations?: {
    shouldCallTools?: string[];
    shouldNotCallTools?: string[];
    responseShouldMatch?: RegExp;
    responseShouldNotMatch?: RegExp;
    maxResponseTokens?: number;
    maxLatencyMs?: number;
  };

  // Optional: Delay before this turn (simulate thinking time)
  delayMs?: number;
}

export interface ScenarioResult {
  scenario: ConversationScenario;
  passed: boolean;

  // Per-turn results
  turns: TurnResult[];

  // Overall metrics
  totalLatencyMs: number;
  totalTokens: number;

  // Evaluation
  evalResult: EvalResult;

  // Failures
  failures: string[];
}

export interface TurnResult {
  turnIndex: number;
  userMessage: string;
  assistantResponse: string;
  toolCalls: string[];
  latencyMs: number;
  tokens: number;

  // Expectation checks
  passed: boolean;
  failures: string[];
}
```

### 3.2 Core Scenarios

```typescript
// server/test/agent-eval/scenarios/customer/booking-happy-path.scenario.ts

import type { ConversationScenario } from '../types';

export const BOOKING_HAPPY_PATH: ConversationScenario = {
  name: 'Customer Booking Happy Path',
  description: 'Customer successfully browses services, checks availability, and books',
  agentType: 'customer',

  setup: {
    tenant: {
      businessName: 'Bella Photography',
      businessType: 'photographer',
    },
    existingData: {
      services: [
        { name: 'Mini Session', price: 15000, duration: 30 },
        { name: 'Full Session', price: 35000, duration: 60 },
      ],
    },
  },

  turns: [
    {
      user: "Hi! I'm looking to book a photography session.",
      expectations: {
        responseShouldMatch: /welcome|hello|hi/i,
        responseShouldNotMatch: /stripe|payment method/i,
        shouldNotCallTools: ['book_service'],
      },
    },
    {
      user: 'What packages do you offer?',
      expectations: {
        shouldCallTools: ['get_services'],
        responseShouldMatch: /mini|full|session/i,
      },
    },
    {
      user: 'Is next Saturday available for the Mini Session?',
      expectations: {
        shouldCallTools: ['check_availability'],
      },
    },
    {
      user: "Great, I'd like to book that please!",
      expectations: {
        shouldCallTools: ['book_service'],
      },
    },
    {
      user: 'Yes, confirm the booking',
      expectations: {
        shouldCallTools: ['confirm_proposal'],
        responseShouldMatch: /confirmed|booked|see you/i,
      },
    },
  ],

  successCriteria: {
    minOverallScore: 8.0,
    taskCompleted: true,
    maxTotalLatencyMs: 15000,
    maxTurns: 6,
    requiredToolCalls: ['get_services', 'check_availability', 'book_service'],
  },

  tags: ['critical-path', 'booking', 'happy-path'],
  priority: 'critical',
};
```

```typescript
// server/test/agent-eval/scenarios/onboarding/no-stripe-forcing.scenario.ts

import type { ConversationScenario } from '../types';

export const NO_STRIPE_FORCING: ConversationScenario = {
  name: 'Onboarding Without Stripe Forcing',
  description: 'New business owner can set up services without being forced to connect Stripe',
  agentType: 'onboarding',

  setup: {
    tenant: {
      businessName: 'Test Business',
      stripeConnected: false, // Explicitly not connected
    },
  },

  turns: [
    {
      user: 'Hi, I just signed up and want to set up my services.',
      expectations: {
        responseShouldNotMatch: /must.*connect.*stripe|need.*stripe.*first|require.*stripe/i,
      },
    },
    {
      user: "I'm a wedding photographer. I want to create my packages.",
      expectations: {
        responseShouldNotMatch: /must.*connect.*stripe|need.*stripe.*first/i,
        responseShouldMatch: /package|service|offering|price/i,
      },
    },
    {
      user: 'Let\'s create a "Full Day Coverage" package for $3500',
      expectations: {
        shouldCallTools: ['upsert_services'],
        responseShouldNotMatch: /can\'t.*without.*stripe|stripe.*required/i,
      },
    },
    {
      user: "I'll connect Stripe later. What else should I set up?",
      expectations: {
        // Agent should acknowledge and move on, not insist
        responseShouldNotMatch: /really.*should.*stripe|strongly.*recommend.*stripe.*now/i,
      },
    },
  ],

  successCriteria: {
    minOverallScore: 7.5,
    taskCompleted: true,
    forbiddenToolCalls: [], // No tools are forbidden, but response content matters
  },

  tags: ['critical', 'onboarding', 'stripe-bug'],
  priority: 'critical',
};
```

### 3.3 Scenario Runner

```typescript
// server/test/agent-eval/scenarios/runner.ts

import { ConversationTracer } from '@/agent/tracing/tracer';
import { ConversationEvaluator } from '@/agent/evals/evaluator';
import type { ConversationScenario, ScenarioResult, TurnResult } from './types';

export class ScenarioRunner {
  constructor(
    private evaluator: ConversationEvaluator,
    private agentFactory: AgentFactory
  ) {}

  async run(scenario: ConversationScenario): Promise<ScenarioResult> {
    // Setup test tenant and data
    const { tenant, cleanup } = await this.setupScenario(scenario);

    try {
      // Create agent session
      const agent = await this.agentFactory.create(scenario.agentType, tenant.id);
      const tracer = new ConversationTracer(
        tenant.id,
        `scenario-${Date.now()}`,
        scenario.agentType,
        this.mockStorage
      );

      const turns: TurnResult[] = [];
      let totalLatencyMs = 0;
      let totalTokens = 0;
      const allToolCalls: string[] = [];

      // Execute each turn
      for (let i = 0; i < scenario.turns.length; i++) {
        const turn = scenario.turns[i];

        if (turn.delayMs) {
          await new Promise((r) => setTimeout(r, turn.delayMs));
        }

        const start = Date.now();
        const response = await agent.processMessage(turn.user);
        const latencyMs = Date.now() - start;

        totalLatencyMs += latencyMs;
        totalTokens += response.usage?.total ?? 0;

        const toolCalls = response.toolCalls?.map((t) => t.name) ?? [];
        allToolCalls.push(...toolCalls);

        // Check turn expectations
        const turnResult = this.evaluateTurn(i, turn, response, latencyMs);
        turns.push(turnResult);

        tracer.recordUserMessage(turn.user, this.estimateTokens(turn.user));
        tracer.recordAssistantMessage(response.text, response.usage?.outputTokens ?? 0, latencyMs);
      }

      // Finalize trace
      const trace = await tracer.finalize({ taskCompleted: true });

      // Run LLM evaluation
      const evalResult = await this.evaluator.evaluate(trace);

      // Check success criteria
      const failures = this.checkSuccessCriteria(scenario, {
        evalResult,
        turns,
        totalLatencyMs,
        allToolCalls,
      });

      return {
        scenario,
        passed: failures.length === 0,
        turns,
        totalLatencyMs,
        totalTokens,
        evalResult,
        failures,
      };
    } finally {
      await cleanup();
    }
  }

  private evaluateTurn(
    index: number,
    turn: ScenarioTurn,
    response: AgentResponse,
    latencyMs: number
  ): TurnResult {
    const failures: string[] = [];
    const toolCalls = response.toolCalls?.map((t) => t.name) ?? [];

    const exp = turn.expectations;
    if (exp) {
      // Check required tool calls
      if (exp.shouldCallTools) {
        for (const tool of exp.shouldCallTools) {
          if (!toolCalls.includes(tool)) {
            failures.push(`Turn ${index}: Expected tool call '${tool}' but it wasn't called`);
          }
        }
      }

      // Check forbidden tool calls
      if (exp.shouldNotCallTools) {
        for (const tool of exp.shouldNotCallTools) {
          if (toolCalls.includes(tool)) {
            failures.push(`Turn ${index}: Tool '${tool}' was called but shouldn't be`);
          }
        }
      }

      // Check response patterns
      if (exp.responseShouldMatch && !exp.responseShouldMatch.test(response.text)) {
        failures.push(`Turn ${index}: Response should match ${exp.responseShouldMatch}`);
      }

      if (exp.responseShouldNotMatch && exp.responseShouldNotMatch.test(response.text)) {
        failures.push(`Turn ${index}: Response should NOT match ${exp.responseShouldNotMatch}`);
      }

      // Check latency
      if (exp.maxLatencyMs && latencyMs > exp.maxLatencyMs) {
        failures.push(`Turn ${index}: Latency ${latencyMs}ms exceeded max ${exp.maxLatencyMs}ms`);
      }
    }

    return {
      turnIndex: index,
      userMessage: turn.user,
      assistantResponse: response.text,
      toolCalls,
      latencyMs,
      tokens: response.usage?.total ?? 0,
      passed: failures.length === 0,
      failures,
    };
  }

  private checkSuccessCriteria(
    scenario: ConversationScenario,
    results: {
      evalResult: EvalResult;
      turns: TurnResult[];
      totalLatencyMs: number;
      allToolCalls: string[];
    }
  ): string[] {
    const failures: string[] = [];
    const { successCriteria } = scenario;

    // Check eval score
    if (results.evalResult.overallScore < successCriteria.minOverallScore) {
      failures.push(
        `Eval score ${results.evalResult.overallScore} below minimum ${successCriteria.minOverallScore}`
      );
    }

    // Check total latency
    if (
      successCriteria.maxTotalLatencyMs &&
      results.totalLatencyMs > successCriteria.maxTotalLatencyMs
    ) {
      failures.push(
        `Total latency ${results.totalLatencyMs}ms exceeded max ${successCriteria.maxTotalLatencyMs}ms`
      );
    }

    // Check turn count
    if (successCriteria.maxTurns && results.turns.length > successCriteria.maxTurns) {
      failures.push(`Turn count ${results.turns.length} exceeded max ${successCriteria.maxTurns}`);
    }

    // Check required tool calls
    if (successCriteria.requiredToolCalls) {
      for (const tool of successCriteria.requiredToolCalls) {
        if (!results.allToolCalls.includes(tool)) {
          failures.push(`Required tool '${tool}' was never called`);
        }
      }
    }

    // Check forbidden tool calls
    if (successCriteria.forbiddenToolCalls) {
      for (const tool of successCriteria.forbiddenToolCalls) {
        if (results.allToolCalls.includes(tool)) {
          failures.push(`Forbidden tool '${tool}' was called`);
        }
      }
    }

    // Add turn-level failures
    for (const turn of results.turns) {
      failures.push(...turn.failures);
    }

    return failures;
  }
}
```

### 3.4 Scenario Test Suite

```typescript
// server/test/agent-eval/scenarios/scenario.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { ScenarioRunner } from './runner';
import { BOOKING_HAPPY_PATH } from './customer/booking-happy-path.scenario';
import { NO_STRIPE_FORCING } from './onboarding/no-stripe-forcing.scenario';
// ... more scenarios

const SCENARIOS = [
  BOOKING_HAPPY_PATH,
  NO_STRIPE_FORCING,
  // Add more scenarios here
];

describe('Conversation Scenarios', () => {
  let runner: ScenarioRunner;

  beforeAll(() => {
    runner = new ScenarioRunner(evaluator, agentFactory);
  });

  describe.each(SCENARIOS)('$name', (scenario) => {
    it(`should pass with score >= ${scenario.successCriteria.minOverallScore}`, async () => {
      const result = await runner.run(scenario);

      if (!result.passed) {
        console.log('Failures:', result.failures);
        console.log('Eval:', result.evalResult);
      }

      expect(result.passed).toBe(true);
      expect(result.evalResult.overallScore).toBeGreaterThanOrEqual(
        scenario.successCriteria.minOverallScore
      );
    }, 60000); // 60s timeout for LLM calls
  });
});
```

### 3.5 Deliverables

- [ ] Scenario type definitions
- [ ] ScenarioRunner implementation
- [ ] 5 critical-path scenarios (customer booking, onboarding setup, admin management)
- [ ] 5 edge-case scenarios (error handling, ambiguous requests)
- [ ] Test suite integration

---

## Phase 4: Prompt Engineering System (Days 6-8)

### Goal

Treat prompts as code with versioning, testing, and systematic improvement.

### 4.1 Prompt Structure

```typescript
// server/src/agent/prompts/types.ts

export interface PromptVersion {
  version: string; // Semantic version: "1.2.0"
  agentType: string;
  createdAt: Date;
  createdBy: string; // Author
  changelog: string; // What changed

  // Prompt components
  personality: string; // Base personality traits
  capabilities: string; // What the agent can do
  guidelines: string; // How to behave
  examples: PromptExample[];

  // Compiled prompt
  systemPrompt: string;

  // Metadata
  tags: string[];
  experimental: boolean;
}

export interface PromptExample {
  scenario: string;
  userMessage: string;
  idealResponse: string;
  explanation: string;
}

export interface PromptExperiment {
  id: string;
  name: string;
  variants: {
    control: PromptVersion;
    treatment: PromptVersion;
  };
  trafficSplit: number; // 0-1, percentage going to treatment
  metrics: string[]; // Which eval dimensions to compare
  startedAt: Date;
  endedAt: Date | null;
  status: 'running' | 'concluded' | 'aborted';
  results: ExperimentResults | null;
}
```

### 4.2 Prompt Composer

```typescript
// server/src/agent/prompts/composer.ts

export class PromptComposer {
  constructor(
    private versionStore: PromptVersionStore,
    private experimentStore: ExperimentStore
  ) {}

  async getSystemPrompt(
    agentType: string,
    context: PromptContext
  ): Promise<{ prompt: string; version: string; experimentId?: string }> {
    // Check for active experiment
    const experiment = await this.experimentStore.getActiveExperiment(agentType);

    if (experiment) {
      const variant = this.selectVariant(experiment, context.sessionId);
      return {
        prompt: this.compile(variant, context),
        version: variant.version,
        experimentId: experiment.id,
      };
    }

    // Use latest stable version
    const latest = await this.versionStore.getLatestStable(agentType);
    return {
      prompt: this.compile(latest, context),
      version: latest.version,
    };
  }

  private compile(version: PromptVersion, context: PromptContext): string {
    // Inject dynamic context into prompt
    let prompt = version.systemPrompt;

    prompt = prompt.replace('{{BUSINESS_NAME}}', context.tenant.businessName);
    prompt = prompt.replace('{{BUSINESS_TYPE}}', context.tenant.businessType ?? 'service provider');
    prompt = prompt.replace('{{CURRENT_DATE}}', new Date().toLocaleDateString());

    // Inject few-shot examples if space allows
    if (context.includeExamples && version.examples.length > 0) {
      const examplesText = version.examples
        .slice(0, 3)
        .map((e) => `User: ${e.userMessage}\nAssistant: ${e.idealResponse}`)
        .join('\n\n');
      prompt += `\n\n## Examples\n${examplesText}`;
    }

    return prompt;
  }

  private selectVariant(experiment: PromptExperiment, sessionId: string): PromptVersion {
    // Consistent assignment based on session ID
    const hash = this.hashString(sessionId);
    const threshold = experiment.trafficSplit;

    return hash < threshold ? experiment.variants.treatment : experiment.variants.control;
  }
}
```

### 4.3 Prompt Testing Integration

```typescript
// server/src/agent/prompts/testing.ts

export class PromptTester {
  constructor(
    private scenarioRunner: ScenarioRunner,
    private scenarios: ConversationScenario[]
  ) {}

  /**
   * Test a prompt version against all relevant scenarios
   */
  async testPromptVersion(version: PromptVersion): Promise<PromptTestReport> {
    const relevantScenarios = this.scenarios.filter((s) => s.agentType === version.agentType);

    const results: ScenarioResult[] = [];

    for (const scenario of relevantScenarios) {
      // Temporarily use the test version
      const result = await this.scenarioRunner.runWithPrompt(scenario, version);
      results.push(result);
    }

    return {
      version: version.version,
      testedAt: new Date(),
      scenarios: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      avgScore: this.calculateAvgScore(results),
      details: results,
      recommendation: this.getRecommendation(results),
    };
  }

  /**
   * Compare two prompt versions
   */
  async compareVersions(
    baseline: PromptVersion,
    candidate: PromptVersion
  ): Promise<PromptComparisonReport> {
    const baselineResults = await this.testPromptVersion(baseline);
    const candidateResults = await this.testPromptVersion(candidate);

    return {
      baseline: baselineResults,
      candidate: candidateResults,
      improvement: {
        passRate:
          candidateResults.passed / candidateResults.scenarios -
          baselineResults.passed / baselineResults.scenarios,
        avgScore: candidateResults.avgScore - baselineResults.avgScore,
      },
      recommendation:
        candidateResults.avgScore > baselineResults.avgScore ? 'DEPLOY_CANDIDATE' : 'KEEP_BASELINE',
    };
  }
}
```

### 4.4 Deliverables

- [ ] PromptVersion type and storage
- [ ] PromptComposer with dynamic injection
- [ ] Experiment infrastructure for A/B testing
- [ ] PromptTester for regression detection
- [ ] Version history API

---

## Phase 5: Production Feedback Loop (Days 8-10)

### Goal

Learn continuously from real production usage.

### 5.1 Implicit Feedback Signals

```typescript
// server/src/agent/feedback/implicit.ts

export interface ImplicitSignals {
  // Conversation patterns
  turnCount: number; // More turns = potential confusion
  retryCount: number; // User rephrasing same question
  abandonmentRate: number; // Left without completing task
  timeToCompletion: number; // Fast = good

  // Response patterns
  avgResponseLength: number; // Verbosity signal
  toolCallAccuracy: number; // Right tools used?
  errorRate: number; // Errors during conversation

  // Engagement signals
  followUpQuestions: number; // User engaged
  positiveAcknowledgments: number; // "thanks", "great", "perfect"
  negativeSignals: number; // "no", "that's wrong", "not what I asked"
}

export class ImplicitFeedbackAnalyzer {
  analyze(trace: ConversationTrace): ImplicitSignals {
    const messages = trace.messages as TracedMessage[];
    const userMessages = messages.filter((m) => m.role === 'user');

    return {
      turnCount: trace.turnCount,
      retryCount: this.countRetries(userMessages),
      abandonmentRate: trace.taskCompleted === false ? 1 : 0,
      timeToCompletion: trace.endedAt ? trace.endedAt.getTime() - trace.startedAt.getTime() : -1,
      avgResponseLength: this.avgLength(messages.filter((m) => m.role === 'assistant')),
      toolCallAccuracy: this.estimateToolAccuracy(trace),
      errorRate: ((trace.errors as any[])?.length ?? 0) / Math.max(trace.turnCount, 1),
      followUpQuestions: this.countFollowUps(userMessages),
      positiveAcknowledgments: this.countPositive(userMessages),
      negativeSignals: this.countNegative(userMessages),
    };
  }

  private countRetries(messages: TracedMessage[]): number {
    // Detect when user rephrases the same question
    let retries = 0;
    for (let i = 1; i < messages.length; i++) {
      const similarity = this.textSimilarity(messages[i].content, messages[i - 1].content);
      if (similarity > 0.7) retries++;
    }
    return retries;
  }

  private countPositive(messages: TracedMessage[]): number {
    const positivePatterns = /\b(thanks|thank you|great|perfect|awesome|excellent|helpful)\b/i;
    return messages.filter((m) => positivePatterns.test(m.content)).length;
  }

  private countNegative(messages: TracedMessage[]): number {
    const negativePatterns = /\b(no|wrong|incorrect|not what|didn't ask|confused)\b/i;
    return messages.filter((m) => negativePatterns.test(m.content)).length;
  }
}
```

### 5.2 Explicit Feedback Collection

```typescript
// server/src/routes/feedback.routes.ts

// POST /v1/feedback
router.post('/feedback', async (req, res) => {
  const { sessionId, rating, comment, messageId } = req.body;

  await prisma.userFeedback.create({
    data: {
      sessionId,
      rating, // 1-5 or thumbs up/down
      comment, // Optional text
      messageId, // Which message they're rating
      createdAt: new Date(),
    },
  });

  // Update trace with feedback
  await prisma.conversationTrace.update({
    where: { sessionId },
    data: {
      userSatisfaction: rating,
      flagged: rating <= 2, // Auto-flag low ratings
      flagReason: rating <= 2 ? `User rating: ${rating}` : null,
    },
  });

  return res.json({ success: true });
});
```

### 5.3 Human Review Queue

```typescript
// server/src/agent/feedback/review-queue.ts

export class ReviewQueue {
  async getFlaggedConversations(options: {
    limit?: number;
    agentType?: string;
    minScore?: number;
    maxScore?: number;
  }): Promise<ConversationTrace[]> {
    return prisma.conversationTrace.findMany({
      where: {
        flagged: true,
        reviewStatus: 'pending',
        ...(options.agentType && { agentType: options.agentType }),
        ...(options.maxScore && { evalScore: { lte: options.maxScore } }),
      },
      orderBy: [
        { evalScore: 'asc' }, // Worst first
        { startedAt: 'desc' }, // Then most recent
      ],
      take: options.limit ?? 20,
    });
  }

  async submitReview(
    traceId: string,
    review: {
      reviewedBy: string;
      notes: string;
      correctEvalScore?: number; // Human override
      actionTaken: 'none' | 'prompt_updated' | 'bug_filed' | 'training_data';
    }
  ): Promise<void> {
    await prisma.conversationTrace.update({
      where: { id: traceId },
      data: {
        reviewStatus: 'reviewed',
        reviewedAt: new Date(),
        reviewedBy: review.reviewedBy,
        reviewNotes: review.notes,
        ...(review.correctEvalScore && { evalScore: review.correctEvalScore }),
      },
    });

    // If action taken, log it
    if (review.actionTaken !== 'none') {
      await prisma.reviewAction.create({
        data: {
          traceId,
          action: review.actionTaken,
          notes: review.notes,
          createdBy: review.reviewedBy,
        },
      });
    }
  }
}
```

### 5.4 Weekly Improvement Report

```typescript
// server/src/agent/feedback/weekly-report.ts

export async function generateWeeklyReport(): Promise<WeeklyReport> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const traces = await prisma.conversationTrace.findMany({
    where: { startedAt: { gte: weekAgo } },
  });

  // Aggregate metrics
  const metrics = {
    totalConversations: traces.length,
    avgEvalScore: avg(traces.map((t) => t.evalScore).filter(Boolean)),
    taskCompletionRate: traces.filter((t) => t.taskCompleted).length / traces.length,
    avgTurns: avg(traces.map((t) => t.turnCount)),
    flaggedCount: traces.filter((t) => t.flagged).length,
  };

  // Compare to previous week
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const previousTraces = await prisma.conversationTrace.findMany({
    where: {
      startedAt: { gte: twoWeeksAgo, lt: weekAgo },
    },
  });

  const previousMetrics = {
    avgEvalScore: avg(previousTraces.map((t) => t.evalScore).filter(Boolean)),
    taskCompletionRate:
      previousTraces.filter((t) => t.taskCompleted).length / previousTraces.length,
  };

  // Identify top failure patterns
  const lowScoreTraces = traces.filter((t) => (t.evalScore ?? 10) < 6);
  const failurePatterns = await analyzeFailurePatterns(lowScoreTraces);

  // Generate improvement suggestions
  const suggestions = await generateSuggestions(failurePatterns);

  return {
    period: { start: weekAgo, end: new Date() },
    metrics,
    trends: {
      evalScoreChange: metrics.avgEvalScore - previousMetrics.avgEvalScore,
      completionRateChange: metrics.taskCompletionRate - previousMetrics.taskCompletionRate,
    },
    failurePatterns,
    suggestions,
  };
}
```

### 5.5 Deliverables

- [ ] ImplicitFeedbackAnalyzer
- [ ] Feedback API endpoints
- [ ] ReviewQueue for human review
- [ ] Weekly report generator
- [ ] Dashboard for metrics visualization

---

## Phase 6: Performance & Cost (Days 10-12)

### Goal

Scale efficiently without compromising quality.

### 6.1 Streaming Responses

```typescript
// Already implemented - verify it's working

// Frontend should use streaming for better UX
const stream = await fetch('/v1/agent/chat', {
  method: 'POST',
  body: JSON.stringify({ message }),
  headers: { Accept: 'text/event-stream' },
});

for await (const chunk of stream) {
  // Display incrementally
}
```

### 6.2 Caching Strategy

```typescript
// server/src/agent/cache/context-cache.ts

export class AgentContextCache {
  private cache: Map<string, CachedContext> = new Map();
  private ttl = 5 * 60 * 1000; // 5 minutes

  async getTenantContext(tenantId: string): Promise<TenantContext> {
    const key = `tenant:${tenantId}`;
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    // Fetch fresh
    const context = await this.fetchTenantContext(tenantId);
    this.cache.set(key, { data: context, timestamp: Date.now() });

    return context;
  }

  // Invalidate on writes
  invalidate(tenantId: string): void {
    this.cache.delete(`tenant:${tenantId}`);
  }
}
```

### 6.3 Cost Tracking

```typescript
// server/src/agent/cost/tracker.ts

const COST_PER_1K_TOKENS = {
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-haiku-35-20241022': { input: 0.00025, output: 0.00125 },
};

export class CostTracker {
  async recordUsage(
    tenantId: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    const costs = COST_PER_1K_TOKENS[model];
    const totalCost = (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;

    await prisma.agentUsage.create({
      data: {
        tenantId,
        model,
        inputTokens,
        outputTokens,
        cost: totalCost,
        timestamp: new Date(),
      },
    });
  }

  async getMonthlyUsage(tenantId: string): Promise<UsageSummary> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await prisma.agentUsage.aggregate({
      where: {
        tenantId,
        timestamp: { gte: startOfMonth },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cost: true,
      },
      _count: true,
    });

    return {
      conversations: usage._count,
      totalTokens: (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0),
      totalCost: usage._sum.cost ?? 0,
    };
  }
}
```

### 6.4 Deliverables

- [ ] Verify streaming is working end-to-end
- [ ] Context caching with invalidation
- [ ] Cost tracking per tenant
- [ ] Usage dashboard / alerts

---

## Phase 7: Continuous Improvement (Ongoing)

### Weekly Rhythm

**Monday: Review**

- Check weekly report
- Review flagged conversations
- Identify top 3 issues

**Tuesday-Thursday: Improve**

- Draft prompt improvements
- Test against scenarios
- A/B test if significant change

**Friday: Deploy & Monitor**

- Deploy improvements
- Monitor for regressions
- Document learnings

### Monthly Rhythm

- Deep-dive analysis of trends
- Major prompt version updates
- Benchmark comparison
- Red-teaming session

### Quarterly Rhythm

- User satisfaction surveys
- Competitive analysis
- Architecture review
- Goal setting for next quarter

---

## Success Metrics

### Target State (3 months)

| Metric                | Current | Target  |
| --------------------- | ------- | ------- |
| Avg Eval Score        | Unknown | > 8.5   |
| Task Completion       | Unknown | > 90%   |
| P95 Latency           | Unknown | < 3s    |
| Cost per Conversation | Unknown | < $0.05 |
| User Satisfaction     | Unknown | > 4.5/5 |
| Regression Rate       | N/A     | < 5%    |

### Leading Indicators

- Eval scores trending up week-over-week
- Flagged conversation rate decreasing
- Human review queue shrinking
- Positive feedback increasing

---

## File Structure Summary

```
server/
├── src/
│   └── agent/
│       ├── tracing/
│       │   ├── types.ts
│       │   ├── tracer.ts
│       │   └── storage.ts
│       ├── evals/
│       │   ├── types.ts
│       │   ├── rubrics/
│       │   │   └── index.ts
│       │   ├── evaluator.ts
│       │   └── pipeline.ts
│       ├── prompts/
│       │   ├── types.ts
│       │   ├── composer.ts
│       │   ├── testing.ts
│       │   └── versions/
│       ├── feedback/
│       │   ├── implicit.ts
│       │   ├── review-queue.ts
│       │   └── weekly-report.ts
│       └── cost/
│           └── tracker.ts
│
├── test/
│   └── agent-eval/
│       ├── scenarios/
│       │   ├── types.ts
│       │   ├── runner.ts
│       │   ├── customer/
│       │   ├── onboarding/
│       │   └── admin/
│       └── llm/
│           └── scenario.test.ts
│
└── prisma/
    └── schema.prisma  (+ ConversationTrace, UserFeedback, AgentUsage)
```

---

## Getting Started

### Prerequisites

- Anthropic API key for evaluations
- Database migrations applied
- Existing agent infrastructure working

### First Steps

1. Start with Phase 1 (Observability) - you need data before you can improve
2. Run Phase 2 (Evals) to establish baseline scores
3. Fix the Stripe forcing bug as a quick win
4. Build scenarios incrementally

### Command Reference

```bash
# Run scenario tests
npm run test:scenarios

# Process pending evaluations
npm run eval:process

# Generate weekly report
npm run report:weekly

# Compare prompt versions
npm run prompt:compare v1.0.0 v1.1.0
```

---

## Notes for Implementation

1. **Start Simple**: Get tracing working before evals. Get evals working before scenarios.

2. **Iterate Fast**: Don't try to build everything at once. Ship phase by phase.

3. **Measure First**: Establish baselines before making changes so you know if you're improving.

4. **Fix the Stripe Bug First**: It's a concrete problem with a clear solution. Quick win to build momentum.

5. **Scenarios are Gold**: Once you have good scenarios, they become your regression safety net.

6. **Human Review is Essential**: Automated evals are good but humans catch what LLMs miss.
