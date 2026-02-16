/**
 * Booking Tools - Migrated from booking-agent
 *
 * Customer-facing tools for service discovery and booking creation.
 * All tools are T1 (auto-execute) except create_booking which is T3.
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md Phase 3
 */

import { FunctionTool, type ToolContext as _ToolContext } from '@google/adk';
import { z } from 'zod';
import { callMaisApi, logger, wrapToolExecute, validateParams, requireTenantId } from '../utils.js';

// =============================================================================
// PARAMETER SCHEMAS
// =============================================================================

const GetServicesParams = z.object({
  category: z.string().optional().describe('Optional category filter'),
  activeOnly: z.boolean().default(true).describe('Only return active services'),
});

const GetServiceDetailsParams = z.object({
  serviceId: z.string().min(1).describe('The service ID to get details for'),
});

const CheckAvailabilityParams = z.object({
  serviceId: z.string().min(1).describe('The service to check availability for'),
  startDate: z.string().describe('Start date for availability window (ISO format)'),
  endDate: z.string().describe('End date for availability window (ISO format)'),
});

const AnswerFaqParams = z.object({
  question: z.string().min(1).describe('The customer question to answer'),
});

const RecommendTierParams = z.object({
  preferences: z
    .object({
      budget: z.enum(['low', 'medium', 'high']).optional(),
      occasion: z.string().optional(),
      groupSize: z.number().optional(),
    })
    .describe('Customer preferences for recommendation'),
});

const CreateBookingParams = z.object({
  serviceId: z.string().min(1).describe('The service to book'),
  customerName: z.string().min(1).describe('Customer name'),
  customerEmail: z.string().email().describe('Customer email'),
  customerPhone: z.string().optional().describe('Customer phone (optional)'),
  scheduledAt: z.string().describe('The appointment time (ISO format)'),
  notes: z.string().optional().describe('Optional booking notes'),
  confirmationReceived: z
    .boolean()
    .describe('Must be true - confirms customer explicitly approved the booking'),
});

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

/**
 * T1: Get all services for this business
 */
export const getServicesTool = new FunctionTool({
  name: 'get_services',
  description:
    'Get all available services for this business. Returns service names, descriptions, prices, and durations.',
  parameters: GetServicesParams,
  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(GetServicesParams, params);
    const tenantId = requireTenantId(context);

    logger.info({}, `[CustomerAgent] get_services called for tenant: ${tenantId}`);
    const result = await callMaisApi('/services', tenantId, validParams);

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true, ...(result.data as object) };
  }),
});

/**
 * T1: Get detailed information about a specific service
 */
export const getServiceDetailsTool = new FunctionTool({
  name: 'get_service_details',
  description:
    'Get detailed information about a specific service including full description and pricing.',
  parameters: GetServiceDetailsParams,
  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(GetServiceDetailsParams, params);
    const tenantId = requireTenantId(context);

    logger.info(
      {},
      `[CustomerAgent] get_service_details called for service: ${validParams.serviceId}`
    );
    const result = await callMaisApi('/service-details', tenantId, validParams);

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true, ...(result.data as object) };
  }),
});

/**
 * T1: Check availability for a service
 */
export const checkAvailabilityTool = new FunctionTool({
  name: 'check_availability',
  description:
    'Check available time slots for a service within a date range. Returns a list of available and unavailable slots.',
  parameters: CheckAvailabilityParams,
  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(CheckAvailabilityParams, params);
    const tenantId = requireTenantId(context);

    logger.info(
      {},
      `[CustomerAgent] check_availability called for dates: ${validParams.startDate} to ${validParams.endDate}`
    );

    const result = await callMaisApi('/availability', tenantId, validParams);

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true, ...(result.data as object) };
  }),
});

/**
 * T1: Get business information
 */
export const getBusinessInfoTool = new FunctionTool({
  name: 'get_business_info',
  description:
    'Get business information including name, location, contact details, and hours of operation.',
  parameters: z.object({}),
  execute: wrapToolExecute(async (_params, context) => {
    const tenantId = requireTenantId(context);

    logger.info({}, `[CustomerAgent] get_business_info called for tenant: ${tenantId}`);
    const result = await callMaisApi('/business-info', tenantId);

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true, ...(result.data as object) };
  }),
});

/**
 * T1: Answer FAQ questions
 */
export const answerFaqTool = new FunctionTool({
  name: 'answer_faq',
  description:
    'Look up an answer in the business FAQ database. Returns the answer and confidence level.',
  parameters: AnswerFaqParams,
  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(AnswerFaqParams, params);
    const tenantId = requireTenantId(context);

    logger.info(
      {},
      `[CustomerAgent] answer_faq called with question: ${validParams.question.substring(0, 50)}...`
    );

    const result = await callMaisApi('/faq', tenantId, validParams);

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true, ...(result.data as object) };
  }),
});

/**
 * T1: Recommend tiers based on preferences
 */
export const recommendTierTool = new FunctionTool({
  name: 'recommend_tier',
  description:
    'Recommend services based on customer preferences like budget, occasion, and group size.',
  parameters: RecommendTierParams,
  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(RecommendTierParams, params);
    const tenantId = requireTenantId(context);

    logger.info(
      { preferences: validParams.preferences },
      '[CustomerAgent] recommend_tier called with preferences'
    );
    const result = await callMaisApi('/recommend', tenantId, validParams);

    if (!result.ok) {
      return { success: false, error: result.error };
    }
    return { success: true, ...(result.data as object) };
  }),
});

/**
 * T3: Create a booking (requires explicit confirmation)
 *
 * IMPORTANT: This is a T3 action. Agent must:
 * 1. Show booking details to customer
 * 2. Ask for explicit confirmation ("yes", "book it", "confirm")
 * 3. Only call this tool with confirmationReceived: true after confirmation
 */
export const createBookingTool = new FunctionTool({
  name: 'create_booking',
  description:
    'Create a new booking for a service. T3 ACTION: Always show booking details and get explicit customer confirmation before calling. Requires confirmationReceived: true.',
  parameters: CreateBookingParams,
  execute: wrapToolExecute(async (params, context) => {
    const validParams = validateParams(CreateBookingParams, params);

    // T3 confirmation check (Pitfall #45)
    if (!validParams.confirmationReceived) {
      return {
        requiresConfirmation: true,
        confirmationType: 'T3_BOOKING',
        message:
          'Before creating this booking, please confirm with the customer. Show them the service, date/time, and price, then ask "Does this look correct? Ready to book?"',
        nextStep:
          'After customer confirms with "yes", "book it", or "confirm", call this tool again with confirmationReceived: true',
      };
    }

    const tenantId = requireTenantId(context);

    logger.info(
      {},
      `[CustomerAgent] create_booking called for service: ${validParams.serviceId} at ${validParams.scheduledAt}`
    );

    const result = await callMaisApi('/create-booking', tenantId, validParams);

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    // Return state for agent context (Pitfall #48)
    return {
      success: true,
      ...(result.data as object),
      bookingCreated: true,
      message: 'Booking confirmed! The customer will receive a confirmation email.',
    };
  }),
});
