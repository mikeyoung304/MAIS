/**
 * Internal Agent Routes — Aggregator
 *
 * Thin composition file that mounts all domain-specific agent route files.
 * Each domain router handles its own authentication and error handling
 * via the shared module (internal-agent-shared.ts).
 *
 * Protected endpoints for agent-to-backend communication.
 * Called by deployed Vertex AI agents (tenant-agent, customer-agent, research-agent).
 *
 * Security:
 * - Secured with X-Internal-Secret header (shared secret, timing-safe comparison)
 * - All endpoints require tenantId in request body
 * - All queries are tenant-scoped to prevent data leakage
 *
 * Domain routers:
 * - Discovery: bootstrap, onboarding, facts (6 endpoints)
 * - Booking: services, availability, booking (7 endpoints)
 * - Storefront: section CRUD, publish/discard (12 endpoints)
 * - Marketing: content generation, packages, vocabulary (7 endpoints)
 * - Project Hub: project CRUD, timeline, requests (9 endpoints)
 *
 * Total: 41 endpoints across 5 domain files
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
 * @returns Express router with all 41 internal agent endpoints
 */
export function createInternalAgentRoutes(deps: InternalAgentRoutesDeps): Router {
  const router = Router();

  // Mount domain routers
  // Order: marketing before storefront so /storefront/generate-variants
  // is matched by the marketing router (mounted at /) before the storefront
  // router (mounted at /storefront) attempts a pass-through.
  router.use('/', createInternalAgentDiscoveryRoutes(deps));
  router.use('/', createInternalAgentBookingRoutes(deps));
  router.use('/', createInternalAgentMarketingRoutes(deps));
  router.use('/storefront', createInternalAgentStorefrontRoutes(deps));
  router.use('/project-hub', createInternalAgentProjectHubRoutes(deps));

  return router;
}
