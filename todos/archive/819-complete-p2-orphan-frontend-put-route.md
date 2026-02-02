---
status: pending
priority: p2
issue_id: 819
tags: [code-review, breaking-change, frontend, cleanup]
dependencies: []
---

# Orphan Frontend PUT Route After Visual Editor Deletion

## Problem Statement

The frontend API proxy at `apps/web/src/app/api/tenant/landing-page/route.ts` exports a `PUT` handler that proxies to `PUT /v1/tenant-admin/landing-page` on the backend. However, the backend route has been deleted as part of the Visual Editor deprecation. This will cause 404 errors.

**Why it matters:**

- Any code calling `PUT /api/tenant/landing-page` will get a 404
- Confusing developer experience
- Technical debt from incomplete migration

## Findings

**From Breaking Changes Review:**

Frontend PUT handler exists (`apps/web/src/app/api/tenant/landing-page/route.ts:54-92`):

```typescript
export async function PUT(request: NextRequest) {
  // ... proxies to deleted backend route
}
```

**Backend routes that were DELETED:**

- `PUT /v1/tenant-admin/landing-page` - Update config
- `PUT /v1/tenant-admin/landing-page/draft` - Save draft
- `PATCH /v1/tenant-admin/landing-page/sections` - Toggle sections

**Backend routes that EXIST:**

- `GET /v1/tenant-admin/landing-page` - Get config
- `GET /v1/tenant-admin/landing-page/draft` - Get draft
- `POST /v1/tenant-admin/landing-page/publish` - Publish draft
- `DELETE /v1/tenant-admin/landing-page/draft` - Discard draft
- `POST /v1/tenant-admin/landing-page/images` - Upload image

## Proposed Solutions

### Option A: Delete Frontend PUT Handler (Recommended)

**Pros:**

- Clean removal of dead code
- No misleading exports

**Cons:**

- Any callers will get import error (good - fails fast)

**Effort:** Small (15 minutes)
**Risk:** Low

### Option B: Return Deprecation Error

**Pros:**

- Informative error message for any callers
- Gentle migration path

**Cons:**

- Still dead code
- Delayed failure

**Effort:** Small (15 minutes)
**Risk:** Low

```typescript
export async function PUT() {
  return NextResponse.json(
    { error: 'PUT /landing-page is deprecated. Use AI agent for storefront editing.' },
    { status: 410 } // Gone
  );
}
```

## Recommended Action

Implement Option A - delete the PUT handler. Fail fast is better than misleading behavior.

## Technical Details

**File to modify:**

- `apps/web/src/app/api/tenant/landing-page/route.ts` - Remove PUT export

**Search for callers:**

```bash
grep -rn "PUT.*landing-page" apps/web/src/
grep -rn "fetch.*landing-page.*PUT" apps/web/src/
```

## Acceptance Criteria

- [ ] PUT handler removed from frontend route
- [ ] No frontend code calls the deleted endpoint
- [ ] TypeScript compiles without errors
- [ ] Related E2E tests updated or skipped

## Work Log

| Date       | Action                        | Learnings                                                  |
| ---------- | ----------------------------- | ---------------------------------------------------------- |
| 2026-02-01 | Code review identified orphan | Frontend proxy routes need cleanup after backend deletions |

## Resources

- PR: feat/realtime-storefront-preview branch
- Related: docs/plans/2026-02-01-realtime-preview-handoff.md
