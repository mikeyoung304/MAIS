# Impersonation Navigation Bug: Prevention Strategy Summary

**Created:** November 28, 2025
**Bug:** RoleBasedNav component showed platform admin navigation when impersonating a tenant
**Root Cause:** Components checked only `user.role`, forgetting to check impersonation state
**Solution:** Calculate and use "effective role" that accounts for impersonation

---

## Executive Summary

When a platform admin impersonates a tenant, the system must treat them as a `TENANT_ADMIN` for all UI/authorization purposes, even though their JWT still says `PLATFORM_ADMIN`. The bug occurred because developers checked only the actual role, not the impersonation state.

**The Fix (Pattern):**

```typescript
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;
// Use effectiveRole for all UI/permission decisions, never raw user.role
```

---

## Four-Layer Prevention Strategy

### 1. Code Review Checklist

**File:** `CODE_REVIEW_CHECKLIST_IMPERSONATION.md`

Before approving PRs with role-based logic, reviewers check:

- Component imports `isImpersonating` from context
- Effective role is calculated (not using raw `user.role`)
- All role checks use effective role
- Admin-only features are hidden when impersonating
- Tests include impersonation scenarios
- Impersonation banner is visible (if relevant)

**How to Use:**

- Pin this checklist to your PR template
- When reviewing role-based changes, use as verification guide
- Takes 2-3 minutes per PR

### 2. Testing Strategy

**In:** `IMPERSONATION_NAVIGATION_BUG_PREVENTION.md` (Section 2)

Required test coverage:

- **Unit tests:** Test component with both `isImpersonating: true/false`
- **Integration tests:** Test with mock auth context
- **E2E tests:** Full impersonation flow (login → impersonate → navigate → stop)

**Example test:**

```typescript
it('shows tenant nav when admin impersonating', () => {
  // Mock auth with isImpersonating: true
  // Verify tenant nav items visible
  // Verify admin nav items NOT visible
});
```

### 3. Best Practice Code Pattern

**Reference:** `IMPERSONATION_NAVIGATION_BUG_PREVENTION.md` (Section 3)

**Pattern to use everywhere:**

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isImpersonating } = useAuth();

  // Calculate effective role ONCE
  const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;

  // Use effective role for ALL decisions
  if (effectiveRole === 'PLATFORM_ADMIN') {
    return <AdminView />;
  } else {
    return <TenantView />;
  }
}
```

**Key principles:**

- Get `isImpersonating` state from context
- Calculate `effectiveRole` at component entry
- Use `effectiveRole` consistently throughout
- Hide admin controls explicitly when impersonating

### 4. Documentation

**Files:** Updated `CLAUDE.md` and `DEVELOPING.md` sections

Added to project guidelines:

- What impersonation means and why it's important
- How to calculate effective role
- Rule: Never use raw `user.role` for UI decisions
- Troubleshooting guide for impersonation issues

---

## Quick Reference Document

**File:** `IMPERSONATION_QUICK_REFERENCE.md`

One-page reference card for developers. Key sections:

- The Rule (in 2 sentences)
- The Pattern (code snippet)
- Checklist for role-based components
- Before/After examples
- Common mistakes and fixes
- Red flags in code review

**Recommendation:** Print and pin near your desk or link in Slack

---

## Comprehensive Prevention Guide

**File:** `IMPERSONATION_NAVIGATION_BUG_PREVENTION.md`

Deep-dive reference (12 pages) covering:

1. **Problem Statement**
   - What the bug was
   - Why it happened
   - What it impacted

2. **Pattern Identified**
   - Where this pattern appears
   - How developers make this mistake
   - Why it's easy to miss

3. **Prevention Strategies**
   - Code review checklist (9 items)
   - Testing strategy with examples
   - Best practice patterns with DO/DON'T
   - Documentation recommendations

4. **Real-World Examples**
   - Actual code from the fix
   - Annotated with explanations
   - Why each approach works

5. **Implementation Checklist**
   - Step-by-step to implement pattern
   - Files to update
   - Testing to add

---

## The Complete Fix Pattern

### Understanding Impersonation

**JWT Structure:**

```typescript
{
  userId: 'admin_123',
  role: 'PLATFORM_ADMIN',     // ← Actual role (admin)
  impersonating: {             // ← Present when impersonating
    tenantId: 'tenant_456',
    tenantSlug: 'acme-corp',
    tenantEmail: 'admin@acme.com',
    startedAt: '2025-11-28T...'
  }
}
```

**Effective Role Logic:**

- If `impersonating` is present → treat as `TENANT_ADMIN`
- If `impersonating` is null → treat as actual `role` (usually `PLATFORM_ADMIN`)

### Multi-Layer Defense

**Layer 1: Component Level**

```typescript
// RoleBasedNav checks impersonation and shows correct nav
const effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role;
const navItems = effectiveRole === 'PLATFORM_ADMIN' ? adminNav : tenantNav;
```

**Layer 2: Route Level**

```typescript
// ProtectedRoute prevents admin routes when impersonating
if (isImpersonating() && pathname.startsWith('/admin')) {
  return <Navigate to="/tenant/dashboard" />;
}
```

**Layer 3: Feature Level**

```typescript
// Admin controls hidden explicitly during impersonation
if (user.role === 'PLATFORM_ADMIN' && !isImpersonating()) {
  return <AdminControl />;
}
```

**Layer 4: Visual Indicator**

```typescript
// ImpersonationBanner always visible to provide context
{isImpersonating() && <ImpersonationBanner {...} />}
```

---

## Implementation Roadmap

### For Existing Code

1. Search for all `user.role ===` checks
2. Verify each one considers impersonation
3. Add effective role calculation if missing
4. Add tests for impersonation scenarios
5. Add comments explaining the impersonation handling

### For New Features

1. Always import `isImpersonating` when checking roles
2. Calculate effective role at component entry
3. Use effective role for all UI/permission decisions
4. Write tests for both impersonation states
5. Document why any skip of impersonation checks

### For Code Reviews

1. Use `CODE_REVIEW_CHECKLIST_IMPERSONATION.md`
2. Look for `user.role` without `isImpersonating()` check
3. Verify effective role is calculated
4. Check admin features are hidden when impersonating
5. Verify tests include impersonation scenarios

---

## Key Statistics

- **Files Modified:** 1 (RoleBasedNav.tsx)
- **Patterns Fixed:** 1 (role-based navigation)
- **Components at Risk:** ~5-8 (any role-based UI)
- **Tests Added:** Impersonation coverage needed
- **Prevention Documents:** 4

---

## Real Example: The Fix

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/navigation/RoleBasedNav.tsx`

**What was wrong:**

```typescript
// Only checked user.role, missed impersonation
const navItems = user.role === 'PLATFORM_ADMIN' ? platformAdminNav : tenantAdminNav;
```

**The fix:**

```typescript
// Check both role AND impersonation state
const { user, isImpersonating } = useAuth();
const isCurrentlyImpersonating = isImpersonating();
const navItems =
  user.role === 'PLATFORM_ADMIN' && !isCurrentlyImpersonating ? platformAdminNav : tenantAdminNav;
```

**Why it works:**

- Explicitly calls `isImpersonating()` method
- Short-circuits: if impersonating, skip to tenant nav
- Clear logical flow: "Show admin nav if admin AND not impersonating"

---

## Prevention in Your Team

### For Developers

1. **Read:** `IMPERSONATION_QUICK_REFERENCE.md` (5 min)
2. **Practice:** Follow pattern in Section 3 of Prevention Guide
3. **Reference:** Keep quick ref nearby
4. **Test:** Write tests for impersonation state

### For Code Reviewers

1. **Setup:** Use `CODE_REVIEW_CHECKLIST_IMPERSONATION.md`
2. **Check:** 9 checklist items for role-based code
3. **Question:** Ask author "What if this is impersonating?"
4. **Verify:** Tests include impersonation scenarios

### For Team Leads

1. **Document:** Add quick ref to onboarding materials
2. **Training:** Share pattern and why it matters
3. **Process:** Add checklist to PR template
4. **Monitor:** Watch for role checks in code reviews

---

## Success Criteria

This prevention strategy has succeeded when:

- ✅ No component uses raw `user.role` without impersonation check
- ✅ All role-based UI calculates and uses `effectiveRole`
- ✅ Tests exist for both impersonation states
- ✅ Admin features hidden when impersonating
- ✅ Routes protected against impersonation bypass
- ✅ ImpersonationBanner visible during impersonation
- ✅ Code reviewers catch impersonation oversights
- ✅ No similar bugs reported

---

## Documents in This Prevention Strategy

1. **IMPERSONATION_PREVENTION_SUMMARY.md** ← You are here
   - Executive overview
   - Quick reference to all documents
   - Implementation roadmap

2. **IMPERSONATION_QUICK_REFERENCE.md**
   - One-page developer reference
   - The Rule, The Pattern, The Checklist
   - Red flags and common mistakes

3. **CODE_REVIEW_CHECKLIST_IMPERSONATION.md**
   - 9-item code review checklist
   - Questions to ask authors
   - What to look for in each category

4. **IMPERSONATION_NAVIGATION_BUG_PREVENTION.md**
   - Comprehensive 12-page guide
   - Problem statement and analysis
   - Testing strategies with examples
   - Real code examples from the fix
   - Implementation checklist

---

## FAQ

**Q: Do I need to read all four documents?**
A: No. Start with Quick Reference (5 min). Use Checklist during reviews (2 min per PR). Reference the full guide when implementing (20 min for new code).

**Q: What if my component doesn't deal with impersonation?**
A: Check if it checks `user.role`. If yes, add impersonation handling. If no, you're fine.

**Q: Is this just for navigation?**
A: No. Navigation is the example, but the pattern applies to ANY component checking `user.role`.

**Q: How do I test impersonation?**
A: See Section 2 of the full Prevention Guide. Unit tests mock `isImpersonating: true/false`, E2E tests use full impersonation flow.

**Q: What if I need to check the ACTUAL role, not effective role?**
A: Use `user.role === 'PLATFORM_ADMIN' && !isImpersonating()` for actual role checks (like hiding admin controls).

**Q: Where do I find the fixed code?**
A: `/Users/mikeyoung/CODING/MAIS/client/src/components/navigation/RoleBasedNav.tsx`

---

## Next Steps

1. **Review Prevention Documents** (this week)
   - Read quick ref (5 min)
   - Skim comprehensive guide (20 min)

2. **Update Code Review Process** (this week)
   - Add checklist to PR template
   - Train reviewers on impersonation checks

3. **Audit Existing Code** (next sprint)
   - Search for `user.role ===` patterns
   - Add effective role calculation where needed
   - Add impersonation tests

4. **Enforce for New Code** (ongoing)
   - Reviewers use checklist on every PR
   - Block PRs missing impersonation handling
   - Build team muscle memory

---

## Summary

**The Pattern:** When checking role, always consider impersonation.

**The Rule:** Use `effectiveRole = isImpersonating() ? 'TENANT_ADMIN' : user.role`

**The Impact:** Prevents security issues and UX confusion from impersonation bypass.

**The Cost:** ~5 extra lines of code per component, 2-3 minutes per code review.

**The Benefit:** No similar bugs, consistent impersonation behavior, team clarity.

---

**Created by:** Prevention Strategist (Claude Code)
**Based on bug:** Tenant impersonation navigation bypass
**Prevention Level:** High - multi-layer defense with documentation
**Maintenance:** Low - pattern is self-documenting
