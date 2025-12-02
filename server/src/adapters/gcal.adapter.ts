/**
 * Google Calendar adapter with freeBusy API and caching
 */

import type { CalendarProvider } from '../lib/ports';
import { createGServiceAccountJWT } from './gcal.jwt';
import { logger } from '../lib/core/logger';
import type { PrismaTenantRepository } from './prisma/tenant.repository';
import { encryptionService } from '../lib/encryption.service';

interface CacheEntry {
  available: boolean;
  timestamp: number;
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

export class GoogleCalendarAdapter implements CalendarProvider {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds

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
  async getConfigForTenant(tenantId: string): Promise<{ calendarId: string; serviceAccountJsonBase64: string } | null> {
    // Try to get tenant-specific config from secrets
    if (this.tenantRepo) {
      try {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (tenant?.secrets && typeof tenant.secrets === 'object') {
          const secrets = tenant.secrets as any;

          // Check if calendar config exists in secrets
          if (secrets.calendar?.ciphertext && secrets.calendar?.iv && secrets.calendar?.authTag) {
            try {
              // Decrypt the calendar config
              const decrypted = encryptionService.decryptObject<TenantCalendarConfig>(secrets.calendar);

              // Convert serviceAccountJson to base64 for compatibility
              const serviceAccountJsonBase64 = Buffer.from(decrypted.serviceAccountJson, 'utf8').toString('base64');

              return {
                calendarId: decrypted.calendarId,
                serviceAccountJsonBase64,
              };
            } catch (error) {
              logger.warn({ tenantId, error }, 'Failed to decrypt tenant calendar config, falling back to global');
            }
          }
        }
      } catch (error) {
        logger.warn({ tenantId, error }, 'Failed to load tenant calendar config, falling back to global');
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

  async isDateAvailable(dateUtc: string, tenantId?: string): Promise<boolean> {
    // Use tenant-specific cache key if tenantId provided
    const cacheKey = tenantId ? `${tenantId}:${dateUtc}` : dateUtc;
    const cached = this.cache.get(cacheKey);

    // Return cached result if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.available;
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
      if (!cached) {
        logger.warn({ tenantId }, 'Google Calendar credentials missing; treating date as available');
      }
      const result = { available: true, timestamp: Date.now() };
      this.cache.set(cacheKey, result);
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

      const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
          items: [{ id: calendarConfig.calendarId }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.warn(
          { status: response.status, error: errorText, date: dateUtc, tenantId },
          'Google Calendar freeBusy API failed; assuming date is available'
        );
        const result = { available: true, timestamp: Date.now() };
        this.cache.set(cacheKey, result);
        return true;
      }

      const data = (await response.json()) as FreeBusyResponse;
      const busySlots = data?.calendars?.[calendarConfig.calendarId]?.busy ?? [];
      const isBusy = Array.isArray(busySlots) && busySlots.length > 0;
      const isAvailable = !isBusy;

      // Cache the result
      const result = { available: isAvailable, timestamp: Date.now() };
      this.cache.set(cacheKey, result);

      return isAvailable;
    } catch (error) {
      logger.warn(
        { error, date: dateUtc },
        'Error checking Google Calendar availability; assuming date is available'
      );
      const result = { available: true, timestamp: Date.now() };
      this.cache.set(cacheKey, result);
      return true;
    }
  }
}
