# Missing Error Boundary for Homepage

## Metadata

- **ID:** 442
- **Status:** pending
- **Priority:** P3
- **Tags:** frontend, reliability
- **Source:** Brand Review - Code Simplicity Reviewer

## Problem Statement

The homepage route (`/`) has no `error.tsx` error boundary. If the page fails to render (unlikely but possible), users would see an unhandled error instead of a graceful fallback.

## Findings

- No file at `apps/web/src/app/error.tsx`
- Homepage is mostly static, so low risk
- But production safety requires error boundaries

## Proposed Solutions

### Option A: Add Simple Error Boundary

Create `apps/web/src/app/error.tsx` with brand-appropriate error message

```tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl font-bold text-text-primary mb-4">
          Something went sideways.
        </h1>
        <p className="text-text-muted mb-8">
          We're on it. Try refreshing, or come back in a minute.
        </p>
        <button
          onClick={reset}
          className="bg-sage hover:bg-sage-hover text-white rounded-full px-8 py-3 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
```

**Effort:** Small
**Risk:** None

## Technical Details

**Files to Create:**

- `apps/web/src/app/error.tsx`

## Acceptance Criteria

- [ ] Error boundary exists at app root
- [ ] Error message matches brand voice
- [ ] Reset button allows retry
- [ ] Styling matches homepage design

## Work Log

| Date       | Action  | Notes                                        |
| ---------- | ------- | -------------------------------------------- |
| 2025-12-27 | Created | From brand review - Code Simplicity Reviewer |
