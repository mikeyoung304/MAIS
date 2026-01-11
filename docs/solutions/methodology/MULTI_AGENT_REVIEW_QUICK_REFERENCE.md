---
title: Multi-Agent Code Review - Quick Reference
category: methodology
tags: [multi-agent-review, quick-reference, cheat-sheet]
date_created: 2026-01-10
status: active
---

# Multi-Agent Code Review - Quick Reference

**Print this. Laminate it. Keep it at your desk.**

---

## The One-Liner

```bash
/workflows:review <commit|PR|branch|latest>
```

Triggers 6 specialized agents in parallel. Gets findings in 3-8 minutes.

---

## The 6 Agents

| Agent                | Focus               | Key Heuristic                       |
| -------------------- | ------------------- | ----------------------------------- |
| **TypeScript/React** | Type safety, hooks  | "All `as Type` needs runtime guard" |
| **Security**         | Auth, XSS, inject   | "All inputs are hostile"            |
| **Architecture**     | DI, layers, deps    | "Routes never call Prisma directly" |
| **Performance**      | N+1, cache, index   | "Every loop queries DB (fix it)"    |
| **Simplicity**       | DRY, dead code      | ">70% similar = extract"            |
| **Data Integrity**   | TOCTOU, constraints | "Check-then-act needs transaction"  |

---

## Agent Selection Matrix

```
Auth routes      → Security, TypeScript, Architecture
DB changes       → Data Integrity, Performance, TypeScript
Booking logic    → Data Integrity, Performance, Security
Payment code     → Security, Data Integrity, TypeScript
UI components    → TypeScript, Simplicity, Performance
Agent tools      → Data Integrity, TypeScript, Security
Webhooks         → Security, Data Integrity, TypeScript
```

---

## Priority Classification

| P1 - BLOCKS MERGE | P2 - Fix This Sprint | P3 - Backlog       |
| ----------------- | -------------------- | ------------------ |
| Security vulns    | Performance issues   | Code quality       |
| Data corruption   | UX gaps              | Minor optimization |
| Auth bypass       | Architecture debt    | Cleanup            |

**Decision Tree:**

```
Security vuln? → P1
Data corruption? → P1
Blocks core feature? → P2
Affects UX? → P2
Everything else → P3
```

---

## Running the Review

```bash
# 1. Invoke
/workflows:review latest

# 2. Wait 3-8 minutes

# 3. Review findings
ls todos/*-pending-*.md

# 4. Triage
/triage

# 5. Fix
/resolve_todo_parallel

# 6. Verify
npm run typecheck && npm test && npm run build
```

---

## Key Patterns

### TOCTOU Prevention (Most Common P1)

```typescript
// BAD: Race condition
const count = await repo.count();
if (count < limit) {
  await repo.create(); // Gap here!
}

// GOOD: Atomic with lock
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
  const count = await tx.count();
  if (count >= limit) throw new Error('Limit exceeded');
  await tx.create();
});
```

### Type Safety (Common P2)

```typescript
// BAD: Unsafe cast
const config = JSON.parse(data) as Config;

// GOOD: Validate first
const config = ConfigSchema.parse(JSON.parse(data));
```

### DRY Violation (Common P3)

```typescript
// BAD: Duplicated components
function DatePicker() { ... }
function TimePicker() { ... }  // 80% same code

// GOOD: Extract with variant
function Picker({ type }: { type: 'date' | 'time' }) { ... }
```

---

## Pre-Commit Checks (3 min)

```bash
npx madge --circular --extensions ts server/src  # No circular deps
npm run typecheck                                  # TypeScript clean
npm test -- --run                                  # Tests pass
npm run lint                                       # Lint clean
```

---

## Common Anti-Patterns

| Symptom                 | Problem            | Fix                  |
| ----------------------- | ------------------ | -------------------- |
| Same file conflicts     | Parallel overlap   | Run sequentially     |
| TODO for existing code  | Stale TODO         | Search before create |
| Agent timeout           | Task too complex   | Split into subtasks  |
| TypeScript fails after  | Breaking changes   | Review agent output  |
| Results never collected | Missing TaskOutput | Always await results |

---

## Tenant Isolation Check

For each query:

```
1. Filters by tenantId? → YES or add it
2. Foreign keys verified? → YES or add verifyOwnership()
3. Errors generic? → YES or use ErrorMessages
```

---

## Before You Merge

```markdown
- [ ] Multi-agent review run
- [ ] All P1 findings fixed
- [ ] npm run typecheck passes
- [ ] npm test passes
- [ ] npm run build passes
- [ ] Manual smoke test done
- [ ] TODO files updated (status: complete)
```

---

## When to Use Multi-Agent Review

**ALWAYS:**

- 500+ lines changed
- Security-sensitive code
- Multi-tenant code
- Database schema changes
- Before production deploy

**SKIP:**

- Doc updates
- Single-file typos
- Config-only changes

---

## Escalation

| Problem             | Action                             |
| ------------------- | ---------------------------------- |
| Unclear finding     | Ask in Slack                       |
| Finding seems wrong | Verify with git blame              |
| Agent timeout       | Break into smaller pieces          |
| Too many P1s        | Prioritize ruthlessly, block merge |

---

## Quick Commands

```bash
# Check everything
npm run build && npm test && npm run typecheck && npm run lint

# Find N+1 queries
rg "findMany.*include" server/src

# Find tenant issues
rg "where.*[^tenantId]" server/src | grep -v "//"

# Find leaky errors
rg "throw new.*Error\(\`" server/src
```

---

**Full Guide:** `docs/solutions/methodology/MULTI_AGENT_REVIEW_GUIDE.md`
