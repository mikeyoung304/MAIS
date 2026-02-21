---
status: pending
priority: p3
issue_id: '11099'
tags: [code-review, architecture]
pr: 68
---

# F-035: Legacy aliases (OnboardingPhaseSchema etc.) have no removal timeline

## Problem Statement

Several schema exports are marked as legacy aliases (e.g., `OnboardingPhaseSchema`, `OnboardingStatusSchema`) with comments indicating they exist for backward compatibility. However, there is no deprecation timeline, no `@deprecated` JSDoc tag, and no tracking of which consumers still use them. Without a removal plan, these aliases will persist indefinitely, adding confusion about which schema is canonical.

## Location

`packages/contracts/src/schemas/onboarding.schema.ts:73-78`

## Proposed Solution

1. Add `/** @deprecated Use XxxSchema instead. Remove after 2026-04-01. */` JSDoc tags to all legacy aliases.
2. Run a codebase search to identify all consumers of the deprecated exports.
3. Create a follow-up todo to remove the aliases after the deprecation date.
4. Consider using TypeScript's `@deprecated` tag so IDEs show strikethrough on usage.

## Effort

Small — ~30 minutes. Add JSDoc tags, grep for usage, set calendar reminder.
