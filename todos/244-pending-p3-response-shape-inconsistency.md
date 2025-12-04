---
status: complete
priority: p3
issue_id: '244'
tags: [api-design, landing-page, consistency]
dependencies: []
source: 'code-review-pr-14'
---

# TODO-244: Standardize API Response Shapes

## Priority: P3 (Nice to Have)

## Status: Complete

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

- [x] Decide: Standardize responses OR document intentional difference
- [ ] If standardizing: Update repository return types
- [x] If documenting: Add JSDoc explaining response shapes

## Resolution

**Decision: Document intentional design**

The response shapes are intentionally different. Added comprehensive JSDoc in `landing-page.service.ts` explaining:

1. **Design pattern:**
   - GET returns full state (for initial load)
   - Mutations return minimal confirmation (for frequent saves)

2. **Rationale:**
   - Auto-save fires every 2 seconds - clients already have local state
   - Smaller payloads = faster response times
   - Client refetches full state on page load anyway

3. **Alternative for clients:**
   - If full state needed after mutation, call GET /draft

This follows REST best practices where mutations can return minimal acknowledgment when clients maintain local state.

## Work Log

| Date       | Action   | Notes                                  |
| ---------- | -------- | -------------------------------------- |
| 2025-12-04 | Created  | Code review of PR #14                  |
| 2025-12-04 | Resolved | Documented intentional design in JSDoc |

## Tags

api-design, landing-page, consistency
