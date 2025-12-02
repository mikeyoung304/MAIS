# Package Photo Upload API - Implementation Guide

## Overview

This implementation provides a complete API service layer for handling package photo uploads in the MAIS business growth platform. It includes TypeScript type safety, comprehensive error handling, and React hooks for easy component integration.

## Files Created

1. **`/Users/mikeyoung/CODING/MAIS/client/src/lib/package-photo-api.ts`**
   - Core API service with upload/delete/fetch methods
   - TypeScript types and interfaces
   - Error handling utilities
   - Client-side validation

2. **`/Users/mikeyoung/CODING/MAIS/client/src/hooks/usePackagePhotos.ts`**
   - React hook for photo management
   - State management (loading, error, uploading)
   - Optimistic UI updates

3. **`/Users/mikeyoung/CODING/MAIS/client/src/lib/package-photo-api.test.example.ts`**
   - Example usage scenarios
   - Utility functions
   - Type definitions

## Architecture

### API Client Pattern

The implementation follows the existing API patterns in the codebase:

- **Authentication**: Uses `tenantToken` from localStorage (same as existing API)
- **Base URL**: Reuses `baseUrl` from `/src/lib/api.ts`
- **Error Handling**: Uses `ApiError` class from `/src/lib/api-helpers.ts`
- **HTTP Client**: Uses native `fetch` API for multipart/form-data support

### Backend Endpoints

```
POST   /v1/tenant/admin/packages/:id/photos
DELETE /v1/tenant/admin/packages/:id/photos/:filename
GET    /v1/tenant/admin/packages/:id
GET    /v1/tenant/admin/packages
```

## Usage Examples

### Basic Upload

```typescript
import { packagePhotoApi } from '@/lib/package-photo-api';

async function handleUpload(packageId: string, file: File) {
  try {
    const photo = await packagePhotoApi.uploadPhoto(packageId, file);
    console.log('Uploaded:', photo.url);
  } catch (error) {
    console.error('Upload failed:', error.message);
  }
}
```

### Using React Hook

```typescript
import { usePackagePhotos } from '@/hooks/usePackagePhotos';

function PackagePhotoManager({ packageId }: { packageId: string }) {
  const {
    photos,
    loading,
    error,
    uploadPhoto,
    deletePhoto,
    uploading,
  } = usePackagePhotos(packageId);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadPhoto(file);
    if (result) {
      alert('Photo uploaded successfully!');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
        accept="image/*"
        disabled={uploading}
      />

      <div className="photo-grid">
        {photos.map((photo) => (
          <div key={photo.filename}>
            <img src={photo.url} alt={`Photo ${photo.order}`} />
            <button onClick={() => deletePhoto(photo.filename)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Client-Side Validation

```typescript
import { photoValidation } from '@/lib/package-photo-api';

function validateBeforeUpload(file: File, currentPhotoCount: number) {
  // Validate file
  const fileError = photoValidation.validateFile(file);
  if (fileError) {
    alert(fileError);
    return false;
  }

  // Validate photo count
  const countError = photoValidation.validatePhotoCount(currentPhotoCount);
  if (countError) {
    alert(countError);
    return false;
  }

  return true;
}
```

## TypeScript Types

### PackagePhoto

```typescript
interface PackagePhoto {
  url: string;        // "http://localhost:3001/uploads/packages/package-123.jpg"
  filename: string;   // "package-123.jpg"
  size: number;       // 245678 (bytes)
  order: number;      // 0-4 (max 5 photos)
}
```

### PackageWithPhotos

```typescript
interface PackageWithPhotos {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  photoUrl?: string;
  photos?: PackagePhoto[];
}
```

## Error Handling

### HTTP Status Codes

| Code | Message | Cause |
|------|---------|-------|
| 401 | "Authentication required. Please log in again." | No/invalid JWT token |
| 403 | "You don't have permission to perform this action." | Package belongs to different tenant |
| 404 | "Package not found." | Invalid package ID |
| 413 | "File too large (maximum 5MB allowed)." | File exceeds 5MB limit |
| 400 | Various | Invalid file type, max photos reached, etc. |

### Error Example

```typescript
try {
  await packagePhotoApi.uploadPhoto(packageId, file);
} catch (error) {
  if (error instanceof ApiError) {
    console.error('Status:', error.statusCode);
    console.error('Message:', error.message); // User-friendly
    console.error('Code:', error.code);       // Original error
  }
}
```

## Validation Rules

### File Validation

- **Max Size**: 5MB
- **Allowed Types**: JPG, PNG, WebP, SVG
- **Max Photos**: 5 per package

### Validation Constants

```typescript
photoValidation.MAX_FILE_SIZE           // 5 * 1024 * 1024 bytes
photoValidation.MAX_PHOTOS_PER_PACKAGE  // 5
photoValidation.ALLOWED_MIME_TYPES      // ['image/jpeg', 'image/png', ...]
```

## FormData Handling

### Critical Details

1. **Field Name**: Must be `'photo'` to match backend multer config
2. **Content-Type**: DO NOT set manually - browser sets it with boundary
3. **File Object**: Must be native File object from input[type="file"]

```typescript
const formData = new FormData();
formData.append('photo', file);  // ← field name MUST be 'photo'

fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    // NO 'Content-Type' header - browser adds it
  },
  body: formData,
});
```

## Integration with Existing Code

### Follows Existing Patterns

1. **API Base URL**: Uses `baseUrl` from `/src/lib/api.ts`
2. **Authentication**: Uses `tenantToken` from localStorage
3. **Error Handling**: Uses `ApiError` class
4. **File Structure**: Follows `/src/lib/` and `/src/hooks/` convention

### No Conflicts

- Does NOT modify existing API client
- Does NOT duplicate authentication logic
- Does NOT override existing types

## Testing with Backend

### Local Development

```bash
# Backend should be running on:
http://localhost:3001

# Photo URLs will be:
http://localhost:3001/uploads/packages/package-{timestamp}-{random}.jpg
```

### Authentication

1. Login as tenant admin to get JWT token
2. Token is automatically stored in `localStorage.tenantToken`
3. API service reads token automatically

### Manual Testing

```typescript
// In browser console:
const file = document.querySelector('input[type="file"]').files[0];
const photo = await packagePhotoApi.uploadPhoto('your-package-id', file);
console.log(photo);
```

## Component Integration Example

```typescript
// src/pages/tenant/PackageEditPage.tsx
import { usePackagePhotos } from '@/hooks/usePackagePhotos';
import { useParams } from 'react-router-dom';

export function PackageEditPage() {
  const { packageId } = useParams();
  const {
    photos,
    loading,
    error,
    uploadPhoto,
    deletePhoto,
    uploading,
    deleting,
  } = usePackagePhotos(packageId!);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const photo = await uploadPhoto(file);
    if (photo) {
      toast.success('Photo uploaded!');
    } else if (error) {
      toast.error(error.message);
    }
  };

  return (
    <div>
      <h1>Manage Package Photos</h1>

      {error && <div className="error">{error.message}</div>}

      <div>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading || photos.length >= 5}
        />
        {uploading && <span>Uploading...</span>}
        {photos.length >= 5 && <span>Maximum 5 photos</span>}
      </div>

      <div className="photo-grid">
        {photos.map((photo) => (
          <div key={photo.filename} className="photo-item">
            <img src={photo.url} alt={`Photo ${photo.order + 1}`} />
            <button
              onClick={() => deletePhoto(photo.filename)}
              disabled={deleting === photo.filename}
            >
              {deleting === photo.filename ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Advanced Features

### Optimistic UI Updates

The `usePackagePhotos` hook includes optimistic updates:

- Photos appear immediately after upload starts
- Photos disappear immediately when delete is triggered
- Automatic rollback on error

### Loading States

- `loading`: Initial fetch
- `uploading`: Upload in progress
- `deleting`: Delete in progress (stores filename)

### Error Recovery

- Errors are stored in `error` state
- Previous data remains available
- `refetch()` function to retry

## Security Considerations

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Backend verifies package ownership
3. **File Validation**: Both client and server validate files
4. **Size Limits**: Enforced by multer middleware (5MB)
5. **Type Checking**: Only image types allowed

## Future Enhancements

Potential improvements for future versions:

1. **Progress Tracking**: Add upload progress percentage
2. **Image Optimization**: Compress images client-side before upload
3. **Drag & Drop**: File drop zone component
4. **Reordering**: Allow users to reorder photos
5. **Cropping**: Built-in image cropper
6. **Bulk Operations**: Upload/delete multiple photos at once
7. **S3 Integration**: Direct upload to S3 with presigned URLs

## Support

For questions or issues:

1. Check backend routes: `/server/src/routes/tenant-admin.routes.ts`
2. Review upload service: `/server/src/services/upload.service.ts`
3. Check API documentation in code comments
4. Refer to example file: `package-photo-api.test.example.ts`
