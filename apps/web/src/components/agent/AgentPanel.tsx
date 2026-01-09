'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Sparkles, MessageCircle, ExternalLink } from 'lucide-react';
import { PanelAgentChat, type AgentUIAction } from './PanelAgentChat';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useAuth } from '@/lib/auth-client';
import { agentUIActions } from '@/stores/agent-ui-store';
import type { PageName } from '@macon/contracts';

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

  // Panel open/closed state (persisted to localStorage)
  const [isOpen, setIsOpenState] = useState(true); // Default open
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Onboarding state
  const { currentPhase, isOnboarding, isReturning, skipOnboarding, isSkipping, skipError } =
    useOnboardingState();

  // Load persisted state from localStorage on mount
  useEffect(() => {
    setIsMounted(true);

    const storedOpen = localStorage.getItem(PANEL_OPEN_KEY);
    const welcomed = localStorage.getItem(WELCOMED_KEY);

    // Check if this is first visit
    if (!welcomed) {
      setIsFirstVisit(true);
      setIsOpenState(true); // Auto-open for first-time visitors
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
  if (!isMounted) {
    return (
      <aside
        className={cn(
          'fixed right-0 top-0 h-screen z-40',
          'w-[400px] max-w-[90vw]',
          'flex flex-col bg-surface-alt border-l border-neutral-700 shadow-lg',
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

  return (
    <>
      {/* Collapsed state toggle button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          variant="sage"
          className={cn(
            'fixed right-0 top-1/2 -translate-y-1/2 z-40',
            'h-auto py-4 px-2 rounded-l-xl rounded-r-none',
            'shadow-lg hover:shadow-xl transition-all duration-300',
            'flex flex-col items-center gap-2'
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

      {/* Fixed side panel */}
      <aside
        className={cn(
          'fixed right-0 top-0 h-screen z-40',
          'w-[400px] max-w-[90vw]',
          'flex flex-col bg-surface-alt border-l border-neutral-700 shadow-lg',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
        role="complementary"
        aria-label="AI Assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sage/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-sage" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-text-primary">AI Assistant</h2>
              <p className="text-xs text-text-muted">Powered by AI</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 rounded-lg hover:bg-neutral-700"
            aria-label="Collapse panel"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Onboarding Progress (when in onboarding mode) */}
        {isOnboarding && (
          <div className="px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
            <OnboardingProgress
              currentPhase={currentPhase}
              onSkip={handleSkip}
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
        )}

        {/* Chat content */}
        <div className="flex-1 overflow-hidden">
          <PanelAgentChat
            welcomeMessage={getWelcomeMessage()}
            onFirstMessage={handleFirstMessage}
            onUIAction={handleUIAction}
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

export default AgentPanel;
