---
status: pending
priority: p2
issue_id: "157"
tags: [code-review, quality, mvp-gaps, duplication]
dependencies: []
---

# Error Handling Duplicated in Public Routes

## Problem Statement

Each public route handler has 30-50 lines of duplicated error handling with repeated string matching patterns.

**Why This Matters:**
- 120+ lines of duplicated error handling
- String matching is fragile
- Inconsistent error messages across routes

## Findings

### Agent: code-simplicity-reviewer

**Location:**
- `server/src/routes/public-booking-management.routes.ts` (lines 203-235, 281-339, 377-417)
- `server/src/routes/public-balance-payment.routes.ts` (lines 90-148)

**Evidence:**
```typescript
// Pattern repeated 4 times
if (error.message.includes('Token validation failed')) {
  if (error.message.includes('expired')) {
    return res.status(401).json({ /* ... */ });
  }
  return res.status(401).json({ /* ... */ });
}
if (error instanceof NotFoundError) {
  return res.status(404).json({ /* ... */ });
}
```

## Proposed Solutions

### Option A: Centralized Error Handler (Recommended)
**Pros:** Single source of truth, consistent errors
**Cons:** Requires new middleware
**Effort:** Small (2-3 hours)
**Risk:** Low

```typescript
function handlePublicApiError(error: Error, res: Response) {
  if (error instanceof TokenValidationError) {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
  // 20 lines vs 120 duplicated lines
}
```

## Technical Details

**Affected Files:**
- `server/src/routes/public-booking-management.routes.ts`
- `server/src/routes/public-balance-payment.routes.ts`
- `server/src/middleware/error-handler.ts`

## Acceptance Criteria

- [ ] Error handler middleware for public routes created
- [ ] All public routes use centralized error handling
- [ ] Consistent error response format
- [ ] 120 lines of duplication removed
