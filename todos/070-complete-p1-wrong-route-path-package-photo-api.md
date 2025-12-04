---
status: complete
priority: p1
issue_id: '070'
tags: [code-review, bug, critical, authentication]
dependencies: []
---

# P1: Wrong Route Path in package-photo-api.ts Causes 404 Errors

## Problem Statement

The `package-photo-api.ts` file uses incorrect route paths `/v1/tenant/admin/` instead of `/v1/tenant-admin/`. This causes **404 errors** when platform admins try to upload photos while impersonating a tenant.

**Why it matters:** This is a **critical bug** that completely breaks photo upload functionality for platform admins. The authentication fix was applied, but the routes themselves are wrong.

## Findings

### Evidence

**File:** `client/src/lib/package-photo-api.ts`

Wrong paths (4 instances):

- Line 168: `${baseUrl}/v1/tenant/admin/packages/${packageId}/photos`
- Line 222: `${baseUrl}/v1/tenant/admin/packages/${packageId}/photos/${filename}`
- Line 269: `${baseUrl}/v1/tenant/admin/packages/${packageId}`
- Line 315: `${baseUrl}/v1/tenant/admin/packages`

Correct paths (from `usePhotoUpload.ts` and server):

- `${baseUrl}/v1/tenant-admin/packages/${packageId}/photos`
- `${baseUrl}/v1/tenant-admin/packages/${packageId}/photos/${filename}`
- `${baseUrl}/v1/tenant-admin/packages/${packageId}`
- `${baseUrl}/v1/tenant-admin/packages`

### Impact

- Platform admins impersonating tenants get 404 errors on all photo operations
- Normal tenant admins may also be affected
- Original bug reporter's issue was likely this, not just auth

## Proposed Solutions

### Solution 1: Fix Route Paths (RECOMMENDED)

**Description:** Replace `/v1/tenant/admin/` with `/v1/tenant-admin/` in all 4 locations.

**Pros:**

- Immediate fix
- 2-minute change
- No architectural changes

**Cons:**

- None

**Effort:** Small (5 minutes)
**Risk:** Very Low

```typescript
// Change all 4 occurrences:
// FROM: `${baseUrl}/v1/tenant/admin/packages/...`
// TO:   `${baseUrl}/v1/tenant-admin/packages/...`
```

### Solution 2: Deprecate package-photo-api.ts Entirely

**Description:** Remove the file and use ts-rest client instead.

**Pros:**

- Eliminates root cause of divergence
- Better type safety
- Centralized auth handling

**Cons:**

- Larger refactor
- Risk of breaking other functionality

**Effort:** Medium (2-4 hours)
**Risk:** Medium

## Recommended Action

**Solution 1** - Fix the route paths immediately. This is a critical blocker.

## Technical Details

### Affected Files

- `client/src/lib/package-photo-api.ts` (4 route paths)
- `client/src/lib/PACKAGE_PHOTO_API_README.md` (documentation)
- `client/src/lib/package-photo-api.quickref.md` (documentation)
- `client/src/components/PackagePhotoUploader.md` (documentation)

### Acceptance Criteria

- [x] All 4 route paths in `package-photo-api.ts` use `/v1/tenant-admin/`
- [ ] Platform admin can upload photos while impersonating tenant (needs manual test)
- [ ] Normal tenant admin can still upload photos (needs manual test)
- [ ] Documentation files updated to reflect correct paths (deferred)

## Work Log

| Date       | Action    | Notes                                                                     |
| ---------- | --------- | ------------------------------------------------------------------------- |
| 2025-11-29 | Created   | Found during code review of auth fix                                      |
| 2025-11-29 | **FIXED** | Changed all 4 route paths from `/v1/tenant/admin/` to `/v1/tenant-admin/` |

## Resources

- Related PR: Current working changes (auth fix)
- Correct routes: `usePhotoUpload.ts` lines 144, 196
- Server routes: `server/src/routes/tenant-admin.routes.ts`
