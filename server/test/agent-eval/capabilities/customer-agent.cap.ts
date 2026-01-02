/**
 * Customer Agent Capability Map
 *
 * Defines what the customer-facing chatbot can do.
 * Used for parity tests and outcome-based testing.
 *
 * Customer Agent Purpose:
 * Help visitors browse services, check availability, and book appointments.
 * This is the public-facing agent embedded in tenant storefronts.
 */

import type { AgentCapabilityMap } from './capability-map';

/**
 * Customer Agent Capabilities
 *
 * Minimal toolset focused on the booking journey:
 * Browse → Check Availability → Book → Confirm
 */
export const CUSTOMER_AGENT_CAPABILITIES: AgentCapabilityMap = {
  agentType: 'customer',
  description:
    'Customer-facing booking assistant for tenant storefronts. Helps visitors browse services, check availability, and book appointments.',
  capabilities: [
    // ─────────────────────────────────────────────────────────────────────────
    // READ CAPABILITIES
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'browse-services',
      description: 'View available services and packages with pricing',
      requiredTool: 'get_services',
      trustTier: 'T1',
      promptKeywords: ['services', 'packages', 'offerings', 'browse', 'what do you offer'],
      category: 'read',
    },
    {
      id: 'check-availability',
      description: 'Check available dates for a specific service',
      requiredTool: 'check_availability',
      trustTier: 'T1',
      promptKeywords: ['availability', 'available', 'dates', 'when', 'schedule'],
      category: 'read',
    },
    {
      id: 'get-business-info',
      description: 'Get business hours, policies, contact info, and FAQ',
      requiredTool: 'get_business_info',
      trustTier: 'T1',
      promptKeywords: ['hours', 'contact', 'policy', 'cancellation', 'faq', 'location'],
      category: 'read',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // BOOKING CAPABILITIES
    // ─────────────────────────────────────────────────────────────────────────
    {
      id: 'book-service',
      description: 'Create a booking for a service on a specific date',
      requiredTool: 'book_service',
      trustTier: 'T3',
      promptKeywords: ['book', 'reserve', 'appointment', 'schedule'],
      category: 'booking',
    },
    {
      id: 'confirm-booking',
      description: 'Confirm a pending booking proposal after customer approval',
      requiredTool: 'confirm_proposal',
      trustTier: 'T1', // The confirmation step itself is safe
      promptKeywords: ['confirm', 'yes', 'go ahead', 'book it'],
      category: 'booking',
    },
  ],
};

/**
 * Customer journey stages for outcome testing
 *
 * These represent the typical customer flow:
 * 1. Discovery - Browse services, learn about offerings
 * 2. Exploration - Check availability, ask questions
 * 3. Booking - Create and confirm a booking
 */
export const CUSTOMER_JOURNEY_STAGES = [
  { stage: 'discovery', capabilities: ['browse-services', 'get-business-info'] },
  { stage: 'exploration', capabilities: ['check-availability', 'get-business-info'] },
  { stage: 'booking', capabilities: ['book-service', 'confirm-booking'] },
] as const;

/**
 * Critical paths that must work for the agent to be functional
 *
 * These are tested with higher priority in CI.
 */
export const CRITICAL_CUSTOMER_PATHS = [
  {
    name: 'complete-booking-journey',
    description: 'Customer can go from browsing to confirmed booking',
    capabilities: ['browse-services', 'check-availability', 'book-service', 'confirm-booking'],
  },
  {
    name: 'information-retrieval',
    description: 'Customer can get business information without booking',
    capabilities: ['get-business-info', 'browse-services'],
  },
] as const;
