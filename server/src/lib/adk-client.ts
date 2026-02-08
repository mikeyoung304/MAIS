/**
 * Shared ADK (Agent Development Kit) client utilities
 *
 * Centralizes Zod schemas for ADK response parsing, fetch timeout handling,
 * and response extraction logic used by all agent services.
 *
 * Previously triplicated across:
 * - vertex-agent.service.ts
 * - customer-agent.service.ts
 * - project-hub-agent.service.ts
 * - tenant-admin-tenant-agent.routes.ts (extractToolCalls only)
 *
 * @see CLAUDE.md Pitfall #18 (duplicated tool logic)
 * @see CLAUDE.md Pitfall #42 (fetch timeouts)
 * @see CLAUDE.md Pitfall #56 (Zod safeParse)
 */

import { z } from 'zod';

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

/**
 * Schema for ADK session creation response.
 * POST /apps/{appName}/users/{userId}/sessions returns { id: string }
 */
export const AdkSessionResponseSchema = z.object({
  id: z.string(),
});

/**
 * Schema for a single part in an ADK message.
 * Parts can contain text, function calls, or function responses.
 */
export const AdkPartSchema = z.object({
  text: z.string().optional(),
  functionCall: z
    .object({
      name: z.string(),
      args: z.record(z.unknown()),
    })
    .optional(),
  functionResponse: z
    .object({
      name: z.string(),
      response: z.unknown(),
    })
    .optional(),
});

/**
 * Schema for ADK content structure.
 */
export const AdkContentSchema = z.object({
  role: z.string().optional(),
  parts: z.array(AdkPartSchema).optional(),
});

/**
 * Schema for a single ADK event in the response array.
 */
export const AdkEventSchema = z.object({
  content: AdkContentSchema.optional(),
});

/**
 * Schema for ADK /run endpoint response.
 * ADK returns an array of events: [{ content: { role, parts } }, ...]
 * Also supports legacy format: { messages: [...] }
 */
export const AdkRunResponseSchema = z.union([
  // Modern ADK format: array of events
  z.array(AdkEventSchema),
  // Legacy format: object with messages array
  z.object({
    messages: z.array(
      z.object({
        role: z.string(),
        parts: z.array(AdkPartSchema).optional(),
      })
    ),
  }),
]);

// =============================================================================
// TYPES
// =============================================================================

export type AdkRunResponse = z.infer<typeof AdkRunResponseSchema>;
export type AdkPart = z.infer<typeof AdkPartSchema>;
export type AdkToolCall = { name: string; args: Record<string, unknown>; result?: unknown };

// =============================================================================
// FETCH WITH TIMEOUT
// =============================================================================

/**
 * Fetch with timeout for ADK agent calls.
 * Per CLAUDE.md Pitfall #42: agent calls use 30s timeout.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// RESPONSE EXTRACTION
// =============================================================================

/**
 * Extract the text response from ADK response format.
 * ADK returns an array of events: [{ content: { role, parts } }, ...]
 * Data is pre-validated by AdkRunResponseSchema (Pitfall #56)
 */
export function extractAgentResponse(data: AdkRunResponse): string {
  // Handle array format (ADK standard)
  if (Array.isArray(data)) {
    for (let i = data.length - 1; i >= 0; i--) {
      const event = data[i];
      if (event.content?.role === 'model') {
        const textPart = event.content.parts?.find((p) => p.text);
        if (textPart?.text) {
          return textPart.text;
        }
      }
    }
  } else {
    // Handle object format with messages array (legacy)
    const messages = data.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'model') {
        const textPart = msg.parts?.find((p) => p.text);
        if (textPart?.text) {
          return textPart.text;
        }
      }
    }
  }

  return 'No response from agent.';
}

/**
 * Extract tool calls from ADK response format.
 * ADK returns an array of events: [{ content: { parts: [{ functionCall }] } }, ...]
 * Data is pre-validated by AdkRunResponseSchema (Pitfall #56)
 */
export function extractToolCalls(data: AdkRunResponse): AdkToolCall[] {
  const allParts: AdkPart[] = [];

  // Handle array format (ADK standard)
  if (Array.isArray(data)) {
    for (const event of data) {
      if (event.content?.parts) {
        allParts.push(...event.content.parts);
      }
    }
  } else {
    // Handle legacy format with messages array
    for (const msg of data.messages) {
      if (msg.parts) {
        allParts.push(...msg.parts);
      }
    }
  }

  if (allParts.length === 0) {
    return [];
  }

  const toolCalls: AdkToolCall[] = [];

  // Extract all function calls and their responses
  const pendingCalls = new Map<string, { name: string; args: Record<string, unknown> }>();

  for (const part of allParts) {
    if (part.functionCall) {
      const callId = `${part.functionCall.name}:${JSON.stringify(part.functionCall.args)}`;
      pendingCalls.set(callId, {
        name: part.functionCall.name,
        args: part.functionCall.args,
      });
    }
    if (part.functionResponse) {
      // Find matching call and add result
      for (const [callId, call] of pendingCalls) {
        if (callId.startsWith(part.functionResponse.name)) {
          toolCalls.push({
            ...call,
            result: part.functionResponse.response,
          });
          pendingCalls.delete(callId);
          break;
        }
      }
    }
  }

  // Add any calls without responses
  for (const call of pendingCalls.values()) {
    toolCalls.push(call);
  }

  return toolCalls;
}
