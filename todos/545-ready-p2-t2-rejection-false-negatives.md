---
status: ready
priority: p2
issue_id: "545"
tags: [code-review, ux, proposals, nlp]
dependencies: []
---

# T2 Rejection Pattern False Negatives

## Problem Statement

T2 soft-confirm rejection patterns are contextual to avoid false positives, but this creates false negatives. Common rejection phrases like "never mind" or "on second thought" don't trigger rejection, causing proposals to auto-confirm despite user intent.

## Findings

**Security Sentinel:**
> "T2 soft-confirm rejection patterns may miss common rejection phrases. Users must use exact phrasing to reject proposals."

**Evidence:**
```typescript
// Currently rejected:
"wait", "stop", "cancel that", "don't do that"

// NOT rejected (but should be):
"never mind"
"on second thought"
"scratch that"
"forget it"
"actually, don't"
```

**Impact:**
- User says "never mind" but proposal auto-confirms anyway
- Poor UX: requires learning specific rejection keywords
- Higher impact for customer chat (2-min window) vs onboarding (10-min)

## Proposed Solutions

### Option A: Add common rejection phrases (Recommended)
Extend rejection patterns with common alternatives.

```typescript
const rejectionPatterns = [
  // ... existing patterns ...

  // Add common alternatives:
  /\b(never\s+mind|on\s+second\s+thought)\b/i,
  /\b(scratch\s+that|forget\s+(it|that))\b/i,
  /\bactually,?\s+don'?t\b/i,
];
```

**Pros:** Better UX, catches common rejection phrases
**Cons:** More patterns to maintain
**Effort:** Small (15 min)
**Risk:** Low (may introduce few false positives)

### Option B: NLP intent detection
Use simple sentiment/intent classifier for rejection detection.

**Pros:** More robust, handles variations
**Cons:** Overkill for this use case, adds dependency
**Effort:** Large (2+ hours)
**Risk:** Medium

## Recommended Action

Option A - Add common rejection phrases

## Technical Details

**Affected Files:**
- `server/src/agent/proposals/proposal.service.ts:249-259`

## Acceptance Criteria

- [ ] "never mind" triggers rejection
- [ ] "on second thought" triggers rejection
- [ ] "scratch that" triggers rejection
- [ ] "forget it" triggers rejection
- [ ] Tests added for new patterns
- [ ] No false positives introduced

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-01 | Created from code review | Balance false positives vs negatives |

## Resources

- [T2 proposal flow docs](/docs/solutions/logic-errors/contextual-rejection-patterns-t2-proposals-MAIS-20260101.md)
