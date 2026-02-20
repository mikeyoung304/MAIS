/**
 * Google Calendar adapter with freeBusy API and caching
 */

import type { CalendarProvider } from '../lib/ports';
import { createGServiceAccountJWT } from './gcal.jwt';
import { logger } from '../lib/core/logger';
import type { PrismaTenantRepository } from './prisma/tenant.repository';
import { encryptionService } from '../lib/encryption.service';
import type { TenantSecrets } from '../types/prisma-json';

interface CacheEntry {
  available: boolean;
  expiresAt: number;
}

interface FreeBusyResponse {
  calendars?: {
    [calendarId: string]: {
      busy?: Array<{ start: string; end: string }>;
    };
  };
}

/**
 * Per-tenant calendar configuration stored in Tenant.secrets
 */
export interface TenantCalendarConfig {
  calendarId: string;
  serviceAccountJson: string; // JSON string (not base64)
}

/**
 * Retry a Google API call with exponential backoff.
 * Retries on 5xx errors and AbortErrors (timeouts).
 * Non-retryable errors (4xx, network errors other than timeout) are thrown immediately.
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isServerError =
        err instanceof Error &&
        'status' in err &&
        typeof (err as { status: unknown }).status === 'number' &&
        (err as { status: number }).status >= 500;
      const isTimeoutError = err instanceof Error && err.name === 'AbortError';
      const isRetryable = isServerError || isTimeoutError;

      if (attempt === maxAttempts - 1 || !isRetryable) throw err;

      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 100, 10_000);
      logger.warn(
        { attempt: attempt + 1, maxAttempts, delay: Math.round(delay) },
        'Google Calendar API retry'
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('unreachable');
}

export class GoogleCalendarAdapter implements CalendarProvider {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CACHE_MAX_SIZE = 1000; // Max entries — evict oldest on overflow

  constructor(
    private readonly config: {
      calendarId?: string;
      serviceAccountJsonBase64?: string;
    },
    private readonly tenantRepo?: PrismaTenantRepository
  ) {}

  /**
   * Get calendar configuration for a specific tenant
   * Checks tenant secrets first, falls back to global config
   *
   * @param tenantId - Tenant ID to get config for
   * @returns Calendar config or null if not found
   */
  async getConfigForTenant(
    tenantId: string
  ): Promise<{ calendarId: string; serviceAccountJsonBase64: string } | null> {
    // Try to get tenant-specific config from secrets
    if (this.tenantRepo) {
      try {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (tenant?.secrets && typeof tenant.secrets === 'object') {
          // Guard above ensures secrets is non-null object
          const secrets = tenant.secrets as TenantSecrets;

          // Check if calendar config exists in secrets
          if (secrets.calendar?.ciphertext && secrets.calendar?.iv && secrets.calendar?.authTag) {
            try {
              // Decrypt the calendar config
              const decrypted = encryptionService.decryptObject<TenantCalendarConfig>(
                secrets.calendar
              );

              // Convert serviceAccountJson to base64 for compatibility
              const serviceAccountJsonBase64 = Buffer.from(
                decrypted.serviceAccountJson,
                'utf8'
              ).toString('base64');

              return {
                calendarId: decrypted.calendarId,
                serviceAccountJsonBase64,
              };
            } catch (error) {
              logger.warn(
                { tenantId, error },
                'Failed to decrypt tenant calendar config, falling back to global'
              );
            }
          }
        }
      } catch (error) {
        logger.warn(
          { tenantId, error },
          'Failed to load tenant calendar config, falling back to global'
        );
      }
    }

    // Fall back to global config
    if (this.config.calendarId && this.config.serviceAccountJsonBase64) {
      return {
        calendarId: this.config.calendarId,
        serviceAccountJsonBase64: this.config.serviceAccountJsonBase64,
      };
    }

    return null;
  }

  /**
   * Set a cache entry with TTL and max-size eviction.
   * Evicts the oldest entry (first key in insertion order) when the cache is full.
   */
  private setCacheEntry(key: string, value: boolean): void {
    // Evict oldest entry if at max capacity
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { available: value, expiresAt: Date.now() + this.CACHE_TTL_MS });
  }

  async isDateAvailable(dateUtc: string, tenantId?: string): Promise<boolean> {
    // MULTI-TENANT: Include tenantId in cache key to prevent cross-tenant cache pollution
    const cacheKey = tenantId ? `tenant:${tenantId}:availability:${dateUtc}` : dateUtc;
    const cached = this.cache.get(cacheKey);

    // Return cached result if not expired
    if (cached && Date.now() < cached.expiresAt) {
      return cached.available;
    }

    // Remove stale entry if present
    if (cached) {
      this.cache.delete(cacheKey);
    }

    // Get calendar config (tenant-specific or global)
    let calendarConfig: { calendarId: string; serviceAccountJsonBase64: string } | null = null;

    if (tenantId) {
      calendarConfig = await this.getConfigForTenant(tenantId);
    } else if (this.config.calendarId && this.config.serviceAccountJsonBase64) {
      calendarConfig = {
        calendarId: this.config.calendarId,
        serviceAccountJsonBase64: this.config.serviceAccountJsonBase64,
      };
    }

    // Check if credentials are missing
    if (!calendarConfig) {
      logger.warn({ tenantId }, 'Google Calendar credentials missing; treating date as available');
      this.setCacheEntry(cacheKey, true);
      return true;
    }

    try {
      // Parse service account JSON from base64
      const serviceAccountJson = JSON.parse(
        Buffer.from(calendarConfig.serviceAccountJsonBase64, 'base64').toString('utf8')
      );

      // Get access token via JWT
      const accessToken = await createGServiceAccountJWT(serviceAccountJson, [
        'https://www.googleapis.com/auth/calendar.readonly',
      ]);

      // Query freeBusy for the entire day (UTC)
      const timeMin = `${dateUtc}T00:00:00.000Z`;
      const timeMax = `${dateUtc}T23:59:59.999Z`;

      const response = await withRetry(() =>
        fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          signal: AbortSignal.timeout(10_000),
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin,
            timeMax,
            items: [{ id: calendarConfig!.calendarId }],
          }),
        })
      );

      if (!response.ok) {
        // 401 Unauthorized: credentials invalid — treat as unavailable (fail closed)
        if (response.status === 401) {
          logger.warn(
            { status: 401, date: dateUtc, tenantId },
            'Google Calendar freeBusy API returned 401; treating date as unavailable'
          );
          this.setCacheEntry(cacheKey, false);
          return false;
        }

        const errorText = await response.text().catch(() => '');
        logger.warn(
          { status: response.status, error: errorText, date: dateUtc, tenantId },
          'Google Calendar freeBusy API failed; assuming date is available'
        );
        this.setCacheEntry(cacheKey, true);
        return true;
      }

      const data = (await response.json()) as FreeBusyResponse;
      const busySlots = data?.calendars?.[calendarConfig.calendarId]?.busy ?? [];
      const isBusy = Array.isArray(busySlots) && busySlots.length > 0;
      const isAvailable = !isBusy;

      // Cache the result with TTL and bounded size
      this.setCacheEntry(cacheKey, isAvailable);

      return isAvailable;
    } catch (error) {
      // Timeout: don't block bookings on Google outage
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn(
          { date: dateUtc, tenantId },
          'Google Calendar freeBusy API timed out; assuming date is available'
        );
        this.setCacheEntry(cacheKey, true);
        return true;
      }

      logger.warn(
        { error, date: dateUtc },
        'Error checking Google Calendar availability; assuming date is available'
      );
      this.setCacheEntry(cacheKey, true);
      return true;
    }
  }
}
