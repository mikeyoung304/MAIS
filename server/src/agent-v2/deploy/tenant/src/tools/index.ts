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

// Navigation tools (T1)
export {
  navigateToDashboardSectionTool,
  scrollToWebsiteSectionTool,
  showPreviewTool,
  type DashboardAction,
} from './navigate.js';

// Vocabulary resolution (T1)
export { resolveVocabularyTool } from './vocabulary.js';

// TODO: Phase 2b will add:
// - update_section (T2)
// - update_branding (T2)
// - reorder_sections (T1)
// - add_section (T2)
// - remove_section (T2)
// - preview_website (T1)
// - publish_website (T3)
// - discard_draft (T3)

// TODO: Phase 2c will add:
// - generate_copy (T1)
// - improve_section_copy (T2)

// TODO: Phase 2d will add:
// - get_project_details (T1)
// - send_project_message (T2)
// - update_project_status (T2)
