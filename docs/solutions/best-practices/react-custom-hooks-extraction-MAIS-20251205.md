---
title: 'React Custom Hooks Extraction - Case Study: Tenant Dashboard'
slug: react-custom-hooks-extraction-case-study
category: best-practices
severity: P2
project: MAIS
date_created: 2025-12-05
tags:
  - react
  - hooks
  - refactoring
  - testability
  - memory-leak
  - case-study
components_affected:
  - DepositSettingsCard.tsx
  - RemindersCard.tsx
  - CalendarConfigCard.tsx
hooks_created:
  - useDepositSettingsManager
  - useRemindersManager
  - useCalendarConfigManager
related_docs:
  - docs/solutions/react-performance/REACT-HOOK-EXTRACTION-PREVENTION.md (main guide)
  - docs/solutions/react-performance/REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md
  - docs/solutions/react-performance/REACT-MEMOIZATION-PREVENTION-STRATEGY.md
---

# React Custom Hooks Extraction - Case Study

**Main Guide:** See [REACT-HOOK-EXTRACTION-PREVENTION.md](../react-performance/REACT-HOOK-EXTRACTION-PREVENTION.md) for comprehensive patterns.

This document captures a real implementation from the tenant dashboard refactoring on 2025-12-05.

## Context

Three dashboard components were refactored as part of P2 code review findings (todo 261):

| Component | Before | After | Hook Created |
|-----------|--------|-------|--------------|
| CalendarConfigCard | 572 lines | 368 lines | useCalendarConfigManager |
| DepositSettingsCard | 206 lines | 206 lines* | useDepositSettingsManager |
| RemindersCard | 181 lines | 181 lines* | useRemindersManager |

*Component line count stayed similar but logic is now testable in isolation.

## Key Fix: Memory Leak Prevention Pattern

The code review identified a **P1 memory leak** from uncleared `setTimeout` calls. Here's the fix pattern:

### Problem

```typescript
// ❌ MEMORY LEAK: setTimeout never cleared if component unmounts
const handleSave = async () => {
  await api.save(data);
  setSaved(true);
  setTimeout(() => setSaved(false), 3000); // Leak!
};
```

### Solution

```typescript
// ✅ SAFE: Store timeout ID in ref, clear on unmount
const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }
  };
}, []);

const handleSave = useCallback(async () => {
  await api.save(data);
  setSaved(true);

  // Clear old timeout first (prevents accumulation)
  if (savedTimeoutRef.current) {
    clearTimeout(savedTimeoutRef.current);
  }

  // Store new timeout ID
  savedTimeoutRef.current = setTimeout(() => {
    setSaved(false);
  }, 3000);
}, [data]);
```

### Why useRef instead of useState?

- `useRef` doesn't trigger re-renders when updated
- Timeout IDs are implementation details, not UI state
- Cleanup effect accesses `.current` which is always fresh

## Files Created

```
client/src/features/tenant-admin/TenantDashboard/hooks/
├── useCalendarConfigManager.ts  (280 lines)
├── useDepositSettingsManager.ts (183 lines)
└── useRemindersManager.ts       (122 lines)
```

## Hook Interface Pattern

Each hook returns a typed interface grouping state by category:

```typescript
export interface UseDepositSettingsManagerResult {
  // Server state
  settings: DepositSettings | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saved: boolean;

  // Form state
  depositsEnabled: boolean;
  depositPercent: string;
  balanceDueDays: string;

  // Actions
  setDepositsEnabled: (enabled: boolean) => void;
  setDepositPercent: (percent: string) => void;
  setBalanceDueDays: (days: string) => void;
  handleSave: () => Promise<void>;
  hasChanges: () => boolean;
}
```

## Component After Refactoring

```typescript
export function DepositSettingsCard() {
  const manager = useDepositSettingsManager();

  if (manager.loading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      {manager.error && <ErrorAlert message={manager.error} />}
      {manager.saved && <SuccessAlert />}

      <DepositForm
        depositsEnabled={manager.depositsEnabled}
        depositPercent={manager.depositPercent}
        balanceDueDays={manager.balanceDueDays}
        onToggle={manager.setDepositsEnabled}
        onPercentChange={manager.setDepositPercent}
        onDaysChange={manager.setBalanceDueDays}
      />

      <Button
        onClick={manager.handleSave}
        disabled={manager.saving || !manager.hasChanges()}
      >
        {manager.saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
```

## Lessons Learned

1. **Extract early** - Waiting until components are 500+ lines makes refactoring harder
2. **Memory cleanup is critical** - Always handle setTimeout/setInterval cleanup
3. **Type the return interface** - Self-documenting and enables autocomplete
4. **Group by category** - Server state, form state, actions makes hook easier to understand
5. **useCallback all handlers** - Prevents unnecessary re-renders when hook is consumed

## Related Issues

- [Todo 261](../../../todos/261-pending-p2-extract-custom-hooks.md) - Original code review finding
- [Todo 259](../../../todos/259-pending-p1-memory-leak-settimeout.md) - Memory leak fix
