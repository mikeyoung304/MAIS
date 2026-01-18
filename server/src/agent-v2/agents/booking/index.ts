/**
 * Booking Agent
 *
 * Customer-facing agent for service discovery and booking.
 * This is deployed as a standalone agent in Vertex AI Agent Builder.
 *
 * Architecture:
 * - Receives tenant context from session state
 * - Uses RAG grounding from tenant's service/FAQ data
 * - Tools are scoped by tenantId for multi-tenant isolation
 */

export { BookingAgentTools, BOOKING_AGENT_TOOL_DEFINITIONS } from './tools.js';
export { BOOKING_AGENT_SYSTEM_PROMPT, generateBookingAgentPrompt } from './system-prompt.js';

// Re-export agent card for reference
// import agentCard from './agent-card.json' assert { type: 'json' };
// export { agentCard };

/**
 * Booking Agent Configuration
 *
 * This is used when deploying the agent via ADK CLI or programmatically.
 */
export const BOOKING_AGENT_CONFIG = {
  name: 'booking_agent',
  displayName: 'Booking Agent',
  description: 'Customer-facing agent for service discovery and booking completion.',

  // Model configuration
  model: {
    name: 'gemini-2.5-flash',
    temperature: 0.5,
    maxOutputTokens: 2048,
  },

  // Security settings
  security: {
    publicFacing: true,
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 300,
    },
    promptInjectionDetection: true,
  },

  // Grounding configuration
  grounding: {
    ragEnabled: true,
    dataSources: ['tenant_services', 'tenant_faqs'],
  },

  // Trust tier configuration
  trustTiers: {
    T1: [
      'get_services',
      'get_service_details',
      'check_availability',
      'get_business_info',
      'answer_faq',
      'recommend_package',
    ],
    T2: [], // No T2 tools for booking agent
    T3: ['create_booking'],
  },
};

/**
 * Factory function to create a configured Booking Agent instance.
 *
 * This will be used when the ADK is fully integrated.
 */
export async function createBookingAgent(dependencies: { prisma: any; tenantService: any }) {
  const { BookingAgentTools } = await import('./tools.js');

  const tools = new BookingAgentTools(dependencies.prisma, dependencies.tenantService);

  return {
    config: BOOKING_AGENT_CONFIG,
    tools,
    // Agent instance will be created by ADK
  };
}
