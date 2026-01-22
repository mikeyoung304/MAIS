# Multi-Agent Code Review Patterns

**Document Purpose:** Extract reusable patterns from the "enterprise-grade persistent chat session storage" code review that caught ~2,363 lines of over-engineered code.

**Session Context:** 2026-01-22 - Review of commit 4f98fb8a using 6 specialized review agents in parallel.

---

## Executive Summary

A code review using 6 specialized agents in parallel identified 14 issues in a 2,363-line implementation. Key findings:

| Category         | Issues Found | Lines Affected       |
| ---------------- | ------------ | -------------------- |
| Over-engineering | 3            | ~737 lines removable |
| Performance      | 2            | Hot path issues      |
| Data Integrity   | 3            | Race conditions      |
| Missing Timeouts | 1            | 4 fetch calls        |
| Dead Code        | 2            | ~489 lines           |

**Outcome:** Review identified that ~50% of the code could be eliminated or replaced with existing dependencies.

---

## Part 1: Multi-Agent Review Process

### 1.1 Agent Specialization Strategy

Run domain-specific agents in parallel to maximize coverage while minimizing blind spots.

**Agent Roster Used:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    PARALLEL EXECUTION                           │
├──────────────────┬──────────────────┬──────────────────────────┤
│ Security Agent   │ Performance Agent│ Architecture Agent       │
│ - Auth bypass    │ - O(n) hotpath   │ - Layer violations       │
│ - Tenant leakage │ - Missing index  │ - DI anti-patterns       │
│ - Missing timeout│ - Lock contention│ - Coupling issues        │
├──────────────────┼──────────────────┼──────────────────────────┤
│ Data Integrity   │ TypeScript Agent │ Simplicity Agent         │
│ - TOCTOU races   │ - Type assertions│ - YAGNI violations       │
│ - Version bypass │ - Missing Zod    │ - NIH syndrome           │
│ - Null handling  │ - Any casts      │ - Dead code              │
└──────────────────┴──────────────────┴──────────────────────────┘
```

### 1.2 Agent Prompt Structure

Each agent receives a focused prompt with domain-specific heuristics:

```markdown
## [Agent Name] Code Review

Focus areas:

1. [Primary concern]
2. [Secondary concern]
3. [Tertiary concern]

Severity levels:

- P0: Security vulnerability or data loss risk
- P1: Will cause production issues
- P2: Should fix before next release
- P3: Technical debt (fix when touching code)

Output format:
For each finding:

1. File path and line numbers
2. Problem description
3. Why it matters
4. Proposed solution with code
```

### 1.3 Synthesis Process

After parallel review, synthesize findings:

1. **Deduplicate** - Multiple agents may flag same issue (good signal)
2. **Cross-reference** - Security + Performance finding = higher priority
3. **Prioritize** - P0/P1 block merge, P2/P3 create follow-up todos
4. **Create todos** - One file per actionable finding

---

## Part 2: Over-Engineering Detection Heuristics

### 2.1 Signal: Custom Implementation of Existing Dependency

**Pattern Found:** 248-line custom LRU cache when `lru-cache` npm package already installed

**Detection Heuristic:**

```bash
# Check if custom code duplicates installed dependency
npm ls lru-cache  # Shows: lru-cache@10.x.x installed
grep -r "class.*Cache" server/src/  # Shows: custom SessionCache class
```

**Red Flag Checklist:**

- [ ] Package.json contains library that does what custom code does
- [ ] Custom implementation >100 lines for common pattern (cache, queue, retry)
- [ ] No tests for custom implementation vs battle-tested library
- [ ] Comments reference the library pattern ("LRU", "ring buffer")

**Remediation:**

```typescript
// BEFORE: 248 lines
export class SessionCache {
  private cache = new Map<string, CacheEntry>();
  // ... 230+ lines of manual LRU, TTL, eviction logic
}

// AFTER: 10 lines
import { LRUCache } from 'lru-cache';

export const sessionCache = new LRUCache<string, SessionWithMessages>({
  max: 2000,
  ttl: 5 * 60 * 1000, // 5 minutes
});
```

### 2.2 Signal: Dead Module with Single-Use Function

**Pattern Found:** 196-line audit module with 7 functions, only 1 used

**Detection Heuristic:**

```bash
# Count function definitions vs usages
grep -c "export function audit" server/src/services/session/session.audit.ts
# Result: 7 functions

grep -rn "audit" server/src/ --include="*.ts" | grep -v "session.audit.ts" | wc -l
# Result: 2 usages (only auditSessionCreated called)
```

**Red Flag Checklist:**

- [ ] Module exports >5 functions
- [ ] <20% of exports are actually imported elsewhere
- [ ] Functions are thin wrappers (just call logger/database)
- [ ] Module created "just in case" for future auditing

**Remediation:**

```typescript
// BEFORE: 196-line audit.ts with switch statement and 7 wrapper functions
export function auditSessionCreated(...) { logSessionAudit({...}) }
export function auditMessageAppended(...) { logSessionAudit({...}) }  // Never called
export function auditSessionAccessed(...) { logSessionAudit({...}) }  // Never called
// ... 4 more unused functions

// AFTER: Direct logger call where needed
logger.info({ sessionId, tenantId, sessionType }, 'Session created');
```

### 2.3 Signal: Double Protection Pattern

**Pattern Found:** Serializable isolation + advisory locks for same concurrency control

**Detection Heuristic:**

```typescript
// Look for multiple concurrency controls in same transaction
await this.prisma.$transaction(
  async (tx) => {
    // Protection 1: Advisory lock
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    // Protection 2: Optimistic locking
    if (session.version !== expectedVersion) {
      throw new Error('VERSION_MISMATCH');
    }
  },
  // Protection 3: Serializable isolation
  { isolationLevel: 'Serializable' } // Overkill!
);
```

**Red Flag Checklist:**

- [ ] Transaction uses Serializable isolation (most expensive)
- [ ] Same transaction also uses advisory locks
- [ ] Same transaction also has optimistic locking
- [ ] Comments say "belt and suspenders" or "extra safety"

**Decision Tree:**

```
Is TOCTOU the concern?
├─ YES → Use advisory lock (pg_advisory_xact_lock)
│        Use ReadCommitted isolation
│        Advisory lock already serializes access
└─ NO → Is concurrent modification the concern?
         ├─ YES → Use optimistic locking (version field)
         │        Use ReadCommitted isolation
         └─ NO → Use ReadCommitted (default)
```

**Remediation:**

```typescript
// BEFORE: Triple protection
{ isolationLevel: 'Serializable', timeout: 10000 }

// AFTER: Advisory lock is sufficient
{ isolationLevel: 'ReadCommitted', timeout: 10000 }
// Advisory lock already prevents concurrent access to same session
```

### 2.4 Signal: Metrics Module Without Integration

**Pattern Found:** 293-line metrics collector with in-memory storage, no observability integration

**Detection Heuristic:**

```bash
# Check for metrics that only log, don't export
grep -A5 "getMetrics" server/src/services/session/session.metrics.ts
# Shows: returns object from memory, no Prometheus/Datadog/CloudWatch

grep -r "sessionMetrics" server/src/ --include="*.ts" | grep -v ".metrics.ts"
# Shows: ~8 usages, all record* calls, no get* calls
```

**Red Flag Checklist:**

- [ ] Metrics stored in memory (lost on restart)
- [ ] No integration with observability platform
- [ ] `record*` functions called but `get*` functions never called
- [ ] setInterval logging with no cleanup (memory leak)

**Remediation Options:**

```typescript
// Option A: Delete module, replace with direct logging
logger.info({ event: 'session.created', tenantId, sessionId });

// Option B: Integrate with real observability
import { metrics } from '@opentelemetry/api';
const sessionCreatedCounter = metrics.getMeter('session').createCounter('session.created');
sessionCreatedCounter.add(1, { tenantId });
```

### 2.5 Signal: O(n) Operation in Hot Path

**Pattern Found:** Array.shift() for rolling metrics window

**Detection Heuristic:**

```typescript
// Look for array mutations in frequently-called code
recordGetLatency(ms: number): void {
  this.getLatencies.push(ms);
  if (this.getLatencies.length > this.maxSamples) {
    this.getLatencies.shift(); // O(n)! Shifts 1000 elements every call
  }
}
```

**Red Flag Checklist:**

- [ ] Array.shift() or Array.unshift() in loop or hot path
- [ ] Array.splice(0, n) for removing from beginning
- [ ] Array growing then trimming repeatedly
- [ ] maxSamples > 100

**Remediation:**

```typescript
// BEFORE: O(n) shift
this.getLatencies.shift();

// AFTER: O(1) ring buffer
private latencies: number[] = new Array(1000).fill(0);
private index = 0;

recordLatency(ms: number): void {
  this.latencies[this.index] = ms;
  this.index = (this.index + 1) % this.latencies.length;
}
```

---

## Part 3: Specific Anti-Patterns Found

### 3.1 Missing Fetch Timeouts

**Issue:** 4 fetch calls to ADK agent with no timeout

**File:** `server/src/services/vertex-agent.service.ts` (lines 139, 323, 461, 611)

**Why It Matters:** Slow external service hangs request indefinitely, exhausting connection pool

**Pattern:**

```typescript
// WRONG: No timeout
const response = await fetch(url, { method: 'POST', headers, body });

// CORRECT: 30s timeout for agent calls (per CLAUDE.md Pitfall #46)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);
try {
  const response = await fetch(url, { signal: controller.signal, method: 'POST', headers, body });
} finally {
  clearTimeout(timeoutId);
}
```

### 3.2 Version Tracking Bypass

**Issue:** Route handler fetches fresh version from DB instead of honoring client-provided version

**File:** `server/src/routes/tenant-admin-agent.routes.ts:87-108`

**Why It Matters:** Defeats optimistic locking - concurrent tabs both get fresh version

**Race Condition:**

```
Tab A: reads version 5 → sends message → handler fetches version 5 → success
Tab B: reads version 5 → sends message → handler fetches version 5 → success (should conflict!)
```

**Pattern:**

```typescript
// WRONG: Fetch fresh version
if (existingSession) {
  version = existingSession.version; // Always matches!
}

// CORRECT: Validate client version
if (providedVersion !== undefined && existingSession.version !== providedVersion) {
  return res.status(409).json({
    error: 'Concurrent modification',
    currentVersion: existingSession.version,
  });
}
```

### 3.3 Cleanup Job Missing Tenant Scoping

**Issue:** Session cleanup job operates globally without tenant context

**File:** `server/src/jobs/cleanup.ts`

**Why It Matters:** Cross-tenant data exposure if cleanup logging includes session content

**Pattern:**

```typescript
// WRONG: Global cleanup
await prisma.agentSession.updateMany({
  where: { lastActivityAt: { lt: cutoff }, deletedAt: null },
  data: { deletedAt: new Date() },
});

// CORRECT: Tenant-scoped cleanup (or ensure no PII in logs)
// If logging cleanup actions, never include message content
logger.info({ count: result.count }, 'Sessions expired'); // OK: count only
logger.info({ sessions: expiredSessions }, 'Sessions expired'); // WRONG: could include content
```

---

## Part 4: Review Process Metrics

### 4.1 Findings Distribution

| Agent            | P0  | P1  | P2  | P3  | Total         |
| ---------------- | --- | --- | --- | --- | ------------- |
| Security         | 0   | 1   | 2   | 1   | 4             |
| Performance      | 0   | 2   | 1   | 0   | 3             |
| Architecture     | 0   | 0   | 3   | 1   | 4             |
| Data Integrity   | 0   | 1   | 2   | 0   | 3             |
| TypeScript       | 0   | 0   | 2   | 0   | 2             |
| Simplicity       | 0   | 2   | 3   | 0   | 5             |
| **Total**        | 0   | 6   | 13  | 2   | **21 raw**    |
| **Deduplicated** | 0   | 3   | 9   | 2   | **14 unique** |

### 4.2 Cross-Agent Signal Value

Findings flagged by multiple agents are higher confidence:

| Finding               | Agents                               | Final Priority |
| --------------------- | ------------------------------------ | -------------- |
| Serializable overkill | Performance + Data Integrity         | P1             |
| Missing fetch timeout | Security + Architecture + TypeScript | P1             |
| Custom LRU cache      | Simplicity (primary)                 | P2             |
| Dead audit code       | Simplicity (primary)                 | P2             |

### 4.3 Code Reduction Opportunity

| Module             | Current Lines | After Remediation | Savings     |
| ------------------ | ------------- | ----------------- | ----------- |
| session.cache.ts   | 248           | 10 (lru-cache)    | 238         |
| session.audit.ts   | 196           | 0 (delete)        | 196         |
| session.metrics.ts | 293           | 0 or 50           | 243-293     |
| **Total**          | 737           | 10-60             | **677-727** |

---

## Part 5: Prevention Checklist

### Pre-Implementation Review

Before writing "enterprise-grade" features:

- [ ] Check if npm dependency already does this
- [ ] Estimate lines of code - >500 for single feature is a smell
- [ ] Identify what protection level is actually needed (not maximum)
- [ ] Question each "just in case" module

### Code Review Checklist

- [ ] Are there custom implementations of library patterns? (cache, queue, retry)
- [ ] Are there modules with <20% function usage?
- [ ] Are there multiple concurrency controls (isolation + locks + versioning)?
- [ ] Are there metrics without observability integration?
- [ ] Are there Array.shift() or splice(0,n) in hot paths?
- [ ] Do all fetch calls have timeouts?
- [ ] Is optimistic locking actually being validated?

### CLAUDE.md Updates

Added as Pitfall #71-74:

```markdown
71. Custom cache when lru-cache installed - Check `npm ls lru-cache` before writing cache code
72. Audit/metrics modules with <20% usage - YAGNI; use direct logger calls
73. Serializable + advisory locks - Pick one; Serializable is expensive
74. Array.shift() in metrics/rolling windows - Use ring buffer for O(1)
```

---

## Related Documents

- `docs/solutions/PARALLEL-AGENT-WORKFLOW-BEST-PRACTICES.md` - Agent orchestration patterns
- `docs/solutions/security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md` - Security review checklist
- `CLAUDE.md` - Pitfalls index (search "Pitfall #")

---

## Session Reference

**Date:** 2026-01-22
**Commit Reviewed:** 4f98fb8a (feat: implement enterprise-grade persistent chat session storage)
**Review Duration:** ~45 minutes (parallel agent execution)
**Todos Created:** 14 (files 5243-5256)
**Key Insight:** "Enterprise-grade" often means over-engineered; simplicity agent is essential
