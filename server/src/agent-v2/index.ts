/**
 * Agent V2 - Vertex AI Agent System
 *
 * This is the main entry point for the new agent system built on
 * Google Vertex AI Agent Builder with the ADK (Agent Developer Kit).
 *
 * Architecture: Hub-and-Spoke (Concierge + Specialists)
 * - Concierge: Primary interface, routes requests to specialists
 * - Specialists: Marketing, Research, Image, Video, Storefront
 * - Booking Agent: Customer-facing, handles service discovery and booking
 * - Project Hub Agent: Dual-faced, mediates customer-tenant communication
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

// Agents
export * from './agents/booking/index.js';

// Concierge system prompt
export { CONCIERGE_SYSTEM_PROMPT } from './agents/concierge/system-prompt.js';

/**
 * Agent V2 Status
 *
 * This module is under active development. Current status:
 *
 * Phase 1 (Foundation): IN PROGRESS
 * - [x] Directory structure created
 * - [x] Configuration module
 * - [x] Agent cards (all 8)
 * - [x] Memory bank wrapper
 * - [x] ReflectAndRetry plugin
 * - [ ] GCP project setup
 * - [ ] Service accounts
 * - [ ] Storage buckets
 *
 * Phase 2 (Booking Agent): NOT STARTED
 * Phase 3 (Specialists): NOT STARTED
 * Phase 4 (Concierge + Integration): NOT STARTED
 * Phase 5 (Project Hub): NOT STARTED
 * Phase 6 (Media Generation): NOT STARTED
 * Phase 7 (Polish): NOT STARTED
 */
