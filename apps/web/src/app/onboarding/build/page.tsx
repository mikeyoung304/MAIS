'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';
import { HandledLogo } from '@/components/ui/handled-logo';
import { BuildProgress } from '@/components/onboarding/BuildProgress';

// =============================================================================
// Build Page (Onboarding Step 3 — after Intake)
// =============================================================================

/**
 * Shows real-time progress as the background pipeline generates website sections.
 *
 * Flow:
 * 1. Check auth + onboarding state (redirect if not BUILDING)
 * 2. Poll GET /build-status every 2s
 * 3. Show per-section progress (HERO → ABOUT → SERVICES)
 * 4. On COMPLETE → redirect to dashboard (SETUP phase)
 * 5. On FAILED → show retry button
 */

type SectionStatus = 'pending' | 'generating' | 'complete' | 'failed';

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

function BuildContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();

  const [buildStatus, setBuildStatus] = useState<BuildStatusResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

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
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Could not load build status. Try refreshing.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [isAuthenticated, sessionLoading, router]);

  // ---------------------------------------------------------------------------
  // Polling — refetch build status every 2s until terminal state
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isLoading || loadError) return;
    if (buildStatus && TERMINAL_STATUSES.includes(buildStatus.buildStatus ?? '')) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/tenant-admin/onboarding/build-status');
        if (!res.ok) return;
        const data = (await res.json()) as BuildStatusResponse;
        setBuildStatus(data);

        // Redirect on completion
        if (data.buildStatus === 'COMPLETE') {
          // Brief pause so user sees the completed state
          setTimeout(() => router.push('/tenant/dashboard'), 1500);
        }
      } catch {
        // Swallow polling errors — will retry on next tick
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLoading, loadError, buildStatus, router]);

  // ---------------------------------------------------------------------------
  // Retry handler
  // ---------------------------------------------------------------------------

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
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

  if (sessionLoading || isLoading) {
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

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-screen">
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

        {/* Headline */}
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary leading-tight mb-1">
          Building your website
        </h1>
        <p className="text-sm text-text-muted mb-6">
          We&apos;re crafting your pages from what you told us. This takes about a minute.
        </p>
      </div>

      {/* Build progress */}
      <div className="flex-1 px-4 sm:px-6 pb-12">
        <BuildProgress
          sections={sections}
          buildError={buildStatus?.buildError ?? null}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      </div>

      {/* Accessibility: announce status changes */}
      <div className="sr-only" role="status" aria-live="polite">
        {buildStatus?.buildStatus === 'COMPLETE'
          ? 'Your website is ready. Redirecting to your dashboard.'
          : buildStatus?.buildStatus === 'FAILED'
            ? `Build failed: ${buildStatus.buildError}`
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
