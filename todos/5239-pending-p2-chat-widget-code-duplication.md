---
status: pending
priority: p2
issue_id: '5239'
tags: [code-review, quality, frontend, dry]
dependencies: []
created_at: 2026-01-21
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

## Proposed Solution

Extract shared components:

```typescript
// Shared sub-components
const ChatHeader = ({ businessName, onClose, showClose }: ChatHeaderProps) => ( ... );
const ChatMessages = ({ messages, isLoading }: ChatMessagesProps) => ( ... );
const ChatInput = ({ value, onChange, onSubmit, disabled }: ChatInputProps) => ( ... );
const TypingIndicator = () => ( ... );

// Both modes compose shared components
const InlineChat = () => (
  <div className="inline-container">
    <ChatHeader businessName={businessName} showClose={false} />
    <ChatMessages messages={messages} isLoading={isLoading} />
    <ChatInput ... />
  </div>
);

const FloatingChat = () => (
  <div className="floating-container">
    <ChatHeader businessName={businessName} onClose={() => setIsOpen(false)} showClose />
    <ChatMessages messages={messages} isLoading={isLoading} />
    <ChatInput ... />
  </div>
);
```

**Effort:** Medium (1-2 hours)
**Risk:** Low

## Resources

- PR: https://github.com/mikeyoung304/MAIS/pull/31
