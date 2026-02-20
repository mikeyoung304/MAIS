/**
 * Calendar Tools - Tenant Agent
 *
 * Tenant-facing tools for managing Google Calendar integration:
 * - check_calendar_availability: View busy/free times (T1)
 * - block_calendar_date: Block a date from bookings (T2)
 *
 * All tools gracefully handle missing Google Calendar configuration.
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { callMaisApi, logger, wrapToolExecute, validateParams, requireTenantId } from '../utils.js';

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const CheckCalendarAvailabilityParams = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Start date in YYYY-MM-DD format (e.g., "2026-03-01")'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('End date in YYYY-MM-DD format (e.g., "2026-03-31")'),
});

const BlockCalendarDateParams = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Date to block in YYYY-MM-DD format (e.g., "2026-03-15")'),
  reason: z
    .string()
    .optional()
    .describe('Optional reason for blocking (e.g., "Personal day", "Equipment maintenance")'),
});

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

/**
 * T1: Check calendar availability (busy/free times)
 *
 * Returns busy time blocks from Google Calendar and any manually blocked
 * dates. Helps tenants see their schedule at a glance.
 */
export const checkCalendarAvailabilityTool = new FunctionTool({
  name: 'check_calendar_availability',
  description: `Check your Google Calendar for busy and free times in a date range.
Returns busy time blocks from Google Calendar and any dates you've manually blocked.
If Google Calendar is not connected, returns only manually blocked dates with a note to connect in Settings.
Use this to help the tenant see their availability before blocking dates or managing bookings.`,
  parameters: CheckCalendarAvailabilityParams,
  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(CheckCalendarAvailabilityParams, params);
    const tenantId = requireTenantId(context);

    logger.info(
      { startDate: validParams.startDate, endDate: validParams.endDate },
      `[TenantAgent] check_calendar_availability called for tenant: ${tenantId}`
    );

    const result = await callMaisApi('/calendar/busy-times', tenantId, {
      startDate: validParams.startDate,
      endDate: validParams.endDate,
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    return { success: true, ...(result.data as object) };
  }),
});

/**
 * T2: Block a date on the calendar
 *
 * Adds a blackout date to prevent new bookings on that date. This is a
 * T2 action because it modifies scheduling data.
 */
export const blockCalendarDateTool = new FunctionTool({
  name: 'block_calendar_date',
  description: `Block a specific date on your calendar to prevent new bookings.
This adds a blackout date — customers will not be able to book this date.
Optionally provide a reason (e.g., "Personal day", "Holiday", "Equipment maintenance").
If the date is already blocked, returns confirmation without creating a duplicate.

This is a T2 tool — executes and shows result. No confirmation needed since it's reversible.`,
  parameters: BlockCalendarDateParams,
  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(BlockCalendarDateParams, params);
    const tenantId = requireTenantId(context);

    logger.info(
      { date: validParams.date, reason: validParams.reason },
      `[TenantAgent] block_calendar_date called for tenant: ${tenantId}`
    );

    const result = await callMaisApi('/calendar/block-date', tenantId, {
      date: validParams.date,
      ...(validParams.reason ? { reason: validParams.reason } : {}),
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    return { success: true, ...(result.data as object) };
  }),
});
