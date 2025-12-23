---
status: resolved
priority: p1
issue_id: "257"
tags: [code-review, security, architecture, tenant-dashboard]
dependencies: []
resolved_at: "2025-12-23"
resolved_by: "previous refactoring - components now use typed API client via hooks"
---

# Duplicate Auth Logic in Dashboard Components

## Problem Statement

CalendarConfigCard.tsx and DepositSettingsCard.tsx both contain identical `getAuthHeaders()` helper functions (17 lines each) that duplicate authentication logic already present in the centralized `api` client. This violates DRY principles and creates security/maintenance risks.

**Why it matters:**
- Auth bypass risk: Duplicate auth logic can diverge from canonical implementation
- Maintenance burden: Changes to auth flow require updates in 3+ places
- Security gap: Bypasses centralized token handling, CSRF protection, and audit logging

## Findings

### Agent: security-sentinel
- **Location:** CalendarConfigCard.tsx:55-72, DepositSettingsCard.tsx:39-56
- **Evidence:** Identical 17-line `getAuthHeaders()` functions duplicated in both files
- **Impact:** CRITICAL - Security architecture violation

### Agent: architecture-strategist
- **Location:** Same files + api.ts:138-154 (centralized auth)
- **Evidence:** ts-rest API client already handles auth automatically
- **Impact:** HIGH - Violates established patterns, creates tech debt

### Agent: code-simplicity-reviewer
- **Evidence:** ~34 lines of duplicated code that can be eliminated
- **Impact:** MEDIUM - Maintenance burden

## Proposed Solutions

### Option A: Use Centralized API Client (Recommended)
**Description:** Add missing calendar/deposit contracts to @macon/contracts, then use the typed `api` client

**Pros:**
- Type-safe API calls with Zod validation
- Consistent auth handling across all components
- Follows existing RemindersCard pattern (which does this correctly)

**Cons:**
- Requires contract additions first (see todo 258)
- Larger refactor scope

**Effort:** Medium (4-6 hours)
**Risk:** Low

### Option B: Extract to Shared Utility
**Description:** Move `getAuthHeaders()` to `client/src/lib/auth.ts` and import

**Pros:**
- Quick fix, single source of truth
- Works without contract changes

**Cons:**
- Still bypasses ts-rest type safety
- Doesn't follow established patterns

**Effort:** Small (30 min)
**Risk:** Medium - perpetuates non-standard pattern

### Option C: Keep Current (NOT Recommended)
**Description:** Document the pattern and move on

**Effort:** Small
**Risk:** HIGH - Security and maintenance issues remain

## Recommended Action

**Choose Option A** - Refactor to use centralized API client. This requires first completing todo 258 (add missing contracts).

## Technical Details

### Affected Files
- `client/src/features/tenant-admin/TenantDashboard/CalendarConfigCard.tsx`
- `client/src/features/tenant-admin/TenantDashboard/DepositSettingsCard.tsx`

### Components
- CalendarConfigCard
- DepositSettingsCard

### Database Changes
None

## Acceptance Criteria

- [ ] `getAuthHeaders()` function removed from CalendarConfigCard.tsx
- [ ] `getAuthHeaders()` function removed from DepositSettingsCard.tsx
- [ ] All API calls use `api` client from `@/lib/api`
- [ ] No direct `fetch()` calls to tenant-admin endpoints
- [ ] Tests pass
- [ ] Auth works in both normal and impersonation modes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-05 | Created from code review | RemindersCard.tsx is the correct reference implementation |

## Resources

- **Reference Implementation:** `client/src/features/tenant-admin/TenantDashboard/RemindersCard.tsx:60-72`
- **Centralized API Client:** `client/src/lib/api.ts:138-154`
- **Related Todo:** 258-pending-p1-missing-api-contracts.md
