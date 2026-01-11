---
status: completed
priority: p3
issue_id: 747
tags: [code-review, dry-violation, react, pr-27]
dependencies: []
---

# P3: Duplicate Onboarding Section JSX

## Problem Statement

Nearly identical onboarding progress + storefront preview link JSX appears in both desktop (lines 272-301) and mobile (lines 452-479) paths.

**Impact:** Maintenance burden, risk of divergence, ~50 lines of duplication.

## Findings

**Reviewer:** code-simplicity-reviewer

**Location:** `apps/web/src/components/agent/AgentPanel.tsx:272-301` and `:452-479`

## Proposed Solutions

### Solution A: Extract to Component (Recommended)

- **Pros:** Single source of truth, reusable
- **Cons:** Minor file change
- **Effort:** Small (15 minutes)
- **Risk:** Low

```tsx
function OnboardingSection({
  currentPhase,
  onSkip,
  isSkipping,
  skipError,
  tenantSlug,
}: OnboardingSectionProps) {
  return (
    <div className="px-4 py-3 border-b border-neutral-700 bg-surface-alt shrink-0">
      <OnboardingProgress
        currentPhase={currentPhase}
        onSkip={onSkip}
        isSkipping={isSkipping}
        skipError={skipError}
      />
      {tenantSlug && (
        <a href={`/t/${tenantSlug}`} ...>
          View your storefront
        </a>
      )}
    </div>
  );
}
```

## Recommended Action

Solution A - Extract to reusable component.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/AgentPanel.tsx`

**Lines Saved:** ~50 lines

## Acceptance Criteria

- [ ] Single `OnboardingSection` component used in both desktop and mobile
- [ ] Props properly typed
- [ ] Existing behavior unchanged

## Work Log

| Date       | Action  | Notes                          |
| ---------- | ------- | ------------------------------ |
| 2026-01-11 | Created | From PR #27 multi-agent review |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
