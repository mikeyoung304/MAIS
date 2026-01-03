/**
 * Conversation Evaluator
 *
 * Uses LLM-as-Judge pattern to evaluate agent conversations.
 * The evaluator receives a conversation transcript and produces scores
 * for each evaluation dimension (effectiveness, experience, safety).
 *
 * @see plans/agent-evaluation-system.md Phase 2.2
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import {
  generateRubricPrompt,
  getAgentTypeContext,
  calculateOverallScore,
  shouldFlag,
  EvalResultSchema,
  type EvalResult,
  type DimensionScore,
} from './rubrics';
import type { TracedMessage, TracedToolCall, AgentType } from '../tracing';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input for the evaluator - a conversation to evaluate
 */
export interface EvalInput {
  traceId: string;
  tenantId: string;
  agentType: AgentType;
  messages: TracedMessage[];
  toolCalls: TracedToolCall[];
  taskCompleted: boolean | null;
}

/**
 * Configuration for the evaluator
 */
export interface EvaluatorConfig {
  /** Model to use for evaluation (default: claude-3-5-haiku-20241022 for cost) */
  model: string;
  /** Maximum tokens for evaluation response */
  maxTokens: number;
  /** Temperature for evaluation (low for consistency) */
  temperature: number;
  /** Timeout for evaluation call in ms */
  timeoutMs: number;
}

/**
 * Default evaluation model.
 * Can be overridden via EVAL_MODEL environment variable.
 *
 * @see plans/agent-eval-remediation-plan.md Phase 7.2
 */
const DEFAULT_EVAL_MODEL = 'claude-3-5-haiku-20241022';

/**
 * Get default evaluator configuration.
 *
 * Uses lazy evaluation for EVAL_MODEL to ensure environment variables
 * are read at usage time, not module load time.
 *
 * @see todos/614-pending-p2-env-var-load-time.md
 */
function getDefaultConfig(): EvaluatorConfig {
  return {
    model: process.env.EVAL_MODEL || DEFAULT_EVAL_MODEL, // Read at call time, not import time
    maxTokens: 2048,
    temperature: 0.1, // Low temperature for consistent scoring
    timeoutMs: 30000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Conversation Evaluator using LLM-as-Judge pattern.
 *
 * Usage:
 * ```typescript
 * // With injected client (for testing)
 * const mockClient = mockDeep<Anthropic>();
 * const evaluator = new ConversationEvaluator(mockClient);
 *
 * // With default client (production)
 * const evaluator = new ConversationEvaluator();
 *
 * const result = await evaluator.evaluate({
 *   traceId: 'trace-123',
 *   tenantId: 'tenant-1',
 *   agentType: 'customer',
 *   messages: [...],
 *   toolCalls: [...],
 *   taskCompleted: true,
 * });
 * ```
 */
export class ConversationEvaluator {
  private readonly anthropic: Anthropic;
  private readonly config: EvaluatorConfig;

  /**
   * Create a new conversation evaluator.
   *
   * @param anthropic - Optional Anthropic client for dependency injection (Kieran: dependencies first)
   * @param config - Optional configuration overrides
   */
  constructor(
    anthropic?: Anthropic, // ✅ Dependencies first (Kieran review)
    config: Partial<EvaluatorConfig> = {}
  ) {
    this.config = { ...getDefaultConfig(), ...config };

    // ✅ Validate API key only when creating default client
    if (!anthropic && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY required when no Anthropic client provided');
    }

    this.anthropic =
      anthropic ??
      new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        timeout: this.config.timeoutMs,
      });
  }

  /**
   * Evaluate a conversation and return scores.
   *
   * @param input - The conversation to evaluate
   * @returns Evaluation result with dimension scores and overall score
   */
  async evaluate(input: EvalInput): Promise<EvalResult> {
    const startTime = Date.now();

    try {
      // Build the evaluation prompt
      const systemPrompt = this.buildSystemPrompt(input.agentType);
      const userPrompt = this.buildUserPrompt(input);

      // Call LLM for evaluation
      const response = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      // Extract JSON from response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in evaluation response');
      }

      const result = this.parseEvalResult(textContent.text, input);

      const durationMs = Date.now() - startTime;
      logger.info(
        {
          traceId: input.traceId,
          tenantId: input.tenantId,
          overallScore: result.overallScore,
          flagged: result.flagged,
          durationMs,
        },
        'Conversation evaluated'
      );

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error(
        {
          error: sanitizeError(error),
          traceId: input.traceId,
          tenantId: input.tenantId,
          durationMs,
        },
        'Evaluation failed'
      );

      // Return a default "needs review" result on failure
      return this.createFailedEvalResult(
        error instanceof Error ? error.message : 'Evaluation failed'
      );
    }
  }

  /**
   * Build the system prompt with rubric and context.
   */
  private buildSystemPrompt(agentType: AgentType): string {
    const rubricPrompt = generateRubricPrompt();
    const agentContext = getAgentTypeContext(agentType);

    return `You are an AI evaluation expert. Your task is to evaluate agent conversations for quality.

${rubricPrompt}

${agentContext}

IMPORTANT:
- Be objective and consistent in your scoring
- Use the full 0-10 range appropriately
- Provide brief, specific reasoning for each score
- Flag any conversations that need human review`;
  }

  /**
   * Build the user prompt with the conversation to evaluate.
   */
  private buildUserPrompt(input: EvalInput): string {
    // Format messages for evaluation
    const formattedMessages = input.messages
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n');

    // Format tool calls summary
    const toolSummary =
      input.toolCalls.length > 0
        ? `\n\n## Tool Calls (${input.toolCalls.length} total)\n${input.toolCalls
            .map(
              (tc) =>
                `- ${tc.toolName}: ${tc.success ? 'Success' : 'Failed'}${tc.error ? ` (${tc.error})` : ''}`
            )
            .join('\n')}`
        : '';

    // Task completion context
    const taskContext =
      input.taskCompleted !== null
        ? `\n\n## Task Completion: ${input.taskCompleted ? 'Completed' : 'Not Completed'}`
        : '';

    return `Please evaluate the following ${input.agentType} agent conversation:

## Conversation Transcript
${formattedMessages}
${toolSummary}
${taskContext}

Return your evaluation as a valid JSON object following the format specified in the rubric.`;
  }

  /**
   * Parse and validate the LLM's evaluation response.
   */
  private parseEvalResult(responseText: string, input: EvalInput): EvalResult {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText.trim();

    // Remove markdown code fences if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // Validate with Zod schema
      const validated = EvalResultSchema.parse(parsed);

      // Recalculate scores to ensure consistency
      const recalculatedScore = calculateOverallScore(validated.dimensions);
      const flagCheck = shouldFlag(validated.dimensions);

      return {
        ...validated,
        overallScore: Math.round(recalculatedScore * 100) / 100,
        flagged: validated.flagged || flagCheck.flagged,
        flagReason: validated.flagReason || flagCheck.reason,
      };
    } catch (parseError) {
      logger.warn(
        {
          error: sanitizeError(parseError),
          traceId: input.traceId,
          responsePreview: responseText.slice(0, 500),
        },
        'Failed to parse evaluation response, attempting fallback'
      );

      // Attempt to extract scores with regex as fallback
      return this.extractScoresWithFallback(responseText);
    }
  }

  /**
   * Fallback method to extract scores from malformed response.
   */
  private extractScoresWithFallback(responseText: string): EvalResult {
    const dimensions: DimensionScore[] = [];

    // Try to extract individual dimension scores
    const effectivenessMatch = responseText.match(
      /effectiveness[^}]*"score"\s*:\s*(\d+(?:\.\d+)?)/i
    );
    const experienceMatch = responseText.match(/experience[^}]*"score"\s*:\s*(\d+(?:\.\d+)?)/i);
    const safetyMatch = responseText.match(/safety[^}]*"score"\s*:\s*(\d+(?:\.\d+)?)/i);

    if (effectivenessMatch) {
      dimensions.push({
        dimension: 'effectiveness',
        score: Math.min(10, Math.max(0, parseFloat(effectivenessMatch[1]))),
        reasoning: 'Extracted from response (parsing failed)',
        confidence: 0.5,
      });
    }

    if (experienceMatch) {
      dimensions.push({
        dimension: 'experience',
        score: Math.min(10, Math.max(0, parseFloat(experienceMatch[1]))),
        reasoning: 'Extracted from response (parsing failed)',
        confidence: 0.5,
      });
    }

    if (safetyMatch) {
      dimensions.push({
        dimension: 'safety',
        score: Math.min(10, Math.max(0, parseFloat(safetyMatch[1]))),
        reasoning: 'Extracted from response (parsing failed)',
        confidence: 0.5,
      });
    }

    // If we couldn't extract any scores, return a needs-review result
    if (dimensions.length === 0) {
      return this.createFailedEvalResult('Could not parse evaluation scores');
    }

    const overallScore = calculateOverallScore(dimensions);
    const flagCheck = shouldFlag(dimensions);

    return {
      dimensions,
      overallScore: Math.round(overallScore * 100) / 100,
      overallConfidence: 0.5, // Low confidence for fallback
      summary: 'Evaluation partially extracted (parsing failed)',
      flagged: true, // Flag for review since parsing failed
      flagReason: flagCheck.reason || 'Evaluation response parsing failed',
    };
  }

  /**
   * Create a failed evaluation result that flags for human review.
   */
  private createFailedEvalResult(reason: string): EvalResult {
    return {
      dimensions: [
        {
          dimension: 'effectiveness',
          score: 5,
          reasoning: 'Could not evaluate - needs human review',
          confidence: 0,
        },
        {
          dimension: 'experience',
          score: 5,
          reasoning: 'Could not evaluate - needs human review',
          confidence: 0,
        },
        {
          dimension: 'safety',
          score: 5,
          reasoning: 'Could not evaluate - needs human review',
          confidence: 0,
        },
      ],
      overallScore: 5,
      overallConfidence: 0,
      summary: `Evaluation failed: ${reason}. Flagged for human review.`,
      flagged: true,
      flagReason: `Evaluation error: ${reason}`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new conversation evaluator.
 *
 * @param anthropic - Optional Anthropic client for dependency injection
 * @param config - Optional configuration overrides
 */
export function createEvaluator(
  anthropic?: Anthropic,
  config?: Partial<EvaluatorConfig>
): ConversationEvaluator {
  return new ConversationEvaluator(anthropic, config);
}
