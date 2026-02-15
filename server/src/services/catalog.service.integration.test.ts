/**
 * Catalog Service Integration Tests - Sprint 2.1
 * Tests actual database writes for audit logging
 * Verifies both "with audit context" and "without audit context" flows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { CatalogService } from './catalog.service';
import { AuditService } from './audit.service';
import { PrismaCatalogRepository } from '../adapters/prisma/catalog.repository';
import { createTestSegment } from '../../test/helpers/integration-setup';

// Prisma 7: Use driver adapter for PostgreSQL connections
const adapter = process.env.DATABASE_URL
  ? new PrismaPg({ connectionString: process.env.DATABASE_URL })
  : undefined;
const prisma = new PrismaClient({ adapter });

describe('CatalogService Integration - Audit Logging', () => {
  const testTenantId = 'test_tenant_integration';
  let catalogService: CatalogService;
  let auditService: AuditService;
  let testSegmentId: string;

  beforeEach(async () => {
    // Create test tenant
    await prisma.tenant.upsert({
      where: { id: testTenantId },
      update: {},
      create: {
        id: testTenantId,
        slug: 'test-tenant-integration',
        name: 'Test Tenant Integration',
        email: 'test@integration.com',
        passwordHash: 'dummy',
        apiKeyPublic: 'pk_test_integration',
        apiKeySecret: 'sk_test_integration',
        commissionPercent: 10,
      },
    });

    const segment = await createTestSegment(prisma, testTenantId);
    testSegmentId = segment.id;

    const catalogRepo = new PrismaCatalogRepository(prisma);
    auditService = new AuditService({ prisma });
    catalogService = new CatalogService(catalogRepo, undefined, auditService);
  });

  afterEach(async () => {
    // Clean up audit logs
    await prisma.configChangeLog.deleteMany({
      where: { tenantId: testTenantId },
    });

    // Clean up tiers
    await prisma.tier.deleteMany({
      where: { tenantId: testTenantId },
    });

    // Clean up segments
    await prisma.segment.deleteMany({
      where: { tenantId: testTenantId },
    });
  });

  describe('createTier', () => {
    it('should create tier AND audit log when audit context provided', async () => {
      const auditCtx = {
        email: 'admin@test.com',
        role: 'TENANT_ADMIN' as const,
        userId: 'user_123',
      };

      const result = await catalogService.createTier(
        testTenantId,
        {
          slug: 'test-pkg-1',
          title: 'Test Tier 1',
          description: 'Test description',
          priceCents: 10000,
          segmentId: testSegmentId,
        },
        auditCtx
      );

      expect(result.id).toBeDefined();

      // Verify audit log was created
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Tier',
          entityId: result.id,
        },
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].changeType).toBe('package_crud');
      expect(auditLogs[0].operation).toBe('create');
      expect(auditLogs[0].email).toBe('admin@test.com');
      expect(auditLogs[0].role).toBe('TENANT_ADMIN');
      expect(auditLogs[0].beforeSnapshot).toBeNull();
      expect(auditLogs[0].afterSnapshot).toMatchObject({
        slug: 'test-pkg-1',
        title: 'Test Tier 1',
        priceCents: 10000,
      });
    });

    it('should create tier WITHOUT audit log when audit context missing', async () => {
      const result = await catalogService.createTier(testTenantId, {
        slug: 'test-pkg-no-audit',
        title: 'Test Tier No Audit',
        description: 'Test description',
        priceCents: 10000,
        segmentId: testSegmentId,
      });

      expect(result.id).toBeDefined();

      // Verify NO audit log was created
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Tier',
          entityId: result.id,
        },
      });

      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('updateTier', () => {
    it('should update tier AND audit log with before/after snapshots', async () => {
      // Create tier first
      const pkg = await catalogService.createTier(testTenantId, {
        slug: 'test-pkg-update',
        title: 'Original Title',
        description: 'Original description',
        priceCents: 10000,
        segmentId: testSegmentId,
      });

      // Update with audit context
      const auditCtx = {
        email: 'admin@test.com',
        role: 'TENANT_ADMIN' as const,
        userId: 'user_123',
      };

      const updated = await catalogService.updateTier(
        testTenantId,
        pkg.id,
        {
          title: 'Updated Title',
          priceCents: 12000,
        },
        auditCtx
      );

      expect(updated.title).toBe('Updated Title');
      expect(updated.priceCents).toBe(12000);

      // Verify audit log
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Tier',
          entityId: pkg.id,
          operation: 'update',
        },
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].beforeSnapshot).toMatchObject({
        title: 'Original Title',
        priceCents: 10000,
      });
      expect(auditLogs[0].afterSnapshot).toMatchObject({
        title: 'Updated Title',
        priceCents: 12000,
      });
    });

    it('should update tier WITHOUT audit log when context missing', async () => {
      // Create tier
      const pkg = await catalogService.createTier(testTenantId, {
        slug: 'test-pkg-update-no-audit',
        title: 'Original Title',
        description: 'Original description',
        priceCents: 10000,
        segmentId: testSegmentId,
      });

      // Update WITHOUT audit context
      await catalogService.updateTier(testTenantId, pkg.id, {
        title: 'Updated Title No Audit',
        priceCents: 12000,
      });

      // Verify NO update audit log
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Tier',
          entityId: pkg.id,
          operation: 'update',
        },
      });

      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('deleteTier', () => {
    it('should delete tier AND audit log with beforeSnapshot', async () => {
      // Create tier
      const pkg = await catalogService.createTier(testTenantId, {
        slug: 'test-pkg-delete',
        title: 'Tier to Delete',
        description: 'Will be deleted',
        priceCents: 10000,
        segmentId: testSegmentId,
      });

      // Delete with audit context
      const auditCtx = {
        email: 'admin@test.com',
        role: 'TENANT_ADMIN' as const,
        userId: 'user_123',
      };

      await catalogService.deleteTier(testTenantId, pkg.id, auditCtx);

      // Verify tier deleted
      const deletedPkg = await prisma.tier.findUnique({
        where: { id: pkg.id },
      });
      expect(deletedPkg).toBeNull();

      // Verify audit log
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Tier',
          entityId: pkg.id,
          operation: 'delete',
        },
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].beforeSnapshot).toMatchObject({
        slug: 'test-pkg-delete',
        title: 'Tier to Delete',
        priceCents: 10000,
      });
      expect(auditLogs[0].afterSnapshot).toBeNull();
    });

    it('should delete tier WITHOUT audit log when context missing', async () => {
      // Create tier
      const pkg = await catalogService.createTier(testTenantId, {
        slug: 'test-pkg-delete-no-audit',
        title: 'Tier to Delete No Audit',
        description: 'Will be deleted',
        priceCents: 10000,
        segmentId: testSegmentId,
      });

      // Delete WITHOUT audit context
      await catalogService.deleteTier(testTenantId, pkg.id);

      // Verify tier deleted
      const deletedPkg = await prisma.tier.findUnique({
        where: { id: pkg.id },
      });
      expect(deletedPkg).toBeNull();

      // Verify NO delete audit log
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Tier',
          entityId: pkg.id,
          operation: 'delete',
        },
      });

      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('Tenant Isolation', () => {
    const otherTenantId = 'test_tenant_other';
    let otherSegmentId: string;

    beforeEach(async () => {
      // Create second tenant
      await prisma.tenant.upsert({
        where: { id: otherTenantId },
        update: {},
        create: {
          id: otherTenantId,
          slug: 'other-tenant',
          name: 'Other Tenant',
          email: 'other@test.com',
          passwordHash: 'dummy',
          apiKeyPublic: 'pk_test_other',
          apiKeySecret: 'sk_test_other',
          commissionPercent: 10,
        },
      });

      const otherSegment = await createTestSegment(prisma, otherTenantId);
      otherSegmentId = otherSegment.id;
    });

    afterEach(async () => {
      await prisma.configChangeLog.deleteMany({
        where: { tenantId: otherTenantId },
      });
      await prisma.tier.deleteMany({
        where: { tenantId: otherTenantId },
      });
      await prisma.segment.deleteMany({
        where: { tenantId: otherTenantId },
      });
      await prisma.tenant.delete({
        where: { id: otherTenantId },
      });
    });

    it('should not see other tenant audit logs', async () => {
      const auditCtx = {
        email: 'admin@test.com',
        role: 'TENANT_ADMIN' as const,
        userId: 'user_123',
      };

      // Create tier for tenant 1
      await catalogService.createTier(
        testTenantId,
        {
          slug: 'pkg-tenant1',
          title: 'Tenant 1 Tier',
          description: 'Test',
          priceCents: 10000,
          segmentId: testSegmentId,
        },
        auditCtx
      );

      // Create tier for tenant 2
      await catalogService.createTier(
        otherTenantId,
        {
          slug: 'pkg-tenant2',
          title: 'Tenant 2 Tier',
          description: 'Test',
          priceCents: 10000,
          segmentId: otherSegmentId,
        },
        auditCtx
      );

      // Verify tenant 1 only sees their logs
      const tenant1Logs = await prisma.configChangeLog.findMany({
        where: { tenantId: testTenantId },
      });
      expect(tenant1Logs).toHaveLength(1);

      // Verify tenant 2 only sees their logs
      const tenant2Logs = await prisma.configChangeLog.findMany({
        where: { tenantId: otherTenantId },
      });
      expect(tenant2Logs).toHaveLength(1);

      // Verify logs are isolated
      expect(tenant1Logs[0].tenantId).toBe(testTenantId);
      expect(tenant2Logs[0].tenantId).toBe(otherTenantId);
    });
  });

  describe('getEntityHistory', () => {
    it('should return full audit history for entity', async () => {
      const auditCtx = {
        email: 'admin@test.com',
        role: 'TENANT_ADMIN' as const,
        userId: 'user_123',
      };

      // Create tier
      const pkg = await catalogService.createTier(
        testTenantId,
        {
          slug: 'history-pkg',
          title: 'History Test',
          description: 'Test',
          priceCents: 10000,
          segmentId: testSegmentId,
        },
        auditCtx
      );

      // Update multiple times
      await catalogService.updateTier(testTenantId, pkg.id, { priceCents: 11000 }, auditCtx);
      await catalogService.updateTier(testTenantId, pkg.id, { priceCents: 12000 }, auditCtx);

      // Get history
      const history = await auditService.getEntityHistory(testTenantId, 'Tier', pkg.id);

      // Should have 3 entries (create + 2 updates)
      expect(history).toHaveLength(3);
      expect(history[0].operation).toBe('update'); // Most recent first
      expect(history[1].operation).toBe('update');
      expect(history[2].operation).toBe('create'); // Oldest last
    });
  });
});
