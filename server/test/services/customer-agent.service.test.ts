/**
 * Unit tests for CustomerAgentService
 *
 * Tests customer booking chat including:
 * - AI quota enforcement (subscription limits)
 * - Multi-tenant session isolation
 * - ADK response parsing
 * - Error handling (timeouts, 404s, invalid responses)
 * - Greeting personalization
 *
 * @see server/src/services/customer-agent.service.ts
 * @see todos/752-deferred-p2-customer-agent-service-no-tests.md
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import type { PrismaClient } from '../../src/generated/prisma/client';
import type { SessionService, SessionWithMessages } from '../../src/services/session';

// =============================================================================
// MOCKS
// =============================================================================

// Mock session service module
const mockSessionService: Partial<SessionService> = {
  getOrCreateSession: vi.fn(),
  getSession: vi.fn(),
  appendMessage: vi.fn(),
};

vi.mock('../../src/services/session', () => ({
  createSessionService: vi.fn(() => mockSessionService),
}));

// Mock logger to prevent console noise
vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock google-auth-library
vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getIdTokenClient: vi.fn().mockResolvedValue({
      getRequestHeaders: vi.fn().mockResolvedValue({
        Authorization: 'Bearer mock-token',
      }),
    }),
  })),
  JWT: vi.fn().mockImplementation(() => ({
    fetchIdToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  })),
}));

// Import after mocks
import {
  CustomerAgentService,
  createCustomerAgentService,
} from '../../src/services/customer-agent.service';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockPrisma(
  overrides: Partial<{
    tenant: {
      findUnique: MockedFunction<any>;
      update: MockedFunction<any>;
    };
  }> = {}
): PrismaClient {
  return {
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
      ...overrides.tenant,
    },
  } as unknown as PrismaClient;
}

function createMockSession(overrides: Partial<SessionWithMessages> = {}): SessionWithMessages {
  return {
    id: 'session_123',
    tenantId: 'tenant_A',
    sessionId: 'adk_session_123',
    type: 'CUSTOMER',
    customerId: 'customer_456',
    state: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
    deletedAt: null,
    messages: [],
    ...overrides,
  };
}

function mockFetchResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response;
}

// ADK response formats
const ADK_ARRAY_RESPONSE = [
  {
    content: {
      role: 'model',
      parts: [{ text: 'Hello! How can I help you book an appointment?' }],
    },
  },
];

const ADK_MESSAGES_RESPONSE = {
  messages: [
    {
      role: 'model',
      parts: [{ text: 'Hello! How can I help you book an appointment?' }],
    },
  ],
};

const ADK_WITH_TOOL_CALLS = [
  {
    content: {
      role: 'model',
      parts: [{ functionCall: { name: 'get_packages', args: { tenantId: 'tenant_A' } } }],
    },
  },
  {
    content: {
      role: 'model',
      parts: [{ functionResponse: { name: 'get_packages', response: { packages: [] } } }],
    },
  },
  {
    content: {
      role: 'model',
      parts: [{ text: 'I found your packages.' }],
    },
  },
];

// =============================================================================
// TESTS
// =============================================================================

describe('CustomerAgentService', () => {
  let service: CustomerAgentService;
  let mockPrisma: PrismaClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock Prisma
    mockPrisma = createMockPrisma();

    // Setup mock session service defaults
    (mockSessionService.getOrCreateSession as MockedFunction<any>).mockResolvedValue(
      createMockSession()
    );
    (mockSessionService.getSession as MockedFunction<any>).mockResolvedValue(createMockSession());
    (mockSessionService.appendMessage as MockedFunction<any>).mockResolvedValue({
      success: true,
      newVersion: 2,
    });

    // Setup mock fetch for ADK
    global.fetch = vi.fn().mockResolvedValue(mockFetchResponse({ id: 'adk_session_123' }));

    // Set required env var
    process.env.BOOKING_AGENT_URL = 'https://booking-agent.example.com';

    // Create service
    service = createCustomerAgentService(mockPrisma);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.BOOKING_AGENT_URL;
  });

  // ===========================================================================
  // getGreeting
  // ===========================================================================

  describe('getGreeting', () => {
    it('returns personalized greeting when tenant exists', async () => {
      // Arrange
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        name: 'Sarah Photography',
      });

      // Act
      const greeting = await service.getGreeting('tenant_A');

      // Assert
      expect(greeting).toBe(
        'Hi! I can help you book an appointment with Sarah Photography. What are you looking for?'
      );
      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant_A' },
        select: { name: true },
      });
    });

    it('returns generic greeting when tenant not found', async () => {
      // Arrange
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue(null);

      // Act
      const greeting = await service.getGreeting('nonexistent');

      // Assert
      expect(greeting).toBe('Hi! I can help you book an appointment. What are you looking for?');
    });
  });

  // ===========================================================================
  // AI Quota Enforcement
  // ===========================================================================

  describe('chat - AI quota enforcement', () => {
    it('enforces AI message quota for FREE tier', async () => {
      // Arrange - tenant at quota limit (FREE tier = 50 messages)
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'FREE',
        aiMessagesUsed: 50, // FREE tier limit is 50
        name: 'Test Tenant',
      });

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.message).toContain("You've used all 50 AI messages this month");
      expect(result.usage).toEqual({
        used: 50,
        limit: 50,
        remaining: 0,
      });
      // Should NOT call ADK
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('allows messages when under quota', async () => {
      // Arrange - tenant under quota (FREE tier = 50 messages)
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'FREE',
        aiMessagesUsed: 10,
        name: 'Test Tenant',
      });
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_ARRAY_RESPONSE)
      );

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.message).toBe('Hello! How can I help you book an appointment?');
      expect(result.usage).toEqual({
        used: 11,
        limit: 50,
        remaining: 39,
      });
    });

    it('increments AI message counter after successful chat', async () => {
      // Arrange
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'FREE',
        aiMessagesUsed: 5,
        name: 'Test Tenant',
      });
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_ARRAY_RESPONSE)
      );

      // Act
      await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant_A' },
        data: { aiMessagesUsed: { increment: 1 } },
      });
    });

    it('respects STARTER tier higher quota', async () => {
      // Arrange - STARTER tier has 500 messages
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'STARTER',
        aiMessagesUsed: 50,
        name: 'Test Tenant',
      });
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_ARRAY_RESPONSE)
      );

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.usage?.remaining).toBe(449); // 500 - 51
    });
  });

  // ===========================================================================
  // Multi-Tenant Isolation
  // ===========================================================================

  describe('chat - multi-tenant isolation', () => {
    it('scopes session lookup by tenantId', async () => {
      // Arrange
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'FREE',
        aiMessagesUsed: 0,
        name: 'Tenant A',
      });
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_ARRAY_RESPONSE)
      );

      // Act
      await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert - session lookup includes tenantId
      expect(mockSessionService.getSession).toHaveBeenCalledWith('session_123', 'tenant_A');
    });

    it('throws error when session not found for tenant', async () => {
      // Arrange
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'FREE',
        aiMessagesUsed: 0,
        name: 'Tenant A',
      });
      (mockSessionService.getSession as MockedFunction<any>).mockResolvedValue(null);

      // Act & Assert
      await expect(service.chat('tenant_A', 'session_123', 'Hello')).rejects.toThrow(
        'Session not found'
      );
    });

    it('includes tenantId in ADK user identifier', async () => {
      // Arrange
      const sessionWithCustomer = createMockSession({ customerId: 'customer_456' });
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'FREE',
        aiMessagesUsed: 0,
        name: 'Tenant A',
      });
      (mockSessionService.getSession as MockedFunction<any>).mockResolvedValue(sessionWithCustomer);
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_ARRAY_RESPONSE)
      );

      // Act
      await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert - ADK request includes tenant-scoped userId
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/run'),
        expect.objectContaining({
          body: expect.stringContaining('"userId":"tenant_A:customer:customer_456"'),
        })
      );
    });
  });

  // ===========================================================================
  // ADK Response Parsing
  // ===========================================================================

  describe('chat - ADK response parsing', () => {
    beforeEach(() => {
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'FREE',
        aiMessagesUsed: 0,
        name: 'Test Tenant',
      });
    });

    it('parses array format ADK response', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_ARRAY_RESPONSE)
      );

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.message).toBe('Hello! How can I help you book an appointment?');
    });

    it('parses messages object format ADK response', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_MESSAGES_RESPONSE)
      );

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.message).toBe('Hello! How can I help you book an appointment?');
    });

    it('extracts tool calls from response', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_WITH_TOOL_CALLS)
      );

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Show me packages');

      // Assert
      expect(result.toolResults).toHaveLength(1);
      expect(result.toolResults?.[0]).toEqual({
        name: 'get_packages',
        args: { tenantId: 'tenant_A' },
        result: { packages: [] },
      });
    });

    it('handles invalid ADK response gracefully', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse({ unexpected: 'format' })
      );

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.message).toContain('unexpected response');
    });

    it('returns fallback message when no model response found', async () => {
      // Arrange - response with no model role
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse([{ content: { role: 'user', parts: [{ text: 'hi' }] } }])
      );

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.message).toBe('No response from agent.');
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('chat - error handling', () => {
    beforeEach(() => {
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'FREE',
        aiMessagesUsed: 0,
        name: 'Test Tenant',
      });
    });

    it('handles ADK 500 error gracefully', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse({ error: 'Internal error' }, 500)
      );

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.message).toContain('ran into an issue');
      expect(result.usage).toBeDefined();
    });

    it('handles timeout with abort error', async () => {
      // Arrange
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      (global.fetch as MockedFunction<any>).mockRejectedValue(abortError);

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.message).toContain('timed out');
    });

    it('handles network errors gracefully', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockRejectedValue(new Error('Network error'));

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(result.message).toContain('Connection issue');
    });

    it('throws when tenant not found', async () => {
      // Arrange
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue(null);

      // Act & Assert
      await expect(service.chat('nonexistent', 'session_123', 'Hello')).rejects.toThrow(
        'Tenant not found'
      );
    });

    it('retries with new ADK session on 404', async () => {
      // Arrange - first call returns 404, retry succeeds
      let callCount = 0;
      (global.fetch as MockedFunction<any>).mockImplementation((url: string) => {
        callCount++;
        if (url.includes('/run') && callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 404,
            text: () => Promise.resolve('Session not found'),
          } as Response);
        }
        if (url.includes('/sessions')) {
          return Promise.resolve(mockFetchResponse({ id: 'new_session_456' }));
        }
        return Promise.resolve(mockFetchResponse(ADK_ARRAY_RESPONSE));
      });

      // Act
      const result = await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert - should have retried and succeeded
      expect(result.message).toBe('Hello! How can I help you book an appointment?');
      expect(callCount).toBeGreaterThan(1);
    });
  });

  // ===========================================================================
  // Session Creation
  // ===========================================================================

  describe('createSession', () => {
    it('creates ADK session with tenant-scoped userId', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse({ id: 'adk_session_123' })
      );

      // Act
      await service.createSession('tenant_A', 'customer_456');

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/tenant_A%3Acustomer%3Acustomer_456/sessions'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"tenantId":"tenant_A"'),
        })
      );
    });

    it('uses anonymous userId when no customerId provided', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse({ id: 'adk_session_123' })
      );

      // Act
      await service.createSession('tenant_A');

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/tenant_A%3Aanonymous/sessions'),
        expect.any(Object)
      );
    });

    it('falls back to local session ID when ADK unreachable', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockRejectedValue(new Error('Network error'));
      (mockSessionService.getOrCreateSession as MockedFunction<any>).mockImplementation(
        async (_tenantId, sessionId) => createMockSession({ id: sessionId })
      );

      // Act
      const sessionId = await service.createSession('tenant_A');

      // Assert - should use local: prefix fallback
      expect(mockSessionService.getOrCreateSession).toHaveBeenCalledWith(
        'tenant_A',
        expect.stringMatching(/^local:customer:tenant_A:\d+$/),
        'CUSTOMER',
        undefined
      );
      expect(sessionId).toBeDefined();
    });
  });

  // ===========================================================================
  // getSession
  // ===========================================================================

  describe('getSession', () => {
    it('returns session when found for tenant', async () => {
      // Arrange
      const mockSession = createMockSession({
        messages: [
          {
            id: 'msg_1',
            role: 'user',
            content: 'Hello',
            createdAt: new Date(),
            updatedAt: new Date(),
            sessionId: 'session_123',
            toolCalls: null,
          },
        ],
      });
      (mockSessionService.getSession as MockedFunction<any>).mockResolvedValue(mockSession);

      // Act
      const result = await service.getSession('tenant_A', 'session_123');

      // Assert
      expect(result).toBeDefined();
      expect(result?.tenantId).toBe('tenant_A');
      expect(result?.messages).toHaveLength(1);
    });

    it('returns null when session not found', async () => {
      // Arrange
      (mockSessionService.getSession as MockedFunction<any>).mockResolvedValue(null);

      // Act
      const result = await service.getSession('tenant_A', 'nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('enforces tenant isolation - cannot access other tenant session', async () => {
      // Arrange - session belongs to tenant_A
      (mockSessionService.getSession as MockedFunction<any>).mockImplementation(
        async (sessionId, tenantId) => {
          // Simulate tenant-scoped lookup
          if (tenantId === 'tenant_A') {
            return createMockSession();
          }
          return null;
        }
      );

      // Act - try to access as tenant_B
      const result = await service.getSession('tenant_B', 'session_123');

      // Assert
      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // Message Persistence
  // ===========================================================================

  describe('chat - message persistence', () => {
    beforeEach(() => {
      (mockPrisma.tenant.findUnique as MockedFunction<any>).mockResolvedValue({
        tier: 'FREE',
        aiMessagesUsed: 0,
        name: 'Test Tenant',
      });
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_ARRAY_RESPONSE)
      );
    });

    it('persists user message before calling ADK', async () => {
      // Act
      await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert
      expect(mockSessionService.appendMessage).toHaveBeenCalledWith(
        'session_123',
        'tenant_A',
        { role: 'user', content: 'Hello' },
        1 // version from mock session
      );
    });

    it('persists assistant response after ADK call', async () => {
      // Act
      await service.chat('tenant_A', 'session_123', 'Hello');

      // Assert - should be called twice (user + assistant)
      expect(mockSessionService.appendMessage).toHaveBeenCalledTimes(2);
      expect(mockSessionService.appendMessage).toHaveBeenLastCalledWith(
        'session_123',
        'tenant_A',
        expect.objectContaining({
          role: 'assistant',
          content: 'Hello! How can I help you book an appointment?',
        }),
        2 // newVersion from first append
      );
    });

    it('includes tool calls in persisted assistant message', async () => {
      // Arrange
      (global.fetch as MockedFunction<any>).mockResolvedValue(
        mockFetchResponse(ADK_WITH_TOOL_CALLS)
      );

      // Act
      await service.chat('tenant_A', 'session_123', 'Show me packages');

      // Assert
      expect(mockSessionService.appendMessage).toHaveBeenLastCalledWith(
        'session_123',
        'tenant_A',
        expect.objectContaining({
          role: 'assistant',
          toolCalls: expect.arrayContaining([
            expect.objectContaining({
              name: 'get_packages',
              arguments: { tenantId: 'tenant_A' },
              result: { packages: [] },
            }),
          ]),
        }),
        2
      );
    });
  });
});
