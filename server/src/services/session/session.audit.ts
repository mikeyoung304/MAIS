/**
 * Session Audit Logging
 *
 * Provides audit trail for session access patterns:
 * - Session creation, access, deletion
 * - Message appends
 * - Security-relevant events (cross-tenant attempts, etc.)
 *
 * Uses structured logging via the logger service for:
 * - Searchability in log aggregators (Datadog, CloudWatch, etc.)
 * - Compliance and security auditing
 * - Debugging session issues
 *
 * @see plans/feat-persistent-chat-session-storage.md Phase 4.1
 */

import { logger } from '../../lib/core/logger';

// =============================================================================
// TYPES
// =============================================================================

export enum SessionAuditAction {
  CREATED = 'session.created',
  ACCESSED = 'session.accessed',
  RESTORED = 'session.restored',
  MESSAGE_APPENDED = 'session.message_appended',
  DELETED = 'session.deleted',
  RESTORED_FROM_DELETE = 'session.restored_from_delete',
  EXPIRED = 'session.expired',
  CACHE_HIT = 'session.cache_hit',
  CACHE_MISS = 'session.cache_miss',
  CONCURRENT_MODIFICATION = 'session.concurrent_modification',
  ACCESS_DENIED = 'session.access_denied',
}

export interface SessionAuditEntry {
  action: SessionAuditAction;
  sessionId: string;
  tenantId: string;
  userId?: string;
  customerId?: string;
  sessionType?: 'ADMIN' | 'CUSTOMER';
  metadata?: Record<string, unknown>;
}

// =============================================================================
// AUDIT FUNCTIONS
// =============================================================================

/**
 * Log session audit event
 *
 * Non-blocking - logs asynchronously without affecting main flow.
 * Failures are logged as warnings but don't throw.
 */
export function logSessionAudit(entry: SessionAuditEntry): void {
  try {
    const logData = {
      action: entry.action,
      sessionId: entry.sessionId,
      tenantId: entry.tenantId,
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.customerId && { customerId: entry.customerId }),
      ...(entry.sessionType && { sessionType: entry.sessionType }),
      ...(entry.metadata && { metadata: entry.metadata }),
    };

    // Use appropriate log level based on action
    switch (entry.action) {
      case SessionAuditAction.ACCESS_DENIED:
      case SessionAuditAction.CONCURRENT_MODIFICATION:
        logger.warn(logData, `Session audit: ${entry.action}`);
        break;

      case SessionAuditAction.CREATED:
      case SessionAuditAction.DELETED:
      case SessionAuditAction.RESTORED_FROM_DELETE:
        logger.info(logData, `Session audit: ${entry.action}`);
        break;

      default:
        logger.debug(logData, `Session audit: ${entry.action}`);
    }
  } catch (error) {
    // Audit logging should never break main flow
    logger.warn({ error, entry }, 'Failed to log session audit event');
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Log session created
 */
export function auditSessionCreated(
  sessionId: string,
  tenantId: string,
  sessionType: 'ADMIN' | 'CUSTOMER',
  customerId?: string
): void {
  logSessionAudit({
    action: SessionAuditAction.CREATED,
    sessionId,
    tenantId,
    customerId,
    sessionType,
  });
}

/**
 * Log session accessed
 */
export function auditSessionAccessed(
  sessionId: string,
  tenantId: string,
  fromCache: boolean
): void {
  logSessionAudit({
    action: fromCache ? SessionAuditAction.CACHE_HIT : SessionAuditAction.CACHE_MISS,
    sessionId,
    tenantId,
    metadata: { fromCache },
  });
}

/**
 * Log session restored (existing session found and returned)
 */
export function auditSessionRestored(sessionId: string, tenantId: string): void {
  logSessionAudit({
    action: SessionAuditAction.RESTORED,
    sessionId,
    tenantId,
  });
}

/**
 * Log message appended
 */
export function auditMessageAppended(
  sessionId: string,
  tenantId: string,
  messageId: string,
  role: string
): void {
  logSessionAudit({
    action: SessionAuditAction.MESSAGE_APPENDED,
    sessionId,
    tenantId,
    metadata: { messageId, role },
  });
}

/**
 * Log session deleted
 */
export function auditSessionDeleted(sessionId: string, tenantId: string): void {
  logSessionAudit({
    action: SessionAuditAction.DELETED,
    sessionId,
    tenantId,
  });
}

/**
 * Log concurrent modification attempt
 */
export function auditConcurrentModification(
  sessionId: string,
  tenantId: string,
  expectedVersion: number,
  actualVersion: number
): void {
  logSessionAudit({
    action: SessionAuditAction.CONCURRENT_MODIFICATION,
    sessionId,
    tenantId,
    metadata: { expectedVersion, actualVersion },
  });
}

/**
 * Log access denied (wrong tenant, deleted session, etc.)
 */
export function auditAccessDenied(sessionId: string, tenantId: string, reason: string): void {
  logSessionAudit({
    action: SessionAuditAction.ACCESS_DENIED,
    sessionId,
    tenantId,
    metadata: { reason },
  });
}
