---
status: resolved
priority: p2
issue_id: "196"
tags: [code-review, error-handling, consistency]
dependencies: []
---

# Missing NotFoundError Handling in PUT/DELETE Routes

## Problem Statement

The `updateAddOn` and `deleteAddOn` routes call service methods that throw `NotFoundError`, but the routes don't have explicit catch blocks for this error type, relying on the global error handler instead.

### Why It Matters
- Inconsistent with other routes in the file that explicitly handle NotFoundError
- Error response format may differ from explicit handlers
- Harder to reason about error handling behavior

## Findings

**Source:** Security Review, Architecture Review

**Evidence:**
- `catalog.service.ts` line 342 throws `NotFoundError` in `updateAddOn`
- `catalog.service.ts` line 383 throws `NotFoundError` in `deleteAddOn`
- Route handlers at lines 1149 and 1185 only catch ZodError, not NotFoundError
- GET by ID route (line 1062-1065) handles null explicitly with 404 response

**Location:** `server/src/routes/tenant-admin.routes.ts:1159-1167, 1187-1189`

## Proposed Solutions

### Option A: Add Explicit Catch (Recommended)
**Pros:** Consistent with other routes, explicit error handling
**Cons:** Slightly more code
**Effort:** Small (10 minutes)
**Risk:** Low

```typescript
// PUT /v1/tenant-admin/addons/:id
} catch (error) {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: error.issues });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  next(error);
}

// DELETE /v1/tenant-admin/addons/:id
} catch (error) {
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  next(error);
}
```

## Recommended Action

Option A - Add explicit NotFoundError handling for consistency.

## Technical Details

**Affected Files:**
- `server/src/routes/tenant-admin.routes.ts`

**Database Changes:** None

## Acceptance Criteria

- [ ] PUT /addons/:id catches NotFoundError explicitly
- [ ] DELETE /addons/:id catches NotFoundError explicitly
- [ ] Error response matches format from other routes
- [ ] Tests verify 404 returned for non-existent add-ons

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-03 | Created from code review | Be explicit about error handling |

## Resources

- Error handling pattern in package routes (lines 788-841)
