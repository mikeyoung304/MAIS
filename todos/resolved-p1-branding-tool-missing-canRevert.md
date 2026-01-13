---
status: resolved
priority: p1
triage_date: '2026-01-12'
triage_by: master-architect-triage
verified: true
effort: 15min
resolved_date: '2026-01-12'
resolved_by: claude-code
commit: f033e3b5
---

# P1: Missing `canRevert` State Indicator in Branding Tool Response

**Source:** Code Review - Agent System
**PR:** #28 feat/agent-system-integrity-fixes
**Date:** 2026-01-12
**Reviewer:** agent-system-specialist

## Issue

The `revert_branding` tool does NOT check if there's actually a previous state available BEFORE creating the proposal. It creates a proposal and then the executor handles the error case.

## Location

- `server/src/agent/tools/storefront-tools.ts:791-824`

## Impact

The agent may invoke `revert_branding` when no previous state exists, causing a failed execution that confuses users. The tool should provide upfront feedback about whether revert is available rather than creating proposals that fail at execution.

## Recommended Fix

Add a pre-check in `revert_branding` tool's execute function to return a helpful error BEFORE creating a proposal:

```typescript
// In revert_branding tool execute function (lines 791-824)
async execute(context: ToolContext, _params: Record<string, unknown>): Promise<AgentToolResult> {
  const { tenantId, prisma } = context;

  try {
    // Pre-check: Does previous branding exist?
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { branding: true, slug: true },
    });

    const branding = (tenant?.branding as Record<string, unknown>) || {};
    const history = branding._previousBranding as Array<unknown>;

    // Return early with helpful message instead of creating proposal
    if (!history || history.length === 0) {
      return {
        success: false,
        error: 'No previous branding to revert to. No changes have been made recently.',
        canRevert: false,  // State indicator for agent
      };
    }

    // Check TTL before creating proposal
    const previous = history[0] as { timestamp?: number };
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    if (previous.timestamp && Date.now() - previous.timestamp > TWENTY_FOUR_HOURS_MS) {
      return {
        success: false,
        error: 'Previous branding state has expired (24-hour window passed).',
        canRevert: false,
      };
    }

    // ... continue with proposal creation
  }
}
```

## Severity Justification

P1 because it affects agent behavior predictability and user experience - failed proposals create confusion.
