/**
 * Customer Chat Orchestrator
 *
 * Simplified orchestrator for customer-facing chatbot.
 * Copy-modify approach from admin orchestrator - no shared abstractions yet.
 *
 * Key differences from admin orchestrator:
 * - Uses CUSTOMER_TOOLS (4 tools vs 30+ admin tools)
 * - Shorter conversation history (10 messages vs 20)
 * - Customer-focused system prompt
 * - Public-facing context (no business metrics)
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  ToolUseBlock,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import { Prisma, type PrismaClient } from '../../generated/prisma';
import type { ToolContext, AgentToolResult } from '../tools/types';
import { CUSTOMER_TOOLS, type CustomerToolContext } from './customer-tools';
import { buildCustomerSystemPrompt } from './customer-prompt';
import { ProposalService } from '../proposals/proposal.service';
import { AuditService } from '../audit/audit.service';
import { logger } from '../../lib/core/logger';
import { ErrorMessages } from '../errors';

/**
 * Configuration for customer orchestrator
 */
interface CustomerOrchestratorConfig {
  model: string;
  maxTokens: number;
  maxHistoryMessages: number;
  temperature?: number;
}

const DEFAULT_CONFIG: CustomerOrchestratorConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 2048, // Shorter responses for customer chat
  maxHistoryMessages: 10, // Shorter history for customer sessions
  temperature: 0.7,
};

/**
 * Maximum recursion depth for tool calls
 */
const MAX_RECURSION_DEPTH = 3;

/**
 * Patterns that indicate potential prompt injection attempts
 * These are common techniques used to manipulate LLM behavior
 */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:previous|your|all)\s+instruction/i,
  /disregard\s+(?:previous|your|all)\s+instruction/i,
  /you\s+are\s+now/i,
  /system\s*prompt/i,
  /\[system\]/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+(?:if\s+you\s+are|a)/i,
  /reveal\s+(?:your|the)\s+(?:system|initial)\s+prompt/i,
];

/**
 * Customer context for session
 */
export interface CustomerSessionContext {
  tenantId: string;
  sessionId: string;
  customerId: string | null;
  businessName: string;
}

/**
 * Chat message for history
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
 * Session state
 */
export interface CustomerSessionState {
  sessionId: string;
  tenantId: string;
  customerId: string | null;
  messages: ChatMessage[];
  businessName: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat response
 */
export interface CustomerChatResponse {
  message: string;
  sessionId: string;
  proposal?: {
    proposalId: string;
    operation: string;
    preview: Record<string, unknown>;
    trustTier: string;
    requiresApproval: boolean;
  };
  toolResults?: {
    toolName: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }[];
}

/**
 * Customer Chat Orchestrator
 */
export class CustomerOrchestrator {
  private anthropic: Anthropic;
  private config: CustomerOrchestratorConfig;
  private proposalService: ProposalService;
  private auditService: AuditService;

  constructor(
    private readonly prisma: PrismaClient,
    config: Partial<CustomerOrchestratorConfig> = {}
  ) {
    // Validate API key at startup - fail fast with clear error
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is required for customer chat. ' +
          'Set it in your environment or disable customer chat.'
      );
    }

    // Warn if API key format is unexpected (but don't fail - format may change)
    if (!apiKey.startsWith('sk-ant-')) {
      logger.warn(
        { keyPrefix: apiKey.substring(0, 10) },
        'ANTHROPIC_API_KEY has unexpected format (expected sk-ant-...)'
      );
    }

    this.anthropic = new Anthropic({
      apiKey,
      timeout: 30 * 1000, // 30 second timeout
      maxRetries: 2,
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.proposalService = new ProposalService(prisma);
    this.auditService = new AuditService(prisma);
  }

  /**
   * Get or create session for a tenant
   */
  async getOrCreateSession(tenantId: string): Promise<CustomerSessionState> {
    // Look for existing active session (within last 1 hour for customer sessions)
    const existingSession = await this.prisma.agentSession.findFirst({
      where: {
        tenantId,
        sessionType: 'CUSTOMER',
        updatedAt: {
          gt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour TTL
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get tenant info
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    if (!tenant) {
      throw new Error('Unable to load business information. Please try again.');
    }

    if (existingSession) {
      return {
        sessionId: existingSession.id,
        tenantId,
        customerId: existingSession.customerId,
        messages: (existingSession.messages as unknown as ChatMessage[]) || [],
        businessName: tenant.name,
        createdAt: existingSession.createdAt,
        updatedAt: existingSession.updatedAt,
      };
    }

    // Create new customer session
    const newSession = await this.prisma.agentSession.create({
      data: {
        tenantId,
        sessionType: 'CUSTOMER',
        messages: [],
      },
    });

    logger.info({ tenantId, sessionId: newSession.id }, 'New customer chat session created');

    return {
      sessionId: newSession.id,
      tenantId,
      customerId: null,
      messages: [],
      businessName: tenant.name,
      createdAt: newSession.createdAt,
      updatedAt: newSession.updatedAt,
    };
  }

  /**
   * Get existing session by ID
   * Uses single query with include to fetch session + tenant data
   */
  async getSession(tenantId: string, sessionId: string): Promise<CustomerSessionState | null> {
    const session = await this.prisma.agentSession.findFirst({
      where: {
        id: sessionId,
        tenantId, // CRITICAL: Tenant isolation
        sessionType: 'CUSTOMER',
      },
      include: {
        tenant: {
          select: { name: true },
        },
      },
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      tenantId,
      customerId: session.customerId,
      messages: (session.messages as unknown as ChatMessage[]) || [],
      businessName: session.tenant.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Check for potential prompt injection patterns
   * Returns true if injection attempt detected
   *
   * Uses NFKC normalization to catch Unicode lookalike characters
   * (e.g., 'ⅰgnore' → 'ignore') and zero-width characters
   * (e.g., 'ignore\u200Bprevious' → 'ignoreprevious')
   */
  private detectPromptInjection(message: string): boolean {
    // Normalize unicode to catch lookalike characters and zero-width chars
    const normalized = message.normalize('NFKC');
    return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  /**
   * Send a message and get response
   */
  async chat(
    tenantId: string,
    sessionId: string,
    userMessage: string
  ): Promise<CustomerChatResponse> {
    const startTime = Date.now();

    // SECURITY: Check for prompt injection attempts (P2 fix from code review)
    if (this.detectPromptInjection(userMessage)) {
      logger.warn(
        { tenantId, sessionId, messagePreview: userMessage.slice(0, 100) },
        'Potential prompt injection attempt detected'
      );
      // Return generic response instead of passing to LLM
      return {
        message: "I'm here to help you with booking questions. How can I assist you today?",
        sessionId,
      };
    }

    // Get or validate session
    let session = await this.getSession(tenantId, sessionId);
    if (!session) {
      session = await this.getOrCreateSession(tenantId);
    }

    // Build context for system prompt (cached for this request)
    const businessContext = await this.buildBusinessContext(tenantId);
    const businessName = session.businessName;

    // Build system prompt
    const systemPrompt = buildCustomerSystemPrompt(session.businessName, businessContext);

    // Convert session history to API format
    const historyMessages = this.buildHistoryMessages(session.messages);

    // Add user message
    const messages: MessageParam[] = [...historyMessages, { role: 'user', content: userMessage }];

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
      throw new Error('Sorry, I encountered an error. Please try again.');
    }

    // Process response - handle tool calls if any
    // Pass cached businessContext and businessName to avoid redundant DB queries
    const { finalMessage, toolResults, proposal } = await this.processResponse(
      response,
      tenantId,
      sessionId,
      session.customerId,
      messages,
      0, // depth
      { businessContext, businessName }
    );

    logger.debug(
      {
        tenantId,
        sessionId,
        hasProposal: !!proposal,
        proposalId: proposal?.proposalId,
        requiresApproval: proposal?.requiresApproval,
        toolResultsCount: toolResults?.length,
        toolNames: toolResults?.map((r) => r.toolName),
      },
      'Customer chat processResponse result'
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

    const updatedMessages = [...session.messages, newUserMessage, newAssistantMessage].slice(
      -this.config.maxHistoryMessages
    );

    await this.prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        messages: updatedMessages as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Log audit
    await this.auditService.logToolCall({
      tenantId,
      sessionId,
      toolName: 'customer_chat',
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
      proposal,
      toolResults: toolResults?.map((r) => ({
        toolName: r.toolName,
        success: r.result.success,
        data: 'data' in r.result ? r.result.data : undefined,
        error: 'error' in r.result ? r.result.error : undefined,
      })),
    };
  }

  /**
   * Get greeting for new session
   */
  async getGreeting(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    if (!tenant) {
      return 'Hi! I can help you book an appointment. What are you looking for?';
    }

    return `Hi! I can help you book an appointment with ${tenant.name}. What are you looking for?`;
  }

  /**
   * Build business context for system prompt
   */
  private async buildBusinessContext(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        packages: {
          where: { active: true },
          select: { name: true, basePrice: true, description: true },
          orderBy: { name: 'asc' },
          take: 10,
        },
      },
    });

    if (!tenant) {
      return 'Business information unavailable.';
    }

    const packageList = tenant.packages
      .map(
        (p) =>
          `- ${p.name}: $${(p.basePrice / 100).toFixed(2)}${p.description ? ` - ${p.description.slice(0, 100)}` : ''}`
      )
      .join('\n');

    return `
## Business: ${tenant.name}

### Available Services
${packageList || 'No services listed yet.'}

### Contact
${tenant.email || 'Contact information not available.'}
`;
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
    return CUSTOMER_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Messages.Tool.InputSchema,
    }));
  }

  /**
   * Process Claude response, executing tool calls as needed
   */
  private async processResponse(
    response: Anthropic.Messages.Message,
    tenantId: string,
    sessionId: string,
    customerId: string | null,
    messages: MessageParam[],
    depth: number = 0,
    cachedContext?: { businessContext: string; businessName: string }
  ): Promise<{
    finalMessage: string;
    toolResults?: {
      toolName: string;
      input?: Record<string, unknown>;
      result: AgentToolResult;
    }[];
    proposal?: {
      proposalId: string;
      operation: string;
      preview: Record<string, unknown>;
      trustTier: string;
      requiresApproval: boolean;
    };
  }> {
    // Check recursion depth
    if (depth >= MAX_RECURSION_DEPTH) {
      logger.warn({ tenantId, sessionId, depth }, 'Customer chat recursion depth limit reached');
      return {
        finalMessage:
          "I've done what I can with this request. Is there anything else I can help you with?",
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
    let proposal:
      | {
          proposalId: string;
          operation: string;
          preview: Record<string, unknown>;
          trustTier: string;
          requiresApproval: boolean;
        }
      | undefined;
    const toolResultBlocks: ToolResultBlockParam[] = [];

    const toolContext: CustomerToolContext = {
      tenantId,
      sessionId,
      prisma: this.prisma,
      customerId,
      proposalService: this.proposalService,
    };

    for (const toolUse of toolUseBlocks) {
      const startTime = Date.now();
      const tool = CUSTOMER_TOOLS.find((t) => t.name === toolUse.name);

      if (!tool) {
        logger.warn({ toolName: toolUse.name }, 'Unknown customer tool requested');
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({
            success: false,
            error: "I don't recognize that action. Please try a different request.",
          }),
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
          proposal = {
            proposalId: result.proposalId,
            operation: result.operation,
            preview: result.preview,
            trustTier: result.trustTier,
            requiresApproval: result.requiresApproval,
          };
          logger.debug(
            {
              toolName: toolUse.name,
              proposalId: result.proposalId,
              trustTier: result.trustTier,
              requiresApproval: result.requiresApproval,
            },
            'Proposal captured from tool result'
          );
        }

        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });

        // Audit log
        if (result.success) {
          await this.auditService.logRead(
            tenantId,
            sessionId,
            toolUse.name,
            JSON.stringify(toolUse.input).slice(0, 500),
            JSON.stringify(result).slice(0, 500),
            Date.now() - startTime
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error({ error, toolName: toolUse.name }, 'Customer tool execution failed');

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
      }
    }

    // Continue conversation with tool results
    const continuedMessages: MessageParam[] = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResultBlocks },
    ];

    // Use cached context if available, otherwise fetch (shouldn't happen in normal flow)
    const businessContext =
      cachedContext?.businessContext ?? (await this.buildBusinessContext(tenantId));
    const businessName = cachedContext?.businessName ?? 'Business';
    const systemPrompt = buildCustomerSystemPrompt(businessName, businessContext);

    // Get final response from Claude
    const finalResponse = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemPrompt,
      messages: continuedMessages,
      tools: this.buildToolsForAPI(),
    });

    // Check for more tool calls (recursive with depth limit)
    if (finalResponse.content.some((block) => block.type === 'tool_use')) {
      const recursiveResult = await this.processResponse(
        finalResponse,
        tenantId,
        sessionId,
        customerId,
        continuedMessages,
        depth + 1,
        cachedContext // Pass cached context to avoid redundant DB queries
      );
      return {
        finalMessage: recursiveResult.finalMessage,
        toolResults: [...toolResults, ...(recursiveResult.toolResults || [])],
        proposal: recursiveResult.proposal || proposal,
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
      proposal,
    };
  }
}
