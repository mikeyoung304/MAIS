---
status: ready
priority: p2
issue_id: '5191'
tags: [code-review, agent-v2, security]
dependencies: []
---

# INTERNAL_API_SECRET Falls Back to Empty String

## Problem Statement

All agent files have `INTERNAL_API_SECRET` falling back to empty string instead of failing loudly when not configured.

**Why it matters:** Agents will silently make requests with empty auth headers, which the backend rejects. This creates confusing "unauthorized" errors instead of clear "missing configuration" errors.

## Findings

**Location:** All agent files at ~line 24

```typescript
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';
```

Found in:

- `server/src/agent-v2/deploy/concierge/src/agent.ts`
- `server/src/agent-v2/deploy/storefront/src/agent.ts`
- `server/src/agent-v2/deploy/marketing/src/agent.ts`
- `server/src/agent-v2/deploy/research/src/agent.ts`
- `server/src/agent-v2/deploy/booking/src/agent.ts`

## Proposed Solutions

### Option A: Throw at Module Load (Recommended)

**Pros:** Immediate, clear failure during deployment
**Cons:** None significant
**Effort:** Small (15 min)

```typescript
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
if (!INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
```

### Option B: Lazy Validation in callMaisApi

**Pros:** Allows agent to start for health checks
**Cons:** Delays error until first API call
**Effort:** Small (20 min)

## Technical Details

**Affected Files:**

- All 5 agent files in `server/src/agent-v2/deploy/*/src/agent.ts`

## Acceptance Criteria

- [ ] Agents fail at startup if INTERNAL_API_SECRET not set
- [ ] Error message clearly indicates which env var is missing
- [ ] Local development instructions updated

## Work Log

| Date       | Action  | Notes                |
| ---------- | ------- | -------------------- |
| 2026-01-19 | Created | From security review |
