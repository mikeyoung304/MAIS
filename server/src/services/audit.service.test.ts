/**
 * AuditService Unit Tests - Sprint 2.1
 * Target: 70% branch coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditService } from './audit.service';
import { Prisma, type PrismaClient } from '../generated/prisma/client';

// Mock Prisma Client
const mockPrisma = {
  configChangeLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
} as unknown as PrismaClient;

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService({ prisma: mockPrisma });
    vi.clearAllMocks();
  });

  describe('trackChange', () => {
    it('should create audit log for config version change with all fields', async () => {
      const input = {
        tenantId: 'tenant_123',
        changeType: 'config_version' as const,
        operation: 'publish' as const,
        entityType: 'ConfigVersion' as const,
        entityId: 'version_456',
        userId: 'user_789',
        agentId: 'agent_abc',
        email: 'admin@example.com',
        role: 'TENANT_ADMIN' as const,
        beforeSnapshot: { status: 'draft' },
        afterSnapshot: { status: 'published' },
        reason: 'Seasonal update',
        metadata: { ip: '192.168.1.1', userAgent: 'Mozilla/5.0' },
      };

      (mockPrisma.configChangeLog.create as any).mockResolvedValue({ id: 'log_123' });

      await auditService.trackChange(input);

      expect(mockPrisma.configChangeLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: input.tenantId,
          changeType: input.changeType,
          operation: input.operation,
          entityType: input.entityType,
          entityId: input.entityId,
          userId: input.userId,
          agentId: input.agentId,
          email: input.email,
          role: input.role,
          beforeSnapshot: input.beforeSnapshot,
          afterSnapshot: input.afterSnapshot,
          reason: input.reason,
          metadata: input.metadata,
        },
      });
    });

    it('should create audit log with minimal fields (null userId/agentId)', async () => {
      const input = {
        tenantId: 'tenant_123',
        changeType: 'config_version' as const,
        operation: 'create' as const,
        entityType: 'ConfigVersion' as const,
        entityId: 'version_456',
        email: 'admin@example.com',
        role: 'TENANT_ADMIN' as const,
        afterSnapshot: { status: 'draft' },
      };

      (mockPrisma.configChangeLog.create as any).mockResolvedValue({ id: 'log_123' });

      await auditService.trackChange(input);

      expect(mockPrisma.configChangeLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: input.tenantId,
          changeType: input.changeType,
          operation: input.operation,
          entityType: input.entityType,
          entityId: input.entityId,
          userId: null, // Should default to null
          agentId: null, // Should default to null
          email: input.email,
          role: input.role,
          beforeSnapshot: Prisma.JsonNull, // Not provided - uses JsonNull
          afterSnapshot: input.afterSnapshot,
          reason: null, // Not provided
          metadata: Prisma.JsonNull, // Not provided - uses JsonNull
        },
      });
    });

    it('should handle agent proposal changes', async () => {
      const input = {
        tenantId: 'tenant_123',
        changeType: 'agent_proposal' as const,
        operation: 'approve' as const,
        entityType: 'AgentProposal' as const,
        entityId: 'proposal_789',
        userId: 'user_456',
        email: 'admin@example.com',
        role: 'TENANT_ADMIN' as const,
        beforeSnapshot: { status: 'pending' },
        afterSnapshot: { status: 'approved' },
      };

      (mockPrisma.configChangeLog.create as any).mockResolvedValue({ id: 'log_123' });

      await auditService.trackChange(input);

      expect(mockPrisma.configChangeLog.create).toHaveBeenCalled();
    });
  });

  describe('trackLegacyChange', () => {
    it('should create audit log for package CRUD', async () => {
      const input = {
        tenantId: 'tenant_123',
        changeType: 'package_crud' as const,
        operation: 'update' as const,
        entityType: 'Package' as const,
        entityId: 'pkg_456',
        userId: 'user_789',
        email: 'admin@example.com',
        role: 'TENANT_ADMIN' as const,
        beforeSnapshot: { name: 'Basic Package', basePrice: 10000 },
        afterSnapshot: { name: 'Basic Package', basePrice: 12000 },
        reason: 'Price increase',
      };

      (mockPrisma.configChangeLog.create as any).mockResolvedValue({ id: 'log_123' });

      await auditService.trackLegacyChange(input);

      expect(mockPrisma.configChangeLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: input.tenantId,
          changeType: input.changeType,
          operation: input.operation,
          entityType: input.entityType,
          entityId: input.entityId,
          userId: input.userId,
          agentId: null, // Legacy operations don't have agents
          email: input.email,
          role: input.role,
          beforeSnapshot: input.beforeSnapshot,
          afterSnapshot: input.afterSnapshot,
          reason: input.reason,
          metadata: Prisma.JsonNull, // Uses JsonNull for null metadata
        },
      });
    });

    it('should create audit log for branding update', async () => {
      const input = {
        tenantId: 'tenant_123',
        changeType: 'branding_update' as const,
        operation: 'update' as const,
        entityType: 'Tenant' as const,
        entityId: 'tenant_123',
        email: 'admin@example.com',
        role: 'TENANT_ADMIN' as const,
        beforeSnapshot: { primaryColor: '#000000' },
        afterSnapshot: { primaryColor: '#FF0000' },
      };

      (mockPrisma.configChangeLog.create as any).mockResolvedValue({ id: 'log_123' });

      await auditService.trackLegacyChange(input);

      expect(mockPrisma.configChangeLog.create).toHaveBeenCalled();
    });

    it('should create audit log for blackout change', async () => {
      const input = {
        tenantId: 'tenant_123',
        changeType: 'blackout_change' as const,
        operation: 'delete' as const,
        entityType: 'BlackoutDate' as const,
        entityId: 'blackout_456',
        email: 'admin@example.com',
        role: 'TENANT_ADMIN' as const,
        beforeSnapshot: { date: '2025-12-25', reason: 'Holiday' },
        afterSnapshot: null,
      };

      (mockPrisma.configChangeLog.create as any).mockResolvedValue({ id: 'log_123' });

      await auditService.trackLegacyChange(input);

      expect(mockPrisma.configChangeLog.create).toHaveBeenCalled();
    });

    it('should handle null beforeSnapshot for creates', async () => {
      const input = {
        tenantId: 'tenant_123',
        changeType: 'package_crud' as const,
        operation: 'create' as const,
        entityType: 'Package' as const,
        entityId: 'pkg_new',
        email: 'admin@example.com',
        role: 'TENANT_ADMIN' as const,
        beforeSnapshot: null,
        afterSnapshot: { name: 'New Package', basePrice: 10000 },
      };

      (mockPrisma.configChangeLog.create as any).mockResolvedValue({ id: 'log_123' });

      await auditService.trackLegacyChange(input);

      const call = (mockPrisma.configChangeLog.create as any).mock.calls[0][0];
      // Null values are converted to Prisma.JsonNull for JSON fields
      expect(call.data.beforeSnapshot).toEqual(Prisma.JsonNull);
      expect(call.data.afterSnapshot).toBeDefined();
    });

    it('should handle null afterSnapshot for deletes', async () => {
      const input = {
        tenantId: 'tenant_123',
        changeType: 'package_crud' as const,
        operation: 'delete' as const,
        entityType: 'Package' as const,
        entityId: 'pkg_deleted',
        email: 'admin@example.com',
        role: 'TENANT_ADMIN' as const,
        beforeSnapshot: { name: 'Deleted Package', basePrice: 10000 },
        afterSnapshot: null,
      };

      (mockPrisma.configChangeLog.create as any).mockResolvedValue({ id: 'log_123' });

      await auditService.trackLegacyChange(input);

      const call = (mockPrisma.configChangeLog.create as any).mock.calls[0][0];
      expect(call.data.beforeSnapshot).toBeDefined();
      // Null values are converted to Prisma.JsonNull for JSON fields
      expect(call.data.afterSnapshot).toEqual(Prisma.JsonNull);
    });
  });

  describe('getEntityHistory', () => {
    it('should return all changes for entity ordered by recency', async () => {
      const mockLogs = [
        {
          id: 'log_2',
          operation: 'update',
          email: 'admin@example.com',
          role: 'TENANT_ADMIN',
          beforeSnapshot: { basePrice: 10000 },
          afterSnapshot: { basePrice: 12000 },
          reason: 'Price increase',
          createdAt: new Date('2025-01-10'),
        },
        {
          id: 'log_1',
          operation: 'create',
          email: 'admin@example.com',
          role: 'TENANT_ADMIN',
          beforeSnapshot: null,
          afterSnapshot: { basePrice: 10000 },
          reason: null,
          createdAt: new Date('2025-01-01'),
        },
      ];

      (mockPrisma.configChangeLog.findMany as any).mockResolvedValue(mockLogs);

      const history = await auditService.getEntityHistory('tenant_123', 'Package', 'pkg_456');

      expect(mockPrisma.configChangeLog.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant_123',
          entityType: 'Package',
          entityId: 'pkg_456',
        },
        take: 100,
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
      expect(history).toEqual(mockLogs);
    });

    it('should filter by tenantId', async () => {
      (mockPrisma.configChangeLog.findMany as any).mockResolvedValue([]);

      await auditService.getEntityHistory('tenant_123', 'Package', 'pkg_456');

      const call = (mockPrisma.configChangeLog.findMany as any).mock.calls[0][0];
      expect(call.where.tenantId).toBe('tenant_123');
    });

    it('should filter by entityType and entityId', async () => {
      (mockPrisma.configChangeLog.findMany as any).mockResolvedValue([]);

      await auditService.getEntityHistory('tenant_123', 'Package', 'pkg_456');

      const call = (mockPrisma.configChangeLog.findMany as any).mock.calls[0][0];
      expect(call.where.entityType).toBe('Package');
      expect(call.where.entityId).toBe('pkg_456');
    });

    it('should return empty array if no history', async () => {
      (mockPrisma.configChangeLog.findMany as any).mockResolvedValue([]);

      const history = await auditService.getEntityHistory(
        'tenant_123',
        'Package',
        'pkg_nonexistent'
      );

      expect(history).toEqual([]);
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return most recent afterSnapshot', async () => {
      const mockLog = {
        afterSnapshot: { name: 'Updated Package', basePrice: 12000 },
      };

      (mockPrisma.configChangeLog.findFirst as any).mockResolvedValue(mockLog);

      const snapshot = await auditService.getLatestSnapshot('tenant_123', 'Package', 'pkg_456');

      expect(mockPrisma.configChangeLog.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant_123',
          entityType: 'Package',
          entityId: 'pkg_456',
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          afterSnapshot: true,
        },
      });
      expect(snapshot).toEqual({ name: 'Updated Package', basePrice: 12000 });
    });

    it('should return null if no history', async () => {
      (mockPrisma.configChangeLog.findFirst as any).mockResolvedValue(null);

      const snapshot = await auditService.getLatestSnapshot(
        'tenant_123',
        'Package',
        'pkg_nonexistent'
      );

      expect(snapshot).toBeNull();
    });
  });

  describe('getTenantAuditLog', () => {
    it('should return paginated audit log', async () => {
      const mockLogs = [
        {
          id: 'log_1',
          changeType: 'package_crud',
          operation: 'create',
          entityType: 'Package',
          entityId: 'pkg_1',
          email: 'admin@example.com',
          role: 'TENANT_ADMIN',
          reason: null,
          createdAt: new Date(),
        },
      ];

      (mockPrisma.configChangeLog.findMany as any).mockResolvedValue(mockLogs);

      const timeline = await auditService.getTenantAuditLog('tenant_123');

      expect(mockPrisma.configChangeLog.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant_123',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // Default limit
        skip: 0, // Default offset
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
      expect(timeline).toEqual(mockLogs);
    });

    it('should filter by changeType if provided', async () => {
      (mockPrisma.configChangeLog.findMany as any).mockResolvedValue([]);

      await auditService.getTenantAuditLog('tenant_123', { changeType: 'package_crud' });

      const call = (mockPrisma.configChangeLog.findMany as any).mock.calls[0][0];
      expect(call.where.changeType).toBe('package_crud');
    });

    it('should respect limit parameter', async () => {
      (mockPrisma.configChangeLog.findMany as any).mockResolvedValue([]);

      await auditService.getTenantAuditLog('tenant_123', { limit: 100 });

      const call = (mockPrisma.configChangeLog.findMany as any).mock.calls[0][0];
      expect(call.take).toBe(100);
    });

    it('should respect offset parameter', async () => {
      (mockPrisma.configChangeLog.findMany as any).mockResolvedValue([]);

      await auditService.getTenantAuditLog('tenant_123', { offset: 50 });

      const call = (mockPrisma.configChangeLog.findMany as any).mock.calls[0][0];
      expect(call.skip).toBe(50);
    });

    it('should default to 50 entries', async () => {
      (mockPrisma.configChangeLog.findMany as any).mockResolvedValue([]);

      await auditService.getTenantAuditLog('tenant_123');

      const call = (mockPrisma.configChangeLog.findMany as any).mock.calls[0][0];
      expect(call.take).toBe(50);
    });
  });
});
