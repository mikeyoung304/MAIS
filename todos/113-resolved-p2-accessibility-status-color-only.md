---
status: pending
priority: p2
issue_id: "113"
tags: [code-review, accessibility, wcag, ui-redesign]
dependencies: []
---

# Status Indicators Rely Only on Color (WCAG 1.4.1)

## Problem Statement

Booking status (confirmed, pending, cancelled) relies heavily on color (green, yellow, red) without additional indicators like icons.

**Why it matters:** Users with color blindness cannot distinguish status. WCAG Level A violation.

## Findings

### From accessibility specialist agent:

**File:** `client/src/features/tenant-admin/TenantBookingList.tsx`
**Lines:** 72-83, 276-278
**WCAG Criterion:** 1.4.1 Use of Color (Level A)

**Current code:**
```typescript
const getStatusStyle = (status: string) => {
  switch (status) {
    case "confirmed": return "bg-sage/10 text-sage"; // Green only
    case "pending": return "bg-amber-100 text-amber-800"; // Yellow only
    case "cancelled": return "bg-red-100 text-red-800"; // Red only
    default: return "bg-gray-100 text-gray-800";
  }
};
```

## Proposed Solutions

### Solution 1: Add Icons to Status Badges (Recommended)
**Pros:** WCAG compliant, better UX for everyone
**Cons:** Slightly more visual complexity
**Effort:** Small (30 min)
**Risk:** Low

```tsx
<span className={`... inline-flex items-center gap-1 ${getStatusStyle(status)}`}>
  {status === 'confirmed' && <Check className="w-3 h-3" aria-hidden="true" />}
  {status === 'pending' && <Clock className="w-3 h-3" aria-hidden="true" />}
  {status === 'cancelled' && <X className="w-3 h-3" aria-hidden="true" />}
  <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
</span>
```

## Acceptance Criteria

- [ ] Status badges include icons
- [ ] Icons are aria-hidden (text provides meaning)
- [ ] Works for color-blind users
- [ ] Visual appearance still attractive

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-11-30 | Created from code review | WCAG 1.4.1 violation |
