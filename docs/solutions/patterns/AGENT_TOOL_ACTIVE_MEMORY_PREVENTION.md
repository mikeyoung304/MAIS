---
module: MAIS
date: 2026-01-20
problem_type: anti_pattern
component: agent/tools
symptoms:
  - Agent asks redundant questions about data it just stored
  - User confusion when agent forgets context between turns
  - Agent re-reads data immediately after writing it
  - Conversation feels disconnected or repetitive
root_cause: Tools that modify state return only confirmation, not updated state
resolution_type: prevention_strategy
severity: P2
tags: [agent, tools, state-management, ux, memory, anti-pattern]
---

# Agent Tool Active Memory Prevention Strategy

**Anti-pattern:** Tools that modify state return only confirmation, not the updated state.

**Symptom:** Agent asks redundant questions about information it just stored.

---

## The Problem

When a tool modifies state but only returns a confirmation like `{ success: true }`, the agent loses awareness of what was actually stored. This creates a broken user experience:

```
User: "My business is called 'Sunrise Photography' in Seattle"
Agent: [calls update_profile({ name: "Sunrise Photography", city: "Seattle" })]
Tool returns: { success: true }
Agent: "Great! What's your business name?" <-- BROKEN: Agent forgot what it just stored
```

### Why This Happens

1. **LLM context is ephemeral**: The agent may not retain the request parameters in its working memory
2. **Tool response is the source of truth**: Agents trust tool responses more than their own context
3. **Confirmation-only responses**: `{ success: true }` tells the agent "it worked" but not "what happened"

---

## The Solution: Echo Back Updated State

**Pattern:** State-modifying tools MUST return the complete updated state, not just confirmation.

### Bad Pattern (Confirmation Only)

```typescript
// BAD: Only returns success flag
export const updateProfileTool: AgentTool = {
  name: 'update_profile',
  execute: async (context, params) => {
    await prisma.tenant.update({
      where: { id: context.tenantId },
      data: params,
    });

    return { success: true }; // Agent has no memory of what was stored
  },
};
```

### Good Pattern (Echo Updated State)

```typescript
// GOOD: Returns the updated state
export const updateProfileTool: AgentTool = {
  name: 'update_profile',
  execute: async (context, params) => {
    const updated = await prisma.tenant.update({
      where: { id: context.tenantId },
      data: params,
      select: { name: true, email: true, location: true /* relevant fields */ },
    });

    return {
      success: true,
      data: {
        profile: updated,
        // Include state indicators for agent context
        hasName: !!updated.name,
        hasLocation: !!updated.location,
      },
    };
  },
};
```

---

## Code Review Checklist

Add this to your PR review process for any agent tool:

### Agent Tool State Return Checklist

- [ ] **Echoes stored values**: Does the tool return what was actually stored, not just `success: true`?
- [ ] **Includes state indicators**: Does the response include boolean flags like `hasDraft`, `hasLocation`, `isConfigured`?
- [ ] **Returns relevant context**: Could the agent answer follow-up questions using only this response?
- [ ] **No "read after write" needed**: Can the agent proceed without immediately calling a read tool?

### Quick Verification

Search for these anti-patterns in tool responses:

```bash
# Find tools that only return success flag
grep -n "return { success: true }" server/src/agent/**/tools*.ts

# Find tools that don't return data
grep -n "return {" server/src/agent/**/tools*.ts | grep -v "data:"
```

### Questions to Ask

1. "If the agent only saw this tool response, would it know what state the system is in?"
2. "Would the agent need to call a read tool immediately after this write tool?"
3. "If the user asks 'what did you just change?', can the agent answer from this response?"

---

## Best Practice Guidance

### 1. State Indicators in Every Write Response

Include boolean indicators that guide agent behavior:

```typescript
return {
  success: true,
  data: {
    phase: 'DISCOVERY',
    summary: 'Profile updated',
    // State indicators for agent decision-making
    hasBusinessName: true,
    hasLocation: true,
    hasServices: false, // Tells agent what's missing
    isReadyForNextPhase: false,
  },
};
```

### 2. Return Full Objects, Not Just IDs

```typescript
// BAD: Agent only knows the ID
return { success: true, packageId: 'pkg_123' };

// GOOD: Agent knows the full state
return {
  success: true,
  data: {
    package: {
      id: 'pkg_123',
      name: 'Premium Session',
      priceCents: 49900,
      active: true,
    },
    totalPackages: 5,
    hasPricing: true,
  },
};
```

### 3. Include Summaries for Complex Updates

For batch operations, return a summary:

```typescript
return {
  success: true,
  data: {
    summary: 'Created 3 packages in "Photography" segment',
    segment: { id: 'seg_abc', name: 'Photography', packageCount: 3 },
    packages: [
      { id: 'pkg_1', name: 'Mini', priceCents: 19900 },
      { id: 'pkg_2', name: 'Standard', priceCents: 39900 },
      { id: 'pkg_3', name: 'Premium', priceCents: 79900 },
    ],
    // State indicators
    hasServices: true,
    isReadyForMarketing: true,
  },
};
```

### 4. Draft State Communication

For draft systems, always indicate draft status:

```typescript
return {
  success: true,
  data: {
    section: updatedSection,
    // CRITICAL: Agent must know draft state to communicate correctly
    hasDraft: true,
    draftPreviewUrl: '/t/slug?preview=draft',
    // Guides agent phrasing: "In your unpublished draft..." vs "On your live storefront..."
  },
};
```

---

## Example Test Case

This test verifies a tool returns state, not just confirmation:

```typescript
// server/src/agent/tools/__tests__/tool-active-memory.test.ts

import { describe, it, expect } from 'vitest';
import { updateOnboardingStateTool } from '../onboarding-tools';
import { createTestContext } from '../../test-utils';

describe('Agent Tool Active Memory', () => {
  describe('updateOnboardingStateTool', () => {
    it('returns updated state, not just confirmation', async () => {
      const context = createTestContext({ tenantId: 'test-tenant' });

      const result = await updateOnboardingStateTool.execute(context, {
        phase: 'DISCOVERY',
        data: {
          businessType: 'photographer',
          businessName: 'Sunrise Photography',
          location: { city: 'Seattle', state: 'WA', country: 'USA' },
          targetMarket: 'premium',
        },
      });

      // MUST return success
      expect(result.success).toBe(true);

      // MUST return data (not just success flag)
      expect(result.data).toBeDefined();

      // MUST include the phase that was set
      expect(result.data.phase).toBe('DISCOVERY');

      // MUST include a human-readable summary
      expect(result.data.summary).toContain('photographer');
      expect(result.data.summary).toContain('Seattle');

      // SHOULD include state indicators for agent decision-making
      // (Optional but recommended)
      // expect(result.data.hasBusinessInfo).toBe(true);
    });

    it('provides enough context to answer follow-up questions', async () => {
      const context = createTestContext({ tenantId: 'test-tenant' });

      const result = await updateOnboardingStateTool.execute(context, {
        phase: 'SERVICES',
        data: {
          /* ... */
        },
      });

      // Agent should be able to answer "what services did you just create?"
      // without calling another tool
      expect(result.data).toHaveProperty('summary');

      // Response should include actionable next steps
      expect(result.success).toBe(true);
    });
  });
});
```

### Generic Test Pattern

```typescript
/**
 * Generic test: All write tools should return updated state
 */
describe('Write Tools Return State', () => {
  const writeTools = [
    upsertPackageTool,
    upsertServicesTool,
    updateOnboardingStateTool,
    updateSectionTool,
    // Add all write tools here
  ];

  writeTools.forEach((tool) => {
    it(`${tool.name} returns data, not just success`, async () => {
      const context = createTestContext();
      const params = getValidParamsForTool(tool.name);

      const result = await tool.execute(context, params);

      if (result.success) {
        // Success responses MUST include data
        expect(result.data).toBeDefined();
        expect(result.data).not.toEqual({});

        // Data should be meaningful, not just an ID
        const dataKeys = Object.keys(result.data);
        expect(dataKeys.length).toBeGreaterThan(1);
      }
    });
  });
});
```

---

## Questions for Designing New Agent Tools

Before implementing a new state-modifying tool, answer these questions:

### 1. What State Does This Tool Modify?

- List every field/entity this tool can change
- Consider cascade effects (e.g., updating a segment affects its packages)

### 2. What Would the Agent Need to Know After Calling This Tool?

- What was the previous state? (Sometimes needed for context)
- What is the new state? (Always needed)
- What are the implications? (e.g., "now ready for next phase")

### 3. Could the User Ask a Follow-Up Question?

Common follow-ups to anticipate:

- "What did you just change?"
- "What's the current state now?"
- "What should I do next?"
- "Can you undo that?"

### 4. What State Indicators Help the Agent Make Decisions?

Think about branching logic:

- `hasPackages: true` -> Can proceed to pricing phase
- `hasDraft: true` -> Should mention preview URL
- `stripeConnected: false` -> Can't process payments yet

### 5. Response Design Checklist

- [ ] Returns the modified entity (not just ID)
- [ ] Includes summary string for agent to echo
- [ ] Has state indicators (boolean flags for conditions)
- [ ] Includes next-step hints if applicable
- [ ] Works for both success and partial-success cases

---

## Integration with Existing Patterns

### Relation to Trust Tiers

- **T1 (auto-confirm)**: Still return state - agent needs context for next action
- **T2 (soft confirm)**: Return proposal preview that includes what WILL change
- **T3 (hard confirm)**: Return what changed AFTER confirmation

### Relation to Proposal System

The proposal system already follows good patterns:

```typescript
// From write-tools.ts - GOOD: Returns preview of changes
return {
  success: true,
  proposalId: result.proposalId,
  operation: result.operation,
  preview: result.preview, // <-- Agent can describe what will happen
  trustTier: result.trustTier,
  requiresApproval: result.requiresApproval,
};
```

### Relation to Draft System

Storefront tools correctly include draft state:

```typescript
// From storefront agent - GOOD: Includes hasDraft indicator
return {
  ...(result.data as Record<string, unknown>),
  published: true,
  message: 'Changes are now live!',
};
```

---

## Anti-Pattern Examples from Real Code

### Example 1: Confirmation Only (Anti-Pattern)

```typescript
// ANTI-PATTERN: Only returns success
return { success: true, data: validated };
// Agent doesn't know what phase was reached or what to do next
```

### Example 2: Good Pattern in Codebase

```typescript
// GOOD PATTERN: From onboarding-tools.ts
return {
  success: true,
  data: {
    phase: targetPhase,
    summary, // Human-readable summary agent can echo
    version: appendResult.version,
  },
};
```

---

## Document Maintenance

**Last updated:** 2026-01-20
**Status:** Active - apply to all new agent tools
**Applies to:** All state-modifying agent tools (T1, T2, T3)

When implementing new tools, use this checklist. When reviewing PRs, verify tools follow these patterns. Add new examples as anti-patterns are discovered.

---

## Quick Links

| Need                   | Document                             |
| ---------------------- | ------------------------------------ |
| Full agent tools guide | AGENT_TOOLS_PREVENTION_INDEX.md      |
| Code review checklist  | AGENT_TOOLS_PEER_REVIEW_CHECKLIST.md |
| Test patterns          | AGENT_TOOL_TEST_PATTERNS.md          |
| Trust tier reference   | CLAUDE.md (Trust Tiers section)      |
