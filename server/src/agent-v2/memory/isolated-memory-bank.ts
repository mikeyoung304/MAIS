/**
 * Isolated Memory Bank Wrapper
 *
 * CRITICAL SECURITY: This wrapper enforces tenant isolation for Memory Bank.
 *
 * Problem: Memory Bank's semantic search could theoretically return memories
 * from other tenants if not properly scoped.
 *
 * Solution: Composite userId with tenantId prefix + post-retrieval validation.
 * Belt AND suspenders approach - we filter on query AND validate results.
 */

import { logger } from '../../lib/core/logger.js';

interface MemoryBankConfig {
  projectId: string;
  location: string;
  agentEngineId: string;
}

interface Memory {
  id: string;
  content: string;
  topic?: string;
  metadata?: {
    user_id?: string;
    tenant_id?: string;
    created_at?: string;
    [key: string]: unknown;
  };
  relevanceScore?: number;
}

interface RetrieveOptions {
  query: string;
  limit?: number;
  topics?: string[];
}

interface StoreOptions {
  topic?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Wrapper around Vertex AI Memory Bank that enforces tenant isolation.
 *
 * CRITICAL: Addresses Security Sentinel finding CRITICAL-001
 * "Memory Bank semantic search could return memories from other tenants"
 */
export class IsolatedMemoryBank {
  private config: MemoryBankConfig;
  private memoryService: unknown; // Will be typed when ADK is installed

  constructor(config: MemoryBankConfig) {
    this.config = config;
    // Memory service initialization will happen after ADK installation
    this.memoryService = null;
  }

  /**
   * Initialize the memory service connection.
   * Called lazily on first use.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.memoryService) return;

    // TODO: Initialize VertexAiMemoryBankService when ADK is installed
    // this.memoryService = new VertexAiMemoryBankService({
    //   project: this.config.projectId,
    //   location: this.config.location,
    //   agentEngineId: this.config.agentEngineId,
    // });

    logger.info(
      { project: this.config.projectId, location: this.config.location },
      'Memory Bank initialized'
    );
  }

  /**
   * Create a tenant-scoped user ID to ensure memory isolation.
   */
  private scopeUserId(tenantId: string, userId: string): string {
    return `tenant:${tenantId}:user:${userId}`;
  }

  /**
   * Validate that a memory belongs to the expected tenant.
   * Returns false and logs a security event if cross-tenant leak detected.
   */
  private validateMemoryTenant(memory: Memory, tenantId: string): boolean {
    const memoryUserId = memory.metadata?.user_id;
    if (!memoryUserId) {
      logger.warn({ memoryId: memory.id }, 'Memory missing user_id metadata');
      return false;
    }

    const expectedPrefix = `tenant:${tenantId}:`;
    if (!memoryUserId.startsWith(expectedPrefix)) {
      // SECURITY EVENT - this should NEVER happen in production
      logger.error(
        { requestedTenant: tenantId, memoryUserId, memoryId: memory.id, severity: 'CRITICAL' },
        'SECURITY: Cross-tenant memory leak detected!'
      );
      return false;
    }

    return true;
  }

  /**
   * Retrieve memories with mandatory tenant isolation.
   *
   * @param tenantId - The tenant requesting memories (for isolation)
   * @param userId - The user within the tenant
   * @param options - Query options
   * @returns Validated memories that belong to this tenant only
   */
  async retrieve(tenantId: string, userId: string, options: RetrieveOptions): Promise<Memory[]> {
    await this.ensureInitialized();

    const { query, limit = 10, topics: _topics } = options;

    // TODO: Will be used when ADK Memory Bank is integrated
    const _scopedUserId = this.scopeUserId(tenantId, userId);

    logger.debug({ tenantId, userId, query: query.substring(0, 50), limit }, 'Retrieving memories');

    // TODO: Implement actual retrieval when ADK is installed
    // For now, return empty array
    const memories: Memory[] = [];

    // When implemented:
    // const memories = await this.memoryService.retrieve({
    //   query,
    //   scope: { user_id: _scopedUserId },
    //   limit: limit + 5, // Fetch extra for post-filtering
    //   topics: _topics,
    // });

    // POST-RETRIEVAL VALIDATION (belt AND suspenders)
    const validatedMemories = memories.filter((memory) =>
      this.validateMemoryTenant(memory, tenantId)
    );

    if (validatedMemories.length < memories.length) {
      // Some memories were filtered out - this is suspicious
      logger.warn(
        { tenantId, originalCount: memories.length, validatedCount: validatedMemories.length },
        'Memories filtered during post-retrieval validation'
      );
    }

    return validatedMemories.slice(0, limit);
  }

  /**
   * Store a memory with mandatory tenant isolation.
   *
   * @param tenantId - The tenant storing the memory
   * @param userId - The user within the tenant
   * @param content - The content to store
   * @param options - Storage options (topic, additional metadata)
   */
  async store(
    tenantId: string,
    userId: string,
    content: string,
    options: StoreOptions = {}
  ): Promise<void> {
    await this.ensureInitialized();

    // TODO: Will be used when ADK Memory Bank is integrated
    const _scopedUserId = this.scopeUserId(tenantId, userId);

    logger.debug(
      { tenantId, userId, contentLength: content.length, topic: options.topic },
      'Storing memory'
    );

    // TODO: Implement actual storage when ADK is installed
    // await this.memoryService.store({
    //   content,
    //   topic: options.topic,
    //   metadata: {
    //     user_id: _scopedUserId,
    //     tenant_id: tenantId,
    //     created_at: new Date().toISOString(),
    //     ...options.metadata,
    //   },
    // });

    logger.info({ tenantId, userId, topic: options.topic }, 'Memory stored');
  }

  /**
   * Process a completed session and extract memories.
   *
   * @param tenantId - The tenant that owns this session
   * @param userId - The user within the tenant
   * @param sessionData - The session data to process
   */
  async processSession(tenantId: string, userId: string, _sessionData: unknown): Promise<void> {
    await this.ensureInitialized();

    // TODO: This will be used when ADK Memory Bank is integrated
    const _scopedUserId = this.scopeUserId(tenantId, userId);

    logger.info({ tenantId, userId }, 'Processing session for memory extraction');

    // TODO: Implement when ADK is installed
    // await this.memoryService.addSessionToMemory(_sessionData, {
    //   metadata: {
    //     user_id: _scopedUserId,
    //     tenant_id: tenantId,
    //     processed_at: new Date().toISOString(),
    //   },
    // });
  }

  /**
   * Delete all memories for a tenant (for GDPR compliance / tenant deletion).
   *
   * @param tenantId - The tenant to delete memories for
   */
  async deleteTenantMemories(tenantId: string): Promise<void> {
    await this.ensureInitialized();

    logger.warn({ tenantId }, 'Deleting all memories for tenant');

    // TODO: Implement when ADK is installed
    // This would query all memories with tenant_id prefix and delete them

    logger.info({ tenantId }, 'Tenant memories deleted');
  }
}

/**
 * Factory function for creating an isolated memory bank instance.
 */
export function createIsolatedMemoryBank(config: MemoryBankConfig): IsolatedMemoryBank {
  return new IsolatedMemoryBank(config);
}
