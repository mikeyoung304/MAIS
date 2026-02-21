'use client';

/**
 * ProgressiveReveal — Section-by-section build progress with celebration
 *
 * Replaces BuildProgress on the build page. Shows each section transitioning
 * from skeleton shimmer -> generating -> complete with cross-dissolve.
 *
 * When all sections are complete, shows a brief celebration animation
 * and auto-redirect countdown.
 */

import { useEffect, useState, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks';
import type { SectionStatus } from '@macon/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProgressiveRevealProps {
  sections: Record<string, SectionStatus>;
  buildError: string | null;
  onRetry: () => void;
  isRetrying: boolean;
}

// ---------------------------------------------------------------------------
// Section metadata
// ---------------------------------------------------------------------------

const SECTION_META = [
  {
    key: 'hero' as const,
    label: 'Hero section',
    description: 'Your headline and first impression',
  },
  {
    key: 'about' as const,
    label: 'About section',
    description: 'Your story and what makes you unique',
  },
  {
    key: 'services' as const,
    label: 'Services section',
    description: 'What you offer and how you help',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgressiveReveal({
  sections,
  buildError,
  onRetry,
  isRetrying,
}: ProgressiveRevealProps) {
  const completedCount = Object.values(sections).filter((s) => s === 'complete').length;
  const totalCount = SECTION_META.length;
  const allComplete = completedCount === totalCount;
  const hasFailed = Object.values(sections).some((s) => s === 'failed');

  // Track if user has prefers-reduced-motion (shared hook, 11088)
  const prefersReducedMotion = usePrefersReducedMotion() ?? false;

  // Debounced aria-live announcements (500ms minimum)
  const lastAnnouncement = useRef<number>(0);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const now = Date.now();
    if (now - lastAnnouncement.current < 500) return;

    lastAnnouncement.current = now;
    if (allComplete) {
      setAnnouncement('All 3 sections loaded. Your website is ready.');
    } else {
      setAnnouncement(`Section ${completedCount} of 3 loaded.`);
    }
  }, [completedCount, allComplete]);

  return (
    <div className="w-full max-w-lg mx-auto" aria-busy={!allComplete && !hasFailed}>
      {/* Debounced accessibility announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Overall progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-text-muted">
            {allComplete
              ? 'All sections ready'
              : hasFailed
                ? 'Build encountered an issue'
                : 'Building your website...'}
          </span>
          <span className="text-sm font-medium text-text-primary">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-sage transition-all duration-700 ease-out"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Section cards */}
      <div className="space-y-4">
        {SECTION_META.map((section) => (
          <RevealCard
            key={section.key}
            label={section.label}
            description={section.description}
            status={sections[section.key] ?? 'pending'}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>

      {/* Error state with retry */}
      {buildError && (
        <div className="mt-8 p-4 rounded-2xl bg-red-950/30 border border-red-900/50">
          <p className="text-sm text-red-300 mb-3">{buildError}</p>
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="text-sm font-medium text-sage hover:text-sage-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRetrying ? 'Retrying...' : 'Try again'}
          </button>
        </div>
      )}

      {/* Celebration when all complete */}
      {allComplete && <CelebrationMoment />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RevealCard — individual section with skeleton → content transition
// ---------------------------------------------------------------------------

function RevealCard({
  label,
  description,
  status,
  prefersReducedMotion,
}: {
  label: string;
  description: string;
  status: SectionStatus;
  prefersReducedMotion: boolean;
}) {
  // Track if this card has ever been 'complete' to trigger the cross-dissolve
  const [revealed, setRevealed] = useState(status === 'complete');

  useEffect(() => {
    if (status === 'complete') {
      setRevealed(true);
    }
  }, [status]);

  // Card border/bg based on status
  const cardStyles =
    status === 'complete'
      ? 'bg-sage/5 border-sage/20'
      : status === 'generating'
        ? 'bg-surface-alt border-sage/30'
        : status === 'failed'
          ? 'bg-red-950/20 border-red-900/30'
          : 'bg-surface-alt border-neutral-800';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${cardStyles}`}
      aria-hidden={status === 'pending' ? 'true' : undefined}
    >
      {/* Skeleton shimmer layer — fades out when generating or complete */}
      {status === 'pending' && (
        <div className="flex items-start gap-4 p-4">
          {/* Skeleton icon */}
          <div
            className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 ${
              prefersReducedMotion ? 'bg-neutral-700' : 'animate-pulse bg-neutral-700'
            }`}
          />
          {/* Skeleton text */}
          <div className="flex-1">
            <div
              className={`h-4 w-32 rounded mb-1.5 ${
                prefersReducedMotion ? 'bg-neutral-700' : 'animate-pulse bg-neutral-700'
              }`}
            />
            <div
              className={`h-3 w-48 rounded ${
                prefersReducedMotion ? 'bg-neutral-700' : 'animate-pulse bg-neutral-700'
              }`}
            />
          </div>
          {/* Skeleton status */}
          <div
            className={`h-3 w-12 rounded flex-shrink-0 ${
              prefersReducedMotion ? 'bg-neutral-700' : 'animate-pulse bg-neutral-700'
            }`}
          />
        </div>
      )}

      {/* Generating shimmer layer */}
      {status === 'generating' && (
        <div className="flex items-start gap-4 p-4">
          {/* Spinner */}
          <div className="flex-shrink-0 mt-0.5">
            <GeneratingSpinner prefersReducedMotion={prefersReducedMotion} />
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">{label}</p>
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          </div>
          {/* Animated dots label */}
          <div className="flex-shrink-0">
            <AnimatedDotsLabel />
          </div>
        </div>
      )}

      {/* Complete content — cross-dissolve in */}
      {status === 'complete' && (
        <div
          className={`flex items-start gap-4 p-4 ${
            revealed ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-200 ease-out`}
        >
          {/* Checkmark icon */}
          <div className="flex-shrink-0 mt-0.5">
            <svg
              className="w-5 h-5 text-sage"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          {/* Label */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sage">{label}</p>
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          </div>
          {/* Done label */}
          <span className="text-xs font-medium text-sage flex-shrink-0">Done</span>
        </div>
      )}

      {/* Failed state */}
      {status === 'failed' && (
        <div className="flex items-start gap-4 p-4">
          {/* X icon */}
          <div className="flex-shrink-0 mt-0.5">
            <svg
              className="w-5 h-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          {/* Label */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-300">{label}</p>
            <p className="text-xs text-text-muted mt-0.5">Generation failed</p>
          </div>
          {/* Failed label */}
          <span className="text-xs font-medium text-red-300 flex-shrink-0">Failed</span>
        </div>
      )}

      {/* Sage shimmer overlay for generating state (animated gradient) */}
      {status === 'generating' && !prefersReducedMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sage/5 to-transparent animate-shimmer" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GeneratingSpinner
// ---------------------------------------------------------------------------

function GeneratingSpinner({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  if (prefersReducedMotion) {
    // Static indicator instead of spinner
    return (
      <div className="w-5 h-5 rounded-full border-2 border-sage/50 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-sage/60" />
      </div>
    );
  }

  return (
    <svg className="w-5 h-5 text-sage animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// AnimatedDotsLabel — "Writing..." with animated ellipsis
// ---------------------------------------------------------------------------

function AnimatedDotsLabel() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return <span className="text-xs font-medium text-sage/80">Writing{dots}</span>;
}

// ---------------------------------------------------------------------------
// CelebrationMoment — confetti pulse + auto-redirect countdown
// ---------------------------------------------------------------------------

function CelebrationMoment() {
  const [countdown, setCountdown] = useState(3);
  const prefersReducedMotion = usePrefersReducedMotion() ?? false;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <div className="mt-10 text-center animate-fade-in">
      {/* Confetti-like sage circles */}
      {!prefersReducedMotion && (
        <div className="relative flex items-center justify-center mb-4 h-12">
          <ConfettiDot delay={0} x={-24} y={-4} size={10} />
          <ConfettiDot delay={150} x={16} y={-8} size={8} />
          <ConfettiDot delay={300} x={-8} y={6} size={6} />
          <ConfettiDot delay={450} x={28} y={2} size={9} />
        </div>
      )}

      {/* Success message */}
      <p className="font-serif text-xl font-bold text-text-primary mb-2">
        Your website is live (in draft)
      </p>
      <p className="text-sm text-text-muted">Taking you to your dashboard in {countdown}...</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfettiDot — CSS-only pulsing dot for celebration
// ---------------------------------------------------------------------------

function ConfettiDot({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) {
  return (
    <span
      className="absolute rounded-full bg-sage/60"
      style={{
        width: size,
        height: size,
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        animation: `confetti-pulse 1.2s ease-out ${delay}ms forwards`,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Inline keyframes for confetti pulse (added via style tag at module level)
// ---------------------------------------------------------------------------

const CONFETTI_STYLES = `
@keyframes confetti-pulse {
  0% {
    opacity: 0;
    transform: scale(0);
  }
  40% {
    opacity: 1;
    transform: scale(1.5);
  }
  100% {
    opacity: 0;
    transform: scale(2);
  }
}
`;

/**
 * Inject the confetti keyframes into the document once.
 * Uses a data attribute to avoid duplicate injection.
 */
export function ConfettiStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CONFETTI_STYLES }} data-confetti-styles />;
}
