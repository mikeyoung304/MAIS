'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';
import { HandledLogo } from '@/components/ui/handled-logo';
import { OnboardingVideo } from '@/components/onboarding/OnboardingVideo';
import { ProgressiveReveal, ConfettiStyles } from '@/components/onboarding/ProgressiveReveal';

// =============================================================================
// Build Page (Onboarding Step 3 — after Intake)
// =============================================================================

/**
 * Shows real-time progress as the background pipeline generates website sections.
 *
 * Phase 5 flow:
 * 1. loading: auth check + first status fetch
 * 2. video: OnboardingVideo plays while polling runs in background
 * 3. progress: ProgressiveReveal shows per-section status
 * 4. complete: celebration moment with auto-redirect countdown
 *
 * Transition rules:
 * - loading → video (initial fetch succeeds, status not terminal)
 * - loading → progress (build already in progress with sections generating)
 * - loading → complete (build already COMPLETE)
 * - video → progress (skip clicked, video ends, or any section starts generating)
 * - video → complete (if build completes during video)
 * - progress → complete (all sections done)
 */

type SectionStatus = 'pending' | 'generating' | 'complete' | 'failed';

type BuildPageView = 'loading' | 'video' | 'progress' | 'complete';

interface BuildStatusResponse {
  buildStatus: string | null;
  buildError: string | null;
  sections: {
    hero: SectionStatus;
    about: SectionStatus;
    services: SectionStatus;
  };
}

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = ['COMPLETE', 'FAILED'];
const REDIRECT_DELAY_MS = 3000;

// =============================================================================
// BuildContent — main content with state machine
// =============================================================================

function BuildContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();

  const [view, setView] = useState<BuildPageView>('loading');
  const [buildStatus, setBuildStatus] = useState<BuildStatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Track whether redirect has been scheduled to prevent duplicates
  const redirectScheduled = useRef(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const hasSectionActivity = useCallback((data: BuildStatusResponse): boolean => {
    const secs = data.sections;
    return (
      secs.hero === 'generating' ||
      secs.hero === 'complete' ||
      secs.about === 'generating' ||
      secs.about === 'complete' ||
      secs.services === 'generating' ||
      secs.services === 'complete'
    );
  }, []);

  const allSectionsComplete = useCallback((data: BuildStatusResponse): boolean => {
    const secs = data.sections;
    return secs.hero === 'complete' && secs.about === 'complete' && secs.services === 'complete';
  }, []);

  const scheduleRedirect = useCallback(() => {
    if (redirectScheduled.current) return;
    redirectScheduled.current = true;
    setTimeout(() => router.push('/tenant/dashboard'), REDIRECT_DELAY_MS);
  }, [router]);

  // ---------------------------------------------------------------------------
  // Determine initial view from build status data
  // ---------------------------------------------------------------------------

  const resolveInitialView = useCallback(
    (data: BuildStatusResponse): BuildPageView => {
      if (data.buildStatus === 'COMPLETE' || allSectionsComplete(data)) {
        return 'complete';
      }
      if (hasSectionActivity(data)) {
        return 'progress';
      }
      // Build is queued or just started, no sections active yet → show video
      return 'video';
    },
    [allSectionsComplete, hasSectionActivity]
  );

  // ---------------------------------------------------------------------------
  // Auth + state check on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (sessionLoading) return;

    if (!isAuthenticated) {
      router.push('/signup');
      return;
    }

    const init = async () => {
      try {
        // Check onboarding state — redirect if not BUILDING
        const stateRes = await fetch('/api/tenant-admin/onboarding/state');
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          // Allow BUILDING or states that show build is done
          if (
            stateData.status !== 'BUILDING' &&
            stateData.status !== 'SETUP' &&
            stateData.status !== 'COMPLETE'
          ) {
            router.push(stateData.redirectTo || '/onboarding/payment');
            return;
          }

          // Already past building — go to dashboard
          if (stateData.status === 'SETUP' || stateData.status === 'COMPLETE') {
            router.push('/tenant/dashboard');
            return;
          }
        }

        // Initial build status fetch
        const statusRes = await fetch('/api/tenant-admin/onboarding/build-status');
        if (!statusRes.ok) {
          throw new Error('Could not load build status.');
        }
        const statusData = (await statusRes.json()) as BuildStatusResponse;
        setBuildStatus(statusData);

        // Determine initial view based on current status
        const initialView = resolveInitialView(statusData);
        setView(initialView);

        if (initialView === 'complete') {
          scheduleRedirect();
        }
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Could not load build status. Try refreshing.'
        );
      }
    };

    init();
  }, [isAuthenticated, sessionLoading, router, resolveInitialView, scheduleRedirect]);

  // ---------------------------------------------------------------------------
  // Polling — refetch build status every 2s until terminal state
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (view === 'loading' || loadError) return;
    if (buildStatus && TERMINAL_STATUSES.includes(buildStatus.buildStatus ?? '')) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/tenant-admin/onboarding/build-status');
        if (!res.ok) return;
        const data = (await res.json()) as BuildStatusResponse;
        setBuildStatus(data);

        // Handle view transitions based on new data
        if (data.buildStatus === 'COMPLETE' || allSectionsComplete(data)) {
          setView('complete');
          scheduleRedirect();
        } else if (view === 'video' && hasSectionActivity(data)) {
          // Sections started generating during video — transition to progress
          setView('progress');
        }
      } catch {
        // Swallow polling errors — will retry on next tick
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [view, loadError, buildStatus, allSectionsComplete, hasSectionActivity, scheduleRedirect]);

  // ---------------------------------------------------------------------------
  // Video handlers
  // ---------------------------------------------------------------------------

  const handleVideoSkip = useCallback(() => {
    if (view !== 'video') return;

    if (buildStatus && allSectionsComplete(buildStatus)) {
      setView('complete');
      scheduleRedirect();
    } else {
      setView('progress');
    }
  }, [view, buildStatus, allSectionsComplete, scheduleRedirect]);

  const handleVideoEnd = useCallback(() => {
    // Same as skip — transition out of video
    handleVideoSkip();
  }, [handleVideoSkip]);

  // ---------------------------------------------------------------------------
  // Retry handler
  // ---------------------------------------------------------------------------

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    redirectScheduled.current = false;
    try {
      const res = await fetch('/api/tenant-admin/onboarding/build/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Retry failed. Please try again.');
      }

      const data = (await res.json()) as { triggered: boolean };
      if (data.triggered) {
        // Reset to polling state
        setBuildStatus({
          buildStatus: 'QUEUED',
          buildError: null,
          sections: { hero: 'pending', about: 'pending', services: 'pending' },
        });
        setView('progress');
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Retry failed.');
    } finally {
      setIsRetrying(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (sessionLoading || view === 'loading') {
    return <BuildSkeleton />;
  }

  if (loadError) {
    return (
      <div className="w-full max-w-lg mx-auto text-center py-16 px-4">
        <HandledLogo variant="dark" size="lg" className="mb-8 mx-auto" />
        <p className="text-sm text-red-300 mb-4">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-sage underline hover:text-sage-hover transition-colors"
        >
          Refresh the page
        </button>
      </div>
    );
  }

  const sections = buildStatus?.sections ?? {
    hero: 'pending' as SectionStatus,
    about: 'pending' as SectionStatus,
    services: 'pending' as SectionStatus,
  };

  const buildComplete = buildStatus?.buildStatus === 'COMPLETE' || allSectionsComplete(buildStatus!);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-screen">
      {/* Confetti animation keyframes */}
      <ConfettiStyles />

      {/* Header */}
      <div className="flex-shrink-0 pt-6 pb-2 px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <HandledLogo variant="dark" size="md" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-sage" />
              <span className="text-[10px] text-text-muted">Account</span>
            </div>
            <div className="w-4 h-px bg-neutral-700" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-sage" />
              <span className="text-[10px] text-text-muted">Paid</span>
            </div>
            <div className="w-4 h-px bg-neutral-700" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-sage" />
              <span className="text-[10px] text-text-muted">Setup</span>
            </div>
            <div className="w-4 h-px bg-neutral-700" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-sage ring-2 ring-sage/30" />
              <span className="text-[10px] text-text-primary font-medium">Build</span>
            </div>
          </div>
        </div>

        {/* Headline — changes based on view */}
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary leading-tight mb-1">
          {view === 'video'
            ? 'While we build your site...'
            : view === 'complete'
              ? 'All done!'
              : 'Building your website'}
        </h1>
        <p className="text-sm text-text-muted mb-6">
          {view === 'video'
            ? 'Take a moment. Your site is being crafted in the background.'
            : view === 'complete'
              ? 'Your website sections are ready. Heading to your dashboard.'
              : 'We\u2019re crafting your pages from what you told us. This takes about a minute.'}
        </p>
      </div>

      {/* Main content area */}
      <div className="flex-1 px-4 sm:px-6 pb-12">
        {/* Video view */}
        {view === 'video' && (
          <OnboardingVideo
            onSkip={handleVideoSkip}
            onVideoEnd={handleVideoEnd}
            buildComplete={buildComplete}
          />
        )}

        {/* Progress view */}
        {(view === 'progress' || view === 'complete') && (
          <ProgressiveReveal
            sections={sections}
            buildError={buildStatus?.buildError ?? null}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        )}
      </div>

      {/* Accessibility: announce status changes */}
      <div className="sr-only" role="status" aria-live="polite">
        {view === 'complete'
          ? 'Your website is ready. Redirecting to your dashboard.'
          : buildStatus?.buildStatus === 'FAILED'
            ? `Build failed: ${buildStatus.buildError}`
            : view === 'video'
              ? 'Welcome video playing. Build is running in the background.'
              : `Building: ${Object.values(sections).filter((s) => s === 'complete').length} of 3 sections complete.`}
      </div>
    </div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function BuildSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Logo + stepper placeholder */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-24 animate-pulse rounded bg-neutral-700" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full animate-pulse bg-neutral-700" />
              <div className="w-10 h-2 animate-pulse rounded bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>

      {/* Headline placeholder */}
      <div className="mb-8">
        <div className="h-8 w-64 animate-pulse rounded bg-neutral-700 mb-2" />
        <div className="h-4 w-80 animate-pulse rounded bg-neutral-700" />
      </div>

      {/* Progress bar placeholder */}
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <div className="flex justify-between mb-3">
            <div className="h-3 w-32 animate-pulse rounded bg-neutral-700" />
            <div className="h-3 w-8 animate-pulse rounded bg-neutral-700" />
          </div>
          <div className="h-1.5 w-full animate-pulse rounded-full bg-neutral-700" />
        </div>

        {/* Section cards placeholder */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-4 rounded-2xl border border-neutral-800 bg-surface-alt"
            >
              <div className="w-5 h-5 rounded-full animate-pulse bg-neutral-700" />
              <div className="flex-1">
                <div className="h-4 w-32 animate-pulse rounded bg-neutral-700 mb-1.5" />
                <div className="h-3 w-48 animate-pulse rounded bg-neutral-700" />
              </div>
              <div className="h-3 w-12 animate-pulse rounded bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Page Component
// =============================================================================

export default function OnboardingBuildPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Suspense fallback={<BuildSkeleton />}>
        <BuildContent />
      </Suspense>
    </div>
  );
}
