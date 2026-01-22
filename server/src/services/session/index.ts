/**
 * Session Module
 *
 * Enterprise-grade persistent chat session storage with:
 * - PostgreSQL persistence with advisory locks
 * - LRU cache with TTL for performance
 * - AES-256-GCM encryption at rest
 * - Optimistic locking for concurrent modifications
 * - Tenant-scoped data isolation
 *
 * @example
 * import { createSessionService, sessionCache } from './services/session';
 *
 * const service = createSessionService(prisma);
 * const session = await service.getOrCreateSession(tenantId, sessionId, 'ADMIN');
 *
 * @see plans/feat-persistent-chat-session-storage.md
 */

// =============================================================================
// SCHEMAS
// =============================================================================

export {
  // Types
  type MessageRole,
  type ToolCall,
  type SessionMessage,
  type CreateMessageInput,
  type SessionType,
  type SessionMetadata,
  type SessionWithMessages,
  type AppendMessageResult,
  type AppendMessageError,
  type SessionHistoryResponse,
  // Schemas
  MessageRoleSchema,
  ToolCallSchema,
  SessionMessageSchema,
  CreateMessageInputSchema,
  SessionTypeSchema,
  SessionMetadataSchema,
  SessionWithMessagesSchema,
  AppendMessageResultSchema,
  AppendMessageErrorSchema,
  SessionHistoryResponseSchema,
  // Validators
  validateMessageInput,
  validateSession,
} from './session.schemas';

// =============================================================================
// CACHE
// =============================================================================

export {
  SessionCache,
  sessionCache,
  createSessionCache,
  type SessionCacheConfig,
} from './session.cache';

// =============================================================================
// REPOSITORY
// =============================================================================

export {
  SessionRepository,
  createSessionRepository,
  type SessionRepositoryConfig,
} from './session.repository';

// =============================================================================
// SERVICE
// =============================================================================

export { SessionService, createSessionService, type SessionServiceConfig } from './session.service';

// =============================================================================
// AUDIT
// =============================================================================

export {
  SessionAuditAction,
  logSessionAudit,
  auditSessionCreated,
  auditSessionAccessed,
  auditSessionRestored,
  auditMessageAppended,
  auditSessionDeleted,
  auditConcurrentModification,
  auditAccessDenied,
  type SessionAuditEntry,
} from './session.audit';

// =============================================================================
// METRICS
// =============================================================================

export {
  sessionMetrics,
  timeGetOperation,
  timeAppendOperation,
  type SessionMetrics,
} from './session.metrics';
