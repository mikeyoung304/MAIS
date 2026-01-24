---
status: complete
priority: p3
issue_id: '5228'
tags: [quality, agent-v2, project-hub, code-review, maintainability]
dependencies: []
resolved_at: '2026-01-21'
resolution: 'Already fixed - DEFAULTS and LLM_CONFIG constants extracted with JSDoc comments'
---

# Project Hub: Magic Numbers Not Extracted to Constants

## Problem Statement

Several magic values are embedded throughout the code without explanation:

- `limit: z.number().default(10)` - why 10?
- `days: z.number().default(7)` - why 7?
- `.slice(0, 10)` - why limit to 10 events?
- `temperature: 0.4` - why 0.4?
- `maxOutputTokens: 2048` - why 2048?

**Impact:** Difficult to understand rationale, hard to tune, inconsistent updates.

## Findings

### Simplicity Reviewer

Magic values scattered across:

- Line 454: `limit: z.number().default(10)`
- Line 491: `days: z.number().default(7)`
- Line 510: `.slice(0, 10)`
- Line 709: `temperature: 0.4`
- Line 710: `maxOutputTokens: 2048`

## Proposed Solutions

### Option A: Extract to Named Constants (Recommended)

```typescript
const DEFAULTS = {
  /** Maximum pending requests to return in a single query */
  PENDING_REQUESTS_LIMIT: 10,
  /** Number of days to look back for customer activity */
  ACTIVITY_LOOKBACK_DAYS: 7,
  /** Maximum recent events to display in activity summary */
  RECENT_EVENTS_DISPLAY_LIMIT: 10,
} as const;

const LLM_CONFIG = {
  /** Lower temperature for consistent, professional responses */
  TEMPERATURE: 0.4,
  /** Sufficient for detailed responses without excessive verbosity */
  MAX_OUTPUT_TOKENS: 2048,
} as const;
```

**Pros:** Self-documenting, easy to tune, single source of truth
**Cons:** More constants to maintain
**Effort:** Small (30 minutes)
**Risk:** Very low

## Recommended Action

**Option A** - Extract and document all magic numbers.

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/project-hub/src/agent.ts`

## Acceptance Criteria

- [ ] All magic numbers extracted to named constants
- [ ] Constants include JSDoc comments explaining the value
- [ ] Tool definitions reference constants
- [ ] LLM config uses constants

## Work Log

| Date       | Action                               | Result                            |
| ---------- | ------------------------------------ | --------------------------------- |
| 2026-01-20 | Created from multi-agent code review | Identified by Simplicity reviewer |

## Resources

- [Clean Code - Magic Numbers](https://refactoring.guru/replace-magic-number-with-symbolic-constant)
