---
status: complete
priority: p3
issue_id: "040"
tags: [code-review, devops, resilience]
dependencies: []
---

# Graceful Shutdown Timeout Too Aggressive

## Problem Statement

30-second shutdown timeout may not be enough for long-running requests or slow database connections.

**Why this matters:** Incomplete state writes, data corruption during deployments.

## Findings

**Location:** `server/src/lib/shutdown.ts:52-55`

```typescript
const shutdownTimeout = setTimeout(() => {
  process.exit(1);
}, 30000);  // 30 seconds only
```

## Proposed Solutions

- Increase to 60 seconds minimum
- Make configurable: `GRACEFUL_SHUTDOWN_TIMEOUT_MS`
- Log remaining in-flight requests before force exit

## Acceptance Criteria

- [x] Timeout configurable via environment variable
- [x] Defaults to 60 seconds
- [x] Logs pending requests before forced exit

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during DevOps review |
| 2025-12-02 | Completed | Implemented configurable timeout via GRACEFUL_SHUTDOWN_TIMEOUT_MS, increased default to 60s, added enhanced logging |
