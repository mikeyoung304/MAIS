import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { packagePhotoApi } from '@/lib/package-photo-api';
import { useSuccessMessage } from '@/hooks/useSuccessMessage';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { PackageDto } from '@macon/contracts';
import type { PackagePhoto } from '@/features/photos';

export function usePackageManager(onPackagesChange: () => void) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const { message: successMessage, showSuccess } = useSuccessMessage();
  const [packagePhotos, setPackagePhotos] = useState<PackagePhoto[]>([]);
  const { confirm, dialogState, handleOpenChange } = useConfirmDialog();

  const handleCreate = () => {
    setIsCreating(true);
    setEditingPackageId(null);
    setPackagePhotos([]);
  };

  const handleEdit = async (pkg: PackageDto) => {
    setEditingPackageId(pkg.id);
    setIsCreating(true);

    // Load photos for this package
    try {
      const packageWithPhotos = await packagePhotoApi.getPackageWithPhotos(pkg.id);
      setPackagePhotos(packageWithPhotos.photos || []);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load package photos:', err);
      }
      toast.error('Failed to load package photos', {
        description: 'Photos may not be displayed. Please try again.',
      });
      setPackagePhotos([]);
    }

    return pkg;
  };

  const handleDelete = async (packageId: string) => {
    const confirmed = await confirm({
      title: 'Delete Package',
      description: 'Are you sure you want to delete this package?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    try {
      const result = await api.tenantAdminDeletePackage({
        params: { id: packageId },
        body: undefined,
      });

      if (result.status === 204) {
        showSuccess('Package deleted successfully');
        onPackagesChange();
      } else {
        toast.error('Failed to delete package', {
          description: 'Please try again or contact support.',
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to delete package:', err);
      }
      toast.error('An error occurred while deleting the package', {
        description: 'Please try again or contact support.',
      });
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingPackageId(null);
    setPackagePhotos([]);
  };

  const handleFormSuccess = (message: string) => {
    showSuccess(message);
    setIsCreating(false);
    setEditingPackageId(null);
    setPackagePhotos([]);
  };

  return {
    isCreating,
    editingPackageId,
    successMessage,
    packagePhotos,
    setPackagePhotos,
    handleCreate,
    handleEdit,
    handleDelete,
    handleCancel,
    handleFormSuccess,
    confirmDialog: { dialogState, handleOpenChange },
  };
}
