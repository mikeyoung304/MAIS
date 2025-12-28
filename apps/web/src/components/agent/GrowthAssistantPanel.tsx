'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Sparkles, MessageCircle } from 'lucide-react';
import { PanelAgentChat } from './PanelAgentChat';
import { useGrowthAssistantContext } from '@/contexts/GrowthAssistantContext';

const WELCOME_MESSAGE =
  'Salutations. Are you ready to get handled? Tell me a little about yourself.';

interface GrowthAssistantPanelProps {
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
 * - Integrates PanelAgentChat for messaging
 */
export function GrowthAssistantPanel({ className }: GrowthAssistantPanelProps) {
  const { isOpen, setIsOpen, isFirstVisit, markWelcomed } = useGrowthAssistantContext();
  const [isMounted, setIsMounted] = useState(false);

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

  // Don't render on server to avoid hydration issues
  if (!isMounted) {
    return null;
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
          'flex flex-col bg-white border-l border-neutral-200 shadow-lg',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
        role="complementary"
        aria-label="Growth Assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-white shrink-0">
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
            className="h-8 w-8 rounded-lg hover:bg-neutral-100"
            aria-label="Collapse panel"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Chat content */}
        <div className="flex-1 overflow-hidden">
          <PanelAgentChat
            welcomeMessage={WELCOME_MESSAGE}
            onFirstMessage={handleFirstMessage}
            className="h-full"
          />
        </div>

        {/* First-time badge */}
        {isFirstVisit && (
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
