/**
 * Agent UI Store - Zustand store for agent-controlled UI state
 *
 * This store powers the Agent-First Dashboard Architecture where the AI chatbot
 * controls what's displayed in the content area.
 *
 * Key Features:
 * - Discriminated unions eliminate impossible states at compile time
 * - Event sourcing provides audit trail, debugging, and undo/redo capability
 * - Tenant-scoped stores enforce security isolation
 * - Exposed actions allow agent tool handlers (outside React) to update UI
 *
 * Trust Tiers (for agent actions):
 * - T1: Auto-confirm (navigation, view changes)
 * - T2: Soft-confirm (content edits)
 * - T3: Hard-confirm (publish, discard - critical actions)
 *
 * @see plans/agent-first-dashboard-architecture.md
 */

import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { PageName } from '@macon/contracts';

// Maximum number of actions to keep in the log (FIFO buffer - oldest removed first)
const MAX_ACTION_LOG_SIZE = 100;

// ============================================
// COMING SOON - Lightweight fact progress for onboarding display
// ============================================

/**
 * Slot metrics from store_discovery_fact tool result.
 * Tracks how many facts the agent has discovered vs total possible.
 */
export interface SlotMetrics {
  filled: number;
  total: number;
}

/**
 * State for the "Coming Soon" display during onboarding.
 * Updated in real-time from agent tool results (<200ms, no network round-trip).
 */
export interface ComingSoonState {
  /** Ordered list of discovered fact keys (e.g., ['businessType', 'location']) */
  discoveredKeys: string[];
  /** Slot metrics from the slot machine */
  slotMetrics: SlotMetrics;
}

// ============================================
// DISCRIMINATED UNIONS - Eliminate impossible states
// ============================================

/**
 * Preview configuration when showing storefront preview
 */
interface PreviewConfig {
  /** @deprecated Multi-page model removed — always 'home' (single scrolling page). Remove in follow-up PR. */
  currentPage: PageName;
  /** Section ID to highlight (format: {page}-{type}-{qualifier}) */
  highlightedSectionId: string | null;
}

/**
 * View state discriminated union — EXHAUSTIVE, no default case in switch
 *
 * TypeScript ensures only ONE state is active at a time.
 * ContentArea switches on `status` with a `never` exhaustiveness check.
 *
 * States:
 * - 'coming_soon': Pre-build onboarding (Discovery + Building phases)
 * - 'revealing': One-shot animated reveal when first draft completes (2.5s)
 * - 'preview': Storefront preview (Review + Published phases)
 * - 'dashboard': Stats/Insights (post-publish, accessed via sidebar)
 * - 'loading': Transitional state between views
 * - 'error': Something went wrong with recovery option
 */
export type ViewState =
  | { status: 'coming_soon' }
  | { status: 'revealing' }
  | { status: 'dashboard' }
  | { status: 'preview'; config: PreviewConfig }
  | { status: 'loading'; target: string }
  | { status: 'error'; error: string; recovery?: () => void };

/**
 * Valid ViewState transitions — prevents impossible state jumps.
 * coming_soon is locked: only revealSite() can exit it.
 *
 * Enforced inline via guards in showPreview/showDashboard/highlightSection.
 *
 * coming_soon  → revealing
 * revealing    → preview
 * preview      → dashboard | loading | error | preview (page/highlight changes)
 * dashboard    → preview | coming_soon | loading | error
 * loading      → preview | dashboard | error
 * error        → dashboard | preview
 */

// ============================================
// EVENT SOURCING - Audit trail for all actions
// ============================================

/**
 * Event Sourcing / Undo Scaffolding
 *
 * The actionLog and undoLastAction() are scaffolding for the planned undo/redo feature.
 * Currently used only in tests but architecture is in place for Phase X implementation.
 *
 * @see plans/agent-first-dashboard-architecture.md (Future Considerations - Undo/Redo)
 */

/**
 * Agent action types for event log
 *
 * Every UI-controlling action is logged with:
 * - What happened (type)
 * - Details (payload)
 * - When (timestamp)
 * - Who triggered it (agentSessionId or null for user)
 * - Which tenant (tenantId for security)
 */
export type AgentActionType =
  | 'SHOW_PREVIEW'
  | 'HIDE_PREVIEW'
  | 'SHOW_COMING_SOON'
  | 'REVEAL_SITE'
  | 'HIGHLIGHT_SECTION'
  | 'SET_PAGE'
  | 'SET_ERROR';

/**
 * Base fields shared by all agent actions
 */
interface AgentActionBase {
  id: string;
  timestamp: number;
  /** Agent session ID if triggered by agent, null if by user */
  agentSessionId: string | null;
  /** Tenant ID for security isolation */
  tenantId: string;
}

/**
 * Agent action event for audit log - discriminated union by type
 *
 * Each action type has a specific payload shape, enabling TypeScript
 * to narrow the payload type based on the action type.
 */
export type AgentAction =
  | (AgentActionBase & { type: 'SHOW_PREVIEW'; payload: { page: PageName } })
  | (AgentActionBase & { type: 'HIDE_PREVIEW'; payload: Record<string, never> })
  | (AgentActionBase & { type: 'SHOW_COMING_SOON'; payload: Record<string, never> })
  | (AgentActionBase & { type: 'REVEAL_SITE'; payload: Record<string, never> })
  | (AgentActionBase & { type: 'HIGHLIGHT_SECTION'; payload: { sectionId: string } })
  | (AgentActionBase & { type: 'SET_PAGE'; payload: { page: PageName } })
  | (AgentActionBase & { type: 'SET_ERROR'; payload: { error: string } });

// ============================================
// STORE INTERFACE
// ============================================

/**
 * Agent UI Store state and actions
 */
export interface AgentUIState {
  // Current view state (discriminated union)
  view: ViewState;

  // Draft dirty state (has unpublished changes)
  isDirty: boolean;

  // Preview refresh key - increment to force iframe reload
  // Used when packages or other server-rendered data changes
  previewRefreshKey: number;

  // Event log for audit/debugging/undo
  actionLog: AgentAction[];

  // Tenant scope (security - all actions require this)
  tenantId: string | null;

  // Conflict dialog state (#620 - optimistic locking)
  // True when agent tool returns CONCURRENT_MODIFICATION error
  showConflictDialog: boolean;

  // Coming Soon display state (onboarding progress dots)
  comingSoon: ComingSoonState;

  // ========== Actions ==========

  /**
   * Initialize store with tenant ID
   * MUST be called before any other action
   */
  initialize: (tenantId: string) => void;

  /**
   * Show storefront preview in content area (T1)
   * @param page Which page to show (defaults to 'home')
   * @param agentSessionId Optional agent session for audit
   */
  showPreview: (page?: PageName, agentSessionId?: string | null) => void;

  /**
   * Return to dashboard view (T1)
   * @param agentSessionId Optional agent session for audit
   */
  showDashboard: (agentSessionId?: string | null) => void;

  /**
   * Show "Coming Soon" view for pre-build onboarding (T1)
   * Used during Discovery and Building phases when site isn't built yet.
   */
  showComingSoon: (agentSessionId?: string | null) => void;

  /**
   * Trigger reveal animation (T1)
   * One-shot: stored in backend via revealCompletedAt. Component owns timer.
   */
  revealSite: (agentSessionId?: string | null) => void;

  /**
   * Highlight a section in the preview (T1)
   * Auto-navigates to the correct page if needed
   * @param sectionId Section ID (format: {page}-{type}-{qualifier})
   * @param agentSessionId Optional agent session for audit
   */
  highlightSection: (sectionId: string, agentSessionId?: string | null) => void;

  /**
   * Clear section highlight
   */
  clearHighlight: () => void;

  /**
   * Set page within preview
   * @param page Page to navigate to
   */
  setPreviewPage: (page: PageName) => void;

  /**
   * Set dirty state (has unpublished changes)
   */
  setDirty: (dirty: boolean) => void;

  /**
   * Force preview iframe to refresh
   * Call after package updates or other server-side data changes
   * that can't be updated via PostMessage
   */
  refreshPreview: () => void;

  /**
   * Set error state with optional recovery function
   */
  setError: (error: string, recovery?: () => void) => void;

  /**
   * Clear error and return to dashboard
   */
  clearError: () => void;

  /**
   * Show/hide conflict dialog (#620 - optimistic locking)
   * Called when agent tool returns CONCURRENT_MODIFICATION error
   */
  setShowConflictDialog: (show: boolean) => void;

  /**
   * Add a discovered fact from store_discovery_fact tool result.
   * Updates progress dots in ComingSoonDisplay within <200ms.
   */
  addDiscoveredFact: (key: string, slotMetrics: SlotMetrics) => void;

  // ========== Event Sourcing ==========

  /**
   * Get full action log for debugging/audit
   */
  getActionLog: () => AgentAction[];

  /**
   * Undo the last action
   */
  undoLastAction: () => void;
}

// ============================================
// HELPERS
// ============================================

/**
 * Generate unique action ID
 */
const generateActionId = () => `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/**
 * Append an action to the FIFO log, evicting the oldest if at capacity.
 * O(n) shift is acceptable at MAX_ACTION_LOG_SIZE=100.
 */
function appendToActionLog(actionLog: AgentAction[], action: AgentAction): void {
  actionLog.push(action);
  if (actionLog.length > MAX_ACTION_LOG_SIZE) {
    actionLog.shift();
  }
}

/**
 * Extract page name from section ID
 * @param sectionId Format: {page}-{type}-{qualifier}
 * @returns Page name or null if invalid
 */
const extractPageFromSectionId = (sectionId: string): PageName | null => {
  const parts = sectionId.split('-');
  if (parts.length < 3) return null;

  const page = parts[0] as PageName;
  const validPages: PageName[] = [
    'home',
    'about',
    'services',
    'faq',
    'contact',
    'gallery',
    'testimonials',
  ];

  return validPages.includes(page) ? page : null;
};

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useAgentUIStore = create<AgentUIState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        view: { status: 'dashboard' },
        isDirty: false,
        previewRefreshKey: 0,
        actionLog: [],
        tenantId: null,
        showConflictDialog: false,
        comingSoon: { discoveredKeys: [], slotMetrics: { filled: 0, total: 0 } },

        // Initialize with tenant
        initialize: (tenantId) =>
          set((state) => {
            state.tenantId = tenantId;
            state.view = { status: 'dashboard' };
            state.actionLog = [];
            state.isDirty = false;
          }),

        // Show preview
        showPreview: (page = 'home', agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return; // Security: require tenant
            // Guard: only revealSite() can transition away from coming_soon
            if (state.view.status === 'coming_soon') return;

            const action: AgentAction = {
              id: generateActionId(),
              type: 'SHOW_PREVIEW',
              payload: { page },
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            appendToActionLog(state.actionLog, action);
            state.view = {
              status: 'preview',
              config: { currentPage: page, highlightedSectionId: null },
            };
          }),

        // Show dashboard
        showDashboard: (agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return;
            // Guard: only revealSite() can transition away from coming_soon
            if (state.view.status === 'coming_soon') return;

            const action: AgentAction = {
              id: generateActionId(),
              type: 'HIDE_PREVIEW',
              payload: {},
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            appendToActionLog(state.actionLog, action);
            state.view = { status: 'dashboard' };
          }),

        // Show Coming Soon (pre-build onboarding)
        showComingSoon: (agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return;

            const action: AgentAction = {
              id: generateActionId(),
              type: 'SHOW_COMING_SOON',
              payload: {},
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            appendToActionLog(state.actionLog, action);
            state.view = { status: 'coming_soon' };
          }),

        // Reveal site (one-shot animation trigger — component owns the timer)
        revealSite: (agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return;

            const action: AgentAction = {
              id: generateActionId(),
              type: 'REVEAL_SITE',
              payload: {},
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            appendToActionLog(state.actionLog, action);
            state.view = { status: 'revealing' };
          }),

        // Highlight section
        highlightSection: (sectionId, agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return;
            if (state.view.status === 'coming_soon') return; // Guard: only revealSite exits coming_soon

            const action: AgentAction = {
              id: generateActionId(),
              type: 'HIGHLIGHT_SECTION',
              payload: { sectionId },
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            appendToActionLog(state.actionLog, action);

            // Extract page from section ID
            const pageFromId = extractPageFromSectionId(sectionId);

            // If not in preview, switch to preview
            if (state.view.status !== 'preview') {
              state.view = {
                status: 'preview',
                config: {
                  currentPage: pageFromId || 'home',
                  highlightedSectionId: sectionId,
                },
              };
            } else {
              // Already in preview - update page if needed and highlight
              const currentPage = pageFromId || state.view.config.currentPage;
              state.view = {
                status: 'preview',
                config: {
                  currentPage,
                  highlightedSectionId: sectionId,
                },
              };
            }
          }),

        // Clear highlight
        clearHighlight: () =>
          set((state) => {
            if (state.view.status === 'preview') {
              state.view.config.highlightedSectionId = null;
            }
          }),

        /** @deprecated Multi-page model removed — always 'home'. Remove in follow-up PR. */
        setPreviewPage: (page) =>
          set((state) => {
            if (!state.tenantId) return;

            if (state.view.status === 'preview') {
              const action: AgentAction = {
                id: generateActionId(),
                type: 'SET_PAGE',
                payload: { page },
                timestamp: Date.now(),
                agentSessionId: null,
                tenantId: state.tenantId,
              };

              appendToActionLog(state.actionLog, action);
              state.view.config.currentPage = page;
              state.view.config.highlightedSectionId = null;
            }
          }),

        // Set dirty state
        setDirty: (dirty) =>
          set((state) => {
            state.isDirty = dirty;
          }),

        // Force preview refresh
        refreshPreview: () =>
          set((state) => {
            state.previewRefreshKey += 1;
          }),

        // Set error
        setError: (error, recovery) =>
          set((state) => {
            if (!state.tenantId) return;

            const action: AgentAction = {
              id: generateActionId(),
              type: 'SET_ERROR',
              payload: { error },
              timestamp: Date.now(),
              agentSessionId: null,
              tenantId: state.tenantId,
            };

            appendToActionLog(state.actionLog, action);
            state.view = { status: 'error', error, recovery };
          }),

        // Clear error
        clearError: () =>
          set((state) => {
            state.view = { status: 'dashboard' };
          }),

        // Show/hide conflict dialog (#620 - optimistic locking)
        setShowConflictDialog: (show) =>
          set((state) => {
            state.showConflictDialog = show;
          }),

        // Add discovered fact (real-time from agent tool results)
        addDiscoveredFact: (key, slotMetrics) =>
          set((state) => {
            // Deduplicate — a fact key can only appear once
            if (!state.comingSoon.discoveredKeys.includes(key)) {
              state.comingSoon.discoveredKeys.push(key);
            }
            state.comingSoon.slotMetrics = slotMetrics;
          }),

        // Get action log
        getActionLog: () => get().actionLog,

        // Undo last action
        undoLastAction: () =>
          set((state) => {
            const lastAction = state.actionLog.pop();
            if (!lastAction) return;

            // Reverse the action based on type
            switch (lastAction.type) {
              case 'SHOW_PREVIEW':
                state.view = { status: 'dashboard' };
                break;
              case 'HIDE_PREVIEW':
                state.view = {
                  status: 'preview',
                  config: { currentPage: 'home', highlightedSectionId: null },
                };
                break;
              case 'SHOW_COMING_SOON':
                state.view = { status: 'dashboard' };
                break;
              case 'REVEAL_SITE':
                state.view = { status: 'coming_soon' };
                break;
              case 'HIGHLIGHT_SECTION':
                if (state.view.status === 'preview') {
                  state.view.config.highlightedSectionId = null;
                }
                break;
              case 'SET_PAGE':
                // Can't easily undo page change without tracking previous
                break;
              case 'SET_ERROR':
                state.view = { status: 'dashboard' };
                break;
            }
          }),
      }))
    ),
    { name: 'agent-ui-store' }
  )
);

// ============================================
// EXPOSED ACTIONS - For agent tool handlers (outside React)
// ============================================

/**
 * Agent UI actions accessible outside React components
 *
 * These allow agent tool handlers in the chat response processing
 * to control the UI without needing React hooks.
 *
 * @example
 * // In agent response handler:
 * if (response.uiAction?.type === 'SHOW_PREVIEW') {
 *   agentUIActions.showPreview(response.uiAction.page, sessionId);
 * }
 */
export const agentUIActions = {
  showPreview: (page?: PageName, agentSessionId?: string | null) =>
    useAgentUIStore.getState().showPreview(page, agentSessionId),

  showDashboard: (agentSessionId?: string | null) =>
    useAgentUIStore.getState().showDashboard(agentSessionId),

  showComingSoon: (agentSessionId?: string | null) =>
    useAgentUIStore.getState().showComingSoon(agentSessionId),

  revealSite: (agentSessionId?: string | null) =>
    useAgentUIStore.getState().revealSite(agentSessionId),

  highlightSection: (sectionId: string, agentSessionId?: string | null) =>
    useAgentUIStore.getState().highlightSection(sectionId, agentSessionId),

  clearHighlight: () => useAgentUIStore.getState().clearHighlight(),

  /** @deprecated Multi-page model removed — always 'home'. Remove in follow-up PR. */
  setPreviewPage: (page: PageName) => useAgentUIStore.getState().setPreviewPage(page),

  setDirty: (dirty: boolean) => useAgentUIStore.getState().setDirty(dirty),

  refreshPreview: () => useAgentUIStore.getState().refreshPreview(),

  setError: (error: string, recovery?: () => void) =>
    useAgentUIStore.getState().setError(error, recovery),

  clearError: () => useAgentUIStore.getState().clearError(),

  setShowConflictDialog: (show: boolean) => useAgentUIStore.getState().setShowConflictDialog(show),

  addDiscoveredFact: (key: string, slotMetrics: SlotMetrics) =>
    useAgentUIStore.getState().addDiscoveredFact(key, slotMetrics),

  getActionLog: () => useAgentUIStore.getState().getActionLog(),

  undoLastAction: () => useAgentUIStore.getState().undoLastAction(),
};

// ============================================
// SELECTORS - Memoized for performance
// ============================================

/**
 * Select current view status
 */
export const selectViewStatus = (state: AgentUIState) => state.view.status;

/**
 * Select preview config (null if not in preview)
 */
export const selectPreviewConfig = (state: AgentUIState) =>
  state.view.status === 'preview' ? state.view.config : null;

/**
 * Select whether preview is active
 */
export const selectIsPreviewActive = (state: AgentUIState) => state.view.status === 'preview';

/**
 * Select dirty state
 */
export const selectIsDirty = (state: AgentUIState) => state.isDirty;

/**
 * Select preview refresh key (increment triggers iframe reload)
 */
export const selectPreviewRefreshKey = (state: AgentUIState) => state.previewRefreshKey;

/**
 * @deprecated Multi-page model removed — always returns 'home'. Remove in follow-up PR.
 */
export const selectCurrentPage = (state: AgentUIState) =>
  state.view.status === 'preview' ? state.view.config.currentPage : null;

/**
 * Select highlighted section ID (or null)
 */
export const selectHighlightedSectionId = (state: AgentUIState) =>
  state.view.status === 'preview' ? state.view.config.highlightedSectionId : null;

/**
 * Select error message (or null)
 */
export const selectError = (state: AgentUIState) =>
  state.view.status === 'error' ? state.view.error : null;

/**
 * Select whether store is initialized
 */
export const selectIsInitialized = (state: AgentUIState) => state.tenantId !== null;

/**
 * Select whether view is in an onboarding state (coming_soon or revealing)
 * Used by layout to hide sidebar during onboarding.
 */
export const selectIsOnboardingView = (state: AgentUIState) =>
  state.view.status === 'coming_soon' || state.view.status === 'revealing';

/**
 * Select conflict dialog visibility (#620 - optimistic locking)
 */
export const selectShowConflictDialog = (state: AgentUIState) => state.showConflictDialog;

// ============================================
// E2E TEST SUPPORT - Expose on window for Playwright
// ============================================

/**
 * Expose store and actions on window for E2E testing
 *
 * Only runs in browser (not SSR) and exposes:
 * - window.useAgentUIStore - Direct store access
 * - window.agentUIActions - Action helpers
 *
 * This allows E2E tests to:
 * 1. Initialize store with tenantId
 * 2. Trigger actions like showPreview, showDashboard
 * 3. Assert on store state
 *
 * @see e2e/tests/agent-ui-control.spec.ts
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as { useAgentUIStore: typeof useAgentUIStore }).useAgentUIStore =
    useAgentUIStore;
  (window as unknown as { agentUIActions: typeof agentUIActions }).agentUIActions = agentUIActions;
}
