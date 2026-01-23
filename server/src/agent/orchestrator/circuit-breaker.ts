/**
 * Circuit Breaker for Agent Sessions
 *
 * Prevents runaway agents from consuming excessive resources.
 * Based on Cox Automotive pattern with P95 cost controls.
 */

import { logger } from '../../lib/core/logger';

export interface CircuitBreakerConfig {
  readonly maxTurnsPerSession: number;
  readonly maxTokensPerSession: number;
  readonly maxTimePerSessionMs: number;
  readonly maxConsecutiveErrors: number;
  /** Maximum idle time in ms before session cleanup (default: 30 minutes) */
  readonly maxIdleTimeMs: number;
}

export interface CircuitBreakerState {
  readonly turns: number;
  readonly tokens: number;
  readonly startTime: number;
  readonly lastActivityTime: number;
  readonly consecutiveErrors: number;
  readonly isTripped: boolean;
  readonly tripReason?: string;
}

export interface CircuitBreakerCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

// Default circuit breaker configuration
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxTurnsPerSession: 20, // Prevent infinite loops
  maxTokensPerSession: 100_000, // ~$3 per session max
  maxTimePerSessionMs: 30 * 60 * 1000, // 30 min session limit
  maxConsecutiveErrors: 3, // Trip after 3 errors
  maxIdleTimeMs: 30 * 60 * 1000, // 30 min idle timeout (memory leak prevention)
} as const;

/**
 * Circuit breaker for agent sessions.
 * Trips when resource limits are exceeded.
 */
export class CircuitBreaker {
  private turns: number = 0;
  private tokens: number = 0;
  private readonly startTime: number = Date.now();
  private lastActivityTime: number = Date.now();
  private consecutiveErrors: number = 0;
  private isTripped: boolean = false;
  private tripReason?: string;

  constructor(private readonly config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {}

  /**
   * Check if the circuit breaker allows the next operation
   */
  check(): CircuitBreakerCheckResult {
    if (this.isTripped) {
      return { allowed: false, reason: this.tripReason };
    }

    if (this.turns >= this.config.maxTurnsPerSession) {
      this.trip(`Max turns (${this.config.maxTurnsPerSession}) exceeded`);
      return { allowed: false, reason: this.tripReason };
    }

    if (this.tokens >= this.config.maxTokensPerSession) {
      this.trip(`Max tokens (${this.config.maxTokensPerSession}) exceeded`);
      return { allowed: false, reason: this.tripReason };
    }

    const now = Date.now();
    const elapsed = now - this.startTime;
    if (elapsed >= this.config.maxTimePerSessionMs) {
      this.trip(`Max session time (${this.config.maxTimePerSessionMs}ms) exceeded`);
      return { allowed: false, reason: this.tripReason };
    }

    // Check idle timeout (memory leak prevention)
    const idleTime = now - this.lastActivityTime;
    if (idleTime >= this.config.maxIdleTimeMs) {
      this.trip('Session expired due to inactivity. Please start a new conversation.');
      return { allowed: false, reason: this.tripReason };
    }

    return { allowed: true };
  }

  /**
   * Record a completed turn with token count
   * Also updates lastActivityTime to prevent idle timeout
   */
  recordTurn(tokensUsed: number): void {
    this.turns++;
    this.tokens += tokensUsed;
    this.lastActivityTime = Date.now();

    logger.debug({ turns: this.turns, tokens: this.tokens }, 'Circuit breaker recorded turn');
  }

  /**
   * Record activity without a turn (e.g., user is typing, heartbeat)
   * Prevents idle timeout for active sessions
   */
  recordActivity(): void {
    this.lastActivityTime = Date.now();
  }

  /**
   * Record an error (increments consecutive error count)
   */
  recordError(): void {
    this.consecutiveErrors++;

    if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      this.trip(`Max consecutive errors (${this.config.maxConsecutiveErrors}) exceeded`);
    }
  }

  /**
   * Record a success (resets consecutive error count)
   */
  recordSuccess(): void {
    this.consecutiveErrors = 0;
  }

  /**
   * Trip the circuit breaker
   */
  private trip(reason: string): void {
    this.isTripped = true;
    this.tripReason = reason;

    logger.warn(
      {
        reason,
        turns: this.turns,
        tokens: this.tokens,
        consecutiveErrors: this.consecutiveErrors,
        elapsedMs: Date.now() - this.startTime,
      },
      'Circuit breaker tripped'
    );
  }

  /**
   * Get current state for debugging/metrics
   */
  getState(): Readonly<CircuitBreakerState> {
    return Object.freeze({
      turns: this.turns,
      tokens: this.tokens,
      startTime: this.startTime,
      lastActivityTime: this.lastActivityTime,
      consecutiveErrors: this.consecutiveErrors,
      isTripped: this.isTripped,
      tripReason: this.tripReason,
    });
  }

  /**
   * Check if this session is idle (for external cleanup logic)
   * @param maxIdleMs Optional override for idle threshold
   */
  isIdle(maxIdleMs?: number): boolean {
    const threshold = maxIdleMs ?? this.config.maxIdleTimeMs;
    return Date.now() - this.lastActivityTime >= threshold;
  }
}
