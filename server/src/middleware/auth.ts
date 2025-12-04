/**
 * Authentication middleware for admin routes
 * Verifies JWT tokens and attaches admin user to res.locals
 */

import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../lib/errors';
import type { IdentityService } from '../services/identity.service';
import type { TokenPayload, UnifiedTokenPayload } from '../lib/ports';

/**
 * Creates auth middleware that verifies JWT tokens
 */
export function createAuthMiddleware(identityService: IdentityService) {
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

      // Verify token and extract payload (could be old TokenPayload or new UnifiedTokenPayload)
      const payload: TokenPayload = identityService.verifyToken(token);

      // SECURITY: Validate token type - reject tenant tokens on admin routes
      // Tenant tokens have a 'type' field set to 'tenant'
      // Admin tokens have a 'role' field set to 'admin' or 'PLATFORM_ADMIN'
      if (
        'type' in payload &&
        typeof payload === 'object' &&
        payload !== null &&
        'type' in payload &&
        (payload as { type: string }).type === 'tenant'
      ) {
        throw new UnauthorizedError(
          'Invalid token type: tenant tokens are not allowed for admin routes'
        );
      }

      // SECURITY: Validate admin role is present (support both old and new token formats)
      const isOldFormat = payload.role === 'admin';
      const payloadAsUnified = payload as unknown as UnifiedTokenPayload;
      const isNewFormat = payloadAsUnified.role === 'PLATFORM_ADMIN';

      if (!isOldFormat && !isNewFormat) {
        throw new UnauthorizedError('Invalid token: admin role required for admin routes');
      }

      // Attach admin user to res.locals for use in controllers
      res.locals.admin = payload;

      // If impersonation token, also attach impersonation context
      const unifiedPayload = payloadAsUnified;
      if (unifiedPayload.impersonating) {
        res.locals.impersonating = unifiedPayload.impersonating;
        reqLogger?.info(
          {
            userId: payload.userId,
            email: payload.email,
            impersonatingTenant: unifiedPayload.impersonating.tenantSlug,
          },
          'Admin authenticated with impersonation'
        );
      } else {
        reqLogger?.info({ userId: payload.userId, email: payload.email }, 'Admin authenticated');
      }

      next();
    } catch (error) {
      // Pass authentication errors to error handler
      next(error);
    }
  };
}
