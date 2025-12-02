/**
 * Tenant Admin Reminders Routes
 *
 * Provides endpoints for lazy reminder evaluation in the tenant admin dashboard.
 * Reminders are processed on-demand when the admin loads their dashboard, not via cron jobs.
 *
 * Design Decision (from plans/mvp-gaps-phased-implementation.md):
 * - No new database models (uses existing Booking fields)
 * - No cron jobs (lazy evaluation on dashboard load)
 * - Reuses existing Postmark adapter
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../lib/core/logger';
import type { ReminderService } from '../services/reminder.service';

/**
 * Create tenant admin reminder routes
 *
 * @param reminderService - ReminderService from DI container
 */
export function createTenantAdminReminderRoutes(
  reminderService: ReminderService
): Router {
  const router = Router();

  /**
   * GET /v1/tenant-admin/reminders/status
   * Get reminder status for dashboard badge display
   *
   * Returns:
   * - pendingCount: Number of pending reminders
   * - upcomingReminders: Array of upcoming reminders (preview)
   */
  router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Get pending count for badge display
      const pendingCount = await reminderService.getPendingReminderCount(tenantId);

      // Get upcoming reminders for preview (limit 5)
      const upcomingReminders = await reminderService.getUpcomingReminders(tenantId, 5);

      logger.debug(
        { tenantId, pendingCount, previewCount: upcomingReminders.length },
        'Reminder status retrieved'
      );

      res.status(200).json({
        pendingCount,
        upcomingReminders,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting reminder status');
      next(error);
    }
  });

  /**
   * POST /v1/tenant-admin/reminders/process
   * Trigger lazy reminder processing
   *
   * Optional query params:
   * - limit: Maximum number of reminders to process (default 10)
   *
   * Returns:
   * - processed: Number of successfully processed reminders
   * - failed: Number of failed reminders
   */
  router.post('/process', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      if (!tenantAuth) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }
      const tenantId = tenantAuth.tenantId;

      // Get limit from query param (default 10)
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      // Validate limit
      if (isNaN(limit) || limit < 1 || limit > 100) {
        res.status(400).json({ error: 'Invalid limit: must be between 1 and 100' });
        return;
      }

      logger.info(
        { tenantId, limit },
        'Processing reminders triggered by tenant admin'
      );

      // Process overdue reminders (non-blocking)
      const result = await reminderService.processOverdueReminders(tenantId, limit);

      logger.info(
        { tenantId, processed: result.processed, failed: result.failed },
        'Reminder processing complete'
      );

      res.status(200).json({
        processed: result.processed,
        failed: result.failed,
      });
    } catch (error) {
      logger.error({ error }, 'Error processing reminders');
      next(error);
    }
  });

  return router;
}
