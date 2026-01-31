/**
 * Tenant Agent - Standalone Deployment Package
 *
 * This is the UNIFIED Tenant Agent that consolidates capabilities from:
 * - Concierge Agent (orchestration, routing)
 * - Storefront Agent (website editing)
 * - Marketing Agent (copy generation)
 * - Project Hub Agent (project management - tenant view)
 *
 * Architecture:
 * - Uses Gemini 2.0 Flash for fast responses
 * - All tools execute directly (no A2A delegation)
 * - VocabularyEmbeddingService for semantic section mapping
 * - Dashboard actions for frontend UI control
 *
 * Benefits over multi-agent approach:
 * - No context loss during delegation (pitfall #90)
 * - Faster responses (no inter-agent latency)
 * - Simpler maintenance (1 codebase vs 4)
 * - Lower cost (fewer LLM calls per task)
 *
 * Deploy with: npm run deploy
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import { LlmAgent } from '@google/adk';
import { logger } from './utils.js';
import { TENANT_AGENT_SYSTEM_PROMPT } from './prompts/system.js';
import {
  navigateToDashboardSectionTool,
  scrollToWebsiteSectionTool,
  showPreviewTool,
  resolveVocabularyTool,
} from './tools/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tenant Agent Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tenant Agent
 *
 * The unified agent for tenant-facing interactions. Handles all tasks that
 * were previously split across Concierge, Storefront, Marketing, and
 * Project Hub agents.
 *
 * Current Phase: 2a (Foundation)
 * - Navigation tools
 * - Vocabulary resolution
 *
 * Upcoming Phases:
 * - 2b: Storefront editing tools
 * - 2c: Marketing copy tools
 * - 2d: Project management tools
 */
export const tenantAgent = new LlmAgent({
  name: 'tenant',
  description:
    'Unified Tenant Agent for HANDLED - handles storefront editing, content generation, and project management for service professionals.',

  // Model configuration - Gemini 2.0 Flash for speed
  model: 'gemini-2.0-flash',
  generateContentConfig: {
    temperature: 0.3, // Lower temperature for consistent, reliable responses
    maxOutputTokens: 4096, // Generous limit for detailed responses
  },

  // System prompt with personality and routing logic
  instruction: TENANT_AGENT_SYSTEM_PROMPT,

  // Phase 2a tools - Navigation and Vocabulary
  tools: [
    // Navigation (T1)
    navigateToDashboardSectionTool,
    scrollToWebsiteSectionTool,
    showPreviewTool,

    // Vocabulary Resolution (T1)
    resolveVocabularyTool,

    // TODO: Phase 2b will add storefront editing tools
    // TODO: Phase 2c will add marketing copy tools
    // TODO: Phase 2d will add project management tools
  ],

  // Lifecycle callbacks for observability
  beforeToolCallback: async ({ tool, args }) => {
    logger.info(
      { toolName: tool.name, args: JSON.stringify(args).substring(0, 200) },
      '[TenantAgent] Calling tool'
    );
    return undefined;
  },

  afterToolCallback: async ({ tool, response }) => {
    const preview =
      typeof response === 'object'
        ? JSON.stringify(response).substring(0, 200)
        : String(response).substring(0, 200);
    logger.info({ result: preview }, `[TenantAgent] Tool result: ${tool.name}`);
    return undefined;
  },
});

// Default export for ADK deploy command
export default tenantAgent;
