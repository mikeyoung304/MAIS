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
 * - No context loss during delegation (pitfall #82)
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
  // Navigation (T1)
  navigateToDashboardSectionTool,
  scrollToWebsiteSectionTool,
  showPreviewTool,

  // Vocabulary Resolution (T1)
  resolveVocabularyTool,

  // Storefront Read (T1) - Phase 2b
  getPageStructureTool,
  getSectionContentTool,

  // Storefront Write (T2) - Phase 2b
  updateSectionTool,
  addSectionTool,
  removeSectionTool,
  reorderSectionsTool,

  // Section Publish/Discard (T3) - Section Content Migration
  publishSectionTool,
  discardSectionTool,

  // Branding (T2) - Phase 2b
  updateBrandingTool,

  // Draft Management (T1/T3) - Phase 2b
  previewDraftTool,
  publishDraftTool,
  discardDraftTool,

  // Marketing Copy (T1/T2) - Phase 2c
  generateCopyTool,
  improveSectionCopyTool,

  // Project Management (T1/T2) - Phase 3
  getPendingRequestsTool,
  getCustomerActivityTool,
  getProjectDetailsTool,
  approveRequestTool,
  denyRequestTool,
  sendMessageToCustomerTool,
  updateProjectStatusTool,

  // Discovery (T1) - Phase 4 Migration Fix
  storeDiscoveryFactTool,
  getKnownFactsTool,

  // Package Management (T1/T2/T3) - P0 Fix for E2E Failures
  managePackagesTool,

  // Guided Refinement (T1/T2) - Phase 1 Guided Refinement
  generateSectionVariantsTool,
  applySectionVariantTool,
  markSectionCompleteTool,
  getNextIncompleteSectionTool,

  // Research Delegation (T1) - Onboarding Market Research
  delegateToResearchTool,

  // First Draft (T2) - Onboarding Ecosystem Rebuild Phase 5
  buildFirstDraftTool,
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
 * Current Phase: 8 (Onboarding Ecosystem Rebuild)
 * Tool count: 34
 * - Navigation tools (3)
 * - Vocabulary resolution (1)
 * - Storefront read/write tools (6)
 * - Section publish/discard (2) - per-section T3 operations
 * - Branding updates (1)
 * - Draft management (3)
 * - Marketing copy generation (2)
 * - Project management (7)
 * - Discovery/onboarding (3) - store_discovery_fact, get_known_facts, build_first_draft
 * - Package management (1) - manage_packages (CRUD for bookable services)
 * - Guided Refinement (4) - generate_section_variants, apply_section_variant, mark_section_complete, get_next_incomplete_section
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

  // All tools registered by trust tier
  tools: [
    // ─────────────────────────────────────────────────────────────────────────
    // T1: Execute immediately (read operations, navigation)
    // ─────────────────────────────────────────────────────────────────────────

    // Navigation
    navigateToDashboardSectionTool,
    scrollToWebsiteSectionTool,
    showPreviewTool,

    // Vocabulary Resolution
    resolveVocabularyTool,

    // Storefront Read
    getPageStructureTool,
    getSectionContentTool,

    // Draft Preview
    previewDraftTool,

    // ─────────────────────────────────────────────────────────────────────────
    // T2: Execute + show preview (content updates, settings)
    // ─────────────────────────────────────────────────────────────────────────

    // Storefront Write
    updateSectionTool,
    addSectionTool,
    removeSectionTool,
    reorderSectionsTool,

    // Branding
    updateBrandingTool,

    // ─────────────────────────────────────────────────────────────────────────
    // T3: Require explicit confirmation (publish, delete)
    // ─────────────────────────────────────────────────────────────────────────

    // Draft Management (all-or-nothing)
    publishDraftTool,
    discardDraftTool,

    // Section-level publish/discard (per-section granularity)
    publishSectionTool,
    discardSectionTool,

    // ─────────────────────────────────────────────────────────────────────────
    // Marketing Copy (T1/T2) - Phase 2c
    // ─────────────────────────────────────────────────────────────────────────

    // Copy Generation
    generateCopyTool,

    // Copy Improvement
    improveSectionCopyTool,

    // ─────────────────────────────────────────────────────────────────────────
    // Project Management (T1/T2) - Phase 3
    // ─────────────────────────────────────────────────────────────────────────

    // T1: Read operations
    getPendingRequestsTool,
    getCustomerActivityTool,
    getProjectDetailsTool,

    // T2: Write operations
    approveRequestTool,
    denyRequestTool,
    sendMessageToCustomerTool,
    updateProjectStatusTool,

    // ─────────────────────────────────────────────────────────────────────────
    // Discovery Tools (T1/T2) - Phase 4 Migration Fix + Phase 5 First Draft
    // ─────────────────────────────────────────────────────────────────────────

    // T1: Active memory for onboarding - stores facts learned during conversation
    storeDiscoveryFactTool,

    // T1: Retrieve stored facts - prevents asking redundant questions
    getKnownFactsTool,

    // T2: First draft orchestrator - identifies placeholders, returns structured
    //     data for LLM to generate copy. Triggered by slot machine BUILD_FIRST_DRAFT.
    buildFirstDraftTool,

    // ─────────────────────────────────────────────────────────────────────────
    // Package Management (T1/T2/T3) - P0 Fix for E2E Failures
    // CRITICAL: This manages ACTUAL bookable packages (Package table), NOT the
    // cosmetic "pricing section" in the storefront.
    // ─────────────────────────────────────────────────────────────────────────

    // Create, update, delete, or list actual bookable service packages
    managePackagesTool,

    // ─────────────────────────────────────────────────────────────────────────
    // Guided Refinement Tools (T1/T2) - Phase 1 Guided Refinement
    // Section-by-section editing with 3 tone variants per section.
    // State stored in ADK session via context.state.set/get.
    // @see docs/plans/2026-02-04-feat-guided-refinement-implementation-plan.md
    // ─────────────────────────────────────────────────────────────────────────

    // T1: Generate 3 tone variants (Professional/Premium/Friendly)
    generateSectionVariantsTool,

    // T2: Apply selected variant to draft
    applySectionVariantTool,

    // T1: Mark section as complete in refinement flow
    markSectionCompleteTool,

    // T1: Get next section that needs refinement
    getNextIncompleteSectionTool,

    // ─────────────────────────────────────────────────────────────────────────
    // Research Delegation (T1) - Onboarding Market Research
    // Calls research-agent for competitor pricing and market positioning.
    // Trigger: When agent has businessType + location during onboarding.
    // ─────────────────────────────────────────────────────────────────────────

    // T1: Delegate market research (async, can continue conversation while waiting)
    delegateToResearchTool,
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
