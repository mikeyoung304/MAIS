---
title: 'Import Name Mismatch in Onboarding Tools'
date: 2025-12-31
category: build-errors
severity: P1
component: server/agent/tools
tags:
  - import-error
  - module-resolution
  - agent-tools
  - onboarding
  - typescript

symptoms: |
  - "TypeError: getIndustryBenchmark is not a function" during test execution
  - "TypeError: appendOnboardingEvent is not a function" during test execution
  - Tests fail immediately when onboarding-tools module loads
  - Multiple "is not a function" errors in rapid succession

root_cause: |
  onboarding-tools.ts had three import mismatches with actual exports:
  1. getIndustryBenchmark (singular, sync) vs getIndustryBenchmarks (plural, async)
  2. appendOnboardingEvent vs appendEvent
  3. getCurrentPhase (doesn't exist at all)
---

# Import Name Mismatch in Onboarding Tools

## Problem

During Phase 2 implementation of agent-powered tenant onboarding, incorrect imports in `onboarding-tools.ts` caused runtime "is not a function" errors during test execution.

### Error Messages

```
TypeError: getIndustryBenchmark is not a function
TypeError: appendOnboardingEvent is not a function
```

### Affected Files

- `server/src/agent/tools/onboarding-tools.ts` (consumer)
- `server/src/agent/onboarding/event-sourcing.ts` (provider)
- `server/src/agent/onboarding/industry-benchmarks.ts` (provider)

## Root Cause

Three import mismatches existed:

| Import Used             | Actual Export           | Issue                                       |
| ----------------------- | ----------------------- | ------------------------------------------- |
| `getIndustryBenchmark`  | `getIndustryBenchmarks` | Singular vs plural, sync vs async           |
| `appendOnboardingEvent` | `appendEvent`           | Different prefix naming                     |
| `getCurrentPhase`       | _(doesn't exist)_       | Assumed function that was never implemented |

### Why This Happened

1. **Assumed naming conventions** - Developer wrote imports based on expected names without checking actual exports
2. **Similar names** - Functions like `appendEvent` vs `appendOnboardingEvent` are easy to confuse
3. **Async/sync confusion** - `getIndustryBenchmarks` is async with 1 param; the assumed name implied sync with 2 params

## Solution

### Step 1: Check Actual Exports First

Before importing, verify what's actually exported:

```bash
grep "^export " server/src/agent/onboarding/event-sourcing.ts
```

Output shows actual exports:

```
export async function getNextVersion(
export function validateEventPayload<T>(
export async function appendEvent(        # <-- Correct name
export async function updateOnboardingPhase(
```

### Step 2: Fix Imports

**Before (Wrong):**

```typescript
import {
  appendOnboardingEvent, // Wrong
  getCurrentPhase, // Doesn't exist
  type OnboardingEventType,
} from '../onboarding/event-sourcing';
import { getIndustryBenchmark } from '../onboarding/industry-benchmarks';
```

**After (Correct):**

```typescript
import {
  appendEvent, // Correct
  type OnboardingEventType,
} from '../onboarding/event-sourcing';
import { searchMarketPricing } from '../onboarding/market-search';
```

### Step 3: Delegation over Duplication

For `getMarketResearchTool`, instead of trying to find the right import, delegate to the existing service:

```typescript
// Delegate to searchMarketPricing which handles:
// - Web search (Phase 3)
// - Industry benchmark fallback
// - COL adjustments by state
// - Target market multipliers
// - Source attribution
const searchResult = await searchMarketPricing({
  tenantId,
  businessType,
  targetMarket,
  city,
  state,
  skipWebSearch: true,
});
```

**Why delegation was better:**

1. **DRY** - `searchMarketPricing` already implements the complete logic
2. **Consistency** - Single source of truth for pricing benchmarks
3. **Maintainability** - Future enhancements only need to change one place
4. **Testability** - Mock one function instead of multiple internal helpers

## Prevention Strategies

### 1. Check Exports Before Writing Imports

```bash
# Quick check of what a module exports
grep "^export " path/to/module.ts

# Or use ripgrep for more context
rg "^export (function|const|async function)" path/to/module.ts
```

### 2. Code Review Checklist

When reviewing code that adds new imports:

- [ ] Verify imported name matches actual export (case-sensitive)
- [ ] Check if function is sync or async
- [ ] Verify function signature (number of parameters)
- [ ] Check if an existing service already wraps this functionality

### 3. TypeScript IDE Features

Enable strict TypeScript checking - imports of non-existent functions should fail at build time, not runtime:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

### 4. Prefer Barrel Exports (index.ts)

Check the module's `index.ts` first - it shows the public API:

```typescript
// server/src/agent/onboarding/index.ts
export {
  appendEvent, // <-- Public API shows correct names
  updateOnboardingPhase,
} from './event-sourcing';
```

## Quick Reference

| Pattern                                            | Risk   | Prevention                                        |
| -------------------------------------------------- | ------ | ------------------------------------------------- |
| Singular vs Plural (`getItem` vs `getItems`)       | High   | Check actual export; plurals often mean "get all" |
| Prefix variations (`append` vs `appendOnboarding`) | High   | Search for function in provider module            |
| Async vs Sync                                      | Medium | Check for `async` keyword in export               |
| Assumed functions                                  | High   | Always verify export exists before importing      |

## Related Documentation

- [IMPORT-SOURCE-ERROR-PREVENTION.md](../typescript-build-errors/IMPORT-SOURCE-ERROR-PREVENTION.md) - Named vs default imports
- [INTERFACE-METHOD-NAMING-PREVENTION.md](../typescript-build-errors/INTERFACE-METHOD-NAMING-PREVENTION.md) - Method naming conventions
- [circular-dependency-executor-registry-MAIS-20251229.md](../patterns/circular-dependency-executor-registry-MAIS-20251229.md) - Registry pattern for avoiding circular imports

## Verification

Fixed in commit `c11cda2`:

- 63 tests passing across 3 test files
- All 4 onboarding tools functional
- TypeScript compilation clean
