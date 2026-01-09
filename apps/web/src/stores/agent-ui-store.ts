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
// DISCRIMINATED UNIONS - Eliminate impossible states
// ============================================

/**
 * Preview configuration when showing storefront preview
 */
interface PreviewConfig {
  /** Which page is currently shown in preview */
  currentPage: PageName;
  /** Section ID to highlight (format: {page}-{type}-{qualifier}) */
  highlightedSectionId: string | null;
}

/**
 * View state discriminated union
 *
 * TypeScript ensures only ONE state is active at a time:
 * - 'dashboard': Normal dashboard view with cards
 * - 'preview': Storefront preview with toolbar
 * - 'loading': Transitioning between states
 * - 'error': Something went wrong with recovery option
 *
 * This eliminates bugs like "showing preview and dashboard simultaneously"
 * or "missing loading state during navigation".
 */
export type ViewState =
  | { status: 'dashboard' }
  | { status: 'preview'; config: PreviewConfig }
  | { status: 'loading'; target: 'dashboard' | 'preview' }
  | { status: 'error'; error: string; recovery?: () => void };

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
  | 'HIGHLIGHT_SECTION'
  | 'CLEAR_HIGHLIGHT'
  | 'NAVIGATE'
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
  | (AgentActionBase & { type: 'HIGHLIGHT_SECTION'; payload: { sectionId: string } })
  | (AgentActionBase & { type: 'CLEAR_HIGHLIGHT'; payload: Record<string, never> })
  | (AgentActionBase & { type: 'NAVIGATE'; payload: { page: PageName } })
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

  // Event log for audit/debugging/undo
  actionLog: AgentAction[];

  // Tenant scope (security - all actions require this)
  tenantId: string | null;

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
   * Set error state with optional recovery function
   */
  setError: (error: string, recovery?: () => void) => void;

  /**
   * Clear error and return to dashboard
   */
  clearError: () => void;

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
        actionLog: [],
        tenantId: null,

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

            const action: AgentAction = {
              id: generateActionId(),
              type: 'SHOW_PREVIEW',
              payload: { page },
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            state.actionLog.push(action);
            // FIFO: Remove oldest actions when limit exceeded
            if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
              state.actionLog.shift();
            }
            state.view = {
              status: 'preview',
              config: { currentPage: page, highlightedSectionId: null },
            };
          }),

        // Show dashboard
        showDashboard: (agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return;

            const action: AgentAction = {
              id: generateActionId(),
              type: 'HIDE_PREVIEW',
              payload: {},
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            state.actionLog.push(action);
            // FIFO: Remove oldest actions when limit exceeded
            if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
              state.actionLog.shift();
            }
            state.view = { status: 'dashboard' };
          }),

        // Highlight section
        highlightSection: (sectionId, agentSessionId = null) =>
          set((state) => {
            if (!state.tenantId) return;

            const action: AgentAction = {
              id: generateActionId(),
              type: 'HIGHLIGHT_SECTION',
              payload: { sectionId },
              timestamp: Date.now(),
              agentSessionId,
              tenantId: state.tenantId,
            };

            state.actionLog.push(action);
            // FIFO: Remove oldest actions when limit exceeded
            if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
              state.actionLog.shift();
            }

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

        // Set preview page
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

              state.actionLog.push(action);
              // FIFO: Remove oldest actions when limit exceeded
              if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
                state.actionLog.shift();
              }
              state.view.config.currentPage = page;
              state.view.config.highlightedSectionId = null;
            }
          }),

        // Set dirty state
        setDirty: (dirty) =>
          set((state) => {
            state.isDirty = dirty;
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

            state.actionLog.push(action);
            // FIFO: Remove oldest actions when limit exceeded
            if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
              state.actionLog.shift();
            }
            state.view = { status: 'error', error, recovery };
          }),

        // Clear error
        clearError: () =>
          set((state) => {
            state.view = { status: 'dashboard' };
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

  highlightSection: (sectionId: string, agentSessionId?: string | null) =>
    useAgentUIStore.getState().highlightSection(sectionId, agentSessionId),

  clearHighlight: () => useAgentUIStore.getState().clearHighlight(),

  setPreviewPage: (page: PageName) => useAgentUIStore.getState().setPreviewPage(page),

  setDirty: (dirty: boolean) => useAgentUIStore.getState().setDirty(dirty),

  setError: (error: string, recovery?: () => void) =>
    useAgentUIStore.getState().setError(error, recovery),

  clearError: () => useAgentUIStore.getState().clearError(),

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
 * Select current page in preview (or null)
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
if (typeof window !== 'undefined') {
  (window as unknown as { useAgentUIStore: typeof useAgentUIStore }).useAgentUIStore =
    useAgentUIStore;
  (window as unknown as { agentUIActions: typeof agentUIActions }).agentUIActions = agentUIActions;
}
