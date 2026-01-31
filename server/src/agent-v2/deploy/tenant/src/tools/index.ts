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
// TODO: Phase 2c - Marketing Copy Tools
// ─────────────────────────────────────────────────────────────────────────────
// - generate_copy (T1)
// - improve_section_copy (T2)

// ─────────────────────────────────────────────────────────────────────────────
// TODO: Phase 2d - Project Management Tools
// ─────────────────────────────────────────────────────────────────────────────
// - get_project_details (T1)
// - send_project_message (T2)
// - update_project_status (T2)
