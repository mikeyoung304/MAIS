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
// Catalog Management Tools (T1/T2/T3) - Segments, Tiers, Add-Ons
// ─────────────────────────────────────────────────────────────────────────────
// Segment → Tier → AddOn hierarchy replaces the flat Package model.
// Segments group services by client type. Tiers are the bookable entities
// with real prices. Add-ons are optional extras.
//
// @see docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md
// ─────────────────────────────────────────────────────────────────────────────

export { manageSegmentsTool } from './segments.js';
export { manageTiersTool } from './tiers.js';
export { manageAddOnsTool } from './addons.js';

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
// Research Delegation Tool (T1) - On-Demand Market Research
// ─────────────────────────────────────────────────────────────────────────────
// Delegates to research-agent for competitor pricing and market positioning.
// On-demand: call when setting tier prices, not automatically during discovery.
//
// @see docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md
// ─────────────────────────────────────────────────────────────────────────────

export { delegateToResearchTool } from './research.js';

// ─────────────────────────────────────────────────────────────────────────────
// First Draft Tool (T2) - Onboarding First Draft
// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator tool that identifies placeholder sections ready for content
// generation. Called when store_discovery_fact returns readyForReveal: true.
//
// @see docs/architecture/ONBOARDING_CONVERSATION_DESIGN.md

export { buildFirstDraftTool } from './first-draft.js';

// ─────────────────────────────────────────────────────────────────────────────
// Calendar Management Tools (T1/T2) - Google Calendar Integration
// ─────────────────────────────────────────────────────────────────────────────
// Check calendar availability and block dates. Gracefully handles
// missing Google Calendar configuration.

export { checkCalendarAvailabilityTool, blockCalendarDateTool } from './calendar.js';

// ─────────────────────────────────────────────────────────────────────────────
// Setup Progress Tool (T1) - Onboarding Checklist
// ─────────────────────────────────────────────────────────────────────────────
// Returns setup checklist with completion status. Agent uses this to suggest
// the highest-impact next step during conversation.
//
// @see docs/plans/2026-02-20-feat-onboarding-redesign-plan.md (Phase 6)

export { getSetupProgressTool } from './setup-progress.js';
