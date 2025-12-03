---
status: pending
priority: p2
issue_id: "165"
tags: [code-review, ux, hooks, error-handling]
dependencies: []
---

# Redundant Error Feedback in Management Hooks

## Problem Statement

Several management hooks show both `setError()` state AND `toast.error()` for the same failure, causing users to see duplicate error messages. This creates a confusing UX where errors appear twice.

**Why This Matters:**
- Users see duplicate error notifications
- Inconsistent with success flow (which only uses toast)
- Creates visual noise and confusion

## Findings

### Agent: code-simplicity-reviewer

**Affected Files:**
1. `client/src/features/admin/packages/hooks/usePackageManager.ts`
2. `client/src/features/admin/packages/hooks/useAddOnManager.ts`
3. `client/src/features/tenant-admin/packages/hooks/usePackageManager.ts`
4. `client/src/features/tenant-admin/scheduling/ServicesManager/useServicesManager.ts`

**Pattern Found:**
```typescript
catch (error) {
  setError('Failed to save package');  // Sets error state for UI
  toast.error('Failed to save package');  // Shows toast notification
  // User sees BOTH error displays
}
```

**Comparison with Success Flow:**
```typescript
// Success only uses toast - no setState
toast.success('Package saved successfully');
```

## Proposed Solutions

### Option A: Toast-Only Pattern (Recommended)
**Pros:** Consistent with success flow, cleaner UX
**Cons:** Removes inline error state
**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
catch (error) {
  toast.error('Failed to save package', {
    description: error instanceof Error ? error.message : 'Please try again'
  });
  // Remove setError() call
}
```

### Option B: Error State Only
**Pros:** Persistent error display, no toast library dependency
**Cons:** Inconsistent with success flow which uses toast
**Effort:** Small (1-2 hours)
**Risk:** Low

### Option C: Conditional - Toast for Transient, State for Persistent
**Pros:** Best of both worlds
**Cons:** More complex logic
**Effort:** Medium (2-3 hours)
**Risk:** Low

## Recommended Action

Option A - Toast-only for consistency with success patterns.

## Technical Details

**Files to Update:**
- `client/src/features/admin/packages/hooks/usePackageManager.ts`
- `client/src/features/admin/packages/hooks/useAddOnManager.ts`
- `client/src/features/tenant-admin/packages/hooks/usePackageManager.ts`
- `client/src/features/tenant-admin/scheduling/ServicesManager/useServicesManager.ts`

## Acceptance Criteria

- [ ] Error handling uses single mechanism (toast recommended)
- [ ] Consistent with success flow pattern
- [ ] No duplicate error displays to users
- [ ] Error messages remain helpful and actionable

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | Found during code review of commit 012bd9b |

## Resources

- Commit: 012bd9b
- Related: TODO-128 (added toast feedback)
