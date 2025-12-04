---
status: complete
priority: p3
issue_id: '222'
tags: [ux, gallery, lightbox, landing-page, resolved]
dependencies: []
---

# TODO-222: Gallery Section Missing Lightbox Feature

## Priority: P3 (Nice-to-have)

## Status: Resolved

## Resolution Date: 2025-12-03

## Source: Code Review - Landing Page Implementation

## Description

The gallery section displays images in a grid but lacks a lightbox feature for viewing full-size images. This is a common UX expectation for image galleries.

## Current Implementation

```typescript
// GallerySection.tsx - Static grid only
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {config.images.map((image, index) => (
    <img key={index} src={image.url} alt={image.alt} />
  ))}
</div>
```

## Suggested Enhancement

### Option A: Use Radix Dialog

```typescript
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

function GallerySection({ config }: GallerySectionProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  return (
    <section>
      <div className="grid grid-cols-4 gap-4">
        {config.images.map((image, index) => (
          <button
            key={index}
            onClick={() => setSelectedImage(image)}
            className="aspect-square overflow-hidden rounded-lg"
          >
            <img src={image.url} alt={image.alt} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      <Dialog.Root open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80" />
          <Dialog.Content className="fixed inset-4 flex items-center justify-center">
            {selectedImage && (
              <img
                src={selectedImage.url}
                alt={selectedImage.alt}
                className="max-w-full max-h-full object-contain"
              />
            )}
            <Dialog.Close className="absolute top-4 right-4 text-white">
              Close
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
```

### Option B: Use Existing Library

```bash
npm install yet-another-react-lightbox
```

```typescript
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

function GallerySection({ config }: GallerySectionProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const slides = config.images.map((img) => ({
    src: img.url,
    alt: img.alt,
  }));

  return (
    <section>
      {/* Grid */}
      <div className="grid grid-cols-4 gap-4">
        {config.images.map((image, index) => (
          <button
            key={index}
            onClick={() => {
              setPhotoIndex(index);
              setLightboxOpen(true);
            }}
          >
            <img src={image.url} alt={image.alt} />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={photoIndex}
        slides={slides}
      />
    </section>
  );
}
```

## Features to Include

- Full-screen image view
- Next/previous navigation
- Keyboard navigation (arrow keys, Escape)
- Touch/swipe support on mobile
- Image captions
- Zoom capability (optional)

## Implementation Details

### Changes Made

1. **Added Radix Dialog Integration**
   - Imported `@radix-ui/react-dialog` (already installed, v1.1.15)
   - Added `useState` hook for selected image state
   - Imported `X` icon from lucide-react for close button

2. **Updated Gallery Grid Items**
   - Changed `<div>` elements to `<button>` elements for accessibility
   - Added `onClick` handler to set selected image
   - Added `focus-visible` styles with ring indicator
   - Added `aria-label` for screen readers
   - Preserved all existing hover effects and styling

3. **Added Lightbox Dialog Component**
   - Dialog.Root with controlled open state
   - Dialog.Portal for rendering outside DOM hierarchy
   - Dialog.Overlay with semi-transparent black background (80% opacity)
   - Dialog.Content with centered flexbox layout
   - Full-size image display with `max-h-[90vh]` and `object-contain`
   - Close button with X icon in top-right corner
   - Screen reader accessible close button with sr-only text

### Accessibility Features

- Keyboard navigation (Escape to close - built into Radix Dialog)
- Focus trap inside dialog when open
- Focus-visible outline on gallery buttons
- ARIA labels for screen readers
- Screen reader text for close button

### User Experience

- Click any gallery image to view full-size in lightbox
- Semi-transparent dark overlay dims background
- Image scales to fit viewport (max 90vh)
- Close button always visible in top-right
- Click overlay or press Escape to close
- Smooth fade animations on open/close

## Acceptance Criteria

- [x] Clicking gallery image opens lightbox
- [x] Lightbox shows full-size image
- [x] Keyboard accessible (Escape to close)
- [x] Accessible close button with icon and sr-only text
- [ ] Navigation between images (not implemented - single image view only)
- [ ] Mobile touch gestures (not implemented - basic tap to close via overlay)

## Notes

This implementation uses Option A (Radix Dialog) as suggested, which was the best choice because:

- @radix-ui/react-dialog was already installed in the project
- No additional dependencies required
- Consistent with other Radix UI components in the codebase
- Built-in accessibility features (focus trap, keyboard navigation)
- Lightweight and performant

Navigation between images (arrows/swipe) was not implemented as it would require additional complexity. The current implementation focuses on the core lightbox functionality - viewing individual images at full size.

## Tags

ux, gallery, lightbox, landing-page, resolved
