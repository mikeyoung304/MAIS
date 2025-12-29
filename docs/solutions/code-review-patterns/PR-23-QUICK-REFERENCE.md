---
module: MAIS
date: 2025-12-28
problem_type: prevention_strategy
component: multiple
severity: P1/P2/P3
related_commit: e2d6545
tags: [code-review, prevention, checklist, quick-reference]
---

# PR #23 Prevention Strategies - Quick Reference Index

**Commit:** e2d6545 (fix(chat): address P1/P2 code review findings from PR #23)

This index lists all prevention strategy documents for issues found in the PR #23 code review.

---

## The 6 Issues & Fixes

### Issue 1: Circular Dependencies in Module Exports

**Severity:** P1 | **Impact:** Build failures, hard to debug

**Problem:** Executor imports routes, routes import executor = circular

**Solution:** Extract registry module (types + Map)

**Document:** [CIRCULAR-DEPENDENCY-DETECTION.md](CIRCULAR-DEPENDENCY-DETECTION.md)

**Quick Fix:**

```bash
# Create registry module with NO other imports
server/src/agent/customer/executor-registry.ts
# Both executor and routes import from registry, not each other
```

---

### Issue 2: Express Type Safety for Middleware Properties

**Severity:** P2 | **Impact:** Type errors, unsafe access patterns

**Problem:** `req.tenantId` not known to TypeScript = type errors

**Solution:** Augment Express types in declaration file

**Document:** [EXPRESS-MIDDLEWARE-TYPES.md](EXPRESS-MIDDLEWARE-TYPES.md)

**Quick Fix:**

```typescript
// server/src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}
```

---

### Issue 3: React Key Anti-patterns

**Severity:** P2 | **Impact:** Lost component state, performance issues

**Problem:** Array index as key = state loss when list reorders

**Solution:** Use stable UUID or database ID

**Document:** [REACT-KEYS-STABLE-IDENTIFIERS.md](REACT-KEYS-STABLE-IDENTIFIERS.md)

**Quick Fix:**

```typescript
{messages.map((msg) => (
  <MessageBubble key={msg.id} message={msg} />  // Use id, not index
))}
```

---

### Issue 4: Missing Composite Database Indexes

**Severity:** P2 | **Impact:** Slow queries (350ms → 2ms is possible)

**Problem:** Multiple WHERE conditions without index

**Solution:** Create composite index in migration

**Document:** [DATABASE-COMPOSITE-INDEXES.md](DATABASE-COMPOSITE-INDEXES.md)

**Quick Fix:**

```sql
CREATE INDEX "AgentSession_tenantId_sessionType_updatedAt_idx"
ON "AgentSession"("tenantId", "sessionType", "updatedAt" DESC);
```

---

### Issue 5: Ownership Verification in Multi-Step Operations

**Severity:** P1 | **Impact:** Security vulnerability (cross-tenant booking)

**Problem:** Verify at route level only, executor trusts route

**Solution:** Verify at BOTH route and executor levels

**Document:** [MULTI-STEP-OWNERSHIP-VERIFICATION.md](MULTI-STEP-OWNERSHIP-VERIFICATION.md)

**Quick Fix:**

```typescript
// Route: Verify ownership before passing to executor
const proposal = await prisma.agentProposal.findFirst({
  where: { id, tenantId, sessionId },
});

// Executor: Re-verify customer belongs to tenant
const customer = await tx.customer.findFirst({
  where: { id: customerId, tenantId },
});
```

---

### Issue 6: Unused Code Accumulation

**Severity:** P3 | **Impact:** Maintenance burden, confusion, bundle size

**Problem:** Unused imports, variables, functions accumulate

**Solution:** Enable TypeScript strict + ESLint rules

**Document:** [UNUSED-CODE-CLEANUP.md](UNUSED-CODE-CLEANUP.md)

**Quick Fix:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

## One-Page Prevention Checklist

Use this before submitting any PR:

### Architecture

- [ ] No circular dependencies? (`npm ls`, `npx madge --circular`)
- [ ] New middleware properties in `express.d.ts`?
- [ ] New executor doesn't import routes?

### Type Safety

- [ ] TypeScript strict mode passes? (`npm run typecheck`)
- [ ] No `req.xyz` without type augmentation?
- [ ] No unsafe member access?

### React/Frontend

- [ ] No array indices as `.map()` keys?
- [ ] Using UUID or database ID for keys?
- [ ] ESLint `react/no-array-index-key` enabled?

### Database

- [ ] 2+ WHERE conditions? Composite index created?
- [ ] Multi-tenant queries filter by `tenantId` first?
- [ ] Migration file included?
- [ ] Test with `EXPLAIN ANALYZE` if possible?

### Security

- [ ] Multi-step operations verify at route AND executor?
- [ ] Route includes tenantId in WHERE?
- [ ] Executor re-verifies ownership?
- [ ] Transactions + advisory lock for critical ops?

### Code Quality

- [ ] No unused imports?
- [ ] No unused variables?
- [ ] No dead code?
- [ ] ESLint passes? (`npm run lint -- --max-warnings 0`)

---

## By Component

### server/src/types/

- **express.d.ts** - Express type augmentation (Issue #2)

### server/src/agent/customer/

- **executor-registry.ts** - Circular dependency fix (Issue #1)
- **customer-booking-executor.ts** - Ownership re-verification (Issue #5)

### server/prisma/

- **migrations/** - Composite indexes (Issue #4)

### apps/web/src/components/chat/

- **CustomerChatWidget.tsx** - Stable message IDs, unused prop removal (Issues #3, #6)

### Root Config

- **tsconfig.json** - Strict mode for unused detection (Issue #6)
- **.eslintrc.js** - Rules for circular deps, unused code (Issues #1, #6)

---

## Time Estimates

### For Your Next PR

- Apply all checks: **5 minutes** (if already configured)
- Fix circular dependency: **15 minutes**
- Add type augmentation: **5 minutes**
- Fix React keys: **10 minutes**
- Add composite indexes: **20 minutes**
- Verify ownership: **30 minutes**
- Cleanup unused code: **15 minutes**

**Total:** ~1.5 hours for new feature with all patterns

### For Existing Code

- Configure strict mode: **10 minutes**
- Fix all unused code: **1-2 hours**
- Add missing indexes: **30 minutes**
- Type augmentation: **15 minutes**

**Total:** ~3-4 hours to clean up existing codebase

---

## When to Use Each Document

| Scenario                                  | Document                             |
| ----------------------------------------- | ------------------------------------ |
| Adding new executor/registry              | CIRCULAR-DEPENDENCY-DETECTION.md     |
| Adding middleware that sets properties    | EXPRESS-MIDDLEWARE-TYPES.md          |
| Rendering lists in React                  | REACT-KEYS-STABLE-IDENTIFIERS.md     |
| Adding query with 2+ WHERE conditions     | DATABASE-COMPOSITE-INDEXES.md        |
| Implementing proposal → confirm → execute | MULTI-STEP-OWNERSHIP-VERIFICATION.md |
| Cleaning up code, configuring linters     | UNUSED-CODE-CLEANUP.md               |
| Review someone's PR                       | Use checklist below ↓                |

---

## Code Review Process

When reviewing a PR:

### Step 1: Scan for Known Patterns (2 min)

```bash
# Check for circular deps
git diff --name-only | grep agent | while read f; do
  grep "from '" "$f" | grep -E "routes|orchestrator" && echo "⚠️  $f imports from routes/orchestrator"
done

# Check for array index keys
git diff | grep -E "key=\{.*index\}" && echo "❌ Array index key found"

# Check for missing indexes
git diff -- "*.ts" | grep -B3 "where:" | grep -E "[a-z]+.*AND.*[a-z]+" && echo "⚠️  Multi-column WHERE, check index"
```

### Step 2: Check TypeScript & ESLint (1 min)

```bash
npm run typecheck
npm run lint -- --max-warnings 0
```

### Step 3: Verify Database Changes (2 min)

If schema changes:

```bash
# Check for new indexes
git diff -- "*.prisma" "migrations/" | grep -i "index"
# Verify composite index on multi-column queries
```

### Step 4: Review Security (3 min)

For routes calling executors:

- [ ] Route verifies tenantId in WHERE?
- [ ] Executor re-verifies tenantId?
- [ ] Transaction + lock if preventing race?

### Step 5: Request Changes if Needed

Use comment template:

```
Requesting changes: [Issue type from list above]

Please refer to: docs/solutions/code-review-patterns/[DOCUMENT].md

Specific issue:
- [What to fix]

Expected pattern:
- [Reference code snippet from doc]
```

---

## Debugging Guide

### "Circular dependency detected"

→ See: CIRCULAR-DEPENDENCY-DETECTION.md

Steps:

1. Identify files that import each other
2. Create registry module with only types
3. Both import from registry, not each other

### "Property does not exist on type 'Request'"

→ See: EXPRESS-MIDDLEWARE-TYPES.md

Steps:

1. Add property to `express.d.ts` with `declare global`
2. Verify `typeRoots` includes `./src/types` in tsconfig.json
3. Run `npm run typecheck`

### "Component state lost on list reorder"

→ See: REACT-KEYS-STABLE-IDENTIFIERS.md

Steps:

1. Add `id: string` field to data interface
2. Change `.map((item, i) => ...)` to `.map((item) => ...)`
3. Use `key={item.id}` instead of `key={i}`

### "Query is slow (>100ms)"

→ See: DATABASE-COMPOSITE-INDEXES.md

Steps:

1. Check number of WHERE columns
2. If 2+, create composite index
3. Test: `EXPLAIN ANALYZE SELECT ... WHERE ...`

### "Attacker can access other tenant's data"

→ See: MULTI-STEP-OWNERSHIP-VERIFICATION.md

Steps:

1. Add tenantId filter to route's WHERE clause
2. Add re-verification in executor
3. Use transaction + advisory lock

### "Lots of unused code warnings"

→ See: UNUSED-CODE-CLEANUP.md

Steps:

1. Verify `noUnusedLocals: true` in tsconfig.json
2. Run `npm run lint -- --fix`
3. Manually review and remove unused items

---

## CI/CD Integration

Add to GitHub Actions:

```yaml
# .github/workflows/pr.yml
name: Code Quality

on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint -- --max-warnings 0

      - name: Circular deps
        run: npx madge --extensions ts --circular server/src

      - name: Build
        run: npm run build
```

---

## Resources

### Official Documentation

- TypeScript strict mode: https://www.typescriptlang.org/tsconfig#strict
- ESLint rules: https://eslint.org/docs/rules/
- React keys: https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key
- PostgreSQL indexes: https://www.postgresql.org/docs/current/indexes.html

### MAIS-Specific

- CLAUDE.md (project guidelines)
- docs/solutions/ (other prevention strategies)
- ARCHITECTURE.md (system design)

---

## Questions?

Each document has sections for:

- **The Problem** - What went wrong
- **The Solution** - How to fix
- **Detection** - How to catch early
- **Testing** - How to verify
- **Checklist** - What to check in review

Start with the relevant document for your issue.

---

**Status:** Complete
**Last Updated:** 2025-12-28
**Related Commit:** e2d6545
**Author Notes:** All patterns tested in PR #23, ready for team use
