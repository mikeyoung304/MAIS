'use client';

/**
 * AIUsageDisplay Component
 *
 * Displays AI message usage as a progress bar with percentage.
 * Shows upgrade prompt when quota is low or exceeded.
 */

import { cn } from '@/lib/utils';

interface AIUsageDisplayProps {
  used: number;
  limit: number;
  remaining: number;
  className?: string;
  showUpgradePrompt?: boolean;
  onUpgrade?: () => void;
}

export function AIUsageDisplay({
  used,
  limit,
  remaining,
  className,
  showUpgradePrompt = true,
  onUpgrade,
}: AIUsageDisplayProps) {
  const usagePercent = (used / limit) * 100;
  const isLow = remaining < limit * 0.2; // Less than 20% remaining
  const isExhausted = remaining === 0;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600">AI Messages</span>
        <span className={cn('font-medium', isExhausted ? 'text-red-600' : 'text-neutral-900')}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isExhausted ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-sage'
          )}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>

      {/* Status text */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-500">{remaining.toLocaleString()} remaining</span>
        {isExhausted && <span className="text-red-600 font-medium">Quota exceeded</span>}
        {!isExhausted && isLow && <span className="text-amber-600 font-medium">Running low</span>}
      </div>

      {/* Upgrade prompt */}
      {showUpgradePrompt && (isExhausted || isLow) && onUpgrade && (
        <button
          onClick={onUpgrade}
          className={cn(
            'w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors',
            isExhausted
              ? 'bg-red-50 text-red-700 hover:bg-red-100'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          )}
        >
          {isExhausted ? 'Upgrade to continue chatting' : 'Upgrade for more messages'}
        </button>
      )}
    </div>
  );
}

export default AIUsageDisplay;
