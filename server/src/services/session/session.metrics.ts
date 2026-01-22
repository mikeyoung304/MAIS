/**
 * Session Metrics & Observability
 *
 * Collects metrics for:
 * - Session operations (create, restore, delete)
 * - Message operations
 * - Cache performance
 * - Latency tracking
 *
 * Metrics are exposed for:
 * - Periodic logging (5 min intervals)
 * - Health checks
 * - Dashboard integration
 *
 * @see plans/feat-persistent-chat-session-storage.md Phase 4.2
 */

import { logger } from '../../lib/core/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface SessionMetrics {
  // Session operations
  sessionsCreated: number;
  sessionsRestored: number;
  sessionsDeleted: number;

  // Message operations
  messagesAppended: number;
  messageAppendFailures: number;

  // Cache performance
  cacheHits: number;
  cacheMisses: number;

  // Errors
  errors: number;
  concurrentModifications: number;

  // Latency (rolling average)
  avgGetLatencyMs: number;
  avgAppendLatencyMs: number;
}

// =============================================================================
// METRICS COLLECTOR
// =============================================================================

/**
 * Metrics collector with rolling averages
 *
 * Thread-safe for single-node deployment.
 * For multi-node, use external metrics service (Prometheus, Datadog, etc.)
 */
class SessionMetricsCollector {
  private metrics: SessionMetrics = {
    sessionsCreated: 0,
    sessionsRestored: 0,
    sessionsDeleted: 0,
    messagesAppended: 0,
    messageAppendFailures: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    concurrentModifications: 0,
    avgGetLatencyMs: 0,
    avgAppendLatencyMs: 0,
  };

  // Rolling latency samples (last 1000)
  private getLatencies: number[] = [];
  private appendLatencies: number[] = [];
  private readonly maxSamples = 1000;

  // Metrics logging interval
  private logIntervalId: ReturnType<typeof setInterval> | null = null;

  // ===========================================================================
  // RECORDING METHODS
  // ===========================================================================

  recordSessionCreated(): void {
    this.metrics.sessionsCreated++;
  }

  recordSessionRestored(): void {
    this.metrics.sessionsRestored++;
  }

  recordSessionDeleted(): void {
    this.metrics.sessionsDeleted++;
  }

  recordMessageAppended(): void {
    this.metrics.messagesAppended++;
  }

  recordMessageAppendFailure(): void {
    this.metrics.messageAppendFailures++;
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordError(): void {
    this.metrics.errors++;
  }

  recordConcurrentModification(): void {
    this.metrics.concurrentModifications++;
  }

  recordGetLatency(ms: number): void {
    this.getLatencies.push(ms);
    if (this.getLatencies.length > this.maxSamples) {
      this.getLatencies.shift();
    }
    this.metrics.avgGetLatencyMs = this.calculateAverage(this.getLatencies);
  }

  recordAppendLatency(ms: number): void {
    this.appendLatencies.push(ms);
    if (this.appendLatencies.length > this.maxSamples) {
      this.appendLatencies.shift();
    }
    this.metrics.avgAppendLatencyMs = this.calculateAverage(this.appendLatencies);
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  getMetrics(): SessionMetrics {
    return { ...this.metrics };
  }

  getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (total === 0) return 0;
    return this.metrics.cacheHits / total;
  }

  getErrorRate(): number {
    const total =
      this.metrics.sessionsCreated + this.metrics.sessionsRestored + this.metrics.messagesAppended;
    if (total === 0) return 0;
    return this.metrics.errors / total;
  }

  // ===========================================================================
  // LOGGING
  // ===========================================================================

  /**
   * Start periodic metrics logging
   * Logs metrics summary every 5 minutes
   */
  startLogging(intervalMs: number = 5 * 60 * 1000): void {
    if (this.logIntervalId) {
      return; // Already logging
    }

    this.logIntervalId = setInterval(() => {
      this.logMetrics();
    }, intervalMs);

    logger.info({ intervalMs }, 'Session metrics logging started');
  }

  /**
   * Stop periodic metrics logging
   */
  stopLogging(): void {
    if (this.logIntervalId) {
      clearInterval(this.logIntervalId);
      this.logIntervalId = null;
      logger.info('Session metrics logging stopped');
    }
  }

  /**
   * Log current metrics snapshot
   */
  logMetrics(): void {
    const metrics = this.getMetrics();
    const cacheHitRate = this.getCacheHitRate();
    const errorRate = this.getErrorRate();

    logger.info(
      {
        metrics,
        cacheHitRate: `${(cacheHitRate * 100).toFixed(1)}%`,
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
      },
      'Session service metrics'
    );
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.metrics = {
      sessionsCreated: 0,
      sessionsRestored: 0,
      sessionsDeleted: 0,
      messagesAppended: 0,
      messageAppendFailures: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      concurrentModifications: 0,
      avgGetLatencyMs: 0,
      avgAppendLatencyMs: 0,
    };
    this.getLatencies = [];
    this.appendLatencies = [];
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Global session metrics collector
 *
 * Usage:
 * ```typescript
 * sessionMetrics.recordSessionCreated();
 * sessionMetrics.recordGetLatency(15);
 * const metrics = sessionMetrics.getMetrics();
 * ```
 */
export const sessionMetrics = new SessionMetricsCollector();

// Start logging in production
if (process.env.NODE_ENV === 'production') {
  sessionMetrics.startLogging();
}

// =============================================================================
// TIMING HELPERS
// =============================================================================

/**
 * Time a session get operation
 */
export async function timeGetOperation<T>(fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    sessionMetrics.recordGetLatency(Date.now() - start);
    return result;
  } catch (error) {
    sessionMetrics.recordGetLatency(Date.now() - start);
    sessionMetrics.recordError();
    throw error;
  }
}

/**
 * Time a message append operation
 */
export async function timeAppendOperation<T>(fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    sessionMetrics.recordAppendLatency(Date.now() - start);
    return result;
  } catch (error) {
    sessionMetrics.recordAppendLatency(Date.now() - start);
    sessionMetrics.recordError();
    throw error;
  }
}
