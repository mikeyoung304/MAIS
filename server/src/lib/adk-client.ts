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
 * Content is optional — ADK error events have errorCode/errorMessage but no content.
 */
export const AdkEventSchema = z.object({
  content: AdkContentSchema.optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
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

/**
 * Schema for ADK session GET response.
 * GET /apps/{appName}/users/{userId}/sessions/{sessionId}
 * Returns session with events history.
 */
export const AdkSessionDataSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  appName: z.string().optional(),
  state: z.record(z.unknown()).optional(),
  events: z
    .array(
      z.object({
        content: z
          .object({
            role: z.string().optional(),
            parts: z
              .array(
                z.object({
                  text: z.string().optional(),
                })
              )
              .optional(),
          })
          .optional(),
      })
    )
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// =============================================================================
// TYPES
// =============================================================================

export type AdkRunResponse = z.infer<typeof AdkRunResponseSchema>;
export type AdkEvent = z.infer<typeof AdkEventSchema>;
export type AdkSessionData = z.infer<typeof AdkSessionDataSchema>;
export type AdkPart = z.infer<typeof AdkPartSchema>;
export type AdkToolCall = { name: string; args: Record<string, unknown>; result?: unknown };
export type DashboardAction = { type: string; payload: unknown };

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
 *
 * Concatenates all text parts in the last model message (some agents split
 * responses across multiple parts).
 */
export function extractAgentResponse(data: AdkRunResponse): string {
  // Handle array format (ADK standard)
  if (Array.isArray(data)) {
    for (let i = data.length - 1; i >= 0; i--) {
      const event = data[i];
      if (event.content?.role === 'model') {
        // Concatenate all text parts (some responses are split)
        const texts = event.content.parts
          ?.filter((p) => p.text)
          .map((p) => p.text!)
          .join('');

        if (texts) {
          return texts;
        }
      }
    }
  } else {
    // Handle object format with messages array (legacy)
    const messages = data.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'model') {
        const texts = msg.parts
          ?.filter((p) => p.text)
          .map((p) => p.text!)
          .join('');

        if (texts) {
          return texts;
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
        if (callId.startsWith(part.functionResponse.name + ':')) {
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

/**
 * Extract dashboard actions from ADK response.
 * Looks for functionResponse parts that return a `dashboardAction` field.
 * Used by tenant agent to trigger frontend UI updates (e.g., section refresh).
 */
export function extractDashboardActions(data: AdkRunResponse): DashboardAction[] {
  const actions: DashboardAction[] = [];

  // Only array format carries function responses with dashboard actions
  if (!Array.isArray(data)) return actions;

  for (const event of data) {
    if (!event.content?.parts) continue;
    for (const part of event.content.parts) {
      if (part.functionResponse) {
        const response = part.functionResponse.response;
        if (
          response &&
          typeof response === 'object' &&
          'dashboardAction' in response &&
          (response as Record<string, unknown>).dashboardAction
        ) {
          const action = (response as Record<string, unknown>).dashboardAction as DashboardAction;
          actions.push(action);
        }
      }
    }
  }

  return actions;
}
