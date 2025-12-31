---
status: complete
priority: p2
issue_id: '261'
tags: [code-review, architecture, hooks, tenant-dashboard]
dependencies: []
---

# Extract Business Logic to Custom Hooks

## Problem Statement

CalendarConfigCard (512 lines) and DepositSettingsCard (347 lines) contain business logic mixed with UI rendering. The codebase pattern (BrandingEditor) extracts logic to custom hooks for testability.

**Why it matters:**

- Hooks cannot be unit tested without rendering UI
- Large components are harder to maintain
- Logic cannot be reused across components

## Findings

### Agent: architecture-strategist

- **Location:** CalendarConfigCard:74-586, DepositSettingsCard:58-347
- **Evidence:** 300-500+ lines with 15+ useState calls and 5+ handlers each
- **Impact:** MEDIUM - Violates established patterns, reduces testability

## Proposed Solutions

### Option A: Extract to Manager Hooks (Recommended)

**Description:** Create useCalendarConfigManager.ts and useDepositSettingsManager.ts

**Example:**

```typescript
// hooks/useCalendarConfigManager.ts
export function useCalendarConfigManager() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  // ... all state and handlers
  return { status, loading, error, fetchStatus, saveConfig, ... };
}

// CalendarConfigCard.tsx (simplified)
export function CalendarConfigCard() {
  const manager = useCalendarConfigManager();
  return <div>...</div>; // UI only
}
```

**Pros:**

- Testable business logic
- Smaller, focused components
- Follows BrandingEditor pattern

**Cons:**

- Refactor effort
- More files to manage

**Effort:** Medium (3-4 hours)
**Risk:** Low

## Recommended Action

**Choose Option A** - Extract hooks following BrandingEditor pattern.

## Technical Details

### New Files to Create

- `client/src/features/tenant-admin/TenantDashboard/hooks/useCalendarConfigManager.ts`
- `client/src/features/tenant-admin/TenantDashboard/hooks/useDepositSettingsManager.ts`
- `client/src/features/tenant-admin/TenantDashboard/hooks/useRemindersManager.ts`

### Reference Implementation

- `client/src/features/tenant-admin/branding/hooks/useBrandingManager.ts`

## Acceptance Criteria

- [ ] Business logic extracted to custom hooks
- [ ] Components only contain UI rendering
- [ ] All existing functionality preserved
- [ ] Hooks are testable independently

## Work Log

| Date       | Action                   | Learnings                               |
| ---------- | ------------------------ | --------------------------------------- |
| 2025-12-05 | Created from code review | BrandingEditor is the reference pattern |

## Resources

- **Reference:** `client/src/features/tenant-admin/branding/hooks/useBrandingManager.ts`
- **Reference:** `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`
