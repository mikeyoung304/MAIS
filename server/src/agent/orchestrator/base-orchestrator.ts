/**
 * Base Orchestrator (Abstract)
 *
 * Template Method pattern for agent orchestrators.
 * Provides shared infrastructure:
 * - Session management
 * - Guardrails (rate limiting, circuit breakers, tier budgets)
 * - Tool execution with recursion limits
 * - Proposal lifecycle
 * - Audit logging
 *
 * Subclasses override:
 * - getTools(): Agent-specific tools
 * - buildSystemPrompt(): Agent-specific prompt
 * - getConfig(): Agent-specific configuration
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  ToolUseBlock,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import type { PrismaClient, Prisma } from '../../generated/prisma';
import type { ToolContext, AgentToolResult, AgentTool } from '../tools/types';
import { INJECTION_PATTERNS } from '../tools/types';
import { ProposalService } from '../proposals/proposal.service';
import { AuditService } from '../audit/audit.service';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import { withRetry, CLAUDE_API_RETRY_CONFIG } from '../utils/retry';
import { contextCache, withSessionId } from '../context/context-cache';
import { buildFallbackContext } from '../context/context-builder';
import type { AgentSessionContext } from '../context/context-builder';

// Guardrail imports
import type { AgentType, BudgetTracker, TierBudgets } from './types';
import { DEFAULT_TIER_BUDGETS, createBudgetTracker, SOFT_CONFIRM_WINDOWS } from './types';
import { ToolRateLimiter, type ToolRateLimits, DEFAULT_TOOL_RATE_LIMITS } from './rate-limiter';
import {
  CircuitBreaker,
  type CircuitBreakerConfig,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker';

// Metrics imports
import {
  recordToolCall,
  recordRateLimitHit,
  recordCircuitBreakerTrip,
  recordTurnDuration,
  recordProposal,
  recordTierBudgetExhausted,
  recordApiError,
} from './metrics';

/**
 * Configuration for orchestrator subclasses
 */
export interface OrchestratorConfig {
  readonly agentType: AgentType;
  readonly model: string;
  readonly maxTokens: number;
  readonly maxHistoryMessages: number;
  readonly temperature: number;
  readonly tierBudgets: TierBudgets;
  readonly toolRateLimits: ToolRateLimits;
  readonly circuitBreaker: CircuitBreakerConfig;
  readonly maxRecursionDepth: number;
  readonly executorTimeoutMs: number;
  /**
   * Enable prompt injection detection.
   * When enabled, user messages are checked against INJECTION_PATTERNS
   * and blocked if suspicious content is detected.
   * Default: true (recommended for all orchestrators)
   */
  readonly enableInjectionDetection?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: Omit<OrchestratorConfig, 'agentType'> = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  maxHistoryMessages: 20,
  temperature: 0.7,
  tierBudgets: DEFAULT_TIER_BUDGETS,
  toolRateLimits: DEFAULT_TOOL_RATE_LIMITS,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  maxRecursionDepth: 5,
  executorTimeoutMs: 5000,
  enableInjectionDetection: true, // Security: enabled by default
};

/**
 * Chat message for conversation history
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolUses?: {
    toolName: string;
    input: Record<string, unknown>;
    result: AgentToolResult;
  }[];
}

/**
 * Session state stored in database
 */
export interface SessionState {
  sessionId: string;
  tenantId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat response from orchestrator
 */
export interface ChatResponse {
  message: string;
  sessionId: string;
  proposals?: {
    proposalId: string;
    operation: string;
    preview: Record<string, unknown>;
    trustTier: string;
    requiresApproval: boolean;
  }[];
  toolResults?: {
    toolName: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }[];
}

/**
 * Context for building system prompts
 */
export interface PromptContext {
  tenantId: string;
  sessionId: string;
  sessionContext?: AgentSessionContext;
}

/**
 * Tools that modify tenant data and require cache invalidation
 */
const WRITE_TOOLS = new Set([
  'upsert_services',
  'update_storefront',
  'update_onboarding_state',
  'create_booking',
  'update_package',
  'book_service',
]);

/**
 * Cleanup circuit breakers every N chat calls to prevent unbounded memory growth.
 * 100 calls provides good balance between cleanup frequency and overhead.
 */
const CLEANUP_INTERVAL_CALLS = 100;

/**
 * Maximum number of circuit breakers to keep in memory.
 * At ~130 bytes per entry, this caps memory at ~130KB.
 */
const MAX_CIRCUIT_BREAKERS = 1000;

/**
 * Parse messages from database JSON to ChatMessage[]
 * @internal Exported for testing
 */
export function parseChatMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages.filter((msg): msg is ChatMessage => {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      'role' in msg &&
      'content' in msg &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string'
    );
  });
}

/**
 * Execute a promise with timeout
 * @internal Exported for testing
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Executor timeout: ${operationName} exceeded ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Base Orchestrator
 *
 * Abstract class providing shared orchestration logic.
 * Subclasses must implement:
 * - getTools(): Return agent-specific tools
 * - buildSystemPrompt(): Build agent-specific system prompt
 * - getConfig(): Return agent configuration
 */
export abstract class BaseOrchestrator {
  protected readonly anthropic: Anthropic;
  protected readonly proposalService: ProposalService;
  protected readonly auditService: AuditService;
  protected readonly rateLimiter: ToolRateLimiter;

  // Per-session circuit breakers (keyed by sessionId to prevent cross-session pollution)
  // Each session gets its own circuit breaker so one user's abuse doesn't affect others
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  // Cleanup old circuit breakers periodically (every 100 chat calls)
  private circuitBreakerCleanupCounter = 0;

  constructor(protected readonly prisma: PrismaClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    this.anthropic = new Anthropic({
      apiKey,
      timeout: 30 * 1000,
      maxRetries: 2,
    });

    this.proposalService = new ProposalService(prisma);
    this.auditService = new AuditService(prisma);

    // Initialize rate limiter with config from subclass
    const config = this.getConfig();
    this.rateLimiter = new ToolRateLimiter(config.toolRateLimits);

    logger.debug(
      { agentType: config.agentType, tierBudgets: config.tierBudgets },
      'BaseOrchestrator initialized'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Abstract methods - must be implemented by subclasses
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get agent-specific tools
   */
  protected abstract getTools(): AgentTool[];

  /**
   * Build agent-specific system prompt
   */
  protected abstract buildSystemPrompt(context: PromptContext): Promise<string>;

  /**
   * Get agent configuration
   */
  abstract getConfig(): OrchestratorConfig;

  /**
   * Get session type for database queries
   * Override in subclasses for different session types
   */
  protected getSessionType(): 'ADMIN' | 'CUSTOMER' | null {
    return null; // Default: no session type filter
  }

  /**
   * Get session TTL in milliseconds
   * Override in subclasses for different TTLs
   */
  protected getSessionTtlMs(): number {
    return 24 * 60 * 60 * 1000; // Default: 24 hours
  }

  /**
   * Get message for injection detection block
   * Override in subclasses for agent-specific messages
   */
  protected getInjectionBlockMessage(): string {
    return "I'm here to help with your questions. How can I assist you?";
  }

  /**
   * Check for prompt injection patterns
   * Uses NFKC normalization to catch Unicode lookalike characters.
   *
   * SECURITY: This is defense-in-depth. Claude also has built-in safety,
   * but explicit pattern matching catches known attack vectors.
   */
  protected detectPromptInjection(message: string): boolean {
    const normalized = message.normalize('NFKC');
    return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Session Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get or create session for a tenant
   */
  async getOrCreateSession(tenantId: string): Promise<SessionState> {
    const sessionType = this.getSessionType();
    const ttlMs = this.getSessionTtlMs();

    // Build query conditionally based on session type
    const whereClause: Prisma.AgentSessionWhereInput = {
      tenantId,
      updatedAt: { gt: new Date(Date.now() - ttlMs) },
    };

    if (sessionType !== null) {
      whereClause.sessionType = sessionType;
    }

    const existingSession = await this.prisma.agentSession.findFirst({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
    });

    if (existingSession) {
      return {
        sessionId: existingSession.id,
        tenantId,
        messages: parseChatMessages(existingSession.messages),
        createdAt: existingSession.createdAt,
        updatedAt: existingSession.updatedAt,
      };
    }

    // Create new session
    const createData: Prisma.AgentSessionCreateInput = {
      tenant: { connect: { id: tenantId } },
      messages: [],
    };

    if (sessionType !== null) {
      createData.sessionType = sessionType;
    }

    const newSession = await this.prisma.agentSession.create({
      data: createData,
    });

    const config = this.getConfig();
    logger.info(
      { tenantId, sessionId: newSession.id, agentType: config.agentType },
      'New agent session created'
    );

    return {
      sessionId: newSession.id,
      tenantId,
      messages: [],
      createdAt: newSession.createdAt,
      updatedAt: newSession.updatedAt,
    };
  }

  /**
   * Get existing session by ID
   */
  async getSession(tenantId: string, sessionId: string): Promise<SessionState | null> {
    const sessionType = this.getSessionType();

    const whereClause: Prisma.AgentSessionWhereInput = {
      id: sessionId,
      tenantId, // CRITICAL: Tenant isolation
    };

    if (sessionType !== null) {
      whereClause.sessionType = sessionType;
    }

    const session = await this.prisma.agentSession.findFirst({
      where: whereClause,
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      tenantId,
      messages: parseChatMessages(session.messages),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Chat Processing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send a message and get response
   */
  async chat(
    tenantId: string,
    requestedSessionId: string,
    userMessage: string
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const config = this.getConfig();

    // SECURITY: Check for prompt injection attempts (defense-in-depth)
    const enableInjectionDetection = config.enableInjectionDetection ?? true;
    if (enableInjectionDetection && this.detectPromptInjection(userMessage)) {
      logger.warn(
        { tenantId, agentType: config.agentType, messagePreview: userMessage.slice(0, 100) },
        'Potential prompt injection attempt detected'
      );

      // Get or create session for response (need session ID)
      let session = await this.getSession(tenantId, requestedSessionId);
      if (!session) {
        session = await this.getOrCreateSession(tenantId);
      }

      return {
        message: this.getInjectionBlockMessage(),
        sessionId: session.sessionId,
      };
    }

    // Get or validate session
    // CRITICAL: Use resolved session's ID, not the requested one (Bug fix from Phase 1)
    let session = await this.getSession(tenantId, requestedSessionId);
    if (!session) {
      session = await this.getOrCreateSession(tenantId);
    }

    // Initialize or reset guardrails for this turn
    this.rateLimiter.resetTurn();

    // Get or create per-session circuit breaker
    let circuitBreaker = this.circuitBreakers.get(session.sessionId);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(config.circuitBreaker);
      this.circuitBreakers.set(session.sessionId, circuitBreaker);
    }

    // Periodic cleanup of old circuit breakers
    this.circuitBreakerCleanupCounter++;
    if (this.circuitBreakerCleanupCounter >= CLEANUP_INTERVAL_CALLS) {
      this.cleanupOldCircuitBreakers();
      this.circuitBreakerCleanupCounter = 0;
    }

    // Check circuit breaker before proceeding
    const circuitCheck = circuitBreaker.check();
    if (!circuitCheck.allowed) {
      logger.warn(
        { tenantId, sessionId: session.sessionId, reason: circuitCheck.reason },
        'Circuit breaker tripped'
      );
      recordCircuitBreakerTrip(circuitCheck.reason || 'unknown', config.agentType);
      return {
        message: `I've reached my session limit. ${circuitCheck.reason}. Please start a new conversation.`,
        sessionId: session.sessionId,
      };
    }

    // Process pending T2 proposals (soft-confirm on next message)
    const softConfirmWindow = SOFT_CONFIRM_WINDOWS[config.agentType];
    const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
      tenantId,
      session.sessionId, // Use resolved session ID
      userMessage,
      config.agentType
    );

    // Execute soft-confirmed proposals
    const failedProposals: Array<{ id: string; toolName: string; reason: string }> = [];
    if (softConfirmedIds.length > 0) {
      await this.executeConfirmedProposals(tenantId, softConfirmedIds, failedProposals, config);
    }

    // Build context and system prompt
    const promptContext: PromptContext = {
      tenantId,
      sessionId: session.sessionId,
    };
    let systemPrompt = await this.buildSystemPrompt(promptContext);

    // Add failure context if proposals failed
    if (failedProposals.length > 0) {
      const failureContext = failedProposals.map((f) => `- ${f.toolName}: ${f.reason}`).join('\n');
      systemPrompt += `\n\n---\n\n## Recent Action Failures\n\nSome actions failed:\n${failureContext}\n\nPlease acknowledge these failures and offer alternatives.`;
    }

    // Build conversation history
    const historyMessages = this.buildHistoryMessages(session.messages, config);
    const messages: MessageParam[] = [...historyMessages, { role: 'user', content: userMessage }];

    // Build tools for API
    const tools = this.buildToolsForAPI();

    // Call Claude API with retry logic
    let response: Anthropic.Messages.Message;
    try {
      response = await withRetry(
        () =>
          this.anthropic.messages.create({
            model: config.model,
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            system: systemPrompt,
            messages,
            tools,
          }),
        'claude-api-chat',
        CLAUDE_API_RETRY_CONFIG
      );
    } catch (error) {
      logger.error(
        { error: sanitizeError(error), tenantId, sessionId: session.sessionId },
        'Claude API call failed'
      );
      circuitBreaker.recordError();
      recordApiError('claude_api_error', config.agentType);
      throw new Error('Failed to communicate with AI assistant. Please try again.');
    }

    // Create budget tracker for this turn
    const budgetTracker = createBudgetTracker(config.tierBudgets);

    // Process response and tool calls
    const { finalMessage, toolResults, proposals } = await this.processResponse(
      response,
      tenantId,
      session.sessionId,
      messages,
      systemPrompt,
      0,
      budgetTracker
    );

    // Record turn for circuit breaker
    const estimatedTokens = Math.ceil(
      (userMessage.length + finalMessage.length) / 4 +
        (response.usage?.input_tokens || 0) +
        (response.usage?.output_tokens || 0)
    );
    circuitBreaker.recordTurn(estimatedTokens);
    circuitBreaker.recordSuccess();

    // Calculate turn duration and record metrics
    const turnDurationMs = Date.now() - startTime;
    const turnDurationSeconds = turnDurationMs / 1000;
    const hadToolCalls = toolResults !== undefined && toolResults.length > 0;

    recordTurnDuration(turnDurationSeconds, config.agentType, hadToolCalls);

    // Enhanced structured logging for observability
    logger.info(
      {
        tenantId,
        sessionId: session.sessionId,
        agentType: config.agentType,
        turnDurationMs,
        turnDurationSeconds: Math.round(turnDurationSeconds * 100) / 100,
        budgetUsed: budgetTracker.used,
        budgetRemaining: budgetTracker.remaining,
        rateLimitStats: this.rateLimiter.getStats(),
        circuitBreakerState: circuitBreaker.getState(),
        toolsExecuted: toolResults?.length || 0,
        proposalsCreated: proposals?.length || 0,
        hadToolCalls,
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
      'Agent turn completed'
    );

    // Update session with new messages
    await this.updateSession(
      session.sessionId,
      session.messages,
      userMessage,
      finalMessage,
      toolResults,
      config
    );

    // Audit log
    await this.auditService.logToolCall({
      tenantId,
      sessionId: session.sessionId,
      toolName: 'chat',
      inputSummary: userMessage.slice(0, 500),
      outputSummary: finalMessage.slice(0, 500),
      trustTier: 'T1',
      approvalStatus: 'AUTO',
      durationMs: Date.now() - startTime,
      success: true,
    });

    return {
      message: finalMessage,
      sessionId: session.sessionId,
      proposals,
      toolResults: toolResults?.map((r) => ({
        toolName: r.toolName,
        success: r.result.success,
        data: 'data' in r.result ? r.result.data : undefined,
        error: 'error' in r.result ? r.result.error : undefined,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Protected Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Execute confirmed proposals
   */
  protected async executeConfirmedProposals(
    tenantId: string,
    proposalIds: string[],
    failedProposals: Array<{ id: string; toolName: string; reason: string }>,
    config: OrchestratorConfig
  ): Promise<void> {
    logger.info(
      { tenantId, count: proposalIds.length, proposalIds },
      'Executing soft-confirmed proposals'
    );

    // Import executor registry dynamically to avoid circular dependencies
    const { getProposalExecutor } = await import('../proposals/executor-registry');
    const { validateExecutorPayload } = await import('../proposals/executor-schemas');

    // Fetch all proposals in batch
    const proposals = await this.prisma.agentProposal.findMany({
      where: {
        id: { in: proposalIds },
        tenantId, // Multi-tenant isolation
      },
    });

    // Build execution tasks
    type ExecutionTask = {
      proposalId: string;
      toolName: string;
      executor: (tenantId: string, payload: Record<string, unknown>) => Promise<unknown>;
      payload: Record<string, unknown>;
    };

    const executionTasks: ExecutionTask[] = [];
    const skippedProposals: Array<{ id: string; toolName: string; reason: string }> = [];

    for (const proposal of proposals) {
      const executor = getProposalExecutor(proposal.toolName);
      if (!executor) {
        skippedProposals.push({
          id: proposal.id,
          toolName: proposal.toolName,
          reason: `No executor for ${proposal.toolName}`,
        });
        continue;
      }

      const rawPayload = (proposal.payload as Record<string, unknown>) || {};
      let payload: Record<string, unknown>;
      try {
        payload = validateExecutorPayload(proposal.toolName, rawPayload);
      } catch (validationError) {
        const errorMessage =
          validationError instanceof Error ? validationError.message : String(validationError);
        skippedProposals.push({
          id: proposal.id,
          toolName: proposal.toolName,
          reason: errorMessage,
        });
        continue;
      }

      executionTasks.push({
        proposalId: proposal.id,
        toolName: proposal.toolName,
        executor,
        payload,
      });
    }

    // Mark skipped proposals as failed
    await Promise.all(
      skippedProposals.map(async (skipped) => {
        await this.proposalService.markFailed(skipped.id, skipped.reason);
        failedProposals.push(skipped);
      })
    );

    // Execute valid proposals in parallel with timeout
    if (executionTasks.length > 0) {
      const results = await Promise.allSettled(
        executionTasks.map(async (task) => {
          const result = await withTimeout(
            task.executor(tenantId, task.payload),
            config.executorTimeoutMs,
            task.toolName
          );
          return { task, result };
        })
      );

      // Process results
      await Promise.all(
        results.map(async (settledResult, index) => {
          const task = executionTasks[index];

          if (settledResult.status === 'fulfilled') {
            const executionResult = settledResult.value.result as Record<string, unknown>;
            await this.proposalService.markExecuted(task.proposalId, executionResult);
            logger.info(
              { proposalId: task.proposalId, toolName: task.toolName },
              'Proposal executed successfully'
            );
          } else {
            const errorMessage =
              settledResult.reason instanceof Error
                ? settledResult.reason.message
                : String(settledResult.reason);
            await this.proposalService.markFailed(task.proposalId, errorMessage);
            failedProposals.push({
              id: task.proposalId,
              toolName: task.toolName,
              reason: errorMessage,
            });
            logger.error(
              { proposalId: task.proposalId, toolName: task.toolName, error: errorMessage },
              'Proposal execution failed'
            );
          }
        })
      );
    }
  }

  /**
   * Build history messages for API call
   */
  protected buildHistoryMessages(
    messages: ChatMessage[],
    config: OrchestratorConfig
  ): MessageParam[] {
    return messages.slice(-config.maxHistoryMessages).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Build tools in Anthropic API format
   */
  protected buildToolsForAPI(): Anthropic.Messages.Tool[] {
    return this.getTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Messages.Tool.InputSchema,
    }));
  }

  /**
   * Process Claude response and execute tool calls
   */
  protected async processResponse(
    response: Anthropic.Messages.Message,
    tenantId: string,
    sessionId: string,
    messages: MessageParam[],
    systemPrompt: string,
    depth: number,
    budgetTracker: BudgetTracker
  ): Promise<{
    finalMessage: string;
    toolResults?: {
      toolName: string;
      input?: Record<string, unknown>;
      result: AgentToolResult;
    }[];
    proposals?: {
      proposalId: string;
      operation: string;
      preview: Record<string, unknown>;
      trustTier: string;
      requiresApproval: boolean;
    }[];
  }> {
    const config = this.getConfig();

    // Check recursion depth
    if (depth >= config.maxRecursionDepth) {
      logger.warn({ tenantId, sessionId, depth }, 'Recursion depth limit reached');
      return {
        finalMessage:
          "I've reached my limit for operations in a single request. Please send another message to continue.",
      };
    }

    // Check for tool calls
    const toolUseBlocks = response.content.filter(
      (block): block is ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      const textContent = response.content
        .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      return { finalMessage: textContent };
    }

    // Execute tool calls
    const toolResults: {
      toolName: string;
      input?: Record<string, unknown>;
      result: AgentToolResult;
    }[] = [];
    const proposals: {
      proposalId: string;
      operation: string;
      preview: Record<string, unknown>;
      trustTier: string;
      requiresApproval: boolean;
    }[] = [];
    const toolResultBlocks: ToolResultBlockParam[] = [];

    const toolContext: ToolContext = {
      tenantId,
      sessionId,
      prisma: this.prisma,
    };

    const availableTools = this.getTools();

    for (const toolUse of toolUseBlocks) {
      const startTime = Date.now();
      const tool = availableTools.find((t) => t.name === toolUse.name);

      if (!tool) {
        logger.warn({ toolName: toolUse.name }, 'Unknown tool requested');
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ success: false, error: "I don't recognize that action." }),
        });
        continue;
      }

      // Check rate limits
      const rateLimitCheck = this.rateLimiter.canCall(toolUse.name);
      if (!rateLimitCheck.allowed) {
        logger.warn({ toolName: toolUse.name, reason: rateLimitCheck.reason }, 'Tool rate limited');
        recordRateLimitHit(toolUse.name, config.agentType);
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            success: false,
            error: `Rate limit reached: ${rateLimitCheck.reason}`,
          }),
        });
        continue;
      }

      // Check tier budget (trustTier is required on AgentTool interface)
      const toolTier = tool.trustTier;
      if (!budgetTracker.consume(toolTier as keyof TierBudgets)) {
        logger.warn(
          { toolName: toolUse.name, tier: toolTier, remaining: budgetTracker.remaining },
          'Tier budget exhausted'
        );
        recordTierBudgetExhausted(toolTier, config.agentType);
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            success: false,
            error: `${toolTier} budget exhausted for this turn.`,
          }),
        });
        continue;
      }

      try {
        const result = await tool.execute(toolContext, toolUse.input as Record<string, unknown>);
        this.rateLimiter.recordCall(toolUse.name);

        // Record successful tool call metric
        recordToolCall(toolUse.name, toolTier, config.agentType, result.success);

        toolResults.push({
          toolName: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
          result,
        });

        // Check if result is a proposal
        if ('proposalId' in result && result.success) {
          proposals.push({
            proposalId: result.proposalId,
            operation: result.operation,
            preview: result.preview,
            trustTier: result.trustTier,
            requiresApproval: result.requiresApproval,
          });
          // Record proposal metric
          recordProposal('created', result.trustTier, config.agentType);
        }

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });

        // Audit and cache invalidation
        if (result.success) {
          if ('proposalId' in result) {
            await this.auditService.logProposalCreated(
              tenantId,
              sessionId,
              toolUse.name,
              result.proposalId,
              result.trustTier as 'T1' | 'T2' | 'T3',
              JSON.stringify(toolUse.input).slice(0, 500),
              Date.now() - startTime
            );
          } else {
            await this.auditService.logRead(
              tenantId,
              sessionId,
              toolUse.name,
              JSON.stringify(toolUse.input).slice(0, 500),
              JSON.stringify(result).slice(0, 500),
              Date.now() - startTime
            );
          }

          // Invalidate cache after write tools
          if (WRITE_TOOLS.has(toolUse.name)) {
            contextCache.invalidate(tenantId);
            logger.debug({ tenantId, toolName: toolUse.name }, 'Context cache invalidated');
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(
          { error: sanitizeError(error), toolName: toolUse.name },
          'Tool execution failed'
        );

        // Record failed tool call metric
        recordToolCall(toolUse.name, toolTier, config.agentType, false);

        toolResults.push({
          toolName: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
          result: { success: false, error: errorMessage },
        });

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ success: false, error: errorMessage }),
        });

        await this.auditService.logError(
          tenantId,
          sessionId,
          toolUse.name,
          JSON.stringify(toolUse.input).slice(0, 500),
          errorMessage,
          Date.now() - startTime
        );
      }
    }

    // Continue conversation with tool results
    const continuedMessages: MessageParam[] = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResultBlocks },
    ];

    // Get final response with retry
    const finalResponse = await withRetry(
      () =>
        this.anthropic.messages.create({
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          system: systemPrompt,
          messages: continuedMessages,
          tools: this.buildToolsForAPI(),
        }),
      'claude-api-tool-continuation',
      CLAUDE_API_RETRY_CONFIG
    );

    // Check for more tool calls (recursive)
    if (finalResponse.content.some((block) => block.type === 'tool_use')) {
      const recursiveResult = await this.processResponse(
        finalResponse,
        tenantId,
        sessionId,
        continuedMessages,
        systemPrompt,
        depth + 1,
        budgetTracker
      );
      return {
        finalMessage: recursiveResult.finalMessage,
        toolResults: [...toolResults, ...(recursiveResult.toolResults || [])],
        proposals: [...proposals, ...(recursiveResult.proposals || [])],
      };
    }

    // Extract final text
    const finalText = finalResponse.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return {
      finalMessage: finalText,
      toolResults,
      proposals,
    };
  }

  /**
   * Update session with new messages
   */
  protected async updateSession(
    sessionId: string,
    existingMessages: ChatMessage[],
    userMessage: string,
    assistantMessage: string,
    toolResults:
      | {
          toolName: string;
          input?: Record<string, unknown>;
          result: AgentToolResult;
        }[]
      | undefined,
    config: OrchestratorConfig
  ): Promise<void> {
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
    };

    const messageContent =
      assistantMessage || (toolResults && toolResults.length > 0 ? '[Tools executed]' : 'Done.');

    const newAssistantMessage: ChatMessage = {
      role: 'assistant',
      content: messageContent,
      toolUses: toolResults?.map((r) => ({
        toolName: r.toolName,
        input: r.input || {},
        result: r.result,
      })),
    };

    const updatedMessages = [...existingMessages, newUserMessage, newAssistantMessage].slice(
      -config.maxHistoryMessages
    );

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        messages: updatedMessages as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Invalidate context cache for tenant
   */
  invalidateContextCache(tenantId: string): void {
    contextCache.invalidate(tenantId);
  }

  /**
   * Cleanup old circuit breakers to prevent memory leaks
   *
   * Called periodically (every 100 chat calls) to remove stale circuit breakers.
   *
   * **Cleanup Strategy:**
   * 1. **Time-based cleanup (primary):** Remove circuit breakers older than session TTL.
   *    Sessions expire in the database after 60 minutes, so circuit breakers older than
   *    that are orphaned and can be safely removed.
   *
   * 2. **Hard cap (fallback):** Enforce maximum of 1000 entries to prevent unbounded
   *    memory growth. At ~130 bytes per entry, this caps memory at ~130KB.
   *
   * **Why not turnCount-based cleanup?**
   * Previously we removed circuit breakers with turns === 0, but this only catches
   * sessions created but never used (edge case). All active sessions have turns > 0
   * after their first message, so time-based cleanup is more effective.
   */
  private cleanupOldCircuitBreakers(): void {
    let removed = 0;
    const now = Date.now();

    // Session TTL is 60 minutes; add buffer to avoid race conditions
    const CIRCUIT_BREAKER_TTL_MS = 65 * 60 * 1000; // 65 minutes

    for (const [sessionId, circuitBreaker] of this.circuitBreakers) {
      const state = circuitBreaker.getState();
      const ageMs = now - state.startTime;

      // Remove circuit breakers older than TTL (orphaned after session expiry)
      if (ageMs > CIRCUIT_BREAKER_TTL_MS) {
        this.circuitBreakers.delete(sessionId);
        removed++;
      }
    }

    // Also enforce a hard cap to prevent unbounded growth
    if (this.circuitBreakers.size > MAX_CIRCUIT_BREAKERS) {
      // Remove oldest entries (first inserted due to Map ordering)
      const toRemove = this.circuitBreakers.size - MAX_CIRCUIT_BREAKERS;
      let removedForCap = 0;
      for (const [sessionId] of this.circuitBreakers) {
        if (removedForCap >= toRemove) break;
        this.circuitBreakers.delete(sessionId);
        removedForCap++;
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(
        { removed, remaining: this.circuitBreakers.size },
        'Cleaned up old circuit breakers'
      );
    }
  }
}
