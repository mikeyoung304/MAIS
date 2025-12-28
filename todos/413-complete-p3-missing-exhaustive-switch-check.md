---
status: complete
priority: p3
issue_id: '413'
tags:
  - code-review
  - typescript
  - code-quality
  - locked-template-system
dependencies: []
---

# Missing Exhaustive Switch Check in SectionRenderer

## Problem Statement

The SectionRenderer switch statement has a `default: return null` case that silently ignores unhandled section types. TypeScript's exhaustive check pattern would catch missing cases at compile time.

**Why This Matters:**

- If a new section type is added to the schema, the renderer silently returns null
- Bug could go unnoticed until production
- TypeScript can prevent this with exhaustive checks

## Findings

**Location:** `apps/web/src/components/tenant/SectionRenderer.tsx` (lines 50-112)

**Evidence:**

```typescript
switch (section.type) {
  case 'hero': // ...
  case 'text': // ...
  // ...
  default:
    return null; // Silent failure
}
```

**Agent:** Architecture Strategist

## Proposed Solutions

### Solution 1: Add Exhaustive Check (Recommended)

```typescript
default: {
  const _exhaustive: never = section;
  return _exhaustive;
}
```

**Pros:**

- Compile-time error if new section type added
- No runtime impact
- TypeScript best practice

**Cons:**

- Slightly more complex

**Effort:** Small
**Risk:** None

## Technical Details

**Affected Files:**

- `apps/web/src/components/tenant/SectionRenderer.tsx`

## Acceptance Criteria

- [ ] Exhaustive check added to switch default case
- [ ] TypeScript passes
- [ ] Adding new section type without handling causes compile error

## Work Log

| Date       | Action                   | Learnings                           |
| ---------- | ------------------------ | ----------------------------------- |
| 2025-12-25 | Created from code review | Type safety improvement opportunity |
