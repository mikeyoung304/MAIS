/**
 * Health Check Service
 *
 * Provides connectivity checks for external services (Stripe, Postmark, Google Calendar)
 * with response caching to avoid rate limiting.
 */

import type { StripePaymentAdapter } from '../adapters/stripe.adapter';
import type { PostmarkMailAdapter } from '../adapters/postmark.adapter';
import type { CalendarProvider } from '../lib/ports';
import { logger } from '../lib/core/logger';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
  lastChecked?: string;
}

interface CachedResult {
  result: HealthCheckResult;
  timestamp: number;
}

export class HealthCheckService {
  private cache = new Map<string, CachedResult>();
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds
  private readonly CHECK_TIMEOUT_MS = 5_000; // 5 seconds max per check

  constructor(
    private readonly deps: {
      stripeAdapter?: StripePaymentAdapter;
      mailAdapter?: PostmarkMailAdapter;
      calendarAdapter?: CalendarProvider;
    }
  ) {}

  /**
   * Check Stripe connectivity by retrieving balance
   * Uses minimal API call to verify authentication
   */
  async checkStripe(): Promise<HealthCheckResult> {
    const cached = this.getCached('stripe');
    if (cached) return cached;

    if (!this.deps.stripeAdapter) {
      return this.cacheResult('stripe', {
        status: 'unhealthy',
        error: 'Stripe adapter not configured',
      });
    }

    const startTime = Date.now();
    try {
      // Use timeout wrapper to prevent hanging
      await this.withTimeout(
        // Access Stripe instance directly via adapter's private property
        // This is safe because we own both the adapter and this service
        (this.deps.stripeAdapter as any).stripe.balance.retrieve(),
        this.CHECK_TIMEOUT_MS
      );

      const latency = Date.now() - startTime;
      return this.cacheResult('stripe', {
        status: 'healthy',
        latency,
      });
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error({ error }, 'Stripe health check failed');

      return this.cacheResult('stripe', {
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check Postmark connectivity by verifying server info
   * Uses HEAD request to /server endpoint for minimal overhead
   */
  async checkPostmark(): Promise<HealthCheckResult> {
    const cached = this.getCached('postmark');
    if (cached) return cached;

    if (!this.deps.mailAdapter) {
      return this.cacheResult('postmark', {
        status: 'unhealthy',
        error: 'Postmark adapter not configured',
      });
    }

    // Check if using file sink fallback (no server token)
    const serverToken = (this.deps.mailAdapter as any).cfg.serverToken;
    if (!serverToken) {
      return this.cacheResult('postmark', {
        status: 'healthy',
        error: 'Using file sink fallback (no POSTMARK_SERVER_TOKEN)',
      });
    }

    const startTime = Date.now();
    try {
      // Use Postmark /server endpoint to verify API token
      const response = await this.withTimeout(
        fetch('https://api.postmarkapp.com/server', {
          method: 'GET',
          headers: {
            'X-Postmark-Server-Token': serverToken,
            Accept: 'application/json',
          },
        }),
        this.CHECK_TIMEOUT_MS
      );

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return this.cacheResult('postmark', {
          status: 'unhealthy',
          latency,
          error: `HTTP ${response.status}: ${errorText}`,
        });
      }

      return this.cacheResult('postmark', {
        status: 'healthy',
        latency,
      });
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error({ error }, 'Postmark health check failed');

      return this.cacheResult('postmark', {
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check Google Calendar connectivity by verifying adapter availability
   * Does NOT make external API call (calendar checks are expensive)
   */
  async checkGoogleCalendar(): Promise<HealthCheckResult> {
    const cached = this.getCached('googleCalendar');
    if (cached) return cached;

    if (!this.deps.calendarAdapter) {
      return this.cacheResult('googleCalendar', {
        status: 'unhealthy',
        error: 'Calendar adapter not configured',
      });
    }

    // Check if using mock calendar adapter
    const adapterName = this.deps.calendarAdapter.constructor.name;
    if (adapterName === 'MockCalendarProvider') {
      return this.cacheResult('googleCalendar', {
        status: 'healthy',
        error: 'Using mock calendar adapter',
      });
    }

    // For real Google Calendar adapter, check if config exists
    const config = (this.deps.calendarAdapter as any).config;
    if (!config?.calendarId || !config?.serviceAccountJsonBase64) {
      return this.cacheResult('googleCalendar', {
        status: 'unhealthy',
        error: 'Google Calendar credentials not configured',
      });
    }

    // Assume healthy if configured (expensive to verify auth)
    return this.cacheResult('googleCalendar', {
      status: 'healthy',
    });
  }

  /**
   * Clear all cached results
   * Useful for testing or forcing fresh checks
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ========== Private Helpers ==========

  /**
   * Get cached result if still valid (within TTL)
   */
  private getCached(key: string): HealthCheckResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    // Add lastChecked timestamp for transparency
    return {
      ...cached.result,
      lastChecked: new Date(cached.timestamp).toISOString(),
    };
  }

  /**
   * Cache a health check result
   */
  private cacheResult(key: string, result: HealthCheckResult): HealthCheckResult {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });

    return {
      ...result,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Wrap a promise with a timeout
   * Rejects if promise doesn't resolve within timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }
}
