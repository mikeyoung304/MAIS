'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Sparkles, MessageCircle } from 'lucide-react';
import { TenantAgentChat, type TenantAgentUIAction } from './TenantAgentChat';
import { AgentPanelChrome, CollapseButton } from './AgentPanelChrome';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import { useDashboardActionDispatch } from '@/hooks/useDashboardActionDispatch';
import { useAgentPanelState } from '@/hooks/useAgentPanelState';
import { agentUIActions } from '@/stores/agent-ui-store';
import { useRefinementStore, selectIsReviewing } from '@/stores/refinement-store';
import { Drawer } from 'vaul';
import { useIsMobile } from '@/hooks/useBreakpoint';

interface AgentPanelProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * AgentPanel - Right-side AI assistant panel
 *
 * Thin orchestrator composing:
 * - `useAgentPanelState()` for open/closed + first-visit state
 * - `useDashboardActionDispatch()` for dashboard action handling + tool completion
 * - `AgentPanelChrome` for shared header/skip/progress layout
 * - `TenantAgentChat` for chat UI
 *
 * Renders desktop fixed aside or mobile Vaul drawer based on viewport.
 */
export function AgentPanel({ className }: AgentPanelProps) {
  const isReviewing = useRefinementStore(selectIsReviewing);
  const isMobileQuery = useIsMobile();
  const isMobile = isMobileQuery ?? false;

  // Panel state (open/closed, first-visit, SSR hydration)
  const { isOpen, setIsOpen, isFirstVisit, isMounted, markWelcomed } = useAgentPanelState();

  // Mobile drawer state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Refs for accessibility
  const announcerRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusTimerRef = useRef<number | null>(null);

  // Onboarding state
  const { isOnboarding, skipOnboarding, isSkipping } = useOnboardingState();

  // Dashboard action dispatch (handles tool completion + dashboard actions)
  const { handleDashboardActions, handleToolComplete } = useDashboardActionDispatch({
    isMobile,
    setIsMobileOpen,
  });

  // WCAG 4.1.3: Screen reader announcement helper
  const announce = useCallback((message: string) => {
    if (announcerRef.current) announcerRef.current.textContent = message;
  }, []);

  // Fix for #743: Cleanup focus timer on unmount
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  // WCAG 2.4.3: Background inert management for mobile drawer
  useEffect(() => {
    if (!isMobile) return;
    const main = document.getElementById('main-content');
    if (isMobileOpen && main) {
      main.setAttribute('inert', 'true');
    } else if (main) {
      main.removeAttribute('inert');
    }
    return () => {
      if (main) main.removeAttribute('inert');
    };
  }, [isMobileOpen, isMobile]);

  // Handle UI actions from tenant-agent tool calls (legacy - from tool name matching)
  const handleUIAction = useCallback((action: TenantAgentUIAction) => {
    switch (action.type) {
      case 'SHOW_PREVIEW':
        agentUIActions.showPreview();
        break;
      case 'SHOW_DASHBOARD':
        agentUIActions.showDashboard();
        break;
      case 'HIGHLIGHT_SECTION':
        if (action.sectionId) agentUIActions.highlightSection(action.sectionId);
        break;
      case 'REFRESH_PREVIEW':
        agentUIActions.refreshPreview();
        break;
    }
  }, []);

  const handleSkip = async () => {
    await skipOnboarding('User skipped from assistant panel');
  };

  const showNewBadge = isFirstVisit && !isOnboarding;

  // Shared chat props for desktop and mobile
  const chatProps = {
    onFirstMessage: markWelcomed,
    onUIAction: handleUIAction,
    onToolComplete: handleToolComplete,
    onDashboardActions: handleDashboardActions,
  } as const;

  // Shared chrome props for desktop and mobile
  const chromeProps = {
    isOnboarding,
    isReviewing,
    onSkip: handleSkip,
    isSkipping,
    showNewBadge,
  } as const;

  // SSR skeleton to prevent hydration flash
  if (!isMounted || isMobileQuery === undefined) {
    return (
      <aside
        className={cn(
          'fixed right-0 top-0 h-screen z-40',
          'w-[400px] max-w-full',
          'flex flex-col bg-surface-alt border-l border-neutral-700 shadow-lg',
          'hidden lg:flex',
          className
        )}
        role="complementary"
        aria-label="AI Assistant"
        aria-busy="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-700 animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-32 bg-neutral-700 rounded animate-pulse" />
              <div className="h-3 w-20 bg-neutral-700 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          <div className="h-16 bg-neutral-700 rounded-lg animate-pulse" />
          <div className="h-12 bg-neutral-700 rounded-lg animate-pulse" />
        </div>
      </aside>
    );
  }

  // Desktop: Fixed aside panel
  if (!isMobile) {
    return (
      <>
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
        <aside
          className={cn(
            'fixed right-0 top-0 h-screen z-40 w-[400px]',
            'flex flex-col bg-surface-alt border-l border-neutral-700 shadow-lg',
            'transition-transform duration-300 ease-in-out',
            isOpen ? 'translate-x-0' : 'translate-x-full',
            className
          )}
          role="complementary"
          aria-label="AI Assistant"
          data-testid="agent-panel"
        >
          <AgentPanelChrome
            headerTrailingAction={<CollapseButton onClick={() => setIsOpen(false)} />}
            {...chromeProps}
          >
            <TenantAgentChat {...chatProps} className="h-full" />
          </AgentPanelChrome>
        </aside>
      </>
    );
  }

  // Mobile: Vaul bottom sheet
  return (
    <>
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
        repositionInputs={false}
        dismissible={true}
        modal={true}
      >
        <Drawer.Trigger asChild>
          <Button
            ref={fabRef}
            variant="sage"
            className={cn(
              'fixed right-6 bottom-6 z-50 h-14 w-14 rounded-full',
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
              'fixed bottom-0 left-0 right-0 z-50 h-[85vh]',
              'flex flex-col rounded-t-3xl bg-surface-alt shadow-xl'
            )}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
              focusTimerRef.current = window.setTimeout(() => {
                inputRef.current?.focus();
                focusTimerRef.current = null;
              }, 100);
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
              focusTimerRef.current = window.setTimeout(() => {
                fabRef.current?.focus();
                focusTimerRef.current = null;
              }, 100);
            }}
          >
            <div className="flex justify-center py-3 shrink-0">
              <div className="w-12 h-6 rounded-full bg-neutral-300" aria-hidden="true" />
            </div>
            <AgentPanelChrome
              headerTrailingAction={
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
              }
              {...chromeProps}
            >
              <TenantAgentChat
                {...chatProps}
                inputRef={inputRef}
                messagesRole="log"
                className="h-full"
              />
            </AgentPanelChrome>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

export default AgentPanel;
