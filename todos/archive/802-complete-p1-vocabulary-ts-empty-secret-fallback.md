---
status: ready
priority: p1
issue_id: 802
tags: [code-review, agent, security, pitfall-45]
dependencies: []
---

# Empty Secret Fallback in vocabulary.ts (Pitfall #45)

## Problem Statement

The vocabulary.ts file accesses `INTERNAL_API_SECRET` directly from `process.env` without using `requireEnv()`, causing silent authentication failures if the environment variable is missing.

**Why it matters:**

- If env var is missing, `X-Internal-Secret` header will be `undefined`
- This causes silent auth failures that are hard to debug
- Violates Pitfall #45: Empty secret fallback masks misconfiguration

## Findings

**From ADK-Compliance agent:**

> `INTERNAL_API_SECRET` is accessed directly without using `requireEnv()`, which means if the env var is missing, `X-Internal-Secret` header will be `undefined` (line 127), causing silent auth failures.

**Location:** `server/src/agent-v2/deploy/tenant/src/tools/vocabulary.ts:25-26`

```typescript
const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET; // <-- Not using requireEnv
```

**Header usage (line 127):**

```typescript
headers: {
  'X-Internal-Secret': INTERNAL_API_SECRET,  // Could be undefined!
}
```

## Proposed Solutions

### Option A: Use requireEnv() (Recommended)

**Pros:** Fails fast at startup with clear error message
**Cons:** None
**Effort:** Small (5 minutes)
**Risk:** Low

```typescript
import { requireEnv } from '../utils.js';
const INTERNAL_API_SECRET = requireEnv('INTERNAL_API_SECRET');
```

### Option B: Add Runtime Validation

**Pros:** More defensive
**Cons:** Slightly more code
**Effort:** Small (10 minutes)
**Risk:** Low

Add validation before the API call that throws if secret is missing.

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/tools/vocabulary.ts`

**Pattern to follow:** See `utils.ts` which correctly uses `requireEnv()` for other secrets.

## Acceptance Criteria

- [ ] `INTERNAL_API_SECRET` accessed via `requireEnv()`
- [ ] Agent fails fast at startup if secret is missing
- [ ] No silent auth failures possible from missing env var

## Work Log

| Date       | Action                                    | Learnings                              |
| ---------- | ----------------------------------------- | -------------------------------------- |
| 2026-01-31 | Identified during multi-agent code review | Pitfall #45 violation in vocabulary.ts |

## Resources

- [CLAUDE.md Pitfall #45](CLAUDE.md) - Empty secret fallback
- [ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md)
