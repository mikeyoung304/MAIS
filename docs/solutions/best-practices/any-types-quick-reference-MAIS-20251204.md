---
module: MAIS
date: 2025-12-04
problem_type: best_practice
component: server/routes
symptoms:
  - Developer attempts to remove `any` from ts-rest handlers
  - TypeScript build fails with TS2345 errors in routes
  - Type safety concerns about `{ req: any }` pattern
  - Uncertainty about when `any` is acceptable vs code smell
root_cause: ts-rest v3 has type compatibility issues with Express 4.x/5.x
resolution_type: reference_doc
severity: P3
related_files:
  - server/src/routes/index.ts
  - docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md
tags: [typescript, any-type, ts-rest, library-limitations, quick-reference]
---

# Quick Reference: When NOT to Remove `any` Types

## TL;DR: Library Limitations Always Win

**Rule:** If removing `any` breaks the build, it's a library limitation, not a code quality issue.

---

## Checklist: Is This `any` Safe to Remove?

```
❌ In ts-rest route handler ({ req: any })
   → BUILD FAILURE: Don't remove

❌ In third-party library consumer without type definitions
   → Library constraint: Keep, document why

❌ Explicitly blocking something (before a type assertion)
   → Safety measure: Keep

✅ In inference position (TypeScript can infer it)
   → Remove it, let TS infer

✅ In TODO marked for completion
   → Remove if blocker is resolved

✅ After Zod schema validation
   → Replace with validated type
```

---

## This Project: Known Limitations

### ts-rest Handlers (DO NOT REMOVE)

**Files:**

- `server/src/routes/index.ts` - All route handlers

**Pattern:**

```typescript
// ❌ DON'T CHANGE THIS
const getPackages: async ({ req }: { req: any }) => {
```

**Why:** ts-rest v3 incompatible with Express 4.x/5.x types

**Workaround:** Type after extraction

```typescript
const tenantId = getTenantId(req as TenantRequest); // ← This asserts the type
```

---

## Decision Tree: 30 Seconds

```
Found an `any` type?

├─ Is it in routes/index.ts or ts-rest handler?
│  └─ YES → STOP. Don't remove it. Add comment instead.
│
├─ Does the file import from @ts-rest?
│  └─ YES → Check if library type, if YES → Don't remove.
│
├─ Can TypeScript infer a better type?
│  └─ YES → Remove the explicit `any`, let TS infer.
│
├─ Is it followed by a schema validation (Zod)?
│  └─ YES → Remove and use validated type.
│
├─ Is there a TODO comment explaining it?
│  └─ YES → Only remove if TODO is resolved.
│
└─ Otherwise
   └─ Probably safe to remove. Check git history first.
```

---

## Code Review Comments to Use

### When Someone Tries to Remove ts-rest `any`

```
Request changes: Please don't remove this `any`.

This is in a ts-rest route handler, which has known type
compatibility issues with Express 4.x/5.x. Removing it will
cause TS2345 build errors.

Instead:
1. Leave the `any` as-is
2. Add a comment explaining the library limitation
3. Reference: github.com/ts-rest/ts-rest/issues/...

The type safety is ensured by the getTenantId() function below,
which asserts the proper type at runtime.
```

### When It's Safely Removable

```
Approved: This `any` is safely removable because:
- [ ] Type can be inferred by TypeScript
- [ ] Schema validation happens before use
- [ ] TODO blocker is resolved
- [ ] Not in a library compatibility issue

Suggestion: Remove the explicit type and let TS infer it.
```

---

## Pre-Commit Check

Run before pushing type changes:

```bash
# Check for ts-rest `any` removals
git diff HEAD -- server/src/routes/index.ts | grep "^-.*{ req: any"
# If matches found, STOP and revert

# Check build still passes
npm run typecheck
# If fails with TS2345 in routes/index.ts, revert the change
```

---

## Files That Are Safe to Type

| File                         | Status                           | Action          |
| ---------------------------- | -------------------------------- | --------------- |
| `routes/index.ts`            | ❌ DO NOT CHANGE `req` parameter | Keep `any`      |
| `adapters/stripe.adapter.ts` | ✅ Review each case              | Usually fixable |
| `services/*.ts`              | ✅ Safe to improve               | Remove `any`    |
| `lib/*.ts`                   | ✅ Safe to improve               | Remove `any`    |

---

## Gradual Migration Pattern

If you want to improve types over time:

```typescript
/**
 * TODO #XXX: Type this properly when Stripe SDK is updated
 * Currently `any` because Stripe types are incomplete for webhooks
 *
 * Current state: Validates with Zod before use (safe)
 * Target state: Stripe SDK provides proper types
 * Status: Waiting on Stripe SDK v25.0
 */
async function handleWebhook(event: any): Promise<void> {
  // Schema validation ensures safety
  const validEvent = WebhookEventSchema.parse(event);
  // Now it's properly typed
}
```

---

## The Bottom Line

**If the build breaks when you remove `any`, put it back and document why.**

That's the signal that it's a library limitation, not a code quality issue.
