'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Sparkles, MessageCircle, ExternalLink } from 'lucide-react';
import { PanelAgentChat } from './PanelAgentChat';
import { useGrowthAssistantContext } from '@/contexts/GrowthAssistantContext';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { useOnboardingState } from '@/hooks/useOnboardingState';

// Welcome messages based on onboarding state
const WELCOME_MESSAGES = {
  new: "Salutations! I'm here to help you set up your business. Instead of filling out forms, we'll just have a conversation and I'll handle the setup for you.\n\nSo — what kind of services do you offer?",
  returning: 'Welcome back! Ready to continue where we left off?',
  default: 'Salutations. Are you ready to get handled? Tell me a little about yourself.',
};

interface GrowthAssistantPanelProps {
  /** Tenant slug for storefront link */
  tenantSlug?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * GrowthAssistantPanel - Right-side AI assistant panel
 *
 * Cursor-style side panel for tenant dashboard:
 * - Always visible by default (fixed position on right)
 * - Persists open/closed state to localStorage
 * - Welcome message for first-time users
 * - Onboarding progress indicator when in onboarding mode
 * - Integrates PanelAgentChat for messaging
 *
 * Onboarding Mode:
 * - Shows progress dots indicating current phase
 * - Provides "View storefront" link for previewing changes
 * - Offers "Skip setup" option for manual configuration
 * - Uses personalized welcome messages for returning users
 */
export function GrowthAssistantPanel({ tenantSlug, className }: GrowthAssistantPanelProps) {
  const { isOpen, setIsOpen, isFirstVisit, markWelcomed } = useGrowthAssistantContext();
  const [isMounted, setIsMounted] = useState(false);

  // Onboarding state
  const { currentPhase, isOnboarding, isReturning, skipOnboarding, isSkipping, skipError } =
    useOnboardingState();

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle first message sent
  const handleFirstMessage = () => {
    if (isFirstVisit) {
      markWelcomed();
    }
  };

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
        aria-label="Growth Assistant"
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
          aria-label="Open Growth Assistant"
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
        aria-label="Growth Assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sage/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-sage" />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-text-primary">
                Growth Assistant
              </h2>
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

export default GrowthAssistantPanel;
