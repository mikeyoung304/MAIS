---
status: complete
priority: p2
issue_id: "346"
tags: [code-review, api, breaking-change, documentation]
dependencies: []
---

# API: Document Pagination Default Change (100 -> 50)

## Problem Statement

The default pagination limit for `tenantAdminGetAppointments` was changed from 100 to 50 items. API consumers expecting 100 items by default may experience issues.

**Why it matters:** Breaking change for API consumers who rely on default pagination behavior.

## Findings

**File:** `packages/contracts/src/api.v1.ts:1591`

```typescript
limit: z.coerce.number().int().min(1).max(500).default(50),
```

**Agent:** performance-oracle

## Proposed Solutions

### Option A: Document in release notes (Recommended)
- **Pros:** Informs consumers, simple
- **Cons:** May still surprise consumers
- **Effort:** Small
- **Risk:** Low

### Option B: Deprecation warning header
- **Pros:** Proactive notification
- **Cons:** More complex
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

Option A - Add to CHANGELOG and API documentation.

## Technical Details

- **Affected files:** CHANGELOG.md, API docs
- **Components:** API contracts, tenant-admin-scheduling
- **Database changes:** None

## Acceptance Criteria

- [ ] CHANGELOG updated with breaking change notice
- [ ] API documentation updated with new default
- [ ] Consider adding response header indicating default was applied

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2024-12-24 | Created from code review | performance-oracle agent finding |

## Resources

- File: `packages/contracts/src/api.v1.ts`
- Endpoint: `GET /v1/tenant-admin/appointments`
