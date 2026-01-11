# File Upload Security - Quick Reference Card

**Print this and pin to your desk!**

---

## The 7 Critical Rules

### 1. ALWAYS Include TenantId in Paths

```typescript
✅ const path = `${tenantId}/logos/${filename}`;
❌ const path = `logos/${filename}`;
```

**Why:** Prevents cross-tenant file access

### 2. VALIDATE FILE CONTENT (Magic Bytes)

```typescript
✅ const detected = await fileType.fromBuffer(buffer);
   if (!ALLOWED_TYPES.includes(detected.mime)) throw;

❌ if (!ALLOWED_TYPES.includes(file.mimetype)) throw;
```

**Why:** Prevents MIME spoofing (PNG file with .jpg extension)

### 3. VERIFY OWNERSHIP Before Delete

```typescript
✅ const file = await db.file.findFirst({
     where: { tenantId, folder, filename }
   });
   if (!file) throw new NotFoundError();

❌ await supabase.storage.from('images').remove([filename]);
```

**Why:** Prevents unauthorized file deletion across tenants

### 4. RATE LIMIT Uploads

```typescript
✅ router.post('/upload', rateLimiter, async (req, res) => {...})

❌ router.post('/upload', async (req, res) => {...})
```

**Why:** Prevents memory exhaustion and denial of service

### 5. Use DEPENDENCY INJECTION (Not Singletons)

```typescript
✅ constructor(private uploadService: UploadService) {}

❌ import { uploadService } from './services';
```

**Why:** Makes code testable and maintainable

### 6. Cleanup Files on Entity Delete

```typescript
✅ await deleteFile(tenantId, folder, filename);
   await db.package.delete({where: {id}});

❌ await db.package.delete({where: {id}});
```

**Why:** Prevents orphaned files and quota exhaustion

### 7. Handle ERRORS Without Leaking Data

```typescript
✅ throw new Error('Upload failed');

❌ throw new Error(`Failed: ${filepath}, ${err.message}`);
```

**Why:** Prevents information disclosure

---

## Red Flags Checklist

| Red Flag                     | Fix                          |
| ---------------------------- | ---------------------------- |
| ❌ No tenantId in path       | Add: `${tenantId}/` prefix   |
| ❌ Only MIME type check      | Add: Magic byte validation   |
| ❌ Public bucket             | Make bucket private, use RLS |
| ❌ No ownership verification | Query DB before delete       |
| ❌ No rate limiting          | Add `rateLimit` middleware   |
| ❌ Singleton import          | Inject via constructor       |
| ❌ No cleanup on delete      | Cascade delete files         |
| ❌ Large file buffers        | Stream instead of buffer     |
| ❌ SVG allowed unsanitized   | Reject or sanitize           |
| ❌ Error shows filepath      | Use generic message          |

---

## File Size Limits

| Upload Type   | Limit | Where                    |
| ------------- | ----- | ------------------------ |
| Logo          | 2 MB  | `MAX_UPLOAD_SIZE_MB` env |
| Package Photo | 5 MB  | `maxPackagePhotoSizeMB`  |
| Segment Hero  | 5 MB  | `maxPackagePhotoSizeMB`  |

**Enforce at TWO levels:**

1. Multer config: `limits: { fileSize: 5 * 1024 * 1024 }`
2. Service validation: `if (size > limit) throw`

---

## Allowed MIME Types

✅ `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/svg+xml`

❌ GIF, PDF, BMP, TIFF, WEBM, MP4, ZIP, EXE, etc.

---

## Rate Limit Settings

**Current:** 10 uploads / minute / tenant

If exceeded → `429 Too Many Requests`

**Test with:**

```bash
for i in {1..15}; do curl -X POST ... & done; wait
```

Should succeed: 1-10, fail: 11-15

---

## Magic Byte Examples

| Format | Header        | Code                 |
| ------ | ------------- | -------------------- |
| PNG    | `89 50 4E 47` | `buffer[0] === 0x89` |
| JPEG   | `FF D8 FF`    | `buffer[0] === 0xFF` |
| ZIP    | `50 4B 03 04` | `buffer[0] === 0x50` |

**Use library:** `npm install file-type`

```typescript
import { fileType } from 'file-type';
const detected = await fileType.fromBuffer(buffer);
```

---

## Testing Checklist

### Unit Tests

- [ ] File size validation (under/over/exact limits)
- [ ] MIME type rejection (invalid types)
- [ ] Magic byte spoofing detection (PNG in .jpg)
- [ ] Path traversal prevention (`../../../etc`)
- [ ] Filename generation (unique, safe)

### Integration Tests

- [ ] Cascade delete files with package
- [ ] Orphaned file detection
- [ ] Cross-tenant isolation

### Security Tests

- [ ] MIME spoofing (PNG header + JPEG ext)
- [ ] ZIP file disguised as image
- [ ] SVG with script tags (if allowed)
- [ ] Path traversal in filename

### Load Tests

- [ ] Concurrent uploads (20x 5MB = 100MB)
- [ ] Rate limiting enforcement
- [ ] Memory usage stays < 150MB increase

---

## Common Mistakes

### ❌ Only Check MIME Type

```typescript
if (!ALLOWED.includes(file.mimetype)) throw; // Not enough!
```

### ✅ Check MIME + Magic Bytes

```typescript
if (!ALLOWED.includes(file.mimetype)) throw;
const detected = await fileType.fromBuffer(file.buffer);
if (!detected || !ALLOWED.includes(detected.mime)) throw;
```

---

### ❌ No Tenant Scoping

```typescript
const path = `logos/${filename}`; // Oops!
```

### ✅ Include TenantId

```typescript
const path = `${tenantId}/logos/${filename}`; // Safe
```

---

### ❌ No Ownership Check Before Delete

```typescript
await supabase.storage.from('images').remove([filename]);
```

### ✅ Verify First

```typescript
const file = await db.file.findFirst({
  where: { tenantId, folder, filename }
});
if (!file) throw new NotFoundError();
await supabase.storage.from('images').remove([...]);
```

---

## Environment Variables

### Mock Mode

```bash
ADAPTERS_PRESET=mock
# Files saved to: ./uploads/{logos,packages,segments}/
```

### Real Mode

```bash
ADAPTERS_PRESET=real
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...
```

---

## Useful Commands

```bash
# Run tests
npm test -- upload.service.test.ts

# Run with coverage
npm test -- upload.service.test.ts --coverage

# E2E tests
npm run test:e2e -- upload.spec.ts

# Start in mock mode
ADAPTERS_PRESET=mock npm run dev:api

# View Supabase files
psql $DATABASE_URL -c "SELECT * FROM storage.objects WHERE bucket_id = 'images';"
```

---

## Who to Ask

| Topic           | Contact           |
| --------------- | ----------------- |
| Supabase config | DevOps / Platform |
| Rate limiting   | Middleware owner  |
| Security audit  | Security team     |
| Storage quota   | DevOps            |
| File lifecycle  | Product           |

---

## References

- **FILE_UPLOAD_PREVENTION_GUIDE.md** - Full guide (this file's companion)
- **CLAUDE.md** - Project patterns
- **upload.service.ts** - Implementation reference
- **upload.service.test.ts** - Test examples

---

## SOS (Emergency Issues)

### Storage Quota Exceeded

```bash
# List files by tenant
psql $DATABASE_URL << 'SQL'
SELECT bucket_id, COUNT(*) as file_count, SUM(metadata::json->>'size')::bigint as total_bytes
FROM storage.objects
GROUP BY bucket_id;
SQL

# Find large files
psql $DATABASE_URL << 'SQL'
SELECT name, metadata::json->>'size' as size_bytes
FROM storage.objects
WHERE bucket_id = 'images'
ORDER BY (metadata::json->>'size')::bigint DESC
LIMIT 20;
SQL
```

### Orphaned Files

```bash
# Find files with no matching package/segment
psql $DATABASE_URL << 'SQL'
SELECT name
FROM storage.objects
WHERE bucket_id = 'images'
  AND name LIKE '%packages/%'
  AND name NOT IN (
    SELECT photoFilename FROM packages WHERE photoFilename IS NOT NULL
  );
SQL
```

### Stuck Uploads

```bash
# Check logs for errors
kubectl logs -f deployment/api | grep upload

# Check multer temp files
ls -la /tmp/upload-* | head -20
```

---

**Last Updated:** November 2025
**Status:** In Review
**Owner:** Engineering Team
