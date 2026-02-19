---
title: Prisma Json Type Double-Encoding in Seed Files and Cache Staleness
category: database-issues
severity: P1
components:
  - server/prisma/seeds/little-bit-horse-farm.ts
  - apps/web/src/lib/storefront-utils.ts
  - server/src/services/catalog.service.ts
  - server/src/services/section-content.service.ts
symptoms:
  - Storefront page crashes with "Cannot use 'in' operator to search for 'title'" error
  - scalingRules, photos, features fields return as strings instead of objects from API
  - transformContentForSection fails to parse double-encoded JSON
  - In-memory cache serves stale double-encoded data even after database fix
  - 500 error on storefront rendering at /t/littlebit-farm
root_cause: Seed file called JSON.stringify() on objects before passing to Prisma Json columns, which auto-serialize objects, causing double-encoding. In-memory caches perpetuated stale data.
resolution_date: 2026-02-16
tags:
  - prisma
  - json-columns
  - seed-data
  - double-encoding
  - cache-staleness
  - storefront
  - tiers
  - section-content
  - auto-serialization
related_issues: []
---

# Prisma Json Type Double-Encoding in Seed Files + Cache Amplification

## Problem Summary

The littlebit.farm tenant storefront crashed with a 500 error after seeding. Two separate but related bugs manifested:

1. **`SectionContent.content`** — stored as a JSON string instead of a JSON object, crashing `transformContentForSection` which uses `'title' in content`
2. **`Tier.scalingRules/photos/features`** — same double-encoding issue, causing tier cards to display raw strings instead of structured pricing data

Both bugs were amplified by in-memory caches that served stale double-encoded data even after the database was corrected.

## Root Cause Analysis

Prisma's `Json` column type automatically serializes values to JSON strings when writing to PostgreSQL's `jsonb` columns. When developers manually call `JSON.stringify()` on data destined for a `Json` column, the value gets double-encoded:

```
Input:                { title: "Hello" }
Your code:            JSON.stringify(input) → '{"title":"Hello"}'
Prisma auto-calls:    JSON.stringify(result) → '"{\\"title\\":\\"Hello\\"}"'
Database stores:      A JSON string value (not an object)
API returns to client: '{"title":"Hello"}' (a string, not { title: "Hello" })
Frontend crashes:     'title' in stringValue → TypeError: Cannot use 'in' operator
```

This pattern is especially dangerous because:

1. **Silent failure in development:** The data looks correct in database viewers (Prisma Studio shows parsed JSON)
2. **Type system doesn't help:** TypeScript can't distinguish between "Prisma will stringify" and "I pre-stringified"
3. **Cache amplifies the problem:** In-memory caches preserve the bad data even after the database is corrected

## Investigation Timeline

1. **Bug report:** Storefront at `/t/littlebit-farm` crashed with `Cannot use 'in' operator to search for 'title'` in `transformContentForSection` (`storefront-utils.ts:48`)

2. **First investigation — database check:** Suspected corrupted database. Ran tsx script querying `SectionContent` directly — found correct JSON objects in PostgreSQL. Database was fine.

3. **Second investigation — API layer:** Traced API response path through `public-tenant.routes.ts:293` and `section-content.repository.ts` — all passing data through as-is, no transforms. Code was fine.

4. **Root cause found — stale cache:** In-memory cache in `SectionContentService.publishedCache` was serving stale double-encoded data from an old seed run. The original seed had wrapped every `Json` column value with `JSON.stringify()`, causing double-encoding. Re-seeding with correct data didn't clear the cache.

5. **Temporary fix:** Restarted API server to clear in-memory caches. Storefront rendered correctly.

6. **Second bug discovered:** `/v1/tiers` endpoint also returned `scalingRules` as a string instead of an object — same root cause in the seed file. Additionally, `CatalogService.getAllTiers()` caches results for 900 seconds, so even after re-seeding, the broken data persisted for 15 minutes.

## Solution

### Fix 1: Seed File (`server/prisma/seeds/little-bit-horse-farm.ts`)

Remove `JSON.stringify()` from all `Json` type fields. Prisma handles serialization automatically.

**Before (WRONG):**

```typescript
scalingRules: scalingRules ? JSON.stringify(scalingRules) : undefined,
photos: JSON.stringify(photos),
features: JSON.stringify(features),
```

**After (CORRECT):**

```typescript
scalingRules: scalingRules ?? undefined,
photos,
features,
```

### Fix 2: Test File (`server/test/seeds/little-bit-horse-farm-seed.test.ts`)

Remove `JSON.parse()` calls since Prisma now returns plain objects instead of strings.

**Before (WRONG):**

```typescript
const celebrationRules = JSON.parse(celebration![0].create.scalingRules);
```

**After (CORRECT):**

```typescript
const celebrationRules = celebration![0].create.scalingRules;
```

### Fix 3: Cache Management

After re-seeding, restart the API server to clear:

- `SectionContentService.publishedCache` — in-memory Map, no TTL
- `CatalogService.getAllTiers()` — `cachedOperation` with 900-second TTL

## Prevention Strategies

### Code Review Checklist

When reviewing any code that writes to Prisma `Json` columns:

- [ ] **No pre-stringification** — Values assigned to `Json` columns must be native objects/arrays, NOT `JSON.stringify()` results
- [ ] **Check seed/migration files** — Data loaders are the most common violation point
- [ ] **Type safety via `satisfies`** — Use `satisfies Prisma.InputJsonValue` for compile-time safety
- [ ] **API response validation** — After reading from database, verify `typeof response.jsonField === 'object'`
- [ ] **Post-seed verification** — After running seeds, verify API returns objects not strings

### Detection: Grep Patterns

```bash
# Find JSON.stringify near Prisma writes in seed files
grep -rn "JSON.stringify" server/prisma/seeds/

# Find JSON.parse on Prisma responses (compensating for double-encoding)
grep -rn "JSON.parse" --include="*.ts" server/src/ | \
  grep -v "parse.*error\|parse.*request\|parse.*body"

# Verify no double-encoding in database
# psql $DATABASE_URL -c "SELECT content FROM section_content LIMIT 1;" | grep '\\"'
```

### Test Pattern: Round-Trip Type Validation

```typescript
it('should store objects not stringified JSON in Json columns', async () => {
  const tier = await prisma.tier.create({
    data: {
      tenantId: 'test-tenant',
      scalingRules: { components: [{ name: 'Catering', perPersonCents: 2500 }] },
    },
  });

  // Must be an object, not a string
  expect(typeof tier.scalingRules).toBe('object');
  expect(tier.scalingRules).not.toBeInstanceOf(String);
});
```

### Cache Staleness Prevention

| Strategy                     | When to Use                     | Implementation                            |
| ---------------------------- | ------------------------------- | ----------------------------------------- |
| **Restart API**              | After re-seeding in development | Clear all in-memory caches                |
| **Event-based invalidation** | Production data changes         | `cache.delete(key)` after write           |
| **TTL with validation**      | General safety net              | Timestamp entries, expire after N minutes |
| **Dual-write pattern**       | Critical data                   | Write DB + invalidate cache atomically    |

### Prisma Schema Documentation

Add `///` comments to `Json` columns as warnings:

```prisma
/// WARNING: Prisma auto-serializes Json columns.
/// DO NOT call JSON.stringify() before assignment.
/// Pass plain objects; Prisma handles encoding.
content Json @default("{}")
```

## Quick Reference: Prevention Table

| Layer        | Prevention                                   | Detection                                        | Recovery                      |
| ------------ | -------------------------------------------- | ------------------------------------------------ | ----------------------------- |
| **Code**     | Never `JSON.stringify()` before Prisma write | Grep for `JSON.stringify` near `.create/.update` | Remove stringify, re-seed     |
| **Schema**   | `///` comment warnings on Json columns       | Code review checklist                            | Add JSDoc to model            |
| **Test**     | Round-trip type assertions                   | `typeof content === 'object'` assertion          | Add integration test          |
| **Database** | Validate after seeding                       | Check for `\"` in raw SQL output                 | Manual fix + invalidate cache |
| **Cache**    | Event-based invalidation on writes           | Verify cache cleared after update                | Restart API server            |

## Verification

After applying fixes:

- Storefront renders all 3 segments with correct pricing
- Scaling rules display "From $X" + "+$Y/person beyond Z guests"
- 16/16 seed tests pass
- 2014/2014 server tests pass
- TypeScript typecheck clean in both workspaces

## Related Documentation

- [Prisma JSON Prevention Index](./PRISMA_JSON_PREVENTION_INDEX.md) — JSON field read/write patterns
- [Prisma 7 JSON Type Errors](./PRISMA7-JSON-TYPE-ERRORS.md) — Complete working solution for type safety
- [Prisma JSON Quick Reference](./prisma-json-quick-reference-MAIS-20260102.md) — 2-minute cheat sheet
- [Prisma 7 Seed Prevention Index](./PRISMA_7_SEED_PREVENTION_INDEX.md) — Seed script patterns
- [Production Smoke Test: 6 Critical Bugs](../runtime-errors/PRODUCTION_SMOKE_TEST_6_BUGS_STOREFRONT_CHAT_SLUG.md) — null defeats, context injection, route orphaning
- [Constants Duplication Trap: Section Types](../patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md) — Silent filtering pattern
- [Cache Invalidation Quick Reference](../react-performance/CACHE_INVALIDATION_QUICK_REFERENCE.md) — 100ms delay pattern, race condition detection
- [Section Content Migration (Phase 5.2)](../code-review-patterns/parallel-todo-resolution-section-content-migration-MAIS-20260203.md) — XSS sanitization, LRU caching
