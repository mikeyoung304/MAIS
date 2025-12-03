---
status: pending
priority: p3
issue_id: "190"
tags: [code-review, observability, seeds]
dependencies: []
---

# Seed Transaction Missing Start/Commit Logging

## Problem Statement

Seed transactions have 60-second timeouts but no logging when they start or complete. If seeds fail in production/CI, there's no visibility into transaction timing or failure points.

## Findings

**Location:** `server/prisma/seeds/demo.ts`, `e2e.ts`, `platform.ts`

**Current Code:**
```typescript
await prisma.$transaction(async (tx) => {
  // ... operations with no timing visibility
}, { timeout: 60000 });
```

**Risk Assessment:**
- Impact: Low (seeds run infrequently)
- Likelihood: Low (failures are rare)

## Proposed Solutions

### Solution 1: Add start/commit logging (Recommended)
- Log before and after transaction
- Include duration on completion
- **Pros:** Better observability
- **Cons:** Minor code addition
- **Effort:** Small (15 minutes)
- **Risk:** None

## Recommended Action

Implement **Solution 1** for operational visibility.

## Technical Details

**Proposed Change:**
```typescript
logger.info({ slug: DEMO_SLUG, operations: 16 }, 'Starting seed transaction');
const startTime = Date.now();

await prisma.$transaction(async (tx) => {
  // ... operations
}, { timeout: 60000 });

logger.info({
  slug: DEMO_SLUG,
  durationMs: Date.now() - startTime
}, 'Seed transaction committed successfully');
```

## Acceptance Criteria

- [ ] All seed files log transaction start
- [ ] All seed files log transaction completion with duration
- [ ] No TypeScript errors

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-03 | Created | Found during code review of commit 45024e6 |

## Resources

- Commit: 45024e6 (introduced seed transaction wrapping)
