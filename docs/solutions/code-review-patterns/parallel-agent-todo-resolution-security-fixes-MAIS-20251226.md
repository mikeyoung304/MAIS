---
title: Parallel Resolution of 10 Agent Security and Data Integrity TODOs
date: 2025-12-26
author: Claude Code Agent
category: code-review-patterns
tags:
  - parallel-agents
  - todo-resolution
  - security-fixes
  - agent-tools
  - action-parity
  - multi-tenant-isolation
  - race-condition-prevention
  - trust-tier-escalation
  - prompt-injection-defense
  - unicode-normalization
severity: p1
status: resolved
related_issues:
  - 433
  - 434
  - 435
  - 436
  - 437
  - 440
  - 442
  - 444
  - 445
  - 450
github_commits:
  - 0d3cba5: 'feat(agent): add action parity tools for MAIS agent'
  - 90413e3: 'chore: remove resolved agent security and data integrity TODOs'
---

# Parallel Resolution of 10 Agent Security and Data Integrity TODOs

## Problem Statement

After implementing action parity tools for the MAIS agent system (commit `0d3cba5`), code review agents identified 10 security and data integrity issues across the new agent tools. These issues ranged from P1 critical (race conditions, trust tier gaps) to P3 enhancements (unicode normalization).

**Why it matters:**

- Race conditions in booking creation could cause double-bookings
- Incorrect trust tiers could allow destructive operations without proper confirmation
- Prompt injection gaps could enable malicious context manipulation
- Missing availability checks could corrupt booking data

## Solution Overview

Used the `/resolve_todo_parallel` workflow to verify and close all 10 issues in a single session:

1. **Analyzed TODO files** for dependencies (found none - all independent)
2. **Spawned 10 parallel agents** using `Task` tool with `run_in_background: true`
3. **Agents verified** fixes were already in place from commit `0d3cba5`
4. **Deleted resolved TODO files** and committed cleanup

## Findings Summary

### P1 Critical (5 Issues)

| Issue | Problem                                      | Solution                      | Location                 |
| ----- | -------------------------------------------- | ----------------------------- | ------------------------ |
| #433  | `create_booking` race condition              | Advisory lock in transaction  | `executors/index.ts:479` |
| #434  | `update_booking` missing availability check  | Lock + availability check     | `executors/index.ts:724` |
| #435  | `update_booking` status trust tier too low   | CANCELED escalates to T3      | `write-tools.ts`         |
| #436  | `update_deposit_settings` trust tier too low | Changed from T2 to T3         | `write-tools.ts`         |
| #437  | `delete_addon` missing booking check         | Check bookings, dynamic T2/T3 | `write-tools.ts`         |

### P2 Important (4 Issues)

| Issue | Problem                              | Solution                   | Location            |
| ----- | ------------------------------------ | -------------------------- | ------------------- |
| #440  | Customer field mapping inconsistency | Verified consistency       | `read-tools.ts`     |
| #442  | Generic error messages               | Added specific error codes | `write-tools.ts`    |
| #444  | Prompt injection patterns incomplete | Extended to 50+ regexes    | `types.ts:106-154`  |
| #445  | `upsert_package` price tier too low  | Escalate if >20% or >$100  | `write-tools.ts:70` |

### P3 Enhancement (1 Issue)

| Issue | Problem                       | Solution                         | Location       |
| ----- | ----------------------------- | -------------------------------- | -------------- |
| #450  | Missing unicode normalization | Added NFKC to sanitizeForContext | `types.ts:177` |

## Key Code Patterns

### Advisory Lock for Race Prevention

```typescript
// server/src/agent/executors/index.ts
await prisma.$transaction(async (tx) => {
  // Acquire advisory lock (auto-released on commit/rollback)
  const lockId = hashTenantDate(tenantId, date);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

  // Check availability while holding lock
  const existing = await tx.booking.findFirst({
    where: { tenantId, date: new Date(date) }
  });
  if (existing) throw new BookingConflictError(date);

  // Create booking within same transaction
  return tx.booking.create({ data: { tenantId, date, ... } });
});
```

### Dynamic Trust Tier Escalation

```typescript
// server/src/agent/tools/write-tools.ts
const isCancellation =
  status?.toUpperCase() === 'CANCELED' || status?.toUpperCase() === 'CANCELLED';
const trustTier = hasDateChange || isCancellation ? 'T3' : 'T2';
```

### Price Change Significance Check

```typescript
// server/src/agent/tools/write-tools.ts
function isSignificantPriceChange(oldPriceCents: number, newPriceCents: number): boolean {
  const percentChange = Math.abs((newPriceCents - oldPriceCents) / oldPriceCents);
  const absoluteChange = Math.abs(newPriceCents - oldPriceCents);
  return percentChange > 0.2 || absoluteChange > 10000; // >20% or >$100
}
```

### Unicode Normalization for Injection Prevention

```typescript
// server/src/agent/tools/types.ts
export function sanitizeForContext(text: string, maxLength = 100): string {
  // Normalize Unicode to canonical form (NFKC) to prevent homoglyph bypasses
  let result = text.normalize('NFKC');
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, '[FILTERED]');
  }
  return result.slice(0, maxLength);
}
```

## Prevention Strategies

### 1. Race Condition Prevention

- **Always use advisory locks** for booking operations
- **Wrap check + create** in single transaction
- **Hash tenant+date** for lock ID: `pg_advisory_xact_lock(hashTenantDate(tenantId, date))`
- **Three-layer defense:** DB constraint + advisory lock + graceful error

### 2. Trust Tier Assignment

| Tier      | Operations                                                     | Examples                                                      |
| --------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| T1 (Auto) | Reads, toggles, low-impact                                     | Visibility settings, file uploads                             |
| T2 (Soft) | Updates, creates without financial impact                      | Package updates, landing pages                                |
| T3 (Hard) | Cancellations, refunds, deletions with data, financial changes | Cancel booking, delete addon with bookings, >20% price change |

**Dynamic escalation rule:** Check operation parameters to determine tier at runtime.

### 3. Prompt Injection Defense

- **Normalize Unicode (NFKC)** before pattern matching
- **Maintain 50+ regex patterns** for known attack vectors
- **Filter before injecting** user content into LLM context
- **Test with known attacks:** jailbreak, DAN mode, system prompt override

### 4. Parallel TODO Resolution Workflow

1. **Analyze dependencies** - Create mermaid diagram
2. **Check for independence** - Parallelize only if no dependencies
3. **Spawn background agents** - `run_in_background: true`
4. **Verify before deleting** - Confirm fixes exist in codebase
5. **Commit cleanup** - Reference original fix commit

## Workflow Metrics

| Metric                     | Value               |
| -------------------------- | ------------------- |
| TODOs analyzed             | 10                  |
| Dependencies found         | 0 (all independent) |
| Parallel agents spawned    | 10                  |
| Issues already fixed       | 10 (100%)           |
| Lines deleted (TODO files) | 903                 |
| Time to verify all         | ~5 minutes          |

## Related Documentation

- [Parallel Agent Workflow Best Practices](../PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md)
- [Multi-Agent Parallel Code Review Workflow](./multi-agent-parallel-code-review-workflow-MAIS-20251225.md)
- [Double-Booking Prevention (Scheduling Platform)](../logic-errors/scheduling-platform-p1-critical-issues-double-booking-prevention.md)
- [Agent-Native Design Patterns](../agent-design/AGENT-NATIVE-DESIGN-PATTERNS.md)
- [ADR-013: PostgreSQL Advisory Locks](../../adrs/ADR-013-postgresql-advisory-locks.md)

## Acceptance Criteria

- [x] All 10 TODO files verified as resolved
- [x] Fixes confirmed in commit `0d3cba5`
- [x] TODO files deleted and committed (`90413e3`)
- [x] TypeScript compilation passes
- [x] Core tests pass (sanitization: 30 passing)
- [x] Changes pushed to `origin/main`

## Work Log

### 2025-12-26 - Parallel Resolution Session

**By:** Claude Code Agent

**Actions:**

1. Analyzed 10 TODO files in `/todos/*.md` directory
2. Created dependency graph (mermaid) showing all independent
3. Spawned 10 background agents via Task tool
4. Agents verified all fixes present in `0d3cba5`
5. Deleted resolved TODO files
6. Committed cleanup as `90413e3`
7. Pushed to remote

**Learnings:**

- Verification-first approach prevented redundant implementation work
- All 10 issues were already fixed during original action parity implementation
- Parallel agent spawning reduced verification time from ~30min to ~5min
- Advisory lock pattern is reusable across all booking-related operations

**Compounding Value:**
This documentation captures the complete parallel resolution workflow, enabling future code review closures to follow the same efficient pattern. The specific code patterns (advisory locks, trust tier escalation, price change checks) are now searchable references for similar issues.
