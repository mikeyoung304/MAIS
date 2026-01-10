---
status: pending
priority: p3
issue_id: '720'
tags:
  - code-review
  - architecture
  - frontend
dependencies: []
---

# About Section Assumes First Text Section

## Problem Statement

The `buildHomeSections()` function assumes the first `text` type section is the "about" section. This is fragile if tenants add multiple text sections.

## Findings

### Evidence

**File:** `apps/web/src/components/tenant/TenantLandingPage.tsx`
**Lines:** 62-68

```typescript
// Find "About" section (text type) - should appear before packages for trust-building
const aboutSection = homeSections.find((s) => s.type === 'text');

// Pre-sections = hero + about (builds trust before showing packages)
const preSections: Section[] = heroSection ? [heroSection] : [defaultHero];
if (aboutSection) {
  preSections.push(aboutSection);
}
```

### Current Mitigation

- Default config has exactly one text section with ID `home-text-about`
- Business requirement is to show "about" content before packages
- Multiple text sections are not currently supported in the default flow

### When This Matters

Only if:

1. Tenant adds multiple text sections to home page
2. First text section is NOT the "about" content
3. Wrong section would appear before packages

## Proposed Solutions

### Option A: Use Section ID Instead of Type (Recommended)

```typescript
const aboutSection = homeSections.find((s) => s.id === 'home-text-about');
```

**Pros:** Explicit, predictable
**Cons:** Only works for sections with that exact ID
**Effort:** Trivial (5 min)
**Risk:** Low

### Option B: Keep Current Pattern

**Pros:** Works with any text section
**Cons:** Ambiguous with multiple text sections
**Effort:** None
**Risk:** Low (rare edge case)

## Technical Details

### Affected Files

- `apps/web/src/components/tenant/TenantLandingPage.tsx`

## Acceptance Criteria

- [ ] About section reliably appears before packages
- [ ] Multiple text sections don't cause confusion

## Work Log

| Date       | Action                   | Learnings                                 |
| ---------- | ------------------------ | ----------------------------------------- |
| 2026-01-10 | Created from code review | Simplicity reviewer noted this assumption |
