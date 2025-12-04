/**
 * Example usage of PackagePhotoUploader component
 *
 * This file demonstrates how to integrate the PackagePhotoUploader
 * into a package editing form or package management page.
 */

import { useState, useEffect } from 'react';
import { PackagePhotoUploader, PackagePhoto } from './PackagePhotoUploader';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

/**
 * Example 1: Basic Usage in Package Edit Form
 */
export function PackageEditFormExample() {
  const packageId = 'pkg-123'; // Replace with actual package ID
  const [photos, setPhotos] = useState<PackagePhoto[]>([]);

  // Load initial photos from API
  useEffect(() => {
    const loadPackage = async () => {
      try {
        // Fetch package data (adjust API call based on your implementation)
        const result = await (api as any).tenantGetPackage({
          params: { id: packageId },
        });

        if (result.status === 200 && result.body.photos) {
          setPhotos(result.body.photos);
        }
      } catch (error) {
        console.error('Failed to load package photos:', error);
      }
    };

    loadPackage();
  }, [packageId]);

  // Handle photo changes
  const handlePhotosChange = (updatedPhotos: PackagePhoto[]) => {
    setPhotos(updatedPhotos);
    console.log('Photos updated:', updatedPhotos);
    // Optionally update parent form state or trigger a save
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <h2 className="text-2xl font-semibold mb-4 text-white">Edit Package</h2>

        {/* Other package form fields would go here */}
        {/* ... title, description, price, etc. ... */}
      </Card>

      {/* Photo uploader */}
      <PackagePhotoUploader
        packageId={packageId}
        initialPhotos={photos}
        onPhotosChange={handlePhotosChange}
      />
    </div>
  );
}

/**
 * Example 2: Standalone Usage
 */
export function StandalonePhotoManagerExample() {
  const packageId = 'pkg-456'; // Replace with actual package ID

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Manage Package Photos</h1>

      <PackagePhotoUploader
        packageId={packageId}
        initialPhotos={[]}
        onPhotosChange={(photos) => {
          console.log('Current photos:', photos);
        }}
      />
    </div>
  );
}

/**
 * Example 3: With Custom Token (if not using localStorage)
 */
export function CustomTokenExample() {
  const packageId = 'pkg-789';
  const customToken = 'your-jwt-token-here';

  return (
    <PackagePhotoUploader
      packageId={packageId}
      initialPhotos={[]}
      tenantToken={customToken}
      onPhotosChange={(photos) => {
        console.log('Photos updated:', photos);
      }}
    />
  );
}

/**
 * Example 4: Integration with TenantPackagesManager
 *
 * This shows how to add the photo uploader to the existing
 * TenantPackagesManager component for editing packages.
 */
export function IntegrationExample() {
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PackagePhoto[]>([]);

  // When a package is selected for editing
  const handleEditPackage = async (packageId: string) => {
    setSelectedPackageId(packageId);

    // Load package photos
    try {
      const result = await (api as any).tenantGetPackage({
        params: { id: packageId },
      });

      if (result.status === 200 && result.body.photos) {
        setPhotos(result.body.photos);
      }
    } catch (error) {
      console.error('Failed to load package:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Package list and form would be here */}

      {/* Show photo uploader when editing a package */}
      {selectedPackageId && (
        <PackagePhotoUploader
          packageId={selectedPackageId}
          initialPhotos={photos}
          onPhotosChange={setPhotos}
        />
      )}
    </div>
  );
}
