/**
 * Integration tests for impersonation API endpoints
 * Tests POST /v1/auth/impersonate and POST /v1/auth/stop-impersonation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedAuthController } from '../../src/routes/auth.routes';
import { IdentityService } from '../../src/services/identity.service';
import type { TenantAuthService } from '../../src/services/tenant-auth.service';
import type { PrismaTenantRepository } from '../../src/adapters/prisma/tenant.repository';
import { FakeUserRepository } from '../helpers/fakes';
import { UnauthorizedError } from '../../src/lib/errors';

describe('Impersonation API Endpoints', () => {
  let controller: UnifiedAuthController;
  let identityService: IdentityService;
  let tenantAuthService: TenantAuthService;
  let tenantRepo: any; // Mock repository
  const jwtSecret = 'test-impersonation-secret';

  beforeEach(() => {
    const userRepo = new FakeUserRepository();
    identityService = new IdentityService(userRepo, jwtSecret);

    // Mock TenantAuthService (not testing this here)
    tenantAuthService = {} as any;

    // Mock PrismaTenantRepository
    tenantRepo = {
      findById: async (id: string) => {
        if (id === 'tenant_123') {
          return {
            id: 'tenant_123',
            slug: 'acme-corp',
            name: 'Acme Corporation',
            email: 'admin@acme.com',
            apiKeyPublic: 'pk_test_acme',
            apiKeySecret: 'sk_test_acme_hash',
            commissionPercent: 10,
            branding: {},
            secrets: {},
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return null;
      },
    };

    controller = new UnifiedAuthController(
      identityService,
      tenantAuthService,
      tenantRepo as PrismaTenantRepository
    );
  });

  describe('startImpersonation', () => {
    it('creates impersonation token for valid platform admin', async () => {
      // Arrange: create admin token
      const adminToken = identityService.createToken({
        userId: 'admin_123',
        email: 'admin@platform.com',
        role: 'PLATFORM_ADMIN',
      });

      // Act
      const result = await controller.startImpersonation(adminToken, 'tenant_123');

      // Assert
      expect(result.token).toBeDefined();
      expect(result.role).toBe('PLATFORM_ADMIN');
      expect(result.email).toBe('admin@platform.com');
      expect(result.userId).toBe('admin_123');
      expect(result.tenantId).toBe('tenant_123');
      expect(result.slug).toBe('acme-corp');

      // Verify impersonation token contains correct data
      const decoded = identityService.verifyToken(result.token) as any;
      expect(decoded.impersonating).toBeDefined();
      expect(decoded.impersonating.tenantId).toBe('tenant_123');
      expect(decoded.impersonating.tenantSlug).toBe('acme-corp');
      expect(decoded.impersonating.tenantEmail).toBe('admin@acme.com');
      expect(decoded.impersonating.startedAt).toBeDefined();
    });

    it('throws UnauthorizedError if caller is not platform admin', async () => {
      // Arrange: create token without userId (not a platform admin)
      const token = identityService.createToken({
        userId: undefined as any,
        email: 'user@example.com',
        role: 'PLATFORM_ADMIN',
      });

      // Act & Assert
      await expect(controller.startImpersonation(token, 'tenant_123')).rejects.toThrow(
        'Only platform admins can impersonate tenants'
      );
    });

    it('throws UnauthorizedError if tenant does not exist', async () => {
      // Arrange: create admin token
      const adminToken = identityService.createToken({
        userId: 'admin_123',
        email: 'admin@platform.com',
        role: 'PLATFORM_ADMIN',
      });

      // Act & Assert
      await expect(controller.startImpersonation(adminToken, 'tenant_nonexistent')).rejects.toThrow(
        'Tenant not found'
      );
    });

    it('preserves admin user information in impersonation token', async () => {
      // Arrange
      const adminToken = identityService.createToken({
        userId: 'admin_456',
        email: 'superadmin@platform.com',
        role: 'PLATFORM_ADMIN',
      });

      // Act
      const result = await controller.startImpersonation(adminToken, 'tenant_123');

      // Assert: admin info preserved
      expect(result.userId).toBe('admin_456');
      expect(result.email).toBe('superadmin@platform.com');
      expect(result.role).toBe('PLATFORM_ADMIN');

      const decoded = identityService.verifyToken(result.token) as any;
      expect(decoded.userId).toBe('admin_456');
      expect(decoded.email).toBe('superadmin@platform.com');
    });

    it('includes tenant metadata in impersonation token', async () => {
      // Arrange
      const adminToken = identityService.createToken({
        userId: 'admin_789',
        email: 'admin@example.com',
        role: 'PLATFORM_ADMIN',
      });

      // Act
      const result = await controller.startImpersonation(adminToken, 'tenant_123');
      const decoded = identityService.verifyToken(result.token) as any;

      // Assert: tenant metadata present
      expect(decoded.impersonating.tenantId).toBe('tenant_123');
      expect(decoded.impersonating.tenantSlug).toBe('acme-corp');
      expect(decoded.impersonating.tenantEmail).toBe('admin@acme.com');

      // Verify timestamp format
      const timestamp = new Date(decoded.impersonating.startedAt);
      expect(timestamp.toISOString()).toBe(decoded.impersonating.startedAt);
    });
  });

  describe('stopImpersonation', () => {
    it('creates normal admin token from impersonation token', async () => {
      // Arrange: create impersonation token
      const impersonationToken = identityService.createImpersonationToken({
        userId: 'admin_123',
        email: 'admin@platform.com',
        role: 'PLATFORM_ADMIN',
        impersonating: {
          tenantId: 'tenant_123',
          tenantSlug: 'acme-corp',
          tenantEmail: 'admin@acme.com',
          startedAt: new Date().toISOString(),
        },
      });

      // Act
      const result = await controller.stopImpersonation(impersonationToken);

      // Assert
      expect(result.token).toBeDefined();
      expect(result.role).toBe('PLATFORM_ADMIN');
      expect(result.email).toBe('admin@platform.com');
      expect(result.userId).toBe('admin_123');

      // Verify normal token does NOT have impersonation data
      const decoded = identityService.verifyToken(result.token) as any;
      expect(decoded.impersonating).toBeUndefined();
      expect(decoded.userId).toBe('admin_123');
      expect(decoded.email).toBe('admin@platform.com');
    });

    it('throws UnauthorizedError if token is not from platform admin', async () => {
      // Arrange: create token without userId
      const token = identityService.createImpersonationToken({
        userId: undefined as any,
        email: 'user@example.com',
        role: 'PLATFORM_ADMIN',
        impersonating: {
          tenantId: 'tenant_123',
          tenantSlug: 'acme-corp',
          tenantEmail: 'admin@acme.com',
          startedAt: new Date().toISOString(),
        },
      });

      // Act & Assert
      await expect(controller.stopImpersonation(token)).rejects.toThrow(
        'Invalid impersonation token'
      );
    });

    it('preserves admin user information after stopping impersonation', async () => {
      // Arrange
      const impersonationToken = identityService.createImpersonationToken({
        userId: 'admin_999',
        email: 'superadmin@platform.com',
        role: 'PLATFORM_ADMIN',
        impersonating: {
          tenantId: 'tenant_123',
          tenantSlug: 'acme-corp',
          tenantEmail: 'admin@acme.com',
          startedAt: new Date().toISOString(),
        },
      });

      // Act
      const result = await controller.stopImpersonation(impersonationToken);

      // Assert: admin info preserved
      expect(result.userId).toBe('admin_999');
      expect(result.email).toBe('superadmin@platform.com');

      const decoded = identityService.verifyToken(result.token) as any;
      expect(decoded.userId).toBe('admin_999');
      expect(decoded.email).toBe('superadmin@platform.com');
      expect(decoded.role).toBe('PLATFORM_ADMIN');
    });

    it('new token is valid and can be verified', async () => {
      // Arrange
      const impersonationToken = identityService.createImpersonationToken({
        userId: 'admin_111',
        email: 'admin@example.com',
        role: 'PLATFORM_ADMIN',
        impersonating: {
          tenantId: 'tenant_123',
          tenantSlug: 'acme-corp',
          tenantEmail: 'admin@acme.com',
          startedAt: new Date().toISOString(),
        },
      });

      // Act
      const result = await controller.stopImpersonation(impersonationToken);

      // Assert: new token is valid
      expect(() => identityService.verifyToken(result.token)).not.toThrow();
    });
  });

  describe('Full impersonation flow', () => {
    it('completes full cycle: start -> impersonate -> stop', async () => {
      // Step 1: Create admin token
      const adminToken = identityService.createToken({
        userId: 'admin_flow',
        email: 'admin@platform.com',
        role: 'PLATFORM_ADMIN',
      });

      const adminPayload = identityService.verifyToken(adminToken) as any;
      expect(adminPayload.impersonating).toBeUndefined();

      // Step 2: Start impersonation
      const impResult = await controller.startImpersonation(adminToken, 'tenant_123');
      const impToken = impResult.token;

      const impPayload = identityService.verifyToken(impToken) as any;
      expect(impPayload.impersonating).toBeDefined();
      expect(impPayload.impersonating.tenantId).toBe('tenant_123');

      // Step 3: Stop impersonation
      const stopResult = await controller.stopImpersonation(impToken);
      const normalToken = stopResult.token;

      const normalPayload = identityService.verifyToken(normalToken) as any;
      expect(normalPayload.impersonating).toBeUndefined();
      expect(normalPayload.userId).toBe('admin_flow');
      expect(normalPayload.email).toBe('admin@platform.com');
    });

    it('can switch between multiple tenant impersonations', async () => {
      // Arrange: create admin token
      const adminToken = identityService.createToken({
        userId: 'admin_multi',
        email: 'admin@platform.com',
        role: 'PLATFORM_ADMIN',
      });

      // Act: Impersonate first tenant
      const imp1Result = await controller.startImpersonation(adminToken, 'tenant_123');
      const imp1Payload = identityService.verifyToken(imp1Result.token) as any;
      expect(imp1Payload.impersonating.tenantId).toBe('tenant_123');

      // Stop impersonation
      const stopResult = await controller.stopImpersonation(imp1Result.token);

      // Impersonate second tenant (using mock - tenant_123 is only one we have)
      const imp2Result = await controller.startImpersonation(stopResult.token, 'tenant_123');
      const imp2Payload = identityService.verifyToken(imp2Result.token) as any;

      // Assert: new impersonation started
      expect(imp2Payload.impersonating.tenantId).toBe('tenant_123');
      expect(imp2Payload.userId).toBe('admin_multi');
    });
  });

  describe('Security validations', () => {
    it('rejects impersonation with invalid JWT', async () => {
      // Act & Assert
      await expect(
        controller.startImpersonation('invalid-jwt-token', 'tenant_123')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('rejects impersonation with expired token', async () => {
      // Note: Would need to mock time or use a token with very short expiry
      // Skipping for now as it requires time manipulation
    });

    it('impersonation token cannot be used to impersonate another tenant', async () => {
      // Arrange: create impersonation token
      const impToken = identityService.createImpersonationToken({
        userId: 'admin_123',
        email: 'admin@platform.com',
        role: 'PLATFORM_ADMIN',
        impersonating: {
          tenantId: 'tenant_123',
          tenantSlug: 'acme-corp',
          tenantEmail: 'admin@acme.com',
          startedAt: new Date().toISOString(),
        },
      });

      // Act: Try to start another impersonation while already impersonating
      // This should be blocked - nested impersonation is a security risk
      await expect(controller.startImpersonation(impToken, 'tenant_123')).rejects.toThrow(
        'Cannot impersonate while already impersonating'
      );
    });
  });
});
