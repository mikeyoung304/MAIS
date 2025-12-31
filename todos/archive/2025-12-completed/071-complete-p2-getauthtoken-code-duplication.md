---
status: complete
priority: p2
issue_id: '071'
tags: [code-review, dry-violation, maintainability, authentication]
dependencies: []
---

# P2: getAuthToken() Duplicated Across 5 Client Files

## Problem Statement

The `getAuthToken()` helper function is duplicated identically across 5 files in the client codebase. This violates DRY principles and creates maintenance burden when authentication logic needs to change.

**Why it matters:** Authentication logic is security-critical. If a bug is found or the logic needs to change (e.g., adding token refresh), it must be updated in 5 places with risk of inconsistency.

## Findings

### Duplicated Locations

1. `client/src/lib/package-photo-api.ts` (lines 69-78)
2. `client/src/features/photos/hooks/usePhotoUpload.ts` (lines 37-45)
3. `client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx` (lines 9-15)
4. `client/src/features/tenant-admin/scheduling/AppointmentsView/index.tsx` (lines 18-24)
5. `client/src/components/ImageUploadField.tsx` (lines 34-40)

### Duplicated Code (~40 lines total)

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

### Existing Centralized Auth

The codebase already has `client/src/lib/auth.ts` with auth utilities like:

- `getToken(role: UserRole)`
- `getActiveUser()`
- `AUTH_STORAGE_KEYS`

The new function should be added here.

## Proposed Solutions

### Solution 1: Centralize in auth.ts (RECOMMENDED)

**Description:** Add `getAuthToken()` to `client/src/lib/auth.ts` and update all 5 files to import it.

**Pros:**

- Single source of truth
- Easy to test
- Follows existing patterns
- ~20 minute effort

**Cons:**

- Requires updating 5 files

**Effort:** Small (30 minutes)
**Risk:** Low

```typescript
// Add to client/src/lib/auth.ts
export function getAuthToken(providedToken?: string): string | null {
  if (providedToken) return providedToken;
  const isImpersonating = localStorage.getItem(AUTH_STORAGE_KEYS.IMPERSONATION_KEY);
  if (isImpersonating) {
    return localStorage.getItem(AUTH_STORAGE_KEYS.PLATFORM_ADMIN_TOKEN);
  }
  return localStorage.getItem(AUTH_STORAGE_KEYS.TENANT_ADMIN_TOKEN);
}
```

### Solution 2: Create auth-helpers.ts

**Description:** New file specifically for auth helper functions.

**Pros:**

- Clear separation
- Could include other helpers

**Cons:**

- Fragmentates auth code
- auth.ts already exists for this purpose

**Effort:** Small (30 minutes)
**Risk:** Low

### Solution 3: Leave as Quick Fix

**Description:** Accept duplication as technical debt.

**Pros:**

- No immediate work needed

**Cons:**

- Debt accumulates
- Risk of inconsistent updates
- Poor maintainability

**Effort:** None
**Risk:** Medium (long-term)

## Recommended Action

**Solution 1** - Centralize in existing `auth.ts` file. Low effort, high value.

## Technical Details

### Affected Files

- `client/src/lib/auth.ts` (add new export)
- 5 files listed above (update imports, remove local function)

### Migration Steps

1. Add `getAuthToken()` to `auth.ts` with JSDoc
2. Add unit tests in `auth.test.ts`
3. Update each file to `import { getAuthToken } from '@/lib/auth'`
4. Remove local function definitions
5. Run typecheck and tests

### Acceptance Criteria

- [ ] `getAuthToken()` exported from `client/src/lib/auth.ts`
- [ ] Unit tests cover: normal auth, impersonation, provided token, no token
- [ ] All 5 files import from central location
- [ ] No duplicate function definitions remain
- [ ] TypeScript compiles without errors
- [ ] Manual test: impersonation photo upload works

## Work Log

| Date       | Action  | Notes                    |
| ---------- | ------- | ------------------------ |
| 2025-11-29 | Created | Found during code review |

## Resources

- Existing auth utilities: `client/src/lib/auth.ts`
- Similar pattern in api.ts: lines 138-154
