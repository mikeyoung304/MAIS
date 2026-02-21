---
status: pending
priority: p2
issue_id: '11086'
tags: [code-review, typescript]
pr: 68
---

# F-022: getRedirectForStatus Accepts String Instead of OnboardingStatus

## Problem Statement

The `getRedirectForStatus` function accepts a plain `string` parameter instead of the `OnboardingStatus` enum type. This defeats TypeScript's exhaustiveness checking and allows invalid status strings to be passed without compile-time errors.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/routes/tenant-admin-onboarding.routes.ts:509`
- **Impact:** No compile-time safety when calling `getRedirectForStatus`. If a new onboarding status is added to the enum, the function's switch/if chain will silently fall through to a default case instead of producing a TypeScript error. Bugs from unhandled states will only surface at runtime.

## Proposed Solution

Change the parameter type from `string` to `OnboardingStatus`. Add an exhaustiveness check (e.g., `assertNever` or `default: throw new Error`) to ensure all enum values are handled.

## Effort

Small

## Acceptance Criteria

- [ ] `getRedirectForStatus` parameter typed as `OnboardingStatus` (not `string`)
- [ ] Exhaustiveness check ensures all enum values are handled
- [ ] `npm run typecheck` passes
- [ ] Adding a new enum value without handling it in this function causes a compile error
