# Client-Side Authentication Security: Complete Index

**Comprehensive prevention strategies for client-side authentication bypass during platform admin impersonation.**

---

## The Vulnerability

**Issue:** Platform admin impersonation fails because client-side code was bypassing centralized API authentication.

**Root Cause:** Code duplication - same `getAuthToken()` logic implemented in 5 different files, with inconsistent token selection during impersonation.

**Impact:**

- Impersonation requests fail with 401/403 errors
- User experience broken during platform admin impersonation
- Maintenance burden (5 copies of same logic)
- Risk of divergent implementations

---

## Quick Navigation

### For Developers (Start Here)

1. **Quick Reference** (`CLIENT_AUTH_QUICK_REFERENCE.md`)
   - Copy-paste patterns for common tasks
   - Rules and anti-patterns
   - File map for finding code
   - Print and pin to desk

2. **Implementation Guide** (`CLIENT_AUTH_IMPLEMENTATION.md`)
   - Step-by-step code changes
   - How to migrate existing code
   - Verification checklist
   - Rollback plan

3. **Testing Guide** (`CLIENT_AUTH_TESTING.md`)
   - Unit tests for token selection
   - E2E tests for impersonation flow
   - Integration test examples
   - Manual testing checklist

### For Architects/Reviewers

1. **Prevention Strategy** (`CLIENT_AUTH_BYPASS_PREVENTION.md`) - START HERE
   - Complete root cause analysis
   - Three prevention strategies
   - Best practices and patterns
   - Code review checklist
   - Implementation roadmap

2. **Architecture Details**
   - Token selection logic (centralized vs distributed)
   - Fetch wrapper pattern
   - ts-rest client integration
   - Error handling approach

---

## The Solution in 60 Seconds

### The Problem

```typescript
// ❌ getAuthToken() duplicated in 5 files
// client/src/lib/package-photo-api.ts
function getAuthToken(): string | null {
  const isImpersonating = localStorage.getItem('impersonationTenantKey');
  if (isImpersonating) {
    return localStorage.getItem('adminToken');
  }
  return localStorage.getItem('tenantToken');
}

// ❌ Same code copied to:
// client/src/components/ImageUploadField.tsx
// client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx
// client/src/features/photos/hooks/usePhotoUpload.ts
// client/src/components/... (possibly more)
```

### The Solution

```typescript
// ✅ Single source of truth in auth.ts
import { getAuthToken } from '@/lib/auth';

// Use everywhere:
const token = getAuthToken(); // Returns correct token for all scenarios
```

### Benefits

- Impersonation works correctly
- Easier to audit (one place to check)
- Easier to maintain (one place to update)
- Easier to test (single function to test)

---

## Document Overview

### CLIENT_AUTH_BYPASS_PREVENTION.md (MAIN DOCUMENT)

**The comprehensive prevention strategy document.**

Contains:

- Root cause analysis with code examples
- Three prevention strategies (consolidate, wrapper, migrate)
- Best practices and patterns
- Code review checklist (11 items)
- Testing recommendations (unit, integration, E2E)
- Implementation roadmap (4 phases)
- Files requiring updates
- Quick reference decision tree
- Security implications

**Read this if:** You're designing the fix or reviewing code

**Time to read:** 20-30 minutes

---

### CLIENT_AUTH_QUICK_REFERENCE.md (CHEAT SHEET)

**Developer quick reference guide - print and pin to desk.**

Contains:

- 5 Rules (the essentials)
- File map (where to find code)
- Code patterns (what to do)
- Checklist (before commit)
- Common mistakes (what to avoid)
- Debug guide (when things break)
- Migration checklist (if you wrote the bad code)

**Read this if:** You're writing/updating code

**Time to read:** 5 minutes (then pin it)

---

### CLIENT_AUTH_IMPLEMENTATION.md (STEP-BY-STEP)

**Exact implementation steps with code snippets.**

Contains:

- Step-by-step code changes
- Files to create/modify
- Verification commands
- Test commands
- Code review checklist
- Timeline estimate (2.5 hours)
- Troubleshooting guide
- Next steps after merge

**Read this if:** You're actually implementing the fix

**Time to implement:** 2.5-3 hours

---

### CLIENT_AUTH_TESTING.md (TEST EXAMPLES)

**Complete test suite for authentication scenarios.**

Contains:

- Unit test examples (token selection)
- Fetch wrapper tests (12 scenarios)
- E2E tests (impersonation flow)
- Integration tests (service layer)
- Test coverage goals
- Manual testing checklist
- Debug tips for failing tests

**Read this if:** You're writing tests

**Time to read:** 15 minutes

---

## Key Files Affected

| File                                                                        | Issue                                | Action                      |
| --------------------------------------------------------------------------- | ------------------------------------ | --------------------------- |
| `client/src/lib/auth.ts`                                                    | Missing centralized `getAuthToken()` | Add function                |
| `client/src/lib/fetch-client.ts`                                            | Doesn't exist                        | Create file                 |
| `client/src/lib/package-photo-api.ts`                                       | Has duplicate `getAuthToken()`       | Remove, import from auth.ts |
| `client/src/components/ImageUploadField.tsx`                                | Has duplicate `getAuthToken()`       | Remove, import from auth.ts |
| `client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx` | Has duplicate `getAuthToken()`       | Remove, import from auth.ts |
| `client/src/features/photos/hooks/usePhotoUpload.ts`                        | Has duplicate `getAuthToken()`       | Remove, import from auth.ts |

---

## Reading Path by Role

### I'm a Developer

1. Read: `CLIENT_AUTH_QUICK_REFERENCE.md` (5 min)
2. Skim: `CLIENT_AUTH_IMPLEMENTATION.md` Step 1-2 (2 min)
3. When implementing: Follow `CLIENT_AUTH_IMPLEMENTATION.md` step-by-step
4. When testing: Use `CLIENT_AUTH_TESTING.md` examples

**Total time:** 7 min reading + 2.5 hours implementation

---

### I'm a Code Reviewer

1. Read: `CLIENT_AUTH_BYPASS_PREVENTION.md` (20 min)
2. Use: Code review checklist from Prevention Strategy (5 min)
3. When reviewing: Check against the 11 checklist items

**Total time:** 25 minutes

---

### I'm a Tech Lead

1. Read: `CLIENT_AUTH_BYPASS_PREVENTION.md` (20 min)
2. Review: Implementation Roadmap section (5 min)
3. Plan: Assign phases and timeline

**Total time:** 25 minutes

---

### I'm New to the Codebase

1. Read: `CLIENT_AUTH_QUICK_REFERENCE.md` (5 min)
2. Read: `CLIENT_AUTH_BYPASS_PREVENTION.md` "Root Cause Analysis" (5 min)
3. Skim: File locations in Quick Reference
4. Bookmark: Prevention Strategy for reference

**Total time:** 10 minutes + keep it handy

---

## Key Patterns to Remember

### Pattern 1: Get Token (Centralized)

```typescript
import { getAuthToken } from '@/lib/auth';
const token = getAuthToken();
```

### Pattern 2: Make Authenticated Fetch

```typescript
import { authenticatedFetch } from '@/lib/fetch-client';
const { status, body } = await authenticatedFetch('/api/endpoint');
```

### Pattern 3: Use API Client (Preferred)

```typescript
import { api } from '@/lib/api';
const { status, body } = await api.tenantAdmin.getPackages();
```

### Pattern 4: Handle Impersonation

```typescript
// Don't check impersonation manually - getAuthToken() handles it
const token = getAuthToken(); // Works for both normal and impersonation
```

---

## Security Checklist

Before deploying, verify:

- [ ] No duplicate `getAuthToken()` functions
- [ ] All files import from centralized `@/lib/auth`
- [ ] All authenticated endpoints use wrapper or ts-rest
- [ ] Impersonation tests pass (E2E)
- [ ] Token selection tests pass (unit)
- [ ] Manual impersonation workflow verified
- [ ] No direct `localStorage.getItem('token')` in components
- [ ] Error handling for 401/403 responses

---

## Timeline

| Phase          | Duration | What                       | Status       |
| -------------- | -------- | -------------------------- | ------------ |
| Planning       | 1 day    | Read docs, design solution | (current)    |
| Implementation | 3 hours  | Code changes               | Next         |
| Testing        | 2 hours  | Unit + E2E + manual        | Next         |
| Review         | 1 hour   | Code review                | Next         |
| Deployment     | 30 min   | Merge and deploy           | Next         |
| Monitoring     | 24h      | Watch logs                 | After deploy |
| Long-term      | Ongoing  | Migrate to ts-rest         | Phase 2      |

---

## FAQ

### Q: Do I need to understand all 4 documents?

**A:** No. Read based on your role (see "Reading Path by Role" above).

### Q: What if I'm not the one implementing?

**A:** Read `CLIENT_AUTH_BYPASS_PREVENTION.md` to understand the issue, then use the checklist when reviewing PRs.

### Q: How long will this take?

**A:** ~3 hours implementation + 2 hours testing = 5 hours total for one developer.

### Q: What if something breaks?

**A:** Changes are backwards compatible. Rollback is just `git reset --hard HEAD~1`.

### Q: Why 4 documents instead of 1?

**A:** Different audiences need different information at different levels of detail:

- Developers need quick patterns (Quick Reference)
- Implementers need steps (Implementation)
- Testers need test cases (Testing)
- Architects need strategy (Prevention)

### Q: Can I use ts-rest client instead of fetch wrapper?

**A:** Yes! That's the long-term goal (Phase 3 in roadmap). For now, fetch wrapper is faster to implement.

### Q: What about token refresh?

**A:** Current solution doesn't implement refresh. That's Phase 4 (hardening). The centralized `getAuthToken()` makes it easy to add later.

### Q: How do I know if the fix worked?

**A:** Run E2E tests: `npm run test:e2e -- impersonation-auth.spec.ts`

---

## External References

- **Current Architecture:** `CLAUDE.md` (multi-tenant patterns)
- **API Contracts:** `packages/contracts/src/`
- **Server-Side Auth:** `server/src/middleware/auth.ts`
- **API Client:** `client/src/lib/api.ts`

---

## Document Maintenance

Last updated: 2025-11-29
Last reviewed: 2025-11-29
Next review: After implementation

---

## Contact / Questions

If you have questions about any document:

1. Check the specific document's FAQ or troubleshooting section
2. Review the code examples in the relevant document
3. Check related documentation in the References section
4. Consult with team lead or code reviewer

---

## Glossary

- **getAuthToken()** - Centralized function that returns the correct token (admin or tenant)
- **authenticatedFetch()** - Wrapper around fetch that auto-injects Authorization header
- **Impersonation** - Platform admin temporarily acting as a tenant
- **impersonationTenantKey** - localStorage flag indicating active impersonation
- **Token Confusion** - Bug where wrong token type is selected for current operation
- **Code Duplication** - Same logic implemented in multiple files (source of bug)
- **Centralized Auth** - Authentication logic in one place, used everywhere
- **ts-rest** - Type-safe API client library used for API calls

---

## Success Criteria

Implementation is complete when:

- [ ] All 5 duplicate `getAuthToken()` functions removed
- [ ] Centralized `getAuthToken()` added to `auth.ts`
- [ ] `authenticatedFetch()` wrapper created
- [ ] All components/hooks updated to use centralized functions
- [ ] Unit tests pass (token selection)
- [ ] E2E tests pass (impersonation flow)
- [ ] Manual testing completed
- [ ] PR reviewed and merged
- [ ] Deployed to production
- [ ] No auth-related errors in logs after 24 hours

---

## Related Decisions

- **ADR-XXX:** Client-side auth centralization (new)
- **ADR-001:** Double-booking prevention (existing)
- **ADR-002:** Webhook idempotency (existing)

See `DECISIONS.md` for more architectural decisions.
