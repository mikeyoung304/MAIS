/**
 * Session Service
 *
 * Business logic layer that orchestrates:
 * - Caching (LRU with TTL, stores decrypted data for CPU efficiency)
 * - Encryption (AES-256-GCM at rest in database)
 * - Repository (PostgreSQL with advisory locks)
 *
 * Layered architecture:
 * 1. Cache layer - Check cache first, store decrypted data (in-memory only)
 * 2. Encryption layer - Encrypt before DB write, decrypt after DB read
 * 3. Repository layer - PostgreSQL with advisory locks
 *
 * Security note: Cache stores decrypted data to avoid decrypt-on-every-hit
 * CPU overhead. This is safe because the cache is in-memory only and
 * decrypted data never leaves the process boundary.
 *
 * @see plans/feat-persistent-chat-session-storage.md Phase 2.3
 */

import type { PrismaClient } from '../../generated/prisma/client';
import { logger } from '../../lib/core/logger';
import { encryptionService, type EncryptedData } from '../../lib/encryption.service';
import type { SessionRepository } from './session.repository';
import { createSessionRepository } from './session.repository';
import type { SessionCache } from './session.cache';
import {
  sessionCache as defaultCache,
  createSessionCache as _createSessionCache,
} from './session.cache';
import {
  type CreateMessageInput,
  type SessionMessage,
  type SessionWithMessages,
  type ToolCall,
} from './session.schemas';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface SessionServiceConfig {
  /** Whether to encrypt message content at rest (default: true) */
  encryptMessages: boolean;
  /** Whether to use caching (default: true) */
  cacheEnabled: boolean;
}

const DEFAULT_CONFIG: SessionServiceConfig = {
  encryptMessages: true,
  cacheEnabled: true,
};

// Marker to identify encrypted data (prevents double encryption)
const ENCRYPTION_MARKER = '__encrypted__';

interface EncryptedWrapper {
  [key: string]: unknown;
  __encrypted__: true;
  data: EncryptedData;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * Session Service - orchestrates caching, encryption, and persistence
 *
 * Usage:
 * ```typescript
 * const service = createSessionService(prisma);
 * const session = await service.getOrCreateSession(tenantId, sessionId, 'ADMIN');
 * await service.appendMessage(sessionId, tenantId, message, session.version);
 * ```
 */
export class SessionService {
  private readonly repository: SessionRepository;
  private readonly cache: SessionCache;
  private readonly config: SessionServiceConfig;

  constructor(
    repository: SessionRepository,
    cache?: SessionCache,
    config?: Partial<SessionServiceConfig>
  ) {
    this.repository = repository;
    this.cache = cache ?? defaultCache;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // SESSION OPERATIONS
  // ===========================================================================

  /**
   * Get or create session
   *
   * If sessionId is provided, tries to restore existing session.
   * If not found or sessionId is null, creates a new session.
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
        logger.debug({ sessionId, tenantId }, 'Session restored');
        return session;
      }
      // Session not found - create new one
      logger.debug({ sessionId, tenantId }, 'Session not found, creating new');
    }

    // Create new session
    const session = await this.repository.createSession(
      tenantId,
      sessionType,
      customerId,
      userAgent
    );

    // Cache new session
    if (this.config.cacheEnabled) {
      this.cache.set(session.id, tenantId, session);
    }

    return session;
  }

  /**
   * Get session by ID with caching
   *
   * Cache stores decrypted data to avoid CPU overhead on every hit.
   * Security note: Cache is in-memory only (not Redis), so decrypted
   * data never leaves the process boundary.
   */
  async getSession(sessionId: string, tenantId: string): Promise<SessionWithMessages | null> {
    // Check cache first - returns already-decrypted data
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(sessionId, tenantId);
      if (cached) {
        return cached; // Already decrypted, no CPU overhead
      }
    }

    // Fetch from database
    const session = await this.repository.getSession(sessionId, tenantId);
    if (!session) {
      return null;
    }

    // Decrypt messages BEFORE caching
    const decrypted = this.decryptSession(session);

    // Cache decrypted version for future requests
    if (this.config.cacheEnabled) {
      this.cache.set(sessionId, tenantId, decrypted);
    }

    return decrypted;
  }

  /**
   * Append message to session
   *
   * Handles encryption, cache invalidation, and optimistic locking.
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
   * Delete session (soft delete)
   */
  async deleteSession(sessionId: string, tenantId: string): Promise<boolean> {
    const deleted = await this.repository.deleteSession(sessionId, tenantId);

    if (deleted) {
      this.cache.invalidate(sessionId, tenantId);
    }

    return deleted;
  }

  /**
   * Restore soft-deleted session
   */
  async restoreSession(sessionId: string, tenantId: string): Promise<boolean> {
    const restored = await this.repository.restoreSession(sessionId, tenantId);

    if (restored) {
      this.cache.invalidate(sessionId, tenantId);
    }

    return restored;
  }

  /**
   * Touch session to update activity timestamp
   */
  async touchSession(sessionId: string, tenantId: string): Promise<void> {
    await this.repository.touchSession(sessionId, tenantId);
    // Don't invalidate cache - activity timestamp isn't cached
  }

  // ===========================================================================
  // ENCRYPTION HELPERS
  // ===========================================================================

  /**
   * Check if a value is already encrypted
   */
  private isEncrypted(value: unknown): value is EncryptedWrapper {
    return (
      typeof value === 'object' &&
      value !== null &&
      ENCRYPTION_MARKER in value &&
      (value as EncryptedWrapper)[ENCRYPTION_MARKER] === true
    );
  }

  /**
   * Encrypt a field value
   */
  private encryptField(value: string): string {
    if (!this.config.encryptMessages) return value;

    const encrypted = encryptionService.encrypt(value);
    const wrapper: EncryptedWrapper = {
      [ENCRYPTION_MARKER]: true,
      data: encrypted,
    };
    return JSON.stringify(wrapper);
  }

  /**
   * Decrypt a field value
   */
  private decryptField(value: string): string {
    if (!this.config.encryptMessages) return value;

    try {
      const parsed = JSON.parse(value);
      if (this.isEncrypted(parsed)) {
        return encryptionService.decrypt(parsed.data);
      }
      // Not encrypted (backward compatibility)
      return value;
    } catch {
      // Value is not JSON (backward compatibility)
      return value;
    }
  }

  /**
   * Encrypt message input before storage
   */
  private encryptMessage(input: CreateMessageInput): CreateMessageInput {
    return {
      ...input,
      content: this.encryptField(input.content),
      toolCalls: input.toolCalls ? this.encryptToolCalls(input.toolCalls) : input.toolCalls,
    };
  }

  /**
   * Decrypt message after retrieval
   */
  private decryptMessage(message: SessionMessage): SessionMessage {
    return {
      ...message,
      content: this.decryptField(message.content),
      toolCalls: message.toolCalls ? this.decryptToolCalls(message.toolCalls) : message.toolCalls,
    };
  }

  /**
   * Encrypt tool calls
   */
  private encryptToolCalls(toolCalls: ToolCall[]): ToolCall[] {
    if (!this.config.encryptMessages) return toolCalls;

    // Encrypt the entire tool calls array as a single blob
    const encrypted = encryptionService.encryptObject(toolCalls);
    // Store as a single encrypted entry (will be decrypted as a whole)
    return [
      {
        id: ENCRYPTION_MARKER,
        name: ENCRYPTION_MARKER,
        arguments: encrypted as unknown as Record<string, unknown>,
      },
    ];
  }

  /**
   * Decrypt tool calls
   */
  private decryptToolCalls(toolCalls: ToolCall[]): ToolCall[] {
    if (!this.config.encryptMessages) return toolCalls;

    // Check if this is our encrypted wrapper format
    if (
      toolCalls.length === 1 &&
      toolCalls[0].id === ENCRYPTION_MARKER &&
      toolCalls[0].name === ENCRYPTION_MARKER
    ) {
      try {
        const encrypted = toolCalls[0].arguments as unknown as EncryptedData;
        return encryptionService.decryptObject<ToolCall[]>(encrypted);
      } catch (error) {
        logger.error({ error }, 'Failed to decrypt tool calls');
        return [];
      }
    }

    // Not encrypted (backward compatibility)
    return toolCalls;
  }

  /**
   * Decrypt entire session
   */
  private decryptSession(session: SessionWithMessages): SessionWithMessages {
    return {
      ...session,
      messages: session.messages.map((m) => this.decryptMessage(m)),
    };
  }

  // ===========================================================================
  // CACHE MANAGEMENT
  // ===========================================================================

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxEntries: number; ttlMs: number } {
    return this.cache.getStats();
  }

  /**
   * Clear session cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache for a tenant
   */
  invalidateTenantCache(tenantId: string): void {
    this.cache.invalidateAllForTenant(tenantId);
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Factory for creating SessionService instances
 *
 * @example
 * // Default production usage
 * const service = createSessionService(prisma);
 *
 * // For testing - custom cache and config
 * const testCache = createSessionCache({ ttlMs: 100 });
 * const service = createSessionService(prisma, undefined, testCache, { encryptMessages: false });
 *
 * // With injected repository (for testing or custom implementations)
 * const mockRepo = createMockSessionRepository(); // Your mock implementation
 * const service = createSessionService(prisma, mockRepo);
 */
export function createSessionService(
  prisma: PrismaClient,
  repository?: SessionRepository,
  cache?: SessionCache,
  config?: Partial<SessionServiceConfig>
): SessionService {
  return new SessionService(repository ?? createSessionRepository(prisma), cache, config);
}
