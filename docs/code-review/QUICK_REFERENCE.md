# Code Review Quick Reference - Supabase Storage Upload Feature

## Critical Issues Summary

### P1 Issues (Blocker - Fix Before Deploy)

| Issue    | Problem                                   | Solution                      | Files                                     | Time |
| -------- | ----------------------------------------- | ----------------------------- | ----------------------------------------- | ---- |
| **#062** | Public bucket = cross-tenant data leak    | Use signed URLs (1-year)      | `upload.service.ts`                       | 2-3h |
| **#063** | MIME validation bypassed (no magic bytes) | Add `file-type` package check | `upload.service.ts`                       | 1h   |
| **#064** | Orphaned files in storage forever         | Delete on segment deletion    | `upload.service.ts`, `segment.service.ts` | 1h   |

### P2 Issues (Important - This Sprint)

| Issue    | Problem                                          | Solution                            | Files                    | Time |
| -------- | ------------------------------------------------ | ----------------------------------- | ------------------------ | ---- |
| **#065** | Breaks DI pattern (singleton bypasses container) | Refactor to StorageProvider adapter | `di.ts`, new adapters    | 4-5h |
| **#066** | 60+ lines code duplication (3 identical methods) | Single parameterized `upload()`     | `upload.service.ts`      | 1-2h |
| **#067** | Rate limit per-IP, not per-tenant                | Add tenant-level limiter (50/hr)    | `rateLimiter.ts`, routes | 2-3h |
| **#068** | Memory exhaustion (memoryStorage unbounded)      | Max 3 concurrent uploads/tenant     | new limiter, routes      | 2-3h |

### P3 Issues (Enhancement)

| Issue    | Problem                                   | Solution                        | Files                  | Time  |
| -------- | ----------------------------------------- | ------------------------------- | ---------------------- | ----- |
| **#069** | 7x useCallback (zero performance benefit) | Remove all useCallback wrappers | `ImageUploadField.tsx` | 30min |

---

## Implementation Checklist

### Phase 1: Security (Do First - 4-5 hours)

- [ ] **#062 Private Bucket**
  - [ ] Supabase Dashboard: Change bucket from public → private
  - [ ] `upload.service.ts`: Replace `publicUrl` with `createSignedUrl()`
  - [ ] Test: Verify cross-tenant URL access blocked

- [ ] **#063 MIME Validation**
  - [ ] `npm install file-type --workspace=server`
  - [ ] `upload.service.ts`: Import `fileTypeFromBuffer`
  - [ ] Update `validateFile()` to check magic bytes
  - [ ] Test: Reject PHP with image/jpeg header

- [ ] **#064 File Cleanup**
  - [ ] `upload.service.ts`: Add `deleteSegmentImage()`
  - [ ] `segment.service.ts`: Call delete in `deleteSegment()`
  - [ ] Test: Delete segment removes file from storage

### Phase 2: Architecture (Next - 6-8 hours)

- [ ] **#065 DI Refactor**
  - [ ] `lib/ports.ts`: Add `StorageProvider` interface
  - [ ] `adapters/mock/mock-storage.adapter.ts`: Create MockStorageProvider
  - [ ] `adapters/supabase/supabase-storage.adapter.ts`: Create SupabaseStorageProvider
  - [ ] `services/upload.service.ts`: Refactor to accept provider
  - [ ] `di.ts`: Wire providers based on ADAPTERS_PRESET
  - [ ] Tests: Update to inject mock provider

- [ ] **#067 Rate Limiting**
  - [ ] `middleware/rateLimiter.ts`: Add IP (200/hr) + tenant (50/hr) limiters
  - [ ] `routes/tenant-admin.routes.ts`: Apply both to upload endpoints
  - [ ] Test: Single IP can do 200, single tenant max 50

### Phase 3: Performance + Polish (Last - 3.5-5.5 hours)

- [ ] **#066 Code Deduplication**
  - [ ] `upload.service.ts`: Create single `upload()` method
  - [ ] Keep public wrappers for backwards compat
  - [ ] Test: All upload paths work

- [ ] **#068 Memory Safety**
  - [ ] Create `ConcurrencyLimiter` class (max 3/tenant)
  - [ ] `routes/tenant-admin.routes.ts`: Add acquire/release calls
  - [ ] Test: Return 429 when limit exceeded

- [ ] **#069 Simplify Component**
  - [ ] `ImageUploadField.tsx`: Remove all `useCallback`
  - [ ] Use inline handlers or regular functions
  - [ ] Test: Component still works

---

## Critical Code Patterns

### Fix #062: Signed URL Generation

```typescript
const { data, error } = await supabase.storage
  .from('images')
  .createSignedUrl(storagePath, 3600 * 24 * 365); // 1 year
return data.signedUrl;
```

### Fix #063: Magic Byte Validation

```typescript
const { fileTypeFromBuffer } = await import('file-type');
const detected = await fileTypeFromBuffer(file.buffer);
if (!allowedTypes.includes(detected?.mime)) throw new Error('Invalid');
```

### Fix #064: Cleanup on Delete

```typescript
async deleteSegment(id, tenantId) {
  const segment = await this.repo.findById(tenantId, id);
  if (segment.heroImage) {
    await this.uploadService.deleteSegmentImage(segment.heroImage, tenantId);
  }
  await this.repo.delete(tenantId, id);
}
```

### Fix #065: DI Port/Adapter Pattern

```typescript
// ports.ts
interface StorageProvider {
  upload(tenantId, category, filename, file): Promise<UploadResult>;
  delete(tenantId, url): Promise<void>;
}

// di.ts
const provider =
  preset === 'real' ? new SupabaseStorageProvider(supabase) : new MockStorageProvider();
const uploadService = new UploadService(provider);
```

### Fix #067: Multi-Layer Rate Limiting

```typescript
router.post(
  '/upload',
  uploadLimiterIP, // 200/hour per IP (DDoS protection)
  uploadLimiterTenant // 50/hour per tenant (abuse protection)
  /* handler */
);
```

### Fix #068: Concurrency Limiting

```typescript
try {
  await concurrencyLimiter.acquire(tenantId);
  // ... upload
} finally {
  concurrencyLimiter.release(tenantId);
}
```

### Fix #069: Remove useCallback

```typescript
// BEFORE
const handleClick = useCallback(() => {
  fileInputRef.current?.click();
}, [disabled, isUploading]);

// AFTER
onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
```

---

## Test Coverage Goals

After fixes, aim for:

- **Unit tests**: All validation paths (MIME, size, concurrency)
- **Integration tests**: Cross-tenant isolation, file cleanup
- **E2E tests**: Upload → verify → delete flow

```bash
# Key test scenarios
npm test -- upload.service.test.ts  # Validation + DI
npm test -- segment.service.test.ts # Cleanup logic
npm run test:e2e -- segment-image-upload.spec.ts # Full flow
```

---

## Deployment Checklist

- [ ] All P1 issues fixed and tested
- [ ] Supabase bucket is PRIVATE (not public)
- [ ] Signed URLs generated with 1-year expiry
- [ ] Rate limits: IP=200/hr, Tenant=50/hr
- [ ] Concurrency limits: Max 3 per tenant
- [ ] MIME validation includes magic byte check
- [ ] File cleanup on segment deletion working
- [ ] All tests passing (npm test)
- [ ] TypeScript compiles (npm run typecheck)
- [ ] E2E tests pass (npm run test:e2e)

---

## Risk Mitigation

| Risk                       | Probability | Impact                 | Mitigation                                        |
| -------------------------- | ----------- | ---------------------- | ------------------------------------------------- |
| Signed URL expires         | Low         | User sees broken image | 1-year expiry, refresh on demand                  |
| Rate limit too strict      | Medium      | Users frustrated       | Monitor metrics, adjust 50→100 if needed          |
| OOM still possible         | Low         | Crash under attack     | Concurrency limit + rate limit = defense in depth |
| Cross-tenant access        | Low         | Data leak              | Verify `tenantId` in all paths                    |
| File delete fails silently | Low         | Storage bloat          | Log warnings, add monitoring                      |

---

## Files to Create/Modify

### New Files

- `server/src/lib/concurrency-limiter.ts`
- `server/src/adapters/supabase/supabase-storage.adapter.ts`
- `server/src/adapters/mock/mock-storage.adapter.ts`

### Modified Files

- `server/src/services/upload.service.ts` (major refactor)
- `server/src/services/segment.service.ts` (add cleanup)
- `server/src/di.ts` (wire StorageProvider)
- `server/src/routes/tenant-admin.routes.ts` (rate limit, concurrency)
- `server/src/middleware/rateLimiter.ts` (add tenant limiter)
- `server/src/lib/ports.ts` (add StorageProvider interface)
- `client/src/components/ImageUploadField.tsx` (remove useCallback)
- `server/test/services/upload.service.test.ts` (add security tests)

---

## Questions to Answer Before Starting

1. **Signed URL Expiry:** 1 year ok? (Consider: cost, security, UX)
2. **Rate Limits:** 50 uploads/hour per tenant ok? (Typical usage?)
3. **Concurrency:** Max 3 per tenant ok? (Test with actual users?)
4. **Cleanup:** Delete on update too, or just on delete? (Phase 2?)
5. **Monitoring:** Alert on rate limit hits? On OOM? (Observability?)

---

## Emergency Rollback Plan

If issues arise during deployment:

1. **Signed URL broken** → Fall back to public bucket + RLS
2. **Rate limit too strict** → Increase to 100/hour
3. **Concurrency too low** → Increase to 5/tenant
4. **Delete fails** → Disable cleanup, skip to next phase

All fixes are backwards compatible except the DI refactor (Phase 2).
