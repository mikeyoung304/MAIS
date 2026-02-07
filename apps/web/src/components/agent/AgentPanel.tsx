'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Sparkles, MessageCircle, ExternalLink } from 'lucide-react';
import { TenantAgentChat, type TenantAgentUIAction } from './TenantAgentChat';
import type { DashboardAction, TenantAgentToolCall } from '@/hooks/useTenantAgentChat';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useAuth } from '@/lib/auth-client';
import { agentUIActions, useAgentUIStore } from '@/stores/agent-ui-store';
import {
  refinementActions,
  useRefinementStore,
  selectIsReviewing,
} from '@/stores/refinement-store';
import { ReviewProgress } from './ReviewProgress';
import { getDraftConfigQueryKey } from '@/hooks/useDraftConfig';
import { queryKeys } from '@/lib/query-client';
import type { PageName, OnboardingPhase } from '@macon/contracts';
import { SECTION_BLUEPRINT } from '@macon/contracts';
import { Drawer } from 'vaul';
import { useIsMobile } from '@/hooks/useBreakpoint';

// LocalStorage keys for panel state
const PANEL_OPEN_KEY = 'agent-panel-open';
const WELCOMED_KEY = 'agent-panel-welcomed';

interface AgentPanelProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * OnboardingSection - Reusable onboarding progress and preview section
 * (Fix for #747: Extract duplicate onboarding section)
 */
interface OnboardingSectionProps {
  currentPhase: OnboardingPhase;
  onSkip: () => Promise<void>;
  isSkipping: boolean;
  skipError: string | null;
  tenantSlug: string | null | undefined;
}

function OnboardingSection({
  currentPhase,
  onSkip,
  isSkipping,
  skipError,
  tenantSlug,
}: OnboardingSectionProps) {
  return (
    <div className="px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
      <OnboardingProgress
        currentPhase={currentPhase}
        onSkip={onSkip}
        isSkipping={isSkipping}
        skipError={skipError}
      />

      {/* Storefront Preview Link */}
      {tenantSlug && (
        <a
          href={`/t/${tenantSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2 mt-3 px-3 py-2',
            'bg-sage/10 hover:bg-sage/20 rounded-lg',
            'text-sm text-sage transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-sage/30'
          )}
          aria-label="Preview your storefront in a new tab"
        >
          <ExternalLink className="w-4 h-4" />
          <span>View your storefront</span>
        </a>
      )}
    </div>
  );
}

/**
 * AgentPanel - Right-side AI assistant panel (formerly GrowthAssistantPanel)
 *
 * Agent-first architecture: The AI chatbot is THE central interface for tenant dashboard.
 * - Always visible by default (fixed position on right)
 * - Persists open/closed state to localStorage
 * - Handles UI actions from agent tools (show preview, navigate, etc.)
 * - Onboarding progress indicator when in onboarding mode
 *
 * Onboarding Mode:
 * - Shows progress dots indicating current phase
 * - Provides "View storefront" link for previewing changes
 * - Offers "Skip setup" option for manual configuration
 * - Uses personalized welcome messages for returning users
 */
export function AgentPanel({ className }: AgentPanelProps) {
  const { slug: tenantSlug } = useAuth();
  // Use React Query client directly instead of module singleton (fixes race condition)
  const queryClient = useQueryClient();

  // Guided review mode — show progress indicator when reviewing sections
  const isReviewing = useRefinementStore(selectIsReviewing);

  // Mobile/desktop detection
  const isMobileQuery = useIsMobile();
  const isMobile = isMobileQuery ?? false; // Fallback to false during SSR

  // Panel open/closed state (persisted to localStorage)
  const [isOpen, setIsOpenState] = useState(true); // Default open on desktop
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Mobile-specific state for Vaul drawer
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Refs for accessibility (focus management)
  const announcerRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Fix for #743: Focus timer race condition - shared ref for cleanup
  const focusTimerRef = useRef<number | null>(null);

  // Onboarding state
  const { currentPhase, isOnboarding, skipOnboarding, isSkipping, skipError } =
    useOnboardingState();

  // WCAG 4.1.3: Screen reader announcement helper
  const announce = useCallback((message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = message;
    }
  }, []);

  // Fix for #743: Cleanup focus timer on unmount to prevent race conditions
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    setIsMounted(true);

    const storedOpen = localStorage.getItem(PANEL_OPEN_KEY);
    const welcomed = localStorage.getItem(WELCOMED_KEY);

    // Check if this is first visit
    if (!welcomed) {
      setIsFirstVisit(true);
      setIsOpenState(true); // Auto-open for first-time visitors (desktop only)
    } else {
      // Use stored preference or default to open
      setIsOpenState(storedOpen === null ? true : storedOpen === 'true');
    }
  }, []);

  // Persist open state to localStorage
  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
    localStorage.setItem(PANEL_OPEN_KEY, String(open));
  }, []);

  // WCAG 2.4.3: Background inert management for mobile drawer
  useEffect(() => {
    if (!isMobile) return; // Desktop doesn't need inert management

    const main = document.getElementById('main-content');
    if (isMobileOpen && main) {
      main.setAttribute('inert', 'true');
    } else if (main) {
      main.removeAttribute('inert');
    }

    // Cleanup on unmount
    return () => {
      if (main) {
        main.removeAttribute('inert');
      }
    };
  }, [isMobileOpen, isMobile]);

  // Handle UI actions from tenant-agent tool calls (legacy - from tool name matching)
  const handleTenantAgentUIAction = useCallback((action: TenantAgentUIAction) => {
    switch (action.type) {
      case 'SHOW_PREVIEW':
        agentUIActions.showPreview((action.page as PageName) || 'home');
        break;
      case 'SHOW_DASHBOARD':
        agentUIActions.showDashboard();
        break;
      case 'HIGHLIGHT_SECTION':
        if (action.sectionId) {
          agentUIActions.highlightSection(action.sectionId);
        }
        break;
      case 'REFRESH_PREVIEW':
        agentUIActions.refreshPreview();
        break;
    }
  }, []);

  // Handle dashboard actions from agent navigation tools (new - from backend extraction)
  // Fix #819: Add cache invalidation to SHOW_PREVIEW and REFRESH actions
  // Guided Refinement: Handle SHOW_VARIANT_WIDGET, SHOW_PUBLISH_READY, HIGHLIGHT_NEXT_SECTION
  const handleDashboardActions = useCallback(
    async (actions: DashboardAction[]) => {
      for (const action of actions) {
        switch (action.type) {
          case 'NAVIGATE':
            // Navigate to a dashboard section - "website" means show preview
            if (action.section === 'website') {
              agentUIActions.showPreview('home');
            }
            // Other sections could be handled here (bookings, projects, settings, analytics)
            break;
          case 'SCROLL_TO_SECTION':
            // Scroll to and highlight a specific website section
            // Supports both formats:
            // - blockType: legacy format (e.g., "HERO" → "home-HERO-primary")
            // - sectionId: new format from storefront tools (e.g., "home-hero-abc123")
            if (action.sectionId) {
              agentUIActions.highlightSection(action.sectionId);
            } else if (action.blockType) {
              // Convert HERO → home-HERO-primary format for highlightSection
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
            agentUIActions.showPreview('home');
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
              agentUIActions.showPreview('home');
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
              agentUIActions.showPreview('home');
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
            agentUIActions.showPreview('home');
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
    [queryClient, isMobile]
  );

  // Handle tenant-agent tool completion (triggers preview refresh for storefront changes)
  // Note: Navigation actions are now handled by handleDashboardActions via onDashboardActions
  // Fix #818: Make async and add 100ms delay before invalidation to allow transaction commit
  // Fix #818 (Pitfall #82): Extract dashboardAction from tool results for UI navigation
  const handleTenantAgentToolComplete = useCallback(
    async (toolCalls: TenantAgentToolCall[]) => {
      // FIRST: Extract dashboard actions from tool results (Fix #818 / Pitfall #82)
      // Tool results may contain dashboardAction objects like:
      // { type: 'SCROLL_TO_SECTION', sectionId: 'home-hero-abc123' }
      // { type: 'SHOW_PREVIEW', page: 'home' }
      const dashboardActions = toolCalls
        .map((call) => {
          const result = call.result as Record<string, unknown> | undefined;
          return result?.dashboardAction as DashboardAction | undefined;
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

        // Auto-reveal: if the user is still on Coming Soon and the agent just
        // modified storefront content, trigger the reveal animation automatically.
        // This closes the loop for Bug 3 — agent updates sections → reveal fires
        // without needing a separate REVEAL_SITE dashboard action.
        const currentView = useAgentUIStore.getState().view;
        if (currentView.status === 'coming_soon') {
          agentUIActions.revealSite();
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
        agentUIActions.showPreview('home');
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

      // Wire mark_section_complete tool results → refinement store
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

  // Handle first message sent - mark user as welcomed
  const handleFirstMessage = useCallback(() => {
    if (isFirstVisit) {
      localStorage.setItem(WELCOMED_KEY, 'true');
      setIsFirstVisit(false);
    }
  }, [isFirstVisit]);

  // Handle skip onboarding
  const handleSkip = async () => {
    await skipOnboarding('User skipped from assistant panel');
  };

  // Return skeleton during SSR to prevent hydration flash
  // On mobile, skeleton is hidden (panel is hidden by default on mobile)
  if (!isMounted || isMobileQuery === undefined) {
    return (
      <aside
        className={cn(
          'fixed right-0 top-0 h-screen z-40',
          'w-[400px] max-w-full',
          'flex flex-col bg-surface-alt border-l border-neutral-700 shadow-lg',
          // Hidden on mobile during SSR
          'hidden lg:flex',
          className
        )}
        role="complementary"
        aria-label="AI Assistant"
        aria-busy="true"
      >
        {/* Skeleton header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-700 animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-32 bg-neutral-700 rounded animate-pulse" />
              <div className="h-3 w-20 bg-neutral-700 rounded animate-pulse" />
            </div>
          </div>
        </div>
        {/* Skeleton chat area */}
        <div className="flex-1 p-4 space-y-3">
          <div className="h-16 bg-neutral-700 rounded-lg animate-pulse" />
          <div className="h-12 bg-neutral-700 rounded-lg animate-pulse" />
        </div>
      </aside>
    );
  }

  // Desktop: Use fixed aside panel (unchanged from before)
  if (!isMobile) {
    return (
      <>
        {/* Desktop collapsed state toggle button */}
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            variant="sage"
            className={cn(
              'fixed right-0 top-1/2 -translate-y-1/2 z-40',
              'h-auto py-4 px-2 rounded-l-xl rounded-r-none',
              'shadow-lg hover:shadow-xl transition-all duration-300',
              'flex-col items-center gap-2'
            )}
            aria-label="Open AI Assistant"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium" style={{ writingMode: 'vertical-rl' }}>
              Assistant
            </span>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}

        {/* Fixed side panel (desktop) */}
        <aside
          className={cn(
            'fixed right-0 top-0 h-screen z-40',
            'w-[400px]',
            'flex flex-col bg-surface-alt border-l border-neutral-700 shadow-lg',
            'transition-transform duration-300 ease-in-out',
            isOpen ? 'translate-x-0' : 'translate-x-full',
            className
          )}
          role="complementary"
          aria-label="AI Assistant"
          data-testid="agent-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sage/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-sage" />
              </div>
              <div>
                <h2 className="text-base font-serif font-semibold text-text-primary">
                  AI Assistant
                </h2>
                <p className="text-xs text-text-muted">Powered by AI</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="rounded-lg hover:bg-neutral-700"
              aria-label="Collapse panel"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Onboarding Progress (when in onboarding mode) */}
          {isOnboarding && (
            <OnboardingSection
              currentPhase={currentPhase}
              onSkip={handleSkip}
              isSkipping={isSkipping}
              skipError={skipError}
              tenantSlug={tenantSlug}
            />
          )}

          {/* Review Progress (when agent is walking through sections) */}
          {isReviewing && <ReviewProgress />}

          {/* Chat content - TenantAgentChat (agent speaks first based on session state) */}
          <div className="flex-1 overflow-hidden">
            <TenantAgentChat
              onFirstMessage={handleFirstMessage}
              onUIAction={handleTenantAgentUIAction}
              onToolComplete={handleTenantAgentToolComplete}
              onDashboardActions={handleDashboardActions}
              className="h-full"
            />
          </div>

          {/* First-time badge (only when not in onboarding) */}
          {isFirstVisit && !isOnboarding && (
            <div className="absolute top-16 right-4 z-10">
              <div className="bg-sage text-white text-xs font-medium px-2 py-1 rounded-full shadow-md animate-pulse">
                New
              </div>
            </div>
          )}
        </aside>
      </>
    );
  }

  // Mobile: Vaul bottom sheet with full accessibility
  return (
    <>
      {/* WCAG: Screen reader announcer (persistent, hidden) */}
      <div
        ref={announcerRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <Drawer.Root
        open={isMobileOpen}
        onOpenChange={(open) => {
          setIsMobileOpen(open);
          announce(
            open
              ? 'AI Assistant drawer opened. Use Tab to navigate, Escape to close.'
              : 'AI Assistant drawer closed.'
          );
        }}
        repositionInputs={false} // iOS Safari fix for issue #574
        dismissible={true} // Allow dismissing with swipe-down gesture
        modal={true} // Trap focus within drawer
      >
        {/* Mobile FAB trigger button - bottom right */}
        <Drawer.Trigger asChild>
          <Button
            ref={fabRef}
            variant="sage"
            className={cn(
              'fixed right-6 bottom-6 z-50',
              'h-14 w-14 rounded-full',
              'shadow-lg hover:shadow-xl transition-all duration-300',
              'flex items-center justify-center'
            )}
            aria-label="Open AI Assistant chat"
          >
            <Sparkles className="w-6 h-6" />
          </Button>
        </Drawer.Trigger>

        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Drawer.Content
            role="dialog"
            aria-modal="true"
            aria-label="AI Assistant Chat"
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'h-[85vh]',
              'flex flex-col',
              'rounded-t-3xl bg-surface-alt shadow-xl'
            )}
            onOpenAutoFocus={(e) => {
              // Focus input when drawer opens (Fix #743: Cancel previous timer to prevent race)
              e.preventDefault();
              if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
              focusTimerRef.current = window.setTimeout(() => {
                inputRef.current?.focus();
                focusTimerRef.current = null;
              }, 100);
            }}
            onCloseAutoFocus={(e) => {
              // Focus FAB when drawer closes (Fix #743: Cancel previous timer to prevent race)
              e.preventDefault();
              if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
              focusTimerRef.current = window.setTimeout(() => {
                fabRef.current?.focus();
                focusTimerRef.current = null;
              }, 100);
            }}
          >
            {/* WCAG 2.5.8: Drag handle (24px minimum touch target) */}
            <div className="flex justify-center py-3 shrink-0">
              <div className="w-12 h-6 rounded-full bg-neutral-300" aria-hidden="true" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-sage/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-sage" />
                </div>
                <div>
                  <h2 className="text-base font-serif font-semibold text-text-primary">
                    AI Assistant
                  </h2>
                  <p className="text-xs text-text-muted">Powered by AI</p>
                </div>
              </div>
              <Drawer.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg hover:bg-neutral-700"
                  aria-label="Close drawer"
                >
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </Button>
              </Drawer.Close>
            </div>

            {/* Onboarding Progress (when in onboarding mode) */}
            {isOnboarding && (
              <OnboardingSection
                currentPhase={currentPhase}
                onSkip={handleSkip}
                isSkipping={isSkipping}
                skipError={skipError}
                tenantSlug={tenantSlug}
              />
            )}

            {/* Review Progress (when agent is walking through sections) */}
            {isReviewing && <ReviewProgress />}

            {/* Chat content - TenantAgentChat (agent speaks first based on session state) */}
            <div className="flex-1 overflow-hidden">
              <TenantAgentChat
                onFirstMessage={handleFirstMessage}
                onUIAction={handleTenantAgentUIAction}
                onToolComplete={handleTenantAgentToolComplete}
                onDashboardActions={handleDashboardActions}
                inputRef={inputRef}
                messagesRole="log"
                className="h-full"
              />
            </div>

            {/* First-time badge (only when not in onboarding) */}
            {isFirstVisit && !isOnboarding && (
              <div className="absolute top-16 right-4 z-10">
                <div className="bg-sage text-white text-xs font-medium px-2 py-1 rounded-full shadow-md animate-pulse">
                  New
                </div>
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

export default AgentPanel;
