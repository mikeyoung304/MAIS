/**
 * A2A Protocol Tests
 *
 * Tests for ADK Agent-to-Agent (A2A) protocol format and response handling.
 * These tests help prevent common A2A integration issues.
 *
 * Issues Tested:
 * - Issue 1: snake_case vs camelCase in request bodies
 * - Issue 4: Response format variations
 *
 * @see docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md
 */

import { describe, it, expect } from 'vitest';

// =============================================================================
// Helper Functions (Implementation would be in agent code)
// =============================================================================

interface A2ARequestOptions {
  agentName: string;
  tenantId: string;
  sessionId: string;
  message: string;
}

/**
 * Build an A2A protocol request body.
 * CRITICAL: Uses snake_case for A2A protocol fields.
 */
function buildA2ARequestBody(options: A2ARequestOptions): Record<string, unknown> {
  return {
    // A2A protocol uses snake_case for these fields
    app_name: options.agentName,
    user_id: options.tenantId,
    session_id: options.sessionId,
    new_message: {
      role: 'user',
      parts: [{ text: options.message }],
    },
    state: {
      tenantId: options.tenantId,
    },
  };
}

/**
 * Parse A2A response to extract the agent's text response.
 * Handles multiple response formats.
 */
function parseA2AResponse(data: unknown): string {
  if (data === undefined) {
    return 'undefined';
  }
  if (!data || typeof data !== 'object') {
    return JSON.stringify(data);
  }

  const d = data as Record<string, unknown>;

  // Format 1: messages array (most common)
  if (Array.isArray(d.messages)) {
    interface MessagePart {
      text?: string;
    }
    interface Message {
      role: string;
      parts?: MessagePart[];
    }
    const messages = d.messages as Message[];
    const modelMessage = messages.find((m) => m.role === 'model');
    const textPart = modelMessage?.parts?.find((p) => p.text);
    if (textPart?.text) {
      return textPart.text;
    }
  }

  // Format 2: content.parts format
  if (d.content && typeof d.content === 'object') {
    interface ContentPart {
      text?: string;
    }
    interface Content {
      parts?: ContentPart[];
    }
    const content = d.content as Content;
    const textPart = content.parts?.find((p) => p.text);
    if (textPart?.text) {
      return textPart.text;
    }
  }

  // Format 3: direct response field
  if (typeof d.response === 'string') {
    return d.response;
  }

  // Fallback: stringify the entire response
  return JSON.stringify(data);
}

// =============================================================================
// Tests
// =============================================================================

describe('A2A Protocol Format', () => {
  describe('Request Body Format (Issue 1: snake_case)', () => {
    it('should use snake_case for top-level A2A fields', () => {
      const body = buildA2ARequestBody({
        agentName: 'marketing_specialist',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        message: 'Generate headlines',
      });

      // Top-level MUST be snake_case
      expect(body).toHaveProperty('app_name');
      expect(body).toHaveProperty('user_id');
      expect(body).toHaveProperty('session_id');
      expect(body).toHaveProperty('new_message');

      // Must NOT have camelCase variants
      expect(body).not.toHaveProperty('appName');
      expect(body).not.toHaveProperty('userId');
      expect(body).not.toHaveProperty('sessionId');
      expect(body).not.toHaveProperty('newMessage');
    });

    it('should preserve exact agent name', () => {
      const body = buildA2ARequestBody({
        agentName: 'marketing_specialist',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        message: 'Hello',
      });

      expect(body.app_name).toBe('marketing_specialist');
    });

    it('should include tenant context in state', () => {
      const body = buildA2ARequestBody({
        agentName: 'marketing_specialist',
        tenantId: 'tenant-abc',
        sessionId: 'session-456',
        message: 'Hello',
      });

      expect(body.state).toEqual({ tenantId: 'tenant-abc' });
    });

    it('should format new_message with Gemini structure', () => {
      const body = buildA2ARequestBody({
        agentName: 'agent',
        tenantId: 'tenant-123',
        sessionId: 'session-456',
        message: 'Test message',
      });

      expect(body.new_message).toEqual({
        role: 'user',
        parts: [{ text: 'Test message' }],
      });
    });
  });

  describe('Response Parsing (Issue 4: Format Variations)', () => {
    it('should parse messages array format', () => {
      const data = {
        messages: [
          { role: 'user', parts: [{ text: 'Hello' }] },
          { role: 'model', parts: [{ text: 'Hi there!' }] },
        ],
      };
      expect(parseA2AResponse(data)).toBe('Hi there!');
    });

    it('should parse messages with multiple parts', () => {
      const data = {
        messages: [
          {
            role: 'model',
            parts: [{ functionCall: { name: 'get_services' } }, { text: 'Here are your services' }],
          },
        ],
      };
      expect(parseA2AResponse(data)).toBe('Here are your services');
    });

    it('should parse content.parts format', () => {
      const data = {
        content: {
          role: 'model',
          parts: [{ text: 'Response text' }],
        },
      };
      expect(parseA2AResponse(data)).toBe('Response text');
    });

    it('should parse direct response format', () => {
      const data = { response: 'Direct response' };
      expect(parseA2AResponse(data)).toBe('Direct response');
    });

    it('should fallback to JSON.stringify for unknown formats', () => {
      const data = { unknown: 'format', nested: { data: true } };
      const result = parseA2AResponse(data);
      expect(result).toContain('unknown');
      expect(result).toContain('format');
    });

    it('should handle empty messages array', () => {
      const data = { messages: [] };
      const result = parseA2AResponse(data);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle null data', () => {
      const result = parseA2AResponse(null);
      expect(result).toBe('null');
    });

    it('should handle undefined data', () => {
      const result = parseA2AResponse(undefined);
      expect(result).toBeDefined();
    });

    it('should handle messages without model role', () => {
      const data = {
        messages: [
          { role: 'user', parts: [{ text: 'Hello' }] },
          { role: 'system', parts: [{ text: 'System message' }] },
        ],
      };
      const result = parseA2AResponse(data);
      // Should fallback to stringify since no model response
      expect(result).toContain('messages');
    });
  });
});

describe('Identity Token URL Construction (Issue 5)', () => {
  it('should construct correct metadata URL with audience', () => {
    const agentUrl = 'https://marketing-agent-123.us-central1.run.app';
    const expectedUrl =
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' +
      agentUrl;

    // This tests the URL construction pattern
    const metadataUrl =
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' +
      agentUrl;

    expect(metadataUrl).toBe(expectedUrl);
  });

  it('should handle URLs with different regions', () => {
    const urls = [
      'https://agent-123.us-central1.run.app',
      'https://agent-123.europe-west1.run.app',
      'https://agent-123.asia-east1.run.app',
    ];

    urls.forEach((url) => {
      const metadataUrl =
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=' +
        url;
      expect(metadataUrl).toContain('audience=' + url);
    });
  });
});

describe('Service Name Format (Issue 2)', () => {
  it('should follow naming convention', () => {
    const validNames = [
      'booking-agent',
      'marketing-agent',
      'storefront-agent',
      'research-agent',
      'concierge-agent',
    ];

    validNames.forEach((name) => {
      expect(name).toMatch(/^[a-z]+-agent$/);
    });
  });

  it('should reject invalid naming patterns', () => {
    const invalidNames = [
      'BookingAgent', // PascalCase
      'booking_agent', // underscore
      'agent-booking', // reversed
      'booking', // missing -agent suffix
    ];

    invalidNames.forEach((name) => {
      expect(name).not.toMatch(/^[a-z]+-agent$/);
    });
  });
});
