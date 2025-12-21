---
status: resolved
priority: p1
issue_id: "296"
tags: [code-review, architecture, simplification, early-access]
dependencies: []
resolved_at: 2025-12-06
resolution: "Removed api.requestEarlyAccess wrapper from api.ts, updated WaitlistCTASection.tsx to call ts-rest contract directly with proper type inference"
---

# Unnecessary Client Wrapper Defeats Type Safety

## Problem Statement

The `api.requestEarlyAccess` method in `client/src/lib/api.ts` wraps the ts-rest contract call with type casts that defeat the purpose of type-safe contracts.

**Why it matters:** The wrapper adds cognitive overhead, creates a false sense of type safety, and requires manual type maintenance. It should either use ts-rest directly or be removed.

## Findings

**File:** `client/src/lib/api.ts` (lines 222-232)

```typescript
api.requestEarlyAccess = async (email: string) => {
  // Use the type-safe contract endpoint
  const result = await (api as ReturnType<typeof initClient>).requestEarlyAccess({
    body: { email },
  });

  return {
    status: result.status,
    body: result.body as { message: string } | { error: string } | null,  // TYPE CAST!
  };
};
```

**Problems:**
1. `as ReturnType<typeof initClient>` type cast bypasses TypeScript checking
2. `as { message: string } | { error: string } | null` - manual type loses Zod inference
3. Wrapper adds no value - just passes through the ts-rest call
4. Creates 2 layers where 1 would suffice

## Proposed Solutions

### Option A: Remove Wrapper, Call Contract Directly (Recommended)
**Pros:** Simplest, uses ts-rest type inference
**Cons:** Requires updating calling code
**Effort:** Small (30 min)
**Risk:** Low

```typescript
// In WaitlistCTASection.tsx:
const result = await api.requestEarlyAccess({ body: { email } });
if (result.status === 200) {
  setSubmitted(true);
} else if (result.status === 429) {
  setError('Too many requests...');
}
// Types are inferred from contract
```

### Option B: Fix Wrapper Types with Proper Inference
**Pros:** Keeps API surface consistent
**Cons:** Still an unnecessary layer
**Effort:** Small (15 min)
**Risk:** Low

```typescript
api.requestEarlyAccess = async (email: string) => {
  return api.requestEarlyAccess({ body: { email } });
  // Let ts-rest handle return type inference
};
```

## Recommended Action

Implement Option A - remove wrapper entirely, update component to call contract directly.

## Technical Details

**Affected files:**
- `client/src/lib/api.ts` (lines 218-232)
- `client/src/pages/Home/WaitlistCTASection.tsx` (line 26)

## Acceptance Criteria

- [x] Remove `api.requestEarlyAccess` wrapper method
- [x] Update WaitlistCTASection to call contract directly
- [x] Types properly inferred from ts-rest contract
- [x] No unnecessary type casts
- [x] Component still works correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-06 | Created from code review | Simplicity-reviewer identified unnecessary abstraction |

## Resources

- Commit: b787c49
- Pattern: Other endpoints like `api.catalog.getPackages()` call contracts directly
