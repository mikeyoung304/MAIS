# Code Review Checklist: Type Safety & `any` Types

Use this checklist when reviewing pull requests that touch TypeScript types.

---

## Pre-Review Setup

- [ ] Clone PR branch locally
- [ ] Run `npm run typecheck` to see baseline errors (if any)
- [ ] Check git diff for `any` removals: `git diff main...HEAD -- '*.ts' | grep any`
- [ ] Note any files in `routes/` directory

---

## Step 1: Identify Type Changes

```typescript
// Look for these patterns in diff
- any                    // Removed
+ Request | Response     // Added
+ MyType               // Type added where was `any`
```

**Questions to ask:**
- [ ] Are there removals of `any` types?
- [ ] What files contain these changes?
- [ ] Are any in `routes/` or importing `@ts-rest`?

---

## Step 2: For Each `any` Removal

### Is it in a ts-rest Route Handler?

**Check:** File path and imports
```typescript
// These patterns indicate ts-rest
import { createExpressEndpoints } from '@ts-rest/express';
const s.router(Contracts, { ... });
async ({ req }: { req: any })  // ← THIS is ts-rest signature
```

**If YES:**
- [ ] REJECT the change
- [ ] Comment: "This is a ts-rest/Express type compatibility issue. See PREVENTION-TS-REST-ANY-TYPE.md"
- [ ] Point to: `docs/solutions/PREVENTION-TS-REST-ANY-TYPE.md`

**If NO:** Continue to Step 2B

### Is it a Third-Party Library Consumer?

**Check:** Does the value come from external library?
```typescript
// Examples of library consumers
const result = stripe.webhook.constructEvent(req, ...);  // ← Stripe library
const user = await orm.findOne(id);                       // ← ORM library
const response = await fetch(url);                        // ← Fetch API
```

**If YES - Library has types:**
- [ ] APPROVE with suggestion: "Use the library's type instead"
- [ ] Example: `import { WebhookEvent } from 'stripe'`

**If YES - Library has no types:**
- [ ] Check for TODO or explanation comment
- [ ] APPROVE if documented
- [ ] REQUEST CHANGES if not documented

**If NO:** Continue to Step 2C

### Is it Validated by Schema?

**Check:** Is `any` replaced by schema-validated type?
```typescript
// GOOD: Removing `any` and using validated type
- const data: any = req.body;
+ const data = requestSchema.parse(req.body);
+ // Now data is properly typed by Zod
```

**If YES - Replacing with validated type:**
- [ ] APPROVE
- [ ] Verify schema is imported correctly
- [ ] Check Zod parse() is called before using data

**If NO:** Continue to Step 2D

### Is it Inferrable by TypeScript?

**Check:** Can TypeScript infer the type automatically?
```typescript
// GOOD: TS can infer
- const packages: any = await service.getPackages();
+ const packages = await service.getPackages();
// TS infers from service's return type

// GOOD: Literal type
- const status: any = 'ACTIVE';
+ const status = 'ACTIVE' as const;
```

**If YES:**
- [ ] APPROVE
- [ ] Optional: Suggest explicit type if unclear

**If NO:** Continue to Step 2E

### Is it a TODO Marked for Future Work?

**Check:** Is there a comment explaining the `any`?
```typescript
/**
 * TODO #456: Type this after payment service refactoring
 * Currently unstable due to pending changes
 */
const paymentData: any = await stripeService.create(data);
```

**If YES - TODO present and tracked:**
- [ ] APPROVE
- [ ] Verify it's in your TODO tracking system
- [ ] Estimate when it can be resolved

**If YES - TODO present but no tracking:**
- [ ] REQUEST CHANGES
- [ ] Ask author to create issue/TODO
- [ ] Comment: "Please create a tracked TODO for this"

**If NO:** This is unusual, ask author to explain

---

## Step 3: Type Safety Validation

For changes that PASS the above checks:

### Type Correctness

- [ ] Type is accurate for the value
- [ ] Not using overly broad types (`string | number | boolean`)
- [ ] Not using type assertions (`as any`, `!`) where null checks would work
- [ ] Not bypassing validation with `unknown`

### Downstream Consumers

- [ ] All uses of the typed value are compatible
- [ ] No new `any` created by cascading requirement
- [ ] No type narrowing lost

### Runtime Safety

- [ ] Type guard or validation exists if needed
- [ ] Error handling for type mismatches
- [ ] No unsafe casts to `any`

---

## Step 4: Documentation

### Comment Requirements

For approved `any` types:
- [ ] Reason explained in comment
- [ ] Reference to library issue (if applicable)
- [ ] Link to documentation (if applicable)

**Required pattern:**
```typescript
// Reason for `any`
// Reference: [GitHub issue / docs / TODO #XXX]
// Mitigation: [Type guard / validation / future resolution]
const value: any = unsafeSource;
```

### Special Cases

#### ts-rest Handlers
```typescript
// ts-rest v3 has type compatibility issues with Express 4.x/5.x
// DO NOT replace with `Request` type - causes TS2345 build errors
// See: PREVENTION-TS-REST-ANY-TYPE.md
createExpressEndpoints(Contracts, s.router(Contracts, {
  getPackages: async ({ req }: { req: any }) => {
```

#### External Libraries
```typescript
// Stripe SDK lacks proper webhook event types
// Schema-validated with WebhookEventSchema before use
async function handleWebhook(event: any): Promise<void> {
  const validated = WebhookEventSchema.parse(event);
```

#### Gradual Migrations
```typescript
/**
 * TODO #789: Type properly after dependency update
 * Currently `any` because X depends on Y
 * Blocker: Y version 3.0 (expected month Y)
 * Validation: Schema-checked before use
 */
const data: any = await legacyService.getData();
```

---

## Step 5: Testing & Verification

- [ ] Author ran `npm run typecheck` and confirmed passes
- [ ] All tests still pass: `npm test`
- [ ] No new type errors introduced
- [ ] If type guard added, verify it works:
  ```bash
  npm run test -- --grep "type.*guard.*name"
  ```

---

## Step 6: Decision Matrix

Use this to quickly decide on type changes:

| Scenario | Decision | Action |
|----------|----------|--------|
| ts-rest route `req: any` removal | ❌ REJECT | Point to PREVENTION doc |
| Library has types, author missed them | ✅ APPROVE with suggestion | Use library type |
| Library no types, schema validates | ✅ APPROVE | Use validated type |
| No validation, no types, no TODO | ❌ REJECT | Request explanation |
| TODO tracked, resolution in progress | ✅ APPROVE | Accept temporary `any` |
| TS can infer type | ✅ APPROVE | Suggest removing explicit type |
| Type is inferred correctly | ✅ APPROVE | Good removal of `any` |
| Validation with Zod/superstruct | ✅ APPROVE | Proper schema typing |
| Using `as any` to bypass check | ❌ REJECT | Request type guard instead |

---

## Common Comments to Copy

### For ts-rest `any` Removals

```markdown
Please don't remove this `any` type. This is in a ts-rest route handler,
which has known type compatibility issues with Express 4.x/5.x.

Removing it will cause a TS2345 build error:
```
TS2345: Argument of type '{ req: Request }' is not assignable
to parameter of type '{ req: unknown }'
```

Instead:
1. Keep the `any`
2. Add a comment explaining the limitation
3. Reference: `docs/solutions/PREVENTION-TS-REST-ANY-TYPE.md`

The type is safe because the `getTenantId()` function below
properly types the request at runtime.
```

### For Good Type Removals

```markdown
Great type improvement! Since TypeScript can infer the type from
the function's return type, you can safely remove the explicit
typing and let TS infer it. This makes the code cleaner.

The inferred type will be exactly the same as what you specified.
```

### For Undocumented `any`

```markdown
This `any` needs documentation. Please add a comment explaining:
1. Why `any` is used here
2. If it's temporary (TODO for when it can be fixed)
3. Any mitigation (validation, schema checks, etc.)

See `docs/solutions/PREVENTION-TS-REST-ANY-TYPE.md` for examples.
```

### For Missing Schema Validation

```markdown
This `any` value should be validated before use. Consider adding
a Zod schema to ensure type safety:

```typescript
const validated = mySchema.parse(data);
// Now `validated` is properly typed and safe to use
```

Then you can replace the `any` with the schema's inferred type.
```

---

## Expedited Review Guide

**When you see changes to `any` types:**

1. **Check file path** - Is it in `routes/index.ts` or import `@ts-rest`?
   - YES → REJECT, point to docs
   - NO → Continue

2. **Check git history** - Did this `any` have a reason before?
   ```bash
   git log -p -S "the_any_value" -- filename.ts | head -50
   ```

3. **Check imports** - Does it use external library?
   - YES → Verify type exists in library
   - NO → Likely safe removal

4. **Run the build locally**
   ```bash
   npm run typecheck
   ```
   - Errors? → May be library incompatibility, REJECT
   - Success? → Likely safe, APPROVE with verification

---

## Red Flags (Auto-Reject)

- [ ] Removes `any` from ts-rest handlers
- [ ] Replaces `any` with broader type (e.g., `string | any`)
- [ ] Uses `as any` to bypass type check
- [ ] No comment explaining why `any` was in the code
- [ ] Removes validation that relied on the `any` being loose

---

## Green Lights (Auto-Approve)

- [ ] Removes explicit `any` from inference position
- [ ] Replaces `any` with validated type from schema
- [ ] Type is from external library that has types
- [ ] TODO blocker is documented and will be addressed
- [ ] Proper type guard replaces unsafe assertion

---

## References in MAIS Docs

Link reviewers to these docs in comments:
- `docs/solutions/PREVENTION-TS-REST-ANY-TYPE.md` - Full guide
- `docs/solutions/PREVENTION-ANY-TYPES-QUICK-REF.md` - Quick reference
- `docs/solutions/CODE-REVIEW-ANY-TYPE-CHECKLIST.md` - This file

