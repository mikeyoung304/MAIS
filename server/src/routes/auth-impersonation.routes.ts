/**
 * Auth Impersonation Routes
 * POST /impersonate + POST /stop-impersonation
 *
 * Extracted from auth.routes.ts (mechanical refactor, no logic changes)
 */

import type { Router, Request, Response, NextFunction } from 'express';
import type { UnifiedAuthController } from './auth.routes';
import { logger } from '../lib/core/logger';

export function registerImpersonationRoutes(
  router: Router,
  controller: UnifiedAuthController
): void {
  /**
   * POST /impersonate
   * Start impersonating a tenant (platform admin only)
   *
   * Request body:
   * {
   *   "tenantId": "tenant_123"
   * }
   *
   * Response: Same as /login with impersonation data
   */
  router.post('/impersonate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.get('Authorization');
      if (!authHeader) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return;
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
      }

      const { tenantId } = req.body;
      if (!tenantId) {
        res.status(400).json({ error: 'tenantId is required' });
        return;
      }

      const result = await controller.startImpersonation(token, tenantId);

      logger.info(
        {
          event: 'impersonation_api_success',
          adminEmail: result.email,
          tenantId: result.tenantId,
          tenantSlug: result.slug,
        },
        'Impersonation started via API'
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /stop-impersonation
   * Stop impersonating and return to normal admin token
   *
   * Response: Same as /login without impersonation data
   */
  router.post('/stop-impersonation', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.get('Authorization');
      if (!authHeader) {
        res.status(401).json({ error: 'Missing Authorization header' });
        return;
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
      }

      const result = await controller.stopImpersonation(token);

      logger.info(
        {
          event: 'stop_impersonation_api_success',
          adminEmail: result.email,
        },
        'Impersonation stopped via API'
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });
}
