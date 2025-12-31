---
status: resolved
priority: p2
issue_id: '263'
tags: [code-review, accessibility, tenant-dashboard]
dependencies: []
resolved_at: '2025-12-23'
resolved_by: 'already fixed - ARIA labels present in both RemindersCard and CalendarConfigCard'
---

# Missing ARIA Labels for Interactive Elements

## Problem Statement

Several interactive elements (buttons with icons, file inputs) lack proper ARIA labels for screen reader accessibility.

**Why it matters:**

- Screen reader users cannot understand button purpose
- WCAG 2.1 Level A compliance issue
- Poor accessibility experience

## Findings

### Agent: code-quality-reviewer

- **Location:** RemindersCard.tsx:128-136, CalendarConfigCard.tsx:506-513
- **Evidence:** Buttons with icons but no aria-label
- **Impact:** IMPORTANT - Accessibility violation

## Proposed Solutions

### Option A: Add ARIA Labels (Recommended)

**Description:** Add aria-label to all icon-only buttons and hidden inputs

**RemindersCard.tsx:**

```tsx
<Button
  aria-label="Refresh reminders"
  ...
>
  <RefreshCw aria-hidden="true" />
</Button>
```

**CalendarConfigCard.tsx:**

```tsx
<input
  aria-label="Upload service account JSON file"
  ...
/>
```

**Effort:** Small (15 min)
**Risk:** Low

## Recommended Action

**Choose Option A** - Add aria-labels to all interactive elements.

## Technical Details

### Affected Files

- `client/src/features/tenant-admin/TenantDashboard/RemindersCard.tsx`
- `client/src/features/tenant-admin/TenantDashboard/CalendarConfigCard.tsx`

### Elements Needing Labels

1. Refresh button in RemindersCard (line 128)
2. File input in CalendarConfigCard (line 506)
3. Any other icon-only buttons

## Acceptance Criteria

- [ ] All icon-only buttons have aria-label
- [ ] All hidden inputs have aria-label
- [ ] Screen reader announces button purposes correctly
- [ ] No accessibility warnings in browser dev tools

## Work Log

| Date       | Action                   | Learnings                                                     |
| ---------- | ------------------------ | ------------------------------------------------------------- |
| 2025-12-05 | Created from code review | Icons should have aria-hidden="true", buttons need aria-label |

## Resources

- **WCAG 2.1:** https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html
