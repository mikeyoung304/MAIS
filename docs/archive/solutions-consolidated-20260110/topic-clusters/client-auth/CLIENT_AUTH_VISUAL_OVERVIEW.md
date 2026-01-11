# Client-Side Authentication: Visual Overview

**Visual guide to the client authentication architecture and the vulnerability.**

---

## Current Architecture (VULNERABLE)

```
┌─────────────────────────────────────────────────────────────────┐
│                    5 DUPLICATE IMPLEMENTATIONS                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📄 package-photo-api.ts          function getAuthToken()       │
│  📄 ImageUploadField.tsx            const isImpersonating = ... │
│  📄 LogoUploadButton.tsx            if (isImpersonating) {      │
│  📄 usePhotoUpload.ts                 return adminToken;       │
│  📄 ??? (unknown file)              } else {                    │
│                                      return tenantToken;       │
│                                    }                            │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  PROBLEM: Same logic in 5 places, risk of divergence            │
│  RISK: Code duplication leads to maintenance issues             │
│  BUG: Inconsistent token selection during impersonation         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Proposed Architecture (FIXED)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CENTRALIZED IMPLEMENTATION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│                    client/src/lib/auth.ts                       │
│                                                                   │
│   export function getAuthToken(): string | null {               │
│     const isImpersonating = localStorage                         │
│       .getItem('impersonationTenantKey');                       │
│     if (isImpersonating) {                                      │
│       return localStorage.getItem('adminToken');                │
│     }                                                            │
│     return localStorage.getItem('tenantToken');                 │
│   }                                                              │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  BENEFIT: Single source of truth                                │
│  BENEFIT: Easy to audit and test                                │
│  BENEFIT: Consistent behavior everywhere                        │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ import
         │
    ┌────┴─────────────────────────────────────────────────────┐
    │                                                             │
    │  Used by all these files:                                 │
    │  ✓ package-photo-api.ts                                   │
    │  ✓ ImageUploadField.tsx                                   │
    │  ✓ LogoUploadButton.tsx                                   │
    │  ✓ usePhotoUpload.ts                                      │
    │  ✓ Any other auth-needing code                            │
    │                                                             │
    └────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Normal Tenant Operation

```
Tenant logs in
      │
      ▼
┌──────────────────────────┐
│ AuthContext.login()      │
└──────────────────────────┘
      │
      ▼
┌──────────────────────────┐
│ storeToken(token, role)  │
│ Sets: tenantToken        │
└──────────────────────────┘
      │
      ▼
localStorage:
┌──────────────────────────┐
│ tenantToken: "eyJ..."    │
│ adminToken: null         │
│ impersonationTenantKey: null    │
└──────────────────────────┘
      │
      ▼
Component needs to upload:
┌──────────────────────────┐
│ const token = getAuthToken()   │
│ Returns: tenantToken (from localStorage) │
└──────────────────────────┘
      │
      ▼
fetch request:
┌──────────────────────────┐
│ Authorization: Bearer eyJ... │
│ (tenantToken)            │
└──────────────────────────┘
      │
      ▼
Server validates:
✓ Token is valid
✓ Token belongs to tenant
✓ Request succeeds
```

---

## Data Flow: Platform Admin Impersonation

```
Platform admin logs in
      │
      ▼
┌──────────────────────────┐
│ AuthContext.login()      │
│ role = PLATFORM_ADMIN    │
└──────────────────────────┘
      │
      ▼
localStorage:
┌──────────────────────────┐
│ adminToken: "eyJ..." (ADMIN role) │
│ tenantToken: null        │
│ impersonationTenantKey: null  │
└──────────────────────────┘
      │
      ▼
Admin clicks: "Impersonate tenant 123"
      │
      ▼
┌──────────────────────────────────┐
│ api.adminImpersonate('tenant_123')   │
│ (API call to /v1/auth/impersonate)   │
└──────────────────────────────────┘
      │
      ▼
Server returns new token:
┌──────────────────────────────────┐
│ {                                │
│   token: "eyJ..." (ADMIN role    │
│            + impersonating: {    │
│              tenantId: "123"      │
│            })                     │
│   apiKeyPublic: "pk_live_..."    │
│ }                                │
└──────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────┐
│ api.adminImpersonate() updates:  │
│ - localStorage['adminToken']     │ ← NEW token with impersonation context
│ - localStorage['impersonationTenantKey'] ← Set to pk_live_... │
└──────────────────────────────────┘
      │
      ▼
localStorage:
┌──────────────────────────┐
│ adminToken: "eyJ..." (ADMIN + impersonating) │
│ tenantToken: null/old    │
│ impersonationTenantKey: "pk_live_..." │
└──────────────────────────┘
      │
      ▼
Component needs to upload:
┌──────────────────────────┐
│ const token = getAuthToken()   │
│                          │
│ Checks:                  │
│ 1. isImpersonating?      │
│    - YES (pk_live_... set) │
│ 2. Return adminToken     │
│                          │
│ Returns: adminToken (with impersonation context) │
└──────────────────────────┘
      │
      ▼
fetch request:
┌──────────────────────────┐
│ Authorization: Bearer eyJ... │
│ (adminToken with impersonation context) │
└──────────────────────────┘
      │
      ▼
Server validates:
✓ Token is ADMIN role
✓ Token has impersonation context
✓ Impersonation context has tenantId
✓ Request succeeds with tenant 123 context
```

---

## The Bug (Current Behavior)

```
When getAuthToken() is duplicated:

File A: packagePhotoApi.ts
┌────────────────────────────────────┐
│ function getAuthToken() {           │
│   if (impersonating) {              │
│     return adminToken;              │ ✓ Correct
│   }                                 │
│   return tenantToken;               │
│ }                                   │
└────────────────────────────────────┘
           │
           ▼
         ✓ WORKS during impersonation


File B: LogoUploadButton.tsx
┌────────────────────────────────────┐
│ function getAuthToken() {           │
│   if (impersonating) {              │
│     return adminToken;              │ ✓ Correct in this file
│   }                                 │
│   return tenantToken;               │
│ }                                   │
└────────────────────────────────────┘
           │
           ▼
         ✓ WORKS during impersonation


File C: (hypothetical) SomeNewComponent.tsx
┌────────────────────────────────────┐
│ function getAuthToken() {           │
│   return localStorage               │
│     .getItem('tenantToken');        │ ✗ WRONG - only checks tenantToken
│ }                                   │
└────────────────────────────────────┘
           │
           ▼
         ✗ FAILS during impersonation
            - tenantToken = null
            - adminToken not checked
            - Request has no Authorization header
            - Server returns 401 Unauthorized


RESULT: Impersonation works in some components, fails in others
        Inconsistent behavior, hard to debug
```

---

## The Fix (Proposed Behavior)

```
Central implementation: client/src/lib/auth.ts
┌────────────────────────────────────┐
│ export function getAuthToken() {    │
│   const impersonating =             │
│     localStorage                    │
│     .getItem('impersonationTenantKey'); │
│                                     │
│   if (impersonating) {              │
│     return localStorage             │
│       .getItem('adminToken');       │ ✓ Correct every time
│   }                                 │
│   return localStorage               │
│     .getItem('tenantToken');        │
│ }                                   │
└────────────────────────────────────┘
           │
           │ imported by
           │
        ┌──┴──┬──────┬──────┬──────┐
        │     │      │      │      │
        ▼     ▼      ▼      ▼      ▼
     packagePhotoApi ImageUploadField LogoUploadButton usePhotoUpload ...


RESULT: All components use same logic, consistent behavior everywhere
        Easy to debug, easy to audit, easy to test
```

---

## Token Selection Decision Tree

```
                    getAuthToken() called
                           │
                           ▼
                ┌──────────────────────┐
                │ Check localStorage   │
                │ for impersonationKey │
                └──────────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
               Found?         Not found?
                    │             │
                    ▼             ▼
            ┌──────────────┐  ┌──────────────┐
            │ Return       │  │ Return       │
            │ adminToken   │  │ tenantToken  │
            │ (contains    │  │ (scoped to   │
            │ impersonation│  │ current      │
            │ context)     │  │ tenant)      │
            └──────────────┘  └──────────────┘
                    │             │
                    └──────┬───────┘
                           │
                           ▼
                    Authorization: Bearer <token>
                    in all requests
```

---

## File Dependencies Before Fix

```
package-photo-api.ts
├─ getAuthToken() (duplicated)
├─ fetch() direct call
└─ localStorage access

ImageUploadField.tsx
├─ getAuthToken() (duplicated)
├─ fetch() direct call
└─ localStorage access

LogoUploadButton.tsx
├─ getAuthToken() (duplicated)
├─ fetch() direct call
└─ localStorage access

usePhotoUpload.ts
├─ getAuthToken() (duplicated)
├─ fetch() direct call
└─ localStorage access

PROBLEM: No central dependency, logic scattered everywhere
```

---

## File Dependencies After Fix

```
auth.ts
├─ getAuthToken() (centralized)
└─ localStorage access (ONE PLACE)
    │
    ├─ export function getAuthToken()
    │
    └─ used by ↓

package-photo-api.ts
├─ import { getAuthToken }
└─ fetch() direct call

ImageUploadField.tsx
├─ import { getAuthToken }
└─ fetch() direct call

LogoUploadButton.tsx
├─ import { getAuthToken }
└─ fetch() direct call

usePhotoUpload.ts
├─ import { getAuthToken }
└─ fetch() direct call

BENEFIT: Central dependency, single source of truth
```

---

## Testing Coverage Visualization

```
                    getAuthToken()
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐   ┌────────────┐   ┌────────────┐
    │ Unit Tests │   │ Integration│   │ E2E Tests  │
    │ (Vitest)   │   │ Tests      │   │ (Playwright)
    └────────────┘   └────────────┘   └────────────┘
           │               │               │
           ▼               ▼               ▼
    ┌─────────────────────────────────────────────┐
    │ Token selection scenarios:                  │
    │                                             │
    │ ✓ Not authenticated (null token)            │
    │ ✓ Normal tenant op (tenantToken)            │
    │ ✓ Impersonation (adminToken)                │
    │ ✓ Impersonation fallback (no adminToken)    │
    │ ✓ Token preference with both exist          │
    │ ✓ Token rotation flow                       │
    │ ✓ Empty/falsy values                        │
    │                                             │
    │ Full coverage: 100%                         │
    └─────────────────────────────────────────────┘
```

---

## Implementation Timeline

```
Day 1: Planning & Review
├─ Read prevention strategy docs
├─ Review current code
└─ Plan implementation

Day 2: Implementation (3 hours)
├─ Add getAuthToken() to auth.ts (15 min)
├─ Create fetch-client.ts wrapper (30 min)
├─ Update package-photo-api.ts (15 min)
├─ Update ImageUploadField.tsx (15 min)
├─ Update LogoUploadButton.tsx (15 min)
├─ Update usePhotoUpload.ts (15 min)
└─ Verify compilation (15 min)

Day 3: Testing (2 hours)
├─ Write unit tests (30 min)
├─ Run E2E tests (30 min)
├─ Manual testing (45 min)
└─ Fix any issues (15 min)

Day 4: Review & Deploy (1.5 hours)
├─ Code review (30 min)
├─ Merge to main (15 min)
└─ Monitor logs (45 min)

TOTAL: ~2-3 days, 1 developer
```

---

## Risk Assessment

```
RISK LEVEL: LOW (Internal refactoring, maintains behavior)

├─ Backwards Compatible? YES
│  ✓ Same behavior, cleaner code
│  ✓ No API changes
│  ✓ Can rollback easily
│
├─ Testing Coverage? EXCELLENT
│  ✓ Unit tests for token logic
│  ✓ E2E tests for impersonation
│  ✓ Integration tests
│  ✓ Manual testing
│
├─ Performance Impact? NONE
│  ✓ No additional API calls
│  ✓ Same localStorage access
│  ✓ Slightly better (no duplication)
│
└─ Deployment Complexity? LOW
   ✓ Feature flag not needed
   ✓ No rollout strategy needed
   ✓ Can deploy immediately
```

---

## Success Metrics

```
Before Fix:
├─ 5 duplicate getAuthToken() implementations
├─ Impersonation failures during development
├─ Maintenance burden (update 5 places for 1 fix)
└─ Risk of divergent implementations

After Fix:
├─ 0 duplicate getAuthToken() implementations (100% reduction)
├─ No impersonation failures
├─ Low maintenance burden (update 1 place for any fix)
├─ Consistent behavior guaranteed
├─ 100% test coverage of token selection
└─ Clear audit trail (single code path)
```

---

## Three-Strategy Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Strategy 1: Consolidate (IMMEDIATE)                         │
├─────────────────────────────────────────────────────────────┤
│ Timeline: 3 hours                                            │
│ Effort: Low                                                  │
│ Risk: Very Low                                               │
│ Benefit: Fixes the core issue                                │
│                                                               │
│ How: Move getAuthToken() to auth.ts                          │
│      Import in all 5 files                                   │
│      Remove duplicates                                       │
│                                                               │
│ Result: ✓ Solves the problem                                │
│         ✓ Easier to audit                                   │
│         ✓ Easier to maintain                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Strategy 2: Fetch Wrapper (RECOMMENDED)                     │
├─────────────────────────────────────────────────────────────┤
│ Timeline: 1 day                                              │
│ Effort: Medium                                               │
│ Risk: Low                                                    │
│ Benefit: Type safety, centralized auth injection             │
│                                                               │
│ How: Create authenticatedFetch() wrapper                     │
│      Auto-injects Authorization header                       │
│      Use instead of raw fetch()                              │
│                                                               │
│ Result: ✓ Even more centralized                             │
│         ✓ Type-safe responses                               │
│         ✓ Easier to test                                    │
│         ✓ Easier to add features (logging, retry, etc)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Strategy 3: Migrate to ts-rest (LONG-TERM)                 │
├─────────────────────────────────────────────────────────────┤
│ Timeline: 2-3 weeks                                          │
│ Effort: High                                                │
│ Risk: Medium (breaking changes to contract)                 │
│ Benefit: Full type safety, automatic auth handling          │
│                                                               │
│ How: Define missing endpoints in contracts                  │
│      Use ts-rest client for all auth requests               │
│      Remove fetch wrapper (not needed)                      │
│                                                               │
│ Result: ✓ Zero direct fetch calls                           │
│         ✓ Full type safety                                  │
│         ✓ Single source of auth (api.ts)                    │
│         ✓ Best long-term solution                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Decision Guide

```
"Which strategy should we use?"

START HERE:
│
├─ Do we have time to migrate to ts-rest?
│  ├─ YES (2-3 weeks): Use Strategy 3 (ts-rest)
│  └─ NO (need quick fix): Continue...
│
└─ Do we want type-safe fetch?
   ├─ YES: Use Strategy 2 (Fetch Wrapper) + later Strategy 3
   └─ NO (just consolidate): Use Strategy 1 (Consolidate)


RECOMMENDATION: Start with Strategy 1 + 2 now
                Plan Strategy 3 for next sprint
```

---

## Status: Ready to Implement

```
┌────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION READY                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│ ✓ Issue clearly documented                                │
│ ✓ Root cause identified                                   │
│ ✓ Three strategies outlined                               │
│ ✓ Code examples provided                                  │
│ ✓ Test cases written                                      │
│ ✓ Implementation steps defined                            │
│ ✓ Verification checklist ready                            │
│ ✓ Rollback plan available                                 │
│                                                             │
│ Ready to assign to developer                              │
│                                                             │
│ Estimated effort: 5-6 hours (1 developer)                │
│ Estimated impact: High (fixes impersonation)             │
│ Estimated risk: Low (backwards compatible)               │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Related Documents

- `CLIENT_AUTH_BYPASS_PREVENTION.md` - Full strategy
- `CLIENT_AUTH_QUICK_REFERENCE.md` - Developer cheat sheet
- `CLIENT_AUTH_IMPLEMENTATION.md` - Step-by-step guide
- `CLIENT_AUTH_TESTING.md` - Test examples
- `CLIENT_AUTH_INDEX.md` - Document index
