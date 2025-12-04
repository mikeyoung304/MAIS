/**
 * Tenant authentication middleware
 * Verifies tenant JWT tokens and attaches tenant context to res.locals
 * Also supports platform admin impersonation tokens
 */

import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../lib/errors';
import type { TenantAuthService } from '../services/tenant-auth.service';
import type { TenantTokenPayload, UnifiedTokenPayload } from '../lib/ports';
import type { IdentityService } from '../services/identity.service';

/**
 * Creates tenant auth middleware that verifies JWT tokens
 * This is separate from platform admin auth and API key auth
 * Also supports platform admin impersonation tokens for admin-as-tenant access
 */
export function createTenantAuthMiddleware(
  tenantAuthService: TenantAuthService,
  identityService?: IdentityService
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const reqLogger = res.locals.logger;

    try {
      // Extract Authorization header
      const authHeader = req.get('Authorization');
      if (!authHeader) {
        throw new UnauthorizedError('Missing Authorization header');
      }

      // Verify Bearer token format
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new UnauthorizedError(
          'Invalid Authorization header format. Expected: Bearer <token>'
        );
      }

      const token = parts[1];
      if (!token) {
        throw new UnauthorizedError('Missing token');
      }

      // First, try to verify as platform admin impersonation token
      if (identityService) {
        try {
          const adminPayload = identityService.verifyToken(token) as unknown as UnifiedTokenPayload;

          // Check if this is an impersonation token
          if (adminPayload.role === 'PLATFORM_ADMIN' && adminPayload.impersonating) {
            // Platform admin is impersonating a tenant - extract tenant context
            const impersonation = adminPayload.impersonating;

            // Create tenant context from impersonation data
            // Store impersonation context separately to avoid type conflict
            res.locals.tenantAuth = {
              tenantId: impersonation.tenantId,
              slug: impersonation.tenantSlug,
              email: impersonation.tenantEmail,
              type: 'tenant' as const, // Use 'tenant' type for consistent downstream handling
            } as TenantTokenPayload;

            // Track who is impersonating (for audit logs)
            res.locals.impersonatedBy = adminPayload.email;

            reqLogger?.info(
              {
                tenantId: impersonation.tenantId,
                slug: impersonation.tenantSlug,
                adminEmail: adminPayload.email,
              },
              'Platform admin impersonating tenant'
            );

            next();
            return;
          }
        } catch {
          // Not an admin token, continue to tenant token verification
        }
      }

      // Try to verify as tenant token
      const payload: TenantTokenPayload = tenantAuthService.verifyToken(token);

      // SECURITY: Validate token type - reject admin tokens on tenant routes
      // Tenant tokens MUST have 'type' field set to 'tenant'
      // Admin tokens have 'role' field instead of 'type'
      if (!payload.type || payload.type !== 'tenant') {
        throw new UnauthorizedError(
          'Invalid token type: only tenant tokens are allowed for tenant routes'
        );
      }

      // SECURITY: Validate required tenant fields are present
      if (!payload.tenantId || !payload.slug) {
        throw new UnauthorizedError(
          'Invalid token: missing required tenant context (tenantId, slug)'
        );
      }

      // Attach tenant context to res.locals for use in controllers
      res.locals.tenantAuth = payload;

      reqLogger?.info(
        { tenantId: payload.tenantId, slug: payload.slug, email: payload.email },
        'Tenant authenticated'
      );

      next();
    } catch (error) {
      // Pass authentication errors to error handler
      next(error);
    }
  };
}
