import { Loader2, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUploadField } from '@/components/ImageUploadField';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { baseUrl } from '@/lib/api';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { PackageFormProps, PackageFormData } from './types';

export function PackageForm({
  packageForm,
  editingPackageId,
  isSaving,
  segments,
  onFormChange,
  onSubmit,
  onCancel,
}: PackageFormProps) {
  // Track initial form state for unsaved changes detection
  const [initialForm, setInitialForm] = useState<PackageFormData>(packageForm);

  // Setup confirmation dialog
  const { confirm, dialogState, handleOpenChange } = useConfirmDialog();

  // Calculate if form has unsaved changes
  const isDirty = JSON.stringify(packageForm) !== JSON.stringify(initialForm);

  // Enable unsaved changes warning with ConfirmDialog
  useUnsavedChanges({
    isDirty,
    message: 'You have unsaved package changes. Are you sure you want to leave?',
    enabled: true,
    confirmFn: (msg) =>
      confirm({
        title: 'Unsaved Changes',
        description: msg,
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        variant: 'destructive',
      }),
  });

  // Update initial form when editing a different package or after successful save
  useEffect(() => {
    setInitialForm(packageForm);
  }, [editingPackageId]);

  // Reset initial form after successful save (when isSaving goes from true to false)
  useEffect(() => {
    if (!isSaving) {
      setInitialForm(packageForm);
    }
  }, [isSaving, packageForm]);

  return (
    <>
      {/* Confirmation Dialog */}
      {dialogState && (
        <ConfirmDialog
          open={dialogState.isOpen}
          onOpenChange={handleOpenChange}
          title={dialogState.title}
          description={dialogState.description}
          confirmLabel={dialogState.confirmLabel}
          cancelLabel={dialogState.cancelLabel}
          variant={dialogState.variant}
          onConfirm={dialogState.onConfirm}
        />
      )}

      {/* Back button */}
      <Button variant="ghost" onClick={onCancel} className="mb-4 min-h-[44px]">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <Card className="p-6 bg-macon-navy-800 border-white/20">
        <h2 className="text-2xl font-semibold mb-4 text-white">
          {editingPackageId ? 'Edit Package' : 'Create New Package'}
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug" className="text-white/90 text-lg">
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                type="text"
                value={packageForm.slug}
                onChange={(e) =>
                  onFormChange({ ...packageForm, slug: e.target.value.toLowerCase() })
                }
                placeholder="premium-consulting"
                disabled={isSaving}
                className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
                required
              />
              <p className="text-base text-white/70">Lowercase with hyphens only</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-white/90 text-lg">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                type="text"
                value={packageForm.title}
                onChange={(e) => onFormChange({ ...packageForm, title: e.target.value })}
                placeholder="Premium Consulting"
                disabled={isSaving}
                className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-white/90 text-lg">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={packageForm.description}
              onChange={(e) => onFormChange({ ...packageForm, description: e.target.value })}
              rows={3}
              placeholder="A premium service that transforms your clients' experience..."
              disabled={isSaving}
              className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priceDollars" className="text-white/90 text-lg">
                Price <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput
                id="priceDollars"
                value={packageForm.priceCents}
                onChange={(centsValue) => onFormChange({ ...packageForm, priceCents: centsValue })}
                placeholder="500.00"
                disabled={isSaving}
                className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
                required
              />
              <p className="text-base text-white/70">Enter the package price in dollars</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageUploadField
              label="Package Photo"
              value={packageForm.photoUrl}
              onChange={(url) => onFormChange({ ...packageForm, photoUrl: url })}
              uploadEndpoint={`${baseUrl}/v1/tenant-admin/segment-image`}
              disabled={isSaving}
              maxSizeMB={5}
            />

            <div className="space-y-2">
              <Label htmlFor="segmentId" className="text-white/90 text-lg">
                Segment (Optional)
              </Label>
              <Select
                value={packageForm.segmentId || ''}
                onValueChange={(value) =>
                  onFormChange({ ...packageForm, segmentId: value === '' ? '' : value })
                }
                disabled={isSaving}
              >
                <SelectTrigger className="bg-macon-navy-900 border-white/20 text-white h-12 text-lg">
                  <SelectValue placeholder="No segment (General Catalog)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No segment (General Catalog)</SelectItem>
                  {segments
                    ?.filter((s) => s.active)
                    .map((segment) => (
                      <SelectItem key={segment.id} value={segment.id}>
                        {segment.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-base text-white/70">
                Assign this package to a specific business segment
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-macon-navy hover:bg-macon-navy-dark text-lg h-12 px-6"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSaving ? 'Saving...' : editingPackageId ? 'Update Package' : 'Create Package'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="border-white/20 text-white/90 hover:bg-macon-navy-700 text-lg h-12 px-6"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
