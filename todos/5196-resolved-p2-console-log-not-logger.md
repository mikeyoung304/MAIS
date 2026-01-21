---
status: ready
priority: p2
issue_id: '5196'
tags: [code-review, agent-v2, observability]
dependencies: []
---

# Console.log Used Instead of Proper Logger

## Problem Statement

All agent files use `console.log` and `console.error` instead of the structured `logger` utility used in the main codebase.

**Why it matters:**

- Violates CLAUDE.md pitfall #8
- Inconsistent log format across services
- No log levels (info/warn/error)
- Potential for sensitive data in logs without redaction

## Findings

**Location:** All agent files in `server/src/agent-v2/deploy/*/src/agent.ts`

Examples:

```typescript
console.log(`[Concierge] Creating specialist session`, { agentUrl, tenantId });
console.error(`[Concierge] Failed to create session:`, error);
```

The main codebase uses:

```typescript
import { logger } from '../lib/core/logger';
logger.info({ tenantId }, 'Creating session');
```

## Proposed Solutions

### Option A: Accept for Deployed Agents

**Pros:** No changes, Cloud Run captures console output
**Cons:** Inconsistent, no redaction
**Effort:** None

Cloud Run automatically captures console output. Format inconsistency is acceptable for isolated agents.

### Option B: Lightweight Logger for Agents (Recommended)

**Pros:** Consistent format, can add redaction
**Cons:** Need to inline or bundle
**Effort:** Small (1 hour)

```typescript
const logger = {
  info: (data: object, msg: string) =>
    console.log(
      JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })
    ),
  warn: (data: object, msg: string) =>
    console.warn(
      JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() })
    ),
  error: (data: object, msg: string) =>
    console.error(
      JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() })
    ),
};
```

## Technical Details

**Affected Files:**

- All 5 agent files in `server/src/agent-v2/deploy/*/src/agent.ts`

## Acceptance Criteria

- [ ] Consistent log format across all agents
- [ ] Logs include timestamps and log levels
- [ ] No sensitive data logged without redaction

## Work Log

| Date       | Action  | Notes                   |
| ---------- | ------- | ----------------------- |
| 2026-01-19 | Created | From multiple reviewers |
