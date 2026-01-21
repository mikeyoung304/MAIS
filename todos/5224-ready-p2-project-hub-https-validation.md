---
status: ready
priority: p2
issue_id: '5224'
tags: [security, agent-v2, project-hub, code-review, configuration]
dependencies: []
---

# Project Hub: Missing HTTPS Validation

## Problem Statement

All other agents validate that `MAIS_API_URL` uses HTTPS for non-localhost hosts. Project Hub is missing this validation, creating a potential security inconsistency where API calls could be made over unencrypted HTTP in production.

**Impact:** If misconfigured, sensitive data (tenant IDs, customer info, project details) could be transmitted unencrypted.

## Findings

### Simplicity Reviewer

Other agents have (e.g., storefront lines 60-67):

```typescript
if (
  MAIS_API_URL.startsWith('http://') &&
  !MAIS_API_URL.includes('localhost') &&
  !MAIS_API_URL.includes('127.0.0.1')
) {
  throw new Error(`MAIS_API_URL must use HTTPS for non-localhost hosts. Got: ${MAIS_API_URL}`);
}
```

Project Hub is missing this block.

## Proposed Solutions

### Option A: Add HTTPS Validation (Recommended)

Add the standard validation block after `MAIS_API_URL` definition:

```typescript
const MAIS_API_URL = process.env.MAIS_API_URL || 'https://api.gethandled.ai';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

// Validate HTTPS for non-localhost
if (
  MAIS_API_URL.startsWith('http://') &&
  !MAIS_API_URL.includes('localhost') &&
  !MAIS_API_URL.includes('127.0.0.1')
) {
  throw new Error(`MAIS_API_URL must use HTTPS for non-localhost hosts. Got: ${MAIS_API_URL}`);
}

if (!INTERNAL_API_SECRET) {
  throw new Error('INTERNAL_API_SECRET environment variable is required');
}
```

**Pros:** Consistent with other agents, fail-fast on misconfiguration
**Cons:** None
**Effort:** Small (5 minutes)
**Risk:** Very low

## Recommended Action

**Option A** - Add the validation block.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts` (after line 24)

## Acceptance Criteria

- [ ] HTTPS validation added matching other agent patterns
- [ ] Throws clear error on HTTP for non-localhost
- [ ] Allows HTTP for localhost/127.0.0.1 (local dev)

## Work Log

| Date       | Action                               | Result                            |
| ---------- | ------------------------------------ | --------------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by Simplicity reviewer |

## Resources

- [Storefront HTTPS Validation](server/src/agent-v2/deploy/storefront/src/agent.ts:60-67)
