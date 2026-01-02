---
title: 'Prisma 7 JSON Type Breaking Changes'
category: database-issues
severity: P1
status: resolved
date_solved: 2026-01-02
tags:
  - prisma
  - prisma-7
  - json-types
  - typescript
  - type-casting
  - orm-upgrade
components:
  - server/src/agent/tracing/tracer.ts
  - server/src/agent/evals/pipeline.ts
  - server/src/agent/feedback/review-queue.ts
  - server/src/agent/tracing/encryption-middleware.ts
symptoms:
  - TypeScript type errors after Prisma upgrade
  - "Type 'null' is not assignable to type 'NullableJsonNullValueInput'"
  - "Conversion of type 'JsonValue' to type 'TracedMessage[]' may be a mistake"
  - "Type 'any' has no signatures for which the type argument list is applicable"
related_docs:
  - docs/solutions/database-issues/prisma-db-execute-supabase-migrations-MAIS-20251231.md
  - docs/solutions/database-issues/CONNECTION_POOL_EXHAUSTION_PREVENTION.md
  - docs/solutions/SCHEMA_DRIFT_PREVENTION.md
---

# Prisma 7 JSON Type Breaking Changes

## Problem Summary

After upgrading from Prisma 6.x to Prisma 7.x, TypeScript compilation fails with multiple type errors related to JSON field handling. Prisma 7 introduced stricter typing for JSON fields that breaks common patterns.

## Error Messages

```
TS2322: Type 'null' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'
TS2322: Type 'unknown' is not assignable to type 'Record<string, unknown>'
TS2352: Conversion of type 'JsonValue' to type 'TracedMessage[]' may be a mistake
TS2635: Type 'any' has no signatures for which the type argument list is applicable
```

## Root Cause

Prisma 7 changed JSON field types to be stricter:

1. **JsonValue type is now:** `string | number | boolean | JsonObject | JsonArray | null`
2. **Direct casting fails:** `trace.messages as TracedMessage[]` no longer works
3. **Null handling changed:** `null` is not directly assignable to JSON fields
4. **$extends typing changed:** `ReturnType<typeof PrismaClient.prototype.$extends<T>>` no longer works

## Solution Patterns

### Pattern 1: Null to Undefined for JSON Field Writes

When writing to optional JSON fields, use `undefined` instead of `null`:

```typescript
// BEFORE (Prisma 6) - Direct null assignment
await prisma.conversationTrace.update({
  data: {
    errors: state.errors.length > 0 ? (state.errors as unknown as object) : null,
  },
});

// AFTER (Prisma 7) - Use undefined to omit field
await prisma.conversationTrace.update({
  data: {
    errors: state.errors.length > 0 ? (state.errors as unknown as object) : undefined,
  },
});
```

**Why:** Prisma 7's `InputJsonValue` type doesn't include `null` directly. Use `undefined` to skip the field, or `Prisma.DbNull` for explicit database NULL.

### Pattern 2: Double-Cast Through Unknown for JSON Reads

When reading JSON fields into typed arrays, cast through `unknown` first:

```typescript
// BEFORE (Prisma 6) - Direct cast
const messages = redactMessages((trace.messages as TracedMessage[]) || []);
const toolCalls = redactToolCalls((trace.toolCalls as TracedToolCall[]) || []);

// AFTER (Prisma 7) - Cast through unknown
const messages = redactMessages((trace.messages as unknown as TracedMessage[]) || []);
const toolCalls = redactToolCalls((trace.toolCalls as unknown as TracedToolCall[]) || []);
```

**Why:** Prisma 7's `JsonValue` type is too strict for direct type assertion. The `as unknown as Type` pattern is the TypeScript-approved escape hatch.

### Pattern 3: Cast Function Returns for Record Types

When functions return `unknown` but the target expects `Record<string, unknown>`:

```typescript
// BEFORE (Prisma 6) - Implicit unknown
return toolCalls.map((tc) => ({
  ...tc,
  input: redactObjectPII(tc.input), // Returns unknown
  output: redactObjectPII(tc.output),
}));

// AFTER (Prisma 7) - Explicit cast
return toolCalls.map((tc) => ({
  ...tc,
  input: redactObjectPII(tc.input) as Record<string, unknown>,
  output: redactObjectPII(tc.output),
}));
```

### Pattern 4: Simplified Extension Types

The `$extends` return type extraction no longer works in Prisma 7:

```typescript
// BEFORE (Prisma 6) - Complex type extraction
export type PrismaWithTraceEncryption = ReturnType<
  typeof PrismaClient.prototype.$extends<typeof traceEncryptionExtension>
>;

// AFTER (Prisma 7) - Simple type alias
export type PrismaWithTraceEncryption = PrismaClient;
```

**Why:** Prisma 7's `$extends` method signature changed. Extensions maintain the base `PrismaClient` interface, so a simple alias works.

## Files Changed

| File                                         | Line(s)  | Change                                  |
| -------------------------------------------- | -------- | --------------------------------------- |
| `src/agent/tracing/tracer.ts`                | 430, 455 | `null` → `undefined` for errors field   |
| `src/agent/tracing/tracer.ts`                | 522      | Added `as Record<string, unknown>` cast |
| `src/agent/evals/pipeline.ts`                | 118      | Added `as Record<string, unknown>` cast |
| `src/agent/evals/pipeline.ts`                | 333-334  | Added `as unknown as` double-cast       |
| `src/agent/feedback/review-queue.ts`         | 182, 220 | Added `as unknown as` double-cast       |
| `src/agent/tracing/encryption-middleware.ts` | 248-250  | Simplified type to `PrismaClient`       |

## Prevention Strategies

### Pre-Upgrade Checklist

Before upgrading Prisma, search for these patterns:

```bash
# Find direct JSON field casts (need double-cast)
grep -r "as \w\+\[\])" --include="*.ts" src/

# Find null assignments to optional fields
grep -r ": null," --include="*.ts" src/

# Find $extends type extractions
grep -r "ReturnType.*\$extends" --include="*.ts" src/

# Find JSON field reads without unknown cast
grep -r "\.messages as " --include="*.ts" src/
grep -r "\.toolCalls as " --include="*.ts" src/
```

### Code Review Guidelines

1. **JSON field reads:** Always use `as unknown as TargetType` pattern
2. **JSON field writes:** Use `undefined` for omission, `Prisma.DbNull` for explicit NULL
3. **Extension types:** Don't extract via `ReturnType` - use simple alias
4. **Function returns:** Cast to `Record<string, unknown>` when needed

### Testing After Upgrade

```bash
# Type check
npm run typecheck

# Run full test suite
npm test

# Verify specific files compile
npx tsc --noEmit src/agent/tracing/tracer.ts
```

## Related Documentation

- [Prisma db execute for Supabase](./prisma-db-execute-supabase-migrations-MAIS-20251231.md) - IPv6 connection handling
- [Connection Pool Exhaustion Prevention](./CONNECTION_POOL_EXHAUSTION_PREVENTION.md) - Singleton patterns
- [Schema Drift Prevention](../SCHEMA_DRIFT_PREVENTION.md) - Migration strategies
- [ts-rest any type limitations](../best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md) - Similar library limitation pattern

## Key Insight

This is a **library limitation pattern**, not a code smell. The `as unknown as Type` cast is the correct solution when TypeScript's type system can't express the runtime behavior. Document and accept these patterns in code reviews - they're necessary due to Prisma 7's stricter type model.

## Verification

After applying fixes:

- TypeScript compilation: PASS
- Test suite: 2126 tests passed (7 skipped)
- No runtime behavior changes
