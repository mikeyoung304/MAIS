---
status: complete
priority: p3
issue_id: '637'
tags: [code-review, typescript, type-safety, agent-executors]
dependencies: []
---

# Executor Uses Unsafe Type Assertion for Payload

## Problem Statement

The `upsert_package` executor casts `payload` with a type assertion instead of using Zod validation.

**Why it matters:**

- Type assertions bypass type checking
- If tool schema changes but executor type isn't updated, runtime errors occur
- No runtime validation of payload structure

## Findings

### Evidence from TypeScript Reviewer

"The executor casts `payload` with a type assertion... Type assertions bypass type checking. If the tool schema changes but the executor type isn't updated, runtime errors occur."

**Location:** `server/src/agent/executors/index.ts` (lines 43-69)

```typescript
registerProposalExecutor('upsert_package', async (tenantId, payload) => {
  const {
    packageId,
    slug,
    title,
    name,
    // ...
  } = payload as {  // ❌ Type assertion
    packageId?: string;
    slug?: string;
    // ...
  };
```

### Better Pattern (from other executors)

Other executors use Zod schemas in `executor-schemas.ts`:

```typescript
import { UpsertPackagePayloadSchema } from '../proposals/executor-schemas';

registerProposalExecutor('upsert_package', async (tenantId, payload) => {
  const validated = UpsertPackagePayloadSchema.parse(payload);
  // validated is now properly typed
});
```

## Proposed Solutions

### Option A: Add Zod Schema (Recommended)

**Pros:** Type-safe, runtime validation, matches other executors
**Cons:** Need to maintain schema
**Effort:** Small
**Risk:** Low

### Option B: Use Type Guard

**Pros:** Simpler than Zod
**Cons:** More manual, less comprehensive
**Effort:** Small
**Risk:** Low

## Recommended Action

**APPROVED** - Option A (Add Zod schema for executor payload)

Rationale: Type safety gap. Type assertions bypass compile-time checks. If tool schema changes, runtime errors occur. Small fix with clear benefit.

## Technical Details

**Affected Files:**

- `server/src/agent/proposals/executor-schemas.ts` - Add schema
- `server/src/agent/executors/index.ts` - Use schema

## Acceptance Criteria

- [x] Add `UpsertPackagePayloadSchema` to executor-schemas.ts
- [x] Replace type assertion with `.parse()` validation
- [x] Remove inline type definition
- [x] Existing tests pass

## Work Log

| Date       | Action                          | Learnings                      |
| ---------- | ------------------------------- | ------------------------------ |
| 2026-01-05 | Created from multi-agent review | TypeScript reviewer flagged P2 |
| 2026-01-10 | **Triage: APPROVED** | Type safety gap. Small fix prevents runtime errors. |
| 2026-01-10 | **COMPLETED** | Added segmentId + groupingOrder to schema, replaced type assertion with Zod .parse() |

## Resources

- Code Review: Tenant Provisioning Integrity PR
- Pattern: executor-schemas.ts
