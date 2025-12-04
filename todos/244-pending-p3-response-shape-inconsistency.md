---
status: pending
priority: p3
issue_id: "244"
tags: [api-design, landing-page, consistency]
dependencies: []
source: "code-review-pr-14"
---

# TODO-244: Standardize API Response Shapes

## Priority: P3 (Nice to Have)

## Status: Pending

## Source: Code Review - PR #14 (Code Philosopher)

## Problem Statement

The draft endpoints return inconsistent response shapes:

- `PUT /draft` → `{ success: true, savedAt: string }`
- `POST /publish` → `{ success: true, publishedAt: string }`
- `DELETE /draft` → `{ success: true }`
- `GET /draft` → Full `LandingPageDraftResponse` object

This inconsistency makes client code more complex.

## Proposed Solution

Consider standardizing to always include the full draft wrapper:

```typescript
// All mutations return the updated state
PUT /draft → LandingPageDraftResponse
POST /publish → LandingPageDraftResponse
DELETE /draft → LandingPageDraftResponse
```

**Pros:** Client always has latest state after mutation
**Cons:** Slightly larger payloads

## Acceptance Criteria

- [ ] Decide: Standardize responses OR document intentional difference
- [ ] If standardizing: Update repository return types
- [ ] If documenting: Add JSDoc explaining response shapes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Code review of PR #14 |

## Tags

api-design, landing-page, consistency
