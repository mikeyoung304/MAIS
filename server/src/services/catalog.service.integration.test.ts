/**
 * Catalog Service Integration Tests - Sprint 2.1
 * Tests actual database writes for audit logging
 * Verifies both "with audit context" and "without audit context" flows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { CatalogService } from './catalog.service';
import { AuditService } from './audit.service';
import { PrismaCatalogRepository } from '../adapters/prisma/catalog.repository';

// Prisma 7: Use driver adapter for PostgreSQL connections
const adapter = process.env.DATABASE_URL
  ? new PrismaPg({ connectionString: process.env.DATABASE_URL })
  : undefined;
const prisma = new PrismaClient({ adapter });

describe('CatalogService Integration - Audit Logging', () => {
  const testTenantId = 'test_tenant_integration';
  let catalogService: CatalogService;
  let auditService: AuditService;

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

    const catalogRepo = new PrismaCatalogRepository(prisma);
    auditService = new AuditService({ prisma });
    catalogService = new CatalogService(catalogRepo, undefined, auditService);
  });

  afterEach(async () => {
    // Clean up audit logs
    await prisma.configChangeLog.deleteMany({
      where: { tenantId: testTenantId },
    });

    // Clean up packages
    await prisma.package.deleteMany({
      where: { tenantId: testTenantId },
    });
  });

  describe('createPackage', () => {
    it('should create package AND audit log when audit context provided', async () => {
      const auditCtx = {
        email: 'admin@test.com',
        role: 'TENANT_ADMIN' as const,
        userId: 'user_123',
      };

      const result = await catalogService.createPackage(
        testTenantId,
        {
          slug: 'test-pkg-1',
          title: 'Test Package 1',
          description: 'Test description',
          priceCents: 10000,
        },
        auditCtx
      );

      expect(result.id).toBeDefined();

      // Verify audit log was created
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Package',
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
        title: 'Test Package 1',
        priceCents: 10000,
      });
    });

    it('should create package WITHOUT audit log when audit context missing', async () => {
      const result = await catalogService.createPackage(testTenantId, {
        slug: 'test-pkg-no-audit',
        title: 'Test Package No Audit',
        description: 'Test description',
        priceCents: 10000,
      });

      expect(result.id).toBeDefined();

      // Verify NO audit log was created
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Package',
          entityId: result.id,
        },
      });

      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('updatePackage', () => {
    it('should update package AND audit log with before/after snapshots', async () => {
      // Create package first
      const pkg = await catalogService.createPackage(testTenantId, {
        slug: 'test-pkg-update',
        title: 'Original Title',
        description: 'Original description',
        priceCents: 10000,
      });

      // Update with audit context
      const auditCtx = {
        email: 'admin@test.com',
        role: 'TENANT_ADMIN' as const,
        userId: 'user_123',
      };

      const updated = await catalogService.updatePackage(
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
          entityType: 'Package',
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

    it('should update package WITHOUT audit log when context missing', async () => {
      // Create package
      const pkg = await catalogService.createPackage(testTenantId, {
        slug: 'test-pkg-update-no-audit',
        title: 'Original Title',
        description: 'Original description',
        priceCents: 10000,
      });

      // Update WITHOUT audit context
      await catalogService.updatePackage(testTenantId, pkg.id, {
        title: 'Updated Title No Audit',
        priceCents: 12000,
      });

      // Verify NO update audit log
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Package',
          entityId: pkg.id,
          operation: 'update',
        },
      });

      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('deletePackage', () => {
    it('should delete package AND audit log with beforeSnapshot', async () => {
      // Create package
      const pkg = await catalogService.createPackage(testTenantId, {
        slug: 'test-pkg-delete',
        title: 'Package to Delete',
        description: 'Will be deleted',
        priceCents: 10000,
      });

      // Delete with audit context
      const auditCtx = {
        email: 'admin@test.com',
        role: 'TENANT_ADMIN' as const,
        userId: 'user_123',
      };

      await catalogService.deletePackage(testTenantId, pkg.id, auditCtx);

      // Verify package deleted
      const deletedPkg = await prisma.package.findUnique({
        where: { id: pkg.id },
      });
      expect(deletedPkg).toBeNull();

      // Verify audit log
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Package',
          entityId: pkg.id,
          operation: 'delete',
        },
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].beforeSnapshot).toMatchObject({
        slug: 'test-pkg-delete',
        title: 'Package to Delete',
        priceCents: 10000,
      });
      expect(auditLogs[0].afterSnapshot).toBeNull();
    });

    it('should delete package WITHOUT audit log when context missing', async () => {
      // Create package
      const pkg = await catalogService.createPackage(testTenantId, {
        slug: 'test-pkg-delete-no-audit',
        title: 'Package to Delete No Audit',
        description: 'Will be deleted',
        priceCents: 10000,
      });

      // Delete WITHOUT audit context
      await catalogService.deletePackage(testTenantId, pkg.id);

      // Verify package deleted
      const deletedPkg = await prisma.package.findUnique({
        where: { id: pkg.id },
      });
      expect(deletedPkg).toBeNull();

      // Verify NO delete audit log
      const auditLogs = await prisma.configChangeLog.findMany({
        where: {
          tenantId: testTenantId,
          entityType: 'Package',
          entityId: pkg.id,
          operation: 'delete',
        },
      });

      expect(auditLogs).toHaveLength(0);
    });
  });

  describe('Tenant Isolation', () => {
    const otherTenantId = 'test_tenant_other';

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
    });

    afterEach(async () => {
      await prisma.configChangeLog.deleteMany({
        where: { tenantId: otherTenantId },
      });
      await prisma.package.deleteMany({
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

      // Create package for tenant 1
      await catalogService.createPackage(
        testTenantId,
        {
          slug: 'pkg-tenant1',
          title: 'Tenant 1 Package',
          description: 'Test',
          priceCents: 10000,
        },
        auditCtx
      );

      // Create package for tenant 2
      await catalogService.createPackage(
        otherTenantId,
        {
          slug: 'pkg-tenant2',
          title: 'Tenant 2 Package',
          description: 'Test',
          priceCents: 10000,
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

      // Create package
      const pkg = await catalogService.createPackage(
        testTenantId,
        {
          slug: 'history-pkg',
          title: 'History Test',
          description: 'Test',
          priceCents: 10000,
        },
        auditCtx
      );

      // Update multiple times
      await catalogService.updatePackage(testTenantId, pkg.id, { priceCents: 11000 }, auditCtx);
      await catalogService.updatePackage(testTenantId, pkg.id, { priceCents: 12000 }, auditCtx);

      // Get history
      const history = await auditService.getEntityHistory(testTenantId, 'Package', pkg.id);

      // Should have 3 entries (create + 2 updates)
      expect(history).toHaveLength(3);
      expect(history[0].operation).toBe('update'); // Most recent first
      expect(history[1].operation).toBe('update');
      expect(history[2].operation).toBe('create'); // Oldest last
    });
  });
});
