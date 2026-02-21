'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';
import { HandledLogo } from '@/components/ui/handled-logo';
import { IntakeChat } from '@/components/onboarding/IntakeChat';
import type { IntakeProgressResponse, IntakeCompleteResponse } from '@macon/contracts';

// =============================================================================
// Intake Page (Onboarding Step 2 — after Payment)
// =============================================================================

/**
 * Conversational intake form for onboarding.
 *
 * Presents ~10 business questions in a chat-style UI.
 * Saves each answer to the server as it's submitted,
 * then advances the tenant to BUILDING when complete.
 *
 * Flow:
 * 1. Check auth + onboarding state (redirect if not PENDING_INTAKE)
 * 2. Fetch saved progress (resume from last answered question)
 * 3. Render chat with questions as message bubbles
 * 4. POST each answer to server
 * 5. POST complete when user clicks "Build my site"
 * 6. Redirect to /onboarding/build
 */
function IntakeContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();

  const [progress, setProgress] = useState<IntakeProgressResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Auth + state check + progress fetch on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (sessionLoading) return;

    if (!isAuthenticated) {
      router.push('/signup');
      return;
    }

    const init = async () => {
      try {
        // Check onboarding state — redirect if not PENDING_INTAKE
        const stateRes = await fetch('/api/tenant-admin/onboarding/state');
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          if (stateData.redirectTo && stateData.redirectTo !== '/onboarding/intake') {
            router.push(stateData.redirectTo);
            return;
          }
        }

        // Fetch saved progress
        const progressRes = await fetch('/api/tenant-admin/onboarding/intake/progress');
        if (!progressRes.ok) {
          throw new Error('Could not load your progress.');
        }

        const progressData = (await progressRes.json()) as IntakeProgressResponse;
        setProgress(progressData);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Could not load intake form. Try refreshing.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [isAuthenticated, sessionLoading, router]);

  // ---------------------------------------------------------------------------
  // Complete handler — called by IntakeChat
  // ---------------------------------------------------------------------------

  const handleComplete = useCallback(async () => {
    const res = await fetch('/api/tenant-admin/onboarding/intake/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        (data as { message?: string }).message ?? 'Could not complete intake. Try again.'
      );
    }

    const data = (await res.json()) as IntakeCompleteResponse;

    if (data.status === 'advanced_to_building') {
      router.push(data.redirectTo);
    } else if (data.status === 'missing_required') {
      throw new Error(
        `Please answer all required questions before continuing. Missing: ${data.missingQuestions.join(', ')}`
      );
    } else if (data.status === 'already_completed') {
      // Already done — redirect to appropriate page
      router.push('/onboarding/build');
    }
  }, [router]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (sessionLoading || isLoading) {
    return <IntakeSkeleton />;
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

  if (!progress) {
    return <IntakeSkeleton />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-screen">
      {/* Logo + progress header */}
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
              <div className="w-2 h-2 rounded-full bg-sage ring-2 ring-sage/30" />
              <span className="text-[10px] text-text-primary font-medium">Setup</span>
            </div>
            <div className="w-4 h-px bg-neutral-700" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-neutral-600" />
              <span className="text-[10px] text-text-muted">Build</span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary leading-tight mb-1">
          Tell us about your business
        </h1>
        <p className="text-sm text-text-muted mb-2">
          Takes about 2 minutes. Your answers shape everything we build.
        </p>
      </div>

      {/* Chat area — fills remaining space */}
      <div className="flex-1 min-h-0">
        <IntakeChat
          initialAnswers={progress.answers}
          initialAnsweredIds={progress.answeredQuestionIds}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function IntakeSkeleton() {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Logo placeholder */}
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
      <div className="mb-6">
        <div className="h-8 w-72 animate-pulse rounded bg-neutral-700 mb-2" />
        <div className="h-4 w-56 animate-pulse rounded bg-neutral-700" />
      </div>

      {/* Progress bar placeholder */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <div className="h-3 w-24 animate-pulse rounded bg-neutral-700" />
          <div className="h-3 w-8 animate-pulse rounded bg-neutral-700" />
        </div>
        <div className="h-1 w-full animate-pulse rounded-full bg-neutral-700" />
      </div>

      {/* Chat bubbles placeholder */}
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-40 animate-pulse rounded bg-neutral-700" />
            <div className="h-4 w-56 animate-pulse rounded bg-neutral-700" />
          </div>
        ))}

        {/* Active bubble placeholder */}
        <div className="bg-surface-alt border border-neutral-800 rounded-3xl p-5 max-w-lg">
          <div className="h-4 w-48 animate-pulse rounded bg-neutral-700 mb-3" />
          <div className="h-10 w-full animate-pulse rounded-2xl bg-neutral-700" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Page Component
// =============================================================================

export default function OnboardingIntakePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Suspense fallback={<IntakeSkeleton />}>
        <IntakeContent />
      </Suspense>
    </div>
  );
}
