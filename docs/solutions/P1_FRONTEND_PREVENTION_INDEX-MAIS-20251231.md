---
module: MAIS
date: 2025-12-31
problem_type: prevention_index
component: apps/web/src (all)
phase: Frontend Development
severity: P1
related_documents:
  - DUPLICATE_TYPES_PREVENTION_STRATEGIES-MAIS-20251231.md
  - AUTH_FAILURE_SILENT_ERROR_PREVENTION-MAIS-20251231.md
  - HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md
tags: [prevention, frontend, p1-issues, code-review, patterns]
---

# P1 Frontend Prevention Strategies Index

**Quick Links to Prevention Documents:**

1. [Duplicate Types](./DUPLICATE_TYPES_PREVENTION_STRATEGIES-MAIS-20251231.md) - Types defined locally instead of imported from contracts
2. [Silent Auth Failures](./AUTH_FAILURE_SILENT_ERROR_PREVENTION-MAIS-20251231.md) - 401 handled without explicit state tracking
3. [Hydration Mismatches](./HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md) - Returning null during SSR instead of placeholder

---

## The Three P1 Issues at a Glance

### Issue 1: Duplicate Types

**Symptom:** Developer defines local type instead of importing from `@macon/contracts`

```typescript
// ❌ WRONG
type SignupTier = (typeof SIGNUP_TIERS)[number];

// ✅ RIGHT
import type { SignupTier } from '@macon/contracts';
```

**Why it matters:** Types diverge from backend contracts → runtime data mismatches

**Prevention:** All types imported from `@macon/contracts`, none defined locally

**Document:** [DUPLICATE_TYPES_PREVENTION_STRATEGIES-MAIS-20251231.md](./DUPLICATE_TYPES_PREVENTION_STRATEGIES-MAIS-20251231.md)

---

### Issue 2: Silent Auth Failures

**Symptom:** 401 responses handled without explicit state tracking

```typescript
// ❌ WRONG - Silent dismissal
if (response.status === 401) {
  setState(null);
  return;
}

// ✅ RIGHT - Explicit error tracking
if (response.status === 401) {
  const authError: AuthError = { type: 'SESSION_EXPIRED', ... };
  setIsAuthenticated(false);
  setAuthError(authError);
  setError(authError.message);
  logger.warn('Auth expired', { endpoint });
  return;
}
```

**Why it matters:** User sees empty page without knowing session expired → broken UX

**Prevention:** Every 401 → explicit state + error message + recovery link + logging

**Document:** [AUTH_FAILURE_SILENT_ERROR_PREVENTION-MAIS-20251231.md](./AUTH_FAILURE_SILENT_ERROR_PREVENTION-MAIS-20251231.md)

---

### Issue 3: Hydration Mismatches

**Symptom:** Returning null during SSR instead of placeholder

```typescript
// ❌ WRONG - Server renders nothing, client renders skeleton
if (isLoading) {
  return null;  // Server has empty div, client has skeleton
}

// ✅ RIGHT - Server and client both show placeholder
return <div>{data ?? <Skeleton />}</div>;
```

**Why it matters:** Layout shift during load → poor CLS score + flickering page

**Prevention:** Always render placeholder that matches content dimensions

**Document:** [HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md](./HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md)

---

## Pre-Commit Checklist for Developers

### Before Every Commit (5 minutes)

Run these checks:

```bash
# 1. Check for local type definitions (should be 0)
grep -rn "^type " apps/web/src --include="*.tsx" \
  | grep -v "use client" \
  | grep -v "interface" \
  | wc -l  # Should be 0 or very low

# 2. Check for null returns in render (should be 0)
grep -rn "return null" apps/web/src --include="*.tsx" \
  | grep -v "if (!isHydrated)" \
  | wc -l  # Should be low

# 3. Type check passes
npm run typecheck  # No errors

# 4. No silent error dismissals
grep -rn "if.*401" apps/web/src --include="*.tsx" -A 3 \
  | grep "return;" # Verify all 401s have error tracking before return
```

### During Code Review (What Reviewers Check)

**For every component/page:**

- [ ] **Types:** All data types imported from `@macon/contracts`
- [ ] **Auth Errors:** 401 responses have explicit state tracking
- [ ] **Hydration:** No null returns, consistent SSR rendering
- [ ] **Testing:** New changes tested or have test blockers

---

## Quick Decision Trees

### "Should I define this type?"

```
Is this type used by the API?
├─ YES → Add to @macon/contracts ✓
└─ NO → Could other components need it?
   ├─ YES → Add to @macon/contracts ✓
   └─ NO → Keep it component-scoped ✓
```

### "How should I handle this API error?"

```
Is the error a 401?
├─ YES → Set isAuthenticated=false + authError + message + log ✓
└─ NO → Is it a network error?
   ├─ YES → Set error state, show retry button ✓
   └─ NO → Show generic error message ✓
```

### "What should my component show while loading?"

```
Do I have data yet?
├─ YES → Render it
└─ NO → Show placeholder that matches content size ✓
   └─ Does placeholder need to be client-only?
      ├─ YES → Gate behind isHydrated ✓
      └─ NO → Render immediately on server ✓
```

---

## Code Review Checklist Templates

### Template 1: Data Types Review

```markdown
### Types & Contracts

- [ ] All data types imported from `@macon/contracts`
- [ ] No local type definitions (except UI state)
- [ ] Request/response types match backend contracts
- [ ] TypeScript strict mode passes
- [ ] No `any` type assertions (except library-required ones)

**Questions:**

- Is there a contract type for this data?
- Could another component use this type?
- Does the backend agree on this shape?
```

### Template 2: Auth Error Handling Review

```markdown
### Authentication & Error Handling

- [ ] 401 responses have explicit state tracking
- [ ] `isAuthenticated` set to `false` (not just null)
- [ ] `authError` object created with type/message/timestamp
- [ ] Error message shown to user
- [ ] Recovery link (login button) provided
- [ ] Error logged with context (endpoint, state change)
- [ ] 401 handling tested separately

**Questions:**

- What happens when this API returns 401?
- Could user see empty page without knowing why?
- How would we debug this in production?
```

### Template 3: Hydration Safety Review

```markdown
### SSR & Hydration Safety

- [ ] No `null` returns from render
- [ ] Placeholder has same dimensions as content
- [ ] No `window`/`document` in render code
- [ ] Client-only code gated by `isHydrated`
- [ ] Data fetching only in `useEffect`
- [ ] No time-based rendering differences (no `new Date()` in render)
- [ ] Lighthouse CLS < 0.1

**Questions:**

- Could this render differently on server vs client?
- Would hydration cause layout shift?
- Are any dimensions different between placeholder and content?
```

---

## Testing Strategy

### Unit Tests to Write

**For types:**

```typescript
// Verify imports match backend
import type { SignupRequest } from '@macon/contracts';

test('SignupRequest has required fields', () => {
  const request: SignupRequest = {
    email: 'test@example.com',
    password: 'secure',
    selectedTier: 'TIER_1',
  };
  expect(request).toBeDefined();
});
```

**For auth errors:**

```typescript
// Verify 401 tracking
test('should track auth error on 401', async () => {
  const hook = renderHook(() => useAuth());

  // Mock 401 response
  // Assert: isAuthenticated = false
  // Assert: authError set
  // Assert: logger.warn called
});
```

**For hydration:**

```typescript
// Verify no mismatch
test('should render same on server and client', () => {
  const ssr = renderToString(<Component />);
  const client = render(<Component />);
  expect(ssr).toBe(client.innerHTML);
});
```

### E2E Tests to Write

**For auth recovery:**

```typescript
// Verify user can recover from 401
test('should show login button on auth failure', async ({ page }) => {
  // Trigger 401
  // Assert: "Session expired" message visible
  // Assert: "Log In Again" button clickable
});
```

**For CLS:**

```typescript
// Verify no layout shift
test('should have zero CLS', async ({ page }) => {
  const cls = await measureCLS(page);
  expect(cls).toBeLessThan(0.1);
});
```

---

## Common Mistakes to Avoid

### Mistake 1: Type Duplication

```typescript
// ❌ DON'T
const SIGNUP_TIERS = ['TIER_1', 'TIER_2', 'TIER_3'] as const;
type SignupTier = (typeof SIGNUP_TIERS)[number];

// ✅ DO
import type { SignupTier } from '@macon/contracts';
const SIGNUP_TIERS: SignupTier[] = ['TIER_1', 'TIER_2', 'TIER_3'];
```

### Mistake 2: Silent 401 Dismissal

```typescript
// ❌ DON'T
if (response.status === 401) {
  setState(null);
  return;  // Silent failure
}

// ✅ DO
if (response.status === 401) {
  setIsAuthenticated(false);
  setError('Session expired. Please log in again.');
  setAuthError({ type: 'SESSION_EXPIRED', ... });
  logger.warn('Auth failure', { endpoint });
  return;
}
```

### Mistake 3: Null During Loading

```typescript
// ❌ DON'T
if (isLoading) {
  return null;  // Creates hydration mismatch
}

// ✅ DO
return <div>{data ?? <Skeleton />}</div>;
```

### Mistake 4: Time in Render

```typescript
// ❌ DON'T
export function TimeCard() {
  return <div>{new Date().toLocaleString()}</div>;  // Server ≠ client
}

// ✅ DO
export function TimeCard() {
  const [time, setTime] = useState('');

  useEffect(() => {
    setTime(new Date().toLocaleString());
  }, []);

  return <div>{time || <Skeleton />}</div>;
}
```

### Mistake 5: Window in Render

```typescript
// ❌ DON'T
const isDesktop = window.innerWidth > 768;  // Error on server

// ✅ DO
const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
useEffect(() => {
  setIsDesktop(window.innerWidth > 768);
}, []);
return <div>{isDesktop ?? <Skeleton />}</div>;
```

---

## Impact Summary

### Issue 1: Duplicate Types

- **Current:** Every type change requires updating multiple files
- **After Fix:** Change in contracts automatically propagates
- **Time Saved:** 30 min/week (no manual sync)

### Issue 2: Silent Auth Failures

- **Current:** Users see empty page, can't debug why
- **After Fix:** Clear error message + recovery link
- **User Impact:** No more "why did my session die?" confusion

### Issue 3: Hydration Mismatches

- **Current:** Page flickers, CLS > 0.1 (poor score)
- **After Fix:** Smooth load, CLS < 0.1 (good score)
- **Lighthouse Impact:** +15-20 points on Performance

---

## Where to Start

### If You're Reviewing a PR

1. Use the **Code Review Checklist Templates** above
2. Ask the **review questions** for each issue
3. Link to the specific prevention document if issue found

### If You're Writing a Component

1. Check the **Pre-Commit Checklist**
2. Follow the **Code Patterns** in the prevention documents
3. Write the **unit/E2E tests** listed above

### If You Find a Regression

1. Create a GitHub issue linking to the relevant prevention document
2. Add it to the next code review training
3. Consider if pattern needs to be enforced more strictly

---

## Links to Full Prevention Documents

| Document                                                                                          | Focus Area                                            |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [DUPLICATE_TYPES_PREVENTION_STRATEGIES](./DUPLICATE_TYPES_PREVENTION_STRATEGIES-MAIS-20251231.md) | Type imports, contracts alignment, decision tree      |
| [AUTH_FAILURE_SILENT_ERROR_PREVENTION](./AUTH_FAILURE_SILENT_ERROR_PREVENTION-MAIS-20251231.md)   | 401 handling, state tracking, error recovery patterns |
| [HYDRATION_MISMATCH_PREVENTION](./HYDRATION_MISMATCH_PREVENTION-MAIS-20251231.md)                 | SSR rendering, placeholder sizing, layout shifts      |

---

## Questions?

Refer to the full prevention documents for:

- **Detailed code patterns** (copy-paste examples)
- **Testing strategies** (unit + E2E)
- **Decision trees** (when to apply each pattern)
- **Common mistakes** (anti-patterns to avoid)
- **Code review checklists** (what reviewers should verify)
