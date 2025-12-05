/**
 * EditorToolbar - Floating action bar for landing page editor
 *
 * Features:
 * - Shows only when there are unsaved changes
 * - Saving indicator
 * - Publish and Discard buttons
 * - Smooth slide-in/out animation
 */

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, Save, X } from 'lucide-react';

interface EditorToolbarProps {
  hasChanges: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  onPublish: () => void;
  onDiscard: () => void;
}

export function EditorToolbar({
  hasChanges,
  isSaving,
  isPublishing,
  onPublish,
  onDiscard,
}: EditorToolbarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-72 right-0 z-50',
        'bg-background/95 backdrop-blur border-t shadow-lg',
        'transform transition-transform duration-300',
        !hasChanges && 'translate-y-full'
      )}
    >
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <span className="text-sm text-muted-foreground">
            {isSaving ? 'Saving...' : 'Unsaved changes'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={isPublishing || isSaving}
          >
            <X className="h-4 w-4 mr-1" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={onPublish}
            disabled={isPublishing || isSaving}
            className="min-w-[100px]"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" aria-hidden="true" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
