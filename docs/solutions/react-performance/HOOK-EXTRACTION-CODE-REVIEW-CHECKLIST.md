---
title: 'React Hook Extraction - Code Review Checklist'
category: 'react-performance'
date: 2025-12-05
---

# React Hook Extraction - Code Review Checklist

Use this checklist when reviewing PRs that extract custom hooks.

---

## Pre-Review Checklist

- [ ] PR description mentions hook extraction
- [ ] PR includes both hook AND tests
- [ ] Component size reduced (check file size diff)
- [ ] No merge conflicts

---

## Part 1: Hook Structure Review

### File Organization

- [ ] Hook file: `hooks/use{FeatureName}.ts` or `hooks/use{FeatureName}Manager.ts`
- [ ] Test file: `hooks/use{FeatureName}.test.ts` (same directory)
- [ ] Hook is exported as named export (not default)
- [ ] Return type interface defined: `Use{FeatureName}Result`
- [ ] All types co-located in hook file or properly imported

**Comment if issue:**

```markdown
Hook location: Please move to `hooks/` directory and name as `use{Feature}.ts`
```

### JSDoc Documentation

- [ ] Hook has JSDoc comment
- [ ] Comment explains purpose
- [ ] Comment mentions what component it was extracted from
- [ ] Comment documents return object structure (or references interface)

**Comment if missing:**

````markdown
Please add JSDoc comment:

```typescript
/**
 * use{Feature}Manager Hook
 *
 * Manages {feature} state and operations.
 * Extracted from {Component} for testability.
 *
 * @returns {Use{Feature}Result} - {description of what's returned}
 *
 * @example
 * const manager = use{Feature}Manager();
 * return <Component status={manager.status} />;
 */
```
````

````

### Type Definitions

- [ ] Return type interface defined (UseXxxResult)
- [ ] Interface is exported
- [ ] All return object properties typed
- [ ] All return object methods have signatures

**Comment if issue:**
```markdown
Return type: Create interface:

```typescript
export interface UseRemindersManagerResult {
  status: ReminderStatus | null;
  loading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  handleProcess: () => Promise<void>;
}
````

````

---

## Part 2: State Management Review

### State Organization

- [ ] All useState calls at top of hook
- [ ] Related states grouped conceptually (server state, form state, UI state)
- [ ] Default values are sensible (null, empty string, false, etc.)
- [ ] No conditional useState (not in if/loop)
- [ ] No useState that depends on other state

**Comment if issue:**
```markdown
State organization: Group related state together:

- Server state: status, loading, error
- Form state: email, password, errors
- UI state: showDialog, expanded

Currently they're scattered. Please group them.
````

### State Semantics

- [ ] State names describe data (not component parts)
- [ ] Boolean states start with "is" or "has" (isLoading, hasError)
- [ ] Error states are clear (error, validationErrors, configErrors)
- [ ] Loading states are consistent (loading, isLoading, fetching)

**Comment if issue:**

```markdown
State naming: Use semantic names:

- ❌ data → ✅ status or results
- ❌ show → ✅ showDialog
- ❌ err → ✅ error
- ❌ flag → ✅ hasValidated
```

---

## Part 3: Effects & Callbacks Review

### useEffect Patterns

- [ ] Each useEffect has single clear purpose
- [ ] useEffect has JSDoc comment explaining what it does
- [ ] Dependency array is complete and minimal
- [ ] ESLint `exhaustive-deps` passes (npm run lint)
- [ ] No infinite loops in dependencies
- [ ] Cleanup functions present if needed (FileReader, listeners, timers)

**Comment if issue:**

````markdown
useEffect dependencies: ESLint is warning about missing dependency. Check:

```typescript
useEffect(() => {
  loadPackages(); // ← loadPackages not in deps!
}, [activeTab]);

// Should be:
useEffect(() => {
  loadPackages();
}, [activeTab, loadPackages]); // ← Add loadPackages
```
````

````

### Callback Memoization

- [ ] All callbacks use useCallback
- [ ] Callback dependencies are complete
- [ ] Callbacks are not recreated unnecessarily
- [ ] Callbacks don't break React.memo in children

**Comment if issue:**
```markdown
Callback memoization: All callbacks passed to components should use useCallback:

```typescript
// ❌ This is recreated every render
const handleSave = (data) => api.save(data);

// ✅ This is stable
const handleSave = useCallback((data) => api.save(data), []);
````

````

### Callback Dependencies

- [ ] If callback is in useEffect dependency, it's memoized
- [ ] Dependencies are minimal (not unnecessary)
- [ ] No props passed to hook (hook should be self-contained)

**Comment if issue:**
```markdown
Callback dependencies: This callback has too many dependencies:

```typescript
const handleSave = useCallback(async () => {
  // Implementation
}, [status, loading, error, form, validation, api, logger, util]);
// ↑ Too many! These should be part of hook state.
````

````

---

## Part 4: Performance Review

### Memoization

- [ ] Derived values use useMemo (filtering, mapping, sorting, object creation)
- [ ] Expensive computations are memoized
- [ ] List items could be wrapped in React.memo (if applicable)
- [ ] No unnecessary object/array creation in render path

**Comment if issue:**
```markdown
Performance: This derived value should use useMemo:

```typescript
// ❌ New array created every render
const grouped = segments.map(s => ({ ...s, packages: ... }));

// ✅ Only recreated when dependencies change
const grouped = useMemo(() =>
  segments.map(s => ({ ...s, packages: ... }))
, [segments, packages]);
````

````

### API Call Optimization

- [ ] Parallel API calls use Promise.all
- [ ] API calls are memoized if needed (useCallback)
- [ ] No duplicate API calls
- [ ] Appropriate loading states for each operation

**Comment if issue:**
```markdown
API calls: Use Promise.all for parallel operations:

```typescript
// ❌ Sequential (slower)
const p1 = await api.getPackages();
const p2 = await api.getSegments();

// ✅ Parallel (faster)
const [p1, p2] = await Promise.all([
  api.getPackages(),
  api.getSegments(),
]);
````

````

---

## Part 5: Error Handling Review

### Error States

- [ ] Hook manages error state
- [ ] Error messages are clear and user-friendly
- [ ] Errors are logged appropriately
- [ ] No PII in error messages or logs

**Comment if issue:**
```markdown
Error handling: Set specific error message:

```typescript
// ❌ Generic
setError('Failed');

// ✅ Descriptive
setError('Failed to save calendar configuration. Please try again.');
````

````

### Error Recovery

- [ ] Errors are cleared on retry/refresh
- [ ] Component can recover from errors
- [ ] Error state doesn't prevent future operations

**Comment if issue:**
```markdown
Error recovery: Clear error on successful operation:

```typescript
const handleRetry = useCallback(async () => {
  setError(null); // ← Clear error first
  const result = await api.retry();
}, []);
````

````

---

## Part 6: Testing Review

### Test File Existence

- [ ] Test file exists: `hooks/use{Feature}.test.ts`
- [ ] Test file is in same directory as hook
- [ ] Test file is properly named (matches hook name)

**Comment if missing:**
```markdown
Tests: Please add test file `hooks/useRemindersManager.test.ts` with tests for:
- Initialization
- mount side effects
- All exported methods
- Error cases
- Edge cases

Aim for 80%+ coverage.
````

### Test Coverage

- [ ] Initialization tests (default state)
- [ ] Mount side effects (useEffect on component mount)
- [ ] All exported methods tested
- [ ] Error cases tested
- [ ] Edge cases covered

**Comment if incomplete:**

```markdown
Test coverage: Please add tests for:

- [ ] What happens when API returns 500?
- [ ] What happens when network fails?
- [ ] What if user closes dialog mid-save?
- [ ] Does loading state clear on error?
```

### Test Quality

- [ ] Tests use renderHook from testing-library
- [ ] Tests mock API calls
- [ ] Tests use act() for state updates
- [ ] Tests wait for async operations (waitFor, waitForNextUpdate)
- [ ] Tests are deterministic (no flakiness)

**Comment if issue:**

````markdown
Test quality: Use proper async patterns:

```typescript
// ❌ No waitFor
it('loads data', () => {
  renderHook(() => useHook());
  expect(data).toBeDefined(); // May fail (async)
});

// ✅ With waitFor
it('loads data', async () => {
  const { result } = renderHook(() => useHook());
  await waitFor(() => expect(result.current.data).toBeDefined());
});
```
````

````

---

## Part 7: Component Simplification Review

### Component Size Reduction

- [ ] Component reduced by 50%+ lines
- [ ] No state management in component (all in hook)
- [ ] No API calls in component (all in hook)
- [ ] Component < 150 lines after extraction

**Measure:**
```bash
# Before extraction
git show HEAD:path/to/Component.tsx | wc -l

# After extraction
git show HEAD~1:path/to/Component.tsx | wc -l

# Should see 50%+ reduction
````

**Comment if insufficient:**

```markdown
Component simplification: Component is still too complex. After extraction:

- Remove state management
- Remove API calls
- Remove business logic conditionals
- Keep only UI rendering

Current: 200 lines, should be ~100 lines after full extraction.
```

### Component Clarity

- [ ] Component only renders UI
- [ ] Component uses hook for data/state
- [ ] Component passes only necessary props to hook
- [ ] Component JSX is clean and readable

**Comment if issue:**

````markdown
Component clarity: Remove business logic:

```typescript
// ❌ Business logic in component
const handleSave = async () => {
  if (!calendarId.trim()) setError('Required');
  if (!json) setError('Required');
  try {
    const result = await api.save({ calendarId, json });
    setError(null);
    setShowDialog(false);
  } catch (err) {
    setError('Failed');
  }
};

// ✅ All in hook, component just calls it
const handleSave = () => manager.handleSaveConfig();
```
````

````

---

## Part 8: Integration Review

### Hook Usage in Component

- [ ] Hook is called at top of component
- [ ] Hook result is destructured clearly
- [ ] Hook methods are called with correct signatures
- [ ] No direct state manipulation (no setStatus calls from component)

**Comment if issue:**
```markdown
Hook usage: Call at top level:

```typescript
// ✅ Correct
function Component() {
  const manager = useHook();
  return <div onClick={manager.handleClick}>{manager.status}</div>;
}

// ❌ Wrong (in nested component)
function Component() {
  return <ChildComponent useHook={useHook} />;
}
````

````

### Props vs Hook Usage

- [ ] Component doesn't receive props that should come from hook
- [ ] No prop drilling from hook result to children
- [ ] Child components receive only UI-related props

**Comment if issue:**
```markdown
Props: Don't pass hook state as props:

```typescript
// ❌ Unnecessary prop
<RemindersCard manager={manager} />

// ✅ Component uses hook directly
export function RemindersCard() {
  const manager = useRemindersManager();
  // ...
}
````

````

---

## Part 9: Documentation Review

### In-Code Documentation

- [ ] Complex logic has comments
- [ ] Why decisions are explained (not just what)
- [ ] Any gotchas documented
- [ ] Magic numbers/strings have context

**Comment if needed:**
```markdown
Documentation: Please add comment explaining why:

```typescript
// Why do we parallel load packages + segments?
// - Packages depend on segment IDs (foreign key)
// - Parallel loading is faster (no waterfall)
// - Both endpoints are independent
const [packages, segments] = await Promise.all([...]);
````

````

### README/Component Documentation

- [ ] Component README updated (if exists)
- [ ] Hook documented in component story (if Storybook)
- [ ] Usage examples provided

**Comment if needed:**
```markdown
Documentation: Please update component README:

```markdown
## useRemindersManager

Manages booking reminder state and operations.

### Returns

- `status` - Current reminder status (null if not loaded)
- `loading` - True while fetching status
- `error` - Error message if fetch failed
- `fetchStatus()` - Refresh reminder status
- `handleProcess()` - Process pending reminders

### Example

```typescript
const manager = useRemindersManager();
return (
  <div>
    <p>{manager.status?.pendingCount} pending</p>
    <button onClick={manager.handleProcess}>Process</button>
  </div>
);
````

````

---

## Part 10: Security Review

### Data Handling

- [ ] No sensitive data exposed in return object
- [ ] No PII in error messages or logs
- [ ] No secrets in returned data
- [ ] Tenant isolation maintained (if applicable)

**Comment if issue:**
```markdown
Security: Don't return user passwords or API keys:

```typescript
// ❌ Exposes sensitive data
return { user, apiKey, password };

// ✅ Only return needed data
return { user: { id, email, name } };
````

````

### Validation

- [ ] Input validation present (file size, JSON parsing, etc.)
- [ ] No arbitrary code execution from user input
- [ ] API responses validated before use

**Comment if issue:**
```markdown
Validation: Validate file uploads:

```typescript
const handleFile = (file) => {
  if (file.size > MAX_SIZE) {
    setError('File too large');
    return;
  }
  // Safe to process
};
````

````

---

## Part 11: Final Approval Checklist

Before approving, verify:

```markdown
## Final Approval

### Required (Must Fix)
- [ ] Hook structure is clean (proper file location, naming)
- [ ] Return type interface is defined
- [ ] All callbacks use useCallback with complete deps
- [ ] Test file exists with 80%+ coverage
- [ ] Component simplified by 50%+ lines
- [ ] ESLint passes (npm run lint)

### Strongly Recommended
- [ ] JSDoc comment present
- [ ] Memoization added where needed (useMemo)
- [ ] Error states handled clearly
- [ ] Code is well-commented

### Nice to Have
- [ ] Component readme updated
- [ ] Storybook story created
- [ ] Performance profiling done

### Comments to Address
- [ ] [List any open comments from above]

### Decision
- [ ] ✅ Approve - All required items met
- [ ] 🔄 Request Changes - Items marked above need fixes
- [ ] 💬 Comment - Questions before approval
````

---

## Common Approval Messages

### Approval ✅

```markdown
Great extraction! This hook follows all the patterns:

✅ Well-organized file structure
✅ Proper return type interface
✅ All callbacks memoized
✅ Comprehensive tests (85% coverage)
✅ Component simplified from 300 → 100 lines
✅ Error handling solid

Ready to merge!
```

### Request Changes 🔄

```markdown
Good start! A few things to address before merge:

1. **Return type:** Create `UseRemindersManagerResult` interface
2. **Tests:** Currently 60% coverage. Need tests for:
   - Error state when API fails
   - handleProcess with failure scenario
3. **Component:** Still has some state. Move form state to hook.
4. **ESLint:** `react-hooks/exhaustive-deps` warning on line 45

Once these are fixed, ready to go!
```

### Request Review Update 💬

```markdown
Questions before approval:

1. Why not use React Query for data fetching? Would simplify some of this.
2. The parallel Promise.all - are these endpoints independent? Any dependencies?
3. Should we expose `setStatus` or keep it private to prevent misuse?

Let's discuss these, then I can approve.
```

---

## Tips for Reviewers

1. **Run tests locally** - Verify 80%+ coverage: `npm run test:coverage`
2. **Check hook logic** - Trace through a user action (fetch → update → render)
3. **Look for patterns** - Does it follow the 4 hook patterns (manager, fetching, form, computed)?
4. **Test import** - Can the hook be imported and used elsewhere? (Is it truly reusable?)
5. **Component clarity** - Can you understand what the component does in 30 seconds?

---

**Use this checklist for every hook extraction PR.**

**Print the quick approval checklist and keep nearby!**

Last Updated: 2025-12-05
