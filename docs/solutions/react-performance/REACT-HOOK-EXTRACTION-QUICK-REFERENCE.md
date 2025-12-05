---
title: 'React Hook Extraction - Quick Reference'
category: 'react-performance'
date: 2025-12-05
---

# React Hook Extraction - Quick Reference

## Decision Tree (30 seconds)

```
Component complexity increasing?

6+ useState?                  → Extract to useXxxManager
API calls in component?       → Extract to useXxxManager
3+ useEffect calls?           → Extract to hook
Component >200 lines?         → Extract business logic
Reused in 2+ components?      → Extract to hook
Hard to test without hook?    → Extract to hook

→ Extract to hook
→ Otherwise: refactor when needed
```

## The Four Hook Patterns

### 1. Manager Hook (State + Actions)

**When:** Complex state + multiple async operations

```typescript
export function useRemindersManager() {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = useCallback(async () => { ... }, []);
  const handleProcess = useCallback(async () => { ... }, [fetchStatus]);

  return { status, loading, error, fetchStatus, handleProcess };
}

// In component: simple UI
const manager = useRemindersManager();
return <button onClick={manager.handleProcess}>{manager.status?.count}</button>;
```

### 2. Data Fetching Hook

**When:** Primary job is loading data

```typescript
export function useDashboardData(activeTab: string) {
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    const result = await api.getPackages();
    setPackages(result.body);
  }, []);

  useEffect(() => {
    if (activeTab === 'packages') load();
  }, [activeTab, load]);

  return { packages, isLoading, load };
}
```

### 3. Form State Hook

**When:** Complex form with multiple fields + validation

```typescript
export function useCalendarConfigManager() {
  const [calendarId, setCalendarId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [configErrors, setConfigErrors] = useState<ConfigErrors>({});
  const [showDialog, setShowDialog] = useState(false);

  const handleSaveConfig = useCallback(async () => {
    // Validate, save, handle errors
  }, [calendarId, serviceAccountJson]);

  return {
    calendarId,
    setCalendarId,
    configErrors,
    showDialog,
    handleSaveConfig,
  };
}
```

### 4. Computed Value Hook

**When:** Expensive calculations on props

```typescript
export function useBookingTotal(basePriceCents: number, selectedAddOnIds: Set<string>) {
  return useMemo(() => {
    let total = basePriceCents;
    for (const id of selectedAddOnIds) {
      total += addOns[id].price;
    }
    return total / 100; // Convert to dollars
  }, [basePriceCents, selectedAddOnIds]);
}
```

## Checklist - Before Extraction

```markdown
- [ ] Component has 6+ useState OR 3+ useEffect OR 200+ lines
- [ ] Hook will have at least 30 lines (not over-abstraction)
- [ ] All API calls abstracted (no api.xxx in component)
- [ ] All business logic moved (no complex conditionals in component)
- [ ] Return type defined (UseXxxManagerResult interface)
- [ ] All callbacks use useCallback with complete dependencies
- [ ] Hook tested with .test.ts file (80%+ coverage)
```

## Checklist - Component After Extraction

```markdown
- [ ] Component <150 lines
- [ ] Component only renders UI
- [ ] No state management (uses hook)
- [ ] No API calls
- [ ] No useEffect (only hook has effects)
- [ ] JSX is clean and readable
```

## Common Mistakes & Fixes

### ❌ Over-Extraction (Too Simple)

```typescript
// DON'T extract this
function useToggle() {
  const [value, setValue] = useState(false);
  const toggle = useCallback(() => setValue(!value), [value]);
  return [value, toggle];
}

// Just use useState
const [isOpen, setIsOpen] = useState(false);
<button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
```

### ❌ Incomplete Dependencies

```typescript
// DON'T do this
const fetchStatus = useCallback(async () => {
  const result = await api.getStatus();
  setStatus(result);
}, []); // ❌ Missing nothing, but wrong pattern

useEffect(() => {
  fetchStatus();
}, [fetchStatus]); // ✅ Lists fetchStatus correctly
```

### ❌ Not Memoizing Callbacks

```typescript
// DON'T do this
function useCalendar() {
  const [status, setStatus] = useState(null);

  // ❌ New function every render
  const fetchStatus = async () => {
    setStatus(await api.getStatus());
  };

  useEffect(() => {
    fetchStatus(); // ❌ Infinite loop!
  }, [fetchStatus]);
}

// DO this
function useCalendar() {
  const [status, setStatus] = useState(null);

  // ✅ Memoized, stable reference
  const fetchStatus = useCallback(async () => {
    setStatus(await api.getStatus());
  }, []);

  useEffect(() => {
    fetchStatus(); // ✅ Runs once
  }, []);
}
```

### ❌ Exposing Setters

```typescript
// DON'T do this
return { status, setStatus }; // ❌ Component can bypass logic

// DO this
return { status, fetchStatus }; // ✅ Only controlled methods
```

## Code Patterns

### Hook Template

```typescript
/**
 * use{FeatureName}Manager Hook
 *
 * Manages {feature} state and operations.
 * Extracted from {Component} for testability and reusability.
 */

export interface Use{FeatureName}ManagerResult {
  // State
  status: Status | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetch: () => Promise<void>;
  handle{Action}: () => Promise<void>;
}

export function use{FeatureName}Manager(): Use{FeatureName}ManagerResult {
  // 1. State
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. Mount effects
  useEffect(() => {
    fetch();
  }, []);

  // 3. Memoized callbacks
  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getStatus();
      if (result.status === 200) {
        setStatus(result.body);
      } else {
        setError('Failed');
      }
    } catch (err) {
      logger.error('Error:', { error: err });
      setError('Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // 4. Return typed object
  return { status, loading, error, fetch };
}
```

### Component Using Hook

```typescript
export function MyComponent() {
  const manager = useHook();

  if (manager.loading) return <Loader />;

  return (
    <div>
      {manager.error && <Error message={manager.error} />}
      <div>{manager.status?.data}</div>
      <button onClick={manager.handleAction}>Action</button>
    </div>
  );
}
```

### Test Template

```typescript
describe('use{FeatureName}Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with correct state', () => {
    const { result } = renderHook(() => use{FeatureName}Manager());
    expect(result.current.loading).toBe(true);
  });

  it('fetches data on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => use{FeatureName}Manager());
    await waitForNextUpdate();
    expect(result.current.status).toBeDefined();
  });

  it('handles errors gracefully', async () => {
    api.getStatus = jest.fn().mockRejectedValue(new Error('Failed'));
    const { result, waitForNextUpdate } = renderHook(() => use{FeatureName}Manager());
    await waitForNextUpdate();
    expect(result.current.error).toBeTruthy();
  });
});
```

## File Structure

```
src/features/feature/
├── SomeCard.tsx              ← Component (uses hook)
├── hooks/
│   ├── useSomeManager.ts     ← Hook logic
│   └── useSomeManager.test.ts ← Hook tests (80%+ coverage)
└── types.ts                  ← Types used by hook & component
```

## Naming Convention

| Pattern | Name | Example |
|---------|------|---------|
| Manager (state + actions) | `use{Feature}Manager` | `useRemindersManager` |
| Data fetching | `use{Resource}` | `usePackages` |
| Form state | `use{Feature}Form` | `useCalendarConfigForm` |
| Computed values | `use{Adjective}{Noun}` | `useBookingTotal` |
| Context | `use{Context}` | `useAuth` |

## Key Rules

1. **Extract when:** 6+ useState, 3+ useEffect, 200+ lines, API calls, reusability
2. **Don't extract:** Simple state (1-2 useState), component-specific UI state
3. **Memoize:** All callbacks that are dependencies → useCallback
4. **Test:** Every hook → 80%+ coverage, .test.ts file
5. **Type:** Return type interface explicitly defined
6. **Document:** JSDoc comment on hook

## ESLint Checks

```bash
# Run before committing
npm run lint

# Should pass:
# - react-hooks/rules-of-hooks
# - react-hooks/exhaustive-deps
# - no-console
```

## Before Submitting PR

```markdown
- [ ] Hook extracted to hooks/ directory
- [ ] Return type interface defined
- [ ] All callbacks use useCallback
- [ ] Dependency arrays complete (ESLint passes)
- [ ] Tests written (80%+ coverage)
- [ ] Component simplified (50%+ line reduction)
- [ ] No API calls in component
- [ ] No console.log or logger in component business logic
- [ ] JSDoc comment present
```

## Common Patterns in MAIS

### Example 1: useRemindersManager

**Hook:** 120 lines
**Component:** 80 lines
**Tests:** 15 test cases

State management + async operations for reminder processing.

**Pattern:** Manager hook (state + actions)

### Example 2: useDashboardData

**Hook:** 150 lines
**Component:** 50 lines (much simplified)

Parallel loading of packages, segments, blackouts on tab change.

**Pattern:** Data fetching hook with derived values (useMemo)

### Example 3: useCalendarConfigManager

**Hook:** 300+ lines
**Component:** 240 lines (CalendarConfigCard + ConfigDialog)

Form state + multiple dialogs + file upload + validation.

**Pattern:** Complex form state hook (state + dialogs + file handling)

---

## Quick Decision Matrix

| Scenario | Extract? | Pattern |
|----------|----------|---------|
| 1 useState toggle | ❌ No | Keep in component |
| 3 useState (counters) | ❌ No | Keep in component |
| 6+ useState (grouped) | ✅ Yes | useXxxManager |
| API call, no deps | ✅ Yes | useDataFetching |
| Complex form (5+ fields) | ✅ Yes | useXxxForm |
| Reused in 2+ components | ✅ Yes | useXxx |
| Hard to test | ✅ Yes | Extract logic |
| Component >200 lines | ✅ Yes | Extract business logic |

---

**Print & Pin This!**

**Key Takeaway:** Extract when component has complex state + business logic. Keep component small and focused on rendering. Always test the hook (80%+). Always memoize callbacks.

---

**Last Updated:** 2025-12-05
**Part of:** [React Hook Extraction Prevention Strategy](./REACT-HOOK-EXTRACTION-PREVENTION.md)
