---
status: ready
priority: p2
issue_id: '5198'
tags: [code-review, agent-v2, security, trust-tiers]
dependencies: ['5186']
---

# discard_draft Labeled T3 But No Confirmation Required

## Problem Statement

Storefront's `discard_draft` tool is documented as T3 (destructive, requires confirmation) but has no code enforcement of confirmation.

**Why it matters:** Users could lose draft work without explicitly confirming they want to discard changes.

## Findings

**Location:** `server/src/agent-v2/deploy/storefront/src/agent.ts` (lines 487-505)

Trust tier table says:

```
| discard_draft | T3 | Require explicit approval |
```

But tool definition has no confirmation parameter:

```typescript
{
  name: 'discard_draft',
  description: 'Discard all unpublished changes...',
  parameters: z.object({
    pageName: z.string().optional(),
  }),
  // No confirmationReceived parameter!
}
```

Compare to Concierge's `publish_changes` which correctly has:

```typescript
confirmationReceived: z.boolean().describe('Must be true for publish to proceed');
```

## Proposed Solutions

### Option A: Add Confirmation Parameter (Recommended)

**Pros:** Consistent with trust tier documentation
**Cons:** Slightly more friction for users
**Effort:** Small (30 min)

```typescript
parameters: z.object({
  pageName: z.string().optional(),
  confirmationReceived: z.boolean().describe('Must be true. User must explicitly confirm discarding changes.'),
}),
execute: async ({ pageName, confirmationReceived }, context) => {
  if (!confirmationReceived) {
    return {
      status: 'pending_confirmation',
      message: 'Please confirm you want to discard all unpublished changes. This cannot be undone.',
    };
  }
  // ... proceed with discard
}
```

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/storefront/src/agent.ts`

**Related:** This is the same pattern needed for `publish_draft` (see #5186)

## Acceptance Criteria

- [ ] `discard_draft` requires `confirmationReceived: true`
- [ ] User sees clear warning before discard happens
- [ ] Trust tier documentation matches implementation

## Work Log

| Date       | Action  | Notes                    |
| ---------- | ------- | ------------------------ |
| 2026-01-19 | Created | From agent-native review |
