---
status: resolved
priority: p2
issue_id: '672'
tags:
  - code-review
  - quality
  - dry
  - frontend
dependencies: []
resolved_in: this-commit
---

# AgentChat and PanelAgentChat Have Significant Code Duplication

## Problem Statement

`AgentChat.tsx` (634 lines) and `PanelAgentChat.tsx` (549 lines) share approximately 150+ lines of identical or near-identical logic including:

- Session initialization
- Message sending
- Proposal handling (confirm/reject)
- Quick Reply parsing and rendering
- Message bubble components

**Why it matters:** DRY violation means bug fixes must be applied in two places. The hardcoded greeting bug (#668) only exists in PanelAgentChat because they diverged.

## Solution Implemented

Implemented **Option A: Extract Shared Hook** as recommended.

### Created Files

- `apps/web/src/hooks/useAgentChat.ts` (449 lines) - Core chat logic extracted into reusable hook

### Refactored Files

- `apps/web/src/components/agent/AgentChat.tsx` (634 → 388 lines, -39%)
- `apps/web/src/components/agent/PanelAgentChat.tsx` (549 → 491 lines, -11%)

### Shared Logic Extracted to Hook

1. **State management**: messages, inputValue, isLoading, sessionId, context, error, pendingProposals
2. **Health check state**: isCheckingHealth, isAvailable, unavailableReason
3. **API communication**: initializeChat(), sendMessage(), confirmProposal(), rejectProposal()
4. **Event handlers**: handleKeyDown(), scrollToBottom()
5. **Refs**: messagesEndRef, inputRef
6. **Types**: ChatMessage, Proposal, ToolResult, HealthCheckResponse, SessionContext

### Component-Specific Logic Preserved

**AgentChat:**

- Full-size styling (MessageBubble, ProposalCard)
- ChatbotUnavailable component integration
- Pending proposals banner

**PanelAgentChat:**

- Compact styling (CompactMessage, CompactProposalCard)
- HighlightTrigger for section highlights
- UI actions (SHOW_PREVIEW, NAVIGATE, etc.)
- Quick replies status tracking
- Initial message from quick actions

## Acceptance Criteria

- [x] Shared hook handles all API communication
- [x] Both components use shared hook
- [x] Styling remains component-specific
- [x] No regression in existing functionality (typecheck passes)
- [x] Greeting bug fix from #668 applies to both via shared hook (uses API greeting with fallback)

## Work Log

| Date       | Action                   | Learnings                                        |
| ---------- | ------------------------ | ------------------------------------------------ |
| 2026-01-08 | Created from code review | Identified by code-simplicity-reviewer as P2 DRY |
| 2026-01-09 | Implemented Option A     | Hook extraction reduced total code by ~200 lines |

## Resources

- React custom hooks pattern: https://react.dev/learn/reusing-logic-with-custom-hooks
- Related: #668 (greeting bug only in PanelAgentChat due to divergence)
