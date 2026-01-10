---
title: Multi-Agent Code Review Quick Reference
category: methodology
tags: [multi-agent-review, quick-reference, workflows]
---

# Multi-Agent Code Review - Quick Reference

**Print this. Pin it. Use before every significant merge.**

## One-Liner

```bash
/workflows:review <commit|PR|branch>
```

## The 6 Specialized Agents

| Agent                   | Catches                       | Key Heuristic                       |
| ----------------------- | ----------------------------- | ----------------------------------- |
| TypeScript/React        | Unsafe casts, hook violations | "All `as Type` needs runtime guard" |
| Security Sentinel       | XSS, injection, auth bypass   | "All inputs are hostile"            |
| Architecture Strategist | DI violations, layering       | "Routes never call Prisma directly" |
| Performance Oracle      | N+1, missing indexes          | "Every loop is O(n) database calls" |
| Code Simplicity         | Duplication, dead code        | ">70% similar = consolidate"        |
| Data Integrity          | TOCTOU, constraint gaps       | "Check-then-act needs transaction"  |

## Key Insight

**Specialized parallel review catches what generalist review misses.**

Example: Data Integrity Guardian found TOCTOU race that 5 other agents missed.

## After Review Completes

```bash
ls todos/*-pending-*.md    # See all findings
/triage                    # Prioritize and approve
/resolve_todo_parallel     # Fix approved items
```

## Severity Quick Guide

| Priority | Definition               | Action       |
| -------- | ------------------------ | ------------ |
| P1       | Security/data corruption | BLOCKS MERGE |
| P2       | Performance/architecture | Should fix   |
| P3       | Code quality/cleanup     | Nice to have |

## When to Run

- Before merging any PR with >3 files changed
- After major refactors
- Before production deploys
- Monthly on main branch (hygiene)

## TOCTOU Pattern (Most Common P1)

```typescript
// BAD: Race condition possible
const count = await repo.count(); // CHECK
if (count < limit) {
  await repo.create(); // ACT - gap allows races
}

// GOOD: Atomic transaction with lock
await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
  const count = await tx.count();
  if (count >= limit) throw new LimitExceeded();
  await tx.create(); // Atomic with check
});
```

---

**Full docs:** `docs/solutions/methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md`
