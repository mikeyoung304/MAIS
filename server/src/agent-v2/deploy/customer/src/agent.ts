/**
 * Customer Agent - Standalone Deployment Package
 *
 * This is the UNIFIED Customer Agent that consolidates capabilities from:
 * - Booking Agent (service discovery, availability, booking creation)
 * - Project Hub Agent (customer view - status, prep, timeline, requests)
 *
 * Architecture:
 * - Uses Gemini 2.0 Flash for fast responses
 * - All tools execute directly (no A2A delegation)
 * - Seamless transition from browsing to post-booking
 *
 * Benefits over multi-agent approach:
 * - No context loss during delegation (pitfall #82)
 * - Faster responses (no inter-agent latency)
 * - Simpler maintenance (1 codebase vs 2)
 * - Single customer experience across journey
 *
 * Deploy with: npm run deploy
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md Phase 3
 */

import { LlmAgent } from '@google/adk';
import { logger } from './utils.js';
import { CUSTOMER_AGENT_SYSTEM_PROMPT } from './prompts/system.js';
import {
  // Booking tools (T1 except create_booking which is T3)
  getServicesTool,
  getServiceDetailsTool,
  checkAvailabilityTool,
  getBusinessInfoTool,
  answerFaqTool,
  recommendTierTool,
  createBookingTool,

  // Project tools (T1 except submit_request for cancellation/refund)
  bootstrapCustomerSessionTool,
  getProjectStatusTool,
  getPrepChecklistTool,
  answerPrepQuestionTool,
  getTimelineTool,
  submitRequestTool,

  // Calendar tools (T1 - Google Calendar availability)
  getAvailableDatesTool,
} from './tools/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Customer Agent Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Customer Agent
 *
 * The unified agent for customer-facing interactions. Handles the entire
 * customer journey from initial service discovery through post-booking
 * project management.
 *
 * Tool count: 14
 * - 7 booking tools (from booking-agent)
 * - 6 project tools (from project-hub-agent customer view)
 * - 1 calendar tool (Google Calendar availability)
 *
 * Trust Tiers:
 * - T1 (auto-execute): Most tools - read operations, queries
 * - T3 (require confirm): create_booking, submit_request (cancellation/refund)
 */
export const customerAgent = new LlmAgent({
  name: 'customer',
  description:
    'Unified Customer Agent for HANDLED - handles service discovery, booking creation, and post-booking project management for customers.',

  // Model configuration - Gemini 2.0 Flash for speed
  model: 'gemini-2.0-flash',
  generateContentConfig: {
    temperature: 0.5, // Balanced between creative and consistent
    maxOutputTokens: 2048, // Sufficient for customer interactions
  },

  // System prompt with personality and routing logic
  instruction: CUSTOMER_AGENT_SYSTEM_PROMPT,

  // All tools registered by capability area
  tools: [
    // ─────────────────────────────────────────────────────────────────────────
    // BOOTSTRAP (Always call first)
    // ─────────────────────────────────────────────────────────────────────────
    bootstrapCustomerSessionTool,

    // ─────────────────────────────────────────────────────────────────────────
    // BOOKING TOOLS (Pre-booking customer journey)
    // ─────────────────────────────────────────────────────────────────────────

    // T1: Service Discovery
    getServicesTool,
    getServiceDetailsTool,
    getBusinessInfoTool,

    // T1: Availability & Recommendations
    checkAvailabilityTool,
    recommendTierTool,

    // T1: Questions
    answerFaqTool,

    // T3: Booking Creation (requires explicit confirmation)
    createBookingTool,

    // ─────────────────────────────────────────────────────────────────────────
    // PROJECT TOOLS (Post-booking customer journey)
    // ─────────────────────────────────────────────────────────────────────────

    // T1: Status & Information
    getProjectStatusTool,
    getPrepChecklistTool,
    answerPrepQuestionTool,
    getTimelineTool,

    // T2/T3: Request Submission
    // T2 for reschedule, add-on, question
    // T3 for cancellation, refund (requires confirmation)
    submitRequestTool,

    // ─────────────────────────────────────────────────────────────────────────
    // CALENDAR TOOLS (Google Calendar availability)
    // ─────────────────────────────────────────────────────────────────────────

    // T1: Get available dates for a service from Google Calendar
    getAvailableDatesTool,
  ],

  // Lifecycle callbacks for observability
  beforeToolCallback: async ({ tool, args }) => {
    logger.info(
      { toolName: tool.name, args: JSON.stringify(args).substring(0, 200) },
      '[CustomerAgent] Calling tool'
    );
    return undefined;
  },

  afterToolCallback: async ({ tool, response }) => {
    const preview =
      typeof response === 'object'
        ? JSON.stringify(response).substring(0, 200)
        : String(response).substring(0, 200);
    logger.info({ result: preview }, `[CustomerAgent] Tool result: ${tool.name}`);
    return undefined;
  },
});

// Default export for ADK deploy command
export default customerAgent;
