---
status: pending
priority: p2
issue_id: '11088'
tags: [code-review, frontend]
pr: 68
---

# F-024: prefersReducedMotion Hook Duplicated 3 Times in Onboarding Components

## Problem Statement

The `prefersReducedMotion` hook (or inline implementation) is duplicated across 3 onboarding components instead of being imported from a shared hooks module. Each copy implements the same `matchMedia` logic independently.

## Findings

- **Agents:** 3 agents flagged this issue
- **Locations:**
  - `apps/web/src/components/onboarding/OnboardingVideo.tsx:33-46`
  - `apps/web/src/components/onboarding/ProgressiveReveal.tsx:70-78`
  - `apps/web/src/components/onboarding/ProgressiveReveal.tsx:362-365`
- **Impact:** Code duplication that must be maintained in sync. If one copy is fixed or improved (e.g., adding SSR safety), the others remain stale. Increases bundle size unnecessarily.

## Proposed Solution

Create a shared `usePrefersReducedMotion` hook in `apps/web/src/hooks/` (or the existing hooks directory). Delete all local copies and import the shared hook.

## Effort

Small

## Acceptance Criteria

- [ ] Shared `usePrefersReducedMotion` hook exists in `@/hooks` (or similar)
- [ ] All 3 local implementations replaced with the shared import
- [ ] Hook handles SSR gracefully (returns `false` during server render)
- [ ] `npm run typecheck` and `npm run --workspace=apps/web build` pass
