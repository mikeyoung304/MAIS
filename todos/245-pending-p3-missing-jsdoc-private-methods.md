---
status: pending
priority: p3
issue_id: "245"
tags: [documentation, landing-page, code-quality]
dependencies: []
source: "code-review-pr-14"
---

# TODO-245: Add JSDoc to Private Repository Methods

## Priority: P3 (Nice to Have)

## Status: Pending

## Source: Code Review - PR #14 (Pattern Recognition Specialist)

## Problem Statement

The private `validateImageUrls` method lacks JSDoc documentation explaining its purpose, parameters, and behavior. This makes the code harder to understand for future maintainers.

## Current State

```typescript
private validateImageUrls(config: LandingPageConfig): void {
  // 55 lines of validation code with no documentation
}
```

## Proposed Solution

```typescript
/**
 * Validates all image URLs in a landing page configuration.
 *
 * Checks that URLs use allowed protocols (https:, http:, blob:)
 * and rejects dangerous protocols (javascript:, data:).
 *
 * @param config - The landing page configuration to validate
 * @throws ValidationError if any image URL uses a dangerous protocol
 *
 * @remarks
 * This is a defense-in-depth measure. URLs are also validated by
 * SafeImageUrlSchema in @macon/contracts, but this check ensures
 * malicious URLs can't be injected via browser console bypass.
 */
private validateImageUrls(config: LandingPageConfig): void {
  // ...
}
```

## Acceptance Criteria

- [ ] Add JSDoc to validateImageUrls
- [ ] Add JSDoc to extractImageUrls (if created per TODO-239)
- [ ] Document throws behavior

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-04 | Created | Code review of PR #14 |

## Tags

documentation, landing-page, code-quality
