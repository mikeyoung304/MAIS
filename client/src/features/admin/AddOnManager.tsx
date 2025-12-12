import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUploadField } from '@/components/ImageUploadField';
import { formatCurrency } from '@/lib/utils';
import { baseUrl } from '@/lib/api';
import type { AddOnManagerProps } from './types';

export function AddOnManager({
  package: pkg,
  isAddingAddOn,
  editingAddOnId,
  addOnForm,
  isSaving,
  segments,
  onFormChange,
  onSubmit,
  onCancel,
  onEdit,
  onDelete,
  onStartAdding,
}: AddOnManagerProps) {
  return (
    <div className="space-y-3">
      {/* Add-on Form */}
      {isAddingAddOn && (
        <div className="bg-macon-navy-800 p-4 rounded-lg space-y-3 border border-white/20">
          <h5 className="font-medium text-lg text-white">
            {editingAddOnId ? 'Edit Add-on' : 'New Add-on'}
          </h5>

          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="addOnTitle" className="text-base text-white/90">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="addOnTitle"
                  type="text"
                  value={addOnForm.title}
                  onChange={(e) => onFormChange({ ...addOnForm, title: e.target.value })}
                  placeholder="Extra photography"
                  disabled={isSaving}
                  className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addOnPrice" className="text-base text-white/90">
                  Price <span className="text-destructive">*</span>
                </Label>
                <CurrencyInput
                  id="addOnPrice"
                  value={addOnForm.priceCents}
                  onChange={(centsValue) => onFormChange({ ...addOnForm, priceCents: centsValue })}
                  placeholder="100.00"
                  disabled={isSaving}
                  className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
                  required
                />
              </div>
              <ImageUploadField
                label="Add-on Photo"
                value={addOnForm.photoUrl}
                onChange={(url) => onFormChange({ ...addOnForm, photoUrl: url })}
                uploadEndpoint={`${baseUrl}/v1/tenant-admin/segment-image`}
                disabled={isSaving}
                maxSizeMB={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segmentId" className="text-white/90 text-lg">
                Segment Availability
              </Label>
              <Select
                value={addOnForm.segmentId || ''}
                onValueChange={(value) =>
                  onFormChange({ ...addOnForm, segmentId: value === '' ? '' : value })
                }
                disabled={isSaving}
              >
                <SelectTrigger className="bg-macon-navy-900 border-white/20 text-white h-12 text-lg">
                  <SelectValue placeholder="Global (All Segments)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Global (All Segments)</SelectItem>
                  {segments
                    ?.filter((s) => s.active)
                    .map((segment) => (
                      <SelectItem key={segment.id} value={segment.id}>
                        {segment.name} only
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-base text-white/70">
                Global add-ons are available to all segments
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-macon-navy hover:bg-macon-navy-dark text-base h-10 px-4"
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSaving ? 'Saving...' : editingAddOnId ? 'Update' : 'Add'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSaving}
                className="border-white/20 text-white/90 hover:bg-macon-navy-700 text-base h-10 px-4"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Add Add-on Button */}
      {!isAddingAddOn && (
        <Button
          variant="outline"
          onClick={onStartAdding}
          className="border-white/20 text-white/60 hover:bg-macon-navy-700 text-base h-10 px-4"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Add-on
        </Button>
      )}

      {/* Add-ons List */}
      {pkg.addOns.length > 0 && (
        <div className="space-y-2">
          {pkg.addOns.map((addOn) => (
            <div
              key={addOn.id}
              className="flex justify-between items-center bg-macon-navy-800 p-3 rounded border border-white/20 hover:border-white/30"
            >
              <div>
                <div className="font-medium text-lg text-white">{addOn.title}</div>
                <div className="text-lg text-white/60">{formatCurrency(addOn.priceCents)}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(addOn)}
                  className="text-white/60 hover:bg-macon-navy-700"
                  aria-label={`Edit add-on: ${addOn.title}`}
                  title="Edit add-on"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(addOn.id)}
                  className="text-destructive hover:bg-destructive/10"
                  aria-label={`Delete add-on: ${addOn.title}`}
                  title="Delete add-on"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pkg.addOns.length === 0 && !isAddingAddOn && (
        <p className="text-base text-white/70">
          Add optional extras to increase your average booking value.
        </p>
      )}
    </div>
  );
}
