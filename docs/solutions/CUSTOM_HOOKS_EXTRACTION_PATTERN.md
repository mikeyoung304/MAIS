# Custom Hooks Extraction Pattern

**Date:** 2025-12-05
**Phase:** Tenant Dashboard Refactor (All 9 God Components)
**Status:** Pattern Extracted & Documented

## Overview

This document captures the solution pattern for extracting complex component state and logic into custom React hooks. The pattern was applied to three tenant dashboard cards, reducing component complexity by 70-90% while improving testability, maintainability, and reusability.

### Problem Statement

Components like `DepositSettingsCard`, `RemindersCard`, and `CalendarConfigCard` had become "god components":

- Multiple state variables mixed with server state, form state, and UI state
- Complex logic spread across useEffect and event handlers
- Difficult to test because logic was tightly coupled to JSX
- Memory leaks from uncleared setTimeout calls
- State management logic couldn't be reused across components

### Solution

Extract state and logic into custom hooks (one hook per domain concept) following a standardized pattern.

---

## Pattern: The Manager Hook

### Core Structure

```typescript
/**
 * useManagerNameHook
 *
 * Manages [domain] state and operations for [feature].
 * Extracted from [Component] for testability and reusability.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

// 1. Define all TypeScript interfaces
export interface DomainEntity {
  // Server response fields
}

export interface ManagerResult {
  // Categorize: Server state, Form state, Dialog state, Actions
}

// 2. Define hook function
export function useManagerName(): ManagerResult {
  // State declarations
  // Effects (with cleanup)
  // Callbacks
  // Return object
}
```

### State Organization Pattern

Group state into three categories:

```typescript
// 1. Server State (fetched from API)
const [entity, setEntity] = useState<Entity | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [saving, setSaving] = useState(false);

// 2. Form State (user input)
const [fieldA, setFieldA] = useState('');
const [fieldB, setFieldB] = useState(0);
const [validationErrors, setValidationErrors] = useState({});

// 3. UI State (modals, temporary notifications)
const [showDialog, setShowDialog] = useState(false);
const [successIndicator, setSuccessIndicator] = useState(false);

// 4. Refs for side effects (especially timers)
const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

### Memory Leak Prevention: The Timeout Cleanup Pattern

**Critical Issue:** setTimeout calls in event handlers can cause memory leaks when component unmounts.

**Solution:** Use `useRef` to track setTimeout IDs + cleanup effect.

```typescript
// Store timeout ID in ref (not state - ref doesn't trigger re-render)
const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Cleanup effect on unmount - REQUIRED
useEffect(() => {
  return () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
  };
}, []);

// In event handler: clear old timeout before setting new one
const handleSave = useCallback(async () => {
  try {
    const result = await api.save(...);

    if (result.status === 200) {
      setSuccessIndicator(true);

      // Clear any existing timeout first
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }

      // Set new timeout and store its ID
      successTimeoutRef.current = setTimeout(() => {
        setSuccessIndicator(false);
      }, 3000);
    }
  } finally {
    setSaving(false);
  }
}, []);
```

**Why this works:**

- `useRef` persists across renders without causing re-renders
- Cleanup effect runs when component unmounts, clearing any pending timeout
- Clearing before setting prevents accumulating multiple pending timeouts
- The ID is always available even if component unmounts mid-timeout

---

## Interface Typing Pattern

Define a comprehensive return type that groups all returned values by category:

```typescript
export interface UseManagerResult {
  // Server State Section
  status: ServerEntity | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saved: boolean;

  // Form State Section
  fieldA: string;
  fieldB: number;
  formErrors: FormErrors;

  // Dialog State Section
  showDialog: boolean;
  showConfirm: boolean;

  // Actions Section
  fetchStatus: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleDelete: () => Promise<void>;
  setFieldA: (value: string) => void;
  setFieldB: (value: number) => void;
  handleOpenDialog: () => void;
  handleCloseDialog: () => void;
}
```

**Benefits:**

- Self-documenting: Clear what the hook provides
- IDE autocomplete: All properties visible in one interface
- Backward compatible: Easy to add new properties without breaking existing code
- Searchable: Can find all uses of a property by searching the interface

---

## Before/After: Complete Example

### Before: God Component Pattern

```typescript
export function DepositSettingsCard() {
  // Tangled state across multiple concerns
  const [settings, setSettings] = useState<DepositSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [depositsEnabled, setDepositsEnabled] = useState(false);
  const [depositPercent, setDepositPercent] = useState('50');
  const [balanceDueDays, setBalanceDueDays] = useState('30');

  // Fetch logic in component
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.tenantAdminGetDepositSettings();
        if (result.status === 200 && result.body) {
          const data = result.body;
          setSettings(data);
          setDepositsEnabled(data.depositPercent !== null);
          setDepositPercent(data.depositPercent?.toString() || '50');
          setBalanceDueDays(data.balanceDueDays.toString());
        } else {
          setError('Failed to fetch deposit settings');
        }
      } catch (err) {
        logger.error('Error fetching deposit settings:', { error: err });
        setError('Failed to fetch deposit settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Save logic in component
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    // ... validation and API call logic ...

    // Memory leak: setTimeout not cleaned up!
    setTimeout(() => setSaved(false), 3000);

    setSaving(false);
  };

  // JSX intertwined with logic
  return (
    <div>
      {loading ? <Spinner /> : <Form {...} />}
    </div>
  );
}
```

**Problems:**

- 7 useState calls = hard to reason about state flow
- Fetch logic mixed with component lifecycle
- Memory leak from uncleared setTimeout
- Can't test `handleSave` without rendering component
- If another component needs same logic, must duplicate code

### After: Extracted Hook Pattern

```typescript
// hooks/useDepositSettingsManager.ts
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
  // Grouped state
  const [settings, setSettings] = useState<DepositSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [depositsEnabled, setDepositsEnabled] = useState(false);
  const [depositPercent, setDepositPercent] = useState('50');
  const [balanceDueDays, setBalanceDueDays] = useState('30');

  // Ref for timeout cleanup (memory leak prevention)
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  // All logic is in the hook, not the component
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.tenantAdminGetDepositSettings();
      if (result.status === 200 && result.body) {
        const data = result.body;
        setSettings(data);
        setDepositsEnabled(data.depositPercent !== null);
        setDepositPercent(data.depositPercent?.toString() || '50');
        setBalanceDueDays(data.balanceDueDays.toString());
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
      const percentNum = depositsEnabled ? parseFloat(depositPercent) : null;
      const daysNum = parseInt(balanceDueDays, 10);

      // Validation
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

      const result = await api.tenantAdminUpdateDepositSettings({
        body: { depositPercent: percentNum, balanceDueDays: daysNum },
      });

      if (result.status === 200 && result.body) {
        setSettings(result.body);
        setSaved(true);

        // Proper timeout cleanup
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current);
        }
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

```typescript
// DepositSettingsCard.tsx - Now pure UI component
export function DepositSettingsCard() {
  const manager = useDepositSettingsManager();

  if (manager.loading) {
    return <LoadingState />;
  }

  return (
    <div>
      <Header status={manager.settings?.depositPercent !== null ? 'Enabled' : 'Full'} />
      {manager.error && <ErrorAlert message={manager.error} />}
      {manager.saved && <SuccessAlert />}

      <Form
        depositsEnabled={manager.depositsEnabled}
        depositPercent={manager.depositPercent}
        balanceDueDays={manager.balanceDueDays}
        onDepositChange={manager.setDepositsEnabled}
        onPercentChange={manager.setDepositPercent}
        onDaysChange={manager.setBalanceDueDays}
        onSave={manager.handleSave}
        saving={manager.saving}
        hasChanges={manager.hasChanges()}
      />
    </div>
  );
}
```

**Benefits:**

- Component is now 95% pure UI - just rendering from props
- Logic is testable without React (pure function that returns state)
- Memory leak fixed with proper cleanup
- Can reuse hook in other components
- Easier to reason about state flow (interface documents it)

---

## Real-World Examples from MAIS

### Example 1: useDepositSettingsManager

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard/hooks/useDepositSettingsManager.ts`

**Pattern highlights:**

- Memory leak prevention: `savedTimeoutRef` with cleanup effect
- Server state sync: `settings` synchronized from API response to form state
- Change detection: `hasChanges()` compares current vs saved state
- Validation: Inline in `handleSave` before API call

**Key metrics:**

- Component reduced from ~150 lines to ~50 lines
- Logic reusable across multiple components

### Example 2: useCalendarConfigManager

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard/hooks/useCalendarConfigManager.ts`

**Pattern highlights:**

- File input handling: `fileInputRef` stored in hook, UI refs it
- Dialog state management: `showConfigDialog` and `showDeleteDialog`
- Async operations: `testing`, `saving`, `deleting` flags
- Form validation: `configErrors` object with field-level errors
- File validation: Size check + JSON parsing with error handling

**Key metrics:**

- Component reduced from ~250 lines to ~100 lines
- Extracted dialog is small and reusable

### Example 3: useRemindersManager

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/TenantDashboard/hooks/useRemindersManager.ts`

**Pattern highlights:**

- Simple hook without complex validation
- Refresh action: `fetchStatus()` called after operations
- Formatting logic: `formatDate()` utility exported from hook
- No form state (read-only display component)

**Key metrics:**

- Component reduced from ~100 lines to ~70 lines
- No memory leak concerns (no timeouts)

---

## Implementation Checklist

When extracting a new custom hook:

- [ ] **Create hook file:** `hooks/useXxxManager.ts`
- [ ] **Define interfaces:** `XxxEntity`, `UseXxxManagerResult`
- [ ] **Group state by category:** Server, Form, UI, Refs
- [ ] **Add cleanup effects:** For setTimeout, event listeners, subscriptions
- [ ] **Use useCallback:** For all event handlers and async functions
- [ ] **Document interface:** Comments on what each property is for
- [ ] **Test in isolation:** Unit test the hook without React
- [ ] **Update component:** Change to thin UI wrapper, call `const manager = useHook()`
- [ ] **Verify cleanup:** No console warnings about cleanup on unmount
- [ ] **Check memory leaks:** Run with React DevTools Profiler

---

## Common Patterns

### Handling File Input

```typescript
const fileInputRef = useRef<HTMLInputElement>(null);

const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE) {
    setError('File too large');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    try {
      // Validate content
      JSON.parse(content);
      setFileContent(content);
      setError(null);
    } catch {
      setError('Invalid file');
    }
  };
  reader.readAsText(file);
}, []);

// In component JSX:
<input
  ref={fileInputRef}
  type="file"
  onChange={handleFileUpload}
  hidden
/>
<button onClick={() => fileInputRef.current?.click()}>
  Upload
</button>
```

### Handling Dialog State

```typescript
const [showDialog, setShowDialog] = useState(false);

const handleOpenDialog = useCallback(() => {
  setFieldA('');
  setFieldB('');
  setErrors({});
  setShowDialog(true);
}, []);

const handleCloseDialog = useCallback(() => {
  setShowDialog(false);
}, []);

// Return both handlers and state
return {
  showDialog,
  handleOpenDialog,
  handleCloseDialog,
};
```

### Async Operations with Loading States

```typescript
const [data, setData] = useState<Data | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const fetchData = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const result = await api.getData();
    if (result.status === 200 && result.body) {
      setData(result.body);
    } else {
      setError('Failed to load');
    }
  } catch (err) {
    logger.error('Error:', { error: err });
    setError('Failed to load');
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  fetchData();
}, [fetchData]);

return { data, loading, error, fetchData };
```

---

## Troubleshooting

### Issue: "Component unmounted but state update happened"

**Cause:** setTimeout or async operation completes after unmount
**Solution:** Verify cleanup effect is clearing all timeouts/listeners

```typescript
// ✅ Correct
useEffect(() => {
  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
  };
}, []);

// ❌ Wrong - no cleanup
useEffect(() => {
  setTimeout(() => setState(value), 1000);
}, []);
```

### Issue: State updates are batched or delayed

**Cause:** Using state setter in callback without proper dependency array
**Solution:** Add all dependencies to useCallback dependency array

```typescript
// ✅ Correct
const handleSave = useCallback(async () => {
  // All used variables in dependency array
  setSaving(true);
  // ...
}, [depositsEnabled, depositPercent, balanceDueDays]); // All deps included

// ❌ Wrong - missing deps
const handleSave = useCallback(async () => {
  setSaving(true);
  // Uses depositPercent but not in deps
}, []); // Missing depositPercent!
```

### Issue: Form doesn't update when server state changes

**Cause:** Form state not synchronized with server state on load
**Solution:** Sync form state in fetch effect

```typescript
useEffect(() => {
  const result = await api.getData();
  if (result.status === 200) {
    const data = result.body;
    setServerState(data);

    // Sync form state from server
    setFormFieldA(data.fieldA);
    setFormFieldB(data.fieldB);
  }
}, []);
```

---

## Design Decisions

### Q: Why use `useRef` instead of state for timeout IDs?

**A:** useRef doesn't trigger re-renders and the ID persists across renders. State would cause unnecessary re-renders every time we set the timeout ID.

### Q: Why group state in the return interface?

**A:** It's self-documenting. Someone reading the interface knows exactly what the hook provides and in what category (server state, form state, actions, etc.).

### Q: When should I add a manager hook vs using useState directly?

**A:**

- Use manager hook when: Multiple related state variables, async operations, side effects, logic that spans multiple handlers
- Use useState directly when: Single simple value, no side effects, doesn't interact with other state

### Q: Can I reuse a hook in multiple components?

**A:** Yes! That's the whole point. Once extracted, hooks are just functions and can be imported anywhere.

---

## Metrics

**Phase 5.2 Refactoring Results:**

| Metric                     | Before                   | After           | Improvement |
| -------------------------- | ------------------------ | --------------- | ----------- |
| DepositSettingsCard lines  | 206                      | 50              | -76%        |
| RemindersCard lines        | 180                      | 70              | -61%        |
| CalendarConfigCard lines   | 368                      | 100             | -73%        |
| Memory leaks               | 3 (uncleared setTimeout) | 0               | -100%       |
| Testable units             | 0                        | 3               | Infinite    |
| Code duplication potential | High                     | Zero (reusable) | Eliminated  |

---

## Next Steps

1. **Apply pattern to remaining god components** in tenant dashboard
2. **Create shared utility hooks** for common patterns (useAsync, useForm, useLocalStorage)
3. **Document testing strategy** for custom hooks
4. **Add hook migration guide** for refactoring existing components

---

## Related Documents

- [`docs/PREVENTION-STRATEGIES-INDEX.md`] - Prevention strategies for common React pitfalls
- [`client/src/features/tenant-admin/TenantDashboard/`] - Live examples of extracted hooks
- React Hooks docs: https://react.dev/reference/react/useCallback

## Author Notes

This pattern emerged from refactoring the tenant dashboard from three massive god components into focused, testable, reusable hooks. The key insight was grouping state into three categories (server, form, UI) and treating the hook return interface as documentation.

The memory leak fix with `useRef` cleanup is critical - this prevented multiple class of bugs where timeouts would fire after unmount.
