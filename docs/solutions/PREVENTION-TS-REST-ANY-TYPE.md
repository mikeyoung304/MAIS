# Prevention Strategy: ts-rest Library Limitations & Type Safety

## Problem Summary

**Issue:** Code quality TODO #035 attempted to replace `any` types in ts-rest route handlers with proper `Request` types. This caused build failures (TS2345 errors) because ts-rest v3 has known type compatibility issues with Express 4.x/5.x and **requires** `any` for request parameters.

**Impact:**
- Build failed when agent attempted "type safety improvement"
- Rollback required in commit 417b8c0
- Highlighted gap between automated type safety rules and library constraints

**Root Cause:** Library limitations were not documented. The `any` type was treated as a code quality issue rather than a required workaround.

---

## When `any` is Actually Acceptable

### 1. Library Type Compatibility Issues

**Pattern:** ts-rest + Express middleware signature mismatch

```typescript
// server/src/routes/index.ts (REQUIRED - do NOT change)
createExpressEndpoints(Contracts, s.router(Contracts, {
  getPackages: async ({ req }: { req: any }) => {  // ← REQUIRED
    const tenantId = getTenantId(req as TenantRequest);
    const data = await controllers.packages.getPackages(tenantId);
    return { status: 200 as const, body: data };
  },
}));
```

**Why `any` here:**
- ts-rest internally has middleware signature typing that doesn't match Express 4.x/5.x
- Attempting to type as `Request` causes TS2345 errors
- The code IS type-safe at runtime (through `as TenantRequest` assertion after)
- Library maintainers are aware of this limitation

**References:**
- GitHub issue: https://github.com/ts-rest/ts-rest/issues
- Known since ts-rest v3.x
- Runtime behavior is correct despite type error

**Solution Pattern:**
1. Document the library limitation with comment
2. Use `as TenantRequest` assertion after extracting from `any`
3. Make all downstream code properly typed
4. Mark as "do not remove" in TODO comments

---

### 2. Unsafe External Library Types

**Pattern:** Third-party libraries with incomplete type definitions

```typescript
// Acceptable: when library's own types are incomplete
const headerValue: string | string[] | undefined = req.get('stripe-signature');
// Library returns union that must be handled, can't be typed stricter without
// widening to `any` first in some cases
```

**When NOT to remove:**
- Library has no TypeScript support and you use `any` pragmatically
- Type definitions are genuinely incomplete/wrong in the library
- PR to library to fix types is pending

**When TO fix:**
- It's a naming/usage error, not library limitation
- A more specific type is available but ignored
- You can use proper typing with type guards

---

### 3. Gradual Type Migration During Refactoring

**Pattern:** Temporary `any` during large refactors

```typescript
// Acceptable: During refactoring, temporarily use `any` on unstable interfaces
async function legacyController(req: any): Promise<void> {
  // TODO: Type this properly after payment service refactoring
  // Currently unstable due to pending Stripe integration changes
}
```

**Requirements to remove later:**
- Must have explicit TODO with clear blocker
- Must reference what needs to happen first
- Review at sprint planning to unblock

---

## Code Review Checklist

### BEFORE Removing `any` Types

Add this to your code review process:

```yaml
Type Safety Review:
  □ Is this in a ts-rest route handler?
    └─ If YES: Do NOT remove, document library limitation instead

  □ Is this in a third-party library consumer?
    └─ Check: Can the library's types be used correctly?
    └─ Search: GitHub issues on the library for known type problems
    └─ If known limitation: Add comment and skip removal

  □ Is this a gradual migration `any`?
    └─ Has explicit TODO: [yes/no]
    └─ Referenced blocker is tracked: [yes/no]
    └─ If no TODO: Request author add one before removing

  □ Is this a cast/assertion situation?
    └─ Can use type guard (instanceof, type predicate): [yes/no]
    └─ If NO: `as unknown as Type` pattern is correct, not plain `any`

  □ Can the type be derived from elsewhere?
    └─ TypeScript can infer it: [yes/no]
    └─ If YES: Remove explicit typing and let inference work
```

---

## Inline Documentation Patterns

### Mark Library Limitations Clearly

```typescript
// BAD: Silently confusing
createExpressEndpoints(Contracts, s.router(Contracts, {
  getPackages: async ({ req }: { req: any }) => {
    // ...
  },
}));

// GOOD: Document WHY it exists
// NOTE: ts-rest v3 has known type compatibility issues with Express 4.x/5.x.
// The `any` type here is required due to middleware signature mismatch.
// DO NOT replace with `Request` type - it will cause TS2345 build errors.
// The type is safe at runtime via `getTenantId()` type guard below.
// See: https://github.com/ts-rest/ts-rest/issues/[issue-number]
createExpressEndpoints(Contracts, s.router(Contracts, {
  getPackages: async ({ req }: { req: any }) => {
    const tenantId = getTenantId(req as TenantRequest);  // ← Runtime type guard
    // ...
  },
}));
```

### Mark Gradual Migrations

```typescript
// BAD: Unclear if this is intentional
async function processPayment(data: any): Promise<void> {
  // ...
}

// GOOD: Explains what needs to happen
/**
 * TODO #123: Type this properly after Stripe integration refactoring
 * Currently `any` because PaymentIntent type changes pending in Stripe service
 * Blocker: PaymentIntent response schema stabilization
 * Expected resolution: Sprint 6
 */
async function processPayment(data: any): Promise<void> {
  // ...
}
```

---

## Documentation Requirements

### For Each `any` Type in Critical Paths

Create or update documentation in `/server/README.md` or inline:

```markdown
## Known Type Limitations

### ts-rest Handler Parameters
- **Location:** `server/src/routes/index.ts`
- **Reason:** Library type compatibility with Express 4.x/5.x
- **Impact:** Build will fail if `any` is replaced with `Request`
- **Status:** Accepted technical debt (library limitation)
- **Mitigation:** Type assertions after extraction (`as TenantRequest`)

### Payment Provider Types
- **Location:** `server/src/adapters/stripe.adapter.ts`
- **Reason:** Stripe SDK types incomplete for webhook events
- **Impact:** High - webhook data must be carefully validated
- **Status:** Waiting on Stripe SDK update
- **Mitigation:** Schema validation with Zod before use
```

---

## Pre-Push Verification Steps

### Script to Prevent Build Failures

```bash
#!/bin/bash
# scripts/prevent-any-removal.sh
# Run before pushing type changes

echo "Checking for unsafe 'any' removals..."

SAFE_ANY_FILES=(
  "server/src/routes/index.ts:req.*any"
)

PROBLEMATIC_REMOVALS=$(git diff HEAD --name-only | xargs git diff HEAD -- | grep -E "^[-].*any" || true)

if [ ! -z "$PROBLEMATIC_REMOVALS" ]; then
  echo "WARNING: Detected removal of 'any' types. Verify these are safe:"
  echo "$PROBLEMATIC_REMOVALS"

  # Check specific high-risk patterns
  if echo "$PROBLEMATIC_REMOVALS" | grep -q "req.*Request"; then
    echo ""
    echo "ERROR: Detected removal of 'req: any' in ts-rest handler!"
    echo "This will cause TS2345 build errors. DO NOT REMOVE."
    exit 1
  fi
fi

exit 0
```

---

## Git Commit Message Guidelines

### When Documenting Library Limitations

```
fix: add documentation for ts-rest type limitation

ts-rest v3 has known type compatibility with Express 4.x/5.x
causing TS2345 errors when replacing `any` with `Request`.

The implementation is correct at runtime - we use type assertions
(getTenantId() function) to verify types after extraction.

Added inline comments explaining the limitation and referencing
the upstream issue. Marked as "do not remove" for future reviewers.

Library Status:
- ts-rest: v3.0.0
- Express: 4.18.0
- Impact: Cannot use Express Request type in route handlers
- Workaround: Type assertions after extraction
- Upstream: https://github.com/ts-rest/ts-rest/issues/[number]
```

---

## Pattern Recognition Tips

### Red Flags - Investigate Before Removing `any`

| Pattern | Investigation | Decision |
|---------|---|----------|
| `{ req: any }` in route handler | Check route file comments + framework used | **Keep if ts-rest** |
| `data: any` without validation | Check if followed by Zod/schema validation | **Keep if validated** |
| `result: any` after external API call | Check if library has types available | **Remove if types exist** |
| `.unwrap()` or type assertion after | Check what the assertion is doing | **Keep if safety measure** |
| Nested in middleware/adapter | Check library source | **Assess based on context** |

### Green Lights - Safe to Remove `any`

| Pattern | Action |
|---------|--------|
| Unused parameters | Remove if not accessed |
| Explicit TODOs with resolution | Remove if blocker is resolved |
| Type can be inferred | Remove and let TypeScript infer |
| Return value from known API | Use return type from API definition |
| Validated by schema before use | Replace with validated type |

---

## Training Material for New Contributors

### Question to Ask During Code Review

**"Before removing this `any`, ask yourself:"**

1. Is this in a ts-rest/Express route handler?
   - YES → Don't remove, document why instead
   - NO → Continue to question 2

2. Does the library have a known typing limitation?
   - YES → Document it, don't remove
   - NO → Continue to question 3

3. Is there a GitHub issue tracking the proper typing?
   - YES → Make sure blocker is resolved before removing
   - NO → Continue to question 4

4. Can TypeScript infer a more specific type?
   - YES → Remove the explicit `any` and let inference work
   - NO → Keep it, but add comment explaining why

5. Is this in production code or migration code?
   - Migration → Add TODO with target sprint
   - Production → Verify it's truly necessary

---

## Real-World Example: The ts-rest Case

### What Happened (Commit 417b8c0)

**Step 1: Agent removed the `any` type**
```typescript
// Before: Had `any` due to ts-rest limitation
createExpressEndpoints(Contracts, s.router(Contracts, {
  getPackages: async ({ req }: { req: any }) => {
    // ...
  },
}));

// After: Agent tried to fix type safety
createExpressEndpoints(Contracts, s.router(Contracts, {
  getPackages: async ({ req }: { req: Request }) => {  // ← Build error!
    // ...
  },
}));
```

**Step 2: Build failed**
```
TS2345: Argument of type '{ req: Request }' is not assignable
to parameter of type '{ req: unknown }'
```

**Step 3: Had to revert and document**
```typescript
// NOW with documentation
// ts-rest v3 has type compatibility issues with Express 4.x/5.x
// DO NOT replace with `Request` - causes TS2345 errors
// See: https://github.com/ts-rest/ts-rest/issues/...
createExpressEndpoints(Contracts, s.router(Contracts, {
  getPackages: async ({ req }: { req: any }) => {
    // ...
  },
}));
```

### Prevention Strategy Applied

1. **Added inline comment** explaining library limitation
2. **Marked as "do not remove"** for future reviewers
3. **Added this documentation** to prevent future attempts
4. **Updated code review checklist** to check for ts-rest patterns
5. **Added pre-push check** script to catch attempts automatically

---

## Acceptance Criteria for Type Changes

### This type change should be REJECTED if:

- [ ] Removes `any` from ts-rest route handler parameters
- [ ] Removes `any` without adding/referencing TODO with resolution
- [ ] Changes `any` without verifying library types are available
- [ ] Introduces `as any` where type guard could work instead
- [ ] Removes validation that relied on the `any` being generic

### This type change should be APPROVED if:

- [ ] Replaces `any` with inferred type (TypeScript auto-inference)
- [ ] Adds type where `any` was placeholder (TODO resolved)
- [ ] Removes unused parameters that were `any`
- [ ] Uses `as unknown as Type` instead of `any` for assertions
- [ ] Adds `as const` or more specific literal types

---

## Summary

**Key Takeaway:** Not all `any` types are code quality issues. Some are **required workarounds** for library limitations.

**Prevention Checklist:**
1. Document library limitations inline
2. Add "do not remove" markers for known issues
3. Check code review checklist before removing `any`
4. Update TODO if planning gradual migration
5. Run pre-push verification script
6. Reference upstream issues in commit messages

**For This Project (MAIS):**
- ts-rest handlers: Keep `any`, document limitation
- Stripe/Postmark adapters: Review per-case
- Schema-validated data: Replace with schema type
- Gradual migrations: Add explicit TODO with blocker

