# Code Review Prevention Strategies Index

Three P0 vulnerability patterns with complete detection, testing, and code review strategies.

## Quick Links

| Pattern                 | Files                                                       | Severity | Impact                  |
| ----------------------- | ----------------------------------------------------------- | -------- | ----------------------- |
| **1. Route Ordering**   | `PREVENTION_STRATEGIES_CODE_REVIEW_PATTERNS.md` (Section 1) | P0       | Feature breaks silently |
| **2. Auth Fallbacks**   | `PREVENTION_STRATEGIES_CODE_REVIEW_PATTERNS.md` (Section 2) | P0       | Security vulnerability  |
| **3. Tenant Isolation** | `PREVENTION_STRATEGIES_CODE_REVIEW_PATTERNS.md` (Section 3) | P0       | Data leakage            |
| **Quick Checklists**    | `CODE_REVIEW_CHECKLISTS.md`                                 | P0       | Print and pin to desk   |

---

## Pattern Summary

### 1. Express Route Ordering (Static Before Parameterized)

**The Bug:** Static routes registered after parameterized routes are shadowed by Express's first-match routing.

**Example:**

```typescript
// WRONG - /me never executes
router.get('/:id', async (req, res) => { ... });
router.get('/me', async (req, res) => { ... }); // Unreachable!
```

**Impact:**

- `/users/me` returns `{ id: 'me' }` instead of current user
- Features silently break with no error
- Difficult to debug (looks like route exists)

**Detection:**

- ESLint rule: `no-static-routes-after-parameterized`
- Grep: `grep -n "router\..*/:id" file.ts && grep -n "router\./[a-z]" file.ts`
- Code review: Scan first 20 lines of routes file

**Reference Implementation:**

- See: `server/src/routes/tenant-admin-segments.routes.ts:38-146`
- Correct order: POST → GET (list) → GET /:id → PUT/:id → DELETE/:id

---

### 2. Auth Fallback Guards (No `|| 'system'` Defaults)

**The Bug:** Using fallback values for missing authentication creates silent success instead of rejection.

**Example:**

```typescript
// WRONG - Missing auth becomes 'system' user
const userId = res.locals.user?.id || 'system';
recordAudit({ actor: userId, action: 'delete' }); // logged as 'system'!
```

**Impact:**

- Missing auth returns 200 instead of 401
- Attacker undetected (attributed to 'system')
- Audit trail useless (all actions "system")
- Security vulnerability: privilege escalation enabled

**Detection:**

- Grep: `grep -rn "|| '[a-z]*'" server/src | grep -E "user|auth|admin"`
- ESLint rule: `no-auth-fallbacks`
- Code review: Check for `|| 'system'`, `|| 'unknown'`, `|| 'default'`

**Found in MAIS:**

- `server/src/routes/platform-admin-traces.routes.ts:238` ❌ VULNERABLE
- `server/src/routes/platform-admin-traces.routes.ts:287` ❌ VULNERABLE

**Reference Implementation:**

- See: `server/src/middleware/tenant.ts:243-248`
- Correct pattern: `if (!tenantId) throw new Error(...)` or return 401

---

### 3. Multi-Tenant Isolation (Always Include tenantId)

**The Bug:** Trusting pre-scoped IDs without verifying tenant ownership enables cross-tenant data access.

**Example:**

```typescript
// WRONG - No tenantId verification
const segment = await prisma.segment.findUnique({
  where: { id: segmentId }, // Could be from ANY tenant!
});
```

**Impact:**

- Any tenant can access any other tenant's data by guessing IDs
- UUID enumeration enables data theft
- Complete multi-tenant isolation failure
- Compliance violation (GDPR, SOC 2)

**Detection:**

- Grep: `grep -n "where:.*id\b" server/src | grep -v tenantId`
- ESLint rule: `no-missing-tenantid-in-where`
- Code review: Verify composite keys in where clauses

**Schema Pattern (Required):**

```prisma
@@unique([tenantId, id])     // Composite key enforces isolation
@@index([tenantId])          // Performance: fast tenant-scoped queries
```

**Reference Implementation:**

- See: `server/src/adapters/prisma/catalog.repository.ts:25-124`
- Correct pattern: `where: { tenantId, id }` for composite keys
- Correct pattern: `where: { id_tenantId: { id, tenantId } }` for findUnique

---

## How to Use These Strategies

### During Code Review

1. **Open the PR** and scan git diff for each pattern
2. **Use checklists** from `CODE_REVIEW_CHECKLISTS.md` (print and pin)
3. **Run detection commands** if pattern not obvious:

   ```bash
   # Route ordering
   grep -n "router\..*/:id\|/:slug" server/src/routes/*.ts

   # Auth fallbacks
   grep -rn "|| '[a-z]*'" server/src | grep -iE "user|auth|admin"

   # Missing tenantId
   grep -n "where:" server/src | grep -v tenantId
   ```

4. **Run tests** to verify patterns:
   - Integration tests in `server/src/routes/__tests__/`
   - E2E tests for static route shadowing
5. **Request changes** if any P0 pattern found

### During Implementation

1. **Check existing patterns** in similar routes:
   ```bash
   find server/src/routes -name "*.routes.ts" -exec grep -l "/:id" {} \;
   ```
2. **Follow correct order:** Static routes FIRST
3. **Enforce auth in middleware** (before route handler)
4. **Include tenantId in all queries** without exception
5. **Test isolation:** Cross-tenant access should fail

### During Onboarding

1. Read: `PREVENTION_STRATEGIES_CODE_REVIEW_PATTERNS.md` (30 min)
2. Print: `CODE_REVIEW_CHECKLISTS.md` (pin to desk)
3. Practice: Review 3 PRs using checklists
4. Escalate: Any P0 pattern found

---

## Test Coverage

### Route Ordering Tests

- ✅ Static routes come before parameterized
- ✅ GET /me returns current user (not id='me')
- ✅ GET /:id returns user with correct ID
- See: `server/src/routes/__tests__/route-order.test.ts`

### Auth Fallback Tests

- ✅ Missing auth returns 401 (not 200)
- ✅ Fallback values not used as user ID
- ✅ Audit logs contain real user IDs
- See: `server/src/routes/__tests__/auth-fallback.test.ts`

### Multi-Tenant Isolation Tests

- ✅ Cross-tenant queries return null
- ✅ Composite keys prevent ID collisions
- ✅ All operations include tenantId
- See: `server/src/routes/__tests__/tenant-isolation.test.ts`

---

## Enforcement Strategy

### Lint Rules

Add to `server/.eslintrc.js`:

```javascript
module.exports = {
  rules: {
    'no-static-routes-after-parameterized': 'error',
    'no-auth-fallbacks': 'error',
    'no-missing-tenantid-in-where': 'error',
  },
};
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run lint -- --rule no-static-routes-after-parameterized
npm run lint -- --rule no-auth-fallbacks
npm run lint -- --rule no-missing-tenantid-in-where
```

### CI/CD

Add to `.github/workflows/test.yml`:

```yaml
- name: Check route ordering
  run: npm run lint -- --rule no-static-routes-after-parameterized

- name: Check auth fallbacks
  run: npm run lint -- --rule no-auth-fallbacks

- name: Check tenant isolation
  run: npm run lint -- --rule no-missing-tenantid-in-where
```

---

## Common Questions

**Q: Can I use `||` for non-auth values?**
A: Yes. `theme || 'light'` is fine. Only block `||` with auth/user/tenant values.

**Q: What if middleware already sets tenantId?**
A: Still include tenantId in query. Defense-in-depth: query layer verifies even if middleware fails.

**Q: Is composite key required in schema?**
A: Yes. `@@unique([tenantId, id])` prevents ID collisions and enforces isolation at database layer.

**Q: Can I test static routes without running server?**
A: Yes. Use Vitest with mock Express router. See `server/src/routes/__tests__/route-order.test.ts`.

**Q: What's the difference between different fallback patterns?**
A: All are risky for auth:

- `userId || 'system'` (found in code)
- `userId ?? 'default'` (nullish coalescing)
- `userId ??= 'unknown'` (nullish assignment)
- Treat all the same: FLAG IT

---

## Files Created

| File                                            | Purpose                                                   | Size       |
| ----------------------------------------------- | --------------------------------------------------------- | ---------- |
| `PREVENTION_STRATEGIES_CODE_REVIEW_PATTERNS.md` | Complete guide (3 patterns, detection, tests, checklists) | ~800 lines |
| `CODE_REVIEW_CHECKLISTS.md`                     | Print-friendly visual checklists                          | ~300 lines |
| `CODE_REVIEW_PREVENTION_INDEX.md`               | This file (quick reference & links)                       | ~200 lines |

---

## Related Documents

- **[MAIS Critical Patterns Handbook](mais-critical-patterns.md)** - 10 patterns for MAIS development
- **[Multi-Tenant Implementation Guide](../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md)** - Comprehensive multi-tenant patterns
- **[Phase 5 Testing & Caching Prevention](phase-5-testing-and-caching-prevention-MAIS-20251231.md)** - Caching, testing, error handling patterns
- **[Circular Dependency Executor Registry](circular-dependency-executor-registry-MAIS-20251229.md)** - Avoiding circular imports in agents

---

## Quick Decision Tree

**When reviewing code, ask:**

1. **Are there Express routes?**
   - YES → Check route ordering (static before :id)
   - NO → Skip pattern 1

2. **Does it handle authentication?**
   - YES → Check for auth fallbacks (no || 'system')
   - NO → Skip pattern 2

3. **Does it query database?**
   - YES → Check for tenantId in where clause
   - NO → Skip pattern 3

4. **All checks pass?**
   - YES → ✅ APPROVE
   - NO → 🚫 REQUEST CHANGES (P0 issue)

---

## Contact & Escalation

**Found P0 issue in PR?**

1. Use checklist comment template (copy from `CODE_REVIEW_CHECKLISTS.md`)
2. Reference specific line numbers
3. Link to this index
4. Flag for security review if data leak suspected

**Have questions about patterns?**

- See: `PREVENTION_STRATEGIES_CODE_REVIEW_PATTERNS.md` (detailed explanations)
- See: Example implementations in code (reference files listed)
- Ask: Team during code review sync

**Want to add new pattern?**

1. Document in new section: `PREVENTION_STRATEGIES_CODE_REVIEW_PATTERNS.md`
2. Add visual checklist: `CODE_REVIEW_CHECKLISTS.md`
3. Update this index

---

## Version History

| Date       | Change                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| 2026-01-02 | Initial creation: 3 patterns (route order, auth fallbacks, tenant isolation) |

**Next Review:** 2026-02-02 (monthly)
**Last Updated:** 2026-01-02
**Severity:** P0 (Production blocker)
**Owner:** Agent Review Team
