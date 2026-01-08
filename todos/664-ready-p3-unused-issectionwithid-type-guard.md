---
status: ready
priority: p3
issue_id: '664'
tags:
  - code-review
  - yagni
  - storefront-section-ids
dependencies: []
---

# Unused isSectionWithId Type Guard

## Problem Statement

The `isSectionWithId()` type guard is exported and tested but appears unused in actual tool code. Tools use inline checks instead. This could be YAGNI (You Aren't Gonna Need It).

**Why it matters:** Dead code adds maintenance burden. However, type guards are generally good practice for type narrowing.

## Findings

**Location:** `packages/contracts/src/landing-page.ts` lines 100-108

**Exported but unused:**

```typescript
export function isSectionWithId(section: Section): section is SectionWithId {
  return (
    'id' in section &&
    typeof section.id === 'string' &&
    SectionIdSchema.safeParse(section.id).success
  );
}
```

**Tools use inline checks:**

```typescript
// In tools (line 189):
(s) => 'id' in s && s.id === sectionId

// Type guard would be cleaner:
(s) => isSectionWithId(s) && s.id === sectionId
```

## Proposed Solutions

### Option A: Use Type Guard Consistently (Recommended)

**Pros:** Better type narrowing, cleaner code, validates ID format
**Cons:** Slight performance overhead (Zod validation)
**Effort:** Small (1 hour)
**Risk:** Low

### Option B: Remove Type Guard (YAGNI)

**Pros:** Less code to maintain
**Cons:** Loses type narrowing benefits
**Effort:** Tiny (15 min)
**Risk:** Low

## Recommended Action

**Option A: Use Type Guard Consistently** - Quality demands using proper type narrowing. Replace inline `'id' in s` checks with `isSectionWithId(s)`. Better TypeScript inference, validates ID format, cleaner code.

## Technical Details

**Affected Files:**

- `packages/contracts/src/landing-page.ts` (keep or remove)
- `server/src/agent/tools/storefront-tools.ts` (use if kept)

## Acceptance Criteria

- [ ] Decision made: use or remove
- [ ] If use: all inline ID checks replaced with type guard
- [ ] If remove: function and tests deleted

## Work Log

| Date       | Action                   | Learnings                                                                  |
| ---------- | ------------------------ | -------------------------------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by code-simplicity-reviewer agent                               |
| 2026-01-08 | Approved for work        | Quality triage: Use it or delete it. Type guards improve quality - use it. |

## Resources

- Test file: `server/test/contracts/section-id.test.ts`
