/**
 * Session Validation Schemas
 *
 * Zod schemas for validating session data on read AND write operations.
 * Defense-in-depth: validates data even after database storage to catch
 * corruption, encoding issues, or schema drift.
 *
 * Security:
 * - Content length limits prevent DoS via oversized messages
 * - Role enum prevents injection of invalid message types
 * - Tool call validation prevents malformed tool data
 *
 * @see plans/feat-persistent-chat-session-storage.md Phase 1.2
 */

import { z } from 'zod';

// =============================================================================
// MESSAGE SCHEMAS
// =============================================================================

/**
 * Message role - constrained enum
 * Matches the `role` field in AgentSessionMessage table
 */
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

/**
 * Tool call within a message
 * Represents a function call made by the assistant
 */
export const ToolCallSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  arguments: z.record(z.unknown()),
  result: z.unknown().optional(),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

/**
 * Session message - validated on read AND write
 * Represents a single message in the conversation
 */
export const SessionMessageSchema = z.object({
  id: z.string().min(1),
  role: MessageRoleSchema,
  content: z.string(),
  toolCalls: z.array(ToolCallSchema).nullable().optional(),
  createdAt: z.coerce.date(),
  idempotencyKey: z.string().max(64).nullable().optional(),
});
export type SessionMessage = z.infer<typeof SessionMessageSchema>;

/**
 * Create message input - validated before write
 * Stricter validation than read schema to enforce limits
 */
export const CreateMessageInputSchema = z.object({
  role: MessageRoleSchema,
  content: z.string().min(1).max(100_000), // 100KB max per message
  toolCalls: z.array(ToolCallSchema).max(50).nullable().optional(),
  idempotencyKey: z.string().max(64).optional(),
});
export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>;

// =============================================================================
// SESSION SCHEMAS
// =============================================================================

/**
 * Session type enum - matches Prisma SessionType
 */
export const SessionTypeSchema = z.enum(['ADMIN', 'CUSTOMER']);
export type SessionType = z.infer<typeof SessionTypeSchema>;

/**
 * Session metadata without messages
 * Used for session listing and quick lookups
 */
export const SessionMetadataSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  customerId: z.string().min(1).nullable().optional(),
  sessionType: SessionTypeSchema,
  version: z.number().int().min(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lastActivityAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
});
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;

/**
 * Session with messages - full session data
 * Used for session restoration and display
 */
export const SessionWithMessagesSchema = SessionMetadataSchema.extend({
  messages: z.array(SessionMessageSchema),
});
export type SessionWithMessages = z.infer<typeof SessionWithMessagesSchema>;

// =============================================================================
// API SCHEMAS
// =============================================================================

/**
 * Append message result
 */
export const AppendMessageResultSchema = z.object({
  success: z.literal(true),
  message: SessionMessageSchema,
  newVersion: z.number().int().min(0),
});
export type AppendMessageResult = z.infer<typeof AppendMessageResultSchema>;

/**
 * Append message error
 */
export const AppendMessageErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  newVersion: z.number().int().min(0).optional(),
});
export type AppendMessageError = z.infer<typeof AppendMessageErrorSchema>;

/**
 * Session history response with pagination
 */
export const SessionHistoryResponseSchema = z.object({
  messages: z.array(SessionMessageSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});
export type SessionHistoryResponse = z.infer<typeof SessionHistoryResponseSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate message input with detailed error
 */
export function validateMessageInput(
  input: unknown
): { success: true; data: CreateMessageInput } | { success: false; error: string } {
  const result = CreateMessageInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
  };
}

/**
 * Validate session data with detailed error
 */
export function validateSession(
  data: unknown
): { success: true; data: SessionWithMessages } | { success: false; error: string } {
  const result = SessionWithMessagesSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
  };
}
