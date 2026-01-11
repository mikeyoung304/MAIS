---
title: Multi-Agent Code Review Catches Critical Missing Type Import
date: 2026-01-05
category: code-review-patterns
tags:
  - eslint
  - code-review
  - import-type
  - dead-code
  - yagni
  - multi-agent-review
  - typescript
severity: P1
component: server/agent/orchestrator
slug: multi-agent-review-catches-missing-type-import
---

# Multi-Agent Code Review Catches Critical Missing Type Import

## Problem Statement

A worktree merge combining two feature branches (booking links + Build Mode storefront editor) resulted in 25 ESLint errors across 12 files. Standard lint tools found the 25 style violations, but **multi-agent code review discovered a P1 critical bug that ESLint completely missed**: the `SupportedModel` type was removed from imports but still used on line 587.

## Root Cause

During the worktree merge, import cleanup removed `SupportedModel` from the type imports in `base-orchestrator.ts`, but the type assertion `config.model as SupportedModel` on line 587 was not updated.

**Why ESLint missed it:** ESLint validates JavaScript/TypeScript syntax and style rules. It doesn't perform full type resolution—that's TypeScript's job. The code was syntactically valid, so ESLint passed it.

**Why TypeScript would catch it:** Running `npm run typecheck` would fail with `TS2304: Cannot find name 'SupportedModel'`. But if you only run `npm run lint`, you miss this entirely.

## The Critical Bug (P1)

**File:** `server/src/agent/orchestrator/base-orchestrator.ts`

```typescript
// Line 38: BEFORE (broken - SupportedModel missing)
import type { AgentType as TracingAgentType, TrustTier } from '../tracing';

// Line 587: Type assertion using undefined type
model: config.model as SupportedModel,  // TS2304: Cannot find name 'SupportedModel'
```

**Fix:**

```typescript
// Line 38: AFTER (fixed - SupportedModel restored)
import type { AgentType as TracingAgentType, SupportedModel, TrustTier } from '../tracing';
```

## Secondary Issues (P2 - YAGNI Violations)

The code review also identified dead code patterns that violate YAGNI (You Aren't Gonna Need It):

### 1. Fake Function to "Keep Imports Alive"

```typescript
// BAD: This is never called - it exists only to suppress unused import warnings
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _unusedTypeReference(): void {
  const _d: DiscoveryData | null = null;
  const _m: MarketResearchData | null = null;
  // ... more unused declarations
}
```

**Fix:** Delete the function. If types are used in type assertions elsewhere in the file, they're not unused. If ESLint complains, the types genuinely aren't needed.

### 2. Underscore-Prefixed "For Future Use"

```typescript
// BAD: Kept "for future use" - YAGNI violation
function _getMachineEventForPhase(phase: OnboardingPhase): OnboardingMachineEvent {
  // 26 lines of unused code
}
```

**Fix:** Delete it. Git history preserves the code if you ever need it.

### 3. Unused Database Query

```typescript
// BAD: Fetches data but never uses it
const _tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { slug: true },
});
// _tenant is never referenced after this
```

**Fix:** Delete the query. It wastes a database round-trip on every call.

## Standard Lint Fixes (P3)

| Pattern                      | Count | Fix                                       |
| ---------------------------- | ----- | ----------------------------------------- |
| `import type` conversions    | 8     | Separate type-only imports                |
| Switch case braces           | 2     | Add `{}` for variable declarations        |
| Unused variable prefix       | 1     | `_contentType` for destructured unused    |
| Unused imports removed       | 6+    | Delete entirely                           |
| eslint-disable for require() | 3     | Add comment for dynamic requires in tests |

## Prevention Strategies

### 1. Always Run Both Lint AND Typecheck

```bash
# Pre-commit hook should run BOTH
npm run lint && npm run typecheck
```

ESLint catches style issues. TypeScript catches type issues. You need both.

### 2. Decision Tree: Underscore vs Delete

```
Is the variable/function called anywhere?
├─ YES → Don't prefix, it's used
└─ NO → Is it a callback parameter required by signature?
    ├─ YES → Prefix with _ (e.g., `_event` in event handler)
    └─ NO → DELETE IT (don't prefix, remove entirely)
```

### 3. Never Keep Code "For Future Use"

- Git history preserves everything
- Dead code is invisible maintenance burden
- Readers waste time understanding unused code
- Delete now, `git log -p -S "functionName"` later if needed

### 4. Multi-Agent Review for Merges

Standard linting catches syntax. Multi-agent review catches:

- Missing type imports (type usage without import)
- Dead code patterns (functions never called)
- Wasteful operations (unused query results)
- Cross-file inconsistencies

## Files Modified

| File                                                    | Changes                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `server/src/agent/orchestrator/base-orchestrator.ts`    | Restored `SupportedModel` import (P1)    |
| `server/src/agent/tools/onboarding-tools.ts`            | Removed dead functions, fixed imports    |
| `server/src/agent/customer/customer-tools.ts`           | `import type { ProposalService }`        |
| `server/src/agent/tools/booking-link-tools.ts`          | Removed unused `prisma` from destructure |
| `server/src/routes/agent.routes.ts`                     | Removed unused error imports             |
| `server/src/routes/index.ts`                            | Removed unused executor/service imports  |
| `server/src/routes/platform-admin-traces.routes.ts`     | Removed unused `sanitizeError`           |
| `server/src/routes/public-customer-chat.routes.ts`      | `import type` for Prisma                 |
| `server/src/routes/tenant-admin.routes.ts`              | `_contentType` for unused param          |
| `server/test/agent-eval/capabilities/capability-map.ts` | eslint-disable for require()             |

## Key Insight

**ESLint and TypeScript are complementary, not redundant.**

- ESLint: "You imported `SupportedModel` but never use it" ✓
- ESLint: "You're using `SupportedModel` but didn't import it" ✗ (doesn't check this)
- TypeScript: "Cannot find name 'SupportedModel'" ✓

Always run both in CI/CD. This P1 bug would have broken TypeScript compilation but passed ESLint.

## Related Documentation

- [typescript-unused-variables-build-failure-MAIS-20251227.md](../build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md) - Underscore prefix decision tree
- [phase-5-testing-and-caching-prevention-MAIS-20251231.md](../patterns/phase-5-testing-and-caching-prevention-MAIS-20251231.md) - Error handling patterns
- [build-mode-storefront-editor-patterns-MAIS-20260105.md](../patterns/build-mode-storefront-editor-patterns-MAIS-20260105.md) - Related feature patterns

## Commit Reference

- **Commit:** `764b9132`
- **Branch:** `fix/tenant-provisioning-integrity`
- **Files:** 12 modified
- **Violations fixed:** 25 ESLint + 1 TypeScript (P1)
