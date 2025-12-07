import { useState, memo } from 'react';
import { Pencil, Trash2, Image, Package, AlertTriangle, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MobileActionDropdown } from '@/components/shared/MobileActionDropdown';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatCurrency } from '@/lib/utils';
import { sanitizeImageUrl } from '@/lib/sanitize-url';
import type { PackageDto } from '@macon/contracts';

interface PackageListProps {
  packages: PackageDto[];
  onEdit: (pkg: PackageDto) => void;
  onDelete: (packageId: string) => void;
}

/**
 * PackageList Component
 *
 * Displays packages in an elegant grid/list hybrid layout
 * Design: Matches landing page aesthetic with cream backgrounds,
 * sage accents, and subtle hover states
 * Memoized to prevent unnecessary re-renders when parent re-renders
 */
export const PackageList = memo(function PackageList({
  packages,
  onEdit,
  onDelete,
}: PackageListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<PackageDto | null>(null);

  const handleDeleteClick = (pkg: PackageDto) => {
    setPackageToDelete(pkg);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (packageToDelete) {
      onDelete(packageToDelete.id);
      setDeleteDialogOpen(false);
      setPackageToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setPackageToDelete(null);
  };

  if (packages.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Ready to showcase your services"
        description="Create your first package to start accepting bookings. Your packages will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {packages.map((pkg, index) => (
        <div
          key={pkg.id}
          className="group bg-surface-alt rounded-2xl border border-sage-light/20 hover:border-sage-light/40 overflow-hidden transition-all duration-300 hover:shadow-soft"
          style={{
            animationDelay: `${index * 0.05}s`,
          }}
        >
          {/* Mobile: Stack vertically | Desktop: Horizontal layout */}
          <div className="flex flex-col sm:flex-row sm:items-stretch">
            {/* Photo - Full width on mobile, fixed width on desktop */}
            <div className="relative w-full sm:w-40 flex-shrink-0">
              {pkg.photos && pkg.photos.length > 0 ? (
                <>
                  <img
                    src={sanitizeImageUrl(pkg.photos[0].url) || undefined}
                    alt={`${pkg.title} preview`}
                    className="w-full h-48 sm:h-full object-cover sm:min-h-[120px]"
                    onError={(e) => {
                      // Fallback to placeholder on image load error
                      e.currentTarget.style.display = 'none';
                      const placeholder = e.currentTarget.nextElementSibling;
                      if (placeholder) {
                        (placeholder as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                  <div className="hidden w-full h-48 sm:h-full sm:min-h-[120px] bg-sage-light/10 items-center justify-center">
                    <Image className="w-10 h-10 text-sage-light/50" aria-hidden="true" />
                  </div>
                  {pkg.photos.length > 1 && (
                    <span className="absolute bottom-2 left-2 bg-text-primary/80 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" aria-hidden="true" />
                      <span className="sr-only">{pkg.photos.length} photos available</span>
                      <span aria-hidden="true">{pkg.photos.length}</span>
                    </span>
                  )}
                </>
              ) : (
                <div className="w-full h-48 sm:h-full sm:min-h-[120px] bg-sage-light/10 flex items-center justify-center">
                  <Image className="w-10 h-10 text-sage-light/50" aria-hidden="true" />
                </div>
              )}

              {/* Mobile: Action dropdown overlay on image */}
              <div className="absolute top-2 right-2 sm:hidden">
                <MobileActionDropdown
                  actions={[
                    {
                      label: 'Edit',
                      icon: Pencil,
                      onClick: () => onEdit(pkg),
                    },
                    {
                      label: 'Delete',
                      icon: Trash2,
                      onClick: () => handleDeleteClick(pkg),
                      variant: 'danger',
                    },
                  ]}
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 sm:p-5 flex flex-col justify-center min-w-0">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  {/* Title and Status */}
                  <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-wrap">
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-text-primary leading-tight">
                      {pkg.title}
                    </h3>
                    <StatusBadge status={pkg.isActive !== false ? 'Active' : 'Inactive'} />
                  </div>

                  {/* Description - More visible on mobile */}
                  <p className="text-text-muted text-sm mt-2 line-clamp-2 sm:line-clamp-2 leading-relaxed">
                    {pkg.description}
                  </p>

                  {/* Price */}
                  <div className="mt-3">
                    <span className="font-serif text-xl sm:text-lg font-bold text-sage">
                      {formatCurrency(pkg.priceCents)}
                    </span>
                  </div>
                </div>

                {/* Desktop actions only - Mobile uses overlay dropdown */}
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <Button
                    onClick={() => onEdit(pkg)}
                    variant="ghost"
                    size="sm"
                    className="text-text-muted hover:text-sage hover:bg-sage/10 transition-colors"
                    aria-label={`Edit package: ${pkg.title}`}
                  >
                    <Pencil className="w-4 h-4" aria-label="Edit" />
                  </Button>
                  <Button
                    onClick={() => handleDeleteClick(pkg)}
                    variant="ghost"
                    size="sm"
                    className="text-text-muted hover:text-danger-600 hover:bg-danger-50 transition-colors"
                    aria-label={`Delete package: ${pkg.title}`}
                  >
                    <Trash2 className="w-4 h-4" aria-label="Delete" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-surface border-sage-light/20 rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-danger-50 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-danger-600" aria-hidden="true" />
              </div>
              <AlertDialogTitle className="font-serif text-2xl text-text-primary">
                Delete Package?
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-text-muted">
              Are you sure you want to delete{' '}
              <strong className="font-semibold text-text-primary">
                "{packageToDelete?.title}"
              </strong>
              ?
            </AlertDialogDescription>
            <div className="mt-4 p-4 bg-danger-50 border border-danger-100 rounded-xl">
              <p className="text-sm text-danger-700 font-medium">This action cannot be undone</p>
              <ul className="mt-2 text-sm text-danger-600 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-danger-400 rounded-full" />
                  Package will be permanently removed
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-danger-400 rounded-full" />
                  No longer available for new bookings
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-danger-400 rounded-full" />
                  Existing bookings will not be affected
                </li>
              </ul>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-2">
            <AlertDialogCancel
              onClick={cancelDelete}
              className="bg-surface-alt hover:bg-sage-light/20 text-text-primary border-sage-light/30 rounded-xl"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-danger-600 hover:bg-danger-700 text-white rounded-xl"
            >
              <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
              Delete Package
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
