# Agent Prompt Transition Triggers Prevention

## Problem

AI agents gather discovery information but never transition to taking action. The agent knows WHAT tools are available but not WHEN to use them.

**Symptoms:**

- Agent says "Got it locked" or "Roger that" but doesn't do anything
- User asks "update my headline" → Agent asks "What do you want to update?"
- Agent describes options/packages but doesn't apply them to storefront
- Cloud Run logs show zero activity on specialist agents (Storefront, Marketing)
- Users get frustrated: "you just wrote it above, are you ok?"

## Root Cause

System prompts describe tools but lack **explicit transition triggers**:

```markdown
# BAD - Tools without triggers

### Tools Available

→ delegate_to_storefront - Create packages, update sections
→ delegate_to_research - Get market pricing data

# Agent thinks: "I have these tools... but when should I use them?"
```

LLMs need explicit **"WHEN X → DO Y"** instructions, not just tool availability.

## Solution

Add explicit transition triggers with clear conditions and mandatory tool calls:

```markdown
### ⚡ CRITICAL: Transition Triggers

These are NON-NEGOTIABLE. When conditions are met, you MUST call the tool.

**Trigger 1: Discovery → Generation**
When you have gathered:

- Business type (required)
- Location (city/state)
- At least one service or offering

→ YOU HAVE ENOUGH. Stop asking questions.
→ IMMEDIATELY call delegate_to_storefront to generate draft homepage content
→ Then show the draft: "Here's what I've got for you - what feels off?"

**Trigger 2: User Requests Update**
When user says ANY of these:

- "update my headline"
- "change the copy"
- "update the site"
- "add [service]"

→ IMMEDIATELY call delegate_to_storefront with the request
→ Do NOT respond with "I can do that" or "Great idea" first
→ Tool call MUST be your next action
```

## Key Principles

### 1. Use Action Arrows, Not Example Responses

```markdown
# BAD - LLM copies verbatim

You: "On it! Let me update that for you."

# GOOD - Clear action

→ IMMEDIATELY call delegate_to_storefront
```

### 2. Specify "Never Dead-End" Rules

```markdown
### 🚫 Never Dead-End the Conversation

EVERY response MUST include one of:

1. A tool call that takes action
2. A draft you generated → "What feels off?"
3. A specific next step → "Ready to look at packages?"

FORBIDDEN:
❌ "Got it!" (and nothing else)
❌ "I'll remember that." (without storing it)
❌ Ending with a statement instead of a question or action
```

### 3. Match User Intent Patterns

List specific phrases that trigger specific actions:

```markdown
When user says ANY of these:

- "update my headline" → delegate_to_storefront
- "what's the going rate" → delegate_to_research
- "add a package" → delegate_to_storefront
```

## Verification

### Before Fix

```bash
# Check Storefront agent logs - should be empty
gcloud logging read 'resource.labels.service_name="storefront-agent"' \
  --project=handled-484216 --limit=10 --freshness=1h
# Result: No logs (agent never called)
```

### After Fix

```bash
# Same query - should show activity
gcloud logging read 'resource.labels.service_name="storefront-agent"' \
  --project=handled-484216 --limit=10 --freshness=5m
# Result: [ADK INFO]: Sending out request, model: gemini-2.0-flash
```

## Files Modified

- `server/src/agent-v2/deploy/concierge/src/prompts/onboarding.ts` - Added transition triggers section

## Related Patterns

- [ADK A2A Prevention Index](../patterns/ADK_A2A_PREVENTION_INDEX.md)
- [Agent Tool Active Memory Prevention](../patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md)
- Pitfall #37: LLM pattern-matching prompts

## References

- Compound Engineering: `agent-native-architecture` skill
- `~/.claude/plugins/every-marketplace/plugins/compound-engineering/skills/agent-native-architecture/references/system-prompt-design.md`

---

**Date:** 2026-01-26
**Author:** Mike Young + Claude Code
**Issue:** Agent dead-ends after discovery instead of delegating to Storefront
