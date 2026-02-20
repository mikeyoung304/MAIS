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
import type { TenantSecrets, PrismaJson } from '../types/prisma-json';
import type { GoogleCalendarService } from '../services/google-calendar.service';
import { requireAuth, getTenantId } from './tenant-admin-shared';

// Constants
const MAX_JSON_SIZE = 50 * 1024; // 50KB - service account JSON files are typically ~2KB

// Validation schemas
const calendarConfigSchema = z.object({
  calendarId: z.string().min(1, 'Calendar ID is required'),
  serviceAccountJson: z.string().min(1, 'Service account JSON is required'),
});

export function createTenantAdminCalendarRoutes(
  tenantRepo: PrismaTenantRepository,
  googleCalendarService?: GoogleCalendarService
): Router {
  const router = Router();

  // Require authentication for all calendar routes
  router.use(requireAuth);

  /**
   * GET /v1/tenant-admin/calendar/status
   * Returns current calendar configuration status (configured/not, calendar ID masked)
   */
  router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      // Get tenant record
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Check for OAuth connection first (preferred method)
      const isOAuthConnected = !!(tenant as Record<string, unknown>).googleCalendarConnected;

      // Check if legacy service account config exists in secrets
      const secrets = (tenant.secrets as PrismaJson<TenantSecrets>) ?? {};
      const calendarSecret = secrets.calendar;
      const hasServiceAccountConfig = !!(
        calendarSecret?.ciphertext &&
        calendarSecret?.iv &&
        calendarSecret?.authTag
      );

      // OAuth connection takes priority
      if (isOAuthConnected) {
        res.json({
          configured: true,
          method: 'oauth',
          calendarId: 'primary', // OAuth uses the user's primary calendar
        });
        return;
      }

      if (!hasServiceAccountConfig || !calendarSecret) {
        res.json({
          configured: false,
          calendarId: null,
        });
        return;
      }

      // Decrypt legacy service account config to get calendar ID (mask it for security)
      try {
        const decrypted = encryptionService.decryptObject<TenantCalendarConfig>(calendarSecret);
        const maskedCalendarId = maskCalendarId(decrypted.calendarId);

        res.json({
          configured: true,
          method: 'service_account',
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
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

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
      const currentSecrets = (tenant.secrets as PrismaJson<TenantSecrets>) || {};
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
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      // Get tenant record
      const tenant = await tenantRepo.findById(tenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      // Remove calendar config from secrets
      const currentSecrets = (tenant.secrets as PrismaJson<TenantSecrets>) || {};
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
   * Test connection by delegating to GoogleCalendarService.testConnection()
   */
  router.post('/test', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      if (!googleCalendarService) {
        res.status(503).json({ error: 'Google Calendar service not available' });
        return;
      }

      const result = await googleCalendarService.testConnection(tenantId);

      if (!result.success) {
        // Distinguish "not configured" errors (404) from other failures
        if (
          result.error === 'No calendar configuration found' ||
          result.error === 'Tenant not found'
        ) {
          res.status(404).json({ error: result.error });
          return;
        }
        res.json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        calendarId: maskCalendarId(result.calendarId),
        calendarName: result.calendarName,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Mask calendar ID for display security.
 * Shows first 8 characters followed by ellipsis.
 * Works for all ID formats: "primary" (returned as-is, ≤8 chars),
 * email IDs, and opaque group IDs.
 */
function maskCalendarId(calendarId: string): string {
  if (calendarId.length <= 8) return calendarId;
  return `${calendarId.slice(0, 8)}...`;
}
