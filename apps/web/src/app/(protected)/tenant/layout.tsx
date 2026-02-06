'use client';

import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminSidebar } from '@/components/layouts/AdminSidebar';
import { ImpersonationBanner } from '@/components/layouts/ImpersonationBanner';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { ContentArea } from '@/components/dashboard/ContentArea';
import { SectionWidget, PublishReadyWidget } from '@/components/build-mode/SectionWidget';
import {
  useAgentUIStore,
  selectIsPreviewActive,
  selectIsOnboardingView,
} from '@/stores/agent-ui-store';
import {
  useRefinementStore,
  selectIsInGuidedRefine,
  selectIsPublishReady,
  type ToneVariant,
} from '@/stores/refinement-store';
import { queueAgentMessage } from '@/lib/tenant-agent-dispatch';
import { setQueryClientRef } from '@/hooks/useDraftConfig';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-client';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useBuildModeRedirect } from '@/hooks/useBuildModeRedirect';

/**
 * Pages that support preview mode overlay
 * All other pages should reset to dashboard view when navigated to
 */
const PREVIEW_ENABLED_PATHS = ['/tenant/dashboard', '/tenant/website', '/tenant/build'];

/**
 * Create query client outside component to prevent recreation
 * This ensures stable caching across renders
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds
      retry: 1,
    },
  },
});

/**
 * Tenant Admin Layout Content
 *
 * Integrates with Agent UI Store for:
 * - Preview mode detection (full-bleed vs padded layout)
 * - Store initialization with tenantId (security isolation)
 * - QueryClient ref for external cache invalidation
 *
 * Agent Panel state is managed internally by AgentPanel component.
 */
function TenantLayoutContent({ children }: { children: React.ReactNode }) {
  const { tenantId } = useAuth();
  const { currentPhase, isLoading: onboardingLoading } = useOnboardingState();
  const localQueryClient = useQueryClient();
  const pathname = usePathname();

  // Agent UI store - preview mode detection and control
  const isPreviewActive = useAgentUIStore(selectIsPreviewActive);
  const isOnboardingView = useAgentUIStore(selectIsOnboardingView);
  const initialize = useAgentUIStore((state) => state.initialize);
  const showDashboard = useAgentUIStore((state) => state.showDashboard);
  const showComingSoon = useAgentUIStore((state) => state.showComingSoon);
  const showPreview = useAgentUIStore((state) => state.showPreview);

  // Refinement store - guided refinement mode and publish ready detection
  const isInGuidedRefine = useRefinementStore(selectIsInGuidedRefine);
  const isPublishReady = useRefinementStore(selectIsPublishReady);

  // Derived: is this tenant still in onboarding?
  const isOnboarding = currentPhase !== 'COMPLETED' && currentPhase !== 'SKIPPED';

  // Auto-redirect to Build Mode when reaching MARKETING phase
  useBuildModeRedirect(tenantId, currentPhase, onboardingLoading);

  // ========== SectionWidget Callbacks ==========
  // These connect widget actions to agent chat messages

  /**
   * Regenerate variants for the current section
   */
  const handleWidgetRefresh = useCallback(() => {
    queueAgentMessage('Please regenerate tone options for the current section');
  }, []);

  /**
   * User selected a variant - notify the agent
   */
  const handleSelectVariant = useCallback((_sectionId: string, variant: ToneVariant) => {
    // The store already tracks selection; also notify the agent
    queueAgentMessage(`I prefer the ${variant} tone for this section`);
  }, []);

  /**
   * User approved a variant and wants to continue
   */
  const handleMarkComplete = useCallback((_sectionId: string) => {
    queueAgentMessage('This looks good - please apply my selection and move to the next section');
  }, []);

  /**
   * User wants to move to the next section
   */
  const handleNext = useCallback(() => {
    queueAgentMessage('Show me the next section to refine');
  }, []);

  /**
   * User clicked close on the widget
   */
  const handleWidgetClose = useCallback(() => {
    // Widget hides itself via store; optionally notify agent
    queueAgentMessage("I'll continue with the chat for now");
  }, []);

  /**
   * User wants to publish the site
   */
  const handlePublish = useCallback(() => {
    queueAgentMessage('Please publish my site now');
  }, []);

  /**
   * User wants to edit sections from publish-ready state
   */
  const handleEdit = useCallback(() => {
    queueAgentMessage("I'd like to make some more edits before publishing");
  }, []);

  // Reset preview mode when navigating to pages that don't support it.
  // Don't reset during onboarding — coming_soon is the canonical state.
  useEffect(() => {
    if (!pathname || !isPreviewActive || isOnboarding) return;

    // Check if current path supports preview mode
    const supportsPreview = PREVIEW_ENABLED_PATHS.some((path) => pathname.startsWith(path));

    if (!supportsPreview) {
      // Reset to dashboard view when navigating to non-preview pages
      showDashboard();
    }
  }, [pathname, isPreviewActive, isOnboarding, showDashboard]);

  // Initialize agent UI store with tenant ID (security isolation)
  useEffect(() => {
    if (tenantId) {
      initialize(tenantId);
    }
  }, [tenantId, initialize]);

  // Set default view based on onboarding phase.
  // Onboarding (any phase before COMPLETED/SKIPPED) → coming_soon display.
  // Post-onboarding → preview (your live site IS the dashboard).
  useEffect(() => {
    if (onboardingLoading || !tenantId) return;
    if (isOnboarding) {
      showComingSoon();
    } else {
      showPreview();
    }
  }, [isOnboarding, onboardingLoading, tenantId]); // eslint-disable-line react-hooks/exhaustive-deps — actions are stable

  // Set query client ref for external invalidation (agent tool handlers)
  useEffect(() => {
    setQueryClientRef(localQueryClient);
  }, [localQueryClient]);

  // Cmd+K / Ctrl+K keyboard shortcut to focus agent input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      // Don't intercept if user is typing in an input/textarea (except the assistant input)
      const target = e.target as HTMLElement;
      const isAssistantInput = target.hasAttribute('data-growth-assistant-input');
      if (!isAssistantInput && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      e.preventDefault();

      // Focus the agent input
      const input = document.querySelector<HTMLTextAreaElement>('[data-growth-assistant-input]');
      input?.focus();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Always push content since panel is always visible (just may be collapsed)
  const shouldPushContent = true;

  // Sidebar hidden during onboarding — full-bleed canvas + agent panel only
  const showSidebar = !isOnboarding;

  return (
    <div className="min-h-screen bg-surface">
      {showSidebar && <AdminSidebar />}
      <main
        className={cn(
          'transition-all duration-300 ease-in-out',
          // Sidebar padding only when visible (post-publish)
          showSidebar && 'lg:pl-72',
          // Push content left when agent panel is visible (desktop only)
          shouldPushContent && 'lg:pr-[400px]'
        )}
      >
        {/* Dynamic padding based on view mode */}
        <div
          className={cn(
            'transition-all duration-300',
            // Full-bleed when preview or onboarding active, padded for dashboard
            isPreviewActive || isOnboardingView ? 'p-0 h-[calc(100vh)]' : 'p-6 lg:p-8'
          )}
        >
          <ContentArea>{children}</ContentArea>
        </div>
      </main>
      {/* Agent Panel - always visible side panel */}
      <AgentPanel />

      {/* Guided Refinement Widgets */}
      {isInGuidedRefine && !isPublishReady && (
        <SectionWidget
          onRefresh={handleWidgetRefresh}
          onSelectVariant={handleSelectVariant}
          onMarkComplete={handleMarkComplete}
          onNext={handleNext}
          onClose={handleWidgetClose}
        />
      )}

      {isPublishReady && (
        <PublishReadyWidget
          onPublish={handlePublish}
          onEdit={handleEdit}
          onClose={handleWidgetClose}
        />
      )}
    </div>
  );
}

/**
 * Tenant Admin Layout
 *
 * Protected layout for all /tenant/* routes.
 * Includes sidebar navigation, Agent Panel, and requires TENANT_ADMIN role.
 * Shows impersonation banner when a PLATFORM_ADMIN is impersonating.
 *
 * Architecture:
 * - QueryClientProvider: Enables TanStack Query for draft config caching
 * - AgentPanel: Agent-first architecture - AI chatbot is THE central interface
 * - ContentArea: Agent-controlled view switching (dashboard vs preview)
 * - AgentUIStore: Zustand store for preview state (initialized in TenantLayoutContent)
 *
 * @see components/dashboard/ContentArea.tsx for view routing
 * @see stores/agent-ui-store.ts for view state management
 */
export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['TENANT_ADMIN']}>
      <QueryClientProvider client={queryClient}>
        <ImpersonationBanner />
        <TenantLayoutContent>{children}</TenantLayoutContent>
      </QueryClientProvider>
    </ProtectedRoute>
  );
}
