/**
 * Unit tests for Agent UI Store
 *
 * Tests Zustand store for agent-controlled UI state including:
 * - Discriminated union view states
 * - Event sourcing / action log
 * - Tenant-scoped security
 * - Exposed actions for agent tool handlers
 * - Selectors for memoized state access
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useAgentUIStore,
  agentUIActions,
  selectViewStatus,
  selectIsPreviewActive,
  selectPreviewConfig,
  selectIsDirty,
  selectCurrentPage,
  selectHighlightedSectionId,
  selectError,
  selectIsInitialized,
  type AgentUIState,
} from '../agent-ui-store';

describe('agent-ui-store', () => {
  // Store initial state snapshot for resetting between tests
  const initialState: Pick<AgentUIState, 'view' | 'isDirty' | 'actionLog' | 'tenantId'> = {
    view: { status: 'dashboard' },
    isDirty: false,
    actionLog: [],
    tenantId: null,
  };

  beforeEach(() => {
    // Reset store to initial state before each test
    useAgentUIStore.setState(initialState);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================
  // 1. INITIAL STATE
  // ============================================

  describe('initial state', () => {
    it('should start with view.status === "dashboard"', () => {
      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
    });

    it('should have tenantId as null initially', () => {
      const state = useAgentUIStore.getState();
      expect(state.tenantId).toBeNull();
    });

    it('should have empty actionLog initially', () => {
      const state = useAgentUIStore.getState();
      expect(state.actionLog).toEqual([]);
    });

    it('should have isDirty as false initially', () => {
      const state = useAgentUIStore.getState();
      expect(state.isDirty).toBe(false);
    });
  });

  // ============================================
  // 2. INITIALIZE
  // ============================================

  describe('initialize(tenantId)', () => {
    it('should set tenantId', () => {
      useAgentUIStore.getState().initialize('tenant_123');

      const state = useAgentUIStore.getState();
      expect(state.tenantId).toBe('tenant_123');
    });

    it('should reset view to dashboard', () => {
      // First set to preview
      useAgentUIStore.setState({
        tenantId: 'tenant_old',
        view: { status: 'preview', config: { currentPage: 'about', highlightedSectionId: null } },
      });

      useAgentUIStore.getState().initialize('tenant_new');

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
    });

    it('should clear action log', () => {
      // First add some actions
      useAgentUIStore.setState({
        tenantId: 'tenant_old',
        actionLog: [
          {
            id: 'action_1',
            type: 'SHOW_PREVIEW',
            payload: { page: 'home' },
            timestamp: Date.now(),
            agentSessionId: null,
            tenantId: 'tenant_old',
          },
        ],
      });

      useAgentUIStore.getState().initialize('tenant_new');

      const state = useAgentUIStore.getState();
      expect(state.actionLog).toEqual([]);
    });

    it('should reset isDirty to false', () => {
      useAgentUIStore.setState({ isDirty: true });

      useAgentUIStore.getState().initialize('tenant_new');

      const state = useAgentUIStore.getState();
      expect(state.isDirty).toBe(false);
    });
  });

  // ============================================
  // 3. SHOW PREVIEW
  // ============================================

  describe('showPreview()', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
    });

    it('should change view.status to "preview"', () => {
      useAgentUIStore.getState().showPreview();

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('preview');
    });

    it('should set config.currentPage to default "home"', () => {
      useAgentUIStore.getState().showPreview();

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('preview');
      if (state.view.status === 'preview') {
        expect(state.view.config.currentPage).toBe('home');
      }
    });

    it('should accept custom page parameter', () => {
      useAgentUIStore.getState().showPreview('about');

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.currentPage).toBe('about');
      }
    });

    it('should set highlightedSectionId to null', () => {
      useAgentUIStore.getState().showPreview();

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.highlightedSectionId).toBeNull();
      }
    });

    it('should add action to actionLog', () => {
      vi.setSystemTime(new Date('2026-01-09T12:00:00Z'));

      useAgentUIStore.getState().showPreview('home', 'agent_session_456');

      const state = useAgentUIStore.getState();
      expect(state.actionLog).toHaveLength(1);
      expect(state.actionLog[0]).toMatchObject({
        type: 'SHOW_PREVIEW',
        payload: { page: 'home' },
        agentSessionId: 'agent_session_456',
        tenantId: 'tenant_123',
      });
      expect(state.actionLog[0].id).toMatch(/^action_/);
      expect(state.actionLog[0].timestamp).toBe(Date.now());
    });

    it('should do nothing if tenantId is null (security)', () => {
      useAgentUIStore.setState({ tenantId: null });

      useAgentUIStore.getState().showPreview();

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
      expect(state.actionLog).toHaveLength(0);
    });
  });

  // ============================================
  // 4. SHOW DASHBOARD
  // ============================================

  describe('showDashboard()', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
      useAgentUIStore.getState().showPreview();
    });

    it('should change view.status back to "dashboard"', () => {
      useAgentUIStore.getState().showDashboard();

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
    });

    it('should add action to actionLog with type HIDE_PREVIEW', () => {
      useAgentUIStore.getState().showDashboard('agent_session_789');

      const state = useAgentUIStore.getState();
      const lastAction = state.actionLog[state.actionLog.length - 1];
      expect(lastAction).toMatchObject({
        type: 'HIDE_PREVIEW',
        payload: {},
        agentSessionId: 'agent_session_789',
        tenantId: 'tenant_123',
      });
    });

    it('should do nothing if tenantId is null', () => {
      useAgentUIStore.setState({ tenantId: null });

      const stateBefore = useAgentUIStore.getState();
      const actionLogLengthBefore = stateBefore.actionLog.length;

      useAgentUIStore.getState().showDashboard();

      const stateAfter = useAgentUIStore.getState();
      expect(stateAfter.actionLog.length).toBe(actionLogLengthBefore);
    });
  });

  // ============================================
  // 5. HIGHLIGHT SECTION
  // ============================================

  describe('highlightSection(sectionId)', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
    });

    it('should set highlightedSectionId', () => {
      useAgentUIStore.getState().showPreview();
      useAgentUIStore.getState().highlightSection('home-hero-main');

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.highlightedSectionId).toBe('home-hero-main');
      }
    });

    it('should parse page from sectionId (format: {page}-{type}-{qualifier})', () => {
      useAgentUIStore.getState().showPreview('home');
      useAgentUIStore.getState().highlightSection('about-hero-main');

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.currentPage).toBe('about');
      }
    });

    it('should auto-switch to preview if in dashboard mode', () => {
      // Start in dashboard
      expect(useAgentUIStore.getState().view.status).toBe('dashboard');

      useAgentUIStore.getState().highlightSection('services-hero-main');

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('preview');
      if (state.view.status === 'preview') {
        expect(state.view.config.highlightedSectionId).toBe('services-hero-main');
        expect(state.view.config.currentPage).toBe('services');
      }
    });

    it('should add action to actionLog', () => {
      useAgentUIStore.getState().highlightSection('faq-text-intro', 'agent_session_111');

      const state = useAgentUIStore.getState();
      const lastAction = state.actionLog[state.actionLog.length - 1];
      expect(lastAction).toMatchObject({
        type: 'HIGHLIGHT_SECTION',
        payload: { sectionId: 'faq-text-intro' },
        agentSessionId: 'agent_session_111',
        tenantId: 'tenant_123',
      });
    });

    it('should keep current page if sectionId has invalid page', () => {
      useAgentUIStore.getState().showPreview('gallery');
      useAgentUIStore.getState().highlightSection('invalid-hero-main');

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        // Should keep current page since 'invalid' is not a valid page
        expect(state.view.config.currentPage).toBe('gallery');
      }
    });

    it('should use "home" as fallback for invalid sectionId when switching from dashboard', () => {
      useAgentUIStore.getState().highlightSection('xy'); // Less than 3 parts

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.currentPage).toBe('home');
      }
    });

    it('should do nothing if tenantId is null', () => {
      useAgentUIStore.setState({ tenantId: null });

      useAgentUIStore.getState().highlightSection('home-hero-main');

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
      expect(state.actionLog).toHaveLength(0);
    });
  });

  // ============================================
  // 6. CLEAR HIGHLIGHT
  // ============================================

  describe('clearHighlight()', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
    });

    it('should clear highlightedSectionId to null', () => {
      useAgentUIStore.getState().showPreview();
      useAgentUIStore.getState().highlightSection('home-hero-main');

      // Verify highlight is set
      let state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.highlightedSectionId).toBe('home-hero-main');
      }

      useAgentUIStore.getState().clearHighlight();

      state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.highlightedSectionId).toBeNull();
      }
    });

    it('should only work in preview mode', () => {
      // Stay in dashboard mode
      expect(useAgentUIStore.getState().view.status).toBe('dashboard');

      // Should not throw, just do nothing
      useAgentUIStore.getState().clearHighlight();

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
    });
  });

  // ============================================
  // 7. SET PREVIEW PAGE
  // ============================================

  describe('setPreviewPage(page)', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
      useAgentUIStore.getState().showPreview('home');
    });

    it('should change currentPage when in preview mode', () => {
      useAgentUIStore.getState().setPreviewPage('about');

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.currentPage).toBe('about');
      }
    });

    it('should clear highlight when changing page', () => {
      useAgentUIStore.getState().highlightSection('home-hero-main');
      useAgentUIStore.getState().setPreviewPage('services');

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.highlightedSectionId).toBeNull();
      }
    });

    it('should add action to actionLog with type SET_PAGE', () => {
      useAgentUIStore.getState().setPreviewPage('contact');

      const state = useAgentUIStore.getState();
      const lastAction = state.actionLog[state.actionLog.length - 1];
      expect(lastAction).toMatchObject({
        type: 'SET_PAGE',
        payload: { page: 'contact' },
        tenantId: 'tenant_123',
      });
    });

    it('should do nothing when not in preview mode', () => {
      useAgentUIStore.getState().showDashboard();
      const actionCountBefore = useAgentUIStore.getState().actionLog.length;

      useAgentUIStore.getState().setPreviewPage('gallery');

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
      expect(state.actionLog.length).toBe(actionCountBefore);
    });

    it('should do nothing if tenantId is null', () => {
      useAgentUIStore.setState({ tenantId: null });

      useAgentUIStore.getState().setPreviewPage('testimonials');

      // Should remain unchanged - view should still be dashboard and no actions logged
      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
      expect(state.actionLog.length).toBe(0);
    });
  });

  // ============================================
  // 8. SET ERROR AND CLEAR ERROR
  // ============================================

  describe('setError() and clearError()', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
    });

    it('should set view to error state with message', () => {
      useAgentUIStore.getState().setError('Something went wrong');

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('error');
      if (state.view.status === 'error') {
        expect(state.view.error).toBe('Something went wrong');
      }
    });

    it('should store optional recovery function', () => {
      const recoveryFn = vi.fn();
      useAgentUIStore.getState().setError('Failed to load', recoveryFn);

      const state = useAgentUIStore.getState();
      if (state.view.status === 'error') {
        expect(state.view.recovery).toBe(recoveryFn);
      }
    });

    it('should add action to actionLog with type SET_ERROR', () => {
      useAgentUIStore.getState().setError('Error message');

      const state = useAgentUIStore.getState();
      const lastAction = state.actionLog[state.actionLog.length - 1];
      expect(lastAction).toMatchObject({
        type: 'SET_ERROR',
        payload: { error: 'Error message' },
        tenantId: 'tenant_123',
      });
    });

    it('clearError should return to dashboard', () => {
      useAgentUIStore.getState().setError('Some error');
      expect(useAgentUIStore.getState().view.status).toBe('error');

      useAgentUIStore.getState().clearError();

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
    });

    it('setError should do nothing if tenantId is null', () => {
      useAgentUIStore.setState({ tenantId: null });

      useAgentUIStore.getState().setError('Error');

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
      expect(state.actionLog).toHaveLength(0);
    });
  });

  // ============================================
  // 9. EVENT SOURCING / ACTION LOG
  // ============================================

  describe('event sourcing / action log', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
    });

    it('should include all required fields in action entry', () => {
      vi.setSystemTime(new Date('2026-01-09T15:30:00Z'));

      useAgentUIStore.getState().showPreview('home', 'session_abc');

      const state = useAgentUIStore.getState();
      const action = state.actionLog[0];

      expect(action.id).toMatch(/^action_\d+_[a-z0-9]+$/);
      expect(action.type).toBe('SHOW_PREVIEW');
      expect(action.payload).toEqual({ page: 'home' });
      expect(action.timestamp).toBe(Date.now());
      expect(action.agentSessionId).toBe('session_abc');
      expect(action.tenantId).toBe('tenant_123');
    });

    it('should record null agentSessionId for user-initiated actions', () => {
      useAgentUIStore.getState().showPreview();

      const state = useAgentUIStore.getState();
      expect(state.actionLog[0].agentSessionId).toBeNull();
    });

    it('should accumulate multiple actions in order', () => {
      useAgentUIStore.getState().showPreview('home');
      useAgentUIStore.getState().highlightSection('home-hero-main');
      useAgentUIStore.getState().setPreviewPage('about');

      const state = useAgentUIStore.getState();
      expect(state.actionLog).toHaveLength(3);
      expect(state.actionLog[0].type).toBe('SHOW_PREVIEW');
      expect(state.actionLog[1].type).toBe('HIGHLIGHT_SECTION');
      expect(state.actionLog[2].type).toBe('SET_PAGE');
    });

    it('getActionLog() should return current action log', () => {
      useAgentUIStore.getState().showPreview();
      useAgentUIStore.getState().showDashboard();

      const log = useAgentUIStore.getState().getActionLog();
      expect(log).toHaveLength(2);
    });

    describe('undoLastAction()', () => {
      it('should reverse SHOW_PREVIEW to dashboard', () => {
        useAgentUIStore.getState().showPreview();
        expect(useAgentUIStore.getState().view.status).toBe('preview');

        useAgentUIStore.getState().undoLastAction();

        const state = useAgentUIStore.getState();
        expect(state.view.status).toBe('dashboard');
        expect(state.actionLog).toHaveLength(0);
      });

      it('should reverse HIDE_PREVIEW to preview', () => {
        useAgentUIStore.getState().showPreview();
        useAgentUIStore.getState().showDashboard();
        expect(useAgentUIStore.getState().view.status).toBe('dashboard');

        useAgentUIStore.getState().undoLastAction();

        const state = useAgentUIStore.getState();
        expect(state.view.status).toBe('preview');
        if (state.view.status === 'preview') {
          expect(state.view.config.currentPage).toBe('home');
        }
      });

      it('should reverse HIGHLIGHT_SECTION by clearing highlight', () => {
        useAgentUIStore.getState().showPreview();
        useAgentUIStore.getState().highlightSection('home-hero-main');

        const stateBefore = useAgentUIStore.getState();
        if (stateBefore.view.status === 'preview') {
          expect(stateBefore.view.config.highlightedSectionId).toBe('home-hero-main');
        }

        useAgentUIStore.getState().undoLastAction();

        const state = useAgentUIStore.getState();
        if (state.view.status === 'preview') {
          expect(state.view.config.highlightedSectionId).toBeNull();
        }
      });

      it('should reverse SET_ERROR to dashboard', () => {
        useAgentUIStore.getState().setError('Error occurred');
        expect(useAgentUIStore.getState().view.status).toBe('error');

        useAgentUIStore.getState().undoLastAction();

        const state = useAgentUIStore.getState();
        expect(state.view.status).toBe('dashboard');
      });

      it('should do nothing when action log is empty', () => {
        expect(useAgentUIStore.getState().actionLog).toHaveLength(0);

        useAgentUIStore.getState().undoLastAction();

        const state = useAgentUIStore.getState();
        expect(state.view.status).toBe('dashboard');
      });

      it('should remove action from log after undo', () => {
        useAgentUIStore.getState().showPreview();
        expect(useAgentUIStore.getState().actionLog).toHaveLength(1);

        useAgentUIStore.getState().undoLastAction();

        expect(useAgentUIStore.getState().actionLog).toHaveLength(0);
      });
    });
  });

  // ============================================
  // 10. DISCRIMINATED UNION TYPE SAFETY
  // ============================================

  describe('discriminated union type safety', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
    });

    it('should narrow to preview config when status is preview', () => {
      useAgentUIStore.getState().showPreview('services');

      const state = useAgentUIStore.getState();

      // TypeScript narrowing test
      if (state.view.status === 'preview') {
        // This should compile and work
        expect(state.view.config.currentPage).toBe('services');
        expect(state.view.config.highlightedSectionId).toBeNull();
      }
    });

    it('should narrow to error message when status is error', () => {
      useAgentUIStore.getState().setError('Test error');

      const state = useAgentUIStore.getState();

      if (state.view.status === 'error') {
        expect(state.view.error).toBe('Test error');
      }
    });

    it('should narrow to loading target when status is loading', () => {
      // Directly set loading state for testing
      useAgentUIStore.setState({
        view: { status: 'loading', target: 'preview' },
      });

      const state = useAgentUIStore.getState();

      if (state.view.status === 'loading') {
        expect(state.view.target).toBe('preview');
      }
    });

    it('should have no config property when status is dashboard', () => {
      const state = useAgentUIStore.getState();

      if (state.view.status === 'dashboard') {
        // TypeScript should not allow accessing config here
        // We verify the object shape is correct
        expect(state.view).toEqual({ status: 'dashboard' });
        expect('config' in state.view).toBe(false);
      }
    });
  });

  // ============================================
  // 11. EXPORTED ACTIONS (agentUIActions)
  // ============================================

  describe('exported actions (agentUIActions)', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
    });

    it('agentUIActions.showPreview should work outside React', () => {
      agentUIActions.showPreview('about', 'external_session');

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('preview');
      if (state.view.status === 'preview') {
        expect(state.view.config.currentPage).toBe('about');
      }
    });

    it('agentUIActions.showDashboard should work outside React', () => {
      agentUIActions.showPreview();
      agentUIActions.showDashboard('external_session');

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
    });

    it('agentUIActions.highlightSection should work outside React', () => {
      agentUIActions.highlightSection('contact-hero-main');

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.highlightedSectionId).toBe('contact-hero-main');
      }
    });

    it('agentUIActions.clearHighlight should work outside React', () => {
      agentUIActions.showPreview();
      agentUIActions.highlightSection('home-hero-main');
      agentUIActions.clearHighlight();

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.highlightedSectionId).toBeNull();
      }
    });

    it('agentUIActions.setPreviewPage should work outside React', () => {
      agentUIActions.showPreview();
      agentUIActions.setPreviewPage('faq');

      const state = useAgentUIStore.getState();
      if (state.view.status === 'preview') {
        expect(state.view.config.currentPage).toBe('faq');
      }
    });

    it('agentUIActions.setDirty should work outside React', () => {
      agentUIActions.setDirty(true);

      expect(useAgentUIStore.getState().isDirty).toBe(true);

      agentUIActions.setDirty(false);

      expect(useAgentUIStore.getState().isDirty).toBe(false);
    });

    it('agentUIActions.setError should work outside React', () => {
      const recovery = vi.fn();
      agentUIActions.setError('External error', recovery);

      const state = useAgentUIStore.getState();
      if (state.view.status === 'error') {
        expect(state.view.error).toBe('External error');
        expect(state.view.recovery).toBe(recovery);
      }
    });

    it('agentUIActions.clearError should work outside React', () => {
      agentUIActions.setError('Error');
      agentUIActions.clearError();

      expect(useAgentUIStore.getState().view.status).toBe('dashboard');
    });

    it('agentUIActions.getActionLog should return action log', () => {
      agentUIActions.showPreview();
      agentUIActions.showDashboard();

      const log = agentUIActions.getActionLog();
      expect(log).toHaveLength(2);
    });

    it('agentUIActions.undoLastAction should work outside React', () => {
      agentUIActions.showPreview();
      expect(useAgentUIStore.getState().view.status).toBe('preview');

      agentUIActions.undoLastAction();

      expect(useAgentUIStore.getState().view.status).toBe('dashboard');
    });
  });

  // ============================================
  // 12. SELECTORS
  // ============================================

  describe('selectors', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
    });

    describe('selectViewStatus', () => {
      it('should return "dashboard" for dashboard state', () => {
        const state = useAgentUIStore.getState();
        expect(selectViewStatus(state)).toBe('dashboard');
      });

      it('should return "preview" for preview state', () => {
        useAgentUIStore.getState().showPreview();
        const state = useAgentUIStore.getState();
        expect(selectViewStatus(state)).toBe('preview');
      });

      it('should return "error" for error state', () => {
        useAgentUIStore.getState().setError('Error');
        const state = useAgentUIStore.getState();
        expect(selectViewStatus(state)).toBe('error');
      });

      it('should return "loading" for loading state', () => {
        useAgentUIStore.setState({ view: { status: 'loading', target: 'preview' } });
        const state = useAgentUIStore.getState();
        expect(selectViewStatus(state)).toBe('loading');
      });
    });

    describe('selectIsPreviewActive', () => {
      it('should return true when in preview mode', () => {
        useAgentUIStore.getState().showPreview();
        const state = useAgentUIStore.getState();
        expect(selectIsPreviewActive(state)).toBe(true);
      });

      it('should return false when in dashboard mode', () => {
        const state = useAgentUIStore.getState();
        expect(selectIsPreviewActive(state)).toBe(false);
      });

      it('should return false when in error mode', () => {
        useAgentUIStore.getState().setError('Error');
        const state = useAgentUIStore.getState();
        expect(selectIsPreviewActive(state)).toBe(false);
      });
    });

    describe('selectPreviewConfig', () => {
      it('should return config when in preview mode', () => {
        useAgentUIStore.getState().showPreview('about');
        const state = useAgentUIStore.getState();
        const config = selectPreviewConfig(state);

        expect(config).toEqual({
          currentPage: 'about',
          highlightedSectionId: null,
        });
      });

      it('should return null when not in preview mode', () => {
        const state = useAgentUIStore.getState();
        expect(selectPreviewConfig(state)).toBeNull();
      });
    });

    describe('selectIsDirty', () => {
      it('should return false initially', () => {
        const state = useAgentUIStore.getState();
        expect(selectIsDirty(state)).toBe(false);
      });

      it('should return true after setDirty(true)', () => {
        useAgentUIStore.getState().setDirty(true);
        const state = useAgentUIStore.getState();
        expect(selectIsDirty(state)).toBe(true);
      });
    });

    describe('selectCurrentPage', () => {
      it('should return current page when in preview', () => {
        useAgentUIStore.getState().showPreview('gallery');
        const state = useAgentUIStore.getState();
        expect(selectCurrentPage(state)).toBe('gallery');
      });

      it('should return null when not in preview', () => {
        const state = useAgentUIStore.getState();
        expect(selectCurrentPage(state)).toBeNull();
      });
    });

    describe('selectHighlightedSectionId', () => {
      it('should return section ID when highlighted', () => {
        useAgentUIStore.getState().showPreview();
        useAgentUIStore.getState().highlightSection('home-hero-main');
        const state = useAgentUIStore.getState();
        expect(selectHighlightedSectionId(state)).toBe('home-hero-main');
      });

      it('should return null when no highlight', () => {
        useAgentUIStore.getState().showPreview();
        const state = useAgentUIStore.getState();
        expect(selectHighlightedSectionId(state)).toBeNull();
      });

      it('should return null when not in preview', () => {
        const state = useAgentUIStore.getState();
        expect(selectHighlightedSectionId(state)).toBeNull();
      });
    });

    describe('selectError', () => {
      it('should return error message when in error state', () => {
        useAgentUIStore.getState().setError('Test error message');
        const state = useAgentUIStore.getState();
        expect(selectError(state)).toBe('Test error message');
      });

      it('should return null when not in error state', () => {
        const state = useAgentUIStore.getState();
        expect(selectError(state)).toBeNull();
      });
    });

    describe('selectIsInitialized', () => {
      it('should return false when tenantId is null', () => {
        useAgentUIStore.setState({ tenantId: null });
        const state = useAgentUIStore.getState();
        expect(selectIsInitialized(state)).toBe(false);
      });

      it('should return true when tenantId is set', () => {
        const state = useAgentUIStore.getState();
        expect(selectIsInitialized(state)).toBe(true);
      });
    });
  });

  // ============================================
  // ADDITIONAL EDGE CASES
  // ============================================

  describe('edge cases', () => {
    beforeEach(() => {
      useAgentUIStore.getState().initialize('tenant_123');
    });

    it('should handle rapid state changes', () => {
      // Simulate rapid navigation
      useAgentUIStore.getState().showPreview('home');
      useAgentUIStore.getState().setPreviewPage('about');
      useAgentUIStore.getState().setPreviewPage('services');
      useAgentUIStore.getState().highlightSection('services-hero-main');
      useAgentUIStore.getState().clearHighlight();
      useAgentUIStore.getState().showDashboard();

      const state = useAgentUIStore.getState();
      expect(state.view.status).toBe('dashboard');
      expect(state.actionLog).toHaveLength(5); // showPreview, setPage x2, highlight, hidePreview (clearHighlight doesn't log)
    });

    it('should validate all page types in section ID extraction', () => {
      const validPages = ['home', 'about', 'services', 'faq', 'contact', 'gallery', 'testimonials'];

      for (const page of validPages) {
        useAgentUIStore.getState().initialize('tenant_123'); // Reset
        useAgentUIStore.getState().highlightSection(`${page}-hero-main`);

        const state = useAgentUIStore.getState();
        if (state.view.status === 'preview') {
          expect(state.view.config.currentPage).toBe(page);
        }
      }
    });

    it('should handle multiple initializations (tenant switch)', () => {
      useAgentUIStore.getState().showPreview();
      expect(useAgentUIStore.getState().actionLog.length).toBeGreaterThan(0);

      // Switch tenant
      useAgentUIStore.getState().initialize('tenant_456');

      const state = useAgentUIStore.getState();
      expect(state.tenantId).toBe('tenant_456');
      expect(state.view.status).toBe('dashboard');
      expect(state.actionLog).toHaveLength(0);
    });

    it('should preserve isDirty independently of view changes', () => {
      useAgentUIStore.getState().setDirty(true);
      useAgentUIStore.getState().showPreview();
      useAgentUIStore.getState().showDashboard();

      expect(useAgentUIStore.getState().isDirty).toBe(true);
    });
  });
});
