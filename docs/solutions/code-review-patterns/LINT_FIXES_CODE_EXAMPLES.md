# Lint Fixes: Code Examples (Side-by-Side)

**Reference:** Commit `764b9132` — "fix(lint): resolve 25 ESLint errors from worktree merge"

All examples below show BEFORE (❌) and AFTER (✅) code changes.

---

## P1: Missing Type Import (Critical)

### Problem: SupportedModel Not Found

**File:** `server/src/agent/orchestrator/base-orchestrator.ts`

```typescript
// LINE 587: Type used but not imported
❌ BEFORE: TS2304 Error
────────────────────────────────────────────────────────────
model: config.model as SupportedModel,  // Can't find name 'SupportedModel'


✅ AFTER: Fixed by adding import
────────────────────────────────────────────────────────────
// Line 38: Add SupportedModel to type imports
import type { AgentType as TracingAgentType, SupportedModel, TrustTier } from '../tracing';

// Line 587: Now compiles successfully
model: config.model as SupportedModel,  // ✅ TS2304 resolved
```

---

## P2: Dead Code Removal

### Example 1: Unused Helper Function

**File:** `server/src/agent/tools/onboarding-tools.ts`

```typescript
// ~100+ lines of dead code removed
❌ BEFORE: Function never called (dead code)
────────────────────────────────────────────────────────────
/**
 * Map phase to machine event type
 */
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

// Also removed getStartedEventType() - another 15+ lines of dead code


✅ AFTER: Removed with explanation
────────────────────────────────────────────────────────────
// Note: getMachineEventForPhase and getStartedEventType were removed
// Events are now handled in state-machine.ts; these functions were unused
```

**Why Removed:**

- Event handling consolidation moved logic to `state-machine.ts`
- No callers in codebase (verified by grep)
- YAGNI principle: Don't keep unused code "for future use"

### Example 2: Unused Database Query

**File:** `server/src/agent/tools/onboarding-tools.ts` line ~495

```typescript
// Wasted database round-trip removed
❌ BEFORE: Query result never used
────────────────────────────────────────────────────────────
async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, prisma, sessionId } = context;
  // ... validation code ...

  // ❌ This query is wasted (slug result never used)
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });

  // Build preview (never references tenant.slug)
  const totalPackages = packages.length;
  const priceRange = `${formatPrice(...)} - ${formatPrice(...)}`;

  return { status: 'success', proposal: { ... } };
}


✅ AFTER: Query deleted
────────────────────────────────────────────────────────────
async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, prisma } = context;
  // ... validation code ...

  // ✅ Removed: Get tenant slug for preview URL (unused)

  // Build preview (works without tenant lookup)
  const totalPackages = packages.length;
  const priceRange = `${formatPrice(...)} - ${formatPrice(...)}`;

  return { status: 'success', proposal: { ... } };
}
```

**Performance Impact:**

- Saves ~10-50ms per tool execution (database round-trip)
- In hot code path (tool execution) with 100s of invocations, this compounds
- Session often pre-loads tenant data anyway (waste of second query)

---

## P3: Standard Lint Fixes

### Pattern 1: Type Import Conversion

**File:** `server/src/agent/orchestrator/base-orchestrator.ts`

```typescript
❌ BEFORE: Mixed type and value imports (eslint violations)
────────────────────────────────────────────────────────────
import type {
  MessageParam,
  ToolUseBlock,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import type { PrismaClient, Prisma } from '../../generated/prisma';
import type { ToolContext, AgentToolResult, AgentTool } from '../tools/types';
import { INJECTION_PATTERNS } from '../tools/types';
import { ProposalService } from '../proposals/proposal.service';
import { AuditService } from '../audit/audit.service';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import { withRetry, CLAUDE_API_RETRY_CONFIG } from '../utils/retry';
import { ContextCache, defaultContextCache, withSessionId } from '../context/context-cache';  // ❌ Mixed
import { buildFallbackContext } from '../context/context-builder';                             // ❌ Unused
import type { AgentSessionContext } from '../context/context-builder';
import { ConversationTracer, createTracer } from '../tracing';                                 // ❌ Mixed
import type { AgentType as TracingAgentType, SupportedModel, TrustTier } from '../tracing';
import { getProposalExecutor } from '../proposals/executor-registry';
import { validateExecutorPayload } from '../proposals/executor-schemas';
import type { AgentType, BudgetTracker, TierBudgets } from './types';
import { DEFAULT_TIER_BUDGETS, createBudgetTracker, SOFT_CONFIRM_WINDOWS } from './types';  // ❌ Unused
import { ToolRateLimiter, type ToolRateLimits, DEFAULT_TOOL_RATE_LIMITS } from './rate-limiter';
import {
  CircuitBreaker,
  type CircuitBreakerConfig,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker';


✅ AFTER: Clean separation - type imports grouped, unused removed
────────────────────────────────────────────────────────────
import type {
  MessageParam,
  ToolUseBlock,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import type { PrismaClient, Prisma } from '../../generated/prisma';
import type { ToolContext, AgentToolResult, AgentTool } from '../tools/types';
import { INJECTION_PATTERNS } from '../tools/types';
import { ProposalService } from '../proposals/proposal.service';
import { AuditService } from '../audit/audit.service';
import { logger } from '../../lib/core/logger';
import { sanitizeError } from '../../lib/core/error-sanitizer';
import { withRetry, CLAUDE_API_RETRY_CONFIG } from '../utils/retry';
import type { ContextCache } from '../context/context-cache';  // ✅ Separated
import { defaultContextCache } from '../context/context-cache'; // ✅ Value import
import type { AgentSessionContext } from '../context/context-builder';
// ✅ Removed: buildFallbackContext (unused)
// ✅ Removed: withSessionId (unused)
import type { ConversationTracer } from '../tracing';           // ✅ Separated
import { createTracer } from '../tracing';                      // ✅ Value import
import type { AgentType as TracingAgentType, SupportedModel, TrustTier } from '../tracing';
import { getProposalExecutor } from '../proposals/executor-registry';
import { validateExecutorPayload } from '../proposals/executor-schemas';
import type { AgentType, BudgetTracker, TierBudgets } from './types';
import { DEFAULT_TIER_BUDGETS, createBudgetTracker } from './types';  // ✅ Removed SOFT_CONFIRM_WINDOWS
import { ToolRateLimiter, type ToolRateLimits, DEFAULT_TOOL_RATE_LIMITS } from './rate-limiter';
import {
  CircuitBreaker,
  type CircuitBreakerConfig,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker';
```

**Decision Process:**

1. `ContextCache` used only in type annotations (line 32) → `import type`
2. `defaultContextCache` called as function (line 33) → value import
3. `ConversationTracer` used only in type annotation (line 36) → `import type`
4. `createTracer` called as function (line 587) → value import

### Pattern 2: Switch Case Braces

**File:** `server/src/agent/tools/onboarding-tools.ts`

```typescript
❌ BEFORE: eslint/no-case-declarations error
────────────────────────────────────────────────────────────
switch (phase) {
  case 'DISCOVERY':
    summary = `Discovery complete! We know you're a ${(validatedData as DiscoveryData).businessType} in ${(validatedData as DiscoveryData).location.city}, ${(validatedData as DiscoveryData).location.state}.`;
    break;
  case 'MARKET_RESEARCH':
    const mrData = validatedData as MarketResearchData;
    // ❌ ERROR: Variable without block scope (can leak to next case)
    summary = `Market research complete! Found pricing range ${formatPrice(mrData.pricingBenchmarks.marketLowCents)} - ${formatPrice(mrData.pricingBenchmarks.marketHighCents)}.`;
    break;
  case 'SERVICES':
    const svcData = validatedData as ServicesData;
    // ❌ ERROR: Variable without block scope
    summary = `Services configured! Created ${svcData.segments.length} segment(s) with ${svcData.createdPackageIds.length} package(s).`;
    break;
  case 'MARKETING':
    summary = 'Marketing content configured! Your storefront is ready.';
    break;
  default:
    summary = 'Onboarding progressing...';
}


✅ AFTER: Proper block scope isolation
────────────────────────────────────────────────────────────
switch (phase) {
  case 'DISCOVERY':
    summary = `Discovery complete! We know you're a ${(validatedData as DiscoveryData).businessType} in ${(validatedData as DiscoveryData).location.city}, ${(validatedData as DiscoveryData).location.state}.`;
    break;
  case 'MARKET_RESEARCH': {  // ✅ Add opening brace
    const mrData = validatedData as MarketResearchData;
    summary = `Market research complete! Found pricing range ${formatPrice(mrData.pricingBenchmarks.marketLowCents)} - ${formatPrice(mrData.pricingBenchmarks.marketHighCents)}.`;
    break;
  }  // ✅ Add closing brace
  case 'SERVICES': {  // ✅ Add opening brace
    const svcData = validatedData as ServicesData;
    summary = `Services configured! Created ${svcData.segments.length} segment(s) with ${svcData.createdPackageIds.length} package(s).`;
    break;
  }  // ✅ Add closing brace
  case 'MARKETING':
    summary = 'Marketing content configured! Your storefront is ready.';
    break;
  default:
    summary = 'Onboarding progressing...';
}
```

**Why:** Without braces, case variables leak scope:

```javascript
// Without braces (WRONG)
case 'MARKET_RESEARCH':
  const mrData = { ... };
  break;
case 'SERVICES':
  const svcData = { ... };  // ← mrData is still in scope!
  break;

// With braces (CORRECT)
case 'MARKET_RESEARCH': {
  const mrData = { ... };
} // ← mrData scope ends here
case 'SERVICES': {
  const svcData = { ... };  // ← Clean scope
}
```

### Pattern 3: Unused Variables

**File:** `server/src/agent/tools/onboarding-tools.ts`

```typescript
❌ BEFORE: ESLint warning on unused sessionId
────────────────────────────────────────────────────────────
async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, prisma, sessionId } = context;  // ❌ sessionId unused
  // ... rest of function never references sessionId


✅ AFTER: Remove unused variable
────────────────────────────────────────────────────────────
async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, prisma } = context;  // ✅ Only destructure used variables
  // ... rest of function
```

**Rule:** Don't prefix with `_` unless variable exists and needs to stay (e.g., API compatibility). If you're removing it from destructure, just delete it.

### Pattern 4: Unused Type Imports

**File:** `server/src/agent/tools/onboarding-tools.ts`

```typescript
❌ BEFORE: Three unused types imported
────────────────────────────────────────────────────────────
import {
  type DiscoveryData,
  type MarketResearchData,
  type ServicesData,
  type MarketingData,          // ❌ Unused (removed getMachineEventForPhase used it)
  type BusinessType,
  type TargetMarket,
  type OnboardingMachineEvent, // ❌ Unused (removed getMachineEventForPhase used it)
  DiscoveryDataSchema,
  // ...
} from '@macon/contracts';
import { stateToPhase, isValidTransition } from '../onboarding/state-machine';  // ❌ stateToPhase unused


✅ AFTER: Only import what's used
────────────────────────────────────────────────────────────
import {
  type DiscoveryData,
  type MarketResearchData,
  type ServicesData,
  // Removed: MarketingData (no longer used)
  type BusinessType,
  type TargetMarket,
  type OnboardingEventType,    // ✅ Still used (added here because it's now needed)
  DiscoveryDataSchema,
  // ...
} from '@macon/contracts';
import { isValidTransition } from '../onboarding/state-machine';  // ✅ Keep only what's called
// Removed: stateToPhase (not called anywhere)
```

---

## Special Case: `import type` vs `import` Decision Table

| Situation                     | Import Statement | Example                            |
| ----------------------------- | ---------------- | ---------------------------------- |
| Used only in type annotations | `import type`    | `const x: SomeType = ...;`         |
| Called as function            | `import`         | `const result = someFunction();`   |
| Accessed as property          | `import`         | `const val = SomeModule.constant;` |
| Used in typeof                | `import type`    | `type X = typeof something;`       |
| Used in instanceof            | `import`         | `if (x instanceof Class)`          |
| Both type AND value           | `import`         | Must be value if any runtime usage |
| Never used                    | Delete           | Save bytes and clarity             |

---

## Summary: All 25 Violations Fixed

| Type                     | Count | Tool          | Fix                       |
| ------------------------ | ----- | ------------- | ------------------------- |
| P1: Missing type imports | 1     | TypeScript    | Add to `import type`      |
| P2: Dead functions       | 2     | Manual review | Delete entirely           |
| P2: Unused queries       | 1     | Manual review | Delete entirely           |
| P3: Mixed imports        | 8     | Manual + lint | Separate type/value       |
| P3: Case scope           | 2     | ESLint        | Add braces                |
| P3: Unused variables     | 1     | ESLint        | Prefix with `_` or delete |
| P3: Unused types         | 3     | ESLint        | Remove from import        |
| P3: Unused constants     | 1     | ESLint        | Remove from import        |
| P3: Unused imports       | 6     | ESLint        | Delete import line        |

**Total: 25 violations → 0 violations (12 files)**

---

## How to Apply These Patterns

### For Your Own Code

When you write a function:

1. Don't write "for future use" code
2. If logic moves elsewhere, grep for old callers and delete them
3. Keep imports grouped: `import type { ... }` then `import { ... }`
4. If you have switch cases with variable declarations, add braces immediately

### During Code Review

Red flags that match these patterns:

- [ ] Function with 0 grep results → Request deletion
- [ ] Database query result unused → Request deletion
- [ ] Helper function marked "for future use" → Request deletion
- [ ] Mixed `import type` and `import` → Request separation
- [ ] Switch case with variable, no braces → Request braces
- [ ] Unused import visible → Request removal

### In CI/CD Pipeline

```bash
# Your pre-commit hook or CI should run:
npm run lint           # ESLint catches style and unused imports
npm run typecheck      # TypeScript catches missing type imports
npm test               # Verify no regressions
```

---

## Quick Copy-Paste Fixes

### Add Type Import

```typescript
// If you see: TS2304: Cannot find name 'X'
// ADD THIS LINE:
import type { X } from './module';
```

### Add Switch Case Braces

```typescript
// Find:
case 'LABEL':
  const x = ...;

// Replace with:
case 'LABEL': {
  const x = ...;
  break;
}
```

### Clean Up Unused Import

```typescript
// Find:
import { x, y, _unusedZ } from './module';

// Replace with:
import { x, y } from './module';
```

---

## Reference

**Commit:** `764b9132`
**Full Document:** `lint-fixes-multi-agent-review-compound-MAIS-20260105.md`
**Quick Reference:** `LINT_FIXES_QUICK_REFERENCE.md`
