/**
 * Scenario Runner
 *
 * Executes multi-turn conversation scenarios against agents and validates
 * expectations. Supports setup, execution, and teardown of test environments.
 *
 * @see plans/agent-evaluation-system.md Phase 3.3
 */

import type { PrismaClient } from '../../../src/generated/prisma/client';
import { ConversationEvaluator, createEvaluator } from '../../../src/agent/evals';
import type { EvalInput } from '../../../src/agent/evals';
import type { TracedMessage, TracedToolCall } from '../../../src/agent/tracing';
import type {
  ConversationScenario,
  ScenarioResult,
  TurnResult,
  TurnExpectations,
  ScenarioTurn,
  AgentFactory,
  AgentInterface,
  ScenarioRunnerConfig,
  TenantSetup,
  ServiceSetup,
  BookingSetup,
} from './types';
import { DEFAULT_RUNNER_CONFIG } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Scenario Runner Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes multi-turn conversation scenarios.
 *
 * Usage:
 * ```typescript
 * const runner = new ScenarioRunner(agentFactory, prisma);
 * const result = await runner.run(BOOKING_HAPPY_PATH);
 * console.log(result.passed ? 'PASS' : 'FAIL');
 * ```
 */
export class ScenarioRunner {
  private readonly evaluator: ConversationEvaluator | null;
  private readonly config: ScenarioRunnerConfig;

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly prisma: PrismaClient,
    config: Partial<ScenarioRunnerConfig> = {}
  ) {
    this.config = { ...DEFAULT_RUNNER_CONFIG, ...config };
    this.evaluator = this.config.runEvaluation ? createEvaluator() : null;
  }

  /**
   * Run a single scenario.
   */
  async run(scenario: ConversationScenario): Promise<ScenarioResult> {
    const startTime = Date.now();
    const executedAt = new Date().toISOString();

    const { tenant, cleanup } = await this.setupScenario(scenario);

    try {
      const agent = await this.agentFactory.create(scenario.agentType, tenant.id);

      const turns: TurnResult[] = [];
      const tracedMessages: TracedMessage[] = [];
      const tracedToolCalls: TracedToolCall[] = [];
      let totalLatencyMs = 0;
      let totalTokens = 0;
      const allToolCalls: string[] = [];

      // Execute each turn
      for (let i = 0; i < scenario.turns.length; i++) {
        const turn = scenario.turns[i];

        // Simulate thinking time
        if (turn.delayMs) {
          await this.delay(turn.delayMs);
        }

        // Execute with timeout
        const turnResult = await this.executeTurnWithTimeout(
          agent,
          turn,
          i,
          this.config.turnTimeoutMs
        );

        turns.push(turnResult);
        totalLatencyMs += turnResult.latencyMs;
        totalTokens += turnResult.tokens;
        allToolCalls.push(...turnResult.toolCalls);

        // Track for evaluation
        tracedMessages.push(
          this.createTracedMessage('user', turn.user),
          this.createTracedMessage('assistant', turnResult.assistantResponse, turnResult.latencyMs)
        );

        for (const toolName of turnResult.toolCalls) {
          tracedToolCalls.push(this.createTracedToolCall(toolName));
        }

        // Stop on failure if configured
        if (!turnResult.passed && !this.config.continueOnFailure) {
          break;
        }
      }

      // Check success criteria
      const criteriaFailures = this.checkSuccessCriteria(scenario, {
        turns,
        totalLatencyMs,
        allToolCalls,
      });

      // Collect all failures
      const failures: string[] = [
        ...criteriaFailures,
        ...turns.flatMap((t) => t.failures.map((f) => `Turn ${t.turnIndex + 1}: ${f}`)),
      ];

      // Run evaluation if configured
      let evalResult = undefined;
      if (this.evaluator && this.config.runEvaluation) {
        const evalInput: EvalInput = {
          traceId: `scenario-${scenario.id}-${Date.now()}`,
          tenantId: tenant.id,
          agentType: scenario.agentType,
          messages: tracedMessages,
          toolCalls: tracedToolCalls,
          taskCompleted: scenario.successCriteria.taskCompleted ?? null,
        };
        evalResult = await this.evaluator.evaluate(evalInput);

        // Check minimum score
        if (evalResult.overallScore < scenario.successCriteria.minOverallScore) {
          failures.push(
            `Evaluation score ${evalResult.overallScore} below minimum ${scenario.successCriteria.minOverallScore}`
          );
        }
      }

      // Cleanup agent resources
      if (agent.cleanup) {
        await agent.cleanup();
      }

      return {
        scenario,
        passed: failures.length === 0,
        turns,
        totalLatencyMs,
        totalTokens,
        evalResult,
        failures,
        executedAt,
        durationMs: Date.now() - startTime,
      };
    } finally {
      await cleanup();
    }
  }

  /**
   * Run multiple scenarios, optionally filtered.
   */
  async runAll(scenarios: ConversationScenario[]): Promise<ScenarioResult[]> {
    const filtered = this.filterScenarios(scenarios);
    const results: ScenarioResult[] = [];

    for (const scenario of filtered) {
      const result = await this.run(scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Run scenarios in parallel (with limit).
   */
  async runParallel(
    scenarios: ConversationScenario[],
    concurrency: number = 3
  ): Promise<ScenarioResult[]> {
    const filtered = this.filterScenarios(scenarios);
    const results: ScenarioResult[] = [];

    for (let i = 0; i < filtered.length; i += concurrency) {
      const batch = filtered.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((s) => this.run(s)));
      results.push(...batchResults);
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Setup and Teardown
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set up the scenario environment.
   */
  private async setupScenario(
    scenario: ConversationScenario
  ): Promise<{ tenant: { id: string }; cleanup: () => Promise<void> }> {
    // Create test tenant
    const tenant = await this.createTestTenant(scenario.setup.tenant);

    // Set up existing data if specified
    if (scenario.setup.existingData?.services) {
      await this.createTestServices(tenant.id, scenario.setup.existingData.services);
    }

    if (scenario.setup.existingData?.bookings) {
      await this.createTestBookings(tenant.id, scenario.setup.existingData.bookings);
    }

    return {
      tenant,
      cleanup: async () => {
        await this.cleanupTestTenant(tenant.id);
      },
    };
  }

  /**
   * Create a test tenant with optional configuration.
   */
  private async createTestTenant(config?: Partial<TenantSetup>): Promise<{ id: string }> {
    const slug = `test-scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const tenant = await this.prisma.tenant.create({
      data: {
        slug,
        businessName: config?.businessName ?? 'Test Business',
        businessType: config?.businessType ?? 'other',
        onboardingPhase: config?.onboardingPhase ?? 'COMPLETED',
        stripeConnected: config?.stripeConnected ?? false,
        email: `${slug}@test.example.com`,
        timezone: 'America/Chicago',
        apiKeys: {
          create: {
            keyHash: `pk_test_${slug}`,
            keyType: 'public',
            isActive: true,
          },
        },
      },
      select: { id: true },
    });

    return tenant;
  }

  /**
   * Create test services for a tenant.
   */
  private async createTestServices(tenantId: string, services: ServiceSetup[]): Promise<void> {
    // First create a default segment
    const segment = await this.prisma.segment.create({
      data: {
        tenantId,
        name: 'Test Segment',
        slug: 'test-segment',
        displayOrder: 1,
      },
    });

    // Create each service as a package
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      await this.prisma.package.create({
        data: {
          tenantId,
          segmentId: segment.id,
          name: service.name,
          slug: service.name.toLowerCase().replace(/\s+/g, '-'),
          description: service.description ?? `Test service: ${service.name}`,
          basePrice: service.price,
          durationMins: service.duration,
          groupingOrder: i + 1,
          isActive: true,
        },
      });
    }
  }

  /**
   * Create test bookings for a tenant.
   */
  private async createTestBookings(tenantId: string, bookings: BookingSetup[]): Promise<void> {
    for (const booking of bookings) {
      // Find service by name
      const pkg = await this.prisma.package.findFirst({
        where: {
          tenantId,
          name: booking.serviceName,
        },
      });

      if (pkg) {
        await this.prisma.booking.create({
          data: {
            tenantId,
            packageId: pkg.id,
            date: new Date(booking.date),
            status: booking.status ?? 'confirmed',
            customerEmail: booking.customerEmail ?? 'test@example.com',
            customerName: 'Test Customer',
            totalCents: pkg.basePrice,
            source: 'test-scenario',
          },
        });
      }
    }
  }

  /**
   * Clean up a test tenant and all related data.
   */
  private async cleanupTestTenant(tenantId: string): Promise<void> {
    // Delete in dependency order
    await this.prisma.booking.deleteMany({ where: { tenantId } });
    await this.prisma.package.deleteMany({ where: { tenantId } });
    await this.prisma.segment.deleteMany({ where: { tenantId } });
    await this.prisma.apiKey.deleteMany({ where: { tenantId } });
    await this.prisma.tenant.delete({ where: { id: tenantId } });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Turn Execution
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Execute a turn with timeout.
   */
  private async executeTurnWithTimeout(
    agent: AgentInterface,
    turn: ScenarioTurn,
    turnIndex: number,
    timeoutMs: number
  ): Promise<TurnResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Turn ${turnIndex + 1} timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });

    try {
      const result = await Promise.race([this.executeTurn(agent, turn, turnIndex), timeoutPromise]);
      return result;
    } catch (error) {
      return {
        turnIndex,
        userMessage: turn.user,
        assistantResponse: '',
        toolCalls: [],
        latencyMs: timeoutMs,
        tokens: 0,
        passed: false,
        failures: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Execute a single turn and evaluate expectations.
   */
  private async executeTurn(
    agent: AgentInterface,
    turn: ScenarioTurn,
    turnIndex: number
  ): Promise<TurnResult> {
    const start = Date.now();
    const response = await agent.processMessage(turn.user);
    const latencyMs = Date.now() - start;

    const toolCalls = response.toolCalls?.map((t) => t.name) ?? [];
    const tokens = response.usage?.total ?? 0;

    const failures = turn.expectations
      ? this.evaluateTurnExpectations(response.text, toolCalls, latencyMs, turn.expectations)
      : [];

    return {
      turnIndex,
      userMessage: turn.user,
      assistantResponse: response.text,
      toolCalls,
      latencyMs,
      tokens,
      passed: failures.length === 0,
      failures,
    };
  }

  /**
   * Evaluate turn expectations and return failures.
   */
  private evaluateTurnExpectations(
    response: string,
    toolCalls: string[],
    latencyMs: number,
    expectations: TurnExpectations
  ): string[] {
    const failures: string[] = [];

    // Check required tools
    if (expectations.shouldCallTools) {
      for (const tool of expectations.shouldCallTools) {
        if (!toolCalls.includes(tool)) {
          failures.push(`Expected tool call: ${tool}`);
        }
      }
    }

    // Check forbidden tools
    if (expectations.shouldNotCallTools) {
      for (const tool of expectations.shouldNotCallTools) {
        if (toolCalls.includes(tool)) {
          failures.push(`Forbidden tool called: ${tool}`);
        }
      }
    }

    // Check response patterns
    if (expectations.responseShouldMatch) {
      if (!expectations.responseShouldMatch.test(response)) {
        failures.push(`Response should match: ${expectations.responseShouldMatch}`);
      }
    }

    if (expectations.responseShouldNotMatch) {
      if (expectations.responseShouldNotMatch.test(response)) {
        failures.push(`Response should NOT match: ${expectations.responseShouldNotMatch}`);
      }
    }

    // Check latency
    if (expectations.maxLatencyMs && latencyMs > expectations.maxLatencyMs) {
      failures.push(`Latency ${latencyMs}ms exceeds max ${expectations.maxLatencyMs}ms`);
    }

    return failures;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Success Criteria Evaluation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check scenario-level success criteria.
   */
  private checkSuccessCriteria(
    scenario: ConversationScenario,
    results: {
      turns: TurnResult[];
      totalLatencyMs: number;
      allToolCalls: string[];
    }
  ): string[] {
    const failures: string[] = [];
    const criteria = scenario.successCriteria;

    // Check max turns
    if (criteria.maxTurns && results.turns.length > criteria.maxTurns) {
      failures.push(`Turn count ${results.turns.length} exceeds max ${criteria.maxTurns}`);
    }

    // Check total latency
    if (criteria.maxTotalLatencyMs && results.totalLatencyMs > criteria.maxTotalLatencyMs) {
      failures.push(
        `Total latency ${results.totalLatencyMs}ms exceeds max ${criteria.maxTotalLatencyMs}ms`
      );
    }

    // Check required tool calls
    if (criteria.requiredToolCalls) {
      for (const tool of criteria.requiredToolCalls) {
        if (!results.allToolCalls.includes(tool)) {
          failures.push(`Required tool not called: ${tool}`);
        }
      }
    }

    // Check forbidden tool calls
    if (criteria.forbiddenToolCalls) {
      for (const tool of criteria.forbiddenToolCalls) {
        if (results.allToolCalls.includes(tool)) {
          failures.push(`Forbidden tool called: ${tool}`);
        }
      }
    }

    return failures;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Filter scenarios based on runner config.
   */
  private filterScenarios(scenarios: ConversationScenario[]): ConversationScenario[] {
    const filter = this.config.filter;
    if (!filter) return scenarios;

    return scenarios.filter((s) => {
      if (filter.tags && filter.tags.length > 0) {
        if (!filter.tags.some((t) => s.tags.includes(t))) {
          return false;
        }
      }

      if (filter.priority && filter.priority.length > 0) {
        if (!filter.priority.includes(s.priority)) {
          return false;
        }
      }

      if (filter.category && filter.category.length > 0) {
        if (!filter.category.includes(s.category)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Create a traced message for evaluation.
   */
  private createTracedMessage(
    role: 'user' | 'assistant',
    content: string,
    latencyMs?: number
  ): TracedMessage {
    return {
      role,
      content,
      timestamp: new Date().toISOString(),
      latencyMs: latencyMs ?? null,
      tokenCount: Math.ceil(content.length / 4), // Rough estimate
    };
  }

  /**
   * Create a traced tool call for evaluation.
   */
  private createTracedToolCall(toolName: string): TracedToolCall {
    return {
      toolName,
      input: {},
      output: { success: true },
      latencyMs: 50,
      timestamp: new Date().toISOString(),
      trustTier: 'T1',
      success: true,
      error: null,
      executionState: 'complete',
      proposalId: null,
      proposalStatus: null,
    };
  }

  /**
   * Delay for simulating user think time.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new scenario runner.
 */
export function createScenarioRunner(
  agentFactory: AgentFactory,
  prisma: PrismaClient,
  config?: Partial<ScenarioRunnerConfig>
): ScenarioRunner {
  return new ScenarioRunner(agentFactory, prisma, config);
}
