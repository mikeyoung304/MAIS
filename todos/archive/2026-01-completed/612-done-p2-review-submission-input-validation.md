---
status: complete
priority: p2
issue_id: 612
tags: [code-review, security, validation, agent-eval]
dependencies: []
created: 2026-01-02
---

# Missing Input Validation for ReviewSubmission

## Problem Statement

The `ReviewSubmission` interface and `submitReview` method lack validation for field lengths and ranges, which could lead to database bloat or unexpected behavior.

## Findings

**Source:** security-sentinel review

**Location:** `server/src/agent/feedback/review-queue.ts` lines 66-78, 208-243

**Evidence:**

```typescript
export interface ReviewSubmission {
  reviewedBy: string; // No length limit
  notes: string; // No length limit
  correctEvalScore?: number; // No range check
  actionTaken: 'none' | 'approve' | 'reject' | 'escalate' | 'retrain';
}
```

**Risks:**

- `reviewedBy` could be extremely long string
- `notes` could contain megabytes of text
- `correctEvalScore` accepts any number (should be 0-10)

## Proposed Solutions

### Option 1: Add Zod schema validation (Recommended)

**Pros:** Type-safe, consistent with MAIS patterns
**Cons:** Small migration effort
**Effort:** Small
**Risk:** Very low

```typescript
import { z } from 'zod';

export const ReviewSubmissionSchema = z.object({
  reviewedBy: z.string().min(1).max(100),
  notes: z.string().max(2000),
  correctEvalScore: z.number().min(0).max(10).optional(),
  actionTaken: z.enum(['none', 'approve', 'reject', 'escalate', 'retrain']),
});

export type ReviewSubmission = z.infer<typeof ReviewSubmissionSchema>;
```

### Option 2: Add runtime validation in submitReview

**Pros:** Quick fix
**Cons:** Not type-safe, duplicated logic
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `server/src/agent/feedback/review-queue.ts`
- Add export to `@macon/contracts` if schema should be shared

## Acceptance Criteria

- [ ] `reviewedBy` validated to max 100 characters
- [ ] `notes` validated to max 2000 characters
- [ ] `correctEvalScore` validated to 0-10 range
- [ ] Validation errors return clear error messages
- [ ] Tests cover validation edge cases

## Work Log

| Date       | Action                           | Learnings                             |
| ---------- | -------------------------------- | ------------------------------------- |
| 2026-01-02 | Created during /workflows:review | Identified by security-sentinel agent |

## Resources

- [ts-rest + Zod patterns](packages/contracts/README.md)
