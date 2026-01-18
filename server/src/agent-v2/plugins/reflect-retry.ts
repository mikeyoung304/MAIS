/**
 * ReflectAndRetry Plugin
 *
 * Self-healing plugin that retries failed operations with reflection.
 * When a tool call fails, this plugin:
 * 1. Analyzes the error
 * 2. Generates a reflection prompt
 * 3. Retries with adjusted parameters
 *
 * From Gemini guidance: "This prevents the Orchestrator from crashing
 * if a sub-agent fails."
 */

import { logger } from '../../lib/core/logger.js';

interface ReflectAndRetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Template for reflection prompt. Use {error} placeholder. */
  reflectionPrompt: string;
  /** Tool-specific retry strategies */
  toolStrategies?: Record<string, ToolRetryStrategy>;
}

interface ToolRetryStrategy {
  /** Whether to simplify parameters on retry */
  simplifyOnRetry?: boolean;
  /** Fallback suggestion if all retries fail */
  fallbackSuggestion?: string;
  /** Maximum retries for this specific tool (overrides default) */
  maxRetries?: number;
}

interface PluginContext {
  session: {
    id: string;
    state: Map<string, unknown>;
  };
}

interface RetryResult {
  retry: boolean;
  reflection?: string;
  simplifiedArgs?: Record<string, unknown>;
}

interface FailureResult {
  success: false;
  error: string;
  fallback_suggestion: string;
}

const DEFAULT_TOOL_STRATEGIES: Record<string, ToolRetryStrategy> = {
  generate_image: {
    simplifyOnRetry: true,
    fallbackSuggestion: 'Try a simpler prompt or different style',
  },
  generate_video: {
    simplifyOnRetry: true,
    fallbackSuggestion: 'Try a shorter duration or simpler scene',
    maxRetries: 2, // Videos are expensive, fewer retries
  },
  search_competitors: {
    simplifyOnRetry: false,
    fallbackSuggestion: 'Try a different search term or location',
  },
  scrape_pricing: {
    simplifyOnRetry: false,
    fallbackSuggestion: 'The competitor site may be blocking - try another competitor',
  },
  generate_headline: {
    simplifyOnRetry: false,
    fallbackSuggestion: 'Try providing more context about your brand',
  },
};

const DEFAULT_REFLECTION_PROMPT = `The previous attempt failed with: {error}

Analyze what went wrong and adjust your approach:
1. Were the parameters too complex?
2. Was there a rate limit or quota issue?
3. Should you try a simpler alternative?

Retry with corrected parameters.`;

/**
 * ReflectAndRetry Plugin for agent resilience.
 */
export class ReflectAndRetryPlugin {
  private config: ReflectAndRetryConfig;
  private retryCount: Map<string, number> = new Map();

  constructor(config: Partial<ReflectAndRetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      reflectionPrompt: config.reflectionPrompt ?? DEFAULT_REFLECTION_PROMPT,
      toolStrategies: {
        ...DEFAULT_TOOL_STRATEGIES,
        ...config.toolStrategies,
      },
    };
  }

  /**
   * Generate a unique call ID for tracking retries.
   */
  private getCallId(sessionId: string, toolName: string, args: unknown): string {
    // Use a hash of the args to identify unique calls
    const argsHash = JSON.stringify(args).substring(0, 100);
    return `${sessionId}:${toolName}:${argsHash}`;
  }

  /**
   * Get the retry strategy for a tool.
   */
  private getStrategy(toolName: string): ToolRetryStrategy {
    return this.config.toolStrategies?.[toolName] ?? {};
  }

  /**
   * Generate a fallback suggestion based on the tool and error.
   */
  private generateFallbackSuggestion(toolName: string, error: Error): string {
    const strategy = this.getStrategy(toolName);
    if (strategy.fallbackSuggestion) {
      return strategy.fallbackSuggestion;
    }

    // Generic fallback based on error type
    if (error.message.includes('rate limit')) {
      return 'Rate limit reached. Try again in a few minutes.';
    }
    if (error.message.includes('quota')) {
      return 'Usage quota exceeded. Consider upgrading your plan.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out. Try a simpler request.';
    }

    return 'Try a different approach';
  }

  /**
   * Attempt to simplify tool arguments for retry.
   */
  private simplifyArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
    const strategy = this.getStrategy(toolName);
    if (!strategy.simplifyOnRetry) {
      return args;
    }

    const simplified = { ...args };

    // Image generation: reduce complexity
    if (toolName === 'generate_image') {
      if (typeof simplified.prompt === 'string') {
        // Shorten prompt, remove complex modifiers
        simplified.prompt = simplified.prompt.split(',').slice(0, 3).join(', ');
      }
      // Reduce resolution if specified
      if (simplified.width && simplified.height) {
        simplified.width = Math.min(Number(simplified.width), 512);
        simplified.height = Math.min(Number(simplified.height), 512);
      }
    }

    // Video generation: reduce duration
    if (toolName === 'generate_video') {
      if (simplified.duration_seconds) {
        simplified.duration_seconds = Math.min(Number(simplified.duration_seconds), 4);
      }
    }

    return simplified;
  }

  /**
   * Handle a tool error and determine whether to retry.
   *
   * @param context - Plugin context with session info
   * @param error - The error that occurred
   * @param toolName - Name of the tool that failed
   * @param args - Arguments that were passed to the tool
   * @returns Retry instructions or failure result
   */
  async onToolError(
    context: PluginContext,
    error: Error,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<RetryResult | FailureResult> {
    const callId = this.getCallId(context.session.id, toolName, args);
    const currentRetries = this.retryCount.get(callId) ?? 0;
    const strategy = this.getStrategy(toolName);
    const maxRetries = strategy.maxRetries ?? this.config.maxRetries;

    logger.warn(
      {
        toolName,
        error: error.message,
        attempt: currentRetries + 1,
        maxRetries,
        sessionId: context.session.id,
      },
      'Tool error occurred'
    );

    // Check if we've exceeded retry limit
    if (currentRetries >= maxRetries) {
      this.retryCount.delete(callId);

      logger.error(
        {
          toolName,
          error: error.message,
          totalAttempts: currentRetries + 1,
          sessionId: context.session.id,
        },
        'Tool failed after max retries'
      );

      return {
        success: false,
        error: 'Operation failed after retries',
        fallback_suggestion: this.generateFallbackSuggestion(toolName, error),
      };
    }

    // Increment retry count
    this.retryCount.set(callId, currentRetries + 1);

    // Generate reflection prompt
    const reflection = this.config.reflectionPrompt.replace('{error}', error.message);

    // Simplify args if strategy allows
    const simplifiedArgs = this.simplifyArgs(toolName, args);

    logger.info(
      {
        toolName,
        attempt: currentRetries + 2,
        simplified: simplifiedArgs !== args,
        sessionId: context.session.id,
      },
      'Retrying tool with reflection'
    );

    return {
      retry: true,
      reflection,
      simplifiedArgs: simplifiedArgs !== args ? simplifiedArgs : undefined,
    };
  }

  /**
   * Clear retry count for a call (called on success).
   */
  onToolSuccess(context: PluginContext, toolName: string, args: unknown): void {
    const callId = this.getCallId(context.session.id, toolName, args);
    this.retryCount.delete(callId);
  }

  /**
   * Clear all retry counts for a session (called on session end).
   */
  onSessionEnd(sessionId: string): void {
    // Clear all entries for this session
    for (const key of this.retryCount.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.retryCount.delete(key);
      }
    }
  }
}

/**
 * Factory function for easy plugin creation.
 */
export function createReflectAndRetryPlugin(
  config?: Partial<ReflectAndRetryConfig>
): ReflectAndRetryPlugin {
  return new ReflectAndRetryPlugin(config);
}
