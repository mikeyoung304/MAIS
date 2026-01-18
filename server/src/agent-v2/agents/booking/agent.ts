/**
 * Booking Agent - ADK Implementation
 *
 * This file defines the Booking Agent using the Google ADK (Agent Developer Kit).
 * It's deployed via `adk deploy cloud_run` command.
 *
 * Architecture:
 * - Uses Gemini 2.5 Flash for fast responses
 * - Tools are defined with Zod schemas for type safety
 * - Tenant context is injected via session state
 */

import { LlmAgent, FunctionTool, ToolContext } from '@google/adk';
import { z } from 'zod';
import { generateBookingAgentPrompt } from './system-prompt.js';
import {
  GetServicesParams,
  GetServiceDetailsParams,
  CheckAvailabilityParams,
  AnswerFaqParams,
  RecommendPackageParams,
  CreateBookingParams,
} from './tools.js';

/**
 * Helper to get tenant ID from tool context with proper null handling.
 */
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;
  const tenantId = context.state?.get<string>('tenantId');
  return tenantId ?? null;
}

/**
 * Tool definitions for the Booking Agent
 *
 * These tools connect to the MAIS backend to access tenant data.
 * Each tool receives tenantId from the session state.
 */

// T1: Get all services
const getServicesTool = new FunctionTool({
  name: 'get_services',
  description:
    'Get all available services for this business. Returns service names, descriptions, prices, and durations.',
  parameters: GetServicesParams.omit({ tenantId: true }), // tenantId comes from context
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    // Call MAIS backend API
    const response = await fetch(`${process.env.MAIS_API_URL}/api/internal/agent/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ tenantId, ...params }),
    });

    if (!response.ok) {
      return { error: 'Failed to fetch services' };
    }

    return response.json();
  },
});

// T1: Get service details
const getServiceDetailsTool = new FunctionTool({
  name: 'get_service_details',
  description: 'Get detailed information about a specific service.',
  parameters: GetServiceDetailsParams.omit({ tenantId: true }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const response = await fetch(`${process.env.MAIS_API_URL}/api/internal/agent/service-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ tenantId, ...params }),
    });

    if (!response.ok) {
      return { error: 'Failed to fetch service details' };
    }

    return response.json();
  },
});

// T1: Check availability
const checkAvailabilityTool = new FunctionTool({
  name: 'check_availability',
  description: 'Check available time slots for a service within a date range.',
  parameters: CheckAvailabilityParams.omit({ tenantId: true }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const response = await fetch(`${process.env.MAIS_API_URL}/api/internal/agent/availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ tenantId, ...params }),
    });

    if (!response.ok) {
      return { error: 'Failed to check availability' };
    }

    return response.json();
  },
});

// T1: Get business info
const getBusinessInfoTool = new FunctionTool({
  name: 'get_business_info',
  description: 'Get business information including name, location, contact details, and hours.',
  parameters: z.object({}),
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const response = await fetch(`${process.env.MAIS_API_URL}/api/internal/agent/business-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ tenantId }),
    });

    if (!response.ok) {
      return { error: 'Failed to fetch business info' };
    }

    return response.json();
  },
});

// T1: Answer FAQ
const answerFaqTool = new FunctionTool({
  name: 'answer_faq',
  description: 'Look up an answer in the business FAQ database.',
  parameters: AnswerFaqParams.omit({ tenantId: true }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const response = await fetch(`${process.env.MAIS_API_URL}/api/internal/agent/faq`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ tenantId, ...params }),
    });

    if (!response.ok) {
      return { error: 'Failed to search FAQ' };
    }

    return response.json();
  },
});

// T1: Recommend package
const recommendPackageTool = new FunctionTool({
  name: 'recommend_package',
  description: 'Recommend services based on customer preferences like budget and occasion.',
  parameters: RecommendPackageParams.omit({ tenantId: true }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const response = await fetch(`${process.env.MAIS_API_URL}/api/internal/agent/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ tenantId, ...params }),
    });

    if (!response.ok) {
      return { error: 'Failed to get recommendations' };
    }

    return response.json();
  },
});

// T3: Create booking (requires explicit confirmation)
const createBookingTool = new FunctionTool({
  name: 'create_booking',
  description:
    'Create a new booking. IMPORTANT: Always show booking details and get explicit customer confirmation before calling this.',
  parameters: CreateBookingParams.omit({ tenantId: true }),
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    const response = await fetch(`${process.env.MAIS_API_URL}/api/internal/agent/create-booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({ tenantId, ...params }),
    });

    if (!response.ok) {
      return { error: 'Failed to create booking' };
    }

    return response.json();
  },
});

/**
 * Booking Agent Definition
 *
 * This is exported for use by the ADK deploy command.
 */
export const bookingAgent = new LlmAgent({
  name: 'booking_agent',
  description: 'Customer-facing agent for service discovery and booking completion.',

  // Model configuration
  model: 'gemini-2.0-flash',
  generateContentConfig: {
    temperature: 0.5,
    maxOutputTokens: 2048,
  },

  // System prompt with placeholder - gets filled with tenant context
  instruction: generateBookingAgentPrompt({
    businessName: '{business_name}', // Replaced at runtime
    phone: '{phone}',
    email: '{email}',
    location: '{location}',
  }),

  // Register all tools
  tools: [
    getServicesTool,
    getServiceDetailsTool,
    checkAvailabilityTool,
    getBusinessInfoTool,
    answerFaqTool,
    recommendPackageTool,
    createBookingTool,
  ],

  // Callbacks for lifecycle events
  beforeToolCallback: async ({ tool, args }) => {
    console.log(`[BookingAgent] Calling tool: ${tool.name}`, args);
    return undefined; // Don't modify args
  },

  afterToolCallback: async ({ tool, response }) => {
    console.log(`[BookingAgent] Tool result: ${tool.name}`, response);
    return undefined; // Don't modify result
  },
});

// Default export for ADK deploy
export default bookingAgent;
