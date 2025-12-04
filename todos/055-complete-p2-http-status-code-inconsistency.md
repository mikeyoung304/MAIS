---
status: complete
priority: p2
issue_id: "055"
tags: [code-review, scheduling, api, rest-conventions]
dependencies: []
---

# Inconsistent HTTP Status Codes for Validation Errors

## Problem Statement

The tenant admin scheduling routes return 400 (Bad Request) when a referenced resource is not found, instead of 404 (Not Found). This violates REST conventions and makes client-side error handling inconsistent.

**Why this matters:** Clients expect 404 for "resource not found" and 400 for "invalid input format". Current behavior confuses these cases.

## Findings

### Code Evidence

**Location:** `server/src/routes/tenant-admin-scheduling.routes.ts:357`

```typescript
if (data.serviceId) {
  const service = await serviceRepo.getById(tenantId, data.serviceId);
  if (!service) {
    res.status(400).json({ error: 'Service not found' });  // Should be 404
    return;
  }
}
```

### REST Convention

| Scenario | Correct Status | Current |
|----------|----------------|---------|
| Invalid JSON body | 400 | 400 ✓ |
| Missing required field | 400 | 400 ✓ |
| Referenced resource not found | 404 | 400 ❌ |
| Resource to update not found | 404 | 404 ✓ |

## Proposed Solutions

### Option A: Use 404 for Not Found (Recommended)
**Effort:** Small | **Risk:** Low

```typescript
if (!service) {
  res.status(404).json({ error: 'Service not found' });
  return;
}
```

### Option B: Use 422 Unprocessable Entity
**Effort:** Small | **Risk:** Low

Some APIs use 422 for "valid format but invalid reference":
```typescript
res.status(422).json({ error: 'Referenced service does not exist' });
```

## Recommended Action

Implement **Option A** - 404 is clearer and matches existing patterns in codebase.

## Technical Details

**Files to Update:**
- `server/src/routes/tenant-admin-scheduling.routes.ts:357` (and similar patterns)

## Acceptance Criteria

- [ ] Referenced resource not found returns 404
- [ ] Client-side error handling updated to expect 404
- [ ] API documentation reflects correct status codes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during Code Quality review |
