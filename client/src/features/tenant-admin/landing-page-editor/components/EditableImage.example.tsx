/**
 * EditableImage Usage Examples
 *
 * This file demonstrates how to use the EditableImage component
 * in different landing page sections.
 */

import { EditableImage } from './EditableImage';
import type { HeroSectionConfig, GallerySectionConfig } from '@macon/contracts';

/**
 * Example 1: Hero Section Background Image
 *
 * Usage in EditableHeroSection.tsx:
 */
export function HeroBackgroundExample({
  config,
  onUpdate,
  packageId,
}: {
  config: HeroSectionConfig;
  onUpdate: (updates: Partial<HeroSectionConfig>) => void;
  packageId: string;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Hero Background Image</h3>
      <EditableImage
        currentUrl={config.backgroundImageUrl}
        onUpload={(url) => onUpdate({ backgroundImageUrl: url })}
        onRemove={() => onUpdate({ backgroundImageUrl: undefined })}
        packageId={packageId}
        aspectRatio="16/9"
        placeholder="Upload hero background image"
        alt="Hero section background"
      />
    </div>
  );
}

/**
 * Example 2: Gallery Image Upload
 *
 * Usage in EditableGallerySection.tsx:
 */
export function GalleryImageExample({
  config,
  onUpdate,
  packageId,
  imageIndex,
}: {
  config: GallerySectionConfig;
  onUpdate: (updates: Partial<GallerySectionConfig>) => void;
  packageId: string;
  imageIndex: number;
}) {
  const currentImage = config.images[imageIndex];

  return (
    <EditableImage
      currentUrl={currentImage?.url}
      onUpload={(url) => {
        const newImages = [...config.images];
        newImages[imageIndex] = { url, alt: currentImage?.alt || '' };
        onUpdate({ images: newImages });
      }}
      onRemove={() => {
        const newImages = config.images.filter((_, i) => i !== imageIndex);
        onUpdate({ images: newImages });
      }}
      packageId={packageId}
      aspectRatio="1/1"
      placeholder={`Upload gallery image ${imageIndex + 1}`}
      alt={currentImage?.alt || `Gallery image ${imageIndex + 1}`}
    />
  );
}

/**
 * Example 3: Square Profile/Logo Image
 *
 * Usage in EditableAboutSection.tsx:
 */
export function ProfileImageExample({
  imageUrl,
  onUpdate,
  packageId,
}: {
  imageUrl: string | undefined;
  onUpdate: (imageUrl: string | undefined) => void;
  packageId: string;
}) {
  return (
    <EditableImage
      currentUrl={imageUrl}
      onUpload={onUpdate}
      onRemove={() => onUpdate(undefined)}
      packageId={packageId}
      aspectRatio="1/1"
      placeholder="Upload profile photo"
      alt="Profile photo"
      className="max-w-sm"
    />
  );
}

/**
 * Example 4: Wide Banner Image
 *
 * Usage for wide banner sections:
 */
export function BannerImageExample({
  imageUrl,
  onUpdate,
  packageId,
}: {
  imageUrl: string | undefined;
  onUpdate: (imageUrl: string | undefined) => void;
  packageId: string;
}) {
  return (
    <EditableImage
      currentUrl={imageUrl}
      onUpload={onUpdate}
      onRemove={() => onUpdate(undefined)}
      packageId={packageId}
      aspectRatio="4/3"
      placeholder="Upload banner image"
      alt="Banner image"
    />
  );
}

/**
 * Example 5: Disabled State
 *
 * Usage when form is being saved or user lacks permissions:
 */
export function DisabledExample({
  imageUrl,
  onUpdate,
  packageId,
  isSaving,
}: {
  imageUrl: string | undefined;
  onUpdate: (imageUrl: string | undefined) => void;
  packageId: string;
  isSaving: boolean;
}) {
  return (
    <EditableImage
      currentUrl={imageUrl}
      onUpload={onUpdate}
      onRemove={() => onUpdate(undefined)}
      packageId={packageId}
      aspectRatio="16/9"
      placeholder="Upload image"
      disabled={isSaving}
      alt="Image"
    />
  );
}

/**
 * Integration Notes:
 *
 * 1. Package ID Requirement:
 *    - EditableImage requires a packageId for the upload endpoint
 *    - Pass the landing page's associated package ID from parent component
 *    - Example: const { packageId } = useLandingPageContext();
 *
 * 2. Lazy Loading:
 *    - All preview images use loading="lazy" automatically
 *    - No additional configuration needed for performance optimization
 *
 * 3. File Validation:
 *    - Max file size: 5MB
 *    - Allowed formats: JPG, PNG, WebP, SVG
 *    - Validation happens client-side before upload
 *
 * 4. Error Handling:
 *    - Component displays inline error messages
 *    - Errors are logged to client logger
 *    - Upload failures don't break the UI
 *
 * 5. Accessibility:
 *    - Always provide meaningful alt text
 *    - Component includes proper ARIA labels
 *    - Keyboard accessible (Space/Enter to trigger upload)
 *
 * 6. Aspect Ratios:
 *    - 'auto': Natural image dimensions
 *    - '16/9': Widescreen (hero backgrounds, banners)
 *    - '1/1': Square (profile photos, logos, gallery)
 *    - '4/3': Traditional photo (content images)
 */
