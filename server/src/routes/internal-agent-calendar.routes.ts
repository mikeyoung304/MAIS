/**
 * Internal Agent Calendar Routes
 *
 * Calendar endpoints for AI agents:
 * - GET available dates (customer-agent: service discovery)
 * - GET busy times (tenant-agent: calendar management)
 * - POST block date (tenant-agent: calendar management)
 *
 * Gracefully handles missing Google Calendar configuration by returning
 * helpful messages instead of errors.
 *
 * Called by: customer-agent, tenant-agent
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/core/logger';
import { verifyInternalSecret, handleError, TenantIdSchema } from './internal-agent-shared';
import type { CalendarRoutesDeps } from './internal-agent-shared';

// =============================================================================
// Schemas
// =============================================================================

const GetAvailableDatesSchema = TenantIdSchema.extend({
  serviceId: z.string().min(1, 'serviceId is required'),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM format')
    .optional()
    .describe('Month to check in YYYY-MM format. Defaults to current month.'),
});

const GetBusyTimesSchema = TenantIdSchema.extend({
  startDate: z.string().min(1, 'startDate is required (YYYY-MM-DD format)'),
  endDate: z.string().min(1, 'endDate is required (YYYY-MM-DD format)'),
});

const BlockDateSchema = TenantIdSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD format'),
  reason: z.string().optional().describe('Optional reason for blocking the date'),
});

// =============================================================================
// Route Factory
// =============================================================================

/**
 * Create internal agent calendar routes.
 *
 * Mounted at `/calendar` by the aggregator.
 */
export function createInternalAgentCalendarRoutes(deps: CalendarRoutesDeps): Router {
  const router = Router();
  const { availabilityService, googleCalendarService, blackoutRepo, internalApiSecret } = deps;

  router.use(verifyInternalSecret(internalApiSecret));

  // POST /available-dates - Get available dates for a service in a month
  // Used by customer-agent for service discovery
  router.post('/available-dates', async (req: Request, res: Response) => {
    try {
      const { tenantId, serviceId, month } = GetAvailableDatesSchema.parse(req.body);

      logger.info(
        { tenantId, serviceId, month, endpoint: '/calendar/available-dates' },
        '[Agent] Fetching available dates'
      );

      // Determine the month range
      const now = new Date();
      const targetMonth = month
        ? new Date(`${month}-01T00:00:00Z`)
        : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      const startDate = new Date(targetMonth);
      const endDate = new Date(
        Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)
      );

      if (!availabilityService) {
        // No availability service — return all dates as available with a note
        const dates: Array<{ date: string; available: boolean }> = [];
        for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
          dates.push({
            date: d.toISOString().split('T')[0],
            available: true,
          });
        }

        res.json({
          serviceId,
          month: `${targetMonth.getUTCFullYear()}-${String(targetMonth.getUTCMonth() + 1).padStart(2, '0')}`,
          dates,
          calendarConnected: false,
          note: 'Calendar integration is not configured. All dates shown as available.',
        });
        return;
      }

      // Check each date in the month using the full availability pipeline
      // (blackouts + bookings + Google Calendar)
      const dates: Array<{ date: string; available: boolean; reason?: string }> = [];
      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const check = await availabilityService.checkAvailability(tenantId, dateStr);
        dates.push({
          date: dateStr,
          available: check.available,
          ...(check.reason ? { reason: check.reason } : {}),
        });
      }

      const availableCount = dates.filter((d) => d.available).length;
      const totalCount = dates.length;

      res.json({
        serviceId,
        month: `${targetMonth.getUTCFullYear()}-${String(targetMonth.getUTCMonth() + 1).padStart(2, '0')}`,
        dates,
        availableCount,
        totalCount,
        calendarConnected: true,
      });
    } catch (error) {
      handleError(res, error, '/calendar/available-dates');
    }
  });

  // POST /busy-times - Get busy time blocks from Google Calendar
  // Used by tenant-agent for calendar management
  router.post('/busy-times', async (req: Request, res: Response) => {
    try {
      const { tenantId, startDate, endDate } = GetBusyTimesSchema.parse(req.body);

      logger.info(
        { tenantId, startDate, endDate, endpoint: '/calendar/busy-times' },
        '[Agent] Fetching busy times'
      );

      if (!googleCalendarService) {
        res.json({
          busyTimes: [],
          calendarConnected: false,
          note: 'Google Calendar is not configured for this account. Connect Google Calendar in Settings > Integrations to see busy times.',
        });
        return;
      }

      const start = new Date(`${startDate}T00:00:00Z`);
      const end = new Date(`${endDate}T23:59:59Z`);

      const busyTimes = await googleCalendarService.getBusyTimes(tenantId, start, end);

      // Also get blackout dates in the range
      const blackouts = blackoutRepo ? await blackoutRepo.getAllBlackouts(tenantId) : [];
      const blackoutsInRange = blackouts.filter((b) => {
        return b.date >= startDate && b.date <= endDate;
      });

      res.json({
        busyTimes: busyTimes.map((bt) => ({
          start: bt.start.toISOString(),
          end: bt.end.toISOString(),
        })),
        blockedDates: blackoutsInRange.map((b) => ({
          date: b.date,
          reason: b.reason || 'Blocked',
        })),
        calendarConnected: true,
      });
    } catch (error) {
      handleError(res, error, '/calendar/busy-times');
    }
  });

  // POST /block-date - Block a date on the calendar (adds blackout)
  // Used by tenant-agent for calendar management
  router.post('/block-date', async (req: Request, res: Response) => {
    try {
      const { tenantId, date, reason } = BlockDateSchema.parse(req.body);

      logger.info(
        { tenantId, date, reason, endpoint: '/calendar/block-date' },
        '[Agent] Blocking calendar date'
      );

      if (!blackoutRepo) {
        res.status(503).json({
          error: 'Calendar management is not available. Please try again later.',
        });
        return;
      }

      // Check if the date is already blocked
      const existing = await blackoutRepo.getAllBlackouts(tenantId);
      const alreadyBlocked = existing.find((b) => b.date === date);

      if (alreadyBlocked) {
        res.json({
          success: true,
          alreadyBlocked: true,
          date,
          reason: alreadyBlocked.reason || reason || 'Blocked',
          message: `${date} is already blocked on your calendar.`,
        });
        return;
      }

      await blackoutRepo.addBlackout(tenantId, date, reason);

      res.json({
        success: true,
        alreadyBlocked: false,
        date,
        reason: reason || 'Blocked',
        message: `${date} has been blocked on your calendar. No new bookings can be made for this date.`,
      });
    } catch (error) {
      handleError(res, error, '/calendar/block-date');
    }
  });

  return router;
}
