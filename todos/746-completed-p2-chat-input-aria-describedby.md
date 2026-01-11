---
status: completed
priority: p2
issue_id: 746
tags: [code-review, accessibility, wcag-aa, pr-27]
dependencies: []
---

# P2: Chat Input Missing aria-describedby for Screen Readers

## Problem Statement

The chat textarea lacks `aria-describedby` and `aria-label` attributes, which are important for screen reader users to understand the purpose and behavior of the input field.

**Impact:** Screen reader users may not understand the input's purpose or how to use it (Enter to send, Shift+Enter for new line).

## Findings

**Reviewer:** accessibility-expert

**Location:** `apps/web/src/components/agent/PanelAgentChat.tsx:348-365`

**WCAG Criterion:** 4.1.2 Name, Role, Value

**Current Implementation:**

```tsx
<textarea
  ref={inputRef}
  data-growth-assistant-input
  data-testid="agent-input"
  value={inputValue}
  placeholder="Type a message..."
  // Missing: aria-describedby, aria-label
/>
```

## Proposed Solutions

### Solution A: Add aria-label and aria-describedby (Recommended)

- **Pros:** Full accessibility, helps all screen reader users
- **Cons:** Minor DOM addition
- **Effort:** Small (10 minutes)
- **Risk:** Low

```tsx
<div className="px-4 py-3 border-t border-neutral-700 bg-surface-alt">
  <span id="input-description" className="sr-only">
    Type your message to the AI assistant. Press Enter to send, or Shift+Enter for a new line.
  </span>
  <div className="flex gap-2">
    <textarea
      ref={inputRef}
      aria-describedby="input-description"
      aria-label="Chat message input"
      placeholder="Type a message..."
      // ... rest of props
    />
```

## Recommended Action

Solution A - Add visually hidden description with aria-describedby.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/PanelAgentChat.tsx` (lines 348-365)

## Acceptance Criteria

- [x] Input has `aria-label="Chat message input"`
- [x] Visually hidden description element added with instructions
- [x] Input has `aria-describedby` pointing to description
- [x] Screen reader testing confirms announcement

## Work Log

| Date       | Action    | Notes                                                           |
| ---------- | --------- | --------------------------------------------------------------- |
| 2026-01-11 | Created   | From PR #27 multi-agent review                                  |
| 2026-01-11 | Completed | Added aria-describedby with hidden description for chat input ✓ |

## Resources

- PR #27: https://github.com/mikeyoung304/MAIS/pull/27
- WCAG 4.1.2: https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html
