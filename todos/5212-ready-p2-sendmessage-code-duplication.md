---
status: ready
priority: p2
issue_id: '5212'
tags: [code-review, quality, dry, guided-refinement]
dependencies: [5211]
---

# P2: Code Duplication - sendMessage vs sendProgrammaticMessage

## Problem Statement

The `sendMessage` and `sendProgrammaticMessage` functions in `useConciergeChat.ts` share ~80% identical code (82 duplicated lines). This violates DRY principles and increases maintenance burden.

**Why it matters:** Bug fixes or feature changes must be applied twice, increasing risk of inconsistency.

## Findings

**Source:** Code Quality Reviewer + Code Simplicity Reviewer

**Location:** `apps/web/src/hooks/useConciergeChat.ts:314-406 vs 412-495`

**Identical logic:**

- User message creation
- API fetch call
- Version handling
- Tool calls extraction
- Dashboard actions handling
- Error handling

**Only differences:**

1. `sendMessage` reads from `inputValue` and clears it
2. `sendProgrammaticMessage` takes message as parameter
3. `sendMessage` focuses the input at the end

## Proposed Solutions

### Option A: Extract Common Helper (Recommended)

**Approach:** Create internal `sendMessageCore` function

```typescript
const sendMessageCore = useCallback(
  async (message: string) => {
    if (!message.trim() || isLoading || !sessionId) return;

    // Track first message
    if (!hasSentFirstMessage) {
      setHasSentFirstMessage(true);
      onFirstMessage?.();
    }

    setError(null);
    setIsLoading(true);

    // Add user message optimistically
    const userMessage: ConciergeMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId, version }),
      });

      // ... rest of shared logic
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  },
  [
    /* shared deps */
  ]
);

const sendMessage = useCallback(async () => {
  const message = inputValue.trim();
  if (!message) return;
  setInputValue('');
  await sendMessageCore(message);
  inputRef.current?.focus();
}, [inputValue, sendMessageCore]);

const sendProgrammaticMessage = sendMessageCore;
```

**Pros:** Single source of truth, easier maintenance
**Cons:** Slightly more complex hook structure
**Effort:** Small (30-45 minutes)
**Risk:** Very Low

## Recommended Action

**APPROVED: Option A - Extract sendMessageCore helper**

Create internal `sendMessageCore(message: string)` with all shared logic. `sendMessage` clears input and focuses. `sendProgrammaticMessage` is alias to core.

**Triaged:** 2026-02-04 | **Decision:** Fix | **Rationale:** DRY principle, single source of truth for bug fixes

## Technical Details

**Affected Files:**

- `apps/web/src/hooks/useConciergeChat.ts`

**Testing:**

- Existing tests should still pass
- Verify both sendMessage and sendProgrammaticMessage behave identically

## Acceptance Criteria

- [ ] Common logic extracted to `sendMessageCore`
- [ ] `sendMessage` delegates to core + handles input
- [ ] `sendProgrammaticMessage` is alias to core
- [ ] All existing behavior preserved
- [ ] TypeScript build passes

## Work Log

| Date       | Action                   | Learnings                                           |
| ---------- | ------------------------ | --------------------------------------------------- |
| 2026-02-04 | Created from code review | Identified by code-quality and simplicity reviewers |

## Resources

- PR: Guided Refinement Integration
