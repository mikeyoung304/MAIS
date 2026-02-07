'use client';

/**
 * ContentArea - Dynamic content container for Agent-First Dashboard
 *
 * Renders views based on the agent UI store's ViewState (exhaustive switch, no default):
 * - 'coming_soon': Pre-build placeholder during Discovery + Building phases
 * - 'revealing': One-shot animated reveal when first draft completes
 * - 'preview': Storefront preview with real-time PostMessage updates
 * - 'dashboard': Stats/Insights page content (post-publish)
 * - 'loading': Transitional loading state
 * - 'error': Error state with recovery option
 *
 * @see stores/agent-ui-store.ts for ViewState definition
 */

import { Suspense, lazy } from 'react';
import { useAgentUIStore, agentUIActions } from '@/stores/agent-ui-store';
import { useDraftConfig } from '@/hooks/useDraftConfig';
import { useAuth } from '@/lib/auth-client';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Lazy load PreviewPanel and RevealTransition to reduce initial bundle size
const PreviewPanel = lazy(() => import('@/components/preview/PreviewPanel'));
const RevealTransition = lazy(() => import('@/components/preview/RevealTransition'));

// Lazy load ComingSoonDisplay (uses framer-motion ~35KB, only shown during onboarding)
const ComingSoonDisplay = lazy(() =>
  import('@/components/preview/ComingSoonDisplay').then((mod) => ({
    default: mod.ComingSoonDisplay,
  }))
);

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
 * EXHAUSTIVE switch — no default case. TypeScript `never` check ensures
 * every ViewState variant is handled. Adding a new status without a case
 * here produces a compile error.
 */
export function ContentArea({ children, className }: ContentAreaProps) {
  const view = useAgentUIStore((state) => state.view);
  const { config, invalidate, isLoading, error: draftError, refetch } = useDraftConfig();
  const { slug } = useAuth();

  // Check for draft config errors first (auth failures, server errors)
  // This prevents the silent "DEFAULT config in preview" bug
  if (draftError && view.status === 'preview') {
    return (
      <div className={cn('h-full', className)} data-testid="content-area-draft-error">
        <ErrorView error={draftError.message} onRetry={refetch} />
      </div>
    );
  }

  // Exhaustive switch on discriminated union — NO default case
  switch (view.status) {
    case 'coming_soon':
      return (
        <div className={cn('h-full', className)} data-testid="content-area-coming-soon">
          <Suspense fallback={<LoadingView />}>
            <ComingSoonDisplay />
          </Suspense>
        </div>
      );

    case 'revealing':
      return (
        <div className={cn('h-full', className)} data-testid="content-area-revealing">
          <Suspense fallback={<LoadingView />}>
            <RevealTransition slug={slug} onComplete={() => agentUIActions.showPreview()} />
          </Suspense>
        </div>
      );

    case 'preview':
      return (
        <div className={cn('h-full', className)} data-testid="content-area-preview">
          <Suspense fallback={<PreviewLoader />}>
            <PreviewPanel
              highlightedSectionId={view.config.highlightedSectionId}
              draftConfig={config}
              onConfigUpdate={invalidate}
              isConfigLoading={isLoading}
            />
          </Suspense>
        </div>
      );

    case 'dashboard':
      return <div data-testid="content-area-dashboard">{children}</div>;

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

    default: {
      // Compile error if any ViewState variant is not handled above
      const _exhaustive: never = view;
      void _exhaustive;
      return <div data-testid="content-area-dashboard">{children}</div>;
    }
  }
}

export default ContentArea;
