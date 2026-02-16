'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { DashboardAction, TenantAgentToolCall } from '@/hooks/useTenantAgentChat';
import { agentUIActions, useAgentUIStore } from '@/stores/agent-ui-store';
import { refinementActions, useRefinementStore } from '@/stores/refinement-store';
import { getDraftConfigQueryKey } from '@/hooks/useDraftConfig';
import { queryKeys } from '@/lib/query-client';
import { SECTION_BLUEPRINT, MVP_REVEAL_SECTION_COUNT } from '@macon/contracts';

// Zod schema for validating dashboardAction from agent tool results (Fix #5203)
const DashboardActionSchema = z.object({
  type: z.enum([
    'NAVIGATE',
    'SCROLL_TO_SECTION',
    'SHOW_PREVIEW',
    'REFRESH',
    'REFRESH_PREVIEW',
    'REVEAL_SITE',
    'SHOW_VARIANT_WIDGET',
    'SHOW_PUBLISH_READY',
    'HIGHLIGHT_NEXT_SECTION',
    'PUBLISH_SITE',
  ]),
  section: z.string().optional(),
  blockType: z.string().optional(),
  sectionId: z.string().optional(),
  sectionType: z.string().optional(),
});

// Module-scoped counter for section writes during first draft.
// Persists across tool-complete batches (agent may send 1+1+1 or 2+1).
// Resets on page refresh — correct behavior (re-shows Coming Soon, count rebuilds).
let firstDraftWriteCount = 0;

interface UseDashboardActionDispatchOptions {
  /** Whether the current viewport is mobile */
  isMobile: boolean;
  /** Setter to dismiss mobile drawer */
  setIsMobileOpen: (open: boolean) => void;
}

interface UseDashboardActionDispatchReturn {
  /** Handle dashboard actions from agent navigation tools (NAVIGATE, SCROLL, REVEAL, etc.) */
  handleDashboardActions: (actions: DashboardAction[]) => Promise<void>;
  /** Handle tenant-agent tool completion (triggers preview refresh, fact tracking, etc.) */
  handleToolComplete: (toolCalls: TenantAgentToolCall[]) => Promise<void>;
}

/**
 * useDashboardActionDispatch - Extracts all dashboard action handling from AgentPanel.
 *
 * Handles two categories of agent-driven UI updates:
 * 1. Dashboard actions: NAVIGATE, SCROLL_TO_SECTION, SHOW_PREVIEW, REVEAL_SITE, etc.
 * 2. Tool completion side-effects: cache invalidation, preview refresh, fact tracking,
 *    section completion tracking, and auto-reveal during first draft.
 *
 * Uses `useQueryClient()` hook (not module-level ref) for cache invalidation.
 */
export function useDashboardActionDispatch({
  isMobile,
  setIsMobileOpen,
}: UseDashboardActionDispatchOptions): UseDashboardActionDispatchReturn {
  const queryClient = useQueryClient();

  // Handle dashboard actions from agent navigation tools
  // Fix #819: Add cache invalidation to SHOW_PREVIEW and REFRESH actions
  // Guided Refinement: Handle SHOW_VARIANT_WIDGET, SHOW_PUBLISH_READY, HIGHLIGHT_NEXT_SECTION
  const handleDashboardActions = useCallback(
    async (actions: DashboardAction[]) => {
      for (const action of actions) {
        switch (action.type) {
          case 'NAVIGATE':
            // Navigate to a dashboard section - "website" means show preview
            if (action.section === 'website') {
              agentUIActions.showPreview();
            }
            // Other sections could be handled here (bookings, projects, settings, analytics)
            break;
          case 'SCROLL_TO_SECTION':
            // Scroll to and highlight a specific website section
            // Supports both formats:
            // - blockType: legacy format (e.g., "HERO" -> "home-HERO-primary")
            // - sectionId: new format from storefront tools (e.g., "home-hero-abc123")
            if (action.sectionId) {
              agentUIActions.highlightSection(action.sectionId);
            } else if (action.blockType) {
              // Convert HERO -> home-HERO-primary format for highlightSection
              const sectionId = `home-${action.blockType}-primary`;
              agentUIActions.highlightSection(sectionId);
            }
            break;
          case 'SHOW_PREVIEW':
            // Fix #819: Invalidate cache before showing preview (with timing fix from #818)
            // Wait for backend transaction to commit (Pitfall #26)
            await new Promise((resolve) => setTimeout(resolve, 100));
            queryClient.invalidateQueries({
              queryKey: getDraftConfigQueryKey(),
              refetchType: 'active',
            });
            agentUIActions.showPreview();
            break;
          case 'REFRESH':
          case 'REFRESH_PREVIEW':
            // Fix #819: Invalidate cache before refreshing preview
            await new Promise((resolve) => setTimeout(resolve, 100));
            queryClient.invalidateQueries({
              queryKey: getDraftConfigQueryKey(),
              refetchType: 'active',
            });
            agentUIActions.refreshPreview();
            break;

          // ========== Guided Review Actions ==========
          // These power the agent-driven section-by-section review

          case 'SHOW_VARIANT_WIDGET':
            // Legacy: agent generated variants. In the new flow, agent drives
            // review via chat. Still enter reviewing mode and highlight.
            if (action.sectionId) {
              refinementActions.setCurrentSection(action.sectionId, action.sectionType);
              refinementActions.setMode('reviewing');
              agentUIActions.highlightSection(action.sectionId);
              agentUIActions.showPreview();
            }
            break;

          case 'SHOW_PUBLISH_READY':
            // All sections are complete, ready to publish
            refinementActions.setMode('publish_ready');
            break;

          case 'HIGHLIGHT_NEXT_SECTION': {
            // Highlight and scroll to the next section to review.
            // Fix #5203: When sectionId is not provided by the agent tool,
            // compute the next incomplete section from SECTION_BLUEPRINT order.
            let nextId = action.sectionId;
            let nextType = action.sectionType;

            if (!nextId) {
              const { completedSections } = useRefinementStore.getState();
              const nextEntry = SECTION_BLUEPRINT.find(
                (entry) => !completedSections.includes(entry.sectionType)
              );
              if (nextEntry) {
                nextId = nextEntry.sectionType;
                nextType = nextEntry.sectionType;
              }
            }

            if (nextId) {
              refinementActions.setCurrentSection(nextId, nextType);
              agentUIActions.highlightSection(nextId);
              agentUIActions.showPreview();
            }
            // If all sections are complete, no-op (publish_ready handles that)
            break;
          }

          case 'REVEAL_SITE':
            // One-shot reveal animation — mobile: dismiss drawer first, blur keyboard
            if (isMobile) {
              (document.activeElement as HTMLElement)?.blur();
              setIsMobileOpen(false);
              await new Promise((r) => setTimeout(r, 300)); // Wait for drawer dismiss
            }
            agentUIActions.revealSite();
            break;

          case 'PUBLISH_SITE':
            // Publish already completed on backend (publish_draft tool).
            // Frontend: update state, invalidate caches, show celebration modal.
            if (isMobile) {
              (document.activeElement as HTMLElement)?.blur();
              setIsMobileOpen(false);
              await new Promise((r) => setTimeout(r, 300));
            }
            refinementActions.setPublishStatus('published');
            // Wait for backend transaction to commit (Pitfall #26)
            await new Promise((resolve) => setTimeout(resolve, 100));
            queryClient.invalidateQueries({
              queryKey: getDraftConfigQueryKey(),
              refetchType: 'active',
            });
            // Refresh onboarding state (phase may advance to COMPLETED)
            queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.state });
            // Switch to live preview
            agentUIActions.showPreview();
            break;

          default: {
            // Exhaustive check — compile error if a new DashboardAction type is added
            // but not handled here (mirrors ContentArea.tsx pattern)
            const _exhaustive: never = action.type;
            void _exhaustive;
          }
        }
      }
    },
    [queryClient, isMobile, setIsMobileOpen]
  );

  // Handle tenant-agent tool completion (triggers preview refresh for storefront changes)
  // Note: Navigation actions are now handled by handleDashboardActions via onDashboardActions
  // Fix #818: Make async and add 100ms delay before invalidation to allow transaction commit
  // Fix #818 (Pitfall #82): Extract dashboardAction from tool results for UI navigation
  const handleToolComplete = useCallback(
    async (toolCalls: TenantAgentToolCall[]) => {
      // FIRST: Extract dashboard actions from tool results (Fix #818 / Pitfall #82)
      // Tool results may contain dashboardAction objects like:
      // { type: 'SCROLL_TO_SECTION', sectionId: 'home-hero-abc123' }
      // { type: 'SHOW_PREVIEW', page: 'home' }
      const dashboardActions = toolCalls
        .map((call) => {
          const result = call.result as Record<string, unknown> | undefined;
          const parsed = DashboardActionSchema.safeParse(result?.dashboardAction);
          return parsed.success ? (parsed.data as DashboardAction) : undefined;
        })
        .filter((action): action is DashboardAction => Boolean(action));

      // Process extracted dashboard actions BEFORE cache invalidation
      // This ensures UI navigation (scroll, highlight, show preview) happens
      // when agent says "Take a look" after updating a section
      if (dashboardActions.length > 0) {
        await handleDashboardActions(dashboardActions);
      }

      // THEN: Check if any tool call modified storefront content (existing logic)
      const modifiedStorefront = toolCalls.some(
        (call) =>
          call.name.includes('storefront') ||
          call.name.includes('section') ||
          call.name.includes('layout') ||
          call.name.includes('branding') ||
          call.name.includes('update_section') ||
          call.name.includes('add_section')
      );

      if (modifiedStorefront) {
        // Fix #818: Wait for backend transaction to commit (Pitfall #26)
        // The 100ms delay ensures the database write is visible before we refetch
        await new Promise((resolve) => setTimeout(resolve, 100));
        // Invalidate and AWAIT refetch so fresh data is available before we push to iframe
        // Without await, refreshPreview() sends stale draftConfig via PostMessage
        await queryClient.invalidateQueries({
          queryKey: getDraftConfigQueryKey(),
          refetchType: 'active',
        });
        // Push fresh draft data to the preview iframe via PostMessage
        agentUIActions.refreshPreview();

        // Auto-reveal: count cumulative section writes during Coming Soon.
        // Reveal only after MVP section count is reached (currently 3: HERO, ABOUT, SERVICES).
        // Derived from SECTION_BLUEPRINT.isRevealMVP — no magic number.
        const contentWriteCount = toolCalls.filter(
          (call) => call.name === 'update_section' || call.name === 'add_section'
        ).length;
        const currentView = useAgentUIStore.getState().view;
        if (currentView.status === 'coming_soon' && contentWriteCount > 0) {
          firstDraftWriteCount += contentWriteCount;
          if (firstDraftWriteCount >= MVP_REVEAL_SECTION_COUNT) {
            agentUIActions.revealSite();
          }
        }
      }

      // Check if marketing content was generated (headlines, etc.)
      const generatedMarketing = toolCalls.some(
        (call) =>
          call.name.includes('marketing') ||
          call.name.includes('headline') ||
          call.name.includes('copy')
      );

      if (generatedMarketing) {
        // Show preview to display the generated content
        agentUIActions.showPreview();
        // Fix #818: Wait for backend transaction to commit
        await new Promise((resolve) => setTimeout(resolve, 100));
        await queryClient.invalidateQueries({
          queryKey: getDraftConfigQueryKey(),
          refetchType: 'active',
        });
        agentUIActions.refreshPreview();
      }

      // Invalidate onboarding state when discovery facts are stored
      // This ensures the stepper UI updates immediately after phase advancement
      const storedFact = toolCalls.find((call) => call.name === 'store_discovery_fact');
      if (storedFact) {
        queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.state });

        // Pipe fact key + slotMetrics to ComingSoonDisplay via agent-ui-store (<200ms update)
        const factResult = storedFact.result as
          | {
              key?: string;
              slotMetrics?: { filled: number; total: number };
            }
          | undefined;
        if (factResult?.key && factResult?.slotMetrics) {
          agentUIActions.addDiscoveredFact(factResult.key, factResult.slotMetrics);
        }
      }

      // Wire mark_section_complete tool results -> refinement store
      // Updates the progress bar and auto-advances to publish_ready if all complete
      const completedSection = toolCalls.find((call) => call.name === 'mark_section_complete');
      if (completedSection) {
        const result = completedSection.result as
          | { sectionId?: string; completedSections?: string[]; totalSections?: number }
          | undefined;
        if (result?.sectionId) {
          refinementActions.markComplete(result.sectionId);
        }
        if (result?.totalSections !== undefined) {
          refinementActions.setTotalSections(result.totalSections);
        }
      }
    },
    [queryClient, handleDashboardActions]
  );

  return {
    handleDashboardActions,
    handleToolComplete,
  };
}
