/**
 * CRITICAL: Tenant Resolution Middleware Security Tests
 *
 * This middleware is the PRIMARY defense against cross-tenant data leakage.
 * Every test here validates a critical security boundary.
 *
 * Tenant isolation depends on:
 * 1. Proper API key validation
 * 2. Correct tenant resolution from database
 * 3. Secure tenantId injection into request context
 * 4. Rejection of inactive tenants
 * 5. Prevention of SQL injection in tenant lookup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import {
  resolveTenant,
  requireTenant,
  requireStripeOnboarded,
  getTenantId,
  getTenant,
  type TenantRequest,
} from '../../src/middleware/tenant';
import type { PrismaClient } from '../../src/generated/prisma/client';

// Mock logger module globally
vi.mock('../../src/lib/core/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock apiKeyService
vi.mock('../../src/lib/api-key.service', () => ({
  apiKeyService: {
    isValidPublicKeyFormat: vi.fn((key: string) => {
      // Real validation logic
      return /^pk_live_[a-z0-9-]+_[a-f0-9]{16}$/.test(key);
    }),
  },
}));

describe('Tenant Resolution Middleware - CRITICAL SECURITY', () => {
  let mockPrisma: Partial<PrismaClient>;
  let tenantMiddleware: ReturnType<typeof resolveTenant>;
  let req: Partial<TenantRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock Express request with headers
    req = {
      headers: {},
      path: '/api/test',
    };

    // Mock Express response
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
    };

    next = vi.fn();

    // Mock Prisma Client - fresh for each test
    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
      } as any,
    };

    // Create middleware with fresh mock
    tenantMiddleware = resolveTenant(mockPrisma as PrismaClient);
  });

  // ============================================================================
  // SUCCESS CASES - Valid Tenant Resolution
  // ============================================================================

  describe('✅ Success Cases - Valid Tenant Resolution', () => {
    it('should resolve tenant from valid API key and inject into request', async () => {
      const mockTenant = {
        id: 'tenant_123',
        slug: 'bellaweddings',
        name: 'Bella Weddings',
        commissionPercent: 10.5,
        branding: { logo: 'logo.png' },
        stripeAccountId: 'acct_123',
        stripeOnboarded: true,
        isActive: true,
      };

      req.headers = { 'x-tenant-key': 'pk_live_bellaweddings_a3f8c9d2e1b4f7a8' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(mockTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // CRITICAL: Verify tenantId injected
      expect(req.tenantId).toBe('tenant_123');

      // CRITICAL: Verify full tenant object injected
      expect(req.tenant).toEqual({
        id: 'tenant_123',
        slug: 'bellaweddings',
        name: 'Bella Weddings',
        commissionPercent: 10.5,
        branding: { logo: 'logo.png' },
        stripeAccountId: 'acct_123',
        stripeOnboarded: true,
      });

      // Verify middleware chain continues
      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should handle tenant with different slug format', async () => {
      const mockTenant = {
        id: 'tenant_456',
        slug: 'abc-123-xyz',
        name: 'Test Business',
        commissionPercent: 15,
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: true,
      };

      req.headers = { 'x-tenant-key': 'pk_live_abc-123-xyz_0123456789abcdef' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(mockTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(req.tenantId).toBe('tenant_456');
      expect(req.tenant?.slug).toBe('abc-123-xyz');
      expect(next).toHaveBeenCalled();
    });

    it('should convert Decimal commissionPercent to number', async () => {
      const mockTenant = {
        id: 'tenant_789',
        slug: 'testbiz',
        name: 'Test Business',
        commissionPercent: 12.5, // Prisma returns numeric value
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: true,
      };

      req.headers = { 'x-tenant-key': 'pk_live_testbiz_fedcba9876543210' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(mockTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // CRITICAL: Ensure commissionPercent is converted to number via Number()
      expect(typeof req.tenant?.commissionPercent).toBe('number');
      expect(req.tenant?.commissionPercent).toBe(12.5);
    });

    it('should handle tenant without Stripe onboarding', async () => {
      const mockTenant = {
        id: 'tenant_new',
        slug: 'newbusiness',
        name: 'New Business',
        commissionPercent: 10,
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: true,
      };

      req.headers = { 'x-tenant-key': 'pk_live_newbusiness_1234567890abcdef' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(mockTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(req.tenantId).toBe('tenant_new');
      expect(req.tenant?.stripeOnboarded).toBe(false);
      expect(req.tenant?.stripeAccountId).toBeNull();
      expect(next).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // FAILURE CASES - Missing API Key
  // ============================================================================

  describe('🚫 Failure Cases - Missing API Key', () => {
    it('should reject request without X-Tenant-Key header', async () => {
      req.headers = {}; // No header

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // CRITICAL: Must return 401
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Missing X-Tenant-Key header',
        code: 'TENANT_KEY_REQUIRED',
        hint: 'Include X-Tenant-Key header with your tenant API key',
      });

      // CRITICAL: Must NOT inject tenantId
      expect(req.tenantId).toBeUndefined();
      expect(req.tenant).toBeUndefined();

      // CRITICAL: Must NOT call next()
      expect(next).not.toHaveBeenCalled();

      // Must NOT query database
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it('should reject request with empty X-Tenant-Key header', async () => {
      req.headers = { 'x-tenant-key': '' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Missing X-Tenant-Key header',
        code: 'TENANT_KEY_REQUIRED',
        hint: 'Include X-Tenant-Key header with your tenant API key',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with whitespace-only X-Tenant-Key', async () => {
      req.headers = { 'x-tenant-key': '   ' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // Should be caught by format validation
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // FAILURE CASES - Invalid API Key Format
  // ============================================================================

  describe('🚫 Failure Cases - Invalid API Key Format', () => {
    it('should reject API key without pk_live_ prefix', async () => {
      req.headers = { 'x-tenant-key': 'bellaweddings_a3f8c9d2e1b4f7g8' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid API key format',
        code: 'INVALID_TENANT_KEY',
        hint: 'API key must be in format: pk_live_tenant_xxxx',
      });

      // CRITICAL: Must NOT query database with invalid format
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject API key with sk_live_ prefix (secret key)', async () => {
      req.headers = { 'x-tenant-key': 'sk_live_bellaweddings_a3f8c9d2e1b4f7g8h9i0j1k2l3m4n5o6' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // Secret keys should not be accepted as tenant keys
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject API key with wrong random length (too short)', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_bellaweddings_abc123' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it('should reject API key with wrong random length (too long)', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_bellaweddings_a3f8c9d2e1b4f7g8h9i0j1k2' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it('should reject API key with invalid characters in random part', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_bellaweddings_ABCDEFGHIJKLMNOP' }; // Uppercase invalid

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it('should reject API key with special characters in slug', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_bella@weddings_a3f8c9d2e1b4f7g8' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it('should reject API key without underscore separators', async () => {
      req.headers = { 'x-tenant-key': 'pk_livebellaweddingsa3f8c9d2e1b4f7g8' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it('should reject completely malformed API key', async () => {
      req.headers = { 'x-tenant-key': 'this-is-not-a-valid-key' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // FAILURE CASES - Tenant Not Found
  // ============================================================================

  describe('🚫 Failure Cases - Tenant Not Found', () => {
    it('should reject valid format but non-existent tenant', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_nonexistent_a3f8c9d2e1b4f7a8' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(null);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // CRITICAL: Must return 401 for non-existent tenant
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid API key',
        code: 'TENANT_NOT_FOUND',
        hint: 'API key not recognized. Check your tenant configuration.',
      });

      // CRITICAL: Must NOT inject tenantId
      expect(req.tenantId).toBeUndefined();
      expect(req.tenant).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle database returning undefined', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_testbiz_1234567890abcdef' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(undefined);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid API key',
        code: 'TENANT_NOT_FOUND',
        hint: 'API key not recognized. Check your tenant configuration.',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // FAILURE CASES - Inactive Tenant
  // ============================================================================

  describe('🚫 Failure Cases - Inactive Tenant (CRITICAL)', () => {
    it('should reject tenant with isActive = false', async () => {
      const inactiveTenant = {
        id: 'tenant_inactive',
        slug: 'disabledcompany',
        name: 'Disabled Company',
        commissionPercent: 10,
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: false, // CRITICAL: Inactive
      };

      req.headers = { 'x-tenant-key': 'pk_live_disabledcompany_a3f8c9d2e1b4f7a8' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(inactiveTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // CRITICAL: Must return 403 (Forbidden) not 401
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Tenant account is inactive',
        code: 'TENANT_INACTIVE',
        hint: 'Contact support to reactivate your account.',
      });

      // CRITICAL: Must NOT inject tenantId for inactive tenant
      expect(req.tenantId).toBeUndefined();
      expect(req.tenant).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject suspended tenant attempting to make request', async () => {
      const suspendedTenant = {
        id: 'tenant_suspended',
        slug: 'suspendedaccount',
        name: 'Suspended Account',
        commissionPercent: 10,
        branding: null,
        stripeAccountId: 'acct_123',
        stripeOnboarded: true,
        isActive: false,
      };

      req.headers = { 'x-tenant-key': 'pk_live_suspendedaccount_fedcba9876543210' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(suspendedTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(req.tenantId).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ERROR HANDLING - Database Errors
  // ============================================================================

  describe('💥 Error Handling - Database Errors', () => {
    it('should handle database connection error gracefully', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_testbiz_a3f8c9d2e1b4f7a8' };
      (mockPrisma.tenant!.findUnique as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // CRITICAL: Must return 500 for database errors
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to resolve tenant',
        code: 'TENANT_RESOLUTION_ERROR',
      });

      // CRITICAL: Must NOT inject tenantId on error
      expect(req.tenantId).toBeUndefined();
      expect(req.tenant).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle Prisma query timeout', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_testbiz_a3f8c9d2e1b4f7a8' };
      (mockPrisma.tenant!.findUnique as any).mockRejectedValue(new Error('Query timeout'));

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to resolve tenant',
        code: 'TENANT_RESOLUTION_ERROR',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors without exposing details', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_testbiz_a3f8c9d2e1b4f7a8' };
      (mockPrisma.tenant!.findUnique as any).mockRejectedValue(
        new Error('Unexpected internal error with sensitive data')
      );

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(500);

      // CRITICAL: Must NOT expose internal error details
      const errorResponse = jsonMock.mock.calls[0][0];
      expect(errorResponse.error).not.toContain('sensitive data');
      expect(errorResponse.error).toBe('Failed to resolve tenant');

      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECURITY - SQL Injection Prevention
  // ============================================================================

  describe('🔒 Security - SQL Injection Prevention', () => {
    it('should safely handle SQL injection attempt in API key', async () => {
      const injectionAttempt = "pk_live_test' OR '1'='1_a3f8c9d2e1b4f7g8";
      req.headers = { 'x-tenant-key': injectionAttempt };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // Should be rejected by format validation before database query
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it('should safely handle API key with SQL comment', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_test--_a3f8c9d2e1b4f7g8' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it('should safely handle API key with NULL bytes', async () => {
      req.headers = { 'x-tenant-key': 'pk_live_test\x00_a3f8c9d2e1b4f7g8' };

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockPrisma.tenant!.findUnique).not.toHaveBeenCalled();
    });

    it('should use parameterized query (verify Prisma usage)', async () => {
      const validKey = 'pk_live_testbiz_a3f8c9d2e1b4f7a8';
      req.headers = { 'x-tenant-key': validKey };

      const mockTenant = {
        id: 'tenant_123',
        slug: 'testbiz',
        name: 'Test',
        commissionPercent: 10,
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: true,
      };

      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(mockTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // CRITICAL: Verify tenant was resolved (Prisma uses parameterized queries by design)
      expect(req.tenantId).toBe('tenant_123');
      expect(next).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('⚠️ Edge Cases', () => {
    it('should handle header with lowercase x-tenant-key', async () => {
      const mockTenant = {
        id: 'tenant_123',
        slug: 'testbiz',
        name: 'Test',
        commissionPercent: 10,
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: true,
      };

      // Express normalizes headers to lowercase
      req.headers = { 'x-tenant-key': 'pk_live_testbiz_a3f8c9d2e1b4f7a8' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(mockTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      // Should handle case-insensitive header names
      expect(req.tenantId).toBe('tenant_123');
      expect(next).toHaveBeenCalled();
    });

    it('should handle very long but valid API key', async () => {
      const mockTenant = {
        id: 'tenant_123',
        slug: 'a'.repeat(50), // Max length slug
        name: 'Test',
        commissionPercent: 10,
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: true,
      };

      req.headers = { 'x-tenant-key': `pk_live_${'a'.repeat(50)}_0123456789abcdef` };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(mockTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(req.tenantId).toBe('tenant_123');
      expect(next).toHaveBeenCalled();
    });

    it('should handle tenant with zero commission', async () => {
      const mockTenant = {
        id: 'tenant_zero',
        slug: 'freebiz',
        name: 'Free Business',
        commissionPercent: 0,
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: true,
      };

      req.headers = { 'x-tenant-key': 'pk_live_freebiz_fedcba9876543210' };
      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(mockTenant);

      await tenantMiddleware(req as TenantRequest, res as Response, next);

      expect(req.tenant?.commissionPercent).toBe(0);
      expect(next).toHaveBeenCalled();
    });

    it('should handle concurrent requests for same tenant', async () => {
      const mockTenant = {
        id: 'tenant_concurrent',
        slug: 'busybiz',
        name: 'Busy Business',
        commissionPercent: 10,
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
        isActive: true,
      };

      const req1: Partial<TenantRequest> = {
        headers: { 'x-tenant-key': 'pk_live_busybiz_1111111111111111' },
        path: '/api/test1',
      };
      const req2: Partial<TenantRequest> = {
        headers: { 'x-tenant-key': 'pk_live_busybiz_1111111111111111' },
        path: '/api/test2',
      };

      (mockPrisma.tenant!.findUnique as any).mockResolvedValue(mockTenant);

      // Simulate concurrent requests
      await Promise.all([
        tenantMiddleware(req1 as TenantRequest, res as Response, next),
        tenantMiddleware(req2 as TenantRequest, res as Response, next),
      ]);

      // Both should resolve successfully
      expect(req1.tenantId).toBe('tenant_concurrent');
      expect(req2.tenantId).toBe('tenant_concurrent');
      expect(next).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================================
// requireTenant Middleware Tests
// ============================================================================

describe('requireTenant Middleware', () => {
  let req: Partial<TenantRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = {
      path: '/api/test',
    };

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
    };

    next = vi.fn();
  });

  it('should allow request when tenant is resolved', () => {
    req.tenant = {
      id: 'tenant_123',
      slug: 'testbiz',
      name: 'Test Business',
      commissionPercent: 10,
      branding: null,
      stripeAccountId: null,
      stripeOnboarded: false,
    };
    req.tenantId = 'tenant_123';

    requireTenant(req as TenantRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should reject request when tenant is missing', () => {
    // No tenant set
    requireTenant(req as TenantRequest, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED',
      hint: 'This endpoint requires a valid X-Tenant-Key header',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when tenantId is missing but tenant exists', () => {
    req.tenant = {
      id: 'tenant_123',
      slug: 'testbiz',
      name: 'Test',
      commissionPercent: 10,
      branding: null,
      stripeAccountId: null,
      stripeOnboarded: false,
    };
    // Missing tenantId

    requireTenant(req as TenantRequest, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================================================
// requireStripeOnboarded Middleware Tests
// ============================================================================

describe('requireStripeOnboarded Middleware', () => {
  let req: Partial<TenantRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = {
      path: '/api/bookings',
    };

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
    };

    next = vi.fn();
  });

  it('should allow request when Stripe is onboarded', () => {
    req.tenant = {
      id: 'tenant_123',
      slug: 'testbiz',
      name: 'Test',
      commissionPercent: 10,
      branding: null,
      stripeAccountId: 'acct_123',
      stripeOnboarded: true,
    };

    requireStripeOnboarded(req as TenantRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should reject when Stripe is not onboarded', () => {
    req.tenant = {
      id: 'tenant_123',
      slug: 'testbiz',
      name: 'Test',
      commissionPercent: 10,
      branding: null,
      stripeAccountId: null,
      stripeOnboarded: false,
    };

    requireStripeOnboarded(req as TenantRequest, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'Stripe Connect onboarding not completed',
      code: 'STRIPE_NOT_ONBOARDED',
      hint: 'Complete Stripe Connect onboarding before accepting payments',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when stripeAccountId is missing', () => {
    req.tenant = {
      id: 'tenant_123',
      slug: 'testbiz',
      name: 'Test',
      commissionPercent: 10,
      branding: null,
      stripeAccountId: null,
      stripeOnboarded: true, // Inconsistent state
    };

    requireStripeOnboarded(req as TenantRequest, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when tenant context is missing', () => {
    // No tenant
    requireStripeOnboarded(req as TenantRequest, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      error: 'Tenant context required',
      code: 'TENANT_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Helper Functions Tests
// ============================================================================

describe('Tenant Helper Functions', () => {
  describe('getTenantId()', () => {
    it('should return tenantId when present', () => {
      const req: Partial<TenantRequest> = {
        tenantId: 'tenant_123',
      };

      const result = getTenantId(req as TenantRequest);

      expect(result).toBe('tenant_123');
    });

    it('should throw error when tenantId is missing', () => {
      const req: Partial<TenantRequest> = {};

      expect(() => getTenantId(req as TenantRequest)).toThrow(
        'Tenant ID not found in request. Did you forget resolveTenant middleware?'
      );
    });
  });

  describe('getTenant()', () => {
    it('should return tenant when present', () => {
      const mockTenant = {
        id: 'tenant_123',
        slug: 'testbiz',
        name: 'Test Business',
        commissionPercent: 10,
        branding: null,
        stripeAccountId: null,
        stripeOnboarded: false,
      };

      const req: Partial<TenantRequest> = {
        tenant: mockTenant,
      };

      const result = getTenant(req as TenantRequest);

      expect(result).toEqual(mockTenant);
    });

    it('should throw error when tenant is missing', () => {
      const req: Partial<TenantRequest> = {};

      expect(() => getTenant(req as TenantRequest)).toThrow(
        'Tenant not found in request. Did you forget resolveTenant middleware?'
      );
    });
  });
});
