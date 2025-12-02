---
status: complete
priority: p1
issue_id: "064"
tags: [code-review, data-integrity, storage, supabase]
dependencies: []
---

# Orphaned Files: No Cleanup When Segments Deleted or Updated

## Problem Statement

When a segment is deleted or its heroImage is updated, the old image file remains in Supabase Storage indefinitely. There is no cleanup mechanism, leading to storage bloat, cost leakage, and potential GDPR compliance issues (deleted content remains).

**Why This Matters:**
- Unlimited growth of orphaned files
- Supabase Storage charges per GB (~$0.021/GB/month)
- GDPR "right to erasure" may be violated
- No way to reclaim storage from deleted segments

## Findings

### Evidence from Code Review

**Segment deletion has no cleanup:**
```typescript
// segment.service.ts - deleteSegment()
// NO image cleanup logic exists
async deleteSegment(tenantId: string, id: string): Promise<void> {
  await this.repository.delete(tenantId, id);
  // heroImage URL gone from DB, but file remains in storage forever!
}
```

**No delete method in UploadService:**
```typescript
// upload.service.ts
// deleteSegmentImage() method does NOT exist
// Only deleteLogo() and deletePackagePhoto() for local filesystem
```

**Update scenario also orphans:**
```typescript
// When heroImage is changed:
await segmentService.updateSegment(tenantId, segmentId, {
  heroImage: 'https://new-url.jpg' // Old image URL lost, file orphaned
});
```

### Data Integrity Guardian Assessment
- **Severity**: CRITICAL
- **Impact**: Storage bloat, cost leak, compliance risk
- Storage grows unbounded with no cleanup mechanism

## Proposed Solutions

### Option A: Delete on Segment Deletion (Recommended)

**Description:** Add cleanup logic to segment deletion flow.

**Pros:**
- Simple implementation
- Handles primary use case
- Immediate impact on new deletions

**Cons:**
- Doesn't handle update case
- Doesn't clean existing orphans
- If storage delete fails, segment still deleted

**Effort:** Small (1 hour)
**Risk:** Low

```typescript
// segment.service.ts
async deleteSegment(tenantId: string, id: string): Promise<void> {
  const existing = await this.repository.findById(tenantId, id);
  if (!existing) throw new NotFoundError(`Segment not found: ${id}`);

  // Clean up heroImage before deletion
  if (existing.heroImage) {
    try {
      await this.uploadService.deleteSegmentImage(existing.heroImage, tenantId);
    } catch (err) {
      logger.warn({ error: err, heroImage: existing.heroImage },
        'Failed to delete segment image - continuing with deletion');
    }
  }

  await this.repository.delete(tenantId, id);
}

// upload.service.ts - Add this method
async deleteSegmentImage(url: string, tenantId: string): Promise<void> {
  const storagePath = this.extractStoragePath(url);

  // Verify tenant owns this path (security)
  if (!storagePath.startsWith(`${tenantId}/`)) {
    throw new Error('Cannot delete files from other tenants');
  }

  if (this.isRealMode) {
    const supabase = this.getSupabaseClient();
    const { error } = await supabase.storage.from('images').remove([storagePath]);
    if (error) logger.warn({ error: error.message }, 'Supabase delete failed');
  } else {
    const filename = path.basename(url);
    const filepath = path.join(this.segmentImageUploadDir, filename);
    if (fs.existsSync(filepath)) await fs.promises.unlink(filepath);
  }
}
```

### Option B: Reconciliation Background Job

**Description:** Periodic job that finds and deletes orphaned files.

**Pros:**
- Handles all orphan scenarios
- Can clean existing orphans
- Non-blocking to main flow

**Cons:**
- More complex implementation
- Requires storage-to-DB reconciliation
- May delete files "in use" if timing is wrong

**Effort:** High (4-6 hours)
**Risk:** Medium

### Option C: Upload Tracking Table

**Description:** Store all uploads in DB, mark as "in_use" when linked to entity.

**Pros:**
- Complete audit trail
- Can track all orphans
- Enables storage quotas

**Cons:**
- Schema change required
- More complex upload flow
- Needs migration for existing files

**Effort:** High (6-8 hours)
**Risk:** Medium

## Recommended Action

**Option A: Delete on Segment Deletion** - Simple, immediate value, low risk. Can add Option B later for comprehensive cleanup.

## Technical Details

**Affected Files:**
- `server/src/services/upload.service.ts` - Add `deleteSegmentImage()` method
- `server/src/services/segment.service.ts` - Add cleanup to `deleteSegment()`
- Inject uploadService into SegmentService (may need DI update)

**Database Changes:** None for Option A

## Acceptance Criteria

- [ ] `deleteSegmentImage(url, tenantId)` method exists in UploadService
- [ ] `deleteSegment()` cleans up heroImage before deletion
- [ ] Tenant ownership verified before file deletion (security)
- [ ] Deletion failure logged but doesn't block segment deletion
- [ ] Test: Delete segment with heroImage removes file from storage
- [ ] Test: Delete segment without heroImage succeeds

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-29 | Created | Found during code review - Data Integrity Guardian |
| 2025-12-01 | Complete | Already implemented: `deleteSegmentImage()` in UploadAdapter (lines 306-344), cleanup in SegmentService.deleteSegment (lines 268-276). Includes tenant ownership verification, error logging, and graceful failure handling. |

## Resources

- Supabase Storage Delete: https://supabase.com/docs/reference/javascript/storage-from-remove
- GDPR Right to Erasure: Article 17
