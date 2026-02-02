---
status: ready
priority: p1
issue_id: 812
tags: [code-review, agent, ux, trust, brand-voice]
dependencies: []
implemented: 2026-02-01
---

# False Confirmation Feedback - Agent Says "Done" When Nothing Visible Changed

## Problem Statement

The tenant-agent claims success ("Done. Take a look" with Storefront ✓ indicators) even when the user cannot see any change. This breaks trust with the core HANDLED value proposition: "The rest is Handled" implies reliable, visible results.

**Why it matters:**

- User refreshes and sees no change → thinks product is broken
- Repeated false confirmations erode trust completely
- Photographers tell peers "The AI doesn't actually do anything"
- Violates pitfall #52: Tools must return updated state, not just `{success: true}`

## Findings

**From UX Agent:**

> The agent violates the primary trust signal of HANDLED. Until the agent can only say "Done" when the user can see the change, photographers will experience the contradiction: **AI that talks like it's helping but feels like it's not.**

**From Failure Report:**

```
11:40:32.507 - Calling tool update_section with sectionId: home-pricing-1769964011041
11:40:32.783 - Tool result: success: true, Section updated in draft
```

Agent received `success: true` and confidently reported "Done" - but the change was to a DRAFT text section, not the visible Services section showing packages.

**Root Cause Chain:**

1. User asks about "packages" → agent interprets as "pricing section"
2. Agent calls `update_section()` → tool returns `{ success: true, hasDraft: true }`
3. Agent says "Done. Take a look" based on success flag
4. But: preview iframe shows PUBLISHED content, not draft
5. AND: Services section comes from Package table, not landingPageConfig
6. Result: Nothing visible changed, user confused

## Proposed Solutions

### Option A: Verification Before Confirmation (Recommended)

**Pros:**

- Agent only claims success when state actually changed
- Works for all tools, not just specific cases
- Follows pitfall #52 pattern

**Cons:**

- Requires refetching state after write
- Slight latency increase (~100ms)

**Effort:** Medium (2-3 hours)
**Risk:** Low

**Implementation pattern:**

```typescript
// Tool execute function
const result = await callMaisApi('/update-section', tenantId, params);
if (!result.ok) {
  return { success: false, error: result.error };
}

// CRITICAL: Verify state actually changed
const verification = await callMaisApi('/get-section', tenantId, { sectionId: params.sectionId });
if (!verification.ok || verification.data.content !== params.content) {
  return { success: false, error: 'Update could not be verified. Please try again.' };
}

return {
  success: true,
  hasDraft: true,
  updatedSection: verification.data,
  message: 'Section updated in draft. Publish to make it live.',
};
```

### Option B: Semantic Clarification in Response

**Pros:**

- Quick fix, no backend changes
- Agent clarifies what actually happened

**Cons:**

- Doesn't prevent the mismatch, just explains it
- User still confused about draft vs published

**Effort:** Small (30 minutes)
**Risk:** Medium (still misleading)

Modify agent system prompt to include draft state in confirmations:

- "Done. Updated in draft - publish to make it live."
- "Done. Note: this updates the pricing TEXT section, not your bookable packages."

### Option C: Pre-Execution Semantic Validation

**Pros:**

- Catches mismatches before they happen
- Better UX - agent asks clarifying question

**Cons:**

- More complex tool logic
- May slow down simple requests

**Effort:** Medium (2-3 hours)
**Risk:** Low

Add pre-check: If user mentions "package" or "service pricing" but tool is `update_section`:

```typescript
if (params.intent?.includes('package') && toolName === 'update_section') {
  return {
    success: false,
    clarification_needed: true,
    message: 'Did you mean bookable packages (use manage_packages) or the pricing text section?',
  };
}
```

## Recommended Action

Implement Option A + Option B together:

1. Add verification fetch after all write operations
2. Update agent system prompt to clarify draft vs published
3. Include state indicators in all tool responses

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/tools/storefront-write.ts` - Add verification
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` - Clarify draft behavior
- All write tools should return `{ success, hasDraft, updatedState, message }`

**Brand voice alignment:**

Per VOICE_QUICK_REFERENCE.md:

- Confirmations: `done | got it | on it | heard` (tenant)
- But: "Do → Report → Offer next step. No preambles."

The problem is step 2 (Report) is inaccurate. Fix by making Report reflect actual state:

- "Done. Updated in draft." (not "Done. Take a look." if nothing visible changed)
- "Publish to go live?" (offer next step)

## Acceptance Criteria

- [x] Write tools verify state after mutation before claiming success
- [x] Tool responses include `hasDraft` and `updatedState` indicators
- [x] Agent differentiates "updated in draft" from "live and visible"
- [x] Agent offers "Publish?" when changes are in draft
- [ ] No false "Done. Take a look." messages when preview shows unchanged content (needs E2E verification)

## Work Log

| Date       | Action                             | Learnings                                                             |
| ---------- | ---------------------------------- | --------------------------------------------------------------------- |
| 2026-02-01 | E2E testing revealed trust gap     | "Done" without verification breaks user trust                         |
| 2026-02-01 | UX agent analysis                  | Core brand promise ("Handled") requires reliable feedback             |
| 2026-02-01 | Implemented Option A+B fix         | update_section now calls verify after write, returns visibility field |
| 2026-02-01 | Updated all storefront-write tools | add_section, remove_section, reorder_sections all return visibility   |
| 2026-02-01 | Updated system prompt              | Added VISIBILITY RULE table showing what to say after updates         |

## Resources

- [Failure Report](docs/reports/2026-02-01-agent-testing-failure-report.md) - Failure #4
- [CLAUDE.md Pitfall #52](CLAUDE.md) - Tool confirmation-only response
- [VOICE_QUICK_REFERENCE.md](docs/design/VOICE_QUICK_REFERENCE.md) - Brand voice rules
- [AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md](docs/solutions/patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md)
