/**
 * Internal Agent Onboarding Routes
 *
 * Endpoints for the tenant agent to query onboarding/setup progress.
 * Secured with X-Internal-Secret header (agent-to-backend communication).
 *
 * Mounted at: /v1/internal/agent/onboarding
 *
 * @see docs/plans/2026-02-20-feat-onboarding-redesign-plan.md (Phase 6)
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../lib/core/logger';
import type { OnboardingRoutesDeps } from './internal-agent-shared';
import { TenantIdSchema, handleError } from './internal-agent-shared';

/**
 * Create internal agent onboarding routes.
 */
export function createInternalAgentOnboardingRoutes(deps: OnboardingRoutesDeps): Router {
  const router = Router();

  /**
   * POST /setup-progress
   *
   * Returns derived setup progress with 8 checklist items.
   * Agent calls this to understand tenant's current setup state.
   *
   * Body: { tenantId: string }
   * Response: { percentage: number, items: SetupItem[] }
   */
  router.post('/setup-progress', async (req: Request, res: Response) => {
    try {
      const { tenantId } = TenantIdSchema.parse(req.body);

      if (!deps.tenantOnboardingService) {
        res.status(503).json({ error: 'Onboarding service unavailable' });
        return;
      }

      const progress = await deps.tenantOnboardingService.deriveSetupProgress(tenantId);

      logger.info(
        { tenantId, percentage: progress.percentage },
        '[Agent] Setup progress retrieved'
      );

      res.json(progress);
    } catch (error) {
      handleError(res, error, 'POST /onboarding/setup-progress');
    }
  });

  return router;
}
