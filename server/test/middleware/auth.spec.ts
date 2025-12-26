/**
 * Auth middleware unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '../../src/middleware/auth';
import type { IdentityService } from '../../src/domains/identity/service';
import { UnauthorizedError } from '../../src/lib/errors';
import type { TokenPayload } from '../../src/domains/identity/port';

describe('Auth Middleware', () => {
  let identityService: IdentityService;
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    // Mock IdentityService
    identityService = {
      verifyToken: vi.fn(),
    } as any;

    authMiddleware = createAuthMiddleware(identityService);

    // Mock Express request/response
    req = {
      get: vi.fn(),
    };

    res = {
      locals: {
        logger: {
          info: vi.fn(),
        },
      },
    };

    next = vi.fn();
  });

  describe('Success Cases', () => {
    it('should authenticate valid Bearer token', () => {
      const mockPayload: TokenPayload = {
        userId: 'user_admin',
        email: 'admin@macon.com',
        role: 'admin',
      };

      (req.get as any).mockReturnValue('Bearer valid-token-123');
      (identityService.verifyToken as any).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next);

      expect(req.get).toHaveBeenCalledWith('Authorization');
      expect(identityService.verifyToken).toHaveBeenCalledWith('valid-token-123');
      expect(res.locals!.admin).toEqual(mockPayload);
      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should log authentication success', () => {
      const mockPayload: TokenPayload = {
        userId: 'user_admin',
        email: 'admin@macon.com',
        role: 'admin',
      };

      (req.get as any).mockReturnValue('Bearer valid-token-123');
      (identityService.verifyToken as any).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next);

      expect(res.locals!.logger.info).toHaveBeenCalledWith(
        { userId: 'user_admin', email: 'admin@macon.com' },
        'Admin authenticated'
      );
    });
  });

  describe('Failure Cases - Missing Token', () => {
    it('should reject request without Authorization header', () => {
      (req.get as any).mockReturnValue(undefined);

      authMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = (next as any).mock.calls[0][0];
      expect(error.message).toBe('Missing Authorization header');
    });

    it('should reject request with empty Authorization header', () => {
      (req.get as any).mockReturnValue('');

      authMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('Failure Cases - Invalid Format', () => {
    it('should reject Authorization header without Bearer prefix', () => {
      (req.get as any).mockReturnValue('Basic dXNlcjpwYXNz');

      authMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = (next as any).mock.calls[0][0];
      expect(error.message).toContain('Invalid Authorization header format');
    });

    it('should reject malformed Bearer token (no space)', () => {
      (req.get as any).mockReturnValue('Bearertoken123');

      authMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should reject Bearer with empty token', () => {
      (req.get as any).mockReturnValue('Bearer ');

      authMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = (next as any).mock.calls[0][0];
      expect(error.message).toBe('Missing token');
    });

    it('should reject Bearer with only whitespace', () => {
      (req.get as any).mockReturnValue('Bearer   ');

      authMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('Failure Cases - Invalid Token', () => {
    it('should reject expired token', () => {
      (req.get as any).mockReturnValue('Bearer expired-token');
      (identityService.verifyToken as any).mockImplementation(() => {
        throw new UnauthorizedError('Invalid or expired token');
      });

      authMiddleware(req as Request, res as Response, next);

      expect(identityService.verifyToken).toHaveBeenCalledWith('expired-token');
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      const error = (next as any).mock.calls[0][0];
      expect(error.message).toBe('Invalid or expired token');
    });

    it('should reject tampered token', () => {
      (req.get as any).mockReturnValue('Bearer tampered-token');
      (identityService.verifyToken as any).mockImplementation(() => {
        throw new UnauthorizedError('Invalid or expired token');
      });

      authMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should reject malformed JWT', () => {
      (req.get as any).mockReturnValue('Bearer not.a.jwt');
      (identityService.verifyToken as any).mockImplementation(() => {
        throw new UnauthorizedError('Invalid or expired token');
      });

      authMiddleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('Error Handling', () => {
    it('should not attach admin to res.locals on failure', () => {
      (req.get as any).mockReturnValue(undefined);

      authMiddleware(req as Request, res as Response, next);

      expect(res.locals!.admin).toBeUndefined();
    });

    it('should pass error to next() without throwing', () => {
      (req.get as any).mockReturnValue('Bearer invalid');
      (identityService.verifyToken as any).mockImplementation(() => {
        throw new UnauthorizedError('Invalid token');
      });

      // Should not throw
      expect(() => {
        authMiddleware(req as Request, res as Response, next);
      }).not.toThrow();

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multiple admin roles', () => {
      const mockPayload: TokenPayload = {
        userId: 'user_super_admin',
        email: 'super@macon.com',
        role: 'admin',
      };

      (req.get as any).mockReturnValue('Bearer super-admin-token');
      (identityService.verifyToken as any).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next);

      expect(res.locals!.admin).toEqual(mockPayload);
      expect(next).toHaveBeenCalledWith();
    });

    it('should work without logger in res.locals', () => {
      res.locals = {}; // No logger

      const mockPayload: TokenPayload = {
        userId: 'user_admin',
        email: 'admin@macon.com',
        role: 'admin',
      };

      (req.get as any).mockReturnValue('Bearer valid-token');
      (identityService.verifyToken as any).mockReturnValue(mockPayload);

      // Should not throw
      expect(() => {
        authMiddleware(req as Request, res as Response, next);
      }).not.toThrow();

      expect(res.locals!.admin).toEqual(mockPayload);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Impersonation Support', () => {
    it('should attach impersonation context when token contains impersonating data', () => {
      const mockPayload: any = {
        userId: 'admin_123',
        email: 'admin@platform.com',
        role: 'PLATFORM_ADMIN',
        impersonating: {
          tenantId: 'tenant_456',
          tenantSlug: 'acme-corp',
          tenantEmail: 'tenant@acme.com',
          startedAt: '2025-01-01T00:00:00Z',
        },
      };

      (req.get as any).mockReturnValue('Bearer impersonation-token');
      (identityService.verifyToken as any).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next);

      // Should attach both admin and impersonating data
      expect(res.locals!.admin).toEqual(mockPayload);
      expect(res.locals!.impersonating).toEqual(mockPayload.impersonating);
      expect(next).toHaveBeenCalledWith();
    });

    it('should log impersonation context when present', () => {
      const mockPayload: any = {
        userId: 'admin_789',
        email: 'admin@platform.com',
        role: 'PLATFORM_ADMIN',
        impersonating: {
          tenantId: 'tenant_xyz',
          tenantSlug: 'test-corp',
          tenantEmail: 'test@corp.com',
          startedAt: '2025-01-01T00:00:00Z',
        },
      };

      (req.get as any).mockReturnValue('Bearer impersonation-token');
      (identityService.verifyToken as any).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next);

      expect(res.locals!.logger.info).toHaveBeenCalledWith(
        {
          userId: 'admin_789',
          email: 'admin@platform.com',
          impersonatingTenant: 'test-corp',
        },
        'Admin authenticated with impersonation'
      );
    });

    it('should not attach impersonating when token has no impersonation data', () => {
      const mockPayload: TokenPayload = {
        userId: 'admin_123',
        email: 'admin@platform.com',
        role: 'admin',
      };

      (req.get as any).mockReturnValue('Bearer normal-token');
      (identityService.verifyToken as any).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next);

      expect(res.locals!.admin).toEqual(mockPayload);
      expect(res.locals!.impersonating).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should handle impersonation token with all metadata fields', () => {
      const mockPayload: any = {
        userId: 'admin_999',
        email: 'superadmin@platform.com',
        role: 'PLATFORM_ADMIN',
        impersonating: {
          tenantId: 'tenant_full',
          tenantSlug: 'full-tenant',
          tenantEmail: 'full@tenant.com',
          startedAt: '2025-11-22T12:00:00Z',
        },
      };

      (req.get as any).mockReturnValue('Bearer full-imp-token');
      (identityService.verifyToken as any).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next);

      // Verify all impersonation fields are preserved
      expect(res.locals!.impersonating.tenantId).toBe('tenant_full');
      expect(res.locals!.impersonating.tenantSlug).toBe('full-tenant');
      expect(res.locals!.impersonating.tenantEmail).toBe('full@tenant.com');
      expect(res.locals!.impersonating.startedAt).toBe('2025-11-22T12:00:00Z');
    });

    it('should support both old admin format and new PLATFORM_ADMIN format with impersonation', () => {
      const mockPayload: any = {
        userId: 'admin_compat',
        email: 'admin@example.com',
        role: 'PLATFORM_ADMIN',
        impersonating: {
          tenantId: 'tenant_compat',
          tenantSlug: 'compat-tenant',
          tenantEmail: 'compat@tenant.com',
          startedAt: new Date().toISOString(),
        },
      };

      (req.get as any).mockReturnValue('Bearer compat-token');
      (identityService.verifyToken as any).mockReturnValue(mockPayload);

      authMiddleware(req as Request, res as Response, next);

      // Should accept PLATFORM_ADMIN role
      expect(res.locals!.admin.role).toBe('PLATFORM_ADMIN');
      expect(res.locals!.impersonating).toBeDefined();
      expect(next).toHaveBeenCalledWith();
    });
  });
});
