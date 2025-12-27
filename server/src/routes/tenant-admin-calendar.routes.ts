/**
 * Tenant Admin Calendar Routes
 * Protected routes for tenants to manage their Google Calendar configuration
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { encryptionService } from '../lib/encryption.service';
import type { PrismaTenantRepository } from '../adapters/prisma/tenant.repository';
import type { TenantCalendarConfig } from '../adapters/gcal.adapter';

// Constants
const MAX_JSON_SIZE = 50 * 1024; // 50KB - service account JSON files are typically ~2KB

// Validation schemas
const calendarConfigSchema = z.object({
  calendarId: z.string().min(1, 'Calendar ID is required'),
  serviceAccountJson: z.string().min(1, 'Service account JSON is required'),
});

export function createTenantAdminCalendarRoutes(
  tenantRepo: PrismaTenantRepository,
  _calendarProvider?: unknown // GoogleCalendarAdapter instance for testing connection
): Router {
  const router = Router();

  /**
   * GET /v1/tenant-admin/calendar/status
   * Returns current calendar configuration status (configured/not, calendar ID masked)
   */
  router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Get tenant record
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Check if calendar config exists in secrets
      const secrets = tenant.secrets as any;
      const hasConfig = !!(
        secrets?.calendar?.ciphertext &&
        secrets?.calendar?.iv &&
        secrets?.calendar?.authTag
      );

      if (!hasConfig) {
        res.json({
          configured: false,
          calendarId: null,
        });
        return;
      }

      // Decrypt to get calendar ID (mask it for security)
      try {
        const decrypted = encryptionService.decryptObject<TenantCalendarConfig>(secrets.calendar);
        const maskedCalendarId = maskCalendarId(decrypted.calendarId);

        res.json({
          configured: true,
          calendarId: maskedCalendarId,
        });
      } catch (error) {
        logger.error({ tenantId, error }, 'Failed to decrypt calendar config');
        res.status(500).json({ error: 'Failed to read calendar configuration' });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/calendar/config
   * Save calendar configuration (calendarId, serviceAccountJson)
   */
  router.post('/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Validate request body
      const validation = calendarConfigSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.error.issues,
        });
        return;
      }

      const { calendarId, serviceAccountJson } = validation.data;

      // Validate service account JSON size (defense-in-depth, client also validates)
      if (serviceAccountJson.length > MAX_JSON_SIZE) {
        res.status(400).json({
          error: 'Service account JSON too large. Maximum size is 50KB.',
        });
        return;
      }

      // Validate service account JSON is valid JSON
      try {
        JSON.parse(serviceAccountJson);
      } catch {
        res.status(400).json({
          error: 'Invalid service account JSON format',
        });
        return;
      }

      // Get tenant record
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Encrypt calendar config
      const calendarConfig: TenantCalendarConfig = {
        calendarId,
        serviceAccountJson,
      };
      const encrypted = encryptionService.encryptObject(calendarConfig);

      // Update tenant secrets
      const currentSecrets = (tenant.secrets as any) || {};
      const updatedSecrets = {
        ...currentSecrets,
        calendar: encrypted,
      };

      await tenantRepo.update(tenantId, {
        secrets: updatedSecrets,
      });

      logger.info({ tenantId }, 'Tenant calendar configuration saved');

      res.json({
        success: true,
        calendarId: maskCalendarId(calendarId),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to save calendar configuration');
      next(error);
    }
  });

  /**
   * DELETE /v1/tenant-admin/calendar/config
   * Remove calendar configuration
   */
  router.delete('/config', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Get tenant record
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Remove calendar config from secrets
      const currentSecrets = (tenant.secrets as any) || {};
      const { calendar: _calendar, ...remainingSecrets } = currentSecrets;

      await tenantRepo.update(tenantId, {
        secrets: remainingSecrets,
      });

      logger.info({ tenantId }, 'Tenant calendar configuration removed');

      res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Failed to remove calendar configuration');
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/calendar/test
   * Test connection by attempting to authenticate with Google Calendar API
   */
  router.post('/test', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Get tenant record
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Check if calendar config exists
      const secrets = tenant.secrets as any;
      const hasConfig = !!(
        secrets?.calendar?.ciphertext &&
        secrets?.calendar?.iv &&
        secrets?.calendar?.authTag
      );

      if (!hasConfig) {
        res.status(404).json({ error: 'No calendar configuration found' });
        return;
      }

      // Decrypt config
      let calendarConfig: TenantCalendarConfig;
      try {
        calendarConfig = encryptionService.decryptObject<TenantCalendarConfig>(secrets.calendar);
      } catch (error) {
        logger.error({ tenantId, error }, 'Failed to decrypt calendar config');
        res.status(500).json({ error: 'Failed to read calendar configuration' });
        return;
      }

      // Test connection by making a simple API call to list calendars
      try {
        const serviceAccountJson = JSON.parse(calendarConfig.serviceAccountJson);

        // Import JWT creation function
        const { createGServiceAccountJWT } = await import('../adapters/gcal.jwt');

        // Get access token
        const accessToken = await createGServiceAccountJWT(serviceAccountJson, [
          'https://www.googleapis.com/auth/calendar.readonly',
        ]);

        // Try to get calendar metadata
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarConfig.calendarId)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          logger.warn(
            { tenantId, status: response.status, error: errorText },
            'Google Calendar API test failed'
          );
          res.json({
            success: false,
            error: `Failed to connect to Google Calendar (status ${response.status})`,
          });
          return;
        }

        const calendarData = (await response.json()) as { summary?: string };

        logger.info({ tenantId }, 'Google Calendar connection test successful');

        res.json({
          success: true,
          calendarId: maskCalendarId(calendarConfig.calendarId),
          calendarName: calendarData.summary || 'Unknown',
        });
      } catch (error) {
        logger.error({ tenantId, error }, 'Google Calendar connection test failed');
        res.json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Mask calendar ID for security (show first 8 and last 4 characters)
 * Example: test@group.calendar.google.com -> test@gro...e.com
 */
function maskCalendarId(calendarId: string): string {
  if (calendarId.length <= 12) {
    return calendarId;
  }
  const start = calendarId.substring(0, 8);
  const end = calendarId.substring(calendarId.length - 4);
  return `${start}...${end}`;
}
