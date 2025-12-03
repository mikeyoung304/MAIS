---
status: pending
priority: p2
issue_id: "068"
tags: [code-review, performance, memory, security]
dependencies: []
---

# Memory Exhaustion Risk with Multer memoryStorage

## Problem Statement

File uploads use `multer.memoryStorage()` which loads entire files into RAM. With 5MB files and 100 uploads/hour rate limit, concurrent requests can cause memory spikes of 200-500MB, potentially crashing the server under load or attack.

**Why This Matters:**
- 10 concurrent 5MB uploads = 50MB+ memory spike
- Under attack: 100 requests/minute × 5MB = 500MB consumption
- Node.js GC pressure can cause CPU spikes
- OOM crashes in production

## Findings

### Evidence from Code Review

**Current Configuration:**
```typescript
const upload = multer({
  storage: multer.memoryStorage(), // Entire file in RAM
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});
```

**Memory Impact Analysis:**
```
Normal load: 10 concurrent uploads × 5MB = 50MB
High load: 50 concurrent uploads × 5MB = 250MB
Attack: 100 concurrent uploads × 5MB = 500MB

Plus Node.js overhead, V8 heap, Buffer copies = 2-3x multiplier
Peak memory: 500-1500MB under attack
```

### Performance Oracle Assessment
- CRITICAL: Memory exhaustion risk
- No per-tenant upload concurrency limits
- All file data buffered before processing

## Proposed Solutions

### Option A: Tenant-Level Concurrency Limits (Quick Fix)

**Description:** Limit concurrent uploads per tenant to prevent memory spikes.

**Pros:**
- Quick implementation
- Limits memory per tenant
- Fair resource allocation

**Cons:**
- Doesn't eliminate memory usage
- May queue legitimate uploads
- Semaphore complexity

**Effort:** Small (1-2 hours)
**Risk:** Low

```typescript
// Simple concurrency limiter
const uploadSemaphores = new Map<string, number>();
const MAX_CONCURRENT = 3;

async function checkConcurrency(tenantId: string): Promise<void> {
  const current = uploadSemaphores.get(tenantId) || 0;
  if (current >= MAX_CONCURRENT) {
    throw new Error('Too many concurrent uploads. Please wait.');
  }
  uploadSemaphores.set(tenantId, current + 1);
}

function releaseConcurrency(tenantId: string): void {
  const current = uploadSemaphores.get(tenantId) || 1;
  uploadSemaphores.set(tenantId, Math.max(0, current - 1));
}
```

### Option B: Streaming to Disk + Supabase (Better Long-term)

**Description:** Use diskStorage temporarily, then stream to Supabase.

**Pros:**
- Minimal memory usage
- Handles large files
- More scalable

**Cons:**
- More complex implementation
- Temp file cleanup needed
- Disk I/O overhead

**Effort:** Medium (3-4 hours)
**Risk:** Medium

```typescript
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/uploads',
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Then stream to Supabase
const fileStream = fs.createReadStream(file.path);
await supabase.storage.from('images').upload(storagePath, fileStream);
fs.unlinkSync(file.path); // Clean up
```

### Option C: Direct-to-Supabase Signed URLs (Best UX)

**Description:** Generate signed upload URLs, client uploads directly to Supabase.

**Pros:**
- Zero server memory usage
- Faster uploads (no double-hop)
- Supabase handles all storage

**Cons:**
- More complex client implementation
- Need upload confirmation flow
- Signed URL security considerations

**Effort:** High (4-6 hours)
**Risk:** Medium

## Recommended Action

**Option A** for immediate protection, then **Option B or C** for production scaling.

## Technical Details

**Affected Files:**
- `server/src/routes/tenant-admin.routes.ts` - Add concurrency check
- `server/src/services/upload.service.ts` - Concurrency helpers
- `server/src/middleware/upload.middleware.ts` - Optional: disk storage

## Acceptance Criteria

- [ ] Max 3 concurrent uploads per tenant enforced
- [ ] Exceeded concurrency returns 429 with clear message
- [ ] Memory usage monitored during load test
- [ ] No OOM under 50 concurrent upload attempts

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-29 | Created | Found during code review - Performance Oracle |

## Resources

- Multer disk storage: https://www.npmjs.com/package/multer#diskstorage
- Supabase signed uploads: https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
