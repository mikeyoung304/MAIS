---
title: 'React Custom Hook Extraction Prevention Strategy'
category: 'react-performance'
severity: ['p1', 'p2', 'p3']
components:
  - 'TenantDashboard'
  - 'RemindersCard'
  - 'CalendarConfigCard'
  - 'DepositSettingsCard'
tags:
  - 'custom-hooks'
  - 'hook-extraction'
  - 'testability'
  - 'component-complexity'
  - 'separation-of-concerns'
date_solved: '2025-12-05'
related_hooks:
  - 'useRemindersManager'
  - 'useCalendarConfigManager'
  - 'useDepositSettingsManager'
  - 'useDashboardData'
related_docs:
  - 'react-hooks-performance-wcag-review.md'
  - 'REACT-MEMOIZATION-PREVENTION-STRATEGY.md'
---

# React Custom Hook Extraction Prevention Strategy

## Problem Statement

Three dashboard components (RemindersCard, CalendarConfigCard, DepositSettingsCard) had extracted custom hooks (useRemindersManager, useCalendarConfigManager, useDepositSettingsManager) to improve testability and separation of concerns. This document defines when and how to extract hooks, what patterns to follow, and testing requirements for extracted hooks.

### Why Extract Hooks?

Custom hooks encapsulate stateful logic and allow:

1. **Testability** - Test business logic without React components
2. **Reusability** - Use same hook in multiple components
3. **Separation of Concerns** - Component handles UI, hook handles state/logic
4. **Maintainability** - Smaller components are easier to understand
5. **Performance** - Easier to memoize callbacks and values

### When NOT to Extract

- Logic used only once (premature abstraction)
- Simple state (useState count or toggle)
- UI state tightly coupled to component (form focus, animations)

---

## Part 1: Code Review Checklist - When to Extract a Hook

Use this checklist to decide if a component needs hook extraction:

### Red Flags: High Complexity Components

#### 1. Multiple useState Calls (>5)

**Warning Sign:**

```typescript
// ❌ BAD - Multiple unrelated state values
function RemindersCard() {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // 30+ lines of handlers...
}
```

**Solution:**

```typescript
// ✅ GOOD - Business logic extracted, UI remains clean
function RemindersCard() {
  const manager = useRemindersManager();

  return (
    // Simple JSX using manager properties
  );
}
```

**Checklist:**

- [ ] Component has 6+ useState calls
- [ ] States logically group together (all API-related, all form-related)
- [ ] Extract to hook named `use{ComponentName}Manager` or `use{Feature}State`
- [ ] Hook returns object with properties and methods
- [ ] Component becomes <150 lines after extraction

#### 2. API Calls Directly in Component

**Warning Sign:**

```typescript
// ❌ BAD - API logic mixed with JSX
function CalendarConfigCard() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);

  useEffect(() => {
    // Direct API calls in component
    api.tenantAdminGetCalendarStatus().then((result) => {
      if (result.status === 200) {
        setStatus(result.body);
      }
    });
  }, []);

  const handleSave = async () => {
    const result = await api.tenantAdminSaveCalendarConfig({
      body: { calendarId, serviceAccountJson },
    });
  };
}
```

**Solution:**

```typescript
// ✅ GOOD - API calls abstracted to hook
function CalendarConfigCard() {
  const manager = useCalendarConfigManager();

  useEffect(() => {
    manager.fetchStatus();
  }, []);

  const handleSave = () => manager.handleSaveConfig();
}
```

**Checklist:**

- [ ] Component calls API directly (not through hook or service)
- [ ] API calls mixed with UI logic
- [ ] Extract to hook with clear method names (fetchStatus, handleSave, etc.)
- [ ] Hook handles all error states
- [ ] Component never calls api directly (only through hook methods)

#### 3. Complex useEffect with Cleanup

**Warning Sign:**

```typescript
// ❌ BAD - Multiple useEffect calls with complex dependencies
function CalendarConfigCard() {
  useEffect(() => {
    setLoading(true);
    fetchStatus().catch(err => {
      logger.error(...);
      setError('Failed');
    });
  }, []);

  useEffect(() => {
    if (!showDialog) {
      setCalendarId('');
      setServiceAccountJson('');
      setConfigErrors({});
    }
  }, [showDialog]);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      setServiceAccountJson(content);
    };
    // Manual cleanup...
  }, []);
}
```

**Solution:**

```typescript
// ✅ GOOD - useEffect logic encapsulated in hook
function useCalendarConfigManager() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Single, focused useEffect
  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setServiceAccountJson(content);
    };
    reader.readAsText(file);
  }, []);

  return { status, loading, handleFileUpload, ... };
}
```

**Checklist:**

- [ ] Component has 3+ useEffect calls
- [ ] useEffect dependencies are complex (4+ dependencies)
- [ ] Cleanup logic is non-trivial (FileReader, event listeners, timers)
- [ ] Extract to hook
- [ ] Hook consolidates related effects into minimal number
- [ ] Each effect has clear, single responsibility

#### 4. Business Logic Mixed with JSX

**Warning Sign:**

```typescript
// ❌ BAD - Business logic scattered in JSX
function RemindersCard() {
  const [status, setStatus] = useState<ReminderStatus | null>(null);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const result = await api.tenantAdminProcessReminders({ body: undefined });
      if (result.status === 200 && result.body) {
        setProcessResult(result.body);
        // Refresh status logic mixed in
        const refreshResult = await api.tenantAdminGetReminderStatus();
        if (refreshResult.status === 200) {
          setStatus(refreshResult.body);
        }
      } else {
        setError('Failed to process reminders');
      }
    } catch (err) {
      logger.error('Error processing reminders:', { error: err });
      setError('Failed to process reminders');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <button onClick={handleProcess}>Process</button>
      {/* Complex JSX with conditional logic... */}
    </div>
  );
}
```

**Solution:**

```typescript
// ✅ GOOD - Business logic encapsulated, component focused on UI
function useRemindersManager() {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  const handleProcessReminders = useCallback(async () => {
    setProcessing(true);
    setError(null);
    setProcessResult(null);

    try {
      const result = await api.tenantAdminProcessReminders({ body: undefined });
      if (result.status === 200 && result.body) {
        setProcessResult(result.body);
        await fetchStatus();  // Encapsulated refresh logic
      } else {
        setError('Failed to process reminders');
      }
    } catch (err) {
      logger.error('Error processing reminders:', { error: err });
      setError('Failed to process reminders');
    } finally {
      setProcessing(false);
    }
  }, []);

  return { status, processing, processResult, handleProcessReminders };
}

function RemindersCard() {
  const manager = useRemindersManager();

  return (
    <div>
      <button onClick={manager.handleProcessReminders}>Process</button>
      {/* Simple, readable JSX */}
    </div>
  );
}
```

**Checklist:**

- [ ] Component has async operations (API calls, data transformation)
- [ ] Business logic takes up >30% of component code
- [ ] Extract business logic to hook
- [ ] Hook methods are well-named (handleSave, fetchStatus, etc.)
- [ ] Component <150 lines after extraction

---

## Part 2: Warning Signs - What to Look For During Code Review

### A. Too Many useState Calls

**Pattern to detect:**

```bash
grep -n "useState" component.tsx | wc -l
# If > 5, consider extraction
```

**Code review comment:**

```markdown
This component has 7 useState calls. Consider extracting related state to a custom hook:

✅ Suggested extraction:

- Server state (status, loading, error) → useDataFetching()
- Form state (values, errors) → useForm()
- UI state (showDialog, expanded) → remains in component

This will make the component easier to test and maintain.
```

### B. API Calls Not Abstracted

**Pattern to detect:**

```bash
grep -n "api\." component.tsx
# If any matches, API should be in hook not component
```

**Code review comment:**

````markdown
API calls should not be in components. Extract to hook:

❌ Before:

```typescript
useEffect(() => {
  api.getStatus().then(setStatus);
}, []);
```
````

✅ After:

```typescript
function useStatusManager() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    api.getStatus().then(setStatus);
  }, []);
  return { status };
}
```

````

### C. Complex useEffect Chains

**Pattern to detect:**

```bash
grep -c "useEffect" component.tsx
# If > 3, review each effect for necessity
````

**Code review comment:**

```markdown
This component has 4 useEffect calls. Review for consolidation:

**Potential consolidations:**

1. Effects with same dependencies → merge
2. Related state updates → extract to hook
3. Cleanup logic → extract to hook method

After consolidation, aim for 1-2 useEffect calls in component (for side effects that need rerender).
```

### D. Component Line Count

**Pattern to detect:**

```bash
wc -l component.tsx
# If > 200 lines, likely needs extraction
```

**Code review comment:**

```markdown
This component is 250 lines. After extracting the data management hook, it should be <150.

**Suggested extractions:**

- useRemindersManager (50 lines) ← all state and API calls
- RemindersCard (100 lines) ← UI only
```

---

## Part 3: Testing Requirements for Extracted Hooks

### Basic Hook Testing Pattern

**Hook must have accompanying test file:**

```
useRemindersManager.ts       ← Hook
useRemindersManager.test.ts  ← Tests
```

### Test Coverage Checklist

#### 1. Initialization Tests

```typescript
describe('useRemindersManager', () => {
  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useRemindersManager());

    expect(result.current.status).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.processing).toBe(false);
  });

  it('fetches status on mount', async () => {
    const mockResponse = { status: 200, body: { pendingCount: 5 } };
    api.tenantAdminGetReminderStatus = jest.fn().mockResolvedValue(mockResponse);

    const { result, waitForNextUpdate } = renderHook(() => useRemindersManager());

    await waitForNextUpdate();

    expect(result.current.status).toEqual(mockResponse.body);
    expect(result.current.loading).toBe(false);
  });
});
```

#### 2. Action Tests

```typescript
describe('useRemindersManager - actions', () => {
  it('handleProcessReminders updates state correctly', async () => {
    api.tenantAdminProcessReminders = jest.fn().mockResolvedValue({
      status: 200,
      body: { processed: 3, failed: 0 },
    });
    api.tenantAdminGetReminderStatus = jest.fn().mockResolvedValue({
      status: 200,
      body: { pendingCount: 0 },
    });

    const { result, waitForNextUpdate } = renderHook(() => useRemindersManager());

    act(() => {
      result.current.handleProcessReminders();
    });

    expect(result.current.processing).toBe(true);

    await waitForNextUpdate();

    expect(result.current.processing).toBe(false);
    expect(result.current.processResult).toEqual({ processed: 3, failed: 0 });
  });

  it('clears error on successful fetch', async () => {
    api.tenantAdminGetReminderStatus = jest.fn().mockResolvedValue({
      status: 200,
      body: { pendingCount: 5 },
    });

    const { result, waitForNextUpdate } = renderHook(() => useRemindersManager());

    // Simulate previous error state
    act(() => {
      result.current.error = 'Previous error';
    });

    act(() => {
      result.current.fetchStatus();
    });

    await waitForNextUpdate();

    expect(result.current.error).toBeNull();
  });
});
```

#### 3. Error Handling Tests

```typescript
describe('useRemindersManager - error handling', () => {
  it('sets error on API failure', async () => {
    api.tenantAdminProcessReminders = jest.fn().mockRejectedValue(new Error('Network error'));

    const { result, waitForNextUpdate } = renderHook(() => useRemindersManager());

    act(() => {
      result.current.handleProcessReminders();
    });

    await waitForNextUpdate();

    expect(result.current.error).toEqual('Failed to process reminders');
  });

  it('handles non-200 status codes gracefully', async () => {
    api.tenantAdminGetReminderStatus = jest.fn().mockResolvedValue({
      status: 500,
      body: null,
    });

    const { result, waitForNextUpdate } = renderHook(() => useRemindersManager());

    await waitForNextUpdate();

    expect(result.current.error).toEqual('Failed to fetch reminder status');
  });
});
```

#### 4. State Update Tests

```typescript
describe('useRemindersManager - state updates', () => {
  it('formatDate formats dates correctly', () => {
    const { result } = renderHook(() => useRemindersManager());

    const formatted = result.current.formatDate('2025-12-15');

    expect(formatted).toBe('Dec 15, 2025');
  });
});
```

### Hook Test Template

Create `/client/src/features/tenant-admin/TenantDashboard/hooks/useRemindersManager.test.ts`:

```typescript
/**
 * Tests for useRemindersManager hook
 *
 * Covers:
 * - Initialization and mount side effects
 * - Async operations and state updates
 * - Error handling
 * - Edge cases
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useRemindersManager } from './useRemindersManager';
import { api } from '@/lib/api';

// Mock API
jest.mock('@/lib/api');

describe('useRemindersManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('initializes with correct default state', () => {
      // Implementation...
    });

    it('fetches status on mount', async () => {
      // Implementation...
    });
  });

  describe('actions', () => {
    it('handleProcessReminders updates state correctly', async () => {
      // Implementation...
    });
  });

  describe('error handling', () => {
    it('sets error on API failure', async () => {
      // Implementation...
    });
  });

  describe('utilities', () => {
    it('formatDate works correctly', () => {
      // Implementation...
    });
  });
});
```

### Required Test Coverage

For extracted hooks, require **80%+ code coverage**:

```typescript
// In jest.config.ts
{
  collectCoverageFrom: [
    'src/features/**/hooks/**/*.ts',
    '!**/*.test.ts',
    '!**/index.ts'
  ],
  coverageThreshold: {
    'src/features/**/hooks/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

---

## Part 4: Hook Implementation Patterns

### Pattern 1: Manager Hooks (State + Actions)

**Use for:** Card components with complex state management

```typescript
/**
 * useRemindersManager Hook
 *
 * Manages all reminder-related state and operations
 * Extracted from RemindersCard for testability
 */

export function useRemindersManager(): UseRemindersManagerResult {
  // 1. State declarations
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. Mount side effects
  useEffect(() => {
    fetchStatus();
  }, []);

  // 3. Memoized callbacks
  const fetchStatus = useCallback(async () => {
    // Implementation...
  }, []);

  const handleProcessReminders = useCallback(async () => {
    // Implementation...
  }, [fetchStatus]); // Depends on fetchStatus

  // 4. Utility functions
  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  // 5. Return typed object
  return {
    status,
    loading,
    error,
    handleProcessReminders,
    formatDate,
  };
}
```

**Component using manager hook:**

```typescript
export function RemindersCard() {
  const manager = useRemindersManager();

  if (manager.loading) {
    return <Loader />;
  }

  return (
    <div>
      <p>{manager.status?.pendingCount} pending</p>
      <button onClick={manager.handleProcessReminders}>Process</button>
    </div>
  );
}
```

### Pattern 2: Data Fetching Hooks

**Use for:** Hooks that primarily fetch data

```typescript
/**
 * useDashboardData Hook
 *
 * Loads packages, segments, and blackouts for dashboard tabs
 * Uses parallel loading for performance
 */

export function useDashboardData(activeTab: string) {
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadPackagesAndSegments = useCallback(async () => {
    setIsLoading(true);
    try {
      // Parallel loading for performance
      const [packagesResult, segmentsResult] = await Promise.all([
        api.tenantAdminGetPackages(),
        api.tenantAdminGetSegments(),
      ]);

      if (packagesResult.status === 200) {
        setPackages(packagesResult.body);
      }
      if (segmentsResult.status === 200) {
        setSegments(segmentsResult.body);
      }
    } catch (error) {
      logger.error('Failed to load packages/segments:', { error });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'packages') {
      loadPackagesAndSegments();
    }
  }, [activeTab, loadPackagesAndSegments]);

  // Derived state (useMemo for performance)
  const grouped = useMemo<SegmentWithPackages[]>(() => {
    return segments.map((seg) => ({
      ...seg,
      packages: packages.filter((p) => p.segmentId === seg.id),
    }));
  }, [segments, packages]);

  return {
    packages,
    segments,
    grouped,
    isLoading,
    loadPackages: loadPackagesAndSegments,
  };
}
```

### Pattern 3: Form State Hooks

**Use for:** Complex form state management

```typescript
/**
 * useCalendarConfigManager Hook
 *
 * Manages calendar configuration form state, dialogs, and API operations
 * Extracted from CalendarConfigCard for testability
 */

export function useCalendarConfigManager(): UseCalendarConfigManagerResult {
  // Server state
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [calendarId, setCalendarId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [configErrors, setConfigErrors] = useState<ConfigErrors>({});

  // Refs for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mount side effects
  useEffect(() => {
    fetchStatus();
  }, []);

  // Memoized callbacks
  const fetchStatus = useCallback(async () => {
    // Implementation...
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setConfigErrors((prev) => ({
        ...prev,
        serviceAccountJson: 'File too large',
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        JSON.parse(content);
        setServiceAccountJson(content);
        setConfigErrors((prev) => ({ ...prev, serviceAccountJson: undefined }));
      } catch {
        setConfigErrors((prev) => ({
          ...prev,
          serviceAccountJson: 'Invalid JSON file',
        }));
      }
    };
    reader.readAsText(file);
  }, []);

  const handleSaveConfig = useCallback(async () => {
    const errors: ConfigErrors = {};

    // Validation
    if (!calendarId.trim()) {
      errors.calendarId = 'Calendar ID is required';
    }
    if (!serviceAccountJson.trim()) {
      errors.serviceAccountJson = 'Service account JSON is required';
    }

    if (Object.keys(errors).length > 0) {
      setConfigErrors(errors);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await api.tenantAdminSaveCalendarConfig({
        body: {
          calendarId: calendarId.trim(),
          serviceAccountJson: serviceAccountJson.trim(),
        },
      });

      if (result.status === 200 && result.body?.success) {
        setShowConfigDialog(false);
        await fetchStatus();
      } else {
        setError('Failed to save calendar configuration');
      }
    } catch (err) {
      logger.error('Error saving calendar config:', { error: err });
      setError('Failed to save calendar configuration');
    } finally {
      setSaving(false);
    }
  }, [calendarId, serviceAccountJson, fetchStatus]);

  return {
    // Server state
    status,
    loading,
    error,
    saving,

    // Dialog state
    showConfigDialog,
    showDeleteDialog,

    // Form state
    calendarId,
    serviceAccountJson,
    configErrors,

    // Refs
    fileInputRef,

    // Actions
    fetchStatus,
    handleFileUpload,
    handleSaveConfig,
    // ... other methods
  };
}
```

---

## Part 5: ESLint Rule Suggestions

Add to `.eslintrc.json` to enforce good hook practices:

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    // Enforce rules of hooks
    "react-hooks/rules-of-hooks": "error",

    // Enforce complete dependency arrays
    "react-hooks/exhaustive-deps": [
      "warn",
      {
        "additionalHooks": "(useRemindersManager|useCalendarConfigManager|useDashboardData)"
      }
    ],

    // Custom: No useState in extracted hooks without memoization
    "no-restricted-syntax": [
      "warn",
      {
        "selector": "AssignmentExpression[right.type='CallExpression'][right.callee.name='useCallback'][left.parent.type!='VariableDeclarator']",
        "message": "useCallback should be assigned to a variable"
      }
    ]
  }
}
```

### Hook Naming Conventions

Enforce with ESLint custom rule:

```javascript
// .eslintrc-custom-rules.js
module.exports = {
  'hook-naming': {
    meta: {
      docs: {
        description: 'Enforce use* naming for custom hooks',
      },
      messages: {
        badName: 'Hook {{name}} should start with "use"',
      },
    },
    create(context) {
      return {
        FunctionDeclaration(node) {
          if (
            node.parent.type === 'ExportNamedDeclaration' &&
            node.name.startsWith('use') &&
            !node.name.match(/^use[A-Z]/)
          ) {
            context.report({
              node,
              messageId: 'badName',
              data: { name: node.name },
            });
          }
        },
      };
    },
  },
};
```

---

## Part 6: Code Review Checklist

### Before Approving a Hook Extraction PR

#### Hook Structure

- [ ] Hook file: `use{FeatureName}{Aspect}.ts`
- [ ] Hook is at least 30 lines (not over-abstraction)
- [ ] Hook has JSDoc comment explaining purpose
- [ ] Hook return type is explicitly defined (UseRemindersManagerResult)
- [ ] All exported types are defined in hook file or imported

#### State Management

- [ ] All useState calls are grouped at top of hook
- [ ] Related states are conceptually grouped (server state, form state, UI state)
- [ ] Default values are sensible
- [ ] No useState calls inside conditionals or loops

#### Side Effects

- [ ] useEffect has clear purpose (documented)
- [ ] Dependency array is complete and necessary
- [ ] Cleanup functions if needed (FileReader, timers, event listeners)
- [ ] No infinite loops (dependency array checked with ESLint)

#### Callbacks

- [ ] All callbacks passed to components use useCallback
- [ ] Dependencies are complete (ESLint exhaustive-deps passes)
- [ ] Callbacks don't break React.memo in child components
- [ ] Callbacks are memoized if used in dependency arrays of other hooks/effects

#### Performance

- [ ] useMemo used for derived values (filtering, mapping, sorting)
- [ ] No unnecessary object/array creation in render path
- [ ] No expensive computations in tight loops
- [ ] Parallel operations use Promise.all when appropriate

#### Testing

- [ ] Hook has accompanying .test.ts file
- [ ] Test covers initialization
- [ ] Test covers all exported methods
- [ ] Test covers error cases
- [ ] Test coverage >= 80%

#### Component Usage

- [ ] Component file is simplified (lines reduced by 50%+)
- [ ] Component only concerns itself with UI rendering
- [ ] No business logic remains in component
- [ ] Component passes only necessary props to manager

#### Documentation

- [ ] Hook has JSDoc with description, returns, and example
- [ ] Return type interface is documented
- [ ] Complex methods have inline comments
- [ ] Any gotchas documented (e.g., "fetchStatus is auto-called on mount")

### Checklist Template for PRs

```markdown
## Hook Extraction Checklist

### Structure

- [ ] Hook file named correctly (`use{Feature}{Manager|State|Hook}.ts`)
- [ ] Hook is 30+ lines (not premature extraction)
- [ ] JSDoc comment present
- [ ] Return type explicitly defined

### State Management

- [ ] Related states grouped together
- [ ] No useState in conditionals/loops
- [ ] Default values sensible

### Effects & Callbacks

- [ ] All effects have clear purpose
- [ ] Dependency arrays complete (ESLint passes)
- [ ] All callbacks use useCallback
- [ ] Callback dependencies complete

### Performance

- [ ] Derived values use useMemo
- [ ] No unnecessary object/array creation
- [ ] Parallel operations use Promise.all

### Testing

- [ ] .test.ts file exists
- [ ] Covers: init, all methods, errors
- [ ] Coverage >= 80%

### Component Usage

- [ ] Component simplified by 50%+ lines
- [ ] Only UI concerns in component
- [ ] Component passes minimal props

### Documentation

- [ ] JSDoc complete
- [ ] Return type documented
- [ ] Complex methods have comments
```

---

## Part 7: Decision Tree - Should I Extract This?

```
Start: Is this component getting complex?

├─ Does component have 6+ useState calls?
│  └─ YES → Extract to useXxxManager
│  └─ NO  → Continue below
│
├─ Does component call API directly?
│  └─ YES → Extract to useXxxManager
│  └─ NO  → Continue below
│
├─ Does component have 3+ useEffect calls?
│  └─ YES → Extract related effects to hook
│  └─ NO  → Continue below
│
├─ Is component 200+ lines?
│  └─ YES → Extract business logic to hook
│  └─ NO  → Continue below
│
├─ Will this logic be reused in other components?
│  └─ YES → Extract to hook
│  └─ NO  → Continue below
│
├─ Is testing the logic hard without a hook?
│  └─ YES → Extract to hook
│  └─ NO  → Leave as component
│
└─ DECISION: Keep in component (refactor when criteria met)
```

---

## Part 8: Common Mistakes and How to Avoid Them

### Mistake 1: Over-Extraction

**❌ Wrong:**

```typescript
// Too simple to extract
function useToggle() {
  const [value, setValue] = useState(false);
  const toggle = useCallback(() => setValue(!value), [value]);
  return [value, toggle];
}

// This is just useState, don't extract
function Component() {
  const [isOpen, toggleOpen] = useToggle();
  return <button onClick={toggleOpen}>{isOpen ? 'Open' : 'Closed'}</button>;
}
```

**✅ Correct:**

```typescript
// Simple state stays in component
function Component() {
  const [isOpen, setIsOpen] = useState(false);
  return <button onClick={() => setIsOpen(!isOpen)}>{isOpen ? 'Open' : 'Closed'}</button>;
}

// Extract only when: complex state + business logic + reusable
function useRemindersManager() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getStatus().then(setStatus);
  }, []);

  const process = useCallback(async () => {
    // Non-trivial business logic
  }, [status]);

  return { status, error, process };
}
```

### Mistake 2: Incomplete Dependency Arrays

**❌ Wrong:**

```typescript
function useRemindersManager() {
  const [status, setStatus] = useState(null);

  const fetchStatus = useCallback(async () => {
    const result = await api.getStatus();
    setStatus(result);
  }, []); // Missing dependencies!

  useEffect(() => {
    fetchStatus(); // ESLint warning: fetchStatus not in deps
  }, [fetchStatus]);

  return { status, fetchStatus };
}
```

**✅ Correct:**

```typescript
function useRemindersManager() {
  const [status, setStatus] = useState(null);

  const fetchStatus = useCallback(async () => {
    const result = await api.getStatus();
    setStatus(result);
  }, []); // No external dependencies

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]); // Correct: lists fetchStatus

  return { status, fetchStatus };
}
```

### Mistake 3: Not Memoizing Callbacks Used as Dependencies

**❌ Wrong:**

```typescript
function useCalendarManager() {
  const [status, setStatus] = useState(null);

  // ❌ Function recreated on every render
  const fetchStatus = async () => {
    const result = await api.getStatus();
    setStatus(result);
  };

  // ❌ This useEffect runs on every render because fetchStatus changed
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]); // ESLint warning or infinite loop

  return { status, fetchStatus };
}
```

**✅ Correct:**

```typescript
function useCalendarManager() {
  const [status, setStatus] = useState(null);

  // ✅ Memoized callback maintains identity
  const fetchStatus = useCallback(async () => {
    const result = await api.getStatus();
    setStatus(result);
  }, []); // Dependencies: none (doesn't depend on external state)

  // ✅ Effect only runs when fetchStatus changes (which is never)
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, fetchStatus };
}
```

### Mistake 4: Not Testing the Hook

**❌ Wrong:**

```typescript
// Hook written but not tested
function useRemindersManager() {
  // 50 lines of logic
  // Zero tests
}
```

**✅ Correct:**

```typescript
// useRemindersManager.ts - Hook implementation
export function useRemindersManager() { ... }

// useRemindersManager.test.ts - Comprehensive tests
describe('useRemindersManager', () => {
  it('initializes with correct state', () => { ... });
  it('fetches status on mount', () => { ... });
  it('handles errors gracefully', () => { ... });
  // 10+ test cases for full coverage
});
```

### Mistake 5: Exposing Too Much State

**❌ Wrong:**

```typescript
function useRemindersManager() {
  // ❌ Exposes internal state directly
  const [_status, _setStatus] = useState(null);
  const [_loading, _setLoading] = useState(false);
  const [_error, _setError] = useState(null);

  return {
    status: _status,
    setStatus: _setStatus, // ❌ Don't expose setters
    loading: _loading,
    error: _error,
  };
}

// Component can do things we don't want
function RemindersCard() {
  const manager = useRemindersManager();

  // ❌ Component modifies state directly
  manager.setStatus({ pendingCount: 999 }); // Bypass validation
}
```

**✅ Correct:**

```typescript
function useRemindersManager() {
  // ✅ Keep state private, expose only methods
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    // Validates, transforms, handles errors
  }, []);

  return {
    status, // Read-only
    loading, // Read-only
    error, // Read-only
    fetchStatus, // Only controlled method
  };
}
```

---

## Summary

### When to Extract

1. **Complex state:** 6+ useState calls
2. **API calls:** Any api.xxx calls
3. **Multiple effects:** 3+ useEffect calls
4. **Long components:** 200+ lines
5. **Business logic:** State-dependent operations
6. **Reusability:** Used in multiple components
7. **Testability:** Hard to test without extraction

### How to Extract

1. **Create hook file:** `src/features/feature/hooks/use{Name}.ts`
2. **Move state & effects:** Consolidate related logic
3. **Memoize callbacks:** useCallback for all passed methods
4. **Type the return:** Define `Use{Name}Result` interface
5. **Write tests:** .test.ts file with 80%+ coverage
6. **Simplify component:** Remove business logic, keep UI

### What to Test

- Initialization and mount effects
- All exported methods
- Error handling
- State updates
- Integration with component

---

## References

- **Related Docs:**
  - [React Memoization Prevention Strategy](./REACT-MEMOIZATION-PREVENTION-STRATEGY.md)
  - [React Hooks Performance & WCAG Review](../code-review-patterns/react-hooks-performance-wcag-review.md)
  - [React UI Patterns & Audit Logging Review](../code-review-patterns/react-ui-patterns-audit-logging-review.md)

- **Example Implementations:**
  - `/client/src/features/tenant-admin/TenantDashboard/hooks/useRemindersManager.ts`
  - `/client/src/features/tenant-admin/TenantDashboard/hooks/useCalendarConfigManager.ts`
  - `/client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`

- **Related Hooks in Codebase:**
  - `useAuth()` - Context access hook
  - `usePackages()` - Data fetching hook
  - `useBookingTotal()` - Computed value hook

---

**Last Updated:** 2025-12-05
**Status:** Active
**Version:** 1.0
