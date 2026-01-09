'use client';

import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminSidebar } from '@/components/layouts/AdminSidebar';
import { ImpersonationBanner } from '@/components/layouts/ImpersonationBanner';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { ContentArea } from '@/components/dashboard/ContentArea';
import { useAgentUIStore, selectIsPreviewActive } from '@/stores/agent-ui-store';
import { setQueryClientRef } from '@/hooks/useDraftConfig';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-client';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useBuildModeRedirect } from '@/hooks/useBuildModeRedirect';

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
  const [isMounted, setIsMounted] = useState(false);
  const { tenantId } = useAuth();
  const { currentPhase, isLoading: onboardingLoading } = useOnboardingState();
  const localQueryClient = useQueryClient();

  // Agent UI store - preview mode detection
  const isPreviewActive = useAgentUIStore(selectIsPreviewActive);
  const initialize = useAgentUIStore((state) => state.initialize);

  // Auto-redirect to Build Mode when reaching MARKETING phase
  useBuildModeRedirect(tenantId, currentPhase, onboardingLoading);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize agent UI store with tenant ID (security isolation)
  useEffect(() => {
    if (tenantId) {
      initialize(tenantId);
    }
  }, [tenantId, initialize]);

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
  // Default to pushed during SSR to prevent hydration mismatch
  const shouldPushContent = isMounted ? true : true;

  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar />
      <main
        className={cn(
          'lg:pl-72 transition-[padding-right] duration-300 ease-in-out',
          // Push content left when panel is visible (desktop only)
          shouldPushContent && 'lg:pr-[400px]'
        )}
      >
        {/* Dynamic padding based on preview mode */}
        <div
          className={cn(
            'transition-all duration-300',
            // Full-bleed when preview is active, padded otherwise
            isPreviewActive ? 'p-0 h-[calc(100vh)]' : 'p-6 lg:p-8'
          )}
        >
          <ContentArea>{children}</ContentArea>
        </div>
      </main>
      {/* Agent Panel - always visible side panel */}
      <AgentPanel />
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
