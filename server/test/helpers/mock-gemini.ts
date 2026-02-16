/**
 * Mock Gemini Client for Integration Tests
 *
 * Provides fixtures and utilities for mocking Vertex AI Gemini responses
 * in orchestrator integration tests.
 *
 * @usage
 * ```typescript
 * vi.mock('../../src/llm', () => ({
 *   ...actualLlm,
 *   getVertexClient: vi.fn(() => mockGeminiClient),
 * }));
 * ```
 */

import { vi } from 'vitest';

// Re-export the actual LLM module functions that don't need mocking
export * from '../../src/llm';

/**
 * Types matching Gemini SDK response structures
 */
export interface MockGeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: unknown;
  };
}

export interface MockGeminiContent {
  role: 'model' | 'user';
  parts: MockGeminiPart[];
}

export interface MockGeminiCandidate {
  content: MockGeminiContent;
  finishReason?: string;
}

export interface MockGeminiResponse {
  candidates: MockGeminiCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Create a mock text-only response (Gemini format)
 */
export function createTextResponse(text: string): MockGeminiResponse {
  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text }],
        },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      totalTokenCount: 150,
    },
  };
}

/**
 * Create a response with function call (Gemini format)
 */
export function createToolUseResponse(
  toolName: string,
  toolInput: Record<string, unknown>,
  preText?: string
): MockGeminiResponse {
  const parts: MockGeminiPart[] = [];

  if (preText) {
    parts.push({ text: preText });
  }

  parts.push({
    functionCall: {
      name: toolName,
      args: toolInput,
    },
  });

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts,
        },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 150,
      candidatesTokenCount: 80,
      totalTokenCount: 230,
    },
  };
}

/**
 * Create a mock Gemini client with configurable responses
 *
 * @param responses - Queue of responses to return in order
 */
export function createMockGeminiClient(responses: MockGeminiResponse[]) {
  let responseIndex = 0;

  const mockGenerateContent = vi.fn().mockImplementation(() => {
    const response = responses[responseIndex] || responses[responses.length - 1];
    responseIndex++;
    return Promise.resolve(response);
  });

  return {
    models: {
      generateContent: mockGenerateContent,
    },
    // Helper to reset the response queue
    _resetResponses: (newResponses: MockGeminiResponse[]) => {
      responseIndex = 0;
      responses.splice(0, responses.length, ...newResponses);
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
  checkAvailability: (tierId: string) =>
    createToolUseResponse('check_availability', { tierId }, 'Let me check the available dates.'),

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
    tierId: string;
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
export function resetMockClient(client: ReturnType<typeof createMockGeminiClient>) {
  client.models.generateContent.mockClear();
}
