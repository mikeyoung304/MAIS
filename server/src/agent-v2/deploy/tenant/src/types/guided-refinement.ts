/**
 * Guided Refinement Types
 *
 * Type definitions for the section-by-section editing experience.
 * This transforms onboarding from "all-or-nothing publish" into a guided
 * refinement journey with 3 pre-generated tone variants per section.
 *
 * @see docs/plans/2026-02-04-feat-guided-refinement-implementation-plan.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Refinement Mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The current mode of the guided refinement state machine.
 *
 * State transitions:
 * - interview → draft_build (after 3+ facts collected)
 * - draft_build → guided_refine (after draft complete)
 * - guided_refine → guided_refine (section navigation)
 * - guided_refine → publish_ready (all sections complete)
 * - guided_refine → interview ("start over" - warns about draft discard)
 * - publish_ready → guided_refine ("edit [section]" - unlocks section)
 * - any → publish_ready ("just finish it" - guard: hero must exist)
 */
export type RefinementMode =
  | 'interview' // Collecting discovery facts
  | 'draft_build' // Autonomously creating first draft
  | 'guided_refine' // Section-by-section editing with variants
  | 'publish_ready'; // All sections approved, awaiting publish

// ─────────────────────────────────────────────────────────────────────────────
// Section Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Content for a section variant.
 * Matches the SectionContent schema structure.
 */
export interface VariantContent {
  headline?: string;
  subheadline?: string;
  content?: string;
  ctaText?: string;
  ctaUrl?: string;
}

/**
 * The three tone variants available for each section.
 */
export type ToneVariant = 'professional' | 'premium' | 'friendly';

/**
 * A set of 3 tone variants for a single section.
 */
export interface SectionVariantSet {
  /** Professional tone - authoritative, builds trust */
  professional: VariantContent;
  /** Premium tone - luxury feel, sophisticated vocabulary */
  premium: VariantContent;
  /** Friendly tone - approachable, conversational */
  friendly: VariantContent;
  /** Which variant the user selected (null = not yet selected) */
  selectedVariant: ToneVariant | null;
  /** Whether this section has been marked complete */
  isComplete: boolean;
  /** When these variants were generated (ISO timestamp) */
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preference Memory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stored preferences about HOW the user makes decisions.
 * Used to adapt agent behavior to the user's style.
 */
export interface PreferenceMemory {
  /**
   * User's preferred tone based on past selections.
   * Set when they select the same tone 2+ times.
   */
  preferredTone?: ToneVariant;

  /**
   * How the user makes decisions.
   * - 'decisive': "I trust you" / "just do it" → fewer options, faster pace
   * - 'cautious': "Let me think" / asks questions → more explanation, confirm first
   */
  decisionStyle?: 'decisive' | 'cautious';

  /**
   * Preferred copy style.
   * - 'plainspoken': "No fluff" / "keep it simple" → shorter, no marketing speak
   * - 'premium': "Make it feel expensive" → luxury tone, sophisticated vocab
   */
  copyStyle?: 'plainspoken' | 'premium';

  /**
   * History of tone selections (for detecting preferredTone).
   * Last 5 selections stored.
   */
  toneHistory?: ToneVariant[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Guided Refinement State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete state for the guided refinement flow.
 * Stored in ADK session state via context.state.set('guidedRefinementState', state).
 */
export interface GuidedRefinementState {
  /** Current mode in the state machine */
  mode: RefinementMode;

  /** ID of the section currently being refined (null if not in guided_refine) */
  currentSectionId: string | null;

  /** List of section IDs that have been marked complete */
  completedSections: string[];

  /** Generated variants for each section, keyed by sectionId */
  sectionVariants: Record<string, SectionVariantSet>;

  /** User's decision-making preferences */
  preferenceMemory: PreferenceMemory;

  /** When guided refinement started (ISO timestamp) */
  startedAt: string;

  /** Last activity timestamp (ISO timestamp) */
  lastActivityAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create initial guided refinement state.
 * Called when entering guided refinement mode.
 */
export function createInitialState(): GuidedRefinementState {
  const now = new Date().toISOString();
  return {
    mode: 'interview',
    currentSectionId: null,
    completedSections: [],
    sectionVariants: {},
    preferenceMemory: {
      toneHistory: [],
    },
    startedAt: now,
    lastActivityAt: now,
  };
}

/**
 * Create an empty variant set (before generation).
 */
export function createEmptyVariantSet(): SectionVariantSet {
  return {
    professional: {},
    premium: {},
    friendly: {},
    selectedVariant: null,
    isComplete: false,
    generatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Actions (extends existing DashboardAction type)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dashboard actions specific to guided refinement.
 * These extend the existing DashboardAction discriminated union.
 */
export type GuidedRefinementDashboardAction =
  | {
      type: 'SHOW_VARIANT_WIDGET';
      sectionId: string;
      variants: ToneVariant[];
    }
  | {
      type: 'SHOW_PUBLISH_READY';
    }
  | {
      type: 'HIGHLIGHT_NEXT_SECTION';
      sectionId?: string;
    };

// ─────────────────────────────────────────────────────────────────────────────
// Tool Response Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response from generate_section_variants tool.
 * Includes Active Memory Pattern fields.
 */
export interface GenerateVariantsResponse {
  success: boolean;
  error?: string;
  sectionId?: string;
  sectionType?: string;
  variants?: {
    professional: VariantContent;
    premium: VariantContent;
    friendly: VariantContent;
  };
  recommendation?: ToneVariant;
  rationale?: string;
  /** Active Memory Pattern fields */
  hasDraft?: boolean;
  totalSections?: number;
  currentProgress?: {
    completed: number;
    total: number;
  };
  dashboardAction?: GuidedRefinementDashboardAction;
}

/**
 * Response from apply_section_variant tool.
 */
export interface ApplyVariantResponse {
  success: boolean;
  error?: string;
  verified?: boolean;
  visibility?: 'draft' | 'published';
  sectionId?: string;
  appliedVariant?: ToneVariant;
  updatedContent?: VariantContent;
  hasDraft?: boolean;
  preferenceMemory?: PreferenceMemory;
  message?: string;
  dashboardAction?: GuidedRefinementDashboardAction;
}

/**
 * Response from mark_section_complete tool.
 */
export interface MarkCompleteResponse {
  success: boolean;
  error?: string;
  sectionId?: string;
  completedSections?: string[];
  totalSections?: number;
  allComplete?: boolean;
  mode?: RefinementMode;
  message?: string;
  dashboardAction?: GuidedRefinementDashboardAction;
}

/**
 * Response from get_next_incomplete_section tool.
 */
export interface GetNextSectionResponse {
  success: boolean;
  error?: string;
  allComplete?: boolean;
  nextSection?: {
    sectionId: string;
    type: string;
    headline?: string;
    hasVariants: boolean;
  };
  progress?: {
    completed: number;
    total: number;
  };
  mode?: RefinementMode;
  message?: string;
  dashboardAction?: GuidedRefinementDashboardAction;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Request/Response Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request to generate variants via backend API.
 */
export interface GenerateVariantsRequest {
  sectionId: string;
  sectionType: string;
  currentContent: VariantContent;
  tones: ToneVariant[];
  /** Optional business context for better generation */
  businessContext?: {
    businessType?: string;
    uniqueValue?: string;
    targetAudience?: string;
  };
}

/**
 * Response from /content-generation/generate-variants endpoint.
 */
export interface GenerateVariantsApiResponse {
  variants: Record<ToneVariant, VariantContent>;
  recommendation: ToneVariant;
  rationale: string;
}
