/**
 * SettingsFields Component
 *
 * Settings fields for segment form (sort order, active status)
 */

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface SettingsFieldsProps {
  sortOrder: number;
  active: boolean;
  disabled?: boolean;
  onSortOrderChange: (value: number) => void;
  onActiveChange: (value: boolean) => void;
}

export function SettingsFields({
  sortOrder,
  active,
  disabled = false,
  onSortOrderChange,
  onActiveChange,
}: SettingsFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sortOrder" className="text-white/90 text-lg">
            Sort Order
          </Label>
          <Input
            id="sortOrder"
            type="number"
            value={sortOrder}
            onChange={(e) => onSortOrderChange(parseInt(e.target.value, 10) || 0)}
            placeholder="0"
            disabled={disabled}
            className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
          />
          <p className="text-base text-white/70">Lower numbers appear first in navigation</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            id="active"
            type="checkbox"
            checked={active}
            onChange={(e) => onActiveChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 text-white0 bg-macon-navy-900 border-white/20 rounded focus:ring-macon-navy-500"
          />
          <Label htmlFor="active" className="text-white/90 text-lg cursor-pointer">
            Active
          </Label>
        </div>
        <p className="text-base text-white/70">Inactive segments are hidden from public view</p>
      </div>
    </>
  );
}
