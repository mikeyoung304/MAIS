---
status: resolved
priority: p1
issue_id: '5186'
tags: [code-review, agent-v2, security, trust-tier]
dependencies: []
---

# Storefront publish_draft Tool Missing Confirmation Parameter

## Problem Statement

The Storefront agent's `publish_draft` tool is labeled as T3 (requires explicit confirmation) in the system prompt, but the actual tool implementation lacks a `confirmation` parameter requirement. This means the agent can publish live without programmatic enforcement of user confirmation, relying solely on prompt instructions which can be bypassed.

**Why it matters:** Publishing to live affects real users immediately. Without programmatic enforcement, prompt injection or LLM hallucination could trigger unintended publishes. This is a critical trust boundary violation.

## Findings

**Source:** Agent-v2 code review

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/storefront/src/agent.ts:464-484`

**Current Code:**

```typescript
// T3: Publish draft
const publishDraftTool = new FunctionTool({
  name: 'publish_draft',
  description: `Publish draft changes to make them live. REQUIRES explicit user confirmation.
This is a T3 action - only call after user says "yes", "publish it", or similar.`,
  parameters: PublishDraftParams, // Empty: z.object({})
  execute: async (_params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    console.log(`[StorefrontAgent] publish_draft called`);
    const result = await callMaisApi('/storefront/publish', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }
    return result.data;
  },
});
```

**Problem:** The parameters schema is empty (`PublishDraftParams = z.object({})`). The tool trusts the LLM to only call it after user confirmation, but there's no programmatic enforcement.

**Contrast with Concierge's publish_changes (correct implementation):**

```typescript
// From concierge/src/agent.ts:795-828
const publishChangesTool = new FunctionTool({
  name: 'publish_changes',
  description: 'Publish draft changes to the live storefront. THIS IS A T3 ACTION...',
  parameters: z.object({
    confirmationReceived: z
      .boolean()
      .describe('Set to true ONLY if user explicitly confirmed publishing'),
  }),
  execute: async (params, context) => {
    // ...
    if (!params.confirmationReceived) {
      return {
        error: 'T3 action requires explicit confirmation',
        message: 'Ask the user to confirm they want to publish...',
      };
    }
    // ... proceed with publish
  },
});
```

## Proposed Solutions

### Solution 1: Add confirmationReceived Parameter (Recommended)

**Approach:** Match the Concierge's publish_changes pattern

```typescript
const PublishDraftParams = z.object({
  confirmationReceived: z
    .boolean()
    .describe(
      'Set to true ONLY if user explicitly said "publish", "make it live", "ship it", or similar confirmation'
    ),
});

const publishDraftTool = new FunctionTool({
  name: 'publish_draft',
  description: `Publish draft changes to make them live. THIS IS A T3 ACTION.
REQUIRES explicit user confirmation - only call with confirmationReceived=true after user says "yes", "publish it", "make it live", etc.`,
  parameters: PublishDraftParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    if (!params.confirmationReceived) {
      return {
        error: 'T3 action requires explicit confirmation',
        requiresConfirmation: true,
        message: 'Please confirm you want to publish these changes to your live site.',
      };
    }

    console.log(`[StorefrontAgent] publish_draft called with confirmation`);
    const result = await callMaisApi('/storefront/publish', tenantId);

    if (!result.ok) {
      return { error: result.error };
    }
    return {
      ...result.data,
      published: true,
      message: 'Changes are now live!',
    };
  },
});
```

**Pros:**

- Programmatic enforcement of T3 trust tier
- Consistent with Concierge pattern
- LLM must explicitly set boolean, reducing hallucination risk
- Tool returns actionable error if called incorrectly

**Cons:**

- Requires system prompt update to mention the parameter
- Extra parameter in tool call

**Effort:** 30 minutes

### Solution 2: Backend-Side Confirmation Token

**Approach:** Generate a confirmation token in preview, require it for publish

```typescript
// In preview_draft response:
return {
  previewUrl: `/t/${slug}?preview=draft`,
  confirmationToken: generateToken(tenantId, 'publish', Date.now()),
};

// In publish_draft:
const PublishDraftParams = z.object({
  confirmationToken: z.string().describe('Token from preview_draft response'),
});
```

**Pros:**

- Cryptographic proof that preview was shown first
- Harder for LLM to hallucinate valid token
- Audit trail

**Cons:**

- More complex implementation
- Requires backend changes
- Token management overhead

**Effort:** 2 hours

### Solution 3: Two-Phase Commit (Prepare + Confirm)

**Approach:** Split into `prepare_publish` (returns summary) and `confirm_publish` (executes)

```typescript
const preparePublishTool = new FunctionTool({
  name: 'prepare_publish',
  description: 'Prepare to publish - returns summary of changes for user review',
  // ...
});

const confirmPublishTool = new FunctionTool({
  name: 'confirm_publish',
  description:
    'Execute the prepared publish. Only call after user confirms the prepare_publish summary.',
  parameters: z.object({
    prepareId: z.string().describe('ID from prepare_publish response'),
  }),
  // ...
});
```

**Pros:**

- Clear separation of concerns
- Natural conversation flow
- Can show diff before publish

**Cons:**

- Two tools instead of one
- State management complexity
- May confuse LLM routing

**Effort:** 3 hours

## Recommended Action

**Implement Solution 1** immediately. It's the simplest fix that provides programmatic enforcement while matching existing patterns in the codebase.

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/storefront/src/agent.ts` (lines 182-184, 464-484)

**Related Components:**

- System prompt T3 documentation (lines 77-83)
- Concierge publish_changes tool (reference implementation)
- Backend `/storefront/publish` endpoint

**Database Schema:** No changes required

## Acceptance Criteria

- [ ] publish_draft tool has `confirmationReceived: z.boolean()` parameter
- [ ] Tool returns error with `requiresConfirmation: true` if called without confirmation
- [ ] System prompt updated to mention the required parameter
- [ ] Test: LLM calling publish_draft(confirmationReceived: false) returns error
- [ ] Test: LLM calling publish_draft(confirmationReceived: true) succeeds
- [ ] Test: Prompt injection attempting to publish without confirmation is blocked
- [ ] Document T3 enforcement pattern in agent-v2 documentation

## Work Log

| Date       | Action                          | Learnings                                       |
| ---------- | ------------------------------- | ----------------------------------------------- |
| 2026-01-19 | Issue identified in code review | T3 trust tier must be enforced programmatically |

## Resources

- **Reference Implementation:** Concierge publish_changes tool (lines 795-828)
- **Related Pattern:** T3 trust tier enforcement (CLAUDE.md pitfall #28)
- **ADK Documentation:** Tool parameter validation
- **Related Issue:** #5177 (proposal confirmation race condition)
