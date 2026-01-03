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
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for implicit feedback scoring weights.
 * These control how different signals affect the satisfaction score.
 *
 * Extracted from calculateSatisfactionScore() for configurability and testing.
 *
 * @see plans/agent-eval-remediation-plan.md Phase 7.1
 */
export const IMPLICIT_FEEDBACK_CONFIG = {
  /** Starting score before applying modifiers (0-10 scale) */
  baselineScore: 7,

  /** Weight per retry (subtracted from score) */
  retryPenalty: 0.5,

  /** Weight per negative signal (subtracted from score) */
  negativeSignalPenalty: 0.75,

  /** Penalty for abandonment (task not completed) */
  abandonmentPenalty: 2,

  /** Penalty multiplier for error rate */
  errorRatePenalty: 3,

  /** Per-turn penalty above threshold */
  excessiveTurnPenalty: 0.2,

  /** Turn count threshold before applying excess penalty */
  excessiveTurnThreshold: 10,

  /** Bonus per positive acknowledgment */
  positiveAcknowledgmentBonus: 0.5,

  /** Max bonus from follow-up questions (if positive) */
  followUpBonusMax: 1,

  /** Bonus per follow-up question (capped by max) */
  followUpBonusPerQuestion: 0.2,

  /** Similarity threshold for retry detection (0-1) */
  retrySimilarityThreshold: 0.6,

  /** Retry count threshold for flagging */
  flagRetryThreshold: 3,

  /** Negative signal count threshold for flagging */
  flagNegativeSignalThreshold: 2,

  /** Error rate threshold for flagging (0-1) */
  flagErrorRateThreshold: 0.3,
} as const;

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
   *
   * Uses IMPLICIT_FEEDBACK_CONFIG for all scoring weights.
   */
  calculateSatisfactionScore(signals: ImplicitSignals): number {
    const cfg = IMPLICIT_FEEDBACK_CONFIG;
    let score = cfg.baselineScore;

    // Negative factors
    score -= signals.retryCount * cfg.retryPenalty;
    score -= signals.negativeSignals * cfg.negativeSignalPenalty;
    score -= signals.abandonmentRate * cfg.abandonmentPenalty;
    score -= signals.errorRate * cfg.errorRatePenalty;

    // Excessive turns suggest the agent isn't being helpful
    if (signals.turnCount > cfg.excessiveTurnThreshold) {
      score -= (signals.turnCount - cfg.excessiveTurnThreshold) * cfg.excessiveTurnPenalty;
    }

    // Positive factors
    score += signals.positiveAcknowledgments * cfg.positiveAcknowledgmentBonus;

    // Follow-ups can be positive (engaged user) or negative (still needs help)
    // Only count as positive if there are also positive acknowledgments
    if (signals.positiveAcknowledgments > 0) {
      score += Math.min(
        signals.followUpQuestions * cfg.followUpBonusPerQuestion,
        cfg.followUpBonusMax
      );
    }

    // Clamp to 0-10
    return Math.max(0, Math.min(10, score));
  }

  /**
   * Determine if a conversation should be flagged for review based on signals.
   *
   * Uses IMPLICIT_FEEDBACK_CONFIG for all thresholds.
   */
  shouldFlag(signals: ImplicitSignals): { flagged: boolean; reason: string | null } {
    const cfg = IMPLICIT_FEEDBACK_CONFIG;
    const reasons: string[] = [];

    if (signals.retryCount >= cfg.flagRetryThreshold) {
      reasons.push(`High retry count: ${signals.retryCount}`);
    }

    if (signals.negativeSignals >= cfg.flagNegativeSignalThreshold) {
      reasons.push(`Multiple negative signals: ${signals.negativeSignals}`);
    }

    if (signals.abandonmentRate === 1 && signals.turnCount >= cfg.flagRetryThreshold) {
      reasons.push('User abandoned after multiple turns');
    }

    if (signals.errorRate > cfg.flagErrorRateThreshold) {
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
      if (similarity > IMPLICIT_FEEDBACK_CONFIG.retrySimilarityThreshold) retries++;
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
