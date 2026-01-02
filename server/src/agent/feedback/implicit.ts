/**
 * Implicit Feedback Analyzer
 *
 * Extracts implicit user satisfaction signals from conversation patterns.
 * These signals help identify problematic conversations without explicit feedback.
 *
 * Signals analyzed:
 * - Retry patterns (user repeating themselves)
 * - Abandonment (task not completed)
 * - Response verbosity
 * - Error frequency
 * - Positive/negative language
 *
 * @see plans/agent-evaluation-system.md Phase 5.1
 */

import type { TracedMessage, TracedToolCall } from '../tracing';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Implicit signals extracted from conversation patterns.
 */
export interface ImplicitSignals {
  /** Total number of conversation turns */
  turnCount: number;
  /** Number of times user repeated similar messages */
  retryCount: number;
  /** 1 if task not completed, 0 otherwise */
  abandonmentRate: number;
  /** Total time from start to end of conversation */
  timeToCompletionMs: number;
  /** Average length of assistant responses */
  avgResponseLength: number;
  /** Number of tool calls made */
  toolCallCount: number;
  /** Ratio of errors to total turns */
  errorRate: number;
  /** Number of follow-up questions asked */
  followUpQuestions: number;
  /** Number of positive acknowledgments */
  positiveAcknowledgments: number;
  /** Number of negative/frustrated signals */
  negativeSignals: number;
}

/**
 * Input for the implicit feedback analyzer.
 */
export interface ImplicitFeedbackInput {
  turnCount: number;
  totalLatencyMs: number;
  taskCompleted: boolean | null;
  messages: TracedMessage[];
  toolCalls?: TracedToolCall[];
  errors: Array<{ message: string }> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Patterns
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns indicating follow-up questions */
const FOLLOW_UP_PATTERNS =
  /\b(also|another question|one more|what about|and also|additionally|by the way|oh and)\b/i;

/** Patterns indicating positive sentiment */
const POSITIVE_PATTERNS =
  /\b(thanks|thank you|great|perfect|awesome|excellent|helpful|worked|exactly|wonderful|appreciate|love it|that's right|yes)\b/i;

/** Patterns indicating negative/frustrated sentiment */
const NEGATIVE_PATTERNS =
  /\b(no|wrong|incorrect|not what|didn't ask|confused|doesn't work|frustrated|annoyed|useless|terrible|awful|hate|disappointing|still not|again|repeat|already said)\b/i;

// ─────────────────────────────────────────────────────────────────────────────
// Analyzer Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyzes conversation patterns to extract implicit feedback signals.
 *
 * Usage:
 * ```typescript
 * const analyzer = new ImplicitFeedbackAnalyzer();
 * const signals = analyzer.analyze({
 *   turnCount: 5,
 *   totalLatencyMs: 3000,
 *   taskCompleted: true,
 *   messages: [...],
 *   errors: null,
 * });
 * console.log(signals.negativeSignals); // Number of frustrated signals
 * ```
 */
export class ImplicitFeedbackAnalyzer {
  /**
   * Analyze a conversation and extract implicit signals.
   */
  analyze(input: ImplicitFeedbackInput): ImplicitSignals {
    const messages = input.messages;
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    return {
      turnCount: input.turnCount,
      retryCount: this.countRetries(userMessages),
      abandonmentRate: input.taskCompleted === false ? 1 : 0,
      timeToCompletionMs: input.totalLatencyMs,
      avgResponseLength: this.avgLength(assistantMessages),
      toolCallCount: input.toolCalls?.length ?? 0,
      errorRate: this.calculateErrorRate(input.errors, input.turnCount),
      followUpQuestions: this.countFollowUps(userMessages),
      positiveAcknowledgments: this.countPositive(userMessages),
      negativeSignals: this.countNegative(userMessages),
    };
  }

  /**
   * Calculate a satisfaction score from implicit signals.
   * Returns a score from 0-10 where higher is better.
   */
  calculateSatisfactionScore(signals: ImplicitSignals): number {
    let score = 7; // Start with neutral-positive baseline

    // Negative factors
    score -= signals.retryCount * 0.5; // Each retry suggests frustration
    score -= signals.negativeSignals * 0.75; // Negative language is concerning
    score -= signals.abandonmentRate * 2; // Abandonment is very bad
    score -= signals.errorRate * 3; // Errors are bad

    // Excessive turns suggest the agent isn't being helpful
    if (signals.turnCount > 10) {
      score -= (signals.turnCount - 10) * 0.2;
    }

    // Positive factors
    score += signals.positiveAcknowledgments * 0.5; // Each positive signal is good

    // Follow-ups can be positive (engaged user) or negative (still needs help)
    // Only count as positive if there are also positive acknowledgments
    if (signals.positiveAcknowledgments > 0) {
      score += Math.min(signals.followUpQuestions * 0.2, 1);
    }

    // Clamp to 0-10
    return Math.max(0, Math.min(10, score));
  }

  /**
   * Determine if a conversation should be flagged for review based on signals.
   */
  shouldFlag(signals: ImplicitSignals): { flagged: boolean; reason: string | null } {
    const reasons: string[] = [];

    if (signals.retryCount >= 3) {
      reasons.push(`High retry count: ${signals.retryCount}`);
    }

    if (signals.negativeSignals >= 2) {
      reasons.push(`Multiple negative signals: ${signals.negativeSignals}`);
    }

    if (signals.abandonmentRate === 1 && signals.turnCount >= 3) {
      reasons.push('User abandoned after multiple turns');
    }

    if (signals.errorRate > 0.3) {
      reasons.push(`High error rate: ${(signals.errorRate * 100).toFixed(1)}%`);
    }

    return {
      flagged: reasons.length > 0,
      reason: reasons.length > 0 ? reasons.join('; ') : null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Count user retries (similar consecutive messages).
   */
  private countRetries(messages: TracedMessage[]): number {
    let retries = 0;
    for (let i = 1; i < messages.length; i++) {
      const similarity = this.textSimilarity(messages[i].content, messages[i - 1].content);
      if (similarity > 0.6) retries++;
    }
    return retries;
  }

  /**
   * Calculate Jaccard similarity between two texts.
   */
  private textSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate average length of messages.
   */
  private avgLength(messages: TracedMessage[]): number {
    if (messages.length === 0) return 0;
    const total = messages.reduce((sum, m) => sum + m.content.length, 0);
    return total / messages.length;
  }

  /**
   * Calculate error rate.
   */
  private calculateErrorRate(errors: Array<{ message: string }> | null, turnCount: number): number {
    if (!errors || turnCount === 0) return 0;
    return errors.length / turnCount;
  }

  /**
   * Count follow-up questions.
   */
  private countFollowUps(messages: TracedMessage[]): number {
    return messages.filter((m) => FOLLOW_UP_PATTERNS.test(m.content)).length;
  }

  /**
   * Count positive acknowledgments.
   */
  private countPositive(messages: TracedMessage[]): number {
    return messages.filter((m) => POSITIVE_PATTERNS.test(m.content)).length;
  }

  /**
   * Count negative/frustrated signals.
   */
  private countNegative(messages: TracedMessage[]): number {
    return messages.filter((m) => NEGATIVE_PATTERNS.test(m.content)).length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new implicit feedback analyzer.
 */
export function createImplicitFeedbackAnalyzer(): ImplicitFeedbackAnalyzer {
  return new ImplicitFeedbackAnalyzer();
}
