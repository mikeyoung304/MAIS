---
title: React Rules of Hooks - Early Return Prevention
date: 2026-01-08
category: patterns
severity: P1
component: React Components
symptoms:
  - Build passes locally but fails on Vercel
  - ESLint error "React Hook X is called conditionally"
  - Component works in dev but crashes in production build
  - Early return added before hooks in existing component
root_cause: Hooks called after conditional return violates Rules of Hooks
resolution_type: prevention_strategy
tags: [react, hooks, early-return, build-errors, vercel]
---

# React Rules of Hooks - Early Return Prevention

**Impact:** P1 - Build passes locally but fails on Vercel (different ESLint config strictness)

**Root Cause:** React's Rules of Hooks require hooks to be called in the same order every render. Adding an early return statement BEFORE existing hooks causes conditional hook calls.

---

## The Pattern That Breaks

```tsx
// ❌ WRONG - Early return placed BEFORE hooks
function TenantPage({ tenant }: Props) {
  // Early return added for "edge case"
  if (!tenant.segments || tenant.segments.length === 0) {
    return <EmptyState />;
  }

  // Hooks AFTER the return - VIOLATION!
  const [selected, setSelected] = useState(tenant.segments[0]);
  const filtered = useMemo(() => filterSegments(tenant.segments), [tenant.segments]);

  return <SegmentList segments={filtered} selected={selected} />;
}
```

**Why this happens:**
1. Developer adds empty state handling to existing component
2. Places early return at the "logical" place (before data processing)
3. Doesn't realize hooks exist below the return
4. Local ESLint may not catch it (different config/version)
5. Vercel's stricter build catches it

---

## The Correct Patterns

### Pattern A: Move hooks ABOVE all returns

```tsx
// ✅ CORRECT - All hooks at top, before ANY returns
function TenantPage({ tenant }: Props) {
  // ALL hooks first - always called
  const [selected, setSelected] = useState(tenant.segments?.[0] ?? null);
  const filtered = useMemo(
    () => tenant.segments ? filterSegments(tenant.segments) : [],
    [tenant.segments]
  );

  // Early returns AFTER all hooks
  if (!tenant.segments || tenant.segments.length === 0) {
    return <EmptyState />;
  }

  return <SegmentList segments={filtered} selected={selected} />;
}
```

### Pattern B: Handle empty state in JSX

```tsx
// ✅ CORRECT - Conditional rendering instead of early return
function TenantPage({ tenant }: Props) {
  const [selected, setSelected] = useState(tenant.segments?.[0] ?? null);
  const filtered = useMemo(
    () => tenant.segments ? filterSegments(tenant.segments) : [],
    [tenant.segments]
  );

  return (
    <>
      {!tenant.segments || tenant.segments.length === 0 ? (
        <EmptyState />
      ) : (
        <SegmentList segments={filtered} selected={selected} />
      )}
    </>
  );
}
```

### Pattern C: Extract logic to custom hook

```tsx
// ✅ CORRECT - Custom hook always runs, component handles UI
function useSegmentState(segments: Segment[] | undefined) {
  const [selected, setSelected] = useState(segments?.[0] ?? null);
  const filtered = useMemo(
    () => segments ? filterSegments(segments) : [],
    [segments]
  );
  return { selected, setSelected, filtered, isEmpty: !segments?.length };
}

function TenantPage({ tenant }: Props) {
  const { selected, filtered, isEmpty } = useSegmentState(tenant.segments);

  if (isEmpty) {
    return <EmptyState />;
  }

  return <SegmentList segments={filtered} selected={selected} />;
}
```

---

## Quick Checklist (Before Adding Early Returns)

- [ ] Search file for `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`
- [ ] If hooks exist BELOW where you want to return, MOVE HOOKS UP
- [ ] Use optional chaining (`?.`) and nullish coalescing (`??`) in hook initializers
- [ ] Run `npm run lint` locally before committing
- [ ] Run `npm run build` locally (catches what lint misses)

---

## ESLint Rules That Catch This

Add to your `.eslintrc.json`:

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**Critical:** Ensure ESLint version and config match between local and CI/CD.

### Vercel-Specific: Enable Strict Linting

In `next.config.js`:

```javascript
module.exports = {
  eslint: {
    // Don't ignore ESLint during builds
    ignoreDuringBuilds: false,
  },
};
```

---

## Code Review Checklist

When reviewing PRs that add early returns:

- [ ] **Check hook positions:** Are there hooks below ANY early return?
- [ ] **Search for hook keywords:** `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`
- [ ] **Verify local build:** Did the author run `npm run build` locally?
- [ ] **Check for optional chaining:** Do hook initializers handle undefined/null?

### Copy-Paste Review Comment

```markdown
**Rules of Hooks Violation**

This early return is placed before hooks, which violates React's Rules of Hooks.
Hooks must be called in the same order every render.

**Fix:** Move all hooks above the early return, using optional chaining for initializers:
```tsx
const [selected, setSelected] = useState(data?.[0] ?? null);
// ... other hooks ...

if (!data) return <EmptyState />;
```
```

---

## Test Strategies

### 1. Build Test (Most Important)

```bash
# Always run before committing
npm run build

# Or specifically for Next.js
cd apps/web && npm run build
```

### 2. ESLint CI Integration

```yaml
# .github/workflows/ci.yml
- name: Lint
  run: npm run lint -- --max-warnings 0

- name: Build
  run: npm run build
```

### 3. Pre-commit Hook

```bash
# .husky/pre-commit
npm run lint -- --max-warnings 0
npm run typecheck
```

### 4. Component Tests Should Exercise Both Paths

```tsx
describe('TenantPage', () => {
  it('renders empty state when no segments', () => {
    render(<TenantPage tenant={{ segments: [] }} />);
    expect(screen.getByText('No segments')).toBeInTheDocument();
  });

  it('renders segment list when segments exist', () => {
    render(<TenantPage tenant={{ segments: [mockSegment] }} />);
    expect(screen.getByText(mockSegment.name)).toBeInTheDocument();
  });
});
```

---

## Common Scenarios and Fixes

### Scenario 1: Adding Loading State

```tsx
// ❌ WRONG
function Page({ data, isLoading }) {
  if (isLoading) return <Spinner />;

  const processed = useMemo(() => process(data), [data]); // Hook after return!
  return <Content data={processed} />;
}

// ✅ CORRECT
function Page({ data, isLoading }) {
  const processed = useMemo(
    () => (data ? process(data) : null),
    [data]
  );

  if (isLoading) return <Spinner />;
  return <Content data={processed} />;
}
```

### Scenario 2: Adding Error Boundary

```tsx
// ❌ WRONG
function Page({ error }) {
  if (error) return <ErrorDisplay error={error} />;

  const [state, setState] = useState(initial); // Hook after return!
  return <Form state={state} onChange={setState} />;
}

// ✅ CORRECT
function Page({ error }) {
  const [state, setState] = useState(initial);

  if (error) return <ErrorDisplay error={error} />;
  return <Form state={state} onChange={setState} />;
}
```

### Scenario 3: Adding Auth Guard

```tsx
// ❌ WRONG
function ProtectedPage({ user }) {
  if (!user) return <Redirect to="/login" />;

  const [data, setData] = useState(null); // Hook after return!
  useEffect(() => { fetchData(user.id); }, [user.id]);
  return <Dashboard data={data} />;
}

// ✅ CORRECT
function ProtectedPage({ user }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (user) fetchData(user.id);
  }, [user]);

  if (!user) return <Redirect to="/login" />;
  return <Dashboard data={data} />;
}
```

---

## Detection Commands

```bash
# Find components with early returns (manual review needed)
grep -rn "return.*<" apps/web/src/components --include="*.tsx" | head -50

# Find useState/useEffect in files with early returns
for f in $(grep -l "return.*null\|return.*<" apps/web/src/components/*.tsx); do
  echo "=== $f ==="
  grep -n "useState\|useEffect\|useMemo\|useCallback" "$f"
done

# Run ESLint specifically for hooks rule
npx eslint apps/web/src --rule 'react-hooks/rules-of-hooks: error' --ext .tsx
```

---

## Why Local Build Passes But Vercel Fails

| Factor | Local | Vercel |
|--------|-------|--------|
| ESLint version | May be older | Uses package.json version |
| ESLint config | May have overrides | Strict mode |
| Node.js version | May differ | Defined in engines |
| Cache | May use cached results | Fresh build |
| Build mode | Development | Production |

**Solution:** Always run `npm run build` locally before pushing, not just `npm run dev`.

---

## Related Documentation

- [ESLint Dead Code Prevention](./ESLINT_DEAD_CODE_QUICK_REFERENCE.md)
- [TypeScript Build Errors](../build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md)
- [React Hooks Performance](./react-performance/REACT-MEMOIZATION-PREVENTION-STRATEGY.md)

---

**Last Updated:** 2026-01-08
**Maintainer:** MAIS Engineering
