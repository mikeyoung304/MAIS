---
status: complete
priority: p2
issue_id: '675'
tags:
  - code-review
  - build-mode
  - ux
  - agent-native
dependencies: []
---

# Duplicate Chip Systems Without Clear Precedence

## Problem Statement

Build Mode has TWO competing chip systems that display simultaneously:

1. **Static chips** (always visible): "Edit headline", "Add section", "Edit text", "Images", "Testimonials"
2. **Dynamic quick replies** (from agent): Parsed from `[Quick Replies: ...]` in messages

Both appear at the same time without visual hierarchy or precedence rules, creating UX confusion and undermining the agent-native design principle that "the agent IS the interface."

**Why it matters:** Users get mixed signals. When agent suggests `[Quick Replies: Preview | Publish | Make changes]` but static chips still show generic actions, it's unclear which suggestions are contextually relevant.

## Findings

**Static chips location:** `apps/web/src/components/build-mode/BuildModeChat.tsx` (lines 123-153)

- Always visible
- Generic prompts not tied to current conversation
- User can click but agent cannot highlight/suggest specific chip

**Dynamic quick replies location:** `apps/web/src/components/agent/QuickReplyChips.tsx`

- Only appear when agent includes `[Quick Replies: ...]`
- Contextual to conversation
- Disappear when agent doesn't suggest them

**Agent-Native Issue:** The agent can say "Click the Edit headline chip" but cannot make the UI highlight that chip. This breaks action parity (user can do it, agent cannot).

## Proposed Solutions

### Option 1: Hide Static Chips When Agent Provides Quick Replies

When the last agent message has quick replies, hide static chips to give precedence to agent suggestions.

```typescript
{!quickReplies.length && (
  <div className="quick-actions">
    <QuickActionChip ... />
  </div>
)}
```

**Pros:**

- Agent takes control of suggestions
- Reduces visual clutter
- Maintains static chips as fallback

**Cons:**

- Static chips disappear unpredictably
- May confuse users who expect them

**Effort:** Small (30 min)
**Risk:** Low

---

### Option 2: Visual Differentiation

Keep both but clearly label them:

- Static chips: "Common actions:"
- Dynamic chips: "Suggested:" (with subtle highlight)

**Pros:**

- Both systems coexist
- Clear user mental model

**Cons:**

- Still visual competition
- More UI elements

**Effort:** Small (30 min)
**Risk:** Low

---

### Option 3: Remove Static Chips Entirely (Agent-Native Purist)

Trust the agent to always provide contextual suggestions via `[Quick Replies: ...]`.

**Pros:**

- Pure agent-native design
- Agent has full control
- Simpler code

**Cons:**

- If agent forgets quick replies, no suggestions visible
- Requires reliable prompt engineering

**Effort:** Small (15 min)
**Risk:** Medium (depends on prompt reliability)

---

### Option 4: Add `[suggest-chip headline]` Marker

Allow agent to highlight specific static chips, adding action parity.

**Pros:**

- Agent gains control over static chips
- Full action parity achieved

**Cons:**

- More parsing complexity
- Another marker format to maintain

**Effort:** Medium (2 hours)
**Risk:** Low

## Recommended Action

**Option 1** for now (hide static when agent provides dynamic). Consider **Option 4** as a future enhancement for full action parity.

## Technical Details

**Affected Files:**

- `apps/web/src/components/build-mode/BuildModeChat.tsx`

## Acceptance Criteria

- [ ] Clear visual hierarchy between chip systems
- [ ] No UX confusion about which suggestions to follow
- [ ] Agent suggestions take precedence when provided

## Work Log

| Date       | Action                   | Learnings                     |
| ---------- | ------------------------ | ----------------------------- |
| 2026-01-09 | Created from code review | Agent-Native reviewer flagged |
