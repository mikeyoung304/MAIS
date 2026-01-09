---
status: pending
priority: p2
issue_id: '683'
tags: [code-review, agent-first-architecture, dead-code, capability-registry]
dependencies: []
---

# P2: Missing Backend Tool for `update_business_info` Capability

## Problem Statement

The capability registry lists `update_business_info` as a T2 capability, but there's no corresponding tool in any backend tool file. Users can discover this capability but the agent cannot execute it.

**Why This Matters:**

- Users may ask agent to update business info and receive failure
- Creates frustrating UX where capability is promised but not delivered
- Dead code in capability registry

## Findings

**Agent:** Agent-Native Reviewer

**Location:** `apps/web/src/lib/agent-capabilities.ts` (lines 254-263)

**Current State:**

```typescript
{
  id: 'update_business_info',
  name: 'Update Business Info',
  description: 'Update your business name, contact info, or hours',
  category: 'settings',
  keywords: ['business', 'name', 'contact', 'phone', 'email', 'hours', 'info'],
  trustTier: 'T2',
  example: 'Update my business hours',
}
```

**Backend Reality:** No `update_business_info` tool in:

- `server/src/agent/tools/ui-tools.ts`
- `server/src/agent/tools/storefront-tools.ts`
- `server/src/agent/tools/onboarding-tools.ts`

## Proposed Solutions

### Option A: Remove capability from registry (Recommended for now)

- Delete the capability entry
- Add TODO comment for future implementation
- **Pros:** Honest capability registry
- **Cons:** Feature gap
- **Effort:** Small
- **Risk:** None

### Option B: Implement the tool

- Create `update_business_info` tool in settings-tools.ts
- Wire up to tenant settings API
- **Pros:** Complete feature
- **Cons:** Scope creep, separate PR
- **Effort:** Medium-Large
- **Risk:** Low

## Recommended Action

**Option A** for this PR - Remove capability. Track implementation as separate feature request.

## Technical Details

**Affected Files:**

- `apps/web/src/lib/agent-capabilities.ts`

## Acceptance Criteria

- [ ] Capability removed from registry OR backend tool implemented
- [ ] No dead capabilities that can't be executed

## Work Log

| Date       | Action                     | Outcome        |
| ---------- | -------------------------- | -------------- |
| 2026-01-09 | Created during code review | Initial filing |

## Resources

- PR: Agent-First Dashboard Architecture (Phases 1-5)
