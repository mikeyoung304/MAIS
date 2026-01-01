/**
 * Mock Anthropic SDK for Integration Tests
 *
 * Provides fixtures and utilities for mocking Claude API responses
 * in orchestrator integration tests.
 *
 * @usage
 * ```typescript
 * vi.mock('@anthropic-ai/sdk', () => ({
 *   default: vi.fn().mockImplementation(() => mockAnthropicClient)
 * }));
 * ```
 */

import { vi } from 'vitest';

/**
 * Types matching Anthropic SDK response structures
 */
export interface MockContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface MockAnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: MockContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Create a mock text-only response
 */
export function createTextResponse(text: string): MockAnthropicResponse {
  return {
    id: `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

/**
 * Create a response with tool use
 */
export function createToolUseResponse(
  toolName: string,
  toolInput: Record<string, unknown>,
  preText?: string
): MockAnthropicResponse {
  const content: MockContentBlock[] = [];

  if (preText) {
    content.push({ type: 'text', text: preText });
  }

  content.push({
    type: 'tool_use',
    id: `toolu_${Date.now()}`,
    name: toolName,
    input: toolInput,
  });

  return {
    id: `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content,
    model: 'claude-sonnet-4-20250514',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 150, output_tokens: 80 },
  };
}

/**
 * Create a mock Anthropic client with configurable responses
 *
 * @param responses - Queue of responses to return in order
 */
export function createMockAnthropicClient(responses: MockAnthropicResponse[]) {
  let responseIndex = 0;

  return {
    messages: {
      create: vi.fn().mockImplementation(() => {
        const response = responses[responseIndex] || responses[responses.length - 1];
        responseIndex++;
        return Promise.resolve(response);
      }),
    },
  };
}

/**
 * Response fixtures for common test scenarios
 */
export const MOCK_RESPONSES = {
  /**
   * Simple greeting response
   */
  greeting: createTextResponse('Hello! How can I help you book an appointment today?'),

  /**
   * Response that triggers get_services tool
   */
  getServices: createToolUseResponse(
    'get_services',
    {},
    'Let me check what services are available.'
  ),

  /**
   * Response after viewing services
   */
  afterServices: createTextResponse('I found the following services. Which one interests you?'),

  /**
   * Response that triggers check_availability tool
   */
  checkAvailability: (packageId: string) =>
    createToolUseResponse('check_availability', { packageId }, 'Let me check the available dates.'),

  /**
   * Response after checking availability
   */
  afterAvailability: createTextResponse(
    'I found several available dates. Which one works best for you?'
  ),

  /**
   * Response that triggers book_service tool
   */
  bookService: (params: {
    packageId: string;
    date: string;
    customerName: string;
    customerEmail: string;
  }) => createToolUseResponse('book_service', params, "I'll prepare your booking now."),

  /**
   * Response after booking proposal created
   */
  afterBookingProposal: createTextResponse(
    "I've prepared your booking. Please confirm by saying 'yes' to complete."
  ),

  /**
   * Response that triggers confirm_proposal tool
   */
  confirmProposal: (proposalId: string) =>
    createToolUseResponse('confirm_proposal', { proposalId }, 'Confirming your booking now.'),

  /**
   * Response after booking confirmed
   */
  bookingConfirmed: createTextResponse(
    "Your booking is confirmed! You'll receive a confirmation email shortly."
  ),

  /**
   * Response for prompt injection attempt
   */
  injectionDetected: createTextResponse(
    "I'm here to help you with booking questions. How can I assist you today?"
  ),

  /**
   * Response that triggers update_onboarding_state
   */
  updateOnboardingState: (phase: string, data: Record<string, unknown>) =>
    createToolUseResponse('update_onboarding_state', { phase, data }),

  /**
   * Response for market research
   */
  marketResearch: (businessType: string, location: string) =>
    createToolUseResponse('get_market_research', { businessType, location }),

  /**
   * Response for upserting services
   */
  upsertServices: (segments: unknown[]) => createToolUseResponse('upsert_services', { segments }),
};

/**
 * Reset mock between tests
 */
export function resetMockClient(client: ReturnType<typeof createMockAnthropicClient>) {
  client.messages.create.mockClear();
}
