---
status: pending
priority: p3
issue_id: '716'
tags: [code-review, performance, react]
dependencies: []
---

# Callback Memoization Recommendations

## Problem Statement

Performance review identified callback props passed to child components that could benefit from memoization. Currently, new function references are created on each render, potentially causing unnecessary child re-renders.

## Evidence

From `useAgentChat.ts` and chat components:

```typescript
// Current: new function on each render
<MessageBubble onAction={(action) => handleAction(action)} />

// Preferred: stable reference
const handleAction = useCallback((action) => { ... }, [dependencies]);
<MessageBubble onAction={handleAction} />
```

## Impact

- **Low**: React is generally fast enough that this doesn't cause visible issues
- Only becomes problematic with:
  - Large message lists (100+)
  - Frequent re-renders from typing
  - Complex child components with expensive renders

## Recommendation

Add memoization for callbacks passed to list items:

```typescript
// Parent component
const handleConfirm = useCallback(
  (proposalId: string) => {
    confirmProposal(proposalId);
  },
  [confirmProposal]
);

const handleReject = useCallback(
  (proposalId: string) => {
    rejectProposal(proposalId);
  },
  [rejectProposal]
);
```

## Acceptance Criteria

- [ ] Identify callbacks passed to list items
- [ ] Wrap with `useCallback` where beneficial
- [ ] Profile before/after if implementing

## Resources

- Performance Oracle review: agent a40daec
- React docs: When to use useCallback
