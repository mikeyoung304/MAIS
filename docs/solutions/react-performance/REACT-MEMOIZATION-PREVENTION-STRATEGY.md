---
module: MAIS
date: 2025-12-04
problem_type: react_performance_issue
component: client/src
severity: P2
tags: [react-performance, memoization, useCallback, useMemo, optimization, re-renders]
---

# React Memoization Prevention Strategy

Prevent unnecessary component re-renders by properly memoizing callback props and derived values.

**Problem Pattern:** Child components receiving un-memoized callback props cause re-renders on every parent render, breaking React's reconciliation optimization. Derived values (filtered arrays, computed objects) force recalculations every render.

**Impact:**

- Cascading re-renders through component tree
- Performance degradation with list components (100+ items)
- Broken animation/focus state in children
- Unnecessary DOM diffing and layout thrashing

---

## Prevention Strategies

### 1. Code Review Checklist

Use this checklist when reviewing PRs that modify React components or hooks:

**Callback Props Pattern:**

- [ ] Component receives callback as prop? → Check if it's wrapped in `useCallback()`
- [ ] Callback dependency array includes all external references? → Check for missing deps
- [ ] Inline arrow functions in JSX? → Flag: convert to `useCallback()`

  ```tsx
  // ❌ Re-creates function every render
  <ChildComponent onChange={(e) => setState(e.target.value)} />;

  // ✅ Stable reference
  const handleChange = useCallback((e) => setState(e.target.value), []);
  <ChildComponent onChange={handleChange} />;
  ```

**Derived Values Pattern:**

- [ ] Computing values from props/state in render? → Check if wrapped in `useMemo()`
- [ ] Array methods (`.filter()`, `.map()`, `.sort()`)? → Flag: wrap in `useMemo()`
- [ ] Object literals created per render? → Flag: wrap in `useMemo()`

  ```tsx
  // ❌ New array created every render
  const available = dates.filter((d) => !unavailable.includes(d));

  // ✅ Memoized until dependencies change
  const available = useMemo(
    () => dates.filter((d) => !unavailable.includes(d)),
    [dates, unavailable]
  );
  ```

**React.memo Pattern:**

- [ ] Component exported and used in multiple parents? → Consider `React.memo()`
- [ ] Props are complex objects/arrays? → Verify they're memoized upstream
- [ ] Component receives children? → Check if children force re-renders

  ```tsx
  // ❌ All props must be memoized for memo to work
  function PackageCard({ package: pkg, onSelect }) {
    return <div onClick={onSelect}>{pkg.title}</div>;
  }

  // ✅ Wrap with React.memo
  export const PackageCard = React.memo(function PackageCard({ package: pkg, onSelect }) {
    return <div onClick={onSelect}>{pkg.title}</div>;
  });
  ```

**Form Handler Pattern:**

- [ ] Form submission handler created inline? → Flag: extract and memoize
- [ ] Input onChange handlers? → Flag: consider controlled component with `useCallback()`
- [ ] Multiple event handlers on same component? → Verify dependency arrays

**Custom Hook Pattern:**

- [ ] Hook returns callbacks? → Verify they're memoized with `useCallback()`
- [ ] Hook returns computed values? → Verify they use `useMemo()`
- [ ] Hook dependency array correct? → Run React DevTools Profiler to verify stability

---

### 2. ESLint Rules Configuration

Add these rules to enforce memoization patterns automatically:

**Install plugin:**

```bash
npm install --save-dev eslint-plugin-react-hooks eslint-plugin-react
```

**Update `.eslintrc.cjs` for root (all workspaces):**

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // React Hook Rules (CRITICAL)
    'react-hooks/rules-of-hooks': 'error', // Hooks only in components/hooks
    'react-hooks/exhaustive-deps': 'warn', // Always complete dependency arrays

    // React-specific rules
    'react/display-name': 'warn', // Name components for DevTools
    'react/no-unstable-nested-components': 'warn', // Move nested components out
    'react/jsx-no-useless-fragment': 'warn', // Remove unnecessary fragments
    'react/no-array-index-key': 'warn', // Don't use array index as key
    'react/self-closing-comp': 'warn', // Self-close void components
  },
  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
    {
      files: ['client/src/**/*.tsx'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      rules: {
        'react-hooks/exhaustive-deps': [
          'warn',
          {
            additionalHooks: 'useQuery|useMutation', // TanStack Query hooks
          },
        ],
      },
    },
  ],
};
```

**Custom ESLint rule for memoization (optional, advanced):**

Create `.eslintrc.custom.js` for strict enforcement:

```javascript
module.exports = {
  rules: {
    'require-callback-memoization': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require useCallback for callbacks passed to child components',
          category: 'Best Practices',
        },
        fixable: null,
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            // Flag callback props that aren't wrapped in useCallback
            if (node.name && node.name.name && node.name.name.match(/^on[A-Z]/)) {
              if (
                node.value &&
                node.value.expression &&
                node.value.expression.type === 'ArrowFunctionExpression'
              ) {
                context.report({
                  node,
                  message: `Callback prop "${node.name.name}" should be wrapped in useCallback()`,
                });
              }
            }
          },
        };
      },
    },
  },
};
```

**Quick fixes to run:**

```bash
# Check current violations
npm run lint -- client/src --plugin react-hooks

# Auto-fix where possible
npm run format
```

---

### 3. Component Pattern: Template for Memoized Components

Use this template when creating new components that receive callbacks or complex props:

**Basic Component (no optimization needed):**

```tsx
import { FC, ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void; // Simple callback
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

// No memoization needed for simple, frequently-changing props
export const Button: FC<ButtonProps> = ({ children, onClick, disabled, variant = 'primary' }) => {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn btn-${variant}`}>
      {children}
    </button>
  );
};
```

**List Item Component (candidate for React.memo):**

```tsx
import { FC, memo, useCallback } from 'react';

interface PackageCardProps {
  id: string;
  title: string;
  price: number;
  onSelect: (id: string) => void; // Callback prop
}

// Memoized because:
// 1. Used in list (100+ items) - prevents cascading re-renders
// 2. Receives callback prop - stable reference needed
// 3. Props are primitives - easy to compare
export const PackageCard = memo<PackageCardProps>(function PackageCard({
  id,
  title,
  price,
  onSelect,
}) {
  const handleClick = useCallback(() => onSelect(id), [id, onSelect]);

  return (
    <div
      onClick={handleClick}
      className="p-4 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer"
    >
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-gray-600">${(price / 100).toFixed(2)}</p>
    </div>
  );
});

// Display name for React DevTools
PackageCard.displayName = 'PackageCard';
```

**Form Component (uses derived state):**

```tsx
import { FC, useMemo, useCallback, useState } from 'react';

interface SegmentFormProps {
  form: {
    slug: string;
    name: string;
    active: boolean;
    sortOrder: number;
  };
  onFormChange: (form: any) => void;
  isSaving: boolean;
}

export const SegmentForm: FC<SegmentFormProps> = ({ form, onFormChange, isSaving }) => {
  // Derived value: slug validation state
  const slugError = useMemo(() => {
    if (!form.slug) return 'Slug is required';
    if (!/^[a-z0-9-]+$/.test(form.slug)) return 'Lowercase with hyphens only';
    return null;
  }, [form.slug]);

  // Memoized callback: change handler
  const handleSlugChange = useCallback(
    (value: string) => {
      onFormChange({ ...form, slug: value.toLowerCase() });
    },
    [form, onFormChange]
  );

  const handleNameChange = useCallback(
    (value: string) => {
      onFormChange({ ...form, name: value });
    },
    [form, onFormChange]
  );

  return (
    <form className="space-y-4">
      <div>
        <label>Slug</label>
        <input
          type="text"
          value={form.slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          disabled={isSaving}
        />
        {slugError && <p className="text-red-600 text-sm">{slugError}</p>}
      </div>

      <div>
        <label>Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={isSaving}
        />
      </div>
    </form>
  );
};
```

**Parent Component (coordination):**

```tsx
import { FC, useCallback, useState, useMemo } from 'react';

interface SegmentsManagerProps {
  segments: Array<{ id: string; name: string; active: boolean }>;
}

export const SegmentsManager: FC<SegmentsManagerProps> = ({ segments }) => {
  const [filter, setFilter] = useState('');

  // Derived value: filtered segments (re-compute only when input changes)
  const filteredSegments = useMemo(() => {
    return segments.filter((s) => s.name.toLowerCase().includes(filter.toLowerCase()));
  }, [segments, filter]);

  // Stable callback for child component
  const handleSelectSegment = useCallback((id: string) => {
    console.log('Selected:', id);
    // Handle selection
  }, []);

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Filter segments..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="grid gap-4">
        {filteredSegments.map((segment) => (
          <SegmentCard
            key={segment.id}
            id={segment.id}
            name={segment.name}
            active={segment.active}
            onSelect={handleSelectSegment}
          />
        ))}
      </div>
    </div>
  );
};

// Memoized list item
const SegmentCard = memo<{
  id: string;
  name: string;
  active: boolean;
  onSelect: (id: string) => void;
}>(function SegmentCard({ id, name, active, onSelect }) {
  const handleClick = useCallback(() => onSelect(id), [id, onSelect]);

  return (
    <div
      onClick={handleClick}
      className={`p-4 border rounded cursor-pointer transition-colors ${
        active ? 'bg-blue-50 border-blue-300' : 'border-gray-300'
      }`}
    >
      {name}
    </div>
  );
});

SegmentCard.displayName = 'SegmentCard';
```

**Custom Hook (with memoized return):**

```tsx
import { useCallback, useMemo, useState, useRef } from 'react';

interface UseFormResult<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  isDirty: boolean;
  handleChange: (field: keyof T, value: T[keyof T]) => void;
  reset: () => void;
}

export function useForm<T extends Record<string, unknown>>(initialValues: T): UseFormResult<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const initialRef = useRef(initialValues);

  // Derived value: dirty state
  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialRef.current),
    [values]
  );

  // Memoized callback: change handler
  const handleChange = useCallback((field: keyof T, value: T[keyof T]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // Memoized callback: reset handler
  const reset = useCallback(() => {
    setValues(initialRef.current);
    setErrors({});
  }, []);

  // Return stable object reference
  return useMemo(
    () => ({ values, errors, isDirty, handleChange, reset }),
    [values, errors, isDirty, handleChange, reset]
  );
}
```

---

### 4. Decision Criteria: When to Memoize

Use this decision tree to determine when memoization is needed:

**Flowchart:**

```
Component receives callback prop?
├─ YES: Will child component use it in effect/memo?
│  ├─ YES: Wrap with useCallback() ✅
│  └─ NO: Can skip if not critical path
└─ NO: Continue to next check

Component re-renders frequently (parent state changes)?
├─ YES: Used in list (10+ items)?
│  ├─ YES: Wrap with React.memo() ✅
│  └─ NO: Wrap if slow to render (>50ms)
└─ NO: Skip memoization

Computing value from props/state?
├─ Array methods (.filter, .map, .sort)? → useMemo() ✅
├─ Object literals? → useMemo() ✅
├─ String concatenation? → Skip (cheap)
└─ Simple arithmetic? → Skip (cheap)

Custom hook returns value?
├─ Callback? → useCallback() ✅
├─ Computed value? → useMemo() ✅
└─ Simple getter? → Skip
```

**Decision Matrix:**

| Pattern                          | Memoization     | Reason                         | Cost of Not Memoizing                |
| -------------------------------- | --------------- | ------------------------------ | ------------------------------------ |
| Callback prop → child useEffect  | `useCallback()` | Effect re-runs unnecessarily   | Extra API calls, state updates       |
| Callback prop → React.memo child | `useCallback()` | Memo doesn't work              | Cascading re-renders (100x slower)   |
| Array.filter() / .map()          | `useMemo()`     | Reference changes every render | Child re-renders, animation breaks   |
| Object prop { a, b, c }          | `useMemo()`     | Reference changes every render | Child re-renders on parent update    |
| Simple string/number             | None            | Cheap to recreate              | Negligible (keep code simple)        |
| DOM element created              | `useMemo()`     | Loss of DOM node state         | Focus/selection lost, layout thrash  |
| List item (10+ items)            | `React.memo()`  | Prevents cascading re-renders  | O(n) re-renders, major slowdown      |
| Form input onChange              | `useCallback()` | Handler reference stability    | State update per keystroke on parent |

**Cost Analysis:**

| Operation              | Without Memo        | With Memo        | Break-Even      |
| ---------------------- | ------------------- | ---------------- | --------------- |
| 10-item list re-render | 100ms               | 10ms             | 50 renders      |
| useEffect with deps    | API call per render | Single call      | 3 renders       |
| Array.filter(100)      | 5ms per render      | 0ms (cached)     | 10 renders      |
| Object creation        | <1ms per render     | Memoization cost | Rarely worth it |

**Red Flags (Always Memoize):**

- ❌ `const callback = () => {...}` in JSX (inline arrow function)
- ❌ `dependencies.filter(...)` in render (array method)
- ❌ `{ a, b, c }` object literal as prop
- ❌ Child component wrapped in `React.memo()` receives un-memoized callback
- ❌ Custom hook returns callback without `useCallback()`

**Green Flags (Skip Memoization):**

- ✅ Component only has primitive props (string, number, boolean)
- ✅ Parent never triggers re-renders
- ✅ Computed value is cheap (<1ms)
- ✅ Component is leaf node (no children)

---

### 5. Best Practices & Anti-Patterns

**Anti-Pattern 1: Over-memoizing (Premature Optimization)**

```tsx
// ❌ BAD: Memoizing cheap operations
const sum = useMemo(() => a + b, [a, b]);
const text = useMemo(() => `Hello ${name}`, [name]);

// ✅ GOOD: Let simple operations run
const sum = a + b;
const text = `Hello ${name}`;
```

**Anti-Pattern 2: Broken Dependency Arrays**

```tsx
// ❌ BAD: Stale dependencies (callback ignores new prop)
const handleClick = useCallback(() => {
  setState(prop.value); // Uses OLD prop forever
}, []); // Missing: prop

// ✅ GOOD: Complete dependency array
const handleClick = useCallback(() => {
  setState(prop.value); // Uses CURRENT prop
}, [prop]);
```

**Anti-Pattern 3: Comparing Complex Objects**

```tsx
// ❌ BAD: React.memo with deep comparison (expensive)
export const Component = React.memo(function Component({ user }) {
  return <div>{user.name}</div>;
});
// If user is new object every render, memo fails

// ✅ GOOD: Extract primitive props
export const Component = React.memo(function Component({ name }) {
  return <div>{name}</div>;
});
```

**Anti-Pattern 4: Memoizing in Wrong Place**

```tsx
// ❌ BAD: Memoizing in parent doesn't help unmemoized child
function Parent() {
  const callback = useCallback(() => {}, []);
  return <UnmemoizedChild onChange={callback} />; // Still re-renders
}

// ✅ GOOD: Memoize both parent callback AND child component
function Parent() {
  const callback = useCallback(() => {}, []);
  return <MemoizedChild onChange={callback} />;
}

const MemoizedChild = React.memo(UnmemoizedChild);
```

**Best Practice 1: Memoize at Component Boundary**

```tsx
// ✅ GOOD: Memoize callbacks at the point they're created
function Parent({ items, onSelect }) {
  // Stable callback for children
  const handleItemSelect = useCallback(
    (item) => onSelect(item),
    [onSelect] // Dependency flows naturally
  );

  return items.map((item) => (
    <MemoizedItem key={item.id} item={item} onSelect={handleItemSelect} />
  ));
}
```

**Best Practice 2: Use React DevTools Profiler**

```tsx
// Add <Profiler> to identify slow renders
import { Profiler } from 'react';

<Profiler
  id="packages-list"
  onRender={(id, phase, actualDuration) => {
    if (actualDuration > 50) {
      console.warn(`${id} (${phase}) took ${actualDuration}ms`);
    }
  }}
>
  <PackagesList packages={packages} />
</Profiler>;
```

**Best Practice 3: Name Components for DevTools**

```tsx
// ✅ GOOD: Component has name in DevTools
export const PackageCard = React.memo(function PackageCard({ package: pkg }) {
  return <div>{pkg.title}</div>;
});

PackageCard.displayName = 'PackageCard'; // Shows in React DevTools

// ❌ BAD: Anonymous function (shows as "memo(Component)" in DevTools)
export const PackageCard = React.memo(({ package: pkg }) => <div>{pkg.title}</div>);
```

---

## Testing Approach: React DevTools Profiler

Use the React DevTools Performance Profiler to identify memoization issues:

### Setup

1. Install [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi) extension
2. Open DevTools → Components tab
3. Click "Profiler" tab at the top

### Identify Unnecessary Re-renders

1. Click the red circle to start recording
2. Perform action (click button, type input, etc.)
3. Stop recording (click red circle again)
4. Check "Render count" for components that should be memoized

**What to look for:**

- List item rendered 100x when only 1 item changed? → Missing `React.memo()`
- Component rendered when its props didn't change? → Missing `useCallback()` on parent
- Chart re-renders when only data changed? → Missing `useMemo()` for derived values

### Performance Metrics

```
Commit Duration: < 16ms (60 FPS target)
  Components that render: Should be minimal
  Render count: Only changed props should be affected

Render Duration: < 1ms per component (ideal)
  > 50ms = slow component, consider optimization
  > 100ms = definitely optimize
```

### Example Testing Scenario

**Test case: Large list re-render**

```tsx
function PackagesList({ packages, onSelect }) {
  // Without memoization:
  // - Adding one package triggers 100 re-renders (one per item)
  // - Each item re-renders even if not changed
  // - Profiler shows "100 renders" in commit
  // With memoization:
  // - Adding one package triggers 1-2 re-renders
  // - Only new item + parent render
  // - Profiler shows "2 renders" in commit
}
```

**Profiler commands:**

```javascript
// In browser console during profile recording:

// Check if component is memoized
const node = document.querySelector('[data-testid="package-card"]');
console.log(
  React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactDebugCurrentDispatcher.current
);

// Force re-render and watch Profiler
document.querySelector('[data-testid="update-btn"]').click();
```

---

## ESLint Rules Quick Reference

| Rule                                  | Purpose                        | When it triggers                |
| ------------------------------------- | ------------------------------ | ------------------------------- |
| `react-hooks/rules-of-hooks`          | Hooks only in components/hooks | Hook called in loop/condition   |
| `react-hooks/exhaustive-deps`         | Complete dependency arrays     | Missing dependency in array     |
| `react/no-unstable-nested-components` | Move nested components         | Component defined in render     |
| `react/jsx-no-useless-fragment`       | Remove `<>` fragments          | `<>child</>` (not needed)       |
| `react/no-array-index-key`            | Use stable keys                | `key={index}` in lists          |
| `react/self-closing-comp`             | Self-close void tags           | `<Input></Input>` (no children) |

**Auto-fix most violations:**

```bash
npm run lint -- client/src --fix
npm run format
```

---

## Common Issues & Solutions

### Issue 1: "useCallback missing dependency" Warning

**Symptom:**

```
React Hook useCallback has a missing dependency: 'value'
```

**Solution:**

```tsx
// Add missing dependency
const handleChange = useCallback(
  (e) => {
    setState(value + e.target.value); // ← 'value' is used here
  },
  [value]
); // ← Add it here
```

### Issue 2: "Cannot memoize - props keep changing"

**Symptom:** `React.memo` doesn't prevent re-renders because props change every render

**Solution:**

```tsx
// ❌ Parent passes new object every render
<Item details={{ id, name }} />  // New {} instance each render

// ✅ Parent memoizes the object
const details = useMemo(() => ({ id, name }), [id, name]);
<Item details={details} />

// OR: Pass primitives instead
<Item id={id} name={name} />
```

### Issue 3: Stale Closure (Callback uses old prop)

**Symptom:** Callback uses outdated prop value

**Solution:**

```tsx
// ❌ Callback never sees new prop
const callback = useCallback(() => {
  process(prop);
}, []);

// ✅ Add prop to dependencies
const callback = useCallback(() => {
  process(prop);
}, [prop]);

// ✅ OR: Use ref if you need latest without re-running effect
const propRef = useRef(prop);
useEffect(() => {
  propRef.current = prop;
}, [prop]);

const callback = useCallback(() => {
  process(propRef.current); // Always gets latest
}, []);
```

### Issue 4: Memory Leaks from useCallback

**Symptom:** useCallback captures large object, prevents garbage collection

**Solution:**

```tsx
// ❌ Captures entire form object in closure
const handleSubmit = useCallback(() => {
  api.submitForm(formData); // Large object captured
}, [formData]);

// ✅ Only capture what's needed
const handleSubmit = useCallback(() => {
  api.submitForm({
    email: formData.email,
    name: formData.name,
  });
}, [formData.email, formData.name]);

// ✅ OR: Move large object outside component
const defaultForm = {
  /* static default */
};
const handleSubmit = useCallback(() => {
  api.submitForm(defaultForm);
}, []);
```

---

## Implementation Checklist

Before submitting a PR with React components:

- [ ] **Callbacks:** All callback props are wrapped in `useCallback()`
- [ ] **Dependency Arrays:** All `useCallback` dependencies are complete (ESLint passes)
- [ ] **Derived Values:** Array methods (.filter, .map, .sort) wrapped in `useMemo()`
- [ ] **List Items:** Components in lists (10+ items) wrapped in `React.memo()`
- [ ] **Display Names:** Memoized components have `displayName` for DevTools
- [ ] **Profiler Test:** Run React DevTools Profiler, no unexpected re-renders
- [ ] **Performance:** All components render in < 50ms (profile and verify)
- [ ] **ESLint:** No `react-hooks/exhaustive-deps` warnings
- [ ] **No Over-memoization:** Simple operations not wrapped unnecessarily
- [ ] **Tests:** Include performance regression test for list components

---

## Grep Commands for Self-Review

Run these to check your component before submitting:

```bash
# Find inline arrow functions (should use useCallback)
grep -r "onChange={(e)" client/src --include="*.tsx" | head -5

# Find array methods without useMemo
grep -r "\.filter(\|\.map(\|\.sort(" client/src --include="*.tsx" | grep -v "useMemo" | head -5

# Find Object literals as props (should use useMemo)
grep -r "props={{ " client/src --include="*.tsx" | head -5

# Find components NOT wrapped in React.memo (in lists)
grep -r "map(" client/src --include="*.tsx" -A 3 | grep "export" | head -5

# Check dependency arrays in useCallback
grep -r "useCallback(" client/src --include="*.tsx" -A 2 | grep -v "}\]" | head -10

# Find missing displayName
grep -r "React\.memo(" client/src --include="*.tsx" | grep -v "displayName" | head -5
```

---

## Quick Reference Card

**When to Use What:**

| Situation              | Tool            | Code                                                              |
| ---------------------- | --------------- | ----------------------------------------------------------------- |
| Callback prop to child | `useCallback()` | `const cb = useCallback(() => {}, [deps])`                        |
| Derived array/object   | `useMemo()`     | `const val = useMemo(() => compute(), [deps])`                    |
| List item component    | `React.memo()`  | `export const Item = React.memo(function Item(props) {})`         |
| Hook returns callback  | `useCallback()` | `return useCallback(() => {}, [])`                                |
| Hook returns value     | `useMemo()`     | `return useMemo(() => ({...}), [])`                               |
| Form input handler     | `useCallback()` | `const handle = useCallback((e) => setState(e.target.value), [])` |

**Red Flags (Always Check):**

- `onChange={(e) => ...}` ← Should be `useCallback()`
- `.filter(` or `.map(` ← Should be `useMemo()`
- `memo(` without `displayName` ← Add display name
- `key={index}` ← Use stable ID
- `const obj = { a, b }` as prop ← Should be `useMemo()`

---

## Related Documentation

- [React Hooks Performance & WCAG Review](./code-review-patterns/react-hooks-performance-wcag-review.md)
- [React UI Patterns & Audit Logging](./code-review-patterns/react-ui-patterns-audit-logging-review.md)
- [BRAND_VOICE_GUIDE.md - Design Principles](../design/BRAND_VOICE_GUIDE.md)
- [CLAUDE.md - React Development Standards](../../CLAUDE.md)

---

## References

- [React DevTools Profiler Guide](https://react.dev/learn/render-and-commit)
- [useCallback Documentation](https://react.dev/reference/react/useCallback)
- [useMemo Documentation](https://react.dev/reference/react/useMemo)
- [React.memo Documentation](https://react.dev/reference/react/memo)
- [ESLint React Hooks Plugin](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks)

---

**Last Updated:** 2025-12-04
**Status:** Ready for implementation
**Severity:** P2 (Performance optimization)
**Test Coverage:** Template included, Profiler approach documented
