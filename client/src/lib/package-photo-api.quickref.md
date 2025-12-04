# Package Photo API - Quick Reference

## Import

```typescript
import { packagePhotoApi, photoValidation } from '@/lib/package-photo-api';
import { usePackagePhotos } from '@/hooks/usePackagePhotos';
```

---

## API Functions

### Upload Photo

```typescript
const photo = await packagePhotoApi.uploadPhoto(packageId, file);
// Returns: { url, filename, size, order }
```

### Delete Photo

```typescript
await packagePhotoApi.deletePhoto(packageId, filename);
// Returns: void (204 No Content)
```

### Get Package with Photos

```typescript
const pkg = await packagePhotoApi.getPackageWithPhotos(packageId);
// Returns: { id, slug, title, ..., photos: [...] }
```

### Get All Packages

```typescript
const packages = await packagePhotoApi.getAllPackages();
// Returns: PackageWithPhotos[]
```

---

## Validation

### Validate File

```typescript
const error = photoValidation.validateFile(file);
if (error) {
  alert(error); // "File too large (2.5MB). Maximum size is 5MB."
  return;
}
```

### Validate Photo Count

```typescript
const error = photoValidation.validatePhotoCount(currentCount);
if (error) {
  alert(error); // "Maximum 5 photos per package..."
  return;
}
```

### Constants

```typescript
photoValidation.MAX_FILE_SIZE; // 5 * 1024 * 1024
photoValidation.MAX_PHOTOS_PER_PACKAGE; // 5
photoValidation.ALLOWED_MIME_TYPES; // ['image/jpeg', 'image/png', ...]
```

---

## React Hook

### Basic Usage

```typescript
const {
  photos, // PackagePhoto[]
  loading, // boolean
  error, // Error | null
  uploadPhoto, // (file: File) => Promise<PackagePhoto | null>
  deletePhoto, // (filename: string) => Promise<boolean>
  uploading, // boolean
  deleting, // string | null (filename being deleted)
} = usePackagePhotos(packageId);
```

### Upload Example

```typescript
const handleUpload = async (file: File) => {
  const photo = await uploadPhoto(file);
  if (photo) {
    console.log('Success:', photo.url);
  } else if (error) {
    console.error('Failed:', error.message);
  }
};
```

### Delete Example

```typescript
const handleDelete = async (filename: string) => {
  const success = await deletePhoto(filename);
  if (success) {
    console.log('Deleted!');
  }
};
```

---

## Error Handling

### Try-Catch Pattern

```typescript
try {
  const photo = await packagePhotoApi.uploadPhoto(packageId, file);
  console.log('Success!');
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 401: // Redirect to login
      case 403: // Show permission error
      case 413: // Show file size error
      case 404: // Show not found error
      default: // Show generic error
    }
  }
}
```

### Error Messages

- **401:** "Authentication required. Please log in again."
- **403:** "You don't have permission to perform this action."
- **404:** "Package not found."
- **413:** "File too large (maximum 5MB allowed)."
- **400:** Varies (validation errors)

---

## Complete Component Example

```typescript
import { usePackagePhotos } from '@/hooks/usePackagePhotos';

function PhotoManager({ packageId }: { packageId: string }) {
  const { photos, uploadPhoto, deletePhoto, uploading } = usePackagePhotos(packageId);

  return (
    <div>
      <input
        type="file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) await uploadPhoto(file);
        }}
        disabled={uploading}
      />

      {photos.map(photo => (
        <div key={photo.filename}>
          <img src={photo.url} alt="" />
          <button onClick={() => deletePhoto(photo.filename)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## FormData Details

### Critical: Field Name Must Be 'photo'

```typescript
const formData = new FormData();
formData.append('photo', file); // ← MUST be 'photo'
```

### Critical: Don't Set Content-Type

```typescript
fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
    // NO Content-Type header!
  },
  body: formData,
});
```

---

## Types

```typescript
interface PackagePhoto {
  url: string;
  filename: string;
  size: number;
  order: number;
}

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

---

## Validation Rules

- **Max File Size:** 5MB
- **Max Photos:** 5 per package
- **Allowed Types:** JPG, PNG, WebP, SVG
- **Field Name:** 'photo' (backend requirement)

---

## Backend Endpoints

```
POST   /v1/tenant/admin/packages/:id/photos
DELETE /v1/tenant/admin/packages/:id/photos/:filename
GET    /v1/tenant/admin/packages/:id
GET    /v1/tenant/admin/packages
```

---

## File Locations

```
src/lib/package-photo-api.ts              # Core API service
src/hooks/usePackagePhotos.ts             # React hook
src/components/PackagePhotoUpload.example.tsx  # Example component
src/lib/PACKAGE_PHOTO_API_README.md       # Full documentation
```

---

## Testing

```typescript
// Browser console
const file = document.querySelector('input[type="file"]').files[0];
const photo = await packagePhotoApi.uploadPhoto('pkg_id', file);
console.log(photo);
```

---

## Common Pitfalls

❌ **Wrong field name**

```typescript
formData.append('file', file); // WRONG!
```

✅ **Correct field name**

```typescript
formData.append('photo', file); // CORRECT!
```

❌ **Setting Content-Type**

```typescript
headers: { 'Content-Type': 'multipart/form-data' } // WRONG!
```

✅ **Let browser set it**

```typescript
headers: { 'Authorization': `Bearer ${token}` } // CORRECT!
```

❌ **Not validating first**

```typescript
await uploadPhoto(file); // No validation
```

✅ **Validate before upload**

```typescript
const error = photoValidation.validateFile(file);
if (error) return;
await uploadPhoto(file);
```

---

## Need Help?

1. Check **PACKAGE_PHOTO_API_README.md** for detailed docs
2. See **package-photo-api.test.example.ts** for usage examples
3. Review **PackagePhotoUpload.example.tsx** for component integration
4. Backend code: **/server/src/routes/tenant-admin.routes.ts**
