/**
 * Tenant Agent Tools Index
 *
 * Exports all tools available to the Tenant Agent.
 * Tools are organized by trust tier (T1, T2, T3) and category.
 *
 * Trust Tiers:
 * - T1: Execute immediately (read operations, navigation)
 * - T2: Execute + show preview (content updates, settings)
 * - T3: Require explicit confirmation (publish, delete, billing)
 *
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Tools (T1)
// ─────────────────────────────────────────────────────────────────────────────

export {
  navigateToDashboardSectionTool,
  scrollToWebsiteSectionTool,
  showPreviewTool,
  type DashboardAction,
} from './navigate.js';

// ─────────────────────────────────────────────────────────────────────────────
// Vocabulary Resolution (T1)
// ─────────────────────────────────────────────────────────────────────────────

export { resolveVocabularyTool } from './vocabulary.js';

// ─────────────────────────────────────────────────────────────────────────────
// Storefront Read Tools (T1) - Phase 2b
// ─────────────────────────────────────────────────────────────────────────────

export { getPageStructureTool, getSectionContentTool } from './storefront-read.js';

// ─────────────────────────────────────────────────────────────────────────────
// Storefront Write Tools (T2) - Phase 2b
// ─────────────────────────────────────────────────────────────────────────────

export {
  updateSectionTool,
  addSectionTool,
  removeSectionTool,
  reorderSectionsTool,
} from './storefront-write.js';

// ─────────────────────────────────────────────────────────────────────────────
// Section Publish/Discard Tools (T3) - Section Content Migration
// ─────────────────────────────────────────────────────────────────────────────
// These enable per-section publishing instead of all-or-nothing.
// @see docs/plans/2026-02-02-refactor-section-content-migration-plan.md

export { publishSectionTool, discardSectionTool } from './storefront-write.js';

// ─────────────────────────────────────────────────────────────────────────────
// Branding Tool (T2) - Phase 2b
// ─────────────────────────────────────────────────────────────────────────────

export { updateBrandingTool } from './branding.js';

// ─────────────────────────────────────────────────────────────────────────────
// Draft Management Tools (T1/T3) - Phase 2b
// ─────────────────────────────────────────────────────────────────────────────

export { previewDraftTool, publishDraftTool, discardDraftTool } from './draft.js';

// ─────────────────────────────────────────────────────────────────────────────
// Marketing Copy Tools (T1/T2) - Phase 2c
// ─────────────────────────────────────────────────────────────────────────────

export { generateCopyTool, improveSectionCopyTool } from './marketing.js';

// ─────────────────────────────────────────────────────────────────────────────
// Project Management Tools (T1/T2) - Phase 3
// ─────────────────────────────────────────────────────────────────────────────

export {
  getPendingRequestsTool,
  getCustomerActivityTool,
  getProjectDetailsTool,
  approveRequestTool,
  denyRequestTool,
  sendMessageToCustomerTool,
  updateProjectStatusTool,
} from './project-management.js';

// ─────────────────────────────────────────────────────────────────────────────
// Discovery Tools (T1) - Phase 4 Migration Fix
// ─────────────────────────────────────────────────────────────────────────────

export {
  storeDiscoveryFactTool,
  getKnownFactsTool,
  DISCOVERY_FACT_KEYS,
  type DiscoveryFactKey,
} from './discovery.js';

// ─────────────────────────────────────────────────────────────────────────────
// Package Management Tools (T1/T2/T3) - P0 Fix for E2E Failures
// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL: These manage ACTUAL bookable packages (Package table), NOT the
// cosmetic "pricing section" in the storefront. This addresses the core E2E
// failure where agent said "Done" but Services section showed $0.
//
// @see docs/reports/2026-02-01-agent-testing-failure-report.md
// @see todos/811-pending-p1-missing-package-management-tools.md
// ─────────────────────────────────────────────────────────────────────────────

export { managePackagesTool } from './packages.js';

// ─────────────────────────────────────────────────────────────────────────────
// Guided Refinement Tools (T1/T2) - Phase 1 Guided Refinement
// ─────────────────────────────────────────────────────────────────────────────
// Section-by-section editing experience with 3 tone variants per section.
// State stored in ADK session via context.state.set/get.
//
// @see docs/plans/2026-02-04-feat-guided-refinement-implementation-plan.md
// @see docs/spikes/2026-02-04-adk-session-state-spike.md
// ─────────────────────────────────────────────────────────────────────────────

export {
  // T1: Generate variants (read + generate, no persistent change)
  generateSectionVariantsTool,
  // T2: Apply variant to draft
  applySectionVariantTool,
  // T1: State tracking only
  markSectionCompleteTool,
  getNextIncompleteSectionTool,
} from './refinement.js';

// ─────────────────────────────────────────────────────────────────────────────
// Research Delegation Tool (T1) - Onboarding Market Research
// ─────────────────────────────────────────────────────────────────────────────
// Delegates to research-agent for competitor pricing and market positioning.
// Trigger: When agent has businessType + location during onboarding.
//
// @see CLAUDE.md "The Onboarding Conversation" section
// ─────────────────────────────────────────────────────────────────────────────

export { delegateToResearchTool } from './research.js';

// ─────────────────────────────────────────────────────────────────────────────
// First Draft Tool (T2) - Onboarding Ecosystem Rebuild Phase 5
// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator tool that identifies placeholder sections ready for content
// generation. Called when slot machine returns nextAction: 'BUILD_FIRST_DRAFT'.
//
// @see docs/plans/2026-02-05-feat-onboarding-ecosystem-rebuild-plan.md (Phase 5)

export { buildFirstDraftTool } from './first-draft.js';
