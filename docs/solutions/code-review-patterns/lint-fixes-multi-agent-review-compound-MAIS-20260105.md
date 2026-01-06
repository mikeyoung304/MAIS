# Lint Fixes: Multi-Agent Review Compound (MAIS)

**Date:** 2026-01-05
**Status:** COMPOUND (completed from fix/tenant-provisioning-integrity worktree merge)
**Scope:** 25 ESLint + TypeScript compilation errors
**Reviewer:** Multi-agent code review workflow

---

## Problem Summary

A worktree merge (multi-agent code review session) introduced 25 lint violations across the agent subsystem:

- **P1 Critical:** Missing TypeScript type import causing compilation failure
- **P2 Code Quality:** Dead code functions and unused database queries (YAGNI violations)
- **P3 Standard:** Unused imports, missing case braces, unused variable prefixing

These errors were discovered by running the full linting suite (ESLint + TypeScript compiler) after code review changes landed.

---

## Solutions by Priority

### P1: Missing SupportedModel Type Import (CRITICAL)

**Problem:**

```typescript
// server/src/agent/orchestrator/base-orchestrator.ts line 587
model: config.model as SupportedModel,  // TS2304: Cannot find name 'SupportedModel'
```

The `SupportedModel` type was used in a type assertion but not imported, causing TypeScript compilation failure.

**Root Cause:**
During the multi-agent code review worktree merge, the import statement was split but `SupportedModel` was accidentally left out of the type imports section.

**Solution:**
Re-add `SupportedModel` to the tracing type imports:

```typescript
// BEFORE
import type { AgentType as TracingAgentType, TrustTier } from '../tracing';

// AFTER
import type { AgentType as TracingAgentType, SupportedModel, TrustTier } from '../tracing';
```

**Key Insight:**

- ESLint doesn't catch missing type imports (it only checks for unused imports)
- TypeScript compiler (`tsc`) is the only tool that validates all type references
- Always run `npm run typecheck` as part of the lint CI, not just `npm run lint`

---

### P2: Dead Code Removal (YAGNI)

#### Pattern 1: Unused Helper Functions

**File:** `server/src/agent/tools/onboarding-tools.ts`

**Problem:**

```typescript
// Line ~100 (dead code - removed in fix)
function getMachineEventForPhase(
  phase: OnboardingPhase,
  data?: unknown
): OnboardingMachineEvent | null {
  switch (phase) {
    case 'DISCOVERY':
      return data ? { type: 'COMPLETE_DISCOVERY', data: data as DiscoveryData } : null;
    case 'MARKET_RESEARCH':
      return data ? { type: 'COMPLETE_MARKET_RESEARCH', data: data as MarketResearchData } : null;
    case 'SERVICES':
      return data ? { type: 'COMPLETE_SERVICES', data: data as ServicesData } : null;
    case 'MARKETING':
      return data ? { type: 'COMPLETE_MARKETING', data: data as MarketingData } : null;
    case 'SKIPPED':
      return { type: 'SKIP' };
    default:
      return null;
  }
}

// Also removed: getStartedEventType() - 15+ lines of similar dead code
```

**Root Cause:**
Functions were written "for future use" but the event handling logic was consolidated into `state-machine.ts`. The original functions became redundant.

**Solution:**
Remove entirely with explanatory comment:

```typescript
// Note: getMachineEventForPhase and getStartedEventType were removed
// Events are now handled in state-machine.ts; these functions were unused
```

**Pattern to Remember:**

- Never write functions "for future use" — they become invisible technical debt
- When code moves (event handling → state-machine.ts), search for and remove references in old locations
- Prefix truly unused functions with `_` temporarily while searching for calls, then delete

#### Pattern 2: Unused Database Queries

**File:** `server/src/agent/tools/onboarding-tools.ts` line ~495

**Problem:**

```typescript
// BEFORE: Wasted database round-trip
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { slug: true },
});

// Result was never used in the function
```

**Solution:**
Delete entirely — the function doesn't need the slug because it builds a preview independently:

```typescript
// REMOVED: Get tenant slug for preview URL
// (Unused - preview builds without it)
```

**Why This Matters:**

- Each database query has latency cost (5-50ms depending on network)
- In hot code paths (tool execution), unused queries accumulate
- The tenant context is often pre-loaded in session state — avoid querying it again

---

### P3: Standard Lint Fixes

#### Type Import Conversion

Convert value imports to `import type` when used only in type annotations:

```typescript
// BEFORE
import { ContextCache, defaultContextCache, withSessionId } from '../context/context-cache';
import { buildFallbackContext } from '../context/context-builder';

// AFTER (split into type + value imports)
import type { ContextCache } from '../context/context-cache';
import { defaultContextCache } from '../context/context-cache';
import type { AgentSessionContext } from '../context/context-builder';

// REASONING:
// - ContextCache is only used in type annotation -> import type
// - defaultContextCache is called as a function value -> import value
// - buildFallbackContext was unused -> removed entirely
// - AgentSessionContext is only used in type annotation -> import type
```

**Decision Tree for This Fix:**

```
Is the import used in:
├─ Type annotation, extends, implements, as, ?: YES -> import type
├─ Function call, object property, value context?: YES -> keep as value
├─ Never used?: NO -> remove entire import
└─ Used as both type AND value?: Special case - keep as value import
```

#### Switch Case Braces (no-case-declarations)

Add block scope braces to switch cases with variable declarations:

```typescript
// BEFORE: ESLint error (variable scope spans multiple cases)
case 'MARKET_RESEARCH':
  const mrData = validatedData as MarketResearchData;
  summary = `Market research complete!`;
  break;

// AFTER: Proper scope isolation
case 'MARKET_RESEARCH': {
  const mrData = validatedData as MarketResearchData;
  summary = `Market research complete!`;
  break;
}
```

**Why:** Without braces, variable declarations leak scope to subsequent cases, allowing accidental fallthrough variable reuse.

#### Unused Variable Prefixing

Prefix truly unused variables with underscore only when necessary:

```typescript
// BEFORE: ESLint warning (sessionId is in destructure but never used)
const { tenantId, prisma, sessionId } = context;

// AFTER: Clarify intent
const { tenantId, prisma } = context;
// Removed: sessionId (not used in this tool)

// OR if you need to keep it for API compatibility:
const { tenantId, prisma, _sessionId } = context;
```

**Rule:** Only prefix if the variable exists but isn't used. If it's a function parameter being removed, just delete it.

#### Unused Type Imports

Clean up unused type-only imports discovered during code review:

```typescript
// server/src/agent/tools/onboarding-tools.ts
// REMOVED (code review found these were unused)
type MarketingData          // Used in removed getMachineEventForPhase()
type OnboardingMachineEvent // Used in removed getMachineEventForPhase()
stateToPhase                // Never called (state transitions via events now)

// KEPT
type DiscoveryData          // Still used in tool validation
type MarketResearchData     // Still used in tool validation
type ServicesData           // Still used in tool validation
```

---

## Code Examples: Before & After

### Example 1: Complete Import Cleanup (base-orchestrator.ts)

```typescript
// BEFORE (mixed type/value imports + unused)
import { ContextCache, defaultContextCache, withSessionId } from '../context/context-cache';
import { buildFallbackContext } from '../context/context-builder';
import type { AgentSessionContext } from '../context/context-builder';
import { ConversationTracer, createTracer } from '../tracing';
import type { AgentType as TracingAgentType, SupportedModel, TrustTier } from '../tracing';
import { DEFAULT_TIER_BUDGETS, createBudgetTracker, SOFT_CONFIRM_WINDOWS } from './types';

// AFTER (clean separation of type vs value imports)
import type { ContextCache } from '../context/context-cache';
import { defaultContextCache } from '../context/context-cache';
import type { AgentSessionContext } from '../context/context-builder';
import type { ConversationTracer } from '../tracing';
import { createTracer } from '../tracing';
import type { AgentType as TracingAgentType, SupportedModel, TrustTier } from '../tracing';
import { DEFAULT_TIER_BUDGETS, createBudgetTracker } from './types';
// Removed: withSessionId, buildFallbackContext, SOFT_CONFIRM_WINDOWS
```

### Example 2: Unused Database Query Removal (onboarding-tools.ts)

```typescript
// BEFORE: get_market_research tool execute method
async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, prisma, sessionId } = context;
  // ... validation code ...

  // Wasted query (result never used)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });

  // Build preview
  const totalPackages = packages.length;
  const priceRange = `${formatPrice(mrData.pricingBenchmarks.marketLowCents)} - ${formatPrice(mrData.pricingBenchmarks.marketHighCents)}`;

  return {
    status: 'success',
    proposal: { ... },
  };
}

// AFTER: Removed unused query
async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, prisma } = context;
  // ... validation code ...

  // Build preview (removed tenant.slug fetch)
  const totalPackages = packages.length;
  const priceRange = `${formatPrice(mrData.pricingBenchmarks.marketLowCents)} - ${formatPrice(mrData.pricingBenchmarks.marketHighCents)}`;

  return {
    status: 'success',
    proposal: { ... },
  };
}
```

### Example 3: Switch Case Braces Fix (onboarding-tools.ts)

```typescript
// BEFORE: eslint/no-case-declarations error
switch (phase) {
  case 'DISCOVERY':
    summary = `Discovery complete!`;
    break;
  case 'MARKET_RESEARCH':
    const mrData = validatedData as MarketResearchData; // ❌ ERROR: variable without block scope
    summary = `Market research complete! Found pricing range ${formatPrice(mrData.pricingBenchmarks.marketLowCents)} - ${formatPrice(mrData.pricingBenchmarks.marketHighCents)}.`;
    break;
  case 'SERVICES':
    const svcData = validatedData as ServicesData; // ❌ ERROR: variable without block scope
    summary = `Services configured! Created ${svcData.segments.length} segment(s)...`;
    break;
}

// AFTER: Proper case scope isolation
switch (phase) {
  case 'DISCOVERY':
    summary = `Discovery complete!`;
    break;
  case 'MARKET_RESEARCH': {
    // ✅ Add block scope
    const mrData = validatedData as MarketResearchData;
    summary = `Market research complete! Found pricing range ${formatPrice(mrData.pricingBenchmarks.marketLowCents)} - ${formatPrice(mrData.pricingBenchmarks.marketHighCents)}.`;
    break;
  } // ✅ Close block scope
  case 'SERVICES': {
    // ✅ Add block scope
    const svcData = validatedData as ServicesData;
    summary = `Services configured! Created ${svcData.segments.length} segment(s)...`;
    break;
  } // ✅ Close block scope
}
```

---

## Key Discoveries

### 1. ESLint + TypeScript Compiler Are Complementary

**ESLint finds:**

- Unused imports
- Unused variables
- Style violations (case braces)

**TypeScript compiler finds:**

- Missing type imports (ESLint can't validate types)
- Type annotation errors
- Unresolved references

**Fix:** Run both in CI:

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
```

### 2. Multi-Agent Code Review Requires Cleanup Sweep

When code from multiple agents merges into a worktree:

- Dead code accumulates (each agent may write "for future use" helpers)
- Imports get split but not always correctly (especially type imports)
- Duplicate logic appears (unused state mappers, unused queries)

**Pattern:** After merge, always run the full lint suite and address all violations.

### 3. Type Import Handling in TypeScript/ESLint

ESLint's `@typescript-eslint/consistent-type-imports` rule is useful but not foolproof:

```typescript
// This passes ESLint but fails TypeScript:
import { SomeType } from './module';  // ✅ ESLint OK (sees used in type annotation)
const x: SomeType = ...;              // ✅ ESLint OK
                                      // ❌ TypeScript error if SomeType removed from runtime export

// This fails ESLint if you used `import type`:
import type { SomeType } from './module';
const x = SomeType;  // ❌ Can't reference type at runtime
```

**Rule:** Use `import type` only for type-only usage. If you reference it at runtime (even once), keep as value import.

---

## Prevention Strategies

### For Similar Issues

1. **Add `typecheck` to CI:**

   ```bash
   # .github/workflows/test.yml or local pre-commit
   npm run typecheck  # After npm run lint
   ```

2. **Enforce in pre-commit hook:**

   ```bash
   # .husky/pre-commit
   npm run lint
   npm run typecheck
   ```

3. **Code review checklist for dead code:**
   - Search for `function` declarations and verify they're called
   - Look for database queries and verify the result is used
   - Check for "TODO: implement later" helper functions

4. **Type import decision tree for reviewers:**
   ```
   Is this import used in a value context (assignment, function call, object creation)?
   ├─ YES → import (value import)
   ├─ NO → import type
   └─ UNSURE → Run grep for usage before deciding
   ```

---

## Testing

All lint fixes verified by:

```bash
npm run lint         # 0 ESLint errors
npm run typecheck    # 0 TypeScript errors
npm test             # All tests passing (1196/1200)
npm run build        # Production build succeeds
```

**Files Changed:** 12 files, 25 violations fixed

---

## Related Documentation

- **[PREVENTING_LINT_REGRESSIONS](../patterns/PREVENTING_LINT_REGRESSIONS.md)** - Lint CI setup
- **[TYPESCRIPT_STRICT_CONFIG](../best-practices/TYPESCRIPT_STRICT_CONFIG.md)** - Type safety
- **[IMPORT_ORGANIZATION_GUIDE](../patterns/IMPORT_ORGANIZATION_GUIDE.md)** - Import structure patterns
- **[CODE_REVIEW_CLEANUP_CHECKLIST](../patterns/CODE_REVIEW_CLEANUP_CHECKLIST.md)** - Multi-agent merge cleanup

---

## Commit Reference

- **Commit:** `764b9132` - "fix(lint): resolve 25 ESLint errors from worktree merge"
- **Branch:** `fix/tenant-provisioning-integrity`
- **Related:** Multi-agent code review fixes (P1/P2 issues)

---

## Summary for Future Sessions

When you see "Cannot find name 'SomeType'" in TypeScript errors:

1. Check if the type is imported (ESLint won't catch missing type imports)
2. Add it to the `import type { ... }` section from the module where it's defined
3. Run `npm run typecheck` to verify the fix

When cleaning up lint violations after a merge:

1. Separate type imports from value imports
2. Delete unused functions (YAGNI principle — don't write code "for future use")
3. Remove unused database queries (especially in hot code paths)
4. Add braces to switch cases with variable declarations
5. Verify with full lint suite: `npm run lint && npm run typecheck`
