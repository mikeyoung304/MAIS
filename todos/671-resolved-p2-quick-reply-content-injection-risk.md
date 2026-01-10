---
status: resolved
priority: p2
issue_id: '671'
tags:
  - code-review
  - security
  - agent
  - frontend
dependencies: []
resolved_in: this-commit
---

# Quick Reply Content Could Be Exploited for Indirect Prompt Injection

## Problem Statement

Quick Reply chips display LLM-generated content directly without sanitization or validation. A malicious user could potentially craft inputs that cause the LLM to generate Quick Reply options containing XSS payloads or misleading action text.

**Why it matters:** While the current implementation is low-risk (buttons only set input values, don't execute), this is a defense-in-depth issue. As the feature evolves, unsanitized LLM output could become a vector for attacks.

## Findings

**Location:**

- `apps/web/src/lib/parseQuickReplies.ts` - Parser
- `apps/web/src/components/agent/QuickReplyChips.tsx` - Renderer

**Current Flow:**

1. LLM generates message with `[Quick Replies: Option 1 | Option 2]`
2. `parseQuickReplies()` extracts options via regex
3. `QuickReplyChips` renders options as button text
4. Click sets `inputValue` to the option text

**Potential Risks:**

1. **XSS via dangerouslySetInnerHTML (not currently used, but future risk)**
2. **Misleading labels:** LLM could generate "Delete All Data" when actual action is benign
3. **Overly long options** causing layout issues

## Proposed Solutions

### Option A: Add Validation to Parser (Recommended)

**Pros:** Defense in depth, catches issues early
**Cons:** May reject legitimate edge cases
**Effort:** Small (30 min)
**Risk:** Low

```typescript
// In parseQuickReplies.ts
const MAX_OPTION_LENGTH = 50;
const DISALLOWED_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+=/i, // onclick=, onerror=, etc.
];

function validateOption(option: string): string | null {
  if (option.length > MAX_OPTION_LENGTH) return null;
  if (DISALLOWED_PATTERNS.some((p) => p.test(option))) return null;
  return option.trim();
}

// Apply to each parsed option
const validatedReplies = rawReplies.map(validateOption).filter((o): o is string => o !== null);
```

### Option B: Sanitize at Render Time

**Pros:** Catches any bypass of parser
**Cons:** More complex, redundant if parser validates
**Effort:** Small (20 min)
**Risk:** Low

### Option C: Accept Current Risk

**Pros:** No work
**Cons:** Technical debt, potential security issue
**Effort:** None
**Risk:** Medium (as feature evolves)

## Recommended Action

**Option A** - Add validation to parser. This is a defense-in-depth measure that's quick to implement and prevents potential issues as the feature grows.

## Technical Details

**Affected Files:**

- `apps/web/src/lib/parseQuickReplies.ts` - Add validation
- `apps/web/src/lib/parseQuickReplies.test.ts` - Add tests for edge cases

## Acceptance Criteria

- [ ] Options over 50 chars are truncated or rejected
- [ ] Script tags and event handlers are filtered
- [ ] Validation doesn't break legitimate Quick Reply usage
- [ ] Unit tests cover edge cases

## Work Log

| Date       | Action                   | Learnings                                   |
| ---------- | ------------------------ | ------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by security-sentinel as P2 issue |

## Resources

- OWASP XSS Prevention Cheat Sheet
- Related: Quick Reply feature in onboarding-system-prompt.ts
