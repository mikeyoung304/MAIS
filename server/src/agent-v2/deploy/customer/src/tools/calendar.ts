/**
 * Calendar Tools - Customer Agent
 *
 * Customer-facing tool for checking available dates via Google Calendar
 * integration. Falls back gracefully if calendar is not configured.
 *
 * T1 (auto-execute): Read-only availability check.
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { callMaisApi, logger, wrapToolExecute, validateParams, requireTenantId } from '../utils.js';

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const GetAvailableDatesParams = z.object({
  serviceId: z.string().min(1).describe('The service ID to check available dates for'),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .describe(
      'Month to check in YYYY-MM format (e.g., "2026-03"). Defaults to the current month if not provided.'
    ),
});

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

/**
 * T1: Get available dates for a service from Google Calendar
 *
 * Returns dates in a given month with availability status. Uses the full
 * availability pipeline (blackouts + bookings + Google Calendar) when
 * configured, or falls back to showing all dates as available with a note.
 */
export const getAvailableDatesTool = new FunctionTool({
  name: 'get_available_dates',
  description: `Check which dates are available for booking a service in a given month.
Returns a list of dates with their availability status (available/unavailable) and reasons.
Uses Google Calendar data when connected, including existing calendar events, blackout dates, and existing bookings.
If no month is specified, checks the current month.`,
  parameters: GetAvailableDatesParams,
  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(GetAvailableDatesParams, params);
    const tenantId = requireTenantId(context);

    logger.info(
      { serviceId: validParams.serviceId, month: validParams.month },
      `[CustomerAgent] get_available_dates called for tenant: ${tenantId}`
    );

    const result = await callMaisApi('/calendar/available-dates', tenantId, {
      serviceId: validParams.serviceId,
      ...(validParams.month ? { month: validParams.month } : {}),
    });

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    return { success: true, ...(result.data as object) };
  }),
});
