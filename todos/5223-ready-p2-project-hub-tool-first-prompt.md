---
status: ready
priority: p2
issue_id: '5223'
tags: [agent-native, agent-v2, project-hub, code-review, prompt]
dependencies: []
---

# Project Hub: Missing Tool-First Protocol in System Prompt

## Problem Statement

Project Hub's system prompt lacks the explicit "Tool-First Protocol" section that Concierge has. This can cause the agent to acknowledge requests without actually executing tools - the LLM might say "I'll check on that" without calling `getProjectStatus`.

**Impact:** Poor user experience - agent appears to be working but doesn't actually fetch/modify data.

## Findings

### Agent-Native Reviewer

**Project Hub current prompt (lines 42-117):**

- Describes behaviors and mediation logic
- Does NOT include mandatory tool-first section
- No explicit "MUST call tool BEFORE responding"

**Concierge reference (lines 200-250):**

```
## CRITICAL: Tool-First Protocol

IMPORTANT: You MUST call the appropriate tool BEFORE responding with text.
Never acknowledge a request without actually executing it via tool call.

## What You Must NEVER Do

❌ Say "On it" or "Working on it" before calling a tool
❌ Acknowledge a request without executing the tool
❌ Respond with placeholder text like "Check the preview"
❌ Fabricate content without calling the appropriate tool
```

## Proposed Solutions

### Option A: Add Tool-First Section (Recommended)

Add to Project Hub system prompt:

```
## CRITICAL: Tool-First Protocol

You MUST call the appropriate tool BEFORE responding to any action request.

### For Project Status Requests
1. IMMEDIATELY call get_project_status
2. WAIT for tool result
3. THEN respond with actual status

### For Prep Questions
1. IMMEDIATELY call answer_prep_question or get_prep_checklist
2. WAIT for tool result
3. THEN respond with actual information

### For Requests/Escalations
1. IMMEDIATELY call submit_request
2. WAIT for tool result
3. THEN confirm submission with details

## What You Must NEVER Do

❌ Say "Let me check on that" without calling a tool
❌ Acknowledge a request without executing
❌ Fabricate project information
❌ Guess at prep instructions
```

**Pros:** Clear guidance, matches Concierge pattern
**Cons:** Longer prompt, more tokens
**Effort:** Small (30 minutes)
**Risk:** Very low

## Recommended Action

**Option A** - Add the Tool-First Protocol section.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts` (lines 42-117)

**Insert Location:**
After the mediation logic section, before Trust Tier Behaviors.

## Acceptance Criteria

- [ ] Tool-First Protocol section added to system prompt
- [ ] Lists specific tools for each request type
- [ ] Includes "What You Must NEVER Do" section
- [ ] Manual test: agent calls tools before responding

## Work Log

| Date       | Action                               | Result                              |
| ---------- | ------------------------------------ | ----------------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by Agent-Native reviewer |

## Resources

- [Concierge System Prompt](server/src/agent-v2/deploy/concierge/src/agent.ts:200-250)
- [CLAUDE.md Pitfall #37](CLAUDE.md) - LLM pattern-matching prompts
