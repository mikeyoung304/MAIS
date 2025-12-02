---
status: complete
priority: p1
issue_id: "122"
tags: [code-review, accessibility, pr-12]
dependencies: []
---

# Missing Keyboard Focus Indicator on Accordion Summary

## Problem Statement

The `<summary>` element in the accordion has no visible focus indicator for keyboard navigation. Users navigating with Tab key cannot see which accordion is focused.

**Why it matters:**
- Violates WCAG 2.1 Success Criterion 2.4.7 (Focus Visible - Level AA)
- ~15-20% of users rely on keyboard navigation
- Screen reader users often navigate without a mouse
- WCAG AA compliance may be mandatory for enterprise customers

## Findings

**Source:** Frontend Architecture Expert agent review of PR #12

**File:** `client/src/features/tenant-admin/TenantPackagesManager.tsx`
**Line:** 205

**Current Code:**
```typescript
<summary className="px-6 py-4 cursor-pointer font-serif text-lg font-bold flex items-center justify-between hover:bg-sage-light/5 transition-colors list-none [&::-webkit-details-marker]:hidden">
```

**Problem:** Class only includes `hover:` state, not `focus:` state.

## Proposed Solutions

### Solution 1: Add Tailwind Focus Classes (Recommended)
```typescript
<summary className="px-6 py-4 cursor-pointer font-serif text-lg font-bold flex items-center justify-between hover:bg-sage-light/5 focus:bg-sage-light/10 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 transition-colors list-none [&::-webkit-details-marker]:hidden">
```

**Pros:** Simple CSS fix, matches design system
**Cons:** None
**Effort:** Small (5 minutes)
**Risk:** Low

## Recommended Action

Implement Solution 1 immediately. This is a WCAG compliance issue.

## Technical Details

**Affected Files:**
- `client/src/features/tenant-admin/TenantPackagesManager.tsx` (line 205)

## Acceptance Criteria

- [ ] Focus ring visible when tabbing to accordion summary
- [ ] Focus ring uses sage color (design system)
- [ ] Passes WCAG 2.4.7 (Focus Visible)
- [ ] Works in Chrome, Firefox, Safari

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | From PR #12 code review |

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/12
- WCAG 2.4.7: https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html
