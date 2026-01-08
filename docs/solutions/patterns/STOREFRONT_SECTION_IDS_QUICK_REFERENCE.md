# Storefront Section IDs - Quick Reference

**Print and pin. 2-minute read before implementing section tools.**

---

## The 4 Most Common Mistakes

| Mistake                      | How to Avoid                                                          |
| ---------------------------- | --------------------------------------------------------------------- |
| TOCTOU race on JSON field    | Wrap read-validate-write in `$transaction` + advisory lock            |
| Duplicated resolution logic  | Extract to `server/src/agent/utils/section-resolver.ts`               |
| Inconsistent tool parameters | All tools support `sectionId` (preferred) + `sectionIndex` (fallback) |
| Untested error paths         | Add tests for cross-page errors and legacy data                       |

---

## Decision Trees

### Before Writing JSON Field Validation

```
Does tool read → validate → write?
├── Yes → Wrap in $transaction
│   └── Multiple users can edit? → Add advisory lock
└── No → Safe to proceed
```

### Before Adding Shared Logic

```
Is this logic in another tool?
├── Yes → Extract to utils/, import in both
├── Not yet, but will be → Extract now (not later!)
└── Unique to this tool → Keep inline
```

### Before Adding String Literal

```
Is this string used elsewhere?
├── Yes → Extract to constant
├── Will be used again → Extract to constant NOW
└── Truly unique → Inline is OK
```

---

## Code Patterns

### TOCTOU Prevention (P1)

```typescript
await prisma.$transaction(async (tx) => {
  const lockId = hashString(`storefront:${tenantId}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  const { pages } = await getDraftConfig(tx, tenantId);
  // validate + write in same transaction
});
```

### Shared Resolution Helper (P2)

```typescript
// server/src/agent/utils/section-resolver.ts
export function resolveSectionIdToIndex(
  pages: PagesConfig,
  pageName: PageName,
  sectionId: string
): { index: number } | { error: string };
```

### Constants (P2/P3)

```typescript
// Import from contracts, never duplicate
import { SECTION_TYPES, generateSectionId } from '@macon/contracts';

// Legacy ID helper
export const LEGACY_SECTION_ID_SUFFIX = 'legacy';
export function getLegacySectionId(page: PageName, type: SectionTypeName): string {
  return `${page}-${type}-${LEGACY_SECTION_ID_SUFFIX}`;
}
```

---

## Test Checklist

Every section tool needs:

- [ ] Happy path (normal operation)
- [ ] Not found error (section doesn't exist)
- [ ] **Cross-page error** (section exists on wrong page)
- [ ] **Legacy data** (sections without IDs)
- [ ] Tenant isolation (other tenant's data)

---

## Pre-PR Checklist

```markdown
- [ ] Check-then-write in $transaction + lock
- [ ] No duplicated logic (check utils/)
- [ ] All related tools have same parameters
- [ ] Tests cover cross-page and legacy cases
- [ ] Constants imported from @macon/contracts
- [ ] No magic strings (extracted to constants)
```

---

## Files to Know

| File                                                 | Purpose                     |
| ---------------------------------------------------- | --------------------------- |
| `server/src/agent/tools/storefront-tools.ts`         | Tool definitions            |
| `server/src/agent/executors/storefront-executors.ts` | Executor implementations    |
| `server/src/agent/utils/`                            | Shared helpers              |
| `packages/contracts/src/landing-page.ts`             | Section schemas + constants |

---

**See full guide:** `STOREFRONT_SECTION_IDS_PREVENTION_STRATEGIES.md`
