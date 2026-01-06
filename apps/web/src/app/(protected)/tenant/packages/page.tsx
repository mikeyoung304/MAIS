'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  DollarSign,
  Image as ImageIcon,
} from 'lucide-react';
import { PhotoUploader } from '@/components/photos';
import type { PackagePhoto } from '@/hooks/usePhotoUpload';

interface PackageDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  depositAmount: number | null;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  photos?: PackagePhoto[];
  photoUrl?: string;
}

/**
 * Tenant Packages Page
 *
 * Allows tenant admins to manage their service packages.
 * Includes photo upload functionality for each package.
 */
export default function TenantPackagesPage() {
  const { isAuthenticated } = useAuth();
  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPackage, setEditingPackage] = useState<PackageDto | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const fetchPackages = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch('/api/tenant-admin/packages');

      if (response.ok) {
        const data = await response.json();
        setPackages(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to load packages');
      }
    } catch {
      setError('Failed to load packages');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price / 100);
  };

  /**
   * Open edit dialog for a package
   */
  const handleEditClick = useCallback((pkg: PackageDto) => {
    setEditingPackage(pkg);
    setIsEditDialogOpen(true);
  }, []);

  /**
   * Close edit dialog
   */
  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditingPackage(null);
  }, []);

  /**
   * Handle photos change - update local state
   */
  const handlePhotosChange = useCallback(
    (photos: PackagePhoto[]) => {
      if (!editingPackage) return;

      // Update the editing package
      setEditingPackage((prev) => (prev ? { ...prev, photos } : null));

      // Update the packages list
      setPackages((prev) =>
        prev.map((pkg) =>
          pkg.id === editingPackage.id ? { ...pkg, photos, photoUrl: photos[0]?.url } : pkg
        )
      );
    },
    [editingPackage]
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-text-primary">Packages</h1>
            <p className="mt-2 text-text-muted">Manage your service offerings</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-sage" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-text-primary">Packages</h1>
            <p className="mt-2 text-text-muted">Manage your service offerings</p>
          </div>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Packages</h1>
          <p className="mt-2 text-text-muted">
            {packages.length === 0
              ? 'Create your first package to get started'
              : `${packages.length} package${packages.length !== 1 ? 's' : ''} available`}
          </p>
        </div>
        <Button variant="sage" className="rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          Create Package
        </Button>
      </div>

      {/* Empty State */}
      {packages.length === 0 ? (
        <Card className="border-2 border-dashed border-sage/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-sage/10 p-4">
              <Package className="h-8 w-8 text-sage" />
            </div>
            <h3 className="mb-2 font-semibold text-text-primary">No packages yet</h3>
            <p className="mb-6 max-w-sm text-sm text-text-muted">
              Packages define what services you offer to customers. Create your first package to
              start accepting bookings.
            </p>
            <Button variant="sage" className="rounded-full">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Package
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Packages Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden"
            >
              {/* Package Photo Thumbnail */}
              <div className="relative aspect-video bg-neutral-100">
                {pkg.photoUrl || pkg.photos?.[0]?.url ? (
                  <Image
                    src={pkg.photoUrl || pkg.photos![0].url}
                    alt={pkg.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="h-12 w-12 text-neutral-300" />
                  </div>
                )}
                {/* Photo count badge */}
                {pkg.photos && pkg.photos.length > 0 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {pkg.photos.length} photo{pkg.photos.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      pkg.isActive ? 'bg-sage/10 text-sage' : 'bg-neutral-100 text-text-muted'
                    }`}
                  >
                    {pkg.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-text-muted line-clamp-2">
                  {pkg.description || 'No description'}
                </p>

                <div className="flex items-center gap-1 text-xl font-bold text-text-primary">
                  <DollarSign className="h-5 w-5 text-sage" />
                  {formatPrice(pkg.basePrice, pkg.currency)}
                </div>

                {pkg.depositAmount && (
                  <p className="text-xs text-text-muted">
                    Deposit: {formatPrice(pkg.depositAmount, pkg.currency)}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => handleEditClick(pkg)}
                  >
                    <Pencil className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Package Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent maxWidth="2xl">
          <DialogHeader>
            <DialogTitle>Edit Package</DialogTitle>
            <DialogDescription>
              {editingPackage ? `Manage photos for "${editingPackage.name}"` : 'Loading...'}
            </DialogDescription>
          </DialogHeader>

          {editingPackage && (
            <div className="mt-4">
              <PhotoUploader
                packageId={editingPackage.id}
                initialPhotos={editingPackage.photos || []}
                onPhotosChange={handlePhotosChange}
              />
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button variant="outline" onClick={handleCloseEditDialog}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
