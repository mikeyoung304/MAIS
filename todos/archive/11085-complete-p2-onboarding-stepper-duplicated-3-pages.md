---
status: pending
priority: p2
issue_id: '11085'
tags: [code-review, frontend]
pr: 68
---

# F-021: Onboarding Stepper UI Copy-Pasted Across 3 Page Files

## Problem Statement

The onboarding step indicator UI (stepper with step numbers, labels, and active/complete states) is copy-pasted across 3 separate page files instead of being extracted into a shared component. Changes to the stepper design must be manually replicated in all 3 locations.

## Findings

- **Agents:** 1 agent flagged
- **Locations:**
  - `apps/web/src/app/onboarding/payment/page.tsx`
  - `apps/web/src/app/onboarding/intake/page.tsx:142-165`
  - `apps/web/src/app/onboarding/build/page.tsx:296-318`
- **Impact:** UI inconsistency risk — if one copy is updated but others are not, the stepper looks different on different pages. Increases maintenance burden and violates DRY principle.

## Proposed Solution

Extract an `OnboardingStepper` component (e.g., `apps/web/src/components/onboarding/OnboardingStepper.tsx`) that accepts the current step as a prop. Replace all 3 inline copies with the shared component.

## Effort

Small

## Acceptance Criteria

- [ ] `OnboardingStepper` component created with current step prop
- [ ] All 3 page files use the shared component instead of inline stepper markup
- [ ] Stepper visual appearance is identical before and after extraction
- [ ] `npm run typecheck` and `npm run --workspace=apps/web build` pass
