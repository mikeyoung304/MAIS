/**
 * Session Repository
 *
 * Data access layer for chat sessions with enterprise-grade integrity:
 * - Advisory locks for TOCTOU prevention (ADR-013 pattern)
 * - Optimistic locking with version field
 * - Tenant-scoped queries (CRITICAL for multi-tenant isolation)
 * - Zod validation on read for defense-in-depth
 *
 * @see plans/feat-persistent-chat-session-storage.md Phase 2.1
 * @see server/src/agent/orchestrator/base-orchestrator.ts:489-545 (pattern reference)
 */

import { Prisma } from '../../generated/prisma/client';
import type { PrismaClient } from '../../generated/prisma/client';
import { logger } from '../../lib/core/logger';
import {
  CreateMessageInputSchema,
  SessionWithMessagesSchema,
  type CreateMessageInput,
  type SessionMessage,
  type SessionWithMessages,
  type ToolCall,
} from './session.schemas';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAX_MESSAGES_PER_SESSION = 500;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes inactivity

export interface SessionRepositoryConfig {
  maxMessagesPerSession: number;
  sessionTtlMs: number;
}

const DEFAULT_CONFIG: SessionRepositoryConfig = {
  maxMessagesPerSession: MAX_MESSAGES_PER_SESSION,
  sessionTtlMs: SESSION_TTL_MS,
};

// =============================================================================
// REPOSITORY CLASS
// =============================================================================

/**
 * Session Repository - handles all database operations for chat sessions
 *
 * CRITICAL: All queries MUST include tenantId filter for multi-tenant isolation.
 * Never expose session IDs without verifying tenant ownership.
 */
export class SessionRepository {
  private readonly config: SessionRepositoryConfig;

  constructor(
    private readonly prisma: PrismaClient,
    config: Partial<SessionRepositoryConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // READ OPERATIONS
  // ===========================================================================

  /**
   * Get session by ID with tenant scoping
   * CRITICAL: Always filter by tenantId to prevent cross-tenant access
   */
  async getSession(sessionId: string, tenantId: string): Promise<SessionWithMessages | null> {
    const session = await this.prisma.agentSession.findFirst({
      where: {
        id: sessionId,
        tenantId, // CRITICAL: Multi-tenant isolation
        deletedAt: null,
      },
      include: {
        sessionMessages: {
          orderBy: { createdAt: 'asc' },
          take: this.config.maxMessagesPerSession,
        },
      },
    });

    if (!session) {
      logger.warn({ sessionId, tenantId }, 'Session lookup failed - not found or access denied');
      return null;
    }

    // Transform to domain model and validate
    const sessionData = {
      id: session.id,
      tenantId: session.tenantId,
      customerId: session.customerId,
      sessionType: session.sessionType,
      version: session.version,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivityAt: session.lastActivityAt,
      deletedAt: session.deletedAt,
      userAgent: session.userAgent,
      messages: session.sessionMessages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        toolCalls: m.toolCalls as ToolCall[] | null,
        createdAt: m.createdAt,
        idempotencyKey: m.idempotencyKey,
      })),
    };

    // Validate on read - defense in depth
    const parsed = SessionWithMessagesSchema.safeParse(sessionData);
    if (!parsed.success) {
      logger.error(
        { sessionId, tenantId, error: parsed.error.format() },
        'Session validation failed on read - data may be corrupted'
      );
      return null;
    }

    return parsed.data;
  }

  /**
   * Get session history (messages only) with pagination
   */
  async getSessionHistory(
    sessionId: string,
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ messages: SessionMessage[]; total: number; hasMore: boolean }> {
    // Enforce max page size (Pitfall #60)
    const safeLimit = Math.min(limit, 100);

    const [messages, total] = await Promise.all([
      this.prisma.agentSessionMessage.findMany({
        where: {
          sessionId,
          tenantId, // Direct tenant-scoped query via denormalized field
        },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: safeLimit,
      }),
      this.prisma.agentSessionMessage.count({
        where: { sessionId, tenantId },
      }),
    ]);

    return {
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        toolCalls: m.toolCalls as ToolCall[] | null,
        createdAt: m.createdAt,
        idempotencyKey: m.idempotencyKey,
      })),
      total,
      hasMore: offset + messages.length < total,
    };
  }

  // ===========================================================================
  // WRITE OPERATIONS
  // ===========================================================================

  /**
   * Create new session
   * Uses cryptographically secure ID generation (CUID)
   */
  async createSession(
    tenantId: string,
    sessionType: 'ADMIN' | 'CUSTOMER',
    customerId?: string,
    userAgent?: string
  ): Promise<SessionWithMessages> {
    const session = await this.prisma.agentSession.create({
      data: {
        tenant: { connect: { id: tenantId } },
        sessionType,
        ...(customerId && { customer: { connect: { id: customerId } } }),
        userAgent: userAgent?.slice(0, 500), // Truncate to fit VARCHAR(500)
        lastActivityAt: new Date(),
        version: 0,
      },
      include: { sessionMessages: true },
    });

    logger.info({ sessionId: session.id, tenantId, sessionType }, 'Session created');

    return {
      id: session.id,
      tenantId: session.tenantId,
      customerId: session.customerId,
      sessionType: session.sessionType,
      version: session.version,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivityAt: session.lastActivityAt,
      deletedAt: session.deletedAt,
      userAgent: session.userAgent,
      messages: [],
    };
  }

  /**
   * Append message with advisory lock to prevent race conditions
   * CRITICAL: Uses Prisma transaction with advisory lock pattern from ADR-013
   *
   * Why advisory lock + optimistic locking?
   * - Advisory lock prevents TOCTOU: read version, then write with stale version
   * - Optimistic locking detects concurrent modifications from different nodes
   * - Belt-and-suspenders approach for data integrity
   */
  async appendMessage(
    sessionId: string,
    tenantId: string,
    input: CreateMessageInput,
    expectedVersion: number
  ): Promise<{ success: boolean; message?: SessionMessage; error?: string; newVersion?: number }> {
    // Validate input (Pitfall #56)
    const parsed = CreateMessageInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: `Invalid message: ${parsed.error.message}` };
    }

    const lockKey = `session:${sessionId}:append`;

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Acquire advisory lock - held for transaction duration
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

          // Get current session with version check
          const session = await tx.agentSession.findFirst({
            where: {
              id: sessionId,
              tenantId, // CRITICAL: Tenant isolation
              deletedAt: null,
            },
            include: { _count: { select: { sessionMessages: true } } },
          });

          if (!session) {
            throw new Error('SESSION_NOT_FOUND');
          }

          // Optimistic locking - detect concurrent modifications
          if (session.version !== expectedVersion) {
            throw new Error(`VERSION_MISMATCH:${session.version}`);
          }

          // Check message limit
          if (session._count.sessionMessages >= this.config.maxMessagesPerSession) {
            throw new Error('MESSAGE_LIMIT_EXCEEDED');
          }

          // Create message
          const message = await tx.agentSessionMessage.create({
            data: {
              session: { connect: { id: sessionId } },
              tenantId, // Denormalized for direct queries
              role: parsed.data.role,
              content: parsed.data.content,
              toolCalls: parsed.data.toolCalls
                ? (parsed.data.toolCalls as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
              idempotencyKey: parsed.data.idempotencyKey,
            },
          });

          // Update session version and activity timestamp
          await tx.agentSession.update({
            where: { id: sessionId },
            data: {
              version: { increment: 1 },
              lastActivityAt: new Date(),
              updatedAt: new Date(),
            },
          });

          return {
            message: {
              id: message.id,
              role: message.role as 'user' | 'assistant' | 'system',
              content: message.content,
              toolCalls: message.toolCalls as ToolCall[] | null,
              createdAt: message.createdAt,
              idempotencyKey: message.idempotencyKey,
            },
            newVersion: expectedVersion + 1,
          };
        },
        {
          // ReadCommitted is sufficient - advisory locks (ADR-013) already prevent TOCTOU
          isolationLevel: 'ReadCommitted',
          timeout: 10000, // 10 second timeout
        }
      );

      logger.debug({ sessionId, tenantId, messageId: result.message.id }, 'Message appended');

      return {
        success: true,
        message: result.message,
        newVersion: result.newVersion,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage === 'SESSION_NOT_FOUND') {
        return { success: false, error: 'Session not found or access denied' };
      }

      if (errorMessage.startsWith('VERSION_MISMATCH:')) {
        const currentVersion = parseInt(errorMessage.split(':')[1], 10);
        return {
          success: false,
          error: 'Concurrent modification detected',
          newVersion: currentVersion,
        };
      }

      if (errorMessage === 'MESSAGE_LIMIT_EXCEEDED') {
        return {
          success: false,
          error: `Session has reached maximum message limit (${this.config.maxMessagesPerSession})`,
        };
      }

      // Handle idempotency key conflict (duplicate message)
      if (errorMessage.includes('Unique constraint') && errorMessage.includes('idempotencyKey')) {
        logger.info({ sessionId, tenantId }, 'Duplicate message detected via idempotency key');
        return { success: false, error: 'Duplicate message' };
      }

      logger.error({ sessionId, tenantId, error: errorMessage }, 'Failed to append message');

      return { success: false, error: 'Failed to save message' };
    }
  }

  /**
   * Soft delete session
   * Marks session as deleted without removing data (retention compliance)
   */
  async deleteSession(sessionId: string, tenantId: string): Promise<boolean> {
    const result = await this.prisma.agentSession.updateMany({
      where: {
        id: sessionId,
        tenantId, // CRITICAL: Tenant isolation
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (result.count > 0) {
      logger.info({ sessionId, tenantId }, 'Session soft-deleted');
      return true;
    }

    return false;
  }

  /**
   * Restore soft-deleted session
   */
  async restoreSession(sessionId: string, tenantId: string): Promise<boolean> {
    const result = await this.prisma.agentSession.updateMany({
      where: {
        id: sessionId,
        tenantId, // CRITICAL: Tenant isolation
        deletedAt: { not: null },
      },
      data: {
        deletedAt: null,
      },
    });

    if (result.count > 0) {
      logger.info({ sessionId, tenantId }, 'Session restored');
      return true;
    }

    return false;
  }

  // ===========================================================================
  // CLEANUP OPERATIONS
  // ===========================================================================

  /**
   * ADMIN ONLY: Cleanup expired sessions across ALL tenants.
   *
   * This is intentionally not tenant-scoped as it's a system maintenance operation.
   * SECURITY: Never expose through user-facing API endpoints.
   *
   * Two-phase cleanup:
   * 1. Soft delete sessions inactive > maxAgeMs (default 30 days)
   * 2. Hard delete sessions soft-deleted > 7 days ago
   *
   * @param maxAgeMs - Sessions inactive for this long are soft deleted (default: 30 days)
   * @returns Number of sessions hard-deleted
   */
  async cleanupExpiredSessions(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);

    // Phase 1: Soft delete expired sessions
    const softDeleted = await this.prisma.agentSession.updateMany({
      where: {
        lastActivityAt: { lt: cutoff },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (softDeleted.count > 0) {
      logger.info({ count: softDeleted.count }, 'Sessions soft-deleted due to inactivity');
    }

    // Phase 2: Hard delete sessions that were soft-deleted > 7 days ago
    const hardDeleteCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const hardDeleted = await this.prisma.agentSession.deleteMany({
      where: {
        deletedAt: { lt: hardDeleteCutoff },
      },
    });

    if (hardDeleted.count > 0) {
      logger.info({ count: hardDeleted.count }, 'Sessions hard-deleted after retention period');
    }

    return hardDeleted.count;
  }

  /**
   * Update session activity timestamp
   * Called on each user interaction to keep session alive
   */
  async touchSession(sessionId: string, tenantId: string): Promise<void> {
    await this.prisma.agentSession.updateMany({
      where: {
        id: sessionId,
        tenantId,
        deletedAt: null,
      },
      data: {
        lastActivityAt: new Date(),
      },
    });
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Factory for creating SessionRepository instances
 * Use for dependency injection in tests
 */
export function createSessionRepository(
  prisma: PrismaClient,
  config?: Partial<SessionRepositoryConfig>
): SessionRepository {
  return new SessionRepository(prisma, config);
}
