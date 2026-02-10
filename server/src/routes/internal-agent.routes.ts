/**
 * Internal Agent Routes — Aggregator
 *
 * Composes domain-specific agent route files.
 * Secured with X-Internal-Secret header and tenant-scoped queries.
 */

import { Router } from 'express';
import type { InternalAgentRoutesDeps } from './internal-agent-shared';
import { createInternalAgentDiscoveryRoutes } from './internal-agent-discovery.routes';
import { createInternalAgentBookingRoutes } from './internal-agent-booking.routes';
import { createInternalAgentStorefrontRoutes } from './internal-agent-storefront.routes';
import { createInternalAgentMarketingRoutes } from './internal-agent-marketing.routes';
import { createInternalAgentProjectHubRoutes } from './internal-agent-project-hub.routes';

/**
 * Create internal agent routes by composing domain-specific routers.
 *
 * @param deps - Dependencies shared across all domain routers
 * @returns Express router with internal agent endpoints
 */
export function createInternalAgentRoutes(deps: InternalAgentRoutesDeps): Router {
  const router = Router();

  // Mount domain routers
  router.use('/', createInternalAgentDiscoveryRoutes(deps));
  router.use('/', createInternalAgentBookingRoutes(deps));
  router.use('/marketing', createInternalAgentMarketingRoutes(deps));
  router.use('/storefront', createInternalAgentStorefrontRoutes(deps));
  router.use('/project-hub', createInternalAgentProjectHubRoutes(deps));

  return router;
}
