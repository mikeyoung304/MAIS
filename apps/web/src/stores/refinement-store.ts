/**
 * Refinement Store - Zustand store for Guided Refinement UI state
 *
 * This store manages the section-by-section editing experience, tracking:
 * - Current refinement mode
 * - Variant options for each section
 * - Completion progress
 * - User tone preferences
 *
 * The store syncs with ADK session state via dashboard actions from the agent.
 * When the agent calls tools like generate_section_variants, it returns
 * dashboardAction objects that trigger updates to this store.
 *
 * @see docs/plans/2026-02-04-feat-guided-refinement-implementation-plan.md
 * @see server/src/agent-v2/deploy/tenant/src/tools/refinement.ts
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================
// TYPES
// ============================================

/**
 * Refinement mode - matches ADK session state machine
 */
export type RefinementMode =
  | 'interview' // Collecting discovery facts
  | 'draft_build' // Autonomously creating first draft
  | 'guided_refine' // Section-by-section editing with variants
  | 'publish_ready'; // All sections approved, awaiting publish

/**
 * Tone variant options
 */
export type ToneVariant = 'professional' | 'premium' | 'friendly';

/**
 * Variant content structure
 */
export interface VariantContent {
  headline?: string;
  subheadline?: string;
  body?: string;
  content?: string;
  ctaText?: string;
}

/**
 * Set of variants for a section
 */
export interface SectionVariants {
  professional: VariantContent;
  premium: VariantContent;
  friendly: VariantContent;
  /** Currently selected variant (null if none selected) */
  selectedVariant: ToneVariant | null;
  /** Timestamp when variants were generated */
  generatedAt: string;
  /** AI's recommended variant */
  recommendation?: ToneVariant;
  /** Rationale for the recommendation */
  rationale?: string;
}

/**
 * Refinement store state and actions
 */
export interface RefinementState {
  // Current mode in the guided refinement flow
  mode: RefinementMode | null;

  // Section currently being refined
  currentSectionId: string | null;

  // Type of the current section (for display)
  currentSectionType: string | null;

  // Sections that have been completed
  completedSections: string[];

  // Variants for each section (keyed by sectionId)
  sectionVariants: Record<string, SectionVariants>;

  // Loading state for variant generation
  isLoading: boolean;

  // Error message (if any)
  error: string | null;

  // Total sections to refine (from page structure)
  totalSections: number;

  // Widget visibility
  isWidgetVisible: boolean;

  // ========== Actions ==========

  /**
   * Set the current refinement mode
   */
  setMode: (mode: RefinementMode | null) => void;

  /**
   * Set the current section being refined
   */
  setCurrentSection: (sectionId: string | null, sectionType?: string | null) => void;

  /**
   * Store generated variants for a section
   */
  setVariants: (
    sectionId: string,
    variants: {
      professional: VariantContent;
      premium: VariantContent;
      friendly: VariantContent;
    },
    recommendation?: ToneVariant,
    rationale?: string
  ) => void;

  /**
   * Select a variant for the current section
   */
  selectVariant: (sectionId: string, variant: ToneVariant) => void;

  /**
   * Mark a section as complete
   */
  markComplete: (sectionId: string) => void;

  /**
   * Unmark a section as complete (for editing)
   */
  unmarkComplete: (sectionId: string) => void;

  /**
   * Set loading state
   */
  setLoading: (isLoading: boolean) => void;

  /**
   * Set error state
   */
  setError: (error: string | null) => void;

  /**
   * Set total sections count
   */
  setTotalSections: (count: number) => void;

  /**
   * Show/hide the variant widget
   */
  setWidgetVisible: (visible: boolean) => void;

  /**
   * Reset store to initial state
   */
  reset: () => void;

  /**
   * Hydrate store from agent bootstrap data
   */
  hydrate: (data: {
    mode?: string;
    completedSections?: number;
    totalSections?: number;
    currentSectionId?: string | null;
  }) => void;
}

// ============================================
// INITIAL STATE
// ============================================

const initialState = {
  mode: null as RefinementMode | null,
  currentSectionId: null as string | null,
  currentSectionType: null as string | null,
  completedSections: [] as string[],
  sectionVariants: {} as Record<string, SectionVariants>,
  isLoading: false,
  error: null as string | null,
  totalSections: 7, // Default total
  isWidgetVisible: false,
};

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useRefinementStore = create<RefinementState>()(
  devtools(
    subscribeWithSelector(
      immer((set) => ({
        ...initialState,

        setMode: (mode) =>
          set((state) => {
            state.mode = mode;
            // Auto-show widget when entering guided_refine
            if (mode === 'guided_refine') {
              state.isWidgetVisible = true;
            }
            // Hide widget when leaving guided_refine
            if (mode === 'publish_ready' || mode === 'interview' || mode === null) {
              state.isWidgetVisible = false;
            }
          }),

        setCurrentSection: (sectionId, sectionType = null) =>
          set((state) => {
            state.currentSectionId = sectionId;
            state.currentSectionType = sectionType;
            // Show widget when a section is selected
            if (sectionId && state.mode === 'guided_refine') {
              state.isWidgetVisible = true;
            }
          }),

        setVariants: (sectionId, variants, recommendation, rationale) =>
          set((state) => {
            state.sectionVariants[sectionId] = {
              professional: variants.professional,
              premium: variants.premium,
              friendly: variants.friendly,
              selectedVariant: null,
              generatedAt: new Date().toISOString(),
              recommendation,
              rationale,
            };
            state.isLoading = false;
            state.isWidgetVisible = true;
          }),

        selectVariant: (sectionId, variant) =>
          set((state) => {
            if (state.sectionVariants[sectionId]) {
              state.sectionVariants[sectionId].selectedVariant = variant;
            }
          }),

        markComplete: (sectionId) =>
          set((state) => {
            if (!state.completedSections.includes(sectionId)) {
              state.completedSections.push(sectionId);
            }
            // Mark variant set as having a selection (preserve selected variant)
            if (state.sectionVariants[sectionId]) {
              // Keep the selected variant
            }
            // Check if all complete
            if (state.completedSections.length >= state.totalSections) {
              state.mode = 'publish_ready';
              state.isWidgetVisible = false;
            }
          }),

        unmarkComplete: (sectionId) =>
          set((state) => {
            state.completedSections = state.completedSections.filter((id) => id !== sectionId);
            // Return to guided_refine mode if we were in publish_ready
            if (state.mode === 'publish_ready') {
              state.mode = 'guided_refine';
              state.isWidgetVisible = true;
            }
          }),

        setLoading: (isLoading) =>
          set((state) => {
            state.isLoading = isLoading;
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
            state.isLoading = false;
          }),

        setTotalSections: (count) =>
          set((state) => {
            state.totalSections = count;
          }),

        setWidgetVisible: (visible) =>
          set((state) => {
            state.isWidgetVisible = visible;
          }),

        reset: () => set(initialState),

        hydrate: (data) =>
          set((state) => {
            if (data.mode) {
              state.mode = data.mode as RefinementMode;
            }
            if (data.totalSections !== undefined) {
              state.totalSections = data.totalSections;
            }
            if (data.completedSections !== undefined) {
              // Convert count to empty array (we don't have the IDs from hint)
              // The actual IDs will come from subsequent tool calls
            }
            if (data.currentSectionId !== undefined) {
              state.currentSectionId = data.currentSectionId;
            }
            // Show widget if in guided_refine mode
            if (data.mode === 'guided_refine') {
              state.isWidgetVisible = true;
            }
          }),
      }))
    ),
    { name: 'refinement-store' }
  )
);

// ============================================
// EXPOSED ACTIONS - For agent handlers (outside React)
// ============================================

/**
 * Refinement actions accessible outside React components
 *
 * These allow agent dashboard action handlers to update the refinement UI
 * without needing React hooks.
 *
 * @example
 * // In AgentPanel handleDashboardActions:
 * if (action.type === 'SHOW_VARIANT_WIDGET') {
 *   refinementActions.setVariants(action.sectionId, action.variants);
 * }
 */
export const refinementActions = {
  setMode: (mode: RefinementMode | null) => useRefinementStore.getState().setMode(mode),

  setCurrentSection: (sectionId: string | null, sectionType?: string | null) =>
    useRefinementStore.getState().setCurrentSection(sectionId, sectionType),

  setVariants: (
    sectionId: string,
    variants: {
      professional: VariantContent;
      premium: VariantContent;
      friendly: VariantContent;
    },
    recommendation?: ToneVariant,
    rationale?: string
  ) => useRefinementStore.getState().setVariants(sectionId, variants, recommendation, rationale),

  selectVariant: (sectionId: string, variant: ToneVariant) =>
    useRefinementStore.getState().selectVariant(sectionId, variant),

  markComplete: (sectionId: string) => useRefinementStore.getState().markComplete(sectionId),

  unmarkComplete: (sectionId: string) => useRefinementStore.getState().unmarkComplete(sectionId),

  setLoading: (isLoading: boolean) => useRefinementStore.getState().setLoading(isLoading),

  setError: (error: string | null) => useRefinementStore.getState().setError(error),

  setTotalSections: (count: number) => useRefinementStore.getState().setTotalSections(count),

  setWidgetVisible: (visible: boolean) => useRefinementStore.getState().setWidgetVisible(visible),

  reset: () => useRefinementStore.getState().reset(),

  hydrate: (data: {
    mode?: string;
    completedSections?: number;
    totalSections?: number;
    currentSectionId?: string | null;
  }) => useRefinementStore.getState().hydrate(data),
};

// ============================================
// SELECTORS - Memoized for performance
// ============================================

/**
 * Select current refinement mode
 */
export const selectRefinementMode = (state: RefinementState) => state.mode;

/**
 * Select current section ID
 */
export const selectCurrentSectionId = (state: RefinementState) => state.currentSectionId;

/**
 * Select current section type
 */
export const selectCurrentSectionType = (state: RefinementState) => state.currentSectionType;

/**
 * Select variants for a specific section
 */
export const selectSectionVariants = (sectionId: string) => (state: RefinementState) =>
  state.sectionVariants[sectionId] || null;

/**
 * Select variants for the current section
 */
export const selectCurrentVariants = (state: RefinementState) =>
  state.currentSectionId ? state.sectionVariants[state.currentSectionId] || null : null;

/**
 * Select whether a section is complete
 */
export const selectIsSectionComplete = (sectionId: string) => (state: RefinementState) =>
  state.completedSections.includes(sectionId);

/**
 * Select completion progress
 */
export const selectProgress = (state: RefinementState) => ({
  completed: state.completedSections.length,
  total: state.totalSections,
  percentage:
    state.totalSections > 0 ? (state.completedSections.length / state.totalSections) * 100 : 0,
});

/**
 * Select loading state
 */
export const selectIsLoading = (state: RefinementState) => state.isLoading;

/**
 * Select error state
 */
export const selectError = (state: RefinementState) => state.error;

/**
 * Select widget visibility
 */
export const selectIsWidgetVisible = (state: RefinementState) => state.isWidgetVisible;

/**
 * Select whether all sections are complete
 */
export const selectAllComplete = (state: RefinementState) =>
  state.completedSections.length >= state.totalSections;

/**
 * Select whether in guided refine mode
 */
export const selectIsInGuidedRefine = (state: RefinementState) => state.mode === 'guided_refine';

/**
 * Select whether ready to publish
 */
export const selectIsPublishReady = (state: RefinementState) => state.mode === 'publish_ready';

// ============================================
// E2E TEST SUPPORT - Expose on window for Playwright
// ============================================

if (typeof window !== 'undefined') {
  (window as unknown as { useRefinementStore: typeof useRefinementStore }).useRefinementStore =
    useRefinementStore;
  (window as unknown as { refinementActions: typeof refinementActions }).refinementActions =
    refinementActions;
}
