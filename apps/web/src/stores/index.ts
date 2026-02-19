/**
 * Store Exports
 *
 * Central export point for all Zustand stores.
 * Use named imports for tree-shaking.
 *
 * @example
 * import { useAgentUIStore, agentUIActions, selectIsPreviewActive } from '@/stores';
 */

export {
  // Store hook
  useAgentUIStore,
  // External actions (for non-React code)
  agentUIActions,
  // Selectors
  selectViewStatus,
  selectPreviewConfig,
  selectIsPreviewActive,
  selectIsDirty,
  selectHighlightedSectionId,
  selectError,
  selectIsInitialized,
  selectIsOnboardingView,
  selectPreviewRefreshKey,
  // Types
  type ViewState,
  type AgentAction,
  type AgentActionType,
  type AgentUIState,
} from './agent-ui-store';

export {
  // Session store hook
  useAgentSessionStore,
  // Helper functions
  getAgentSessionId,
  isAgentSessionValid,
} from './agent-session-store';

export {
  // Refinement store hook
  useRefinementStore,
  // External actions (for non-React code)
  refinementActions,
  // Selectors
  selectRefinementMode,
  selectCurrentSectionId,
  selectCurrentSectionType,
  selectIsSectionComplete,
  selectCompletedCount,
  selectTotalSections,
  selectCompletionPercentage,
  selectIsLoading as selectRefinementLoading,
  selectError as selectRefinementError,
  selectAllComplete,
  selectIsReviewing,
  selectIsPublishReady,
  selectPublishStatus,
  // Types
  type RefinementMode,
  type PublishStatus,
  type RefinementState,
} from './refinement-store';
