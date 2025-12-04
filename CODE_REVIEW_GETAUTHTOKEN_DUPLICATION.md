# Code Review: getAuthToken() Duplication Analysis

**Commit:** 9c3f707 - fix(security): harden file uploads
**Files Affected:** 5 client-side files
**Status:** Quick Fix Pattern Applied
**Severity:** Low-Medium (Code Maintainability)

---

## Executive Summary

The recent security hardening commit added an identical `getAuthToken()` helper function to 5 separate files (8-13 lines each). This is a **textbook example of acceptable quick-fix code** that should be refactored soon, but the trade-off decision was correct given the context.

**Verdict:** ✅ Quick fix was justified, ⚠️ refactor needed within 1-2 sprints

---

## Files with Duplication

| File                                                                        | Lines            | Added In                        |
| --------------------------------------------------------------------------- | ---------------- | ------------------------------- |
| `client/src/components/ImageUploadField.tsx`                                | 34-40 (7 lines)  | Upload handler component        |
| `client/src/features/tenant-admin/scheduling/AppointmentsView/index.tsx`    | 18-24 (7 lines)  | Query hook (3 usages)           |
| `client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx` | 9-15 (7 lines)   | Logo uploader component         |
| `client/src/features/photos/hooks/usePhotoUpload.ts`                        | 37-45 (9 lines)  | Hook with `providedToken` param |
| `client/src/lib/package-photo-api.ts`                                       | 69-78 (10 lines) | API service module              |

**Total Duplication:** ~40 lines across 5 files

---

## The Function

```typescript
function getAuthToken(providedToken?: string): string | null {
  if (providedToken) return providedToken;
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    return localStorage.getItem('adminToken');
  }
  return localStorage.getItem('tenantToken');
}
```

**Variations:**

- Most use the no-param version
- `usePhotoUpload.ts` accepts optional `providedToken` parameter
- All follow identical impersonation logic

---

## 1. Is This the Simplest Solution?

### Yes, partially.

**Pros:**

- ✅ Gets the feature working immediately
- ✅ No refactoring needed to merge quickly
- ✅ Isolated within files that use it
- ✅ Low risk of cross-module coupling side effects
- ✅ Matches the commit's security focus (not refactoring)

**Cons:**

- ❌ Future maintenance burden if impersonation logic changes
- ❌ 5 places to update if token key names change
- ❌ Violates DRY principle
- ❌ Tests can't verify logic in one place

### Could it be simpler?

**No**, the current implementation is about as simple as it gets. The function itself is straightforward. The issue is repetition, not complexity.

---

## 2. Could It Be Simplified Further?

The function is already minimal (3-5 lines of logic). **No further simplification is possible** without changing the approach entirely.

### However, simpler solutions exist:

**Option A: Smart import (RECOMMENDED)**

```typescript
// client/src/lib/auth-helpers.ts (NEW FILE)
export function getAuthToken(providedToken?: string): string | null {
  if (providedToken) return providedToken;
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  return isImpersonating ? localStorage.getItem('adminToken') : localStorage.getItem('tenantToken');
}
```

Then import everywhere:

```typescript
import { getAuthToken } from '@/lib/auth-helpers';
```

**Cost to implement:** 10 minutes
**Risk level:** Minimal

---

## 3. Is the Duplication Acceptable as a Quick Fix?

### Yes, for now. But with caveats.

**Context matters:**

- The commit is a **security hardening fix** (high priority)
- Impersonation support was a recent addition
- This pattern wasn't needed in earlier iterations
- The repo is in MVP sprint (time pressure)

**Acceptable because:**

1. It's frontend code, not core business logic
2. The logic is simple and stable
3. File-scoped, so no risk of cross-module issues
4. Easy to refactor retroactively
5. Used immediately (not left as technical debt)

**Must refactor if:**

- The impersonation logic becomes more complex
- Another 2+ files need this function
- Token key names change (now you edit 5+ files)
- This gets tested in multiple places

---

## 4. Over-Engineering Aspects?

### No, quite the opposite.

**This avoids over-engineering:**

- ❌ NOT creating a complex AuthService class
- ❌ NOT adding a React context for this
- ❌ NOT creating a custom hook when it's simpler as a function
- ❌ NOT adding configuration layer

**What WAS over-engineered:** None detected

---

## Severity Assessment

### Code Quality Impact: 🟡 Low-Medium

| Aspect          | Score | Reason                                 |
| --------------- | ----- | -------------------------------------- |
| Maintainability | 6/10  | Duplication increases maintenance cost |
| Testability     | 7/10  | Logic can be unit tested, but 5x       |
| Security        | 10/10 | Correct impersonation handling         |
| Performance     | 10/10 | Zero performance impact                |
| Scalability     | 5/10  | Scales poorly if more files need this  |

### Technical Debt Score: 🟡 Medium

**Why medium and not low?**

- The pattern duplicates logic across 5 files
- Token key changes require 5 edits
- New team members might duplicate it again (7th file)
- Tests can't verify centralized logic

**Why not high?**

- It's not blocking anything
- Easy to refactor (file scope)
- No architectural blocker
- Simple function, not complex logic

---

## Decision Framework

### Quick Fix vs. Proper Fix Trade-off Analysis

**Context (as of commit 9c3f707):**

- MVP sprint, Day 4 (aggressive timeline)
- Security issue needed fixing immediately
- Impersonation feature was complex enough
- No time for module reorganization

**Decision Matrix:**

| Factor             | Weight | Quick Fix  | Proper Fix  |
| ------------------ | ------ | ---------- | ----------- |
| Time to implement  | High   | ✅ Now     | ⚠️ 30 mins  |
| Risk of regression | High   | ✅ Low     | ✅ Very Low |
| Merge friction     | High   | ✅ None    | ⚠️ Possible |
| Future maintenance | Medium | ⚠️ Cost    | ✅ Benefit  |
| Test coverage      | Medium | ⚠️ 5 files | ✅ 1 file   |

**Verdict for commit 9c3f707:** ✅ Quick fix was correct choice at that moment

---

## Recommended Refactoring Plan

### Phase 1: Extract Helper (1-2 sprints from now)

**File:** Create `/client/src/lib/auth-helpers.ts`

```typescript
/**
 * Client-side authentication helpers
 *
 * These are separate from @/lib/auth.ts which handles JWT decoding.
 * This module handles localStorage token resolution with impersonation support.
 */

export const AUTH_STORAGE_KEYS = {
  ADMIN_TOKEN: 'adminToken',
  TENANT_TOKEN: 'tenantToken',
  IMPERSONATION_TENANT_KEY: 'impersonationTenantKey',
} as const;

/**
 * Get active authentication token, handling impersonation
 *
 * Resolution order:
 * 1. If provided, use the provided token
 * 2. If impersonating (admin token), use admin token (contains impersonation context)
 * 3. Otherwise use tenant token (normal admin access)
 *
 * @param providedToken - Optional explicit token (used by usePhotoUpload)
 * @returns JWT token or null if not authenticated
 */
export function getAuthToken(providedToken?: string): string | null {
  if (providedToken) return providedToken;

  const isImpersonating = localStorage.getItem(AUTH_STORAGE_KEYS.IMPERSONATION_TENANT_KEY);
  if (isImpersonating) {
    return localStorage.getItem(AUTH_STORAGE_KEYS.ADMIN_TOKEN);
  }

  return localStorage.getItem(AUTH_STORAGE_KEYS.TENANT_TOKEN);
}

/**
 * Check if platform admin is currently impersonating a tenant
 */
export function isImpersonating(): boolean {
  return !!localStorage.getItem(AUTH_STORAGE_KEYS.IMPERSONATION_TENANT_KEY);
}
```

**Update all 5 files:**

```typescript
// Before
function getAuthToken(): string | null { ... }

// After
import { getAuthToken } from '@/lib/auth-helpers';
```

**Cost:** ~20 minutes
**Files to update:** 5
**Tests:** 1 test file for new module

### Phase 2: Consider Further Consolidation (Optional, future)

After Phase 1 stabilizes, consider whether `auth-helpers.ts` should be merged into existing `auth.ts`:

**Potential concern:** `auth.ts` uses JWT decoding (server verification), while `auth-helpers.ts` just reads localStorage. Keep separate for clarity.

---

## Test Coverage Impact

### Current State (Post-Fix)

- `getAuthToken()` logic duplicated 5 times
- Hard to test holistically
- Each file would need its own test

### Post-Refactor State

```typescript
// client/src/lib/auth-helpers.test.ts
import { getAuthToken, isImpersonating } from './auth-helpers';

describe('getAuthToken', () => {
  beforeEach(() => localStorage.clear());

  it('returns provided token if given', () => {
    expect(getAuthToken('explicit_token')).toBe('explicit_token');
  });

  it('returns admin token when impersonating', () => {
    localStorage.setItem('impersonationTenantKey', 'pk_live_123');
    localStorage.setItem('adminToken', 'admin_token_123');
    expect(getAuthToken()).toBe('admin_token_123');
  });

  it('returns tenant token when not impersonating', () => {
    localStorage.setItem('tenantToken', 'tenant_token_456');
    expect(getAuthToken()).toBe('tenant_token_456');
  });

  it('returns null if no token present', () => {
    expect(getAuthToken()).toBeNull();
  });
});

describe('isImpersonating', () => {
  it('returns true when impersonating', () => {
    localStorage.setItem('impersonationTenantKey', 'pk_live_123');
    expect(isImpersonating()).toBe(true);
  });

  it('returns false when not impersonating', () => {
    expect(isImpersonating()).toBe(false);
  });
});
```

---

## Prevention Strategy

### How to avoid this pattern in future?

1. **Establish Auth Utility Module Pattern**
   - All `localStorage` token reads go through `@/lib/auth-helpers`
   - One source of truth for token resolution

2. **Code Review Guideline**
   - Flag duplicate `localStorage.getItem('*Token')` patterns
   - Require refactor if same function appears in 2+ files

3. **Documentation**
   - Add note to CLAUDE.md about auth utility location
   - Link to `auth-helpers.ts` in auth section

4. **Linter Rule (Optional)**
   - Consider ESLint rule to flag hardcoded localStorage keys
   - Force import from constants module

---

## Related Context

### Existing Infrastructure

The codebase already has a strong auth module at `/client/src/lib/auth.ts` that handles:

- JWT decoding and validation
- Token expiration checks
- Platform admin vs. tenant role detection
- Token storage management

**Why not use it for `getAuthToken()`?**

- `auth.ts` functions require role parameter
- `getAuthToken()` auto-detects role via impersonation check
- Different concern (role-agnostic token resolution vs. JWT parsing)
- Separate concerns = easier to understand

### Related Code Patterns

The impersonation flow is already complex:

- `/client/src/lib/api.ts` has similar logic (lines 138-154)
- Both check `impersonationTenantKey` → use `adminToken`
- Pattern is intentional and correct

---

## Summary Table

| Question                   | Answer                    | Severity   |
| -------------------------- | ------------------------- | ---------- |
| Is this simplest solution? | Yes, for quick fix        | N/A        |
| Could it be simplified?    | No, already minimal       | N/A        |
| Is duplication acceptable? | Yes, now, not later       | Low        |
| Over-engineered?           | No, well-engineered       | N/A        |
| **Refactor required?**     | **Yes, within 2 sprints** | **Medium** |
| **Blocks shipping?**       | No                        | N/A        |
| **Security concern?**      | No, logic is correct      | N/A        |

---

## Recommendation

### ✅ APPROVE as-is for current sprint

The quick-fix approach was the right call given:

- MVP sprint timeline (Day 4)
- Security priority
- Simple, isolated code
- Low risk of breakage

### ⚠️ BACKLOG for next sprint

**TODO for Team:**

- [ ] Create `/client/src/lib/auth-helpers.ts` with centralized `getAuthToken()`
- [ ] Update 5 files to import from helpers
- [ ] Add unit tests for `auth-helpers.ts`
- [ ] Update CLAUDE.md to document auth utility pattern
- [ ] Estimated effort: 30 minutes

### 📋 Prevention for Future

Add to code review checklist:

> "Check for duplicated localStorage token access patterns. Centralize via auth-helpers module."

---

## Final Assessment

**Code Quality:** 7/10 (Good, with known technical debt)
**Security:** 10/10 (Correct impersonation handling)
**Maintainability:** 6/10 (Duplication hurts long-term)
**Architecture:** 8/10 (Well-scoped, just needs consolidation)

**Overall:** ✅ **ACCEPTABLE QUICK FIX** with **CLEAR REFACTORING PATH**
