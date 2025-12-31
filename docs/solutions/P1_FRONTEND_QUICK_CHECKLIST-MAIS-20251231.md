---
module: MAIS
date: 2025-12-31
problem_type: quick_reference
component: apps/web/src (all)
phase: Frontend Development
severity: P1
usage: Print and pin next to monitor during code review
---

# P1 Frontend Prevention Quick Checklist

**Print this, pin it next to your monitor, check it before every commit and code review.**

---

## Pre-Commit Checklist (5 minutes)

### Issue 1: Duplicate Types

- [ ] All data types imported from `@macon/contracts`
- [ ] No `type X =` definitions (except UI state)
- [ ] Constants derived FROM types, not vice versa
- [ ] API request/response shapes match backend contracts

**Quick Check:**

```bash
npm run typecheck  # No errors?
```

### Issue 2: Silent Auth Failures

- [ ] Every 401 has explicit error tracking
- [ ] `isAuthenticated` set to `false` (not null)
- [ ] Error message shown to user
- [ ] Recovery link provided (login button)
- [ ] 401 logged with context

**Quick Check:**

```bash
grep "response.status === 401" apps/web/src/**/*.tsx -A 5
# Verify all have: setIsAuthenticated(false), setError(), logger.warn()
```

### Issue 3: Hydration Mismatches

- [ ] No `null` returns from render
- [ ] Placeholders match content dimensions
- [ ] No `new Date()` in render code
- [ ] No `window` in render code
- [ ] Client-only code gated by `isHydrated`

**Quick Check:**

```bash
grep -n "return null" apps/web/src/**/*.tsx
# Should be 0 or only guarded by isHydrated checks
```

---

## Code Review Checklist

### For Every Component/Page

**Types & Contracts:**

- [ ] Data types from `@macon/contracts`? YES
- [ ] Any local type definitions? NO
- [ ] Request/response match backend? YES

**Auth & Errors:**

- [ ] 401s tracked explicitly? YES
- [ ] User sees error message? YES
- [ ] Recovery path available? YES

**Hydration & SSR:**

- [ ] Any null returns? NO
- [ ] Placeholder sizing correct? YES
- [ ] Window access in effects only? YES

---

## Quick Decision Trees

### "Where should this type be?"

```
Is it in the database? → YES → @macon/contracts
Does API return it?   → YES → @macon/contracts
Used by multiple components? → YES → @macon/contracts
Just this component? → YES → Keep it local ✓
```

### "How do I handle a 401?"

```
Set isAuthenticated = false  ✓
Set authError = { type, message, timestamp, recoverable }  ✓
Set error = user-friendly message  ✓
logger.warn('Auth failed', { endpoint })  ✓
Show "Log In Again" button  ✓
```

### "What do I render while loading?"

```
Do I have data?
├─ YES → Render data
└─ NO → Render placeholder with SAME dimensions ✓
   └─ Does placeholder need isHydrated gate?
      ├─ YES → {isHydrated && <Placeholder />}
      └─ NO → {data ?? <Placeholder />}
```

---

## One-Minute Problem Diagnosis

### Issue 1 Symptoms

- [ ] TypeScript errors about undefined types
- [ ] Data mismatch between API and component
- [ ] Multiple files need type updates
- [ ] IDE doesn't autocomplete API types

**Fix:** Import from `@macon/contracts`

### Issue 2 Symptoms

- [ ] Empty page without error message
- [ ] Can't debug why data didn't load
- [ ] User can't recover (no login link)
- [ ] No log entries for auth failure

**Fix:** Track 401 explicitly (error state + message + recovery)

### Issue 3 Symptoms

- [ ] Page flickers when loading
- [ ] Lighthouse CLS > 0.1
- [ ] "Hydration mismatch" in console
- [ ] Skeleton and content have different sizes

**Fix:** Always render placeholder, match dimensions

---

## Copy-Paste Code Patterns

### Pattern 1: Type Import

```typescript
// ✅ DO THIS
import type { SignupRequest, Package } from '@macon/contracts';

export function MyComponent() {
  const [data, setData] = useState<Package | null>(null);
  // ...
}
```

### Pattern 2: Auth Error Handling

```typescript
// ✅ DO THIS
if (response.status === 401) {
  setIsAuthenticated(false);
  setAuthError({
    type: 'SESSION_EXPIRED',
    message: 'Session expired. Please log in again.',
    timestamp: new Date(),
    recoverable: true,
  });
  setError('Session expired. Please log in again.');
  logger.warn('Auth failed', { endpoint });
  return;
}
```

### Pattern 3: Hydration-Safe Component

```typescript
// ✅ DO THIS
'use client';

const [data, setData] = useState<Data | null>(null);
const [isHydrated, setIsHydrated] = useState(false);

useEffect(() => {
  setIsHydrated(true);
  fetchData().then(setData);
}, []);

return (
  <div>
    {data ? (
      <Content data={data} />
    ) : (
      <Skeleton width="w-24" height="h-8" />
    )}
  </div>
);
```

---

## Common Anti-Patterns (DON'T DO)

```typescript
// ❌ ANTI-PATTERN 1: Local type definition
type SignupTier = (typeof SIGNUP_TIERS)[number];

// ❌ ANTI-PATTERN 2: Silent 401 dismissal
if (response.status === 401) {
  setState(null); // No error state!
  return;
}

// ❌ ANTI-PATTERN 3: Null return during loading
if (isLoading) {
  return null; // Creates hydration mismatch
}

// ❌ ANTI-PATTERN 4: Time in render
const now = new Date(); // Server ≠ client

// ❌ ANTI-PATTERN 5: Window in render
const isDesktop = window.innerWidth > 768; // Error on server
```

---

## Red Flags During Review

**STOP and ask questions if you see:**

- [ ] `type X = ...` definition (local types)
- [ ] `response.status === 401` with just `return;`
- [ ] `return null` or `return undefined`
- [ ] `new Date()` in render
- [ ] `window.` in render code
- [ ] `as any` or `as unknown as Type`
- [ ] Skeleton with no explicit size
- [ ] No `isHydrated` check before client-only UI

---

## Severity Quick Reference

| Issue              | P1? | User Sees? | Data Loss?   |
| ------------------ | --- | ---------- | ------------ |
| Duplicate Type     | YES | Wrong data | Maybe        |
| Silent 401         | YES | Empty page | Lost session |
| Hydration Mismatch | YES | Flicker    | No           |

**All three are blockers before merge to main.**

---

## Resources

Full documents (bookmark these):

1. **Types:** [DUPLICATE_TYPES_PREVENTION_STRATEGIES](./DUPLICATE_TYPES_PREVENTION_STRATEGIES-MAIS-20251231.md)
2. **Auth:** [AUTH_FAILURE_SILENT_ERROR_PREVENTION](./AUTH_FAILURE_SILENT_ERROR_PREVENTION-MAIS-20251231.md)
3. **Hydration:** [HYDRATION_MISMATCH_PREVENTION](./HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md)
4. **Index:** [P1_FRONTEND_PREVENTION_INDEX](./P1_FRONTEND_PREVENTION_INDEX-MAIS-20251231.md)

---

## Last-Minute Verification

**30 seconds before pushing:**

```bash
# 1. TypeScript passes
npm run typecheck

# 2. No console errors (dev mode)
# npm run dev:web
# Check browser console for hydration warnings

# 3. Auth error visible in network tab
# Open DevTools → Network
# Manually trigger 401, verify error message shown

# 4. No layout shift
# Load page, watch for jumping/shifting content
```

---

## Questions During Code Review

Ask these for every component:

1. **"Where do these types come from?"**
   - Should be: "From @macon/contracts"
   - Red flag: "I defined them locally"

2. **"What happens if the API returns 401?"**
   - Should be: "User sees error message and login button"
   - Red flag: "Page becomes empty" or "I don't know"

3. **"Could this render differently on server vs client?"**
   - Should be: "No, always shows placeholder"
   - Red flag: "Maybe..." or "I'll find out at runtime"

---

## If You Find a Bug

**Link to this document:**

In GitHub issue:

```
Related to P1 issue: [Issue Type]
See prevention guide: [Document Link]
Pattern to follow: [Code Example]
```

Example:

```
Related to P1 issue: Silent Auth Failures
See: docs/solutions/AUTH_FAILURE_SILENT_ERROR_PREVENTION-MAIS-20251231.md
Pattern: Every 401 must set isAuthenticated=false + error message + logger.warn()
```

---

## For Code Review Training

**Share this checklist when:**

- [ ] New team member joins frontend team
- [ ] After P1 bug is found and fixed
- [ ] During sprint planning
- [ ] At code review standup

**Time to review:** 5 minutes
**Time to apply:** 10 seconds per component

---

**Last Updated:** 2025-12-31
**Applies to:** All PRs to main branch
**Enforced by:** Code review before merge
