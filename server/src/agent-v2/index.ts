/**
 * Agent V2 - Vertex AI Agent System
 *
 * This is the main entry point for the agent system built on
 * Google Vertex AI Agent Builder with the ADK (Agent Developer Kit).
 *
 * Architecture (Phase 4 - January 2026):
 * - tenant-agent: Unified tenant-facing agent (storefront, marketing, project management)
 * - customer-agent: Unified customer-facing agent (booking, project hub)
 * - research-agent: Web research capabilities
 *
 * Deployed agents are in: deploy/tenant-agent/, deploy/customer-agent/
 * Legacy agents archived in: archive/
 */

// Configuration
export {
  getVertexConfig,
  AGENT_MODELS,
  TrustTier,
  MEDIA_COSTS,
  TIER_LIMITS,
  RATE_LIMITS,
} from './config/vertex-config.js';

// Memory (with tenant isolation)
export { IsolatedMemoryBank, createIsolatedMemoryBank } from './memory/isolated-memory-bank.js';

// Plugins
export { ReflectAndRetryPlugin, createReflectAndRetryPlugin } from './plugins/reflect-retry.js';

/**
 * Agent V2 Status - Phase 4 Complete (2026-01-31)
 *
 * - [x] 3-agent architecture deployed (tenant-agent, customer-agent, research-agent)
 * - [x] Legacy agents archived (concierge, booking, marketing, storefront, project-hub)
 * - [x] Cloud Run deployment via GitHub Actions
 * - [x] IAM permissions configured for Render → Cloud Run
 */
