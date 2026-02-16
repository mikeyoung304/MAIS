'use client';

import { Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReviewProgress } from './ReviewProgress';

/**
 * SkipSetupLink - Reusable skip button for onboarding mode
 * Used in both desktop (aside) and mobile (drawer) layouts
 */
function SkipSetupLink({ onSkip, isSkipping }: { onSkip: () => void; isSkipping: boolean }) {
  return (
    <div className="flex justify-end px-4 py-1 border-b border-neutral-700 bg-surface-alt shrink-0">
      <button
        onClick={onSkip}
        disabled={isSkipping}
        className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        aria-label="Skip onboarding setup"
      >
        {isSkipping ? 'Skipping...' : 'Skip setup'}
      </button>
    </div>
  );
}

interface PanelHeaderProps {
  /** Optional trailing action (desktop: collapse button, mobile: close drawer) */
  trailingAction?: React.ReactNode;
}

/**
 * PanelHeader - Shared header for desktop aside and mobile drawer
 */
export function PanelHeader({ trailingAction }: PanelHeaderProps) {
  return (
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
      {trailingAction}
    </div>
  );
}

/**
 * Desktop collapse button for PanelHeader trailingAction
 */
export function CollapseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="rounded-lg hover:bg-neutral-700"
      aria-label="Collapse panel"
    >
      <ChevronRight className="w-4 h-4" />
    </Button>
  );
}

interface AgentPanelChromeProps {
  /** Header trailing action (collapse/close button) */
  headerTrailingAction?: React.ReactNode;
  /** Whether in onboarding mode (shows skip link) */
  isOnboarding: boolean;
  /** Whether in guided review mode (shows review progress) */
  isReviewing: boolean;
  /** Skip handler */
  onSkip: () => void;
  /** Skip loading state */
  isSkipping: boolean;
  /** Whether this is first visit + not onboarding (shows "New" badge) */
  showNewBadge: boolean;
  /** Chat content (TenantAgentChat instance) */
  children: React.ReactNode;
}

/**
 * AgentPanelChrome - Shared layout for desktop and mobile agent panel.
 *
 * Renders the common panel structure:
 * 1. Header (with configurable trailing action)
 * 2. Skip link (if onboarding)
 * 3. Review progress (if reviewing)
 * 4. Chat content (children)
 * 5. "New" badge (if first visit, not onboarding)
 */
export function AgentPanelChrome({
  headerTrailingAction,
  isOnboarding,
  isReviewing,
  onSkip,
  isSkipping,
  showNewBadge,
  children,
}: AgentPanelChromeProps) {
  return (
    <>
      <PanelHeader trailingAction={headerTrailingAction} />

      {/* Minimal skip link (when in onboarding mode) */}
      {isOnboarding && <SkipSetupLink onSkip={onSkip} isSkipping={isSkipping} />}

      {/* Review Progress (when agent is walking through sections) */}
      {isReviewing && <ReviewProgress />}

      {/* Chat content - TenantAgentChat (agent speaks first based on session state) */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* First-time badge (only when not in onboarding) */}
      {showNewBadge && (
        <div className="absolute top-16 right-4 z-10">
          <div className="bg-sage text-white text-xs font-medium px-2 py-1 rounded-full shadow-md animate-pulse">
            New
          </div>
        </div>
      )}
    </>
  );
}
