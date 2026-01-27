# Fact-to-Storefront Bridge: Prevention Strategy

**Problem ID:** Agent stores discovery facts but fails to apply them to storefront
**Severity:** High - Breaks onboarding flow, destroys user trust
**Date Documented:** 2026-01-27
**Related Pitfalls:** #52 (Tool confirmation-only response)

## The Problem

During onboarding, the concierge agent correctly extracts and stores business facts via `store_discovery_fact`, but fails to translate those facts into actual storefront changes via `delegate_to_storefront`.

### Symptom Pattern

```
User: "My about section should mention I was valedictorian and I value calm execution"

Agent (WRONG behavior):
1. ✓ Calls store_discovery_fact(key: "uniqueValue", value: "valedictorian...")
2. ✗ Does NOT call delegate_to_storefront
3. ✗ Asks "What kind of students do you target?" (info already provided)
4. ✗ Later claims "I added a text section" without any tool call
```

### Evidence from Cloud Run Logs

- `store_discovery_fact` calls appear for `uniqueValue`, `location`, `businessType`
- `delegate_to_storefront` calls are **absent**
- `storefront-agent` shows **0 req/sec** - never invoked

## Root Cause

The agent's system prompt had separate instructions for:

1. Storing facts when learned
2. Updating storefront when explicitly requested

But **no bridge** connecting these actions when user provides section-specific content:

- "My about section should mention X" = BOTH a fact AND an update request
- Agent only did the first part (store) and forgot the second (apply)

## The Fix

Added "FACT-TO-STOREFRONT BRIDGE" section to both:

- `server/src/agent-v2/deploy/concierge/src/agent.ts` (main system prompt)
- `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts` (onboarding prompt)

### Key Rule

When user mentions a SECTION + CONTENT for that section:

1. Call `store_discovery_fact` to remember the content
2. **IMMEDIATELY** call `delegate_to_storefront` to APPLY it
3. **BOTH calls in the same response**

### Section-Specific Triggers

```
- "my about section should mention [X]" → store fact + update about section
- "the about section should say [X]" → store fact + update about section
- "for the about, put [X]" → store fact + update about section
- "headline should be [X]" → store fact + update hero headline
- "my bio is [X]" → store fact + update about section
- "services should include [X]" → store fact + add service
```

### Correct Example

User: "My about section should mention that I was valedictorian and I value calm execution"

Agent response MUST include TWO tool calls:

```
1. store_discovery_fact(key: "uniqueValue", value: "valedictorian who values calm execution")
2. delegate_to_storefront(task: "update_section", pageName: "about", content: {...})
```

Then respond: "Updated your about section. Check the preview!"

## Detection Checklist

When reviewing agent conversations for this issue:

- [ ] User mentioned a specific section (about, hero, services, etc.)
- [ ] User provided content for that section
- [ ] Agent called `store_discovery_fact`
- [ ] Agent **also** called `delegate_to_storefront` in the same turn
- [ ] Agent confirmed what was changed (not just "Done!")

## Prevention Rules Added

### In Main System Prompt (agent.ts)

```
**If you stored a fact without updating the storefront, you did NOT complete the request.**
```

### In Onboarding Prompt (onboarding.ts)

```
**Trigger 2b: User Provides Section-Specific Content**
→ This is BOTH a fact AND an update request
→ Call store_discovery_fact to save it
→ IMMEDIATELY call delegate_to_storefront to apply it
→ BOTH tools in the same turn

### Never Do
- Store a fact about a section without ALSO updating that section
- Ask "what else?" after user explicitly said what a section should contain
```

## Test Cases to Add

```typescript
describe('Fact-to-Storefront Bridge', () => {
  it('should update about section when user provides about content', async () => {
    const response = await sendMessage(
      'My about section should mention I was valedictorian and I value calm execution'
    );

    // Verify store_discovery_fact was called
    expect(toolCalls).toContainEqual(expect.objectContaining({ name: 'store_discovery_fact' }));

    // Verify delegate_to_storefront was ALSO called
    expect(toolCalls).toContainEqual(
      expect.objectContaining({
        name: 'delegate_to_storefront',
        args: expect.objectContaining({ task: 'update_section' }),
      })
    );
  });

  it('should not ask follow-up questions after section content provided', async () => {
    const response = await sendMessage('My about section should mention I was valedictorian');

    // Response should confirm the update, not ask more questions
    expect(response.text).not.toMatch(/what kind of|tell me more|what else/i);
    expect(response.text).toMatch(/updated|check.*preview|see.*right/i);
  });
});
```

## Related Documentation

- [AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md](../patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md) - Tool state return patterns
- [ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](../patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md) - Agent development checklist
- [SUCCESS_VERIFICATION_RULE.md](../patterns/SUCCESS_VERIFICATION_RULE.md) - Never claim success without tool verification

## Files Modified

| File                                                             | Change                                  |
| ---------------------------------------------------------------- | --------------------------------------- |
| `server/src/agent-v2/deploy/concierge/src/agent.ts`              | Added FACT-TO-STOREFRONT BRIDGE section |
| `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts` | Added Trigger 2b, updated Never Do list |

## Deployment

After merging, agents auto-deploy via GitHub Actions. Verify deployment:

1. Check GitHub Actions → "Deploy AI Agents to Cloud Run"
2. Verify `concierge-agent` shows recent deployment timestamp
3. Test with: "My about section should mention I was a valedictorian"
