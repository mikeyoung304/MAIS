# Impersonation Navigation Solutions - Complete Documentation Package

**Status:** ✅ Complete
**Total Lines:** 3,200+ lines of comprehensive guidance
**Last Updated:** 2026-01-06
**Reference Commit:** `2b995961` - "use unstable_update for impersonation session management"

---

## What's Included

This comprehensive documentation package provides prevention strategies for impersonation navigation in Next.js. It covers hydration safety, session management, navigation patterns, and service worker caching.

### 5 Documents Included

#### 1. **IMPERSONATION_QUICK_REFERENCE.md** ⭐ START HERE (5 min read)

- One-minute decision tree
- DO/DON'T patterns for 4 critical scenarios
- 5-point checklist before pushing code
- 3-item debugging guide
- Print & pin card

**Use when:** You need quick answers or a memory jogger

#### 2. **IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md** (20 min read)

- Complete problem statement
- 6-part prevention framework:
  1. Hydration mismatch prevention
  2. Navigation pattern selection (window.location.href vs router.push)
  3. Server action pattern (unstable_update vs signIn)
  4. Date formatting (ISO format safety)
  5. Service worker cache debugging
  6. isHydrated pattern implementation
- 90+ code examples
- Prevention checklist
- Troubleshooting guide with 5 common issues

**Use when:** You need complete understanding with detailed explanations

#### 3. **IMPERSONATION_CODE_PATTERNS.md** (15 min read)

- 8 copy-paste ready code patterns:
  1. useHydrated hook (reusable)
  2. Hydration-safe date formatting utilities
  3. Complete impersonateTenant server action (with error handling)
  4. TenantsList client component
  5. ImpersonationBanner component (hydration-safe)
  6. stopImpersonation server action
  7. TypeScript interfaces
  8. Test suite template
- Full implementation examples
- Ready to copy into your codebase

**Use when:** You're implementing impersonation or adapting patterns

#### 4. **IMPERSONATION_CODE_REVIEW_CHECKLIST.md** (10 min read)

- 8-item quick review (5 minutes)
- 60-item full code review checklist covering:
  - Server action validation
  - Client component hydration
  - Error handling & logging
  - Date formatting
  - Type safety
  - Testing requirements
  - Related files & context
- 10 red flag items (auto-reject criteria)
- Approval criteria
- Comment templates for common issues

**Use when:** Reviewing PRs with impersonation changes

#### 5. **IMPERSONATION_SOLUTIONS_INDEX.md** (Navigation guide)

- Master index and navigation guide
- Use-case based navigation paths
- File organization reference
- Quick navigation by scenario
- Implementation checklist (30+ items)
- Common mistakes table
- Related prevention patterns

**Use when:** You want to find the right document for your scenario

---

## How to Use This Package

### For Individual Contributors

**Starting a new impersonation feature:**

1. Read **IMPERSONATION_QUICK_REFERENCE.md** (2 min)
2. Copy relevant patterns from **IMPERSONATION_CODE_PATTERNS.md**
3. Refer to **IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md** for explanations
4. Use **IMPERSONATION_QUICK_REFERENCE.md** checklist before pushing

**Debugging impersonation issues:**

1. Check **IMPERSONATION_QUICK_REFERENCE.md** debugging section
2. Read relevant part of **IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md**
3. Check **IMPERSONATION_SOLUTIONS_INDEX.md** for related patterns

**Learning the system:**

1. Read **IMPERSONATION_QUICK_REFERENCE.md**
2. Read **IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md**
3. Browse **IMPERSONATION_CODE_PATTERNS.md**
4. Reference **IMPERSONATION_CODE_REVIEW_CHECKLIST.md** for details

### For Code Reviewers

1. Bookmark **IMPERSONATION_CODE_REVIEW_CHECKLIST.md**
2. Use 8-item quick review for routine PRs
3. Use full checklist for detailed reviews
4. Use comment templates for feedback
5. Reference red flags for auto-reject criteria

### For Tech Leads

1. Share **IMPERSONATION_QUICK_REFERENCE.md** with team
2. Reference **IMPERSONATION_SOLUTIONS_INDEX.md** for onboarding
3. Use **IMPERSONATION_CODE_REVIEW_CHECKLIST.md** to train reviewers
4. Reference **IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md** in design reviews

### For Project Managers

1. **IMPERSONATION_QUICK_REFERENCE.md** shows complexity (don't underestimate)
2. Testing requirements in checklist show QA effort needed
3. Multiple files updated (server action, components, utils) = scope planning

---

## Key Insights

### 1. Hydration Mismatch is the #1 Bug

**Problem:** Server renders HTML with no session, client renders with session
**Solution:** Return `null` during SSR and hydration, check `isHydrated` before rendering

```typescript
if (!isHydrated) return null;
// Safe to use session data now
```

### 2. Navigation Method Matters

| Method                 | Use Case              | For Impersonation |
| ---------------------- | --------------------- | ----------------- |
| `window.location.href` | Session changes       | ✅ YES            |
| `router.push()`        | Navigation within app | ❌ NO             |
| `startTransition()`    | Optimistic updates    | ❌ NO             |

Impersonation changes the session, requires full page reload.

### 3. unstable_update() Not signIn()

```typescript
// ❌ Fails in Server Action
await signIn('credentials', { email, password });

// ✅ Works reliably
await unstable_update({ user: { ... } });
```

Server Actions have cookie handling conflicts; `unstable_update()` is more reliable.

### 4. Server + Client Must Stay in Sync

```
Server Action:
├─ Update backend token cookie (mais_backend_token)
├─ Update JWT session (unstable_update)
├─ Invalidate RSC cache (revalidatePath)
└─ Return redirect URL

Client:
├─ Check result.success
├─ Use window.location.href to navigate
└─ Full page reload synchronizes everything
```

### 5. Service Worker Cache Can Hide Bugs

Hard reload (Cmd+Shift+R) or unregister service workers if:

- Page loads old code after deployment
- Changes aren't showing up
- Session state is wrong

---

## The 5-Minute Checklist (Before Pushing Code)

```
✅ Hydration      - Components use isHydrated pattern
✅ Navigation     - Using window.location.href (not router.push)
✅ Server Action  - Using unstable_update (not signIn)
✅ Cache          - Calling revalidatePath('/', 'layout')
✅ Error Handling - Try/catch with cookie rollback
```

If all 5 pass, code is likely safe.

---

## Common Scenarios

### Scenario 1: "Hydration mismatch error"

→ Read: [Prevention Strategies Part 1](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-1-hydration-mismatch-prevention)
→ Apply: Add `isHydrated` check from [Code Patterns Pattern 1](./IMPERSONATION_CODE_PATTERNS.md#pattern-1-the-ishydrated-hook)

### Scenario 2: "User sees stale data after impersonation"

→ Read: [Prevention Strategies Part 5](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-5-service-worker-debugging---cache-staleness)
→ Action: Hard reload (Cmd+Shift+R) or clear service workers
→ Verify: `window.location.href` is used (not `router.push()`)

### Scenario 3: "Cannot impersonate while already impersonating"

→ Design: User must exit current impersonation first
→ UX: Show ImpersonationBanner with exit button
→ Reference: [Code Patterns Pattern 5](./IMPERSONATION_CODE_PATTERNS.md#pattern-5-hydration-safe-impersonation-banner)

### Scenario 4: "401 errors after impersonation"

→ Cause: Session desync - JWT doesn't match backend token
→ Read: [Prevention Strategies Part 3](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-3-server-action-pattern-for-session-updates)
→ Fix: Verify `unstable_update()` error handling with rollback

### Scenario 5: "Date shows different value on server vs client"

→ Problem: `toLocaleDateString()` uses different timezone
→ Read: [Prevention Strategies Part 4](./IMPERSONATION_NAVIGATION_PREVENTION_STRATEGIES.md#part-4-date-formatting---hydration-safety)
→ Fix: Use `formatDate()` with ISO format from [Code Patterns Pattern 2](./IMPERSONATION_CODE_PATTERNS.md#pattern-2-hydration-safe-date-formatting)

---

## File References in Codebase

These files were updated in commit `2b995961`:

- ✅ `apps/web/src/app/(protected)/admin/tenants/TenantsList.tsx` - Impersonate button with hydration safety
- ✅ `apps/web/src/app/(protected)/admin/tenants/actions.ts` - impersonateTenant & stopImpersonation server actions
- ✅ `apps/web/src/components/layouts/ImpersonationBanner.tsx` - Hydration-safe banner with exit button
- ✅ `apps/web/src/lib/auth.ts` - JWT callback with trigger='update'
- ✅ `apps/web/src/lib/auth-client.ts` - useAuth hook with impersonation data
- 📝 `apps/web/src/hooks/useHydrated.ts` - (should create if not exists)
- 📝 `apps/web/src/lib/date-utils.ts` - (should create if not exists)

---

## Quick Stats

| Metric                      | Value             |
| --------------------------- | ----------------- |
| Total documentation lines   | 3,200+            |
| Number of documents         | 5 main + 1 README |
| Code examples               | 90+               |
| Pattern templates           | 8                 |
| Code review checklist items | 60                |
| Prevention strategies       | 6 comprehensive   |
| Common mistakes addressed   | 10+               |
| Troubleshooting scenarios   | 5+                |
| Testing templates included  | 1 full suite      |

---

## Key Definitions

### Hydration

The process where React attaches to server-rendered HTML. If server HTML ≠ client HTML, React throws an error.

### RSC Cache (React Server Component Cache)

Cache of server component outputs. Must be invalidated when session changes.

### Service Worker Cache

Browser caching that serves offline or cached requests. Can hide deployment changes.

### unstable_update()

NextAuth function to update the JWT session cookie and callback trigger from client.

### window.location.href

Browser property that triggers full page reload (bypasses soft navigation and caches).

### Session Desync

When backend token cookie doesn't match JWT session cookie (401 errors result).

---

## Getting Help

**If you're stuck:**

1. Check the **Quick Reference** first (always updated first)
2. Search the relevant **Prevention Strategies** section
3. Look for your scenario in **Impersonation Solutions Index**
4. Review similar code in `apps/web/src/app/(protected)/admin/tenants/`
5. Use **Code Patterns** as templates
6. Check **Code Review Checklist** for validation

**For questions:**

- File an issue with label `documentation`
- Reference which document and section
- Include what you tried and what happened

**For bugs:**

- File an issue with label `impersonation`
- Include reproduction steps
- Include whether issue persists after hard reload

---

## Maintenance

These documents are maintained as part of the MAIS codebase. When updating impersonation features:

1. Update relevant code pattern in **Code Patterns**
2. Add troubleshooting scenario if new issue discovered
3. Update **Code Review Checklist** if new validation needed
4. Update this README with new stats/insights

**Last reviewed:** 2026-01-06
**Next review:** 2026-04-06 (quarterly)

---

## Related Documentation

- [Impersonation Sidebar Navigation Bug](../ui-bugs/impersonation-sidebar-navigation-bug.md)
- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)
- [NextAuth v5 Secure Cookies](../authentication-issues/nextauth-v5-secure-cookie-prefix-production-401-MAIS-20251231.md)
- [Auth Form Accessibility](./auth-form-accessibility-checklist-MAIS-20251230.md)
- [Express Route Ordering Security](../code-review-patterns/express-route-ordering-auth-fallback-security-MAIS-20260102.md)

---

## Quick Links

| Need                   | Document              | Read Time |
| ---------------------- | --------------------- | --------- |
| **Quick answer**       | Quick Reference       | 2 min     |
| **Full understanding** | Prevention Strategies | 20 min    |
| **Implementation**     | Code Patterns         | 15 min    |
| **Code review**        | Review Checklist      | 10 min    |
| **Navigation**         | Solutions Index       | 5 min     |

---

## Summary

This is a **complete, production-ready documentation package** for impersonation navigation. It provides:

- ✅ Quick reference for busy developers
- ✅ Comprehensive guidance for learning
- ✅ Copy-paste code patterns for implementation
- ✅ Detailed code review checklist for quality
- ✅ Master index for navigation
- ✅ Troubleshooting guide for debugging
- ✅ Prevention strategies to avoid future bugs
- ✅ Print-friendly quick reference card

**Start with Quick Reference, go deeper as needed.**
