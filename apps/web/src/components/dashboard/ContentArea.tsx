'use client';

/**
 * ContentArea - Dynamic content container for Agent-First Dashboard
 *
 * This component renders different views based on the agent UI store's ViewState:
 * - 'dashboard': Shows the children (page content) or DashboardView
 * - 'preview': Shows the PreviewPanel with storefront preview
 * - 'loading': Shows a loading skeleton
 * - 'error': Shows an error state with recovery option
 *
 * The discriminated union pattern ensures only one state is active at a time,
 * eliminating bugs like "showing preview and dashboard simultaneously".
 *
 * @see stores/agent-ui-store.ts for ViewState definition
 * @see plans/agent-first-dashboard-architecture.md for architecture details
 */

import { Suspense, lazy } from 'react';
import { useAgentUIStore } from '@/stores/agent-ui-store';
import { useDraftConfig } from '@/hooks/useDraftConfig';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Lazy load PreviewPanel to reduce initial bundle size
const PreviewPanel = lazy(() => import('@/components/preview/PreviewPanel'));

// ============================================
// LOADING STATE
// ============================================

function LoadingView() {
  return (
    <div className="h-full flex items-center justify-center bg-neutral-50 dark:bg-surface">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-sage" />
        <span className="text-sm text-neutral-500 dark:text-text-muted">Loading...</span>
      </div>
    </div>
  );
}

// ============================================
// ERROR STATE
// ============================================

interface ErrorViewProps {
  error: string;
  onRetry?: () => void;
}

function ErrorView({ error, onRetry }: ErrorViewProps) {
  return (
    <div className="h-full flex items-center justify-center bg-neutral-50 dark:bg-surface">
      <div className="flex flex-col items-center gap-4 text-center max-w-md p-8">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-text-primary mb-1">Something went wrong</h3>
          <p className="text-text-muted">{error}</p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// PREVIEW LOADING FALLBACK
// ============================================

function PreviewLoader() {
  return (
    <div className="h-full flex flex-col bg-neutral-100 dark:bg-surface-alt">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-surface border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          <div className="h-8 w-32 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          <div className="h-8 w-20 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        </div>
      </div>
      {/* Preview area skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
          <span className="text-sm text-neutral-500 dark:text-text-muted">Loading preview...</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface ContentAreaProps {
  /** Child content to render when in dashboard mode */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ContentArea renders content based on the agent UI store's view state.
 *
 * Uses discriminated unions for type-safe view switching:
 * - When status is 'preview', config is guaranteed to exist
 * - When status is 'error', error message is guaranteed to exist
 */
export function ContentArea({ children, className }: ContentAreaProps) {
  const view = useAgentUIStore((state) => state.view);
  const { config, hasDraft, invalidate, isLoading, error: draftError, refetch } = useDraftConfig();

  // Check for draft config errors first (auth failures, server errors)
  // This prevents the silent "DEFAULT config in preview" bug
  if (draftError && view.status === 'preview') {
    return (
      <div className={cn('h-full', className)} data-testid="content-area-draft-error">
        <ErrorView error={draftError.message} onRetry={refetch} />
      </div>
    );
  }

  // Switch on discriminated union - TypeScript knows exactly what's available in each case
  switch (view.status) {
    case 'loading':
      return (
        <div className={cn('h-full', className)} data-testid="content-area-loading">
          <LoadingView />
        </div>
      );

    case 'error':
      return (
        <div className={cn('h-full', className)} data-testid="content-area-error">
          <ErrorView error={view.error} onRetry={view.recovery} />
        </div>
      );

    case 'preview':
      return (
        <div className={cn('h-full', className)} data-testid="content-area-preview">
          <Suspense fallback={<PreviewLoader />}>
            <PreviewPanel
              currentPage={view.config.currentPage}
              highlightedSectionId={view.config.highlightedSectionId}
              draftConfig={config}
              hasDraft={hasDraft}
              onConfigUpdate={invalidate}
              isConfigLoading={isLoading}
            />
          </Suspense>
        </div>
      );

    case 'dashboard':
    default:
      // Render children (page content) - this allows each page to have its own content
      return <div data-testid="content-area-dashboard">{children}</div>;
  }
}

export default ContentArea;
