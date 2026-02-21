'use client';

/**
 * BuildProgress — Section-level build progress display (Phase 4)
 *
 * Shows real-time progress as the background build generates HERO, ABOUT, SERVICES.
 * Each section gets its own indicator with animated transitions.
 *
 * Props:
 * - sections: per-section status from GET /build-status
 * - buildError: error message (if failed)
 * - onRetry: callback to retry a failed build
 */

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectionStatus = 'pending' | 'generating' | 'complete' | 'failed';

interface BuildProgressProps {
  sections: {
    hero: SectionStatus;
    about: SectionStatus;
    services: SectionStatus;
  };
  buildError: string | null;
  onRetry: () => void;
  isRetrying: boolean;
}

// ---------------------------------------------------------------------------
// Section config
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

export function BuildProgress({ sections, buildError, onRetry, isRetrying }: BuildProgressProps) {
  const completedCount = Object.values(sections).filter((s) => s === 'complete').length;
  const totalCount = SECTION_META.length;
  const allComplete = completedCount === totalCount;
  const hasFailed = Object.values(sections).some((s) => s === 'failed');

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Overall progress */}
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

      {/* Per-section indicators */}
      <div className="space-y-4">
        {SECTION_META.map((section) => (
          <SectionIndicator
            key={section.key}
            label={section.label}
            description={section.description}
            status={sections[section.key]}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Indicator
// ---------------------------------------------------------------------------

function SectionIndicator({
  label,
  description,
  status,
}: {
  label: string;
  description: string;
  status: SectionStatus;
}) {
  return (
    <div
      className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-500 ${
        status === 'complete'
          ? 'bg-sage/5 border-sage/20'
          : status === 'generating'
            ? 'bg-surface-alt border-sage/30'
            : status === 'failed'
              ? 'bg-red-950/20 border-red-900/30'
              : 'bg-surface-alt border-neutral-800'
      }`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        <StatusIcon status={status} />
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            status === 'complete'
              ? 'text-sage'
              : status === 'failed'
                ? 'text-red-300'
                : 'text-text-primary'
          }`}
        >
          {label}
        </p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>

      {/* Status label */}
      <div className="flex-shrink-0">
        <StatusLabel status={status} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Icon (animated spinner for generating)
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: SectionStatus }) {
  if (status === 'complete') {
    return (
      <svg
        className="w-5 h-5 text-sage"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (status === 'generating') {
    return (
      <svg className="w-5 h-5 text-sage animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  }

  if (status === 'failed') {
    return (
      <svg
        className="w-5 h-5 text-red-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }

  // pending
  return <div className="w-5 h-5 rounded-full border-2 border-neutral-600" />;
}

// ---------------------------------------------------------------------------
// Status Label
// ---------------------------------------------------------------------------

function StatusLabel({ status }: { status: SectionStatus }) {
  const [dots, setDots] = useState('');

  // Animate ellipsis for generating state
  useEffect(() => {
    if (status !== 'generating') return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, [status]);

  const labels: Record<SectionStatus, string> = {
    pending: 'Waiting',
    generating: `Writing${dots}`,
    complete: 'Done',
    failed: 'Failed',
  };

  return (
    <span
      className={`text-xs font-medium ${
        status === 'complete'
          ? 'text-sage'
          : status === 'failed'
            ? 'text-red-300'
            : status === 'generating'
              ? 'text-sage/80'
              : 'text-text-muted'
      }`}
    >
      {labels[status]}
    </span>
  );
}
