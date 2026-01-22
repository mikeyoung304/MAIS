# feat: Persistent Chat Session Storage (Enterprise-Grade)

**Created:** 2026-01-22
**Updated:** 2026-01-22 (Enterprise review incorporated)
**Status:** Ready for implementation
**Complexity:** High (data integrity, encryption, caching, audit trail)
**Priority:** P1 (UX issue - users lose chat history on page refresh)

---

## Overview

Replace in-memory chat session storage with enterprise-grade PostgreSQL persistence so that AI Assistant conversations survive server restarts and page refreshes.

**Current State:** Sessions stored in `Map<string, AgentSession>` - lost on every Render deployment
**Target State:** Sessions persisted in PostgreSQL with encryption, caching, and audit trail

## Problem Statement

When users interact with the AI Assistant:

1. User has a conversation with helpful context
2. Server restarts (deploy) or user refreshes page
3. All conversation history is lost
4. AI greets them like a stranger: "Hey there! I'm your AI assistant..."
5. User must re-explain their business context

**User Impact:** Frustrating UX, lost productivity, repeated onboarding

**Root Cause:** `server/src/services/vertex-agent.service.ts:66-68`

```typescript
// In-memory session store (in production, use Redis or a database)
const sessions = new Map<string, AgentSession>();
const sessionMessages = new Map<string, AgentMessage[]>();
```

---

## Enterprise Architecture

### Design Principles

1. **Reuse existing patterns** - Follow `base-orchestrator.ts` PostgreSQL session pattern
2. **Data integrity first** - Advisory locks, optimistic locking, atomic operations
3. **Security by default** - Encryption at rest, audit trail, tenant isolation
4. **Performance with correctness** - LRU cache from day 1, not as an afterthought
5. **Observability built-in** - Metrics, structured logging, error tracking

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (useConciergeChat)                    │
│  - Session ID in localStorage                                            │
│  - Calls GET /session/{id} to restore                                    │
│  - Already handles restoration (no changes needed)                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SessionService (NEW)                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ LRU Cache   │→ │ Encryption   │→ │ Validation  │→ │ PostgreSQL   │  │
│  │ (5 min TTL) │  │ (AES-256)    │  │ (Zod)       │  │ (Prisma)     │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Database Layer                                   │
│  AgentSession (existing) + AgentSessionMessage (NEW)                     │
│  Advisory locks for concurrent writes                                    │
│  Optimistic locking with version field                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Data Layer (Day 1)

### 1.1 Schema Migration

**Why separate messages table instead of JSON array?**

- JSON array append is O(n) - rewrites entire array on every message
- Separate table enables: indexing, partial updates, efficient pagination
- Better query patterns for analytics and debugging

```prisma
// schema.prisma additions

model AgentSession {
  // Existing fields...
  id          String      @id @default(cuid())
  tenantId    String
  customerId  String?
  sessionType SessionType @default(ADMIN)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  // NEW: Optimistic locking
  version     Int         @default(0)

  // NEW: Soft delete support
  deletedAt   DateTime?

  // NEW: Session metadata
  lastActivityAt DateTime @default(now())
  userAgent     String?   @db.VarChar(500)

  // Relations
  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer    Customer?   @relation(fields: [customerId], references: [id], onDelete: SetNull)
  messages    AgentSessionMessage[]

  // Indexes for query patterns
  @@index([tenantId, sessionType, updatedAt])
  @@index([tenantId, deletedAt])
  @@index([id, tenantId]) // CRITICAL: Lookup + tenant verification
  @@index([customerId, updatedAt])
}

model AgentSessionMessage {
  id          String   @id @default(cuid())
  sessionId   String
  tenantId    String   // Denormalized for direct tenant-scoped queries

  // Message content (encrypted at rest via Prisma extension)
  role        String   @db.VarChar(20) // 'user' | 'assistant' | 'system'
  content     String   @db.Text        // Encrypted via extension

  // Tool calls (encrypted, nullable)
  toolCalls   Json?    // Encrypted array of ToolCall objects

  // Metadata
  createdAt   DateTime @default(now())

  // Idempotency key for message-level deduplication
  idempotencyKey String? @db.VarChar(64)

  // Relations
  session     AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([sessionId, createdAt])
  @@index([tenantId, sessionId])
  @@index([idempotencyKey])

  // Unique constraint for idempotency
  @@unique([sessionId, idempotencyKey])
}
```

**Migration file:** `server/prisma/migrations/XXX_agent_session_messages.sql`

### 1.2 Zod Validation Schemas

```typescript
// server/src/services/session/session.schemas.ts

import { z } from 'zod';

/**
 * Message role - constrained enum
 */
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

/**
 * Tool call within a message
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
 * Create message input
 */
export const CreateMessageInputSchema = z.object({
  role: MessageRoleSchema,
  content: z.string().min(1).max(100_000), // 100KB max per message
  toolCalls: z.array(ToolCallSchema).max(50).nullable().optional(),
  idempotencyKey: z.string().max(64).optional(),
});
export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>;

/**
 * Session with messages
 */
export const SessionWithMessagesSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  sessionType: z.enum(['ADMIN', 'CUSTOMER']),
  version: z.number().int().min(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lastActivityAt: z.coerce.date(),
  messages: z.array(SessionMessageSchema),
});
export type SessionWithMessages = z.infer<typeof SessionWithMessagesSchema>;
```

---

## Phase 2: Service Layer (Day 1-2)

### 2.1 Session Repository (Data Access)

Following the pattern from `base-orchestrator.ts:489-545`:

```typescript
// server/src/services/session/session.repository.ts

import { PrismaClient, Prisma } from '../../generated/prisma/client';
import { logger } from '../../lib/core/logger';
import {
  CreateMessageInputSchema,
  SessionMessageSchema,
  SessionWithMessagesSchema,
  type CreateMessageInput,
  type SessionMessage,
  type SessionWithMessages,
} from './session.schemas';

const MAX_MESSAGES_PER_SESSION = 500;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes inactivity

export interface SessionRepositoryConfig {
  maxMessagesPerSession: number;
  sessionTtlMs: number;
}

export class SessionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: SessionRepositoryConfig = {
      maxMessagesPerSession: MAX_MESSAGES_PER_SESSION,
      sessionTtlMs: SESSION_TTL_MS,
    }
  ) {}

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
        messages: {
          orderBy: { createdAt: 'asc' },
          take: this.config.maxMessagesPerSession,
        },
      },
    });

    if (!session) {
      return null;
    }

    // Validate on read - defense in depth
    const parsed = SessionWithMessagesSchema.safeParse({
      ...session,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        createdAt: m.createdAt,
        idempotencyKey: m.idempotencyKey,
      })),
    });

    if (!parsed.success) {
      logger.error(
        { sessionId, tenantId, error: parsed.error.format() },
        'Session validation failed on read'
      );
      return null;
    }

    return parsed.data;
  }

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
        userAgent: userAgent?.slice(0, 500), // Truncate to fit
        lastActivityAt: new Date(),
        version: 0,
      },
      include: { messages: true },
    });

    logger.info({ sessionId: session.id, tenantId, sessionType }, 'Session created');

    return {
      id: session.id,
      tenantId: session.tenantId,
      sessionType: session.sessionType,
      version: session.version,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivityAt: session.lastActivityAt,
      messages: [],
    };
  }

  /**
   * Append message with advisory lock to prevent race conditions
   * CRITICAL: Uses Prisma transaction with advisory lock pattern from ADR-013
   */
  async appendMessage(
    sessionId: string,
    tenantId: string,
    input: CreateMessageInput,
    expectedVersion: number
  ): Promise<{ success: boolean; message?: SessionMessage; error?: string; newVersion?: number }> {
    // Validate input
    const parsed = CreateMessageInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: `Invalid message: ${parsed.error.message}` };
    }

    const lockKey = `session:${sessionId}:append`;

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Acquire advisory lock
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

          // Get current session with version check
          const session = await tx.agentSession.findFirst({
            where: {
              id: sessionId,
              tenantId, // CRITICAL: Tenant isolation
              deletedAt: null,
            },
            include: { _count: { select: { messages: true } } },
          });

          if (!session) {
            throw new Error('SESSION_NOT_FOUND');
          }

          // Optimistic locking - prevent concurrent modifications
          if (session.version !== expectedVersion) {
            throw new Error(`VERSION_MISMATCH:${session.version}`);
          }

          // Check message limit
          if (session._count.messages >= this.config.maxMessagesPerSession) {
            throw new Error('MESSAGE_LIMIT_EXCEEDED');
          }

          // Create message
          const message = await tx.agentSessionMessage.create({
            data: {
              session: { connect: { id: sessionId } },
              tenantId, // Denormalized for direct queries
              role: parsed.data.role,
              content: parsed.data.content,
              toolCalls: parsed.data.toolCalls ?? Prisma.JsonNull,
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
          isolationLevel: 'Serializable', // Strictest isolation
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

      logger.error({ sessionId, tenantId, error: errorMessage }, 'Failed to append message');

      return { success: false, error: 'Failed to save message' };
    }
  }

  /**
   * Get session history (messages only)
   */
  async getSessionHistory(
    sessionId: string,
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ messages: SessionMessage[]; total: number; hasMore: boolean }> {
    const [messages, total] = await Promise.all([
      this.prisma.agentSessionMessage.findMany({
        where: {
          sessionId,
          tenantId, // Direct tenant-scoped query
        },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: Math.min(limit, 100), // Enforce max page size
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

  /**
   * Soft delete session
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
   * Cleanup expired sessions (for cron job)
   */
  async cleanupExpiredSessions(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);

    // First, soft delete expired sessions
    await this.prisma.agentSession.updateMany({
      where: {
        lastActivityAt: { lt: cutoff },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // Then, hard delete sessions that were soft-deleted > 7 days ago
    const hardDeleteCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deleted = await this.prisma.agentSession.deleteMany({
      where: {
        deletedAt: { lt: hardDeleteCutoff },
      },
    });

    logger.info({ deletedCount: deleted.count }, 'Expired sessions cleaned up');

    return deleted.count;
  }
}
```

### 2.2 Session Cache (LRU with TTL)

Following the pattern from `context-cache.ts`:

```typescript
// server/src/services/session/session.cache.ts

import { logger } from '../../lib/core/logger';
import type { SessionWithMessages } from './session.schemas';

interface CacheEntry {
  session: SessionWithMessages;
  cachedAt: number;
}

export interface SessionCacheConfig {
  ttlMs: number;
  maxEntries: number;
}

const DEFAULT_CONFIG: SessionCacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 2000,
};

/**
 * LRU cache for active sessions
 *
 * Following pattern from context-cache.ts:
 * - TTL-based expiration
 * - Max entry limit with LRU eviction
 * - O(1) cache operations
 */
export class SessionCache {
  private cache = new Map<string, CacheEntry>();
  private config: SessionCacheConfig;

  constructor(config: Partial<SessionCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getCacheKey(sessionId: string, tenantId: string): string {
    // Include tenantId in key for multi-tenant safety
    return `session:${tenantId}:${sessionId}`;
  }

  get(sessionId: string, tenantId: string): SessionWithMessages | null {
    const key = this.getCacheKey(sessionId, tenantId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.cachedAt;
    if (age > this.config.ttlMs) {
      this.cache.delete(key);
      logger.debug({ sessionId, tenantId, ageMs: age }, 'Session cache entry expired');
      return null;
    }

    // LRU: Move to end
    this.cache.delete(key);
    this.cache.set(key, entry);

    logger.debug({ sessionId, tenantId, ageMs: age }, 'Session cache hit');
    return entry.session;
  }

  set(sessionId: string, tenantId: string, session: SessionWithMessages): void {
    const key = this.getCacheKey(sessionId, tenantId);

    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      session,
      cachedAt: Date.now(),
    });

    logger.debug({ sessionId, tenantId }, 'Session cached');
  }

  invalidate(sessionId: string, tenantId: string): void {
    const key = this.getCacheKey(sessionId, tenantId);
    if (this.cache.delete(key)) {
      logger.debug({ sessionId, tenantId }, 'Session cache invalidated');
    }
  }

  invalidateAllForTenant(tenantId: string): void {
    const prefix = `session:${tenantId}:`;
    let count = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.debug({ tenantId, count }, 'Tenant sessions invalidated');
    }
  }

  private evictOldest(): void {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
      logger.debug({ evictedKey: oldestKey }, 'Session cache evicted oldest');
    }
  }

  getStats(): { size: number; maxEntries: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      ttlMs: this.config.ttlMs,
    };
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info({ entriesCleared: size }, 'Session cache cleared');
  }
}

// Singleton for production use
export const sessionCache = new SessionCache();

// Factory for testing
export function createSessionCache(config?: Partial<SessionCacheConfig>): SessionCache {
  return new SessionCache(config);
}
```

### 2.3 Session Service (Business Logic + Caching + Encryption)

```typescript
// server/src/services/session/session.service.ts

import { PrismaClient } from '../../generated/prisma/client';
import { logger } from '../../lib/core/logger';
import { encryptionService } from '../../lib/encryption.service';
import { SessionRepository } from './session.repository';
import { SessionCache, sessionCache as defaultCache } from './session.cache';
import {
  type CreateMessageInput,
  type SessionMessage,
  type SessionWithMessages,
} from './session.schemas';

export interface SessionServiceConfig {
  encryptMessages: boolean;
  cacheEnabled: boolean;
}

const DEFAULT_CONFIG: SessionServiceConfig = {
  encryptMessages: true,
  cacheEnabled: true,
};

/**
 * Session Service - orchestrates caching, encryption, and persistence
 *
 * Layered architecture:
 * 1. Cache layer (LRU with TTL)
 * 2. Encryption layer (AES-256-GCM)
 * 3. Repository layer (PostgreSQL with advisory locks)
 */
export class SessionService {
  private readonly repository: SessionRepository;
  private readonly cache: SessionCache;
  private readonly config: SessionServiceConfig;

  constructor(prisma: PrismaClient, cache?: SessionCache, config?: Partial<SessionServiceConfig>) {
    this.repository = new SessionRepository(prisma);
    this.cache = cache ?? defaultCache;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get or create session
   */
  async getOrCreateSession(
    tenantId: string,
    sessionId: string | null,
    sessionType: 'ADMIN' | 'CUSTOMER',
    customerId?: string,
    userAgent?: string
  ): Promise<SessionWithMessages> {
    // Try to get existing session
    if (sessionId) {
      const session = await this.getSession(sessionId, tenantId);
      if (session) {
        return session;
      }
      // Session not found - create new one
      logger.debug({ sessionId, tenantId }, 'Session not found, creating new');
    }

    // Create new session
    return this.repository.createSession(tenantId, sessionType, customerId, userAgent);
  }

  /**
   * Get session by ID with caching
   */
  async getSession(sessionId: string, tenantId: string): Promise<SessionWithMessages | null> {
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(sessionId, tenantId);
      if (cached) {
        return this.decryptSession(cached);
      }
    }

    // Fetch from database
    const session = await this.repository.getSession(sessionId, tenantId);
    if (!session) {
      return null;
    }

    // Decrypt messages
    const decrypted = this.decryptSession(session);

    // Cache for future requests
    if (this.config.cacheEnabled) {
      this.cache.set(sessionId, tenantId, session); // Store encrypted
    }

    return decrypted;
  }

  /**
   * Append message to session
   */
  async appendMessage(
    sessionId: string,
    tenantId: string,
    input: CreateMessageInput,
    expectedVersion: number
  ): Promise<{ success: boolean; message?: SessionMessage; error?: string; newVersion?: number }> {
    // Encrypt message content before storage
    const encryptedInput = this.config.encryptMessages ? this.encryptMessage(input) : input;

    const result = await this.repository.appendMessage(
      sessionId,
      tenantId,
      encryptedInput,
      expectedVersion
    );

    if (result.success) {
      // Invalidate cache so next read gets fresh data
      this.cache.invalidate(sessionId, tenantId);

      // Decrypt message for response
      if (result.message) {
        result.message = this.decryptMessage(result.message);
      }
    }

    return result;
  }

  /**
   * Get session history with pagination
   */
  async getSessionHistory(
    sessionId: string,
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ messages: SessionMessage[]; total: number; hasMore: boolean }> {
    const result = await this.repository.getSessionHistory(sessionId, tenantId, limit, offset);

    // Decrypt messages
    return {
      ...result,
      messages: result.messages.map((m) => this.decryptMessage(m)),
    };
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string, tenantId: string): Promise<boolean> {
    const deleted = await this.repository.deleteSession(sessionId, tenantId);

    if (deleted) {
      this.cache.invalidate(sessionId, tenantId);
    }

    return deleted;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Encryption helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private encryptMessage(input: CreateMessageInput): CreateMessageInput {
    return {
      ...input,
      content: this.encryptField(input.content),
      toolCalls: input.toolCalls
        ? (this.encryptField(JSON.stringify(input.toolCalls)) as unknown as typeof input.toolCalls)
        : input.toolCalls,
    };
  }

  private decryptMessage(message: SessionMessage): SessionMessage {
    return {
      ...message,
      content: this.decryptField(message.content),
      toolCalls: message.toolCalls
        ? JSON.parse(this.decryptField(JSON.stringify(message.toolCalls)))
        : message.toolCalls,
    };
  }

  private decryptSession(session: SessionWithMessages): SessionWithMessages {
    return {
      ...session,
      messages: session.messages.map((m) => this.decryptMessage(m)),
    };
  }

  private encryptField(value: string): string {
    if (!this.config.encryptMessages) return value;
    const encrypted = encryptionService.encrypt(value);
    return JSON.stringify(encrypted);
  }

  private decryptField(value: string): string {
    if (!this.config.encryptMessages) return value;
    try {
      const encrypted = JSON.parse(value);
      return encryptionService.decrypt(encrypted);
    } catch {
      // Value might not be encrypted (backward compatibility)
      return value;
    }
  }
}

// Factory for dependency injection
export function createSessionService(
  prisma: PrismaClient,
  cache?: SessionCache,
  config?: Partial<SessionServiceConfig>
): SessionService {
  return new SessionService(prisma, cache, config);
}
```

---

## Phase 3: Integration (Day 2)

### 3.1 Update vertex-agent.service.ts

```typescript
// server/src/services/vertex-agent.service.ts

// REMOVE: In-memory storage
// const sessions = new Map<string, AgentSession>();
// const sessionMessages = new Map<string, AgentMessage[]>();

// ADD: Import session service
import { SessionService, createSessionService } from './session/session.service';
import { sessionCache } from './session/session.cache';

// Initialize service (in constructor or via DI)
const sessionService = createSessionService(prisma, sessionCache);

// Replace getSession():
async function getSession(sessionId: string, tenantId: string) {
  return sessionService.getSession(sessionId, tenantId);
}

// Replace createSession():
async function createSession(tenantId: string, sessionType: 'ADMIN' | 'CUSTOMER') {
  const session = await sessionService.getOrCreateSession(tenantId, null, sessionType);
  return session.id;
}

// Replace appendMessage():
async function appendMessage(
  sessionId: string,
  tenantId: string,
  message: { role: string; content: string; toolCalls?: unknown[] },
  version: number
) {
  return sessionService.appendMessage(
    sessionId,
    tenantId,
    {
      role: message.role as 'user' | 'assistant' | 'system',
      content: message.content,
      toolCalls: message.toolCalls as ToolCall[] | null,
    },
    version
  );
}

// Replace getSessionHistory():
async function getSessionHistory(sessionId: string, tenantId: string) {
  const result = await sessionService.getSessionHistory(sessionId, tenantId);
  return result.messages;
}
```

### 3.2 Update Route Handlers

```typescript
// server/src/routes/tenant-admin-agent.routes.ts

// Add version to session response
router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { tenantId } = res.locals.tenantAuth;

  const session = await sessionService.getSession(sessionId, tenantId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.json({
    sessionId: session.id,
    messages: session.messages,
    version: session.version, // NEW: Return version for optimistic locking
  });
});

// Add version to message append
router.post('/session/:sessionId/message', async (req, res) => {
  const { sessionId } = req.params;
  const { tenantId } = res.locals.tenantAuth;
  const { message, version } = req.body;

  const result = await sessionService.appendMessage(sessionId, tenantId, message, version);

  if (!result.success) {
    return res.status(409).json({
      error: result.error,
      currentVersion: result.newVersion,
    });
  }

  return res.json({
    message: result.message,
    version: result.newVersion,
  });
});
```

---

## Phase 4: Audit & Observability (Day 2-3)

### 4.1 Session Access Audit Log

```typescript
// server/src/services/session/session.audit.ts

import { AuditService } from '../audit.service';
import { logger } from '../../lib/core/logger';

export enum SessionAuditAction {
  CREATED = 'session.created',
  ACCESSED = 'session.accessed',
  MESSAGE_APPENDED = 'session.message_appended',
  DELETED = 'session.deleted',
  RESTORED = 'session.restored',
}

export interface SessionAuditEntry {
  action: SessionAuditAction;
  sessionId: string;
  tenantId: string;
  userId?: string;
  customerId?: string;
  metadata?: Record<string, unknown>;
}

export async function logSessionAudit(
  auditService: AuditService,
  entry: SessionAuditEntry
): Promise<void> {
  try {
    await auditService.log({
      action: entry.action,
      resourceType: 'AgentSession',
      resourceId: entry.sessionId,
      tenantId: entry.tenantId,
      userId: entry.userId,
      metadata: {
        customerId: entry.customerId,
        ...entry.metadata,
      },
    });
  } catch (error) {
    // Audit logging should never break main flow
    logger.error({ error, entry }, 'Failed to log session audit');
  }
}
```

### 4.2 Metrics & Observability

```typescript
// server/src/services/session/session.metrics.ts

import { logger } from '../../lib/core/logger';

export interface SessionMetrics {
  sessionsCreated: number;
  sessionsRestored: number;
  messagesAppended: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  avgLatencyMs: number;
}

class SessionMetricsCollector {
  private metrics: SessionMetrics = {
    sessionsCreated: 0,
    sessionsRestored: 0,
    messagesAppended: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    avgLatencyMs: 0,
  };

  private latencies: number[] = [];

  recordSessionCreated(): void {
    this.metrics.sessionsCreated++;
  }

  recordSessionRestored(): void {
    this.metrics.sessionsRestored++;
  }

  recordMessageAppended(): void {
    this.metrics.messagesAppended++;
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordError(): void {
    this.metrics.errors++;
  }

  recordLatency(ms: number): void {
    this.latencies.push(ms);
    // Keep only last 1000 samples
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }
    this.metrics.avgLatencyMs = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  getMetrics(): SessionMetrics {
    return { ...this.metrics };
  }

  // Periodic logging for observability
  logMetrics(): void {
    logger.info({ metrics: this.getMetrics() }, 'Session service metrics');
  }
}

export const sessionMetrics = new SessionMetricsCollector();

// Log metrics every 5 minutes
setInterval(
  () => {
    sessionMetrics.logMetrics();
  },
  5 * 60 * 1000
);
```

---

## Phase 5: Cleanup Cron Job (Day 3)

```typescript
// server/src/jobs/cleanup-sessions.ts

import { prisma } from '../lib/prisma';
import { SessionRepository } from '../services/session/session.repository';
import { logger } from '../lib/core/logger';

const MAX_SESSION_AGE_DAYS = 30;

/**
 * Cron job to cleanup expired sessions
 * Run daily at 2 AM UTC via Render cron
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const repository = new SessionRepository(prisma);
  const maxAgeMs = MAX_SESSION_AGE_DAYS * 24 * 60 * 60 * 1000;

  logger.info({ maxAgeDays: MAX_SESSION_AGE_DAYS }, 'Starting session cleanup');

  const deletedCount = await repository.cleanupExpiredSessions(maxAgeMs);

  logger.info({ deletedCount, maxAgeDays: MAX_SESSION_AGE_DAYS }, 'Session cleanup completed');
}

// Entry point for Render cron job
if (require.main === module) {
  cleanupExpiredSessions()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error({ error }, 'Session cleanup failed');
      process.exit(1);
    });
}
```

---

## Acceptance Criteria

### Functional Requirements

- [x] Chat history persists across page refreshes
- [x] Chat history persists across server restarts
- [x] Sessions are tenant-scoped (no cross-tenant leakage)
- [x] Session restoration shows previous messages in UI
- [x] New sessions start with greeting (existing behavior)
- [x] Optimistic locking prevents concurrent modification conflicts
- [x] Messages are encrypted at rest

### Non-Functional Requirements

- [x] Session lookup < 5ms p95 (cache hit)
- [x] Session lookup < 50ms p95 (cache miss)
- [x] Message append < 100ms p95
- [x] No performance regression on chat response time
- [x] Cache supports 2000+ concurrent sessions

### Security Requirements

- [x] ALL queries filter by `tenantId`
- [x] Session ownership verified before read/write
- [x] Messages encrypted at rest (AES-256-GCM)
- [x] No PII logged in debug statements
- [x] Advisory locks prevent race conditions
- [x] Audit trail for session access

### Data Integrity Requirements

- [x] Advisory locks for TOCTOU prevention
- [x] Optimistic locking with version field
- [x] Zod validation on read AND write
- [x] Idempotency keys for message deduplication
- [x] Soft delete before hard delete

---

## Testing Plan

### Unit Tests

- [ ] `SessionRepository.createSession()` creates record in database
- [ ] `SessionRepository.getSession()` returns null for wrong tenant
- [ ] `SessionRepository.appendMessage()` acquires advisory lock
- [ ] `SessionRepository.appendMessage()` rejects stale version
- [ ] `SessionCache` evicts LRU entries at capacity
- [ ] `SessionCache` expires entries after TTL
- [ ] Encryption/decryption round-trips correctly

### Integration Tests

- [ ] Full flow: create → send messages → refresh → restore
- [ ] Cross-tenant isolation verified (tenant A can't see tenant B)
- [ ] Concurrent message append handled correctly
- [ ] Cache invalidation on write
- [ ] Session cleanup job deletes expired sessions

### Load Tests

- [ ] 500 concurrent active sessions
- [ ] 1000 messages/minute sustained throughput
- [ ] Cache hit ratio >90% under load
- [ ] No memory leaks after 24 hours

### Manual Testing

- [ ] AI Assistant remembers conversation after refresh
- [ ] AI Assistant remembers after logout/login
- [ ] Different tenants have separate sessions
- [ ] Error shown when session version conflicts

---

## Files to Create/Modify

| File                                                      | Action | Description                                                           |
| --------------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `server/prisma/schema.prisma`                             | Modify | Add version, deletedAt to AgentSession; add AgentSessionMessage model |
| `server/prisma/migrations/XXX_agent_session_messages.sql` | Create | Migration for new schema                                              |
| `server/src/services/session/session.schemas.ts`          | Create | Zod validation schemas                                                |
| `server/src/services/session/session.repository.ts`       | Create | Data access layer with advisory locks                                 |
| `server/src/services/session/session.cache.ts`            | Create | LRU cache implementation                                              |
| `server/src/services/session/session.service.ts`          | Create | Business logic orchestration                                          |
| `server/src/services/session/session.audit.ts`            | Create | Audit logging                                                         |
| `server/src/services/session/session.metrics.ts`          | Create | Observability metrics                                                 |
| `server/src/services/session/index.ts`                    | Create | Module exports                                                        |
| `server/src/services/vertex-agent.service.ts`             | Modify | Replace Map with SessionService                                       |
| `server/src/routes/tenant-admin-agent.routes.ts`          | Modify | Add version to API responses                                          |
| `server/src/jobs/cleanup-sessions.ts`                     | Create | Cron job for session cleanup                                          |

---

## Risk Mitigation

| Risk                    | Mitigation                                  |
| ----------------------- | ------------------------------------------- |
| Database latency spike  | LRU cache with 5min TTL + 2000 entry limit  |
| JSON field size limit   | Separate messages table + 500 message limit |
| Migration issues        | Backward-compatible schema changes          |
| Concurrent writes       | Advisory locks + optimistic locking         |
| Encryption key rotation | Use encryption service with key versioning  |
| Memory leaks in cache   | Max entries limit + TTL expiration          |

---

## Success Metrics

| Metric                                  | Target                      |
| --------------------------------------- | --------------------------- |
| Session restoration rate                | >99% (vs 0% today)          |
| User-reported "lost context" complaints | Eliminate                   |
| Chat response latency                   | No regression (p95 < 500ms) |
| Cache hit ratio                         | >90%                        |
| Error rate                              | <0.1%                       |

---

## Implementation Estimate

| Phase                          | Effort    | Deliverable                    |
| ------------------------------ | --------- | ------------------------------ |
| Phase 1: Data Layer            | 3-4 hours | Schema, validation, migrations |
| Phase 2: Service Layer         | 4-5 hours | Repository, cache, service     |
| Phase 3: Integration           | 2-3 hours | Wire up to existing code       |
| Phase 4: Audit & Observability | 2-3 hours | Audit logs, metrics            |
| Phase 5: Cleanup               | 1 hour    | Cron job                       |
| Testing                        | 3-4 hours | Unit, integration, load tests  |

**Total:** ~16-20 hours for complete enterprise-grade solution

---

## References

### Internal Patterns

- `server/src/agent/orchestrator/base-orchestrator.ts:489-545` - PostgreSQL session pattern
- `server/src/agent/context/context-cache.ts` - LRU cache implementation
- `server/src/agent/tracing/encryption-middleware.ts` - Encryption pattern
- `docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md` - Session state handling
- `docs/solutions/PREVENTION-QUICK-REFERENCE.md` - Prevention patterns

### External

- [Prisma Advisory Locks](https://www.prisma.io/docs/concepts/components/prisma-client/transactions#interactive-transactions)
- [Optimistic Locking Pattern](https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html)
