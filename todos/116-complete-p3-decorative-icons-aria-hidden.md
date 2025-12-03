---
status: complete
priority: p3
issue_id: "116"
tags: [code-review, accessibility, ui-redesign]
dependencies: []
---

# Decorative Icons Missing aria-hidden Attribute

## Problem Statement

Many decorative icons throughout the dashboard components don't have `aria-hidden="true"`, causing screen readers to announce them unnecessarily.

**Why it matters:** Screen reader noise, minor accessibility issue.

## Findings

### From accessibility specialist agent:

**Files with decorative icons missing aria-hidden:**
- TenantDashboard/index.tsx (line 73-74) - Sparkles icon
- MetricsCards.tsx (lines 75-79) - All metric icons
- BrandingForm (line 56) - Palette icon
- Empty states - All icons

**Pattern to fix:**
```tsx
// Current
<Sparkles className="w-5 h-5 text-sage" />

// Should be
<Sparkles className="w-5 h-5 text-sage" aria-hidden="true" />
```

## Proposed Solutions

### Solution 1: Add aria-hidden to All Decorative Icons
**Pros:** Better screen reader experience
**Cons:** Minor tedium
**Effort:** Small (30 min)
**Risk:** None

## Acceptance Criteria

- [x] All decorative icons have aria-hidden="true"
- [x] Icons that convey meaning keep screen reader text
- [x] TypeScript passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-30 | Created from code review | Accessibility improvement |
| 2025-12-02 | Added aria-hidden to all decorative icons | Updated 15 components |
