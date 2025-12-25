---
title: Code Review Resolution Workflow - Quick Reference
category: methodology
tags:
  - code-review
  - workflow
  - quick-reference
  - cheat-sheet
severity: reference
date_created: 2025-12-24
---

# Code Review Resolution Workflow - Quick Reference

**Print this. Pin it on your desk.**

---

## Multi-Agent Review in 60 Seconds

```
1. Deploy 8 agents (parallel)
   ├─ Security Sentinel → Auth, multi-tenant, input validation
   ├─ Performance Oracle → N+1 queries, caching, indexes
   ├─ Architecture Strategist → Layered arch, DI, error handling
   ├─ Code Philosopher → Dead code, duplication, complexity
   ├─ Feature Completeness → Incomplete features, missing UI states
   ├─ Dependency Detective → Unused deps, bloat, security
   ├─ Data Integrity Guardian → Constraints, transactions, migrations
   └─ DevOps Harmony → Config, logging, health checks, CI/CD

2. Collect findings (20-30 issues typical)

3. Triage by priority (P1/P2/P3)

4. Create todo files in /todos directory

5. Resolve todos in parallel waves
```

---

## Triage Decision Matrix

```
Finding identified
├─ SECURITY VULNERABILITY? → P1 (fix immediately)
├─ DATA CORRUPTION RISK? → P1 (fix immediately)
├─ BROKEN FEATURE? → P1 (fix immediately)
├─ PERFORMANCE/UX ISSUE? → P2 (fix this sprint)
├─ ARCHITECTURE VIOLATION? → P2 (fix this sprint)
└─ CODE QUALITY IMPROVEMENT? → P3 (backlog)
```

**Rule: Always security first, even if P2 exists**

---

## Priority Quick Reference

| Priority | Definition | SLA | Action |
| --- | --- | --- | --- |
| **P1** | Security, data corruption, broken features | Fix before release | Resolve immediately |
| **P2** | Performance issues, UX gaps, architecture violations | Fix this sprint | Resolve when P1 done |
| **P3** | Code quality, minor improvements | Backlog | Defer to future sprint |

---

## Todo Workflow in 90 Seconds

```
pending
  ↓
(Verification agents check if already implemented)
  ├─ YES, works → complete (cite file:line, mark done)
  ├─ YES, needs fix → implement (quick win or defer)
  └─ NO → implement (quick win) or defer (large feature)
  ↓
in_progress (Agent working on it)
  ↓
complete (Tests pass, code reviewed, todo updated)
```

---

## Implementation Type Selector

```
                     Is code already
                     implemented?
                           │
                    ┌──────┴──────┐
                   YES             NO
                    │              │
                Works? ┌──────────┬────────────┐
                 │     │          │            │
                YES   NO      < 1 hour      > 4 hours
                 │     │          │            │
              VERIFY  FIX      QUICK WIN     DEFER
             (5-15m) (var)     (20-45m)    (1-2h plan)
```

---

## 3-Minute Verification Pattern

**When code is already implemented:**

```bash
# 1. Find code
rg 'function|const name' src/

# 2. Verify tests
rg 'test.*name' test/

# 3. Test it
npm test -- src/file.test.ts

# 4. Cite evidence in todo
status: complete
date_solved: 2025-12-XX
verification: 'Confirmed at server/src/routes/file.ts:168'
```

**Effort:** 10-20 min (saves 4+ hours of coding!)

---

## Quick Win Pattern

**For features < 1 hour:**

```bash
# 1. Implement
touch client/src/components/shared/ErrorAlert.tsx
# (write 20-30 lines)

# 2. Test
npm test -- client/src/components/shared/

# 3. Update todo
status: complete
date_solved: 2025-12-XX

# 4. Batch commit (not individual)
git add .
git commit -m "chore(todos): resolve 6 quick wins

- 262: File size validation
- 263: ARIA labels
- 284: Token validation
# ... etc
"
```

---

## Parallel Execution Checklist

```
Phase 1: Analyze
  [ ] grep pending todos, count by priority
  [ ] Check frontmatter "dependencies: []"
  [ ] Create dependency graph (which can run in parallel)

Phase 2: Plan Waves
  [ ] Wave 1: All independent todos (30 min)
  [ ] Wave 2: Todos that depend on Wave 1 (20 min)
  [ ] Wave 3: If needed (depends on Wave 2)

Phase 3: Spawn Agents
  [ ] Launch all Wave 1 todos in parallel
  [ ] Do NOT spawn sequentially

Phase 4: Wait & Collect
  [ ] Block until all agents complete
  [ ] Gather results

Phase 5: Update & Commit
  [ ] Mark all complete/deferred/verified
  [ ] Single batch commit (not 10 commits)
```

---

## Code Examples (Copy-Paste Ready)

### Extract Shared Component

```typescript
// client/src/components/shared/ErrorAlert.tsx
import { AlertCircle } from 'lucide-react';

export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <span className="text-sm text-red-700">{message}</span>
    </div>
  );
}

// Usage
<ErrorAlert message={error} />
```

### Add React.memo

```typescript
import { memo } from 'react';

export const StatusBadge = memo(function StatusBadge({
  status,
  variant,
}: Props) {
  return <Badge variant={variant}>{status}</Badge>;
});
```

### Wrap with Transaction

```typescript
async createBookingWithPayment(tenantId: string, data: Data) {
  return await this.prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({ data });
    await tx.charge.create({ data: { bookingId: booking.id, ...paymentData } });
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'DEPOSIT_PAID' }
    });
    return booking;
  });
}
```

---

## Batch Commit Template

```bash
git commit -m "chore(todos): resolve P1/P2 todos, verify complete

Resolved (implemented):
- 262: File size validation (20 min)
- 263: ARIA labels (15 min)

Verified (already complete):
- 246: Routes exist
- 247: Hook has batching

Deferred:
- 301: EditableImage (4+ hours)

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Prevention Checklist

```
Code Review Checklist:
- [ ] All queries filter by tenantId
- [ ] Email/identifiers normalized
- [ ] No console.log (use logger)
- [ ] No any types without justification
- [ ] Backend + frontend together
- [ ] Cache keys include tenantId
- [ ] Transactions wrap read-then-write
- [ ] Error messages don't expose secrets
- [ ] Tests exist (happy path + error cases)
- [ ] No new PrismaClient() in routes
```

---

## Time Budget

| Activity | Time |
| --- | --- |
| Review & categorize todos | 15 min |
| Parallel verification agents | 30 min |
| Implement 6 quick wins | 45 min |
| Testing & QA | 15 min |
| Batch commit | 5 min |
| Update todo files | 10 min |
| **Total (8-10 todos)** | **120 min** |

---

## Agent Types Quick Reference

| Agent | Finds | Pattern |
| --- | --- | --- |
| Security Sentinel | Auth, tenant isolation, XSS | Check auth flows, tenant scoping |
| Performance Oracle | N+1 queries, caching | Profile queries, check indexes |
| Architecture Strategist | DI, layering, error handling | Review DI container, singletons |
| Code Philosopher | Dead code, duplication, complexity | Search violations, check duplication |
| Feature Completeness | Incomplete features, missing UI | Check contracts vs. implementation |
| Dependency Detective | Unused deps, bloat | Analyze package.json, check imports |
| Data Integrity Guardian | Constraints, transactions | Review schema, check transactions |
| DevOps Harmony | Config, logging, health checks | Check env setup, logging |

---

## Parallel Resolution Pattern

```
Wave 1 (Parallel, 30 min)
├─ TODO-262: File size validation
├─ TODO-263: ARIA labels
├─ TODO-284: Token validation
└─ TODO-259: Memory leak

     ↓ (all must complete)

Wave 2 (Sequential, 20 min)
└─ TODO-257: Use typed client (depends on 258)
     ↓ (after dependencies)
```

**Key:** Only spawn Wave 2 after Wave 1 ALL complete

---

## Common Patterns

| Pattern | Time | Use Case |
| --- | --- | --- |
| Verify (already implemented) | 10-20 min | Code exists, just need confirmation |
| Shared Component (duplication) | 20 min | Extract 2+ copies into shared/ |
| React.memo (performance) | 10 min | Pure component in 10+ item list |
| Transaction (data safety) | 15 min | Read-then-write operations |
| Quick Win (small feature) | 20-45 min | Feature < 1 hour, self-contained |
| Deferral (large feature) | 1-2 hours | Feature > 4 hours, plan for next sprint |

---

## Status Lifecycle

```yaml
# Before
status: pending
priority: p2

# After (verified - already done)
status: complete
date_solved: 2025-12-XX
verification: 'Confirmed at file.ts:168'

# After (deferred - save for later)
status: deferred
effort_estimate: '4-6 hours'
deferred_reason: 'Requires new component + backend'
estimated_sprint: 2025-12-12
```

---

## Decision Tree (Poster-Friendly)

```
TODO identified
│
├─ Is it already implemented?
│  ├─ YES → VERIFY (10-20 min, cite evidence)
│  └─ NO → Continue
│
├─ Can you implement in < 1 hour?
│  ├─ YES → QUICK WIN (20-45 min, batch commit)
│  └─ NO → DEFER (1-2 hours planning)
│
└─ Need resources/planning?
   ├─ YES → Document scope, deps, estimate
   └─ NO → Ready for next sprint
```

---

## File Locations

| What | Where |
| --- | --- |
| Todos | `todos/NNN-status-title.md` |
| Shared components | `client/src/components/shared/` |
| Routes | `server/src/routes/` |
| Services | `server/src/services/` |
| Tests | `server/test/` or `client/src/__tests__/` |
| Adapters | `server/src/adapters/` |

---

## When to Use Each Pattern

**Use VERIFY when:**
- Code clearly exists
- Tests pass
- Feature is complete
- Just need documentation

**Use QUICK WIN when:**
- Feature < 1 hour
- No schema changes needed
- Single file/component
- No dependencies

**Use DEFER when:**
- Feature > 4 hours
- Requires new endpoints/schema
- Multiple files across layers
- Depends on other todos

---

## Common Errors & Fixes

| Error | Fix |
| --- | --- |
| "Anonymous component in DevTools" | Use named function: `memo(function Name() {})` |
| "Memo not working" | Check parent memoizes callbacks |
| "Transaction lock timeout" | Reduce transaction scope, add timeout param |
| "Type mismatch in tx" | Use `tx.model` not `this.prisma.model` |
| "Component re-renders constantly" | Add React.memo or useCallback in parent |
| "Duplicate error messages" | Extract to ErrorAlert shared component |

---

## Testing Checklist

```bash
# Before committing:
npm test                    # All tests pass?
npm run typecheck          # TypeScript OK?
npm run lint               # Linting OK?
npm run format             # Code formatted?
npm run dev:all            # Manual smoke test (optional)
```

---

## Related Docs

- **Full Guide:** [CODE-REVIEW-RESOLUTION-WORKFLOW-PATTERNS.md](./CODE-REVIEW-RESOLUTION-WORKFLOW-PATTERNS.md)
- **Multi-Agent Review:** [methodology/multi-agent-code-review-process.md](./methodology/multi-agent-code-review-process.md)
- **Parallel Resolution:** [methodology/parallel-todo-resolution-workflow.md](./methodology/parallel-todo-resolution-workflow.md)
- **Todo Index:** [TODO-RESOLUTION-INDEX.md](./TODO-RESOLUTION-INDEX.md)

---

**Print this. Pin it. Reference during sessions.**

Last Updated: 2025-12-24
