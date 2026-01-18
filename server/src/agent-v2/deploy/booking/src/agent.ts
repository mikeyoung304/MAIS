/**
 * Booking Agent - Standalone Deployment Package
 *
 * This is a COMPLETELY STANDALONE agent deployment for Vertex AI Agent Engine.
 * It has NO imports to the main MAIS codebase - all code is inlined.
 *
 * Architecture:
 * - Uses Gemini 2.0 Flash for fast responses
 * - Tools call MAIS backend via HTTP (proper stateless pattern)
 * - Tenant context comes from session state
 *
 * Deploy with: npm run deploy
 */

import { LlmAgent, FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

// The agent endpoint path - defaults to /v1/internal/agent (MAIS convention)
// Set AGENT_API_PATH to override (e.g., /api/internal/agent)
const AGENT_API_PATH = process.env.AGENT_API_PATH || '/v1/internal/agent';

// =============================================================================
// SYSTEM PROMPT (Inlined from system-prompt.ts)
// =============================================================================

const BOOKING_AGENT_SYSTEM_PROMPT = `# Booking Agent - System Prompt

## Identity

You are a friendly, helpful booking assistant. You help customers discover services, check availability, answer questions, and complete bookings.

IMPORTANT: At the start of every conversation, use the get_business_info tool to learn about the business you represent. Use the business name naturally in conversation.

## Personality

- **Warm and Professional**: You're friendly but not overly casual. Think of a great receptionist.
- **Helpful**: You proactively offer relevant information without being pushy.
- **Efficient**: You respect the customer's time. Get to the point while staying pleasant.
- **Brand Ambassador**: You represent the business, not the underlying technology. Never mention "HANDLED", "Vertex AI", or that you're an AI.

## Core Capabilities

1. **Service Discovery**: Help customers understand what services are offered
2. **Availability Checking**: Show when appointments are available
3. **Question Answering**: Answer questions about the business, policies, and services
4. **Package Recommendations**: Suggest services based on customer needs
5. **Booking Creation**: Complete the booking process (with confirmation)

## First Message Behavior

When a customer first messages you:
1. Call get_business_info to learn the business name, location, and contact details
2. Greet them warmly using the business name
3. Offer to help with services, availability, or bookings

Example: "Hi there! Welcome to [Business Name]. I can help you learn about our services, check availability, or book an appointment. What can I help you with today?"

## Conversation Guidelines

### When showing services:
- Use get_services to fetch available services
- Present in a clear, scannable format: name, description, price, duration
- Ask if they'd like more details on any specific service

### When checking availability:
- Ask for their preferred dates if not provided
- Use check_availability to show available slots
- If a slot is unavailable, proactively suggest alternatives

### When answering questions:
- Use answer_faq to check the FAQ database first
- If confident, answer directly
- If uncertain, say "Based on what I know..." or suggest contacting the business

### When recommending services:
- Ask clarifying questions about their needs (budget, occasion, etc.)
- Use recommend_package with their preferences
- Explain WHY you're recommending each option

### When creating a booking:
- ALWAYS summarize details before confirming: service, date/time, price, policies
- Ask: "Does this look correct? Ready to book?"
- Only call create_booking after explicit confirmation ("yes", "book it", "confirm")

## Trust Tier Behaviors

| Operation | Behavior |
|-----------|----------|
| Get services, check availability, answer questions | Execute immediately |
| Create booking | Require explicit "yes" / "book it" / "confirm" |

## Things You Should NEVER Do

- Never reveal you're an AI or mention "HANDLED", "Vertex AI", etc.
- Never make up information about services, prices, or availability
- Never create a booking without explicit customer confirmation
- Never share one customer's information with another
- Never discuss other businesses or competitors

## Handling Edge Cases

**Customer wants something you don't offer:**
"I'm sorry, we don't currently offer that service. However, we do have [related service] which might interest you. Would you like to learn more?"

**Customer is frustrated:**
"I understand this can be frustrating. Let me see how I can help make this easier for you."

**Customer wants to speak to a human:**
Use get_business_info to get contact details, then: "Of course! You can reach us at [phone] or [email]. Is there anything else I can help with?"

**Ambiguous request:**
Ask ONE clarifying question. Don't pepper them with multiple questions.
`;

// =============================================================================
// TOOL PARAMETER SCHEMAS (Inlined from tools.ts)
// =============================================================================

const GetServicesParams = z.object({
  category: z.string().optional().describe('Optional category filter'),
  activeOnly: z.boolean().default(true).describe('Only return active services'),
});

const GetServiceDetailsParams = z.object({
  serviceId: z.string().describe('The service ID to get details for'),
});

const CheckAvailabilityParams = z.object({
  serviceId: z.string().describe('The service to check availability for'),
  startDate: z.string().describe('Start date for availability window (ISO format)'),
  endDate: z.string().describe('End date for availability window (ISO format)'),
});

const AnswerFaqParams = z.object({
  question: z.string().describe('The customer question to answer'),
});

const RecommendPackageParams = z.object({
  preferences: z
    .object({
      budget: z.enum(['low', 'medium', 'high']).optional(),
      occasion: z.string().optional(),
      groupSize: z.number().optional(),
    })
    .describe('Customer preferences for recommendation'),
});

const CreateBookingParams = z.object({
  serviceId: z.string().describe('The service to book'),
  customerName: z.string().describe('Customer name'),
  customerEmail: z.string().describe('Customer email'),
  customerPhone: z.string().optional().describe('Customer phone (optional)'),
  scheduledAt: z.string().describe('The appointment time (ISO format)'),
  notes: z.string().optional().describe('Optional booking notes'),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Helper to get tenant ID from tool context with proper null handling.
 * The tenantId is injected into session state when the chat session is created.
 */
function getTenantId(context: ToolContext | undefined): string | null {
  if (!context) return null;
  const tenantId = context.state?.get<string>('tenantId');
  return tenantId ?? null;
}

/**
 * Make an authenticated request to the MAIS backend API.
 */
async function callMaisApi(
  endpoint: string,
  tenantId: string,
  params: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(`${MAIS_API_URL}${AGENT_API_PATH}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({ tenantId, ...params }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[BookingAgent] API error: ${response.status} - ${errorText}`);
      return { ok: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    console.error(`[BookingAgent] Network error:`, error);
    return { ok: false, error: 'Network error - could not reach backend' };
  }
}

// =============================================================================
// TOOL IMPLEMENTATIONS
// =============================================================================

// T1: Get all services
const getServicesTool = new FunctionTool({
  name: 'get_services',
  description:
    'Get all available services for this business. Returns service names, descriptions, prices, and durations.',
  parameters: GetServicesParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available. Session may not be properly initialized.' };
    }

    console.log(`[BookingAgent] get_services called for tenant: ${tenantId}`);
    const result = await callMaisApi('/services', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T1: Get service details
const getServiceDetailsTool = new FunctionTool({
  name: 'get_service_details',
  description:
    'Get detailed information about a specific service including full description and pricing.',
  parameters: GetServiceDetailsParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    console.log(`[BookingAgent] get_service_details called for service: ${params.serviceId}`);
    const result = await callMaisApi('/service-details', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T1: Check availability
const checkAvailabilityTool = new FunctionTool({
  name: 'check_availability',
  description:
    'Check available time slots for a service within a date range. Returns a list of available and unavailable slots.',
  parameters: CheckAvailabilityParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    console.log(
      `[BookingAgent] check_availability called for dates: ${params.startDate} to ${params.endDate}`
    );
    const result = await callMaisApi('/availability', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T1: Get business info
const getBusinessInfoTool = new FunctionTool({
  name: 'get_business_info',
  description:
    'Get business information including name, location, contact details, and hours of operation.',
  parameters: z.object({}),
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    console.log(`[BookingAgent] get_business_info called for tenant: ${tenantId}`);
    const result = await callMaisApi('/business-info', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T1: Answer FAQ
const answerFaqTool = new FunctionTool({
  name: 'answer_faq',
  description:
    'Look up an answer in the business FAQ database. Returns the answer and confidence level.',
  parameters: AnswerFaqParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    console.log(
      `[BookingAgent] answer_faq called with question: ${params.question.substring(0, 50)}...`
    );
    const result = await callMaisApi('/faq', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T1: Recommend package
const recommendPackageTool = new FunctionTool({
  name: 'recommend_package',
  description:
    'Recommend services based on customer preferences like budget, occasion, and group size.',
  parameters: RecommendPackageParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    console.log(`[BookingAgent] recommend_package called with preferences:`, params.preferences);
    const result = await callMaisApi('/recommend', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// T3: Create booking (requires explicit confirmation)
const createBookingTool = new FunctionTool({
  name: 'create_booking',
  description:
    'Create a new booking for a service. IMPORTANT: Always show booking details and get explicit customer confirmation before calling this. This is a T3 action - requires explicit "yes" or "book it" from the customer.',
  parameters: CreateBookingParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    console.log(
      `[BookingAgent] create_booking called for service: ${params.serviceId} at ${params.scheduledAt}`
    );
    const result = await callMaisApi('/create-booking', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});

// =============================================================================
// BOOKING AGENT DEFINITION
// =============================================================================

/**
 * Booking Agent
 *
 * Customer-facing agent for service discovery and booking completion.
 * This is the agent that gets deployed to Vertex AI Agent Engine.
 */
export const bookingAgent = new LlmAgent({
  name: 'booking_agent',
  description:
    'Customer-facing agent for service discovery and booking completion. Helps customers learn about services, check availability, and make bookings.',

  // Model configuration - using Gemini 2.0 Flash for speed
  model: 'gemini-2.0-flash',
  generateContentConfig: {
    temperature: 0.5, // Balanced between creative and consistent
    maxOutputTokens: 2048,
  },

  // System prompt - agent discovers business info via tools
  instruction: BOOKING_AGENT_SYSTEM_PROMPT,

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

  // Lifecycle callbacks for debugging
  beforeToolCallback: async ({ tool, args }) => {
    console.log(`[BookingAgent] Calling tool: ${tool.name}`, JSON.stringify(args));
    return undefined; // Don't modify args
  },

  afterToolCallback: async ({ tool, response }) => {
    console.log(
      `[BookingAgent] Tool result: ${tool.name}`,
      typeof response === 'object' ? JSON.stringify(response) : response
    );
    return undefined; // Don't modify result
  },
});

// Default export for ADK deploy command
export default bookingAgent;
