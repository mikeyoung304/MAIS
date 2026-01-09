'use client';

import { cn } from '@/lib/utils';

interface QuickReplyChipsProps {
  /** Array of quick reply options to display */
  replies: string[];
  /** Callback when user clicks a quick reply */
  onSelect: (reply: string) => void;
  /** Whether the chips should be disabled */
  disabled?: boolean;
}

/**
 * QuickReplyChips - Clickable suggestion buttons for agent chat
 *
 * Renders a row of chips that users can click to quickly respond
 * to the agent. Matches HANDLED brand styling with sage accents.
 *
 * Features:
 * - Accessible with proper ARIA attributes
 * - 44px min touch target for mobile (WCAG 2.1 AA)
 * - Fade-in animation for smooth appearance
 * - Disabled state when chat is loading
 */
export function QuickReplyChips({ replies, onSelect, disabled }: QuickReplyChipsProps) {
  if (replies.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-2 mt-3 ml-11 animate-in fade-in duration-300"
      role="group"
      aria-label="Suggested responses"
    >
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium',
            'bg-sage/10 text-sage-dark border border-sage/20',
            'hover:bg-sage/20 hover:border-sage/40 hover:shadow-sm',
            'active:scale-95',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'min-h-[44px]' // WCAG touch target
          )}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
