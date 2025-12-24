---
title: React Custom Hooks Extraction Pattern
category: best-practices
tags:
  - react
  - hooks
  - refactoring
  - testability
  - separation-of-concerns
  - reusability
severity: P2
project: MAIS
created_date: 2025-12-05
updated_date: 2025-12-05
author: Claude Code
status: documented
components_affected:
  - DepositSettingsCard.tsx
  - RemindersCard.tsx
  - CalendarConfigCard.tsx
related_hooks:
  - useDepositSettingsManager
  - useRemindersManager
  - useCalendarConfigManager
---

# React Custom Hooks Extraction Pattern

## Overview

This document captures the pattern used to extract business logic from React components into custom hooks, improving testability, reusability, and separation of concerns. Three tenant dashboard components were refactored using this pattern:

- **DepositSettingsCard** → `useDepositSettingsManager`
- **RemindersCard** → `useRemindersManager`
- **CalendarConfigCard** → `useCalendarConfigManager`

## Problem Statement

### Original Issues

1. **Mixed Concerns**: Components contained both UI rendering and business logic (state management, API calls, side effects)
2. **Difficult Testing**: Testing business logic required mounting entire React components; couldn't isolate business rules
3. **Limited Reusability**: Business logic was tightly coupled to component structure, preventing reuse
4. **Memory Leaks**: Timeouts and side effects weren't properly managed; cleanup was scattered
5. **Type Safety**: Return types were implicit; no clear contract between component and logic

### Example: DepositSettingsCard Before

```tsx
// ❌ BEFORE: Mixed UI and business logic
export function DepositSettingsCard() {
  const [settings, setSettings] = useState<DepositSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositsEnabled, setDepositsEnabled] = useState(false);
  const [depositPercent, setDepositPercent] = useState('50');
  // ... more state
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const result = await api.tenantAdminGetDepositSettings();
        // ... handle response
      } catch (err) {
        // ... handle error
      }
    };
    fetchSettings();
  }, []);

  // ... more API call handlers, validation logic mixed with JSX

  return <div className="...">{/* Business logic intertwined with UI */}</div>;
}
```

**Testing Challenge**: Can't test deposit validation or API logic without rendering component

## Solution: Custom Hook Extraction

### Pattern Components

1. **State Management**: All useState calls consolidated in hook
2. **Side Effects**: useEffect and cleanup logic centralized
3. **API Integration**: All API calls wrapped in useCallback
4. **Type-Safe Return**: Explicit interface for hook return value
5. **Memory Management**: Proper cleanup on unmount

### Example: useDepositSettingsManager Hook

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

export function useDepositSettingsManager(): UseDepositSettingsManagerResult {
  // All state centralized
  const [settings, setSettings] = useState<DepositSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable state
  const [depositsEnabled, setDepositsEnabled] = useState(false);
  const [depositPercent, setDepositPercent] = useState('50');
  const [balanceDueDays, setBalanceDueDays] = useState('30');

  // Ref for cleanup
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  // All business logic
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.tenantAdminGetDepositSettings();
      if (result.status === 200 && result.body) {
        setSettings(result.body);
        setDepositsEnabled(result.body.depositPercent !== null);
        setDepositPercent(result.body.depositPercent?.toString() || '50');
        setBalanceDueDays(result.body.balanceDueDays.toString());
      } else {
        setError('Failed to fetch deposit settings');
      }
    } catch (err) {
      logger.error('Error fetching deposit settings:', { error: err });
      setError('Failed to fetch deposit settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      // Validation logic
      const percentNum = depositsEnabled ? parseFloat(depositPercent) : null;
      const daysNum = parseInt(balanceDueDays, 10);

      if (depositsEnabled && (isNaN(percentNum!) || percentNum! < 0 || percentNum! > 100)) {
        setError('Deposit percentage must be between 0 and 100');
        setSaving(false);
        return;
      }

      if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
        setError('Balance due days must be between 1 and 90');
        setSaving(false);
        return;
      }

      // API call
      const result = await api.tenantAdminUpdateDepositSettings({
        body: { depositPercent: percentNum, balanceDueDays: daysNum },
      });

      if (result.status === 200 && result.body) {
        setSettings(result.body);
        setSaved(true);
        // Cleanup previous timeout
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        // Schedule hide after 3 seconds
        savedTimeoutRef.current = setTimeout(() => setSaved(false), 3000);
      } else {
        const errorBody = result.body as { error?: string } | undefined;
        setError(errorBody?.error || 'Failed to save deposit settings');
      }
    } catch (err) {
      logger.error('Error saving deposit settings:', { error: err });
      setError('Failed to save deposit settings');
    } finally {
      setSaving(false);
    }
  }, [depositsEnabled, depositPercent, balanceDueDays]);

  const hasChanges = useCallback(() => {
    if (!settings) return false;
    const currentEnabled = settings.depositPercent !== null;
    const currentPercent = settings.depositPercent?.toString() || '50';
    const currentDays = settings.balanceDueDays.toString();
    return (
      depositsEnabled !== currentEnabled ||
      (depositsEnabled && depositPercent !== currentPercent) ||
      balanceDueDays !== currentDays
    );
  }, [settings, depositsEnabled, depositPercent, balanceDueDays]);

  return {
    settings,
    loading,
    error,
    saving,
    saved,
    depositsEnabled,
    depositPercent,
    balanceDueDays,
    setDepositsEnabled,
    setDepositPercent,
    setBalanceDueDays,
    handleSave,
    hasChanges,
  };
}
```

### Refactored Component

```tsx
export function DepositSettingsCard() {
  const manager = useDepositSettingsManager();

  // Component now only handles UI rendering
  return (
    <div className="space-y-6">
      {manager.loading && <LoadingSpinner />}
      {manager.error && <ErrorAlert error={manager.error} />}
      {manager.saved && <SuccessAlert />}

      {/* Pure UI - just bind values from manager */}
      <Switch checked={manager.depositsEnabled} onCheckedChange={manager.setDepositsEnabled} />
      <Input
        value={manager.depositPercent}
        onChange={(e) => manager.setDepositPercent(e.target.value)}
      />
      <Button onClick={manager.handleSave} disabled={manager.saving || !manager.hasChanges()}>
        {manager.saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
```

## Benefits

### 1. Testability

Business logic can now be tested independently:

```typescript
// ✅ Can test hook logic without component
test('should validate deposit percentage', () => {
  const { result } = renderHook(() => useDepositSettingsManager());

  act(() => {
    result.current.setDepositPercent('150'); // Invalid
    result.current.handleSave();
  });

  expect(result.current.error).toBe('Deposit percentage must be between 0 and 100');
});

test('should clear saved indicator after 3 seconds', async () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => useDepositSettingsManager());

  expect(result.current.saved).toBe(false);

  act(() => {
    jest.advanceTimersByTime(3000);
  });

  // Verify timeout was cleared
  jest.useRealTimers();
});
```

### 2. Reusability

Same hook can power multiple UI variants:

```typescript
// Desktop version
export function DepositSettingsCard() {
  const manager = useDepositSettingsManager();
  return <DesktopLayout manager={manager} />;
}

// Mobile version
export function DepositSettingsCardMobile() {
  const manager = useDepositSettingsManager();
  return <MobileLayout manager={manager} />;
}

// Settings page
export function DepositSettingsPage() {
  const manager = useDepositSettingsManager();
  return <PageLayout manager={manager} />;
}
```

### 3. Separation of Concerns

Clear division between:

- **Hook**: State, data fetching, business logic, validation
- **Component**: UI rendering, layout, styling

### 4. Memory Cleanup

Proper cleanup prevents memory leaks:

```typescript
// Cleanup ref prevents timeout from running after unmount
const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }
  };
}, []);

// Previous timeout cleared before setting new one
if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
savedTimeoutRef.current = setTimeout(() => setSaved(false), 3000);
```

### 5. Type Safety

Explicit interface documents contract:

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

## Implementation Checklist

When extracting business logic into a custom hook:

- [ ] **Identify State**: List all useState calls in component
- [ ] **Identify Effects**: List all useEffect hooks and their cleanup logic
- [ ] **Identify Actions**: List all functions that modify state (handlers, API calls)
- [ ] **Create Interface**: Define explicit return type for hook result
- [ ] **Move State**: Move all useState to new hook
- [ ] **Move Effects**: Move all useEffect and cleanup logic to hook
- [ ] **Wrap Actions**: Wrap functions in useCallback with proper dependencies
- [ ] **Memory Management**: Use refs for timeouts/intervals; clean up on unmount
- [ ] **Error Handling**: Centralize error handling in hook, expose via state
- [ ] **API Integration**: All API calls go through hook actions
- [ ] **Component Cleanup**: Leave only rendering and prop binding in component
- [ ] **Type Safety**: Add explicit return interface to hook
- [ ] **Tests**: Test hook logic independently, then component integration

## Applied Examples

### DepositSettingsCard

**File**: `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard/DepositSettingsCard.tsx`

**Hook**: `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard/hooks/useDepositSettingsManager.ts`

**Key Features**:

- Form state management (deposits enabled, percentage, balance due days)
- Validation (0-100% range, 1-90 days range)
- Save indicator timeout with cleanup
- Change detection via `hasChanges()` method

### RemindersCard

**File**: `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard/RemindersCard.tsx`

**Hook**: `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard/hooks/useRemindersManager.ts`

**Key Features**:

- Fetch reminder status on mount
- Process reminders with loading/error states
- Date formatting utilities
- Manual refresh capability

### CalendarConfigCard

**File**: `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard/CalendarConfigCard.tsx`

**Hook**: `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard/hooks/useCalendarConfigManager.ts`

**Key Features**:

- File upload handling with validation
- Dialog state management (config, delete dialogs)
- Test connection functionality
- Configuration save and delete operations

## Anti-Patterns to Avoid

### ❌ Don't: Put Styling Logic in Hook

```typescript
// WRONG - Styling doesn't belong in hook
export function useDepositSettingsManager() {
  const getInputClassName = () => {
    return manager.error ? 'border-danger-500' : 'border-sage-light';
  };
  // ...
}
```

### ✅ Do: Keep Styling in Component

```typescript
// RIGHT - Styling stays in component
export function DepositSettingsCard() {
  const manager = useDepositSettingsManager();
  return (
    <Input
      className={manager.error ? 'border-danger-500' : 'border-sage-light'}
    />
  );
}
```

### ❌ Don't: Create Hooks with Too Many Responsibilities

```typescript
// WRONG - Too many concerns in one hook
export function useTenantAdminDashboard() {
  const deposits = useDepositSettingsManager();
  const reminders = useRemindersManager();
  const calendar = useCalendarConfigManager();
  // ... returns giant object
}
```

### ✅ Do: Keep Hooks Focused

```typescript
// RIGHT - Each hook manages one domain
const deposits = useDepositSettingsManager();
const reminders = useRemindersManager();
const calendar = useCalendarConfigManager();
```

### ❌ Don't: Forget Cleanup

```typescript
// WRONG - Timeout runs after unmount
export function useDepositSettingsManager() {
  const handleSave = async () => {
    setTimeout(() => setSaved(false), 3000); // No cleanup!
  };
  // ...
}
```

### ✅ Do: Manage Refs Properly

```typescript
// RIGHT - Cleanup on unmount
export function useDepositSettingsManager() {
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const handleSave = async () => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => setSaved(false), 3000);
  };
  // ...
}
```

## Key Principles

1. **Single Responsibility**: Hook manages one feature's logic
2. **Explicit Contracts**: Return interface documents what hook provides
3. **Pure Logic**: No UI rendering in hooks
4. **Proper Cleanup**: All side effects cleaned up on unmount
5. **Type Safety**: Full TypeScript coverage, no implicit `any` types
6. **Memoization**: Use `useCallback` for expensive operations and dependency correctness
7. **Error Handling**: Centralize error handling, expose via hook state
8. **Testability**: Business logic testable independently from UI

## Related Patterns

- [Composition over Inheritance](../design-patterns/composition-over-inheritance.md)
- [Single Responsibility Principle](../design-principles/srp.md)
- [React Hooks Best Practices](./react-hooks-best-practices.md)
- [Memory Management in React](./memory-management-react.md)

## References

- [React Hooks Documentation](https://react.dev/reference/react)
- [Custom Hooks - React.dev](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Separating Container and Presentational Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0)

## Revision History

| Date       | Author      | Changes                       |
| ---------- | ----------- | ----------------------------- |
| 2025-12-05 | Claude Code | Initial pattern documentation |
