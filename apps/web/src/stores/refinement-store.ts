/**
 * Refinement Store - Zustand store for onboarding + guided review UI state
 *
 * This store manages the section-by-section review experience, tracking:
 * - Current onboarding mode (discovering → building → reviewing → publish_ready)
 * - Section completion progress
 * - Publish status
 *
 * The store syncs with ADK session state via dashboard actions from the agent.
 * Server-side uses different mode names (interview/draft_build/guided_refine)
 * which are mapped in hydrate().
 *
 * @see docs/plans/2026-02-06-feat-dashboard-onboarding-rebuild-plan.md
 * @see server/src/agent-v2/deploy/tenant/src/tools/refinement.ts
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { SECTION_BLUEPRINT } from '@macon/contracts';

// ============================================
// TYPES
// ============================================

/**
 * Onboarding/refinement mode — frontend-facing names.
 *
 * Server-side ADK session uses different names:
 *   interview → discovering, draft_build → building, guided_refine → reviewing
 * Mapping happens in hydrate() via SERVER_TO_CLIENT_MODE.
 */
export type RefinementMode =
  | 'discovering' // Collecting discovery facts (server: 'interview')
  | 'building' // Autonomously creating first draft (server: 'draft_build')
  | 'reviewing' // Section-by-section guided review (server: 'guided_refine')
  | 'publish_ready'; // All sections approved, awaiting publish

/**
 * Valid mode transitions — prevents impossible state jumps.
 * In dev mode, invalid transitions log a warning.
 */
const VALID_TRANSITIONS: Record<RefinementMode, RefinementMode[]> = {
  discovering: ['building'],
  building: ['reviewing'],
  reviewing: ['publish_ready'],
  publish_ready: ['reviewing'], // User wants to re-review
};

/**
 * Map server-side ADK mode names → frontend mode names.
 * The ADK session state uses the old naming convention.
 */
const SERVER_TO_CLIENT_MODE: Record<string, RefinementMode> = {
  interview: 'discovering',
  draft_build: 'building',
  guided_refine: 'reviewing',
  publish_ready: 'publish_ready',
  // Also accept the new names directly (frontend-originated)
  discovering: 'discovering',
  building: 'building',
  reviewing: 'reviewing',
};

/**
 * Publish status — tracks the publish lifecycle.
 */
export type PublishStatus = 'idle' | 'publishing' | 'published';

/**
 * Refinement store state and actions
 */
export interface RefinementState {
  // Current mode in the onboarding/review flow
  mode: RefinementMode | null;

  // Section currently being reviewed
  currentSectionId: string | null;

  // Type of the current section (for display)
  currentSectionType: string | null;

  // Sections that have been completed/approved
  completedSections: string[];

  // Loading state
  isLoading: boolean;

  // Error message (if any)
  error: string | null;

  // Total sections to review (from section blueprint)
  totalSections: number;

  // Publish lifecycle status
  publishStatus: PublishStatus;

  // ========== Actions ==========

  /**
   * Set the current refinement mode (with transition validation in dev)
   */
  setMode: (mode: RefinementMode | null) => void;

  /**
   * Set the current section being reviewed
   */
  setCurrentSection: (sectionId: string | null, sectionType?: string | null) => void;

  /**
   * Mark a section as complete/approved
   */
  markComplete: (sectionId: string) => void;

  /**
   * Unmark a section as complete (for re-review)
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
   * Set publish status
   */
  setPublishStatus: (status: PublishStatus) => void;

  /**
   * Reset store to initial state
   */
  reset: () => void;

  /**
   * Hydrate store from agent bootstrap data.
   * Maps server-side mode names to frontend names via SERVER_TO_CLIENT_MODE.
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
  isLoading: false,
  error: null as string | null,
  totalSections: SECTION_BLUEPRINT.length, // Derived from single source of truth
  publishStatus: 'idle' as PublishStatus,
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
            // Validate transition in dev mode
            if (process.env.NODE_ENV === 'development' && state.mode && mode) {
              const valid = VALID_TRANSITIONS[state.mode];
              if (valid && !valid.includes(mode)) {
                console.warn(
                  `[refinement-store] Invalid mode transition: ${state.mode} → ${mode}. Valid: ${valid.join(', ')}`
                );
              }
            }
            state.mode = mode;
          }),

        setCurrentSection: (sectionId, sectionType = null) =>
          set((state) => {
            state.currentSectionId = sectionId;
            state.currentSectionType = sectionType;
          }),

        markComplete: (sectionId) =>
          set((state) => {
            if (!state.completedSections.includes(sectionId)) {
              state.completedSections.push(sectionId);
            }
            // Auto-advance to publish_ready when all sections reviewed
            if (state.completedSections.length >= state.totalSections) {
              state.mode = 'publish_ready';
            }
          }),

        unmarkComplete: (sectionId) =>
          set((state) => {
            state.completedSections = state.completedSections.filter((id) => id !== sectionId);
            // Return to reviewing mode if we were in publish_ready
            if (state.mode === 'publish_ready') {
              state.mode = 'reviewing';
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

        setPublishStatus: (status) =>
          set((state) => {
            state.publishStatus = status;
          }),

        reset: () => set(initialState),

        hydrate: (data) =>
          set((state) => {
            if (data.mode) {
              // Map server-side mode names → frontend names
              const mapped = SERVER_TO_CLIENT_MODE[data.mode];
              if (mapped) {
                state.mode = mapped;
              } else if (process.env.NODE_ENV === 'development') {
                console.warn(`[refinement-store] Unknown server mode: ${data.mode}`);
              }
            }
            if (data.totalSections !== undefined) {
              state.totalSections = data.totalSections;
            }
            if (data.currentSectionId !== undefined) {
              state.currentSectionId = data.currentSectionId;
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
 * if (action.type === 'HIGHLIGHT_NEXT_SECTION') {
 *   refinementActions.setCurrentSection(action.sectionId, action.sectionType);
 * }
 */
export const refinementActions = {
  setMode: (mode: RefinementMode | null) => useRefinementStore.getState().setMode(mode),

  setCurrentSection: (sectionId: string | null, sectionType?: string | null) =>
    useRefinementStore.getState().setCurrentSection(sectionId, sectionType),

  markComplete: (sectionId: string) => useRefinementStore.getState().markComplete(sectionId),

  unmarkComplete: (sectionId: string) => useRefinementStore.getState().unmarkComplete(sectionId),

  setLoading: (isLoading: boolean) => useRefinementStore.getState().setLoading(isLoading),

  setError: (error: string | null) => useRefinementStore.getState().setError(error),

  setTotalSections: (count: number) => useRefinementStore.getState().setTotalSections(count),

  setPublishStatus: (status: PublishStatus) =>
    useRefinementStore.getState().setPublishStatus(status),

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
 * Select whether a section is complete
 */
export const selectIsSectionComplete = (sectionId: string) => (state: RefinementState) =>
  state.completedSections.includes(sectionId);

/**
 * Select count of completed sections (primitive — safe for Zustand ===)
 */
export const selectCompletedCount = (state: RefinementState) => state.completedSections.length;

/**
 * Select total sections count (primitive — safe for Zustand ===)
 */
export const selectTotalSections = (state: RefinementState) => state.totalSections;

/**
 * Select completion percentage (primitive — safe for Zustand ===)
 */
export const selectCompletionPercentage = (state: RefinementState) =>
  state.totalSections > 0 ? (state.completedSections.length / state.totalSections) * 100 : 0;

/**
 * Select completion progress as an object.
 *
 * @deprecated Returns a new object on every call, causing unnecessary re-renders
 * with Zustand's default === equality check (Pitfall #87). Use the individual
 * primitive selectors instead: selectCompletedCount, selectTotalSections,
 * selectCompletionPercentage.
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
 * Select whether all sections are complete
 */
export const selectAllComplete = (state: RefinementState) =>
  state.completedSections.length >= state.totalSections;

/**
 * Select whether in reviewing mode (agent-driven guided review)
 */
export const selectIsReviewing = (state: RefinementState) => state.mode === 'reviewing';

/**
 * Select whether ready to publish
 */
export const selectIsPublishReady = (state: RefinementState) => state.mode === 'publish_ready';

/**
 * Select publish status
 */
export const selectPublishStatus = (state: RefinementState) => state.publishStatus;

// ============================================
// E2E TEST SUPPORT - Expose on window for Playwright
// ============================================

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { useRefinementStore: typeof useRefinementStore }).useRefinementStore =
    useRefinementStore;
  (window as unknown as { refinementActions: typeof refinementActions }).refinementActions =
    refinementActions;
}
