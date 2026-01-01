---
status: resolved
priority: p1
issue_id: '568'
tags: [code-review, performance, agent-ecosystem, quality-first-triage]
dependencies: []
resolved_at: 2026-01-01
resolution: 'Created AuditBatcher class with in-memory collection and flush() method using createMany(). Graceful error handling preserves entries on failure. 20 comprehensive tests. Ready for integration into BaseOrchestrator.'
---

# P1: Audit Logging Not Batched (N+1 Database Writes)

> **Quality-First Triage:** New finding. "N+1 database writes per chat turn. Will cause DB issues at scale."

## Problem Statement

Each tool execution triggers an individual database write:

- Line 887-895: `await this.auditService.logProposalCreated(...)` per tool
- Line 897-904: `await this.auditService.logRead(...)` per tool
- Line 935-942: `await this.auditService.logError(...)` per tool
- Line 552-562: `await this.auditService.logToolCall(...)` at turn end

For a turn with 5 tool calls:

- 5 individual INSERT statements
- 5 round-trips to database
- 5 transaction commits
- Each awaited serially in the tool processing loop

**Why it matters:**

- Database connection pool exhaustion under load
- Latency amplification (each await blocks next tool)
- Transaction overhead (each INSERT is separate transaction)
- At 50 tool calls/second: constant connection pool pressure

## Findings

| Reviewer           | Finding                                          |
| ------------------ | ------------------------------------------------ |
| Performance Triage | P1: N+1 writes cause real database load at scale |

## Proposed Solutions

### Option 1: Batch Logging at Turn End (Recommended)

**Effort:** Medium (2-3 hours)

Collect audit entries in memory, single `createMany()` at turn end:

```typescript
class AuditBatcher {
  private entries: AuditEntry[] = [];

  log(entry: AuditEntry): void {
    this.entries.push(entry);
  }

  async flush(): Promise<void> {
    if (this.entries.length > 0) {
      await this.prisma.auditLog.createMany({ data: this.entries });
      this.entries = [];
    }
  }
}
```

### Option 2: Fire-and-Forget Pattern

**Effort:** Small (1 hour)

Don't await audit writes in hot path:

```typescript
// Don't await - fire and forget
this.auditService.logToolCall(...).catch(logError);
```

## Technical Details

**Affected Files:**

- `server/src/agent/audit/audit.service.ts` - Add batching
- `server/src/agent/orchestrator/base-orchestrator.ts` - Use batcher

**Current Writes Per Turn:**

- Minimum: 2 (start + end)
- With 5 tools: 7 writes
- With max recursion: 12+ writes

**After Fix:**

- 1 batched write at turn end

## Acceptance Criteria

- [ ] Implement AuditBatcher with in-memory collection
- [ ] Single `createMany()` at turn completion
- [ ] Graceful handling if batch write fails
- [ ] Test for batched audit under load

## Work Log

| Date       | Action                            | Learnings                                |
| ---------- | --------------------------------- | ---------------------------------------- |
| 2026-01-01 | Created from quality-first triage | Performance agent identified N+1 pattern |
