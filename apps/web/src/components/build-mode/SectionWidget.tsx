'use client';

/**
 * PublishReadyWidget - Floating widget shown when all sections are reviewed
 *
 * Displayed during the publish_ready mode of the onboarding flow.
 * Offers "Publish Site" and "Edit Sections" actions that dispatch
 * messages to the agent via the layout's queueAgentMessage callbacks.
 *
 * @see apps/web/src/stores/refinement-store.ts
 * @see apps/web/src/app/(protected)/tenant/layout.tsx
 */

import { useCallback } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============================================
// PUBLISH READY WIDGET
// ============================================

export interface PublishReadyWidgetProps {
  /** Callback when user clicks publish */
  onPublish?: () => void;
  /** Callback when user wants to edit a section */
  onEdit?: () => void;
  /** Callback when user closes the widget */
  onClose?: () => void;
}

/**
 * Widget shown when all sections are complete and ready to publish.
 */
export function PublishReadyWidget({ onPublish, onEdit, onClose }: PublishReadyWidgetProps) {
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'bg-white rounded-2xl shadow-xl border border-gray-100',
        'w-[320px] overflow-hidden',
        'animate-in slide-in-from-bottom-4 fade-in duration-300'
      )}
      role="dialog"
      aria-label="Publish ready"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-emerald-50">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">Ready to Publish</span>
        </div>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-emerald-100 rounded-lg transition-colors"
          aria-label="Close widget"
        >
          <X className="w-4 h-4 text-emerald-600" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4 text-center">
          All sections look great! Ready to make your site live?
        </p>

        <div className="space-y-2">
          <Button variant="teal" className="w-full" onClick={onPublish}>
            Publish Site
          </Button>
          <Button variant="outline" className="w-full" onClick={onEdit}>
            Edit Sections
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PublishReadyWidget;
