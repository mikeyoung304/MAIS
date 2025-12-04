# Quick Start Guide: PackagePhotoUploader

## 🚀 Ready to Use

The PackagePhotoUploader component is **production-ready** and can be integrated immediately.

---

## 📁 Files Created

```
/client/src/components/
├── PackagePhotoUploader.tsx          (462 lines) - Main component
├── PackagePhotoUploader.example.tsx  (152 lines) - Usage examples
└── PackagePhotoUploader.md           (256 lines) - Full documentation

/client/
└── PACKAGE_PHOTO_UPLOADER_IMPLEMENTATION.md - Implementation summary
```

---

## ⚡ Quick Integration (3 Steps)

### Step 1: Import the Component

```tsx
import { PackagePhotoUploader } from '@/components/PackagePhotoUploader';
```

### Step 2: Add to Your Form/Page

```tsx
export function PackageEditor() {
  const packageId = 'pkg-123'; // Your package ID

  return (
    <div>
      {/* Your existing package form */}

      {/* Add photo uploader */}
      <PackagePhotoUploader
        packageId={packageId}
        initialPhotos={[]}
        onPhotosChange={(photos) => {
          console.log('Photos updated:', photos);
        }}
      />
    </div>
  );
}
```

### Step 3: Done! ✅

That's it! The component handles everything:

- File validation (5MB, image types only)
- Upload to API
- Photo display grid
- Delete with confirmation
- Error handling
- Loading states

---

## 🎯 What It Does

### Upload Photos

- Click "Upload Photo" button
- Select image (JPG, PNG, WebP, SVG)
- Max 5MB per photo
- Max 5 photos total
- Automatic validation and error messages

### Display Photos

- Responsive grid (1-3 columns based on screen size)
- Photo order badges (#1-5)
- Hover effects
- Photo info on hover (filename, size)

### Delete Photos

- Hover over photo → Delete button appears
- Click delete → Confirmation dialog
- Confirm → Photo deleted from server
- Success notification

---

## 🔧 Configuration Options

### Basic (Minimum)

```tsx
<PackagePhotoUploader packageId="pkg-123" />
```

### With Initial Photos

```tsx
<PackagePhotoUploader
  packageId="pkg-123"
  initialPhotos={[
    {
      url: 'http://localhost:5000/uploads/packages/photo1.jpg',
      filename: 'photo1.jpg',
      size: 1024000,
      order: 0,
    },
  ]}
/>
```

### With Change Handler

```tsx
<PackagePhotoUploader
  packageId="pkg-123"
  onPhotosChange={(photos) => {
    // Do something when photos change
    setPackagePhotos(photos);
  }}
/>
```

### With Custom Token

```tsx
<PackagePhotoUploader packageId="pkg-123" tenantToken="your-jwt-token" />
```

---

## 📋 Requirements

### Backend API (Already Implemented)

✅ `POST /v1/tenant/admin/packages/:id/photos` - Upload photo
✅ `DELETE /v1/tenant/admin/packages/:id/photos/:filename` - Delete photo

### Authentication

✅ JWT token in localStorage as `tenantToken`
✅ Or pass via `tenantToken` prop

### Dependencies (Already Installed)

✅ React 18
✅ TypeScript
✅ Tailwind CSS
✅ Lucide React (icons)
✅ Radix UI (dialog)

---

## 🎨 Styling

The component uses your existing design system:

- Navy background colors (`bg-navy-800`, `bg-navy-700`)
- Lavender accent colors (`text-lavender-50`, `border-lavender-600`)
- Red for delete actions (`bg-red-600`)
- Responsive Tailwind classes

No additional CSS needed!

---

## 🧪 Testing Checklist

Before deploying, test these scenarios:

- [ ] Upload valid image < 5MB
- [ ] Upload image > 5MB (should show error)
- [ ] Upload non-image file (should show error)
- [ ] Upload 5 photos (button should disable)
- [ ] Delete photo (should ask for confirmation)
- [ ] Refresh page (photos should persist)
- [ ] Try on mobile device (should be responsive)
- [ ] Test without auth token (should show 401 error)

---

## 📚 More Information

- **Full Documentation**: `src/components/PackagePhotoUploader.md`
- **Examples**: `src/components/PackagePhotoUploader.example.tsx`
- **Implementation Details**: `PACKAGE_PHOTO_UPLOADER_IMPLEMENTATION.md`

---

## 🐛 Troubleshooting

### Photos not uploading?

1. Check browser console for errors
2. Verify tenant token exists in localStorage
3. Ensure API server is running
4. Check file size < 5MB and is an image

### Photos not displaying?

1. Verify photo URLs are accessible
2. Check browser network tab for 404s
3. Ensure CORS is configured on server

### Delete not working?

1. Check filename matches exactly
2. Verify package ownership (must be same tenant)
3. Check server logs for file system errors

---

## 🎉 You're All Set!

The component is production-ready and fully documented. Happy coding!

For questions or issues, refer to the full documentation in `PackagePhotoUploader.md`.
