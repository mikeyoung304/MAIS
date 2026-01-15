---
problem_type: logic-errors
component: proposal-service
severity: P2
tags: [t2-proposals, nlp, false-positives, user-experience]
root_cause: Overly broad keyword matching rejected legitimate user messages
solution: Contextual regex patterns with positional anchors
created: 2026-01-01
project: MAIS
related_issues: ['#537']
---

# Contextual Rejection Patterns for T2 Proposals

## Problem Statement

T2 proposals use "soft confirm" - they auto-confirm when the user sends their next message, UNLESS that message contains rejection keywords. The original implementation used simple keyword matching:

```typescript
// BEFORE: Too broad
const rejectionKeywords = ['wait', 'stop', 'no', 'actually', 'cancel', 'hold'];
const isRejection = rejectionKeywords.some((kw) => normalizedMessage.toLowerCase().includes(kw));
```

**Symptom:** Legitimate messages incorrectly rejected proposals:

- "No, I don't have any other questions" → REJECTED (should confirm)
- "Actually, that looks great!" → REJECTED (should confirm)
- "Can you hold on to this info?" → REJECTED (should confirm)

**Root Cause:** Context-free keyword matching ignores user intent.

## Working Solution

### Contextual Regex Patterns

```typescript
// AFTER: Context-aware patterns
const rejectionPatterns = [
  // Strong rejections at START of message
  /^(wait|stop|hold|cancel|no,?\s*(don'?t|cancel|stop|wait))/i,

  // Explicit cancel/stop with object anywhere
  /\b(cancel\s+(that|this|it|the)|stop\s+(that|this|it|the))\b/i,

  // "Hold on" as a phrase
  /\bhold\s+on\b/i,

  // "Wait, don't/stop/cancel"
  /\bwait,?\s*(don'?t|stop|cancel)/i,

  // Explicit "don't do X" patterns
  /\bdon'?t\s+(do|proceed|continue|make|create)\b/i,
];

// Short standalone rejection (only if message is very short)
const shortRejection = /^(no|stop|wait|cancel|hold)\.?!?$/i;
const isShortRejection = shortRejection.test(normalizedMessage.trim());

const isRejection = isShortRejection || rejectionPatterns.some((p) => p.test(normalizedMessage));
```

### Key Design Decisions

1. **Positional Anchors (`^`)**: Rejection words at the START of a message indicate intent
2. **Required Objects**: "cancel THAT" vs just "cancel" in a sentence
3. **Phrase Matching**: "hold on" is rejection, "hold" alone is ambiguous
4. **Short Message Special Case**: A standalone "no" is rejection; "no problem" is not
5. **Unicode Normalization**: `userMessage.normalize('NFKC')` prevents lookalike character bypass

## Test Cases

```typescript
describe('T2 soft-confirm rejection patterns', () => {
  // Should REJECT (explicit rejection intent)
  const shouldReject = [
    'no',
    'stop',
    'wait',
    'cancel',
    'No, cancel that',
    "Wait, don't do that",
    'Stop that please',
    'Cancel the booking',
    'Hold on',
    "Don't proceed with that",
  ];

  // Should NOT reject (legitimate messages)
  const shouldNotReject = [
    "No, I don't have any other questions",
    'Actually, that looks great!',
    'No problem, thanks!',
    "I'm actually excited about this",
    'Can you hold onto this information?',
    'Let me know if you need anything',
    'Sounds good',
    'Perfect, thanks!',
    "That's not what I meant, but this works",
    'I have no concerns',
  ];

  for (const msg of shouldReject) {
    it(`should reject: "${msg}"`, async () => {
      const result = await proposalService.softConfirmPendingT2(
        tenantId,
        sessionId,
        msg,
        'customer'
      );
      expect(result).toEqual([]); // Empty = rejected
    });
  }

  for (const msg of shouldNotReject) {
    it(`should NOT reject: "${msg}"`, async () => {
      // Create a pending T2 proposal first
      await createPendingT2Proposal();

      const result = await proposalService.softConfirmPendingT2(
        tenantId,
        sessionId,
        msg,
        'customer'
      );
      expect(result.length).toBeGreaterThan(0); // Confirmed
    });
  }
});
```

## Prevention Checklist

When implementing user message parsing:

- [ ] Test with realistic user messages (not just keywords)
- [ ] Consider message position (start vs middle)
- [ ] Consider phrase context ("hold on" vs "hold")
- [ ] Consider message length (standalone vs sentence)
- [ ] Add negative test cases (messages that SHOULD pass)
- [ ] Use regex with word boundaries (`\b`) to avoid partial matches
- [ ] Normalize unicode to prevent bypass attacks

## Red Flags in Code Review

```typescript
// RED FLAG: Simple includes()
if (message.includes('cancel')) {
  reject();
}

// RED FLAG: Split and check
const words = message.split(' ');
if (words.includes('no')) {
  reject();
}

// RED FLAG: No phrase context
const keywords = ['wait', 'stop', 'no'];
if (keywords.some((kw) => message.includes(kw))) {
  reject();
}
```

## Better Pattern: Layered Matching

```typescript
// GOOD: Layered approach
function isRejectionIntent(message: string): boolean {
  const normalized = message.normalize('NFKC').trim();

  // Layer 1: Exact short messages (highest confidence)
  if (/^(no|stop|wait|cancel)\.?!?$/i.test(normalized)) {
    return true;
  }

  // Layer 2: Strong patterns at start
  if (/^(cancel|stop|wait|hold)/i.test(normalized)) {
    return true;
  }

  // Layer 3: Explicit action phrases anywhere
  if (/\b(cancel (that|this|it)|don't (do|proceed))\b/i.test(normalized)) {
    return true;
  }

  return false;
}
```

## File References

- `server/src/agent/proposals/proposal.service.ts:243-280` - Rejection pattern implementation
- `server/test/agent/proposals/proposal.service.test.ts` - Test cases

## Cross-References

- [Chatbot Proposal Execution Flow](/docs/solutions/logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)
- [Agent Ecosystem Quick Reference](/docs/solutions/AGENT_ECOSYSTEM_QUICK_REFERENCE.md)
