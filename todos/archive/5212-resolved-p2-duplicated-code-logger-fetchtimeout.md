---
status: complete
priority: p2
issue_id: '5212'
tags: [code-review, session-bootstrap, duplication, simplicity, agent-v2]
dependencies: []
---

# Duplicated Code - Logger and fetchWithTimeout Across Agents

## Problem Statement

The exact same structured logger implementation and `fetchWithTimeout` function appear in both `concierge/agent.ts` and `storefront/agent.ts`. Classic copy-paste duplication.

**Why it matters:** Bug fixes or improvements must be made in multiple places. Increases maintenance burden.

## Findings

**Locations:**

1. Logger: `concierge/agent.ts:27-42`, `storefront/agent.ts:27-42`
2. fetchWithTimeout: `concierge/agent.ts:303-321`, `storefront/agent.ts:282-300`

**Duplicated Logger:**

```typescript
const logger = {
  info: (obj: Record<string, unknown>, msg: string) => {
    console.log(
      JSON.stringify({ level: 'info', ...obj, msg, timestamp: new Date().toISOString() })
    );
  },
  // ... same in both files
};
```

**Duplicated fetchWithTimeout:**

```typescript
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  // ... identical implementation
}
```

**Reviewer:** Code Simplicity (P2 - DUPLICATION)

## Proposed Solutions

### Option A: Accept Duplication (For Now)

**Pros:** No changes needed, agents are standalone deployments
**Cons:** Maintenance burden remains
**Effort:** None
**Risk:** Low

Document that agents intentionally have no shared dependencies.

### Option B: Extract to Shared Package

**Pros:** Single source of truth, DRY
**Cons:** Creates dependency, complicates standalone deployment
**Effort:** Medium
**Risk:** Low

Create `packages/agent-utils/` with shared logger and fetch utilities.

### Option C: Inline Comment "Intentional Duplication"

**Pros:** Documents decision, prevents future "cleanup" attempts
**Cons:** Duplication remains
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`
- `server/src/agent-v2/deploy/storefront/src/agent.ts`
- (Optional) New `packages/agent-utils/`

**Duplicated Lines:** ~50 lines across both files

## Acceptance Criteria

- [ ] Either extracted to shared package OR documented as intentional
- [ ] Future maintainers understand the decision

## Work Log

| Date       | Action                         | Learnings                                 |
| ---------- | ------------------------------ | ----------------------------------------- |
| 2026-01-20 | Created from /workflows:review | Code Simplicity reviewer noted copy-paste |

## Resources

- PR: feature/session-bootstrap-onboarding
- Review: Code Simplicity (DHH style)
