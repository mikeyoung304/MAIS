'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Sparkles, MessageCircle, ExternalLink } from 'lucide-react';
import { PanelAgentChat, type AgentUIAction } from './PanelAgentChat';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useAuth } from '@/lib/auth-client';
import { agentUIActions } from '@/stores/agent-ui-store';
import { invalidateDraftConfig } from '@/hooks/useDraftConfig';
import type { PageName, LandingPageConfig, OnboardingPhase } from '@macon/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Drawer } from 'vaul';
import { useIsMobile } from '@/hooks/useBreakpoint';

// LocalStorage keys for panel state
const PANEL_OPEN_KEY = 'agent-panel-open';
const WELCOMED_KEY = 'agent-panel-welcomed';

// Welcome messages based on onboarding state
const WELCOME_MESSAGES = {
  new: "Salutations! I'm here to help you set up your business. Instead of filling out forms, we'll just have a conversation and I'll handle the setup for you.\n\nSo — what kind of services do you offer?",
  returning: 'Welcome back! Ready to continue where we left off?',
  default: 'Salutations. Are you ready to get handled? Tell me a little about yourself.',
};

interface AgentPanelProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Tool result that includes an updated config from executor
 * (Fix for #740: Remove `any` types in tool results)
 */
interface ToolResultWithConfig {
  success: true;
  data: {
    updatedConfig: LandingPageConfig;
    [key: string]: unknown;
  };
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
  const router = useRouter();
  const { slug: tenantSlug } = useAuth();

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
  const { currentPhase, isOnboarding, isReturning, skipOnboarding, isSkipping, skipError } =
    useOnboardingState();

  // React Query client for optimistic updates (Phase 1.4)
  const queryClient = useQueryClient();

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

  /**
   * Fix for #739, #740, #742: Extract duplicate onToolComplete logic with proper types
   * Phase 1.4: Optimistic updates with 100ms failsafe (increased from 50ms)
   */
  const handleToolComplete = useCallback(
    (toolResults?: Array<{ success: boolean; data?: any }>) => {
      // Check if any tool result contains updatedConfig (from Phase 1.4 executors)
      const resultWithConfig = toolResults?.find(
        (r): r is ToolResultWithConfig =>
          r.success && r.data != null && typeof r.data === 'object' && 'updatedConfig' in r.data
      );

      if (resultWithConfig?.data?.updatedConfig) {
        // Optimistic update: Immediately set cached config from executor response
        queryClient.setQueryData(['draft-config'], resultWithConfig.data.updatedConfig);

        // CRITICAL: 100ms failsafe for READ COMMITTED propagation (increased from 50ms)
        // This is a database consistency pattern, not just optimization
        // Prevents stale data if executor returns slightly outdated config
        setTimeout(() => {
          invalidateDraftConfig();
        }, 100);
      } else {
        // Fallback: If executor doesn't return updatedConfig (shouldn't happen with Phase 1.4)
        // Use 100ms delay for extra safety margin
        setTimeout(() => {
          invalidateDraftConfig();
        }, 100);
      }
    },
    [queryClient]
  );

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

  // Handle UI actions from agent tools
  const handleUIAction = useCallback(
    (action: AgentUIAction) => {
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
        case 'NAVIGATE':
          if (action.path) {
            router.push(action.path);
          }
          break;
      }
    },
    [router]
  );

  // Handle first message sent - mark user as welcomed
  const handleFirstMessage = useCallback(() => {
    if (isFirstVisit) {
      localStorage.setItem(WELCOMED_KEY, 'true');
      setIsFirstVisit(false);
    }
  }, [isFirstVisit]);

  // Determine welcome message based on state
  const getWelcomeMessage = () => {
    if (isOnboarding) {
      return isReturning ? WELCOME_MESSAGES.returning : WELCOME_MESSAGES.new;
    }
    return WELCOME_MESSAGES.default;
  };

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

          {/* Chat content */}
          <div className="flex-1 overflow-hidden">
            <PanelAgentChat
              welcomeMessage={getWelcomeMessage()}
              onFirstMessage={handleFirstMessage}
              onUIAction={handleUIAction}
              onToolComplete={handleToolComplete}
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

            {/* Chat content */}
            <div className="flex-1 overflow-hidden">
              <PanelAgentChat
                welcomeMessage={getWelcomeMessage()}
                onFirstMessage={handleFirstMessage}
                onUIAction={handleUIAction}
                onToolComplete={handleToolComplete}
                inputRef={inputRef}
                messagesRole="log" // WCAG: Screen reader support for messages
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
