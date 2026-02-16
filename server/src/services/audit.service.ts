/**
 * Audit Service - Sprint 2.1
 *
 * Tracks all configuration changes and legacy CRUD operations during migration.
 * Provides full audit trail with before/after snapshots for rollback capability.
 *
 * Usage:
 * - trackChange() - For new config system (ConfigVersion, AgentProposal)
 * - trackLegacyChange() - For legacy CRUD during migration (Tier, Tenant, BlackoutDate)
 */

import { Prisma, type PrismaClient } from '../generated/prisma/client';

export interface AuditServiceDeps {
  prisma: PrismaClient;
}

/**
 * Input for tracking config system changes (new architecture)
 */
export interface TrackChangeInput {
  tenantId: string;
  changeType: 'config_version' | 'agent_proposal';
  operation: 'create' | 'update' | 'delete' | 'publish' | 'approve' | 'reject';
  entityType: 'ConfigVersion' | 'AgentProposal';
  entityId: string;

  // Attribution (who made the change)
  userId?: string; // For admin actions
  agentId?: string; // For agent actions
  email: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'AGENT';

  // Change data (full snapshots for rollback)
  beforeSnapshot?: unknown; // null for creates
  afterSnapshot: unknown;

  // Metadata
  reason?: string; // Optional reason for change
  metadata?: Record<string, unknown>; // IP, user agent, session ID, etc.
}

/**
 * Input for tracking legacy CRUD operations during migration
 */
export interface TrackLegacyChangeInput {
  tenantId: string;
  changeType: 'package_crud' | 'branding_update' | 'blackout_change';
  operation: 'create' | 'update' | 'delete';
  entityType: 'Tier' | 'Tenant' | 'BlackoutDate';
  entityId: string;

  // Attribution (who made the change)
  userId?: string;
  email: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';

  // Change data (full snapshots for rollback)
  beforeSnapshot?: unknown; // null for creates
  afterSnapshot: unknown;

  // Metadata
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit log entry returned from queries
 */
export interface AuditLogEntry {
  id: string;
  operation: string;
  email: string;
  role: string;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  reason: string | null;
  createdAt: Date;
}

/**
 * Timeline entry for tenant audit log
 */
export interface TimelineEntry {
  id: string;
  changeType: string;
  operation: string;
  entityType: string;
  entityId: string;
  email: string;
  role: string;
  reason: string | null;
  createdAt: Date;
}

export class AuditService {
  private readonly prisma: PrismaClient;

  constructor(deps: AuditServiceDeps) {
    this.prisma = deps.prisma;
  }

  /**
   * Track config system changes (ConfigVersion, AgentProposal)
   *
   * Used for new config-driven architecture. All agent and admin config
   * mutations must be logged with full before/after snapshots.
   *
   * @example
   * await auditService.trackChange({
   *   tenantId: 'tenant_123',
   *   changeType: 'config_version',
   *   operation: 'publish',
   *   entityType: 'ConfigVersion',
   *   entityId: 'version_456',
   *   userId: 'user_789',
   *   email: 'admin@example.com',
   *   role: 'TENANT_ADMIN',
   *   beforeSnapshot: { status: 'draft', branding: {...} },
   *   afterSnapshot: { status: 'published', branding: {...} },
   *   reason: 'Seasonal branding update for winter',
   * });
   */
  async trackChange(input: TrackChangeInput): Promise<void> {
    await this.prisma.configChangeLog.create({
      data: {
        tenantId: input.tenantId,
        changeType: input.changeType,
        operation: input.operation,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? null,
        agentId: input.agentId ?? null,
        email: input.email,
        role: input.role,
        beforeSnapshot:
          input.beforeSnapshot !== undefined && input.beforeSnapshot !== null
            ? (input.beforeSnapshot as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        afterSnapshot:
          input.afterSnapshot !== undefined && input.afterSnapshot !== null
            ? (input.afterSnapshot as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        reason: input.reason ?? null,
        metadata:
          input.metadata !== undefined && input.metadata !== null
            ? (input.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
  }

  /**
   * Track legacy CRUD operations during migration period
   *
   * Used for Tier, Tenant.branding, BlackoutDate changes while both
   * old and new systems are active. Once fully migrated, these operations
   * should use trackChange() instead.
   *
   * Double-logging during migration ensures we don't lose auditability.
   *
   * @example
   * await auditService.trackLegacyChange({
   *   tenantId: 'tenant_123',
   *   changeType: 'package_crud',
   *   operation: 'update',
   *   entityType: 'Tier',
   *   entityId: 'tier_456',
   *   userId: 'user_789',
   *   email: 'admin@example.com',
   *   role: 'TENANT_ADMIN',
   *   beforeSnapshot: { name: 'Basic Tier', basePrice: 10000 },
   *   afterSnapshot: { name: 'Basic Tier', basePrice: 12000 },
   *   reason: 'Price increase for 2025',
   * });
   */
  async trackLegacyChange(input: TrackLegacyChangeInput): Promise<void> {
    await this.prisma.configChangeLog.create({
      data: {
        tenantId: input.tenantId,
        changeType: input.changeType,
        operation: input.operation,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId ?? null,
        agentId: null, // Legacy operations don't have agents
        email: input.email,
        role: input.role,
        beforeSnapshot:
          input.beforeSnapshot !== undefined && input.beforeSnapshot !== null
            ? (input.beforeSnapshot as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        afterSnapshot:
          input.afterSnapshot !== undefined && input.afterSnapshot !== null
            ? (input.afterSnapshot as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        reason: input.reason ?? null,
        metadata:
          input.metadata !== undefined && input.metadata !== null
            ? (input.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
  }

  /**
   * Get complete audit trail for a specific entity
   *
   * Returns all changes to an entity ordered by recency (newest first).
   * Useful for displaying change history and enabling rollback.
   *
   * @param tenantId - Tenant ID
   * @param entityType - Type of entity (Package, ConfigVersion, etc.)
   * @param entityId - Entity ID
   * @returns Array of audit log entries with full snapshots
   */
  async getEntityHistory(
    tenantId: string,
    entityType: string,
    entityId: string,
    options?: { take?: number }
  ): Promise<AuditLogEntry[]> {
    const logs = await this.prisma.configChangeLog.findMany({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      take: Math.min(options?.take ?? 100, 500),
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        operation: true,
        email: true,
        role: true,
        beforeSnapshot: true,
        afterSnapshot: true,
        reason: true,
        createdAt: true,
      },
    });

    return logs;
  }

  /**
   * Get latest snapshot for rollback
   *
   * Returns the most recent state of an entity from audit log.
   * Used for restoring entity to previous version.
   *
   * @param tenantId - Tenant ID
   * @param entityType - Type of entity
   * @param entityId - Entity ID
   * @returns Latest snapshot or null if no history
   */
  async getLatestSnapshot(
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<unknown | null> {
    const latest = await this.prisma.configChangeLog.findFirst({
      where: {
        tenantId,
        entityType,
        entityId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        afterSnapshot: true,
      },
    });

    return latest?.afterSnapshot ?? null;
  }

  /**
   * Get audit timeline for tenant (paginated)
   *
   * Returns all audit events for a tenant, optionally filtered by change type.
   * Useful for displaying admin dashboard audit log.
   *
   * @param tenantId - Tenant ID
   * @param options - Optional filters and pagination
   * @param options.changeType - Filter by change type (e.g., 'config_version')
   * @param options.limit - Number of entries to return (default: 50)
   * @param options.offset - Offset for pagination (default: 0)
   * @returns Array of timeline entries (without full snapshots for performance)
   */
  async getTenantAuditLog(
    tenantId: string,
    options?: {
      changeType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<TimelineEntry[]> {
    const logs = await this.prisma.configChangeLog.findMany({
      where: {
        tenantId,
        ...(options?.changeType && { changeType: options.changeType }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(options?.limit ?? 50, 500),
      skip: options?.offset ?? 0,
      select: {
        id: true,
        changeType: true,
        operation: true,
        entityType: true,
        entityId: true,
        email: true,
        role: true,
        reason: true,
        createdAt: true,
      },
    });

    return logs;
  }
}
