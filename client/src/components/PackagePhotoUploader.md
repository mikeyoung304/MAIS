# PackagePhotoUploader Component

Production-ready React component for uploading and managing package photos in the MAIS business growth platform.

## Features

- **Photo Grid Display**: Responsive grid layout showing up to 5 photos
- **Upload Functionality**: File picker with drag-and-drop support (coming soon)
- **File Validation**:
  - Max file size: 5MB
  - Allowed types: JPG, PNG, WebP, SVG
- **Delete with Confirmation**: Modal dialog to confirm deletion
- **Loading States**: Visual feedback during upload/delete operations
- **Error Handling**: User-friendly error messages for all edge cases
- **Success Feedback**: Temporary success notifications
- **Photo Ordering**: Shows photo order (1-5) with badges
- **Responsive Design**: Mobile-friendly grid and touch targets
- **TypeScript**: Full type safety

## Installation

The component is already available in the codebase at:

```
/client/src/components/PackagePhotoUploader.tsx
```

## Usage

### Basic Usage

```tsx
import { PackagePhotoUploader } from '@/components/PackagePhotoUploader';

function MyComponent() {
  return (
    <PackagePhotoUploader
      packageId="pkg-123"
      initialPhotos={[]}
      onPhotosChange={(photos) => console.log('Photos updated:', photos)}
    />
  );
}
```

### With Initial Photos

```tsx
const initialPhotos = [
  {
    url: 'http://localhost:5000/uploads/packages/package-1234-abc.jpg',
    filename: 'package-1234-abc.jpg',
    size: 1024000, // bytes
    order: 0,
  },
  // ... more photos
];

<PackagePhotoUploader
  packageId="pkg-123"
  initialPhotos={initialPhotos}
  onPhotosChange={handlePhotosChange}
/>;
```

### With Custom Token

```tsx
<PackagePhotoUploader
  packageId="pkg-123"
  initialPhotos={[]}
  tenantToken="your-jwt-token"
  onPhotosChange={handlePhotosChange}
/>
```

## Props

| Prop             | Type                               | Required | Default | Description                                |
| ---------------- | ---------------------------------- | -------- | ------- | ------------------------------------------ |
| `packageId`      | `string`                           | Yes      | -       | The ID of the package to manage photos for |
| `initialPhotos`  | `PackagePhoto[]`                   | No       | `[]`    | Initial photos to display                  |
| `onPhotosChange` | `(photos: PackagePhoto[]) => void` | No       | -       | Callback when photos are added/removed     |
| `tenantToken`    | `string`                           | No       | -       | JWT token (falls back to localStorage)     |

## Types

### PackagePhoto

```typescript
interface PackagePhoto {
  url: string; // Full URL to the photo
  filename: string; // Filename on server
  size: number; // Size in bytes
  order: number; // Display order (0-4)
}
```

## API Endpoints

The component uses the following API endpoints:

### Upload Photo

```
POST /v1/tenant/admin/packages/:id/photos
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- photo: File

Response (201):
{
  "url": "http://localhost:5000/uploads/packages/package-123-abc.jpg",
  "filename": "package-123-abc.jpg",
  "size": 1024000,
  "order": 0
}

Error Responses:
- 400: No file uploaded, invalid file type, or max photos reached (5)
- 401: Unauthorized (no/invalid token)
- 403: Forbidden (package belongs to different tenant)
- 404: Package not found
- 413: File too large (>5MB)
```

### Delete Photo

```
DELETE /v1/tenant/admin/packages/:id/photos/:filename
Authorization: Bearer <token>

Response (204): No content

Error Responses:
- 401: Unauthorized
- 403: Forbidden
- 404: Package or photo not found
- 500: Internal server error
```

## Validation Rules

### File Size

- Maximum: 5MB (5,242,880 bytes)
- Error message: "File size exceeds maximum of 5MB (file is X.XX MB)"

### File Type

- Allowed: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/svg+xml`
- Error message: "Invalid file type. Allowed types: JPG, PNG, WebP, SVG"

### Photo Count

- Maximum: 5 photos per package
- Error message: "Maximum 5 photos per package"
- Upload button is disabled when limit is reached

## Error Handling

The component handles all API error responses gracefully:

| Error Code | User Message                               |
| ---------- | ------------------------------------------ |
| 400        | Specific validation error from API         |
| 401        | "Unauthorized: Please log in again"        |
| 403        | "Forbidden: You do not have permission..." |
| 404        | "Package not found" or "Photo not found"   |
| 413        | "File too large (maximum 5MB)"             |
| Other      | Generic error message                      |

## UI Components Used

- `Card` - Container with navy background
- `Button` - Upload and delete buttons
- `Dialog` - Delete confirmation modal
- Lucide Icons: `Upload`, `Trash2`, `AlertCircle`, `CheckCircle`, `Loader2`, `ImageIcon`

## Styling

The component uses Tailwind CSS with the project's color scheme:

- Navy background (`bg-navy-800`, `bg-navy-700`)
- Lavender accents (`text-lavender-50`, `border-lavender-600`)
- Red for delete actions (`bg-red-600`)
- Responsive grid: 1 column (mobile) → 2 columns (tablet) → 3 columns (desktop)

## Accessibility

- Semantic HTML structure
- ARIA labels on buttons
- Keyboard navigation support
- Screen reader friendly
- Touch-friendly tap targets (minimum 44x44px)

## Future Enhancements

- [ ] Drag-and-drop reordering
- [ ] Drag-and-drop file upload
- [ ] Image cropping/editing
- [ ] Progress bar for uploads
- [ ] Batch upload (multiple files at once)
- [ ] Image optimization/compression
- [ ] Alternative text (alt) management

## Integration Example

See `PackagePhotoUploader.example.tsx` for complete integration examples including:

- Basic usage in package edit form
- Standalone photo manager
- Custom token handling
- Integration with existing TenantPackagesManager

## Testing

To test the component:

1. **File Size Validation**:
   - Upload a file larger than 5MB
   - Expected: Error message displayed

2. **File Type Validation**:
   - Upload a non-image file (e.g., PDF, TXT)
   - Expected: Error message displayed

3. **Max Photo Limit**:
   - Upload 5 photos
   - Expected: Upload button disabled, helper text updated

4. **Delete Functionality**:
   - Click delete on a photo
   - Expected: Confirmation dialog appears
   - Confirm deletion
   - Expected: Photo removed, success message shown

5. **Error Scenarios**:
   - Test without authentication token
   - Test with invalid package ID
   - Test network failures

## Troubleshooting

### Photos not uploading

- Check that `tenantToken` is valid or exists in `localStorage`
- Verify the API server is running
- Check browser console for detailed error messages

### Photos not displaying

- Verify `initialPhotos` prop has correct structure
- Check that photo URLs are accessible
- Ensure CORS is configured correctly on the server

### Delete not working

- Verify the filename in the URL matches exactly
- Check server logs for file system errors
- Ensure package ownership matches the authenticated tenant

## License

Internal component for the MAIS business growth platform.
