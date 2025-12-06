/**
 * Scheduler for automated tasks
 *
 * This module handles cron-based scheduled tasks such as:
 * - Daily reminder processing
 * - Future: cleanup jobs, report generation, etc.
 */

import cron from 'node-cron';
import { logger } from './lib/core/logger';
import type { Container } from './di';

/**
 * Initialize all scheduled tasks
 *
 * @param container - DI container with services and repositories
 * @param cronSchedule - Cron expression (default: daily at 9 AM)
 */
export function initializeScheduler(
  container: Container,
  cronSchedule: string = '0 9 * * *'
): void {
  logger.info({ cronSchedule }, 'Initializing reminder scheduler');

  // Validate cron expression
  if (!cron.validate(cronSchedule)) {
    logger.error({ cronSchedule }, 'Invalid cron expression, using default');
    cronSchedule = '0 9 * * *';
  }

  // Schedule daily reminder processing
  cron.schedule(cronSchedule, async () => {
    logger.info('Starting scheduled reminder processing');
    const startTime = Date.now();

    try {
      // Get all active tenants
      if (!container.prisma) {
        logger.warn('Prisma client not available, skipping reminder processing');
        return;
      }

      const tenants = await container.prisma.$queryRaw<Array<{ id: string; slug: string }>>`
        SELECT id, slug FROM "Tenant" WHERE "isActive" = true
      `;

      if (!tenants || tenants.length === 0) {
        logger.info('No active tenants found for reminder processing');
        return;
      }

      logger.info({ tenantCount: tenants.length }, 'Processing reminders for active tenants');

      let totalProcessed = 0;
      let totalFailed = 0;
      let tenantsWithErrors = 0;

      // Process reminders for each tenant (isolated error handling)
      for (const tenant of tenants) {
        try {
          const result = await container.services.reminder.processOverdueReminders(
            tenant.id,
            50 // Process up to 50 reminders per tenant per run
          );

          totalProcessed += result.processed;
          totalFailed += result.failed;

          if (result.failed > 0) {
            tenantsWithErrors++;
          }

          logger.info(
            {
              tenantId: tenant.id,
              tenantSlug: tenant.slug,
              processed: result.processed,
              failed: result.failed,
            },
            'Tenant reminder processing complete'
          );
        } catch (error) {
          tenantsWithErrors++;
          logger.error(
            {
              tenantId: tenant.id,
              tenantSlug: tenant.slug,
              error,
            },
            'Failed to process reminders for tenant'
          );
        }
      }

      const duration = Date.now() - startTime;
      logger.info(
        {
          totalTenants: tenants.length,
          totalProcessed,
          totalFailed,
          tenantsWithErrors,
          durationMs: duration,
        },
        'Scheduled reminder processing complete'
      );
    } catch (error) {
      logger.error({ error }, 'Fatal error in reminder scheduler');
    }
  });

  logger.info('Reminder scheduler initialized successfully');
}
