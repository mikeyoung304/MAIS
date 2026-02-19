---
status: pending
priority: p2
issue_id: '11012'
tags: [code-review, transform, storefront-utils]
---

# P2: Testimonials transform must use `delete`, not `name: undefined` spread

## Problem Statement

The plan proposes:

```typescript
...(item.name && !item.authorName ? { authorName: item.name, name: undefined } : {}),
```

Spreading `{ name: undefined }` does NOT remove the `name` key — it sets the key's value to `undefined`. The key remains enumerable. Every other case in `transformContentForSection()` uses `delete transformed.fieldName` (lines 57, 70, 77, 84, 88, 94). The inconsistency creates ghost keys and violates the established pattern in the file.

## Fix

Match the existing pattern used throughout `transformContentForSection()`:

```typescript
case 'testimonials':
  // Array.isArray guard is required — transformed.items may be null from DB
  if (Array.isArray(transformed.items)) {
    transformed.items = (transformed.items as Record<string, unknown>[]).map((item) => {
      const out = { ...item };
      // Map seed field names to component field names
      if (out.name && !out.authorName) { out.authorName = out.name; delete out.name; }
      if (out.role && !out.authorRole) { out.authorRole = out.role; delete out.role; }
      return out;
    });
  }
  break;
```

## Acceptance Criteria

- [ ] Mapped objects do NOT have `name` or `role` keys (verified with `'name' in item === false`)
- [ ] `authorName` and `authorRole` are present and correct
- [ ] Transform is idempotent (running twice doesn't corrupt data)
- [ ] `Array.isArray` guard remains first (load-bearing for null safety)
