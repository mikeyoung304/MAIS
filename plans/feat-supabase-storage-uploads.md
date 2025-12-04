# Supabase Storage Image Uploads - Implementation Plan

## Overview

Enable drag-drop image uploads with cloud storage via Supabase Storage for the MAIS multi-tenant business platform. This replaces URL-only inputs with a modern upload experience while maintaining mock mode filesystem support.

**Architecture:** `Client (drag-drop) → API (multer) → Supabase Storage → CDN URL returned`

## Problem Statement / Motivation

Currently, the MAIS platform only supports image URLs pasted manually:

- Tenants cannot upload images directly from their devices
- No drag-drop or click-to-browse functionality
- Poor mobile experience for business owners on the go
- Backend stores files locally (not scalable for production)

This feature enables:

- Enterprise-grade image upload UX
- Cloud storage via Supabase Storage CDN
- Tenant-isolated file organization
- Seamless mobile uploads

## Technical Approach

### Architecture Decision

**Proxy uploads through API** (not signed URLs):

- Simpler implementation - works with existing JWT auth
- Single `images` bucket with tenant-scoped paths: `{tenantId}/logos/`, `{tenantId}/packages/`, `{tenantId}/segments/`
- Mock mode continues using local filesystem
- Real mode uses Supabase Storage with service role key (bypasses RLS)

### File Structure in Supabase Storage

```
images/
├── {tenantId}/
│   ├── logos/
│   │   └── logo-{timestamp}-{random}.{ext}
│   ├── packages/
│   │   └── package-{timestamp}-{random}.{ext}
│   └── segments/
│       └── segment-{timestamp}-{random}.{ext}
```

## Files to Modify

### Backend

| File                                       | Change                                                 |
| ------------------------------------------ | ------------------------------------------------------ |
| `server/src/services/upload.service.ts`    | Add Supabase upload methods alongside filesystem       |
| `server/src/di.ts`                         | Inject Supabase client into UploadService in real mode |
| `server/src/routes/tenant-admin.routes.ts` | Add `/segment-image` endpoint                          |

### Frontend

| File                                                            | Change                                       |
| --------------------------------------------------------------- | -------------------------------------------- |
| `client/src/components/ImageUploadField.tsx`                    | **NEW:** Reusable drag-drop upload component |
| `client/src/features/admin/segments/SegmentForm/HeroFields.tsx` | Replace URL input with ImageUploadField      |

---

## Implementation Phases

### Phase 1: Backend - UploadService Refactor

**File:** `server/src/services/upload.service.ts`

#### 1.1 Update Constructor

The current UploadService is a singleton with no DI. Refactor to accept config and optional Supabase client:

```typescript
// Current: singleton with no dependencies
export const uploadService = new UploadService();

// New: Accept config and optional Supabase client
import { SupabaseClient } from '@supabase/supabase-js';

export class UploadService {
  constructor(
    private readonly config: { ADAPTERS_PRESET: string; API_BASE_URL: string },
    private readonly supabase?: SupabaseClient
  ) {
    // Keep existing directory initialization for mock mode
    if (config.ADAPTERS_PRESET !== 'real') {
      this.ensureDirectories();
    }
  }
}
```

#### 1.2 Add Supabase Upload Method

```typescript
private async uploadToSupabase(
  tenantId: string,
  folder: 'logos' | 'packages' | 'segments',
  filename: string,
  file: { buffer: Buffer; mimetype: string; size: number }
): Promise<UploadResult> {
  const path = `${tenantId}/${folder}/${filename}`;

  const { error } = await this.supabase!.storage
    .from('images')
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    logger.error('Supabase upload failed', { tenantId, folder, error: error.message });
    throw new Error('Failed to upload image');
  }

  // Construct public URL directly (more reliable than getPublicUrl)
  const supabaseUrl = process.env.SUPABASE_URL;
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/images/${path}`;

  return {
    url: publicUrl,
    filename,
    size: file.size,
    mimetype: file.mimetype
  };
}
```

#### 1.3 Modify Existing Upload Methods

Update `uploadLogo` and `uploadPackagePhoto` to conditionally use Supabase:

```typescript
async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  // Validate file type and size (existing logic)
  this.validateFile(file);

  const filename = this.generateFilename(file.originalname);

  if (this.config.ADAPTERS_PRESET === 'real' && this.supabase) {
    return this.uploadToSupabase(tenantId, 'logos', filename, file);
  } else {
    return this.uploadToFilesystem('logos', filename, file);
  }
}

async uploadPackagePhoto(file: UploadedFile, packageId: string, tenantId: string): Promise<UploadResult> {
  // Note: Now requires tenantId parameter for Supabase path
  this.validateFile(file);

  const filename = this.generateFilename(file.originalname);

  if (this.config.ADAPTERS_PRESET === 'real' && this.supabase) {
    return this.uploadToSupabase(tenantId, 'packages', filename, file);
  } else {
    return this.uploadToFilesystem('packages', filename, file);
  }
}

// NEW: Add segment image upload method
async uploadSegmentImage(file: UploadedFile, tenantId: string): Promise<UploadResult> {
  this.validateFile(file);

  const filename = this.generateFilename(file.originalname);

  if (this.config.ADAPTERS_PRESET === 'real' && this.supabase) {
    return this.uploadToSupabase(tenantId, 'segments', filename, file);
  } else {
    return this.uploadToFilesystem('segments', filename, file);
  }
}
```

#### 1.4 Add Delete Methods for Supabase

```typescript
private async deleteFromSupabase(
  tenantId: string,
  folder: 'logos' | 'packages' | 'segments',
  filename: string
): Promise<void> {
  const path = `${tenantId}/${folder}/${filename}`;

  const { error } = await this.supabase!.storage
    .from('images')
    .remove([path]);

  if (error) {
    logger.warn('Supabase delete failed', { path, error: error.message });
    // Don't throw - file may already be deleted
  }
}

async deleteLogo(filename: string, tenantId?: string): Promise<void> {
  if (this.config.ADAPTERS_PRESET === 'real' && this.supabase && tenantId) {
    return this.deleteFromSupabase(tenantId, 'logos', filename);
  } else {
    return this.deleteFromFilesystem('logos', filename);
  }
}
```

---

### Phase 2: Backend - DI Wiring

**File:** `server/src/di.ts`

The UploadService is currently a direct singleton import. Integrate it into the DI container:

```typescript
import { getSupabaseClient } from './config/database';
import { UploadService } from './services/upload.service';

// In createRealContainer():
const supabaseClient = getSupabaseClient(); // Service role client (bypasses RLS)

const uploadService = new UploadService(
  {
    ADAPTERS_PRESET: 'real',
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
  },
  supabaseClient
);

// In createMockContainer():
const uploadService = new UploadService(
  {
    ADAPTERS_PRESET: 'mock',
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
  }
  // No Supabase client - uses filesystem
);

// Add to Container interface
export interface Container {
  // ... existing services
  uploadService: UploadService;
}
```

---

### Phase 3: Backend - New Endpoint

**File:** `server/src/routes/tenant-admin.routes.ts`

Add new endpoint for segment hero images (reuse existing multer config pattern):

```typescript
// Add new multer config for segment images (5MB limit like package photos)
const uploadSegmentImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Add route after existing upload routes
router.post(
  '/segment-image',
  uploadSegmentImage.single('file'),
  handleMulterError,
  async (req: Request, res: Response) => {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      const result = await container.uploadService.uploadSegmentImage(
        req.file as UploadedFile,
        tenantAuth.tenantId
      );
      res.status(201).json(result);
    } catch (error) {
      logger.error('Segment image upload failed', {
        tenantId: tenantAuth.tenantId,
        error,
      });
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }
);
```

---

### Phase 4: Frontend - ImageUploadField Component

**File:** `client/src/components/ImageUploadField.tsx` (NEW)

Create reusable drag-drop upload component following existing patterns from `PhotoUploadButton.tsx`:

```tsx
import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  uploadEndpoint: string;
  disabled?: boolean;
  maxSizeMB?: number;
  className?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];

export function ImageUploadField({
  label,
  value,
  onChange,
  uploadEndpoint,
  disabled = false,
  maxSizeMB = 5,
  className = '',
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Allowed: JPG, PNG, WebP, SVG';
    }
    return null;
  };

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('tenantToken');
        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed (${response.status})`);
        }

        const data = await response.json();
        onChange(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    },
    [uploadEndpoint, onChange, maxSizeMB]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled && !isUploading) {
        setIsDragging(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        uploadFile(file);
      }
    },
    [disabled, isUploading, uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [uploadFile]
  );

  const handleRemove = useCallback(() => {
    onChange('');
    setError(null);
  }, [onChange]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-white/90 text-lg">{label}</Label>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Upload zone or preview */}
      {value ? (
        // Image preview with remove button
        <div className="relative group w-32 h-32">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-full object-cover rounded-lg border border-white/20"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // Drag-drop zone
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center gap-2 p-6
            border-2 border-dashed rounded-lg cursor-pointer
            transition-colors duration-200
            ${
              isDragging
                ? 'border-macon-orange bg-macon-orange/10'
                : 'border-white/20 hover:border-white/40'
            }
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-white/60 animate-spin" />
              <span className="text-sm text-white/60">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-white/60" />
              <span className="text-sm text-white/60">Drag & drop or click to upload</span>
              <span className="text-xs text-white/40">Max {maxSizeMB}MB - JPG, PNG, WebP, SVG</span>
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
```

---

### Phase 5: Frontend - Update HeroFields

**File:** `client/src/features/admin/segments/SegmentForm/HeroFields.tsx`

Replace the URL input with the new ImageUploadField:

```tsx
import { ImageUploadField } from '@/components/ImageUploadField';
import { baseUrl } from '@/lib/api';

// In the component, replace the heroImage Input section with:
<ImageUploadField
  label="Hero Image"
  value={heroImage}
  onChange={onHeroImageChange}
  uploadEndpoint={`${baseUrl}/v1/tenant-admin/segment-image`}
  disabled={disabled}
  maxSizeMB={5}
/>;
```

---

### Phase 6: Supabase Setup (Manual)

#### 6.1 Create Storage Bucket

In Supabase Dashboard → Storage:

1. Click "New bucket"
2. Name: `images`
3. Public bucket: **Yes** (toggle on)
4. File size limit: 5MB (5242880 bytes)
5. Click "Create bucket"

Or via SQL:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('images', 'images', true, 5242880);
```

#### 6.2 Add RLS Policy for Public Read

Run this SQL in Supabase SQL Editor:

```sql
-- Allow anyone to read files from images bucket
CREATE POLICY "Public read access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'images');
```

**Note:** No INSERT/UPDATE/DELETE policies needed - service role key bypasses RLS for server-side uploads.

---

## Acceptance Criteria

### Functional Requirements

- [ ] Drag-drop upload works on desktop browsers
- [ ] Click-to-browse works as fallback
- [ ] Upload works on mobile devices (iOS Safari, Android Chrome)
- [ ] Image preview displays after successful upload
- [ ] Remove button clears the image and allows re-upload
- [ ] Error shown for files exceeding 5MB
- [ ] Error shown for non-image file types
- [ ] Mock mode continues using local filesystem
- [ ] Real mode uploads to Supabase Storage

### Non-Functional Requirements

- [ ] Upload completes in < 3 seconds for typical images (< 2MB)
- [ ] Component is accessible (keyboard navigation, screen reader support)
- [ ] Visual feedback during upload (loading spinner)
- [ ] Graceful error handling with user-friendly messages

### Quality Gates

- [ ] All existing tests pass (`npm test`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] E2E tests pass in mock mode
- [ ] Manual testing in real mode with Supabase

---

## Not in Scope

- Signed URL / direct-to-Supabase uploads (adds complexity)
- Image optimization / thumbnails (future enhancement)
- Bulk upload / multiple files at once
- Progress percentage bar (spinner is sufficient for MVP)
- Image cropping / editing

---

## Risk Analysis

| Risk                       | Likelihood | Impact | Mitigation                                       |
| -------------------------- | ---------- | ------ | ------------------------------------------------ |
| Supabase rate limits       | Low        | Medium | Use service role key, implement retry logic      |
| Large file uploads timeout | Medium     | Low    | Enforce 5MB limit, show clear errors             |
| CDN cache staleness        | Low        | Low    | Use unique filenames with timestamps             |
| Cross-tenant file access   | Low        | High   | Always scope paths by tenantId, verify in routes |

---

## Testing Strategy

### Unit Tests

- `upload.service.test.ts`: Test both filesystem and Supabase paths
- Mock Supabase client for isolated testing

### Integration Tests

- Test actual uploads to Supabase in CI with test bucket
- Verify tenant isolation (tenant A can't access tenant B's files)

### E2E Tests

- Add `segment-image-upload.spec.ts`:
  - Upload valid image → verify preview appears
  - Upload oversized file → verify error message
  - Upload invalid type → verify error message
  - Remove uploaded image → verify cleared

---

## Dependencies

### Backend

- `@supabase/supabase-js` - Already installed (v2.84.0)
- `multer` - Already installed (v2.0.2)

### Frontend

- No new dependencies needed
- Uses existing: `lucide-react`, Button, Label components

### Environment Variables

```bash
# Required for real mode (already configured)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...

# Optional (has defaults)
API_BASE_URL=http://localhost:3001
```

---

## References

### Internal

- Current upload service: `server/src/services/upload.service.ts`
- DI container: `server/src/di.ts`
- Tenant-admin routes: `server/src/routes/tenant-admin.routes.ts`
- Existing upload components: `client/src/features/photos/PhotoUploadButton.tsx`
- HeroFields: `client/src/features/admin/segments/SegmentForm/HeroFields.tsx`
- Supabase client config: `server/src/config/database.ts`

### External

- [Supabase Storage Quickstart](https://supabase.com/docs/guides/storage/quickstart)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase getPublicUrl API](https://supabase.com/docs/reference/javascript/storage-from-getpublicurl)
