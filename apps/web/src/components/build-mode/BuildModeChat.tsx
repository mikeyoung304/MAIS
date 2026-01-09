'use client';

import { useCallback, useState } from 'react';
import { PanelAgentChat } from '@/components/agent/PanelAgentChat';
import { cn } from '@/lib/utils';
import type { PageName } from '@macon/contracts';
import type { BuildModeChatContext } from '@/lib/build-mode/types';
import { Palette, FileEdit, Layers, Type, Image, MessageSquare } from 'lucide-react';

interface BuildModeChatProps {
  context: BuildModeChatContext;
  onConfigUpdate?: () => void;
  onSectionHighlight?: (pageId: PageName, sectionIndex: number) => void;
  className?: string;
}

/**
 * BuildModeChat - Chat panel for Build Mode
 *
 * Wraps PanelAgentChat with Build Mode specific:
 * - Context about current page being edited
 * - Welcome message focused on editing
 * - Quick action chips for common operations
 * - Compact styling for split-screen layout
 */
/**
 * Resolve a section ID to page and index for highlighting
 *
 * Section IDs follow the pattern: {page}-{type}-{qualifier}
 * e.g., "home-hero-main", "about-text-intro"
 *
 * @returns pageId and sectionIndex, or null if not resolvable
 */
function resolveSectionId(sectionId: string): { pageId: PageName; sectionIndex: number } | null {
  // Section IDs follow pattern: {page}-{type}-{qualifier}
  // e.g., "home-hero-main" → page="home", type="hero", qualifier="main"
  const parts = sectionId.split('-');
  if (parts.length < 2) return null;

  const pageId = parts[0] as PageName;

  // For now, we pass index 0 and let the parent handle the actual resolution
  // The parent (BuildModePage) knows the actual draft config and can find the section
  // This is a simplified approach - the highlight message goes to the preview iframe
  // which handles section lookup by ID directly
  return { pageId, sectionIndex: 0 };
}

export function BuildModeChat({
  context,
  onConfigUpdate,
  onSectionHighlight,
  className,
}: BuildModeChatProps) {
  // State for pending message from quick action chips
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Handle section highlight from agent messages
  const handleSectionHighlight = useCallback(
    (sectionId: string) => {
      if (!onSectionHighlight) return;

      const resolved = resolveSectionId(sectionId);
      if (resolved) {
        onSectionHighlight(resolved.pageId, resolved.sectionIndex);
      }
    },
    [onSectionHighlight]
  );

  const welcomeMessage = `Hey! Welcome to Build Mode! 🎨

This is where you customize your website. I'm here to help — just tell me what you'd like to change:

• "Update my headline to..."
• "Add a testimonials section"
• "Change the colors to..."

Your changes save automatically to a draft. When you're happy, hit Publish to go live.

What would you like to work on first?

[Quick Replies: Update headline | Add section | Change colors]`;

  // Handle quick action clicks - populate the chat input with a prompt
  const handleQuickAction = useCallback(
    (action: string) => {
      const prompts: Record<string, string> = {
        headline: `Update the headline on the ${context.currentPage} page`,
        section: `Add a new section to the ${context.currentPage} page`,
        text: `Edit the text content on the ${context.currentPage} page`,
        image: `Update the images on the ${context.currentPage} page`,
        testimonials: `Update the testimonials section`,
      };
      const prompt = prompts[action];
      if (prompt) {
        setPendingMessage(prompt);
      }
    },
    [context.currentPage]
  );

  return (
    <div className={cn('flex flex-col h-full bg-surface-alt', className)}>
      {/* Context header */}
      <div className="px-4 py-3 border-b border-neutral-700 bg-surface">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sage/20">
            <Palette className="h-5 w-5 text-sage" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">Build Mode Assistant</h2>
            <p className="text-xs text-text-muted">
              Editing: <span className="font-medium capitalize">{context.currentPage}</span> page
              {context.sectionCount > 0 && (
                <span className="ml-1">• {context.sectionCount} sections</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 py-2 border-b border-neutral-700 bg-surface-alt/50 overflow-x-auto">
        <div className="flex items-center gap-2 text-xs text-text-muted min-w-max">
          <span className="text-text-muted/60">Quick:</span>
          <QuickActionChip
            icon={<FileEdit className="h-3 w-3" />}
            label="Edit headline"
            onClick={() => handleQuickAction('headline')}
          />
          <QuickActionChip
            icon={<Layers className="h-3 w-3" />}
            label="Add section"
            onClick={() => handleQuickAction('section')}
          />
          <QuickActionChip
            icon={<Type className="h-3 w-3" />}
            label="Edit text"
            onClick={() => handleQuickAction('text')}
          />
          <QuickActionChip
            icon={<Image className="h-3 w-3" />}
            label="Images"
            onClick={() => handleQuickAction('image')}
          />
          <QuickActionChip
            icon={<MessageSquare className="h-3 w-3" />}
            label="Testimonials"
            onClick={() => handleQuickAction('testimonials')}
          />
        </div>
      </div>

      {/* Chat interface */}
      <div className="flex-1 min-h-0">
        <PanelAgentChat
          welcomeMessage={welcomeMessage}
          onFirstMessage={onConfigUpdate}
          onSectionHighlight={handleSectionHighlight}
          initialMessage={pendingMessage}
          onMessageConsumed={() => setPendingMessage(null)}
          className="h-full"
        />
      </div>
    </div>
  );
}

/**
 * Quick action chip component
 */
function QuickActionChip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`Ask AI to help ${label.toLowerCase()}`}
      className="flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-700/50 hover:bg-neutral-700 text-text-muted hover:text-text-secondary transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 focus-visible:ring-offset-surface-alt focus-visible:outline-none"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
