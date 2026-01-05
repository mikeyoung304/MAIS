'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Undo2, Loader2, Cloud, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BuildModeHeaderProps } from '@/lib/build-mode/types';

/**
 * BuildModeHeader - Top toolbar for Build Mode
 *
 * Shows:
 * - Exit button (back to dashboard)
 * - Save status indicator
 * - Publish/Discard buttons
 */
export function BuildModeHeader({
  isDirty,
  isSaving,
  onPublish,
  onDiscard,
  onExit,
}: BuildModeHeaderProps) {
  return (
    <header className="h-14 border-b border-neutral-200 bg-white px-4 flex items-center justify-between">
      {/* Left: Exit button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Exit
        </Button>

        <div className="h-6 w-px bg-neutral-200" />

        <span className="font-serif text-lg font-semibold text-neutral-900">Build Mode</span>
      </div>

      {/* Center: Save status */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </>
        ) : isDirty ? (
          <>
            <CloudOff className="h-4 w-4 text-amber-500" />
            <span className="text-amber-600">Unsaved changes</span>
          </>
        ) : (
          <>
            <Cloud className="h-4 w-4 text-sage" />
            <span>All changes saved to draft</span>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onDiscard}
          disabled={!isDirty && !isSaving}
          className={cn(
            'text-neutral-600 hover:text-neutral-900 border-neutral-300',
            !isDirty && !isSaving && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Undo2 className="h-4 w-4 mr-2" />
          Discard
        </Button>

        <Button
          variant="sage"
          size="sm"
          onClick={onPublish}
          disabled={isSaving}
          className="min-w-[100px]"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Publish
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
