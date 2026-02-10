---
status: pending
priority: p3
issue_id: 5245
tags: [code-review, testability, pr-44, opus-verified]
dependencies: []
---

# Extract Helper Functions to Separate Modules

## Opus Verification (2026-02-10)

**Downgraded P2 → P3.** All three helpers (`getBudgetReason` at booking:64, `buildVariantGenerationPrompt` at marketing:106, `buildMarketingPrompt` at marketing:173) are defined at MODULE scope, not inside factory closures. They ARE already testable via direct import without Express/DI setup. Extraction is a file-organization improvement only. Note: discovery closure helpers (`hasSessionBeenGreeted`, `markSessionGreeted`, `buildGreetingKey`) are truly untestable but were not in the original finding.

## Problem Statement

Three helper functions are defined in route files at module scope. While already testable, extracting to dedicated modules would reduce file sizes and improve discoverability.

**Impact:** P3 NICE-TO-HAVE - File organization, not a testability blocker.

## Findings

### Code Simplicity Review

**Files:**

- `internal-agent-booking.routes.ts:64` - `getBudgetReason()`
- `internal-agent-marketing.routes.ts:106` - `buildVariantGenerationPrompt()`
- `internal-agent-marketing.routes.ts:173` - `buildMarketingPrompt()`

**Issue:** Pure functions trapped in route file scope

```typescript
// internal-agent-booking.routes.ts:64-84
function getBudgetReason(tenantServices: any[], budget: string): string {
  // 20 lines of budget categorization logic
  // No dependencies on Express req/res or services
  // Pure function: input → output
}
```

**Current testing approach:** Must instantiate full route factory with mocked services
**Better approach:** Direct function import for unit testing

## Proposed Solutions

### Solution 1: Extract to Domain Helper Modules (RECOMMENDED)

**Pros:**

- Unit testable in isolation (no Express/DI setup)
- Reduces route file sizes by ~100 lines total
- Reusable across other route files or services
- Clear separation: routes handle HTTP, helpers handle logic
  **Cons:** Need to create 2 new files
  **Effort:** Small (30 minutes)
  **Risk:** Very Low - pure functions, no side effects

**Implementation:**

```typescript
// server/src/lib/recommendation-helpers.ts
export function getBudgetReason(
  tenantServices: Pick<Service, 'basePrice' | 'title'>[],
  budget: string
): string {
  // Move 20 lines from booking.routes.ts:64-84
}

// server/src/lib/prompt-builders.ts
export function buildVariantGenerationPrompt(
  sectionType: string,
  sectionContent: Record<string, any>,
  userRequest?: string
): string {
  // Move from marketing.routes.ts:106-170
}

export function buildMarketingPrompt(
  packages: Package[],
  businessType: string,
  tenantName: string
): string {
  // Move from marketing.routes.ts:173-295
}

// Update route files:
// internal-agent-booking.routes.ts
import { getBudgetReason } from '../lib/recommendation-helpers';

// internal-agent-marketing.routes.ts
import { buildVariantGenerationPrompt, buildMarketingPrompt } from '../lib/prompt-builders';
```

**Test pattern:**

```typescript
// server/test/lib/recommendation-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { getBudgetReason } from '../../src/lib/recommendation-helpers';

describe('getBudgetReason', () => {
  it('returns "luxury" for budget "No budget"', () => {
    const services = [{ basePrice: 5000, title: 'Premium Package' }];
    expect(getBudgetReason(services, 'No budget')).toBe('luxury');
  });

  it('returns "average" for budget matching service price', () => {
    const services = [{ basePrice: 2000, title: 'Standard' }];
    expect(getBudgetReason(services, '$2000')).toBe('average');
  });
});
```

### Solution 2: Keep in Route Files (Current State)

**Pros:**

- No file reorganization
- Functions stay near usage
  **Cons:**
- Testing requires full route factory + DI mocks
- Large route files (793 LOC for marketing)
- Functions not reusable
  **Effort:** Zero
  **Risk:** Zero

## Recommended Action

**Use Solution 1** - Extract to helper modules. These are pure functions that deserve proper unit testing.

**Priority order:**

1. `getBudgetReason` (20 lines, booking domain) → `recommendation-helpers.ts`
2. `buildVariantGenerationPrompt` (64 lines, LLM prompts) → `prompt-builders.ts`
3. `buildMarketingPrompt` (122 lines, LLM prompts) → `prompt-builders.ts`

## Technical Details

**Affected Files:**

- Create: `server/src/lib/recommendation-helpers.ts` (~30 lines)
- Create: `server/src/lib/prompt-builders.ts` (~200 lines)
- Modify: `server/src/routes/internal-agent-booking.routes.ts` (remove 20 lines, add import)
- Modify: `server/src/routes/internal-agent-marketing.routes.ts` (remove 186 lines, add import)

**Net impact:**

- Route files: -206 lines
- New helper modules: +230 lines
- **Total: +24 lines** (but vastly improved testability)

**Related Patterns:**

- Single Responsibility Principle (SRP)
- Pure functions for business logic
- Ports & Adapters (helpers are domain logic, routes are adapters)

## Acceptance Criteria

- [ ] `recommendation-helpers.ts` created with `getBudgetReason()`
- [ ] `prompt-builders.ts` created with `buildVariantGenerationPrompt()` and `buildMarketingPrompt()`
- [ ] Route files import helpers instead of defining them locally
- [ ] Unit tests added for all 3 helpers (10+ test cases minimum)
- [ ] `npm run --workspace=server typecheck` passes
- [ ] `npm run --workspace=server test` passes
- [ ] Marketing route file reduced to <650 LOC
- [ ] Booking route file reduced to <490 LOC

## Work Log

**2026-02-09 - Initial Assessment (Code Review PR #44)**

- Code Simplicity Review identified 3 helper functions
- Confirmed functions have no dependencies on Express/DI
- Measured line counts: getBudgetReason (20), buildVariantGenerationPrompt (64), buildMarketingPrompt (122)
- Verified functions are pure (deterministic, no side effects)

## Resources

- **PR:** https://github.com/mikeyoung304/MAIS/pull/44
- **Related Files:**
  - `server/src/routes/internal-agent-booking.routes.ts:64-84`
  - `server/src/routes/internal-agent-marketing.routes.ts:106-295`
- **Testing Pattern:** `server/test/services/*.test.ts` (existing test examples)
- **SRP:** https://en.wikipedia.org/wiki/Single-responsibility_principle
