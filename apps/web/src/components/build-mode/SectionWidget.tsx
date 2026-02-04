'use client';

/**
 * SectionWidget - Floating widget for guided refinement
 *
 * This component displays the 3 tone variants (Professional/Premium/Friendly)
 * for the current section being refined. It allows users to:
 * - Preview and select a variant
 * - Mark the section as complete
 * - Request new variants
 *
 * The widget syncs with the refinement store and responds to agent dashboard actions.
 *
 * @see docs/plans/2026-02-04-feat-guided-refinement-implementation-plan.md
 * @see apps/web/src/stores/refinement-store.ts
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { Check, CheckCircle2, RefreshCw, Loader2, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  useRefinementStore,
  selectCurrentSectionId,
  selectCurrentSectionType,
  selectCurrentVariants,
  selectIsLoading,
  selectError,
  selectIsWidgetVisible,
  selectIsSectionComplete,
  type ToneVariant,
  type RefinementState,
} from '@/stores/refinement-store';

// ============================================
// TYPES
// ============================================

export interface SectionWidgetProps {
  /** Callback when user wants to regenerate variants */
  onRefresh?: () => void;
  /** Callback when user selects a variant */
  onSelectVariant?: (sectionId: string, variant: ToneVariant) => void;
  /** Callback when user marks section complete */
  onMarkComplete?: (sectionId: string) => void;
  /** Callback when user wants to move to next section */
  onNext?: () => void;
  /** Callback when user closes the widget */
  onClose?: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const VARIANT_INFO: Record<ToneVariant, { label: string; description: string }> = {
  professional: {
    label: 'Professional',
    description: 'Clean and authoritative',
  },
  premium: {
    label: 'Premium',
    description: 'Elegant and refined',
  },
  friendly: {
    label: 'Friendly',
    description: 'Warm and approachable',
  },
};

const VARIANTS: ToneVariant[] = ['professional', 'premium', 'friendly'];

// ============================================
// COMPONENT
// ============================================

export function SectionWidget({
  onRefresh,
  onSelectVariant,
  onMarkComplete,
  onNext,
  onClose,
}: SectionWidgetProps) {
  // Store selectors
  const isVisible = useRefinementStore(selectIsWidgetVisible);
  const currentSectionId = useRefinementStore(selectCurrentSectionId);
  const currentSectionType = useRefinementStore(selectCurrentSectionType);
  const variants = useRefinementStore(selectCurrentVariants);
  const isLoading = useRefinementStore(selectIsLoading);
  const error = useRefinementStore(selectError);

  // Use useShallow to prevent re-renders when object reference changes but values are the same
  // See: Pitfall #96 - Zustand selector new object re-renders
  const progress = useRefinementStore(
    useShallow((state: RefinementState) => ({
      completed: state.completedSections.length,
      total: state.totalSections,
    }))
  );
  // Calculate percentage in component (derived from primitives)
  const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  // Check if current section is complete
  const isCurrentComplete = useRefinementStore(
    useCallback(
      (state) => (currentSectionId ? selectIsSectionComplete(currentSectionId)(state) : false),
      [currentSectionId]
    )
  );

  // Store actions
  const { selectVariant, setError, setWidgetVisible } = useRefinementStore();

  // Get selected variant for current section
  const selectedVariant = variants?.selectedVariant ?? null;

  // Memoized handlers
  const handleSelectVariant = useCallback(
    (variant: ToneVariant) => {
      if (!currentSectionId) return;
      selectVariant(currentSectionId, variant);
      onSelectVariant?.(currentSectionId, variant);
    },
    [currentSectionId, selectVariant, onSelectVariant]
  );

  const handleMarkComplete = useCallback(() => {
    if (!currentSectionId || !selectedVariant) return;
    onMarkComplete?.(currentSectionId);
  }, [currentSectionId, selectedVariant, onMarkComplete]);

  const handleRefresh = useCallback(() => {
    setError(null);
    onRefresh?.();
  }, [setError, onRefresh]);

  const handleClose = useCallback(() => {
    setWidgetVisible(false);
    onClose?.();
  }, [setWidgetVisible, onClose]);

  // Format section type for display
  const sectionLabel = useMemo(() => {
    if (!currentSectionType) return 'Section';
    // Capitalize and format: "hero" → "Hero", "text_content" → "Text Content"
    return currentSectionType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [currentSectionType]);

  // Don't render if not visible or no section selected
  if (!isVisible || !currentSectionId) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'bg-white rounded-2xl shadow-xl border border-gray-100',
        'w-[320px] overflow-hidden',
        'animate-in slide-in-from-bottom-4 fade-in duration-300'
      )}
      role="dialog"
      aria-label="Section refinement widget"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{sectionLabel}</span>
          {isCurrentComplete && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Done
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {progress.completed}/{progress.total}
          </span>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Close widget"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            <span className="text-sm text-gray-500">Generating options...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <p className="text-sm text-red-600 text-center">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* Variants */}
        {variants && !isLoading && !error && !isCurrentComplete && (
          <>
            {/* Recommendation banner */}
            {variants.recommendation && variants.rationale && (
              <div className="mb-4 p-3 bg-teal-50 rounded-xl">
                <p className="text-xs text-teal-700">
                  <span className="font-medium">Recommendation:</span>{' '}
                  {VARIANT_INFO[variants.recommendation].label} — {variants.rationale}
                </p>
              </div>
            )}

            {/* Variant Pills */}
            <div className="space-y-2 mb-4">
              {VARIANTS.map((variant) => {
                const isSelected = selectedVariant === variant;
                const isRecommended = variants.recommendation === variant;
                const variantContent = variants[variant];
                const headline = variantContent?.headline || variantContent?.content;

                return (
                  <button
                    key={variant}
                    onClick={() => handleSelectVariant(variant)}
                    className={cn(
                      'w-full p-3 rounded-xl text-left transition-all duration-200',
                      'border-2',
                      isSelected
                        ? 'border-teal-500 bg-teal-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    )}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              isSelected ? 'text-teal-700' : 'text-gray-700'
                            )}
                          >
                            {VARIANT_INFO[variant].label}
                          </span>
                          {isRecommended && (
                            <span className="text-[10px] font-medium text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                        {headline && (
                          <p className="text-xs text-gray-600 truncate">&ldquo;{headline}&rdquo;</p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="flex-shrink-0 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                title="Generate new variants"
                aria-label="Generate new variants"
              >
                <RefreshCw className="w-4 h-4 text-gray-600" />
              </button>
              <Button
                variant="teal"
                className="flex-1"
                onClick={handleMarkComplete}
                disabled={!selectedVariant}
              >
                <Check className="w-4 h-4 mr-2" />
                Approve & Continue
              </Button>
            </div>
          </>
        )}

        {/* Complete State */}
        {isCurrentComplete && !isLoading && (
          <div className="py-4">
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm text-gray-600 text-center">
                {progress.completed === progress.total
                  ? 'All sections complete! Ready to publish.'
                  : 'Section approved. Moving to next.'}
              </p>
            </div>
            {progress.completed < progress.total && (
              <Button variant="teal" className="w-full" onClick={onNext}>
                Next Section
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* No Variants Yet */}
        {!variants && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <p className="text-sm text-gray-500 text-center">
              Waiting for the agent to generate tone options...
            </p>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
          role="progressbar"
          aria-valuenow={progress.completed}
          aria-valuemin={0}
          aria-valuemax={progress.total}
        />
      </div>
    </div>
  );
}

// ============================================
// PUBLISH READY WIDGET VARIANT
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
  const setWidgetVisible = useRefinementStore((state) => state.setWidgetVisible);

  const handleClose = useCallback(() => {
    setWidgetVisible(false);
    onClose?.();
  }, [setWidgetVisible, onClose]);

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

export default SectionWidget;
