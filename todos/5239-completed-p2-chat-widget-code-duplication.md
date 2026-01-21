---
status: completed
priority: p2
issue_id: '5239'
tags: [code-review, quality, frontend, dry]
dependencies: []
created_at: 2026-01-21
completed_at: 2026-01-21
pr: 31
---

# P2: Massive Code Duplication in Chat Widget (80% Shared Code)

> **Code Simplicity Review:** Inline and floating layouts share 80% identical code.

## Problem Statement

The `ProjectHubChatWidget` has inline and floating mode layouts that share approximately 80% identical code:

- Both have identical Header sections (lines 233-247 vs 383-407)
- Both have identical Messages sections (lines 250-307 vs 410-468)
- Both have identical Input sections (lines 311-343 vs 471-502)
- Both have identical typing indicators with the same 3-dot animation

**File:** `apps/web/src/components/chat/ProjectHubChatWidget.tsx`
**Lines:** 224-344 (inline mode) and 371-504 (floating mode)

**Impact:** Any bug fix or styling change must be made in two places, doubling maintenance burden and risk of drift.

## Solution Implemented

Extracted 6 shared sub-components with proper TypeScript interfaces and React.memo optimization:

1. **ChatHeader** - Business name display with optional close button
2. **TypingIndicator** - Animated 3-dot typing animation
3. **ErrorDisplay** - Error message display
4. **LoadingState** - Chat initialization loading state
5. **ChatMessages** - Messages container composing the above
6. **ChatInput** - Input textarea with send button

Both inline and floating layouts now compose these shared components:

```typescript
// Inline layout (lines 466-480)
if (inline) {
  return (
    <div className="inline-container">
      <ChatHeader businessName={businessName} primaryColor={primaryColor} />
      <ChatMessages {...chatMessagesProps} />
      <ChatInput {...chatInputProps} />
    </div>
  );
}

// Floating layout (lines 505-527)
return (
  <div className="floating-container">
    <ChatHeader ... onClose={() => setIsOpen(false)} showClose />
    <ChatMessages {...chatMessagesProps} />
    <ChatInput {...chatInputProps} />
  </div>
);
```

**Result:**

- Eliminated ~120 lines of duplicated code
- Single source of truth for Header, Messages, Input, TypingIndicator, Error, and Loading UI
- TypeScript passes with `npm run --workspace=apps/web typecheck`

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
