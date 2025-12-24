---
status: complete
priority: p3
issue_id: '264'
tags: [code-review, code-quality, components, tenant-dashboard]
dependencies: []
---

# Extract Shared ErrorAlert Component

## Problem Statement

All three dashboard components repeat 7-10 lines of identical error display markup. This should be extracted to a shared component.

**Why it matters:**

- DRY violation
- Inconsistent error styling risk
- Maintenance burden

## Findings

### Agent: code-simplicity-reviewer

- **Location:** All three components
- **Evidence:** Identical error display pattern repeated 3x
- **Impact:** LOW - Code duplication

## Proposed Solutions

### Option A: Create Shared ErrorAlert (Recommended)

**Description:** Extract to `client/src/components/shared/ErrorAlert.tsx`

```tsx
export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="p-4 bg-danger-50 border border-danger-100 rounded-xl flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span className="text-sm text-danger-700">{message}</span>
    </div>
  );
}
```

**Effort:** Small (20 min)
**Risk:** Low

## Acceptance Criteria

- [ ] ErrorAlert component created
- [ ] All dashboard components use shared component
- [ ] No duplicate error display markup

## Work Log

| Date       | Action                   | Learnings                                |
| ---------- | ------------------------ | ---------------------------------------- |
| 2025-12-05 | Created from code review | Pattern also exists in StripeConnectCard |
