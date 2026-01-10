---
status: complete
priority: p3
issue_id: '719'
tags:
  - code-review
  - data-integrity
  - defensive-programming
dependencies: []
---

# Default Config Returns Shared Object Reference

## Problem Statement

When `getDraftConfigWithSlug()` returns `DEFAULT_PAGES_CONFIG`, it returns a **direct reference** to the shared constant, not a defensive copy. If any code mutates the returned object, it would corrupt the global constant for all subsequent callers across all tenants.

## Findings

### Evidence

**File:** `server/src/agent/tools/utils.ts`
**Lines:** 166-169, 185-188, 191-194, 266-270, 287-290, 296-300

```typescript
return {
  pages: result.data.pages || DEFAULT_PAGES_CONFIG, // Direct reference!
  hasDraft: true,
};
```

### Current Mitigation

Executors create clones before modifying: `const newSections = [...page.sections]`. This works but relies on every caller being disciplined.

### Risk Assessment

**Low risk** because:

- Executors already clone before mutation
- No known mutation bugs in current codebase
- Would cause obvious, immediate failures if broken

## Proposed Solutions

### Option A: Use structuredClone (Recommended)

```typescript
return {
  pages: structuredClone(DEFAULT_PAGES_CONFIG),
  hasDraft: false,
  slug: tenant.slug,
};
```

**Pros:** Deep copy, handles nested objects
**Cons:** ~1ms overhead per call
**Effort:** Small (30 min)
**Risk:** Low

### Option B: Accept current pattern

**Pros:** No changes, already works
**Cons:** Relies on caller discipline
**Effort:** None
**Risk:** Low (but fragile)

## Technical Details

### Affected Files

- `server/src/agent/tools/utils.ts`

## Recommended Action

**APPROVED** - Option A (Use structuredClone)

Rationale: Data integrity risk. While not currently exploited, mutation of shared config would corrupt ALL tenants. Defensive programming prevents future bugs. 30 min fix.

## Acceptance Criteria

- [x] `getDraftConfigWithSlug()` returns independent copies when using defaults
- [x] Mutations to returned config don't affect global constant
- [x] Tests verify isolation

## Work Log

| Date       | Action                   | Learnings                                                        |
| ---------- | ------------------------ | ---------------------------------------------------------------- |
| 2026-01-10 | Created from code review | Data integrity guardian identified this as defensive improvement |
| 2026-01-10 | **Triage: APPROVED** | Data integrity risk - shared reference could corrupt all tenants. |
| 2026-01-10 | **COMPLETE** | Replaced all 12 direct references to DEFAULT_PAGES_CONFIG with structuredClone(). Added unit tests verifying mutation isolation in server/test/agent/tools/utils.test.ts. Both getDraftConfig() and getDraftConfigWithSlug() now return independent copies. |
