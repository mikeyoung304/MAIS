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
// Page Management Tool (T1) - Phase 2b
// ─────────────────────────────────────────────────────────────────────────────

export { togglePageTool } from './toggle-page.js';

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
// cosmetic "pricing section" in landingPageConfigDraft. This addresses the
// core E2E failure where agent said "Done" but Services section showed $0.
//
// @see docs/reports/2026-02-01-agent-testing-failure-report.md
// @see todos/811-pending-p1-missing-package-management-tools.md
// ─────────────────────────────────────────────────────────────────────────────

export { managePackagesTool } from './packages.js';
