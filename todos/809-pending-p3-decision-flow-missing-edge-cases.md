---
status: pending
priority: p3
issue_id: 809
tags: [code-review, agent, prompt-engineering]
dependencies: []
---

# Decision Flow Missing Edge Cases

## Problem Statement

The Decision Flow (lines 438-512) doesn't cover several common user interaction patterns, leading to undefined agent behavior.

## Findings

**From Code-Philosopher agent:**

**Missing edge cases:**

1. **User provides partial info + asks question simultaneously**
   - Example: "I'm a wedding photographer in Austin. What should my headline say?"
   - No guidance: answer first or update first?

2. **User contradicts previous fact**
   - Example: First says "I do weddings", later says "Actually I only do portraits"
   - No guidance on updating/correcting stored facts

3. **User asks meta-questions about the agent**
   - Example: "What can you do?", "Are you AI?"
   - No handling specified

4. **User provides testimonial WITH attribution**
   - Example: "Sarah said 'Amazing photographer!' - she's a bride from last year"
   - No guidance on storing attribution

5. **User says "skip that" or "later" during onboarding**
   - Example: "I'll add testimonials later"
   - No guidance on tracking skipped sections

## Proposed Solutions

### Option A: Add Edge Cases to Decision Flow (Recommended)

**Pros:** Clearer agent behavior
**Cons:** Makes decision flow longer (offset by consolidation)
**Effort:** Small (20 minutes)
**Risk:** Low

Add branches:

```
├─ User provides INFO + asks QUESTION in same message?
│  → Answer question first, THEN store fact + update section

├─ User CONTRADICTS previous info?
│  → Update stored fact, don't ask "are you sure?"
│  → "Got it, portraits only. I'll update that."

├─ User says "skip" or "later" for a section?
│  → Mark as skipped, move to next
│  → "No problem. We can circle back."
```

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` (lines 438-512)

## Acceptance Criteria

- [ ] All common interaction patterns are covered
- [ ] Agent handles contradictions gracefully
- [ ] Agent can skip sections on user request

## Work Log

| Date       | Action                          | Learnings                           |
| ---------- | ------------------------------- | ----------------------------------- |
| 2026-01-31 | Identified during prompt review | Several common patterns not covered |

## Resources

- Code-Philosopher findings
