# Section ID Lost in Agent Delegation

**Problem ID:** Pitfall #90 (candidate)
**Severity:** P1 - User-visible bug
**Date:** 2026-01-30

## Symptoms

- User says "update my about section to say X"
- Concierge shows success (✓ Tool, ✓ Storefront badges)
- Preview doesn't show the update, or wrong section is updated
- Cloud Run logs show storefront updated `home-hero-main` instead of `home-text-about`

## Root Cause

The `delegate_to_storefront` tool in concierge correctly received `sectionId` from the LLM (after the prompt fix in ec4d43ff), but **discarded it** when constructing the natural language message to storefront-agent.

**Before fix (line 1400):**

```typescript
message = `Update the ${params.pageName || 'home'} page: set the ${contentParts}`;
// sectionId: "home-text-about" was ignored!
```

**What storefront received:**

```
"Update the home page: set the content to 'I help photographers...'"
```

**What storefront did:**
Called `get_page_structure`, saw multiple sections, guessed `home-hero-main` (wrong!)

## The Fix

Include `sectionId` in the delegation message when provided:

```typescript
if (params.sectionId) {
  message = `Update section "${params.sectionId}" on the ${params.pageName || 'home'} page: set the ${contentParts}`;
} else {
  message = `Update the ${params.pageName || 'home'} page: set the ${contentParts}`;
}
```

## Debugging Steps Used

1. **Cloud Run logs** for storefront-agent showed it received generic message without sectionId
2. **Cloud Run logs** for concierge-agent showed `delegate_to_storefront` was called WITH correct sectionId
3. **Code trace** to `agent.ts:1400` revealed message construction discarded sectionId

## Prevention Pattern

When building agent-to-agent delegation:

1. **Log the full params** before constructing the message
2. **Include ALL relevant params** in the natural language message
3. **Test round-trip** - verify specialist received what orchestrator intended

## Related Files

- `server/src/agent-v2/deploy/concierge/src/agent.ts` - delegate_to_storefront tool
- `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts` - section ID mapping table

## Related Pitfalls

- Pitfall #88: Fact-to-Storefront bridge missing
- Pitfall #89: ADK deployment without .env in CI
