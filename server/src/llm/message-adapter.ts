/**
 * Message & Tool Adapter Module
 *
 * Converts between MAIS internal types and Gemini API types.
 * Isolated so SDK changes don't ripple through orchestrators.
 *
 * Key conversions:
 * - ChatMessage → Content (Gemini format)
 * - AgentTool → FunctionDeclaration
 * - GenerateContentResponse → parsed text/tool calls
 */

import type {
  Content,
  Part,
  FunctionDeclaration,
  Schema,
  Type as GeminiType,
  GenerateContentResponse,
} from '@google/genai';
import { Type } from '@google/genai';
import type { AgentTool, AgentToolResult } from '../agent/tools/types';
import { randomUUID } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types (used by orchestrators)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chat message for conversation history (internal format)
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolUses?: {
    toolName: string;
    input: Record<string, unknown>;
    result: AgentToolResult;
  }[];
}

/**
 * Tool call extracted from Gemini response
 */
export interface ToolCall {
  /** Generated UUID for internal tracking (Gemini doesn't provide IDs) */
  id: string;
  /** Tool name */
  name: string;
  /** Tool input parameters */
  input: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Conversion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert chat messages to Gemini Content format.
 *
 * Role mapping:
 * - 'user' → 'user'
 * - 'assistant' → 'model'
 *
 * Note: Gemini uses 'model' not 'assistant' for AI responses.
 */
export function toGeminiContents(messages: ChatMessage[]): Content[] {
  return messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
}

/**
 * Convert system prompt to Gemini systemInstruction format.
 */
export function toSystemInstruction(systemPrompt: string): { parts: Part[] } {
  return {
    parts: [{ text: systemPrompt }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Schema Conversion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert AgentTool definitions to Gemini FunctionDeclaration format.
 *
 * Gemini uses a subset of JSON Schema. This handles the conversion
 * and ensures required fields are properly mapped.
 */
export function toGeminiFunctionDeclarations(tools: AgentTool[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: convertJsonSchemaToGemini(tool.inputSchema),
  }));
}

/**
 * Convert JSON Schema to Gemini Schema format.
 *
 * Gemini Schema is a subset of JSON Schema with specific Type enum values.
 * This recursively converts nested schemas.
 */
function convertJsonSchemaToGemini(schema: Record<string, unknown>): Schema {
  const type = mapJsonSchemaType(schema.type as string);

  const result: Schema = { type };

  if (schema.description) {
    result.description = schema.description as string;
  }

  if (schema.properties && typeof schema.properties === 'object') {
    result.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      result.properties[key] = convertJsonSchemaToGemini(value as Record<string, unknown>);
    }
  }

  if (Array.isArray(schema.required)) {
    result.required = schema.required;
  }

  if (schema.items && type === Type.ARRAY) {
    result.items = convertJsonSchemaToGemini(schema.items as Record<string, unknown>);
  }

  if (Array.isArray(schema.enum)) {
    result.enum = schema.enum;
  }

  return result;
}

/**
 * Map JSON Schema types to Gemini Type enum.
 */
function mapJsonSchemaType(type: string): GeminiType {
  const typeMap: Record<string, GeminiType> = {
    string: Type.STRING,
    number: Type.NUMBER,
    integer: Type.INTEGER,
    boolean: Type.BOOLEAN,
    array: Type.ARRAY,
    object: Type.OBJECT,
  };
  return typeMap[type] || Type.STRING;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Result Formatting (Official Vertex AI Semantics)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format tool result for sending back to Gemini.
 *
 * IMPORTANT: Per Vertex AI docs, function responses use 'user' role
 * with functionResponse parts. This is NOT a dedicated 'tool' role.
 *
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling
 */
export function toGeminiFunctionResponse(toolCall: ToolCall, result: AgentToolResult): Content {
  return {
    role: 'user', // Vertex AI: function responses go in user role
    parts: [
      {
        functionResponse: {
          name: toolCall.name,
          response: result.success
            ? { result: result.success ? (result as { data?: unknown }).data : null }
            : { error: (result as { error?: string }).error },
        },
      },
    ],
  };
}

/**
 * Format multiple tool results for parallel function calls.
 *
 * When Gemini returns multiple functionCall parts, send all results
 * back in a single user message with multiple functionResponse parts.
 */
export function toGeminiMultipleFunctionResponses(
  toolResults: Array<{ toolCall: ToolCall; result: AgentToolResult }>
): Content {
  return {
    role: 'user',
    parts: toolResults.map(({ toolCall, result }) => ({
      functionResponse: {
        name: toolCall.name,
        response: result.success
          ? { result: (result as { data?: unknown }).data }
          : { error: (result as { error?: string }).error },
      },
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract text content from Gemini response.
 */
export function extractText(response: GenerateContentResponse): string {
  const parts = response.candidates?.[0]?.content?.parts || [];

  return parts
    .filter(
      (part): part is Part & { text: string } => 'text' in part && typeof part.text === 'string'
    )
    .map((part) => part.text)
    .join('');
}

/**
 * Extract tool calls from Gemini response.
 *
 * Note: Gemini doesn't provide tool call IDs like Anthropic does.
 * We generate UUIDs for internal tracking and idempotency.
 */
export function extractToolCalls(response: GenerateContentResponse): ToolCall[] {
  const parts = response.candidates?.[0]?.content?.parts || [];
  const toolCalls: ToolCall[] = [];

  for (const part of parts) {
    if ('functionCall' in part && part.functionCall && part.functionCall.name) {
      toolCalls.push({
        // Generate our own ID since Gemini doesn't provide one
        id: randomUUID(),
        name: part.functionCall.name,
        input: (part.functionCall.args as Record<string, unknown>) || {},
      });
    }
  }

  return toolCalls;
}

/**
 * Check if response contains tool calls.
 */
export function hasToolCalls(response: GenerateContentResponse): boolean {
  const parts = response.candidates?.[0]?.content?.parts || [];
  return parts.some((part) => 'functionCall' in part && part.functionCall);
}

/**
 * Extract the model's content for conversation history.
 *
 * Used when continuing after tool execution - need to include
 * the model's response (with function calls) in the history.
 */
export function extractModelContent(response: GenerateContentResponse): Content | null {
  const content = response.candidates?.[0]?.content;
  if (!content) return null;

  return {
    role: 'model',
    parts: content.parts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract usage metadata from response.
 */
export function extractUsage(response: GenerateContentResponse): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  const usage = response.usageMetadata;
  return {
    inputTokens: usage?.promptTokenCount || 0,
    outputTokens: usage?.candidatesTokenCount || 0,
    totalTokens: (usage?.promptTokenCount || 0) + (usage?.candidatesTokenCount || 0),
  };
}
