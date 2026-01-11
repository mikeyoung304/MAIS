# P1 RESOLVED: Trust Tier Mismatch in Storefront Tools

**Priority:** P1 - CRITICAL (Blocking paintbrush feature)
**Status:** Resolved
**Source:** Architecture Review (multi-agent parallel review)
**Date:** 2026-01-11

## Problem

Tools in `storefront-tools.ts` declare `trustTier: 'T1'` but pass `'T2'` to `createProposal()`. This causes proposals to be created with status `PENDING` instead of `CONFIRMED`, meaning:

1. T1 tools should auto-execute without confirmation
2. But T2 proposals require soft-confirm (another message) before execution
3. Result: Agent tool runs, proposal created as PENDING, no database write occurs
4. Frontend invalidates cache but there's nothing new to fetch

## Root Cause

The mismatch exists in multiple tools:

```typescript
// server/src/agent/tools/storefront-tools.ts

// Tool declares T1
{
  name: 'update_page_section',
  trustTier: 'T1',  // ← Claims T1
}

// But passes T2 to createProposal
const proposal = await createProposal({
  trustTier: 'T2',  // ← Actually creates T2 proposal!
});
```

## Affected Lines

- Line 284: `update_page_section`
- Line 303: Another tool instance
- Line 407: `remove_page_section`
- Line 661: Another tool instance
- Line 736-743: `update_storefront_branding`

## Fix Applied

Changed `'T2'` to `'T1'` at all affected lines to match tool declarations.

## Verification

1. Speak to agent: "Update my hero headline to 'Welcome!'"
2. Tool executes immediately (no need for second message)
3. Preview refreshes and shows the change

## Prevention Strategy

Add validation in `createProposal()` to verify the passed tier matches the tool's declared tier.

## Related

- docs/solutions/patterns/chatbot-proposal-execution-flow-MAIS-20251229.md
- docs/solutions/methodology/multi-agent-parallel-code-review-workflow-MAIS-20260109.md
