---
status: resolved
priority: p1
issue_id: '558'
tags: [code-review, simplicity, agent-ecosystem, dead-code, quality-first-triage]
dependencies: []
resolved_at: 2026-01-01
resolution: 'Deleted SessionId, TenantId branded types and helper functions. Added isOnboardingActive() utility.'
---

# P1: Unused Branded Types (SessionId/TenantId) - Dead Code

> **Quality-First Triage Upgrade:** P2 → P1. "Aspirational architecture. Exported but never used. Actively misleads developers."

## Problem Statement

The branded types `SessionId` and `TenantId` with their helper functions are defined and exported but **never actually used**:

```typescript
// types.ts:9-18
export type SessionId = string & { readonly __brand: 'SessionId' };
export type TenantId = string & { readonly __brand: 'TenantId' };

export function toSessionId(id: string): SessionId {
  return id as SessionId;
}
export function toTenantId(id: string): TenantId {
  return id as TenantId;
}
```

Grep search shows they're only referenced in:

- `types.ts` (definition)
- `index.ts` (export)

No actual code uses these branded types.

**Why it matters:** Dead code adds cognitive overhead and maintenance burden. This was added as a premature abstraction.

## Findings

| Reviewer              | Finding                                    |
| --------------------- | ------------------------------------------ |
| Simplicity Reviewer   | P1: Unused branded types - YAGNI violation |
| TypeScript Reviewer   | P3: Branded types defined but not used     |
| Agent-Native Reviewer | P3: Unused branded types                   |

## Proposed Solutions

### Option 1: Delete Unused Types (Recommended)

**Effort:** Trivial (10 minutes)

Remove the unused branded types and helper functions.

**Pros:**

- Reduces dead code
- Clearer codebase

**Cons:**

- If needed later, must re-add

### Option 2: Actually Use the Branded Types

**Effort:** Large (4-6 hours)

Migrate all `string` usages to branded types throughout the orchestrator.

**Pros:**

- Compile-time safety for parameter order
- Catches sessionId/tenantId mixups

**Cons:**

- Significant refactor
- May not be worth the effort

## Recommended Action

Implement **Option 1** - delete the unused code. If branded types become needed later, add them then with actual usage.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/types.ts` - Remove lines 9-18
- `server/src/agent/orchestrator/index.ts` - Remove exports

**Lines to Delete:**

```typescript
export type SessionId = string & { readonly __brand: 'SessionId' };
export type TenantId = string & { readonly __brand: 'TenantId' };

export function toSessionId(id: string): SessionId { ... }
export function toTenantId(id: string): TenantId { ... }
```

## Acceptance Criteria

- [ ] Delete SessionId, TenantId types from types.ts
- [ ] Delete toSessionId, toTenantId functions
- [ ] Remove exports from index.ts
- [ ] Verify build still passes
- [ ] No usages anywhere in codebase

## Work Log

| Date       | Action                   | Learnings                                           |
| ---------- | ------------------------ | --------------------------------------------------- |
| 2026-01-01 | Created from code review | Simplicity Reviewer flagged as P1, downgraded to P2 |

## Resources

- YAGNI principle: https://martinfowler.com/bliki/Yagni.html
