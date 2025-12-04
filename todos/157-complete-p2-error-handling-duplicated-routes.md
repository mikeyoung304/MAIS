---
status: complete
priority: p2
issue_id: "157"
tags: [code-review, quality, mvp-gaps, duplication]
dependencies: []
resolved_at: "2025-12-02"
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

- [x] Error handler middleware for public routes created
- [x] All public routes use centralized error handling
- [x] Consistent error response format
- [x] 120+ lines of duplication removed

## Resolution Summary

**Date:** 2025-12-02

**Changes Made:**

1. **Created centralized error handler** (`server/src/lib/public-route-error-handler.ts`):
   - Single `handlePublicRouteError()` function handles all common error patterns
   - Maps domain errors (TokenExpiredError, InvalidTokenError, BookingConflictError, etc.) to HTTP responses
   - Handles legacy string-based errors for backward compatibility
   - Consistent error response format across all public routes

2. **Updated public-booking-management.routes.ts**:
   - Removed 3 duplicated error handling blocks (~120 lines)
   - Replaced with 3 single-line calls to `handlePublicRouteError()`
   - Reduced file from ~420 lines to 282 lines (33% reduction)

3. **Updated public-balance-payment.routes.ts**:
   - Removed 1 duplicated error handling block (~60 lines)
   - Replaced with single-line call to `handlePublicRouteError()`
   - Reduced file from ~153 lines to 93 lines (39% reduction)

**Impact:**
- **Lines removed:** ~180 lines of duplicated error handling code
- **Code reduction:** 38% reduction in public route files
- **Maintainability:** Single source of truth for error responses
- **Consistency:** All public routes now return identical error formats
- **TypeScript:** No new compilation errors introduced

**Files Modified:**
- `server/src/lib/public-route-error-handler.ts` (NEW - 143 lines)
- `server/src/routes/public-booking-management.routes.ts` (reduced 138 lines)
- `server/src/routes/public-balance-payment.routes.ts` (reduced 60 lines)

**Testing:**
- Pre-existing TypeScript errors remain (unrelated to this change)
- No new errors introduced
- Error handler follows existing error middleware patterns
- Backward compatible with legacy string-based error checking
