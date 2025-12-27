/**
 * Agent Orchestrator
 *
 * Connects Claude API to MAIS agent tools.
 * Handles conversation history, tool execution, and T2 soft-confirm.
 *
 * Architecture:
 * - Uses Anthropic SDK with tool_use feature
 * - Sliding window conversation history (last N messages)
 * - Server-side proposal mechanism for write operations
 * - Audit logging for all interactions
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { PrismaClient } from '../../generated/prisma';
import { readTools } from '../tools/read-tools';
import { writeTools } from '../tools/write-tools';
import { getAllTools } from '../index';
import type { ToolContext, AgentToolResult } from '../tools/types';
import { buildSessionContext, detectOnboardingPath, buildFallbackContext } from '../context/context-builder';
import type { AgentSessionContext } from '../context/context-builder';
import { ProposalService } from '../proposals/proposal.service';
import { AuditService } from '../audit/audit.service';
import { logger } from '../../lib/core/logger';

/**
 * System prompt template
 */
const SYSTEM_PROMPT_TEMPLATE = `# MAIS Business Growth Agent - System Prompt v2.0

## Identity

You are the MAIS Business Growth Assistant - an expert at helping service providers launch booking-based businesses.

You work with photographers, wellness coaches, private chefs, and creative professionals who want to focus on their craft, not administration. Your job is to handle the "business thinking" so they can do what they love.

You are friendly, knowledgeable, and specific. You give concrete recommendations with real numbers, not vague advice. You speak like a trusted business advisor.

---

## Core Rules

### ALWAYS
- **Propose before changing:** Show what you'll do, get confirmation based on trust tier
- **Be specific:** "$3,500" not "competitive pricing"
- **Explain your reasoning:** "I'd price this at $X because..."
- **Use tools for current data:** Don't guess - call get_dashboard or get_packages

### NEVER
- Execute T3 operations without explicit "yes"/"confirm"/"do it"
- Make promises about revenue or guarantees
- Pretend to know things - ask clarifying questions instead
- Retry failed operations without asking

---

## Trust Tiers

| Tier | When | Your Behavior |
|------|------|---------------|
| **T1** | Blackouts, branding, file uploads | Do it, report result |
| **T2** | Package changes, pricing, storefront | "I'll update X. Say 'wait' if that's wrong" then proceed |
| **T3** | Cancellations, refunds, deletes | MUST get explicit "yes"/"confirm" before proceeding |

For T3 operations, always explain consequences first:
"To cancel Sarah's booking, I'll issue a $500 refund and notify her. Confirm?"

---

## Tool Usage

**Read tools:** Use freely to understand current state
**Write tools:** Follow trust tier protocol above
**If a tool fails:** Explain simply, suggest a fix, ask before retrying

---

## Error Handling

When tools fail:
"I couldn't [action] because [reason].
[Suggested fix]. Want me to try that?"

---

## Anti-Patterns (Don't Do These)

❌ **Vague:** "You could raise your prices" → Be specific: "I'd raise Wedding Day to $4,000"
❌ **Assume approval:** "I'll update that now" → Follow trust tier protocol
❌ **Over-explain:** "As an AI, I can help you..." → Just help them

---

{BUSINESS_CONTEXT}
`;

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  model: string;
  maxTokens: number;
  maxHistoryMessages: number;
  temperature?: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  maxHistoryMessages: 20, // Sliding window
  temperature: 0.7,
};

/**
 * Maximum recursion depth for tool calls.
 * Prevents unbounded API costs and stack overflow from malicious prompts.
 */
const MAX_RECURSION_DEPTH = 5;

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
  context: AgentSessionContext;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat response from orchestrator
 */
export interface ChatResponse {
  message: string;
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
 * Agent Orchestrator
 */
export class AgentOrchestrator {
  private anthropic: Anthropic;
  private config: OrchestratorConfig;
  private proposalService: ProposalService;
  private auditService: AuditService;

  constructor(
    private readonly prisma: PrismaClient,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.proposalService = new ProposalService(prisma);
    this.auditService = new AuditService(prisma);
  }

  /**
   * Create or get session for a tenant
   */
  async getOrCreateSession(tenantId: string): Promise<SessionState> {
    // Look for existing active session (within last 24 hours)
    const existingSession = await this.prisma.agentSession.findFirst({
      where: {
        tenantId,
        updatedAt: {
          gt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (existingSession) {
      const context = await this.buildContext(tenantId, existingSession.id);
      return {
        sessionId: existingSession.id,
        tenantId,
        messages: (existingSession.messages as unknown as ChatMessage[]) || [],
        context,
        createdAt: existingSession.createdAt,
        updatedAt: existingSession.updatedAt,
      };
    }

    // Create new session
    const newSession = await this.prisma.agentSession.create({
      data: {
        tenantId,
        messages: [],
      },
    });

    const context = await this.buildContext(tenantId, newSession.id);

    logger.info({ tenantId, sessionId: newSession.id }, 'New agent session created');

    return {
      sessionId: newSession.id,
      tenantId,
      messages: [],
      context,
      createdAt: newSession.createdAt,
      updatedAt: newSession.updatedAt,
    };
  }

  /**
   * Get existing session by ID
   */
  async getSession(tenantId: string, sessionId: string): Promise<SessionState | null> {
    const session = await this.prisma.agentSession.findFirst({
      where: {
        id: sessionId,
        tenantId, // CRITICAL: Tenant isolation
      },
    });

    if (!session) {
      return null;
    }

    const context = await this.buildContext(tenantId, sessionId);

    return {
      sessionId: session.id,
      tenantId,
      messages: (session.messages as unknown as ChatMessage[]) || [],
      context,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Send a message and get response
   */
  async chat(tenantId: string, sessionId: string, userMessage: string): Promise<ChatResponse> {
    const startTime = Date.now();

    // Get or validate session
    let session = await this.getSession(tenantId, sessionId);
    if (!session) {
      session = await this.getOrCreateSession(tenantId);
    }

    // T2 soft-confirm: Process pending proposals if user doesn't say "wait"
    const softConfirmedIds = await this.proposalService.softConfirmPendingT2(
      tenantId,
      sessionId,
      userMessage
    );

    if (softConfirmedIds.length > 0) {
      logger.info(
        { tenantId, sessionId, count: softConfirmedIds.length },
        'T2 proposals soft-confirmed by user message'
      );
    }

    // Build messages for Claude API
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
      '{BUSINESS_CONTEXT}',
      session.context.contextPrompt
    );

    // Convert session history to API format with sliding window
    const historyMessages = this.buildHistoryMessages(session.messages);

    // Add user message
    const messages: MessageParam[] = [
      ...historyMessages,
      { role: 'user', content: userMessage },
    ];

    // Build tools for API
    const tools = this.buildToolsForAPI();

    // Call Claude API
    let response: Anthropic.Messages.Message;
    try {
      response = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages,
        tools,
      });
    } catch (error) {
      logger.error({ error, tenantId, sessionId }, 'Claude API call failed');
      throw new Error('Failed to communicate with AI assistant');
    }

    // Process response - handle tool calls if any
    const { finalMessage, toolResults, proposals } = await this.processResponse(
      response,
      tenantId,
      sessionId,
      messages
    );

    // Update session with new messages
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
    };

    const newAssistantMessage: ChatMessage = {
      role: 'assistant',
      content: finalMessage,
      toolUses: toolResults?.map((r) => ({
        toolName: r.toolName,
        input: r.input || {},
        result: r.result,
      })),
    };

    const updatedMessages = [
      ...session.messages,
      newUserMessage,
      newAssistantMessage,
    ].slice(-this.config.maxHistoryMessages);

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        messages: updatedMessages as any,
        updatedAt: new Date(),
      },
    });

    // Log audit
    await this.auditService.logToolCall({
      tenantId,
      sessionId,
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
      proposals,
      toolResults: toolResults?.map((r) => ({
        toolName: r.toolName,
        success: r.result.success,
        data: 'data' in r.result ? r.result.data : undefined,
        error: 'error' in r.result ? r.result.error : undefined,
      })),
    };
  }

  /**
   * Get initial greeting based on user context
   */
  async getGreeting(tenantId: string, sessionId: string): Promise<string> {
    const session = await this.getSession(tenantId, sessionId);
    if (!session) {
      return 'Welcome! How can I help you today?';
    }

    const { userType, suggestedMessage } = detectOnboardingPath(session.context);
    return suggestedMessage;
  }

  /**
   * Build context for session
   */
  private async buildContext(tenantId: string, sessionId: string): Promise<AgentSessionContext> {
    try {
      return await buildSessionContext(this.prisma, tenantId, sessionId);
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to build session context');
      return buildFallbackContext(tenantId, sessionId);
    }
  }

  /**
   * Build history messages for API call
   */
  private buildHistoryMessages(messages: ChatMessage[]): MessageParam[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Build tools in Anthropic API format
   */
  private buildToolsForAPI(): Anthropic.Messages.Tool[] {
    const allTools = getAllTools();

    return allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Messages.Tool.InputSchema,
    }));
  }

  /**
   * Process Claude response, executing tool calls as needed.
   * @param depth - Current recursion depth (prevents unbounded tool call loops)
   */
  private async processResponse(
    response: Anthropic.Messages.Message,
    tenantId: string,
    sessionId: string,
    messages: MessageParam[],
    depth: number = 0
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
    // Check recursion depth limit
    if (depth >= MAX_RECURSION_DEPTH) {
      logger.warn(
        { tenantId, sessionId, depth },
        'Tool recursion depth limit reached - preventing further tool calls'
      );
      return {
        finalMessage: "I've reached my limit for tool operations in a single request. Let me summarize what I've done so far. If you need more actions, please send another message.",
      };
    }

    // Check if response has tool calls
    const toolUseBlocks = response.content.filter(
      (block): block is ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls - extract text response
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

    for (const toolUse of toolUseBlocks) {
      const startTime = Date.now();
      const tool = getAllTools().find((t) => t.name === toolUse.name);

      if (!tool) {
        logger.warn({ toolName: toolUse.name }, 'Unknown tool requested');
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ success: false, error: 'Unknown tool' }),
        });
        continue;
      }

      try {
        const result = await tool.execute(toolContext, toolUse.input as Record<string, unknown>);

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
        }

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });

        // Audit log
        if (result.success) {
          if ('proposalId' in result) {
            await this.auditService.logProposalCreated(
              tenantId,
              sessionId,
              toolUse.name,
              result.proposalId,
              result.trustTier as any,
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
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error, toolName: toolUse.name }, 'Tool execution failed');

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

    // Get final response from Claude
    const finalResponse = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: SYSTEM_PROMPT_TEMPLATE.replace(
        '{BUSINESS_CONTEXT}',
        (await this.buildContext(tenantId, sessionId)).contextPrompt
      ),
      messages: continuedMessages,
      tools: this.buildToolsForAPI(),
    });

    // Check for more tool calls (recursive with depth limit)
    if (finalResponse.content.some((block) => block.type === 'tool_use')) {
      // Recursively handle more tool calls (increment depth to enforce limit)
      const recursiveResult = await this.processResponse(
        finalResponse,
        tenantId,
        sessionId,
        continuedMessages,
        depth + 1
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
}
